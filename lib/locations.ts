import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import atlasCitiesJson from "@/lib/atlas_cities.json";

/**
 * Atlas read layer — shared data helpers (docs/PLAN-atlas-seo.md).
 * The map embeds stay on /api/geo; these helpers feed the SERVER-rendered
 * location pages (/film/x/locations, /director/x/locations, /locations/[country])
 * and the sitemap. All list-shaped answers come from jsonb-aggregating RPCs so
 * PostgREST's 1,000-row response cap can never truncate them.
 */

// Same shape film_geo / director_geo / country_geo return per pin.
export type GeoPin = {
  id: string;
  name: string;
  narrative_setting: string | null;
  scene_role: string | null;
  kind: string | null;
  lat: number;
  lng: number;
  precision?: string | null;
  country: string | null;
  layer: string; // "filmed" | "setting"
  built_set: boolean | null;
  set_host: string | null;
  tier: string | null;
  sources: unknown;
  fig_slug: string | null;
  fig_label?: string | null;
  fig_desc?: string | null;
  film_slug?: string | null;
  film_title?: string | null;
  film_year?: number | null;
  poster_path?: string | null;
  director?: string | null;
  director_slug?: string | null;
};

export type LocationCountry = {
  country: string;
  pins: number;
  films: {
    slug: string; title: string; year: number | null;
    director: string | null; director_slug: string | null;
    poster_path: string | null;
    pins: number; top_location: string | null;
  }[];
  landmarks: { name: string; films: number; note: string | null }[];
};

export type LocationsEligibility = {
  films: { slug: string; n: number }[];
  directors: { slug: string; films: number; n: number }[];
  countries: { name: string; slug: string; pins: number; films: number }[];
};

// Publication gates (mirrored by the pages' robots bars and the sitemap).
export const FILM_LOCATIONS_MIN = 3;
export const DIRECTOR_LOCATIONS_MIN_FILMS = 2;
export const DIRECTOR_LOCATIONS_MIN_PINS = 6;

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** Country display name → URL slug. MUST stay in sync with the SQL rule in the
 * atlas RPCs: lower, non-alphanumeric runs → "-", trim "-". */
export function countrySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const PRECISION_RANK: Record<string, number> = { exact: 0, venue: 1, area: 2, city: 3 };
export function precisionRank(p: string | null | undefined): number {
  return p ? PRECISION_RANK[p] ?? 4 : 4;
}

const longer = (a: string | null | undefined, b: string | null | undefined) =>
  (b ?? "").length > (a ?? "").length ? (b ?? null) : (a ?? null);

function mergeTwo<T extends GeoPin>(cur: T, p: T): T {
  const winner = precisionRank(p.precision) < precisionRank(cur.precision) ? p : cur;
  return {
    ...winner,
    narrative_setting: longer(cur.narrative_setting, p.narrative_setting),
    scene_role: longer(cur.scene_role, p.scene_role),
    fig_slug: cur.fig_slug ?? p.fig_slug,
    fig_label: cur.fig_label ?? p.fig_label,
    built_set: cur.built_set || p.built_set,
    set_host: cur.set_host ?? p.set_host,
  };
}

/**
 * Pass 1 — coordinate-cell merge. Two collectors (agent-search / agent-filmed)
 * often logged the same place twice — ~8.7% of pins as of 2026-07-04. Cell key
 * = layer + film + lat/lng rounded to 3 decimals (~110 m); the more precise
 * row wins the name, prose merges by length, a figure link survives from
 * either row. Order of first appearance is kept.
 *
 * This is the GATE rule: it is exactly what atlas_eligibility_json counts in
 * SQL, so every ≥N eligibility check (sitemap, tabs, 404s) MUST use this
 * count, not mergePins() — the name-fusion pass below can drop a film under
 * its bar and desync the sitemap from the page.
 */
export function mergeCells<T extends GeoPin>(pins: T[]): T[] {
  const byCell = new Map<string, T>();
  const order: string[] = [];
  for (const p of pins) {
    if (typeof p.lat !== "number" || typeof p.lng !== "number") continue;
    const key = `${p.layer}:${p.film_slug ?? ""}:${p.lat.toFixed(3)}:${p.lng.toFixed(3)}`;
    const cur = byCell.get(key);
    if (!cur) {
      byCell.set(key, { ...p });
      order.push(key);
      continue;
    }
    byCell.set(key, mergeTwo(cur, p));
  }
  return order.map((k) => byCell.get(k)!);
}

const NAME_FUSE_DEG = 0.02; // ~2 km — same-name rows geocoded apart by the two collectors

/**
 * Full DISPLAY merge: pass 1 above, then pass 2 fuses rows in the same film +
 * layer + country whose first name segment matches ("110 Longfellow Avenue,
 * …") and that sit within ~2 km — different geocodes of one address. Same
 * name far apart (chain locations, common street names) stays separate.
 */
export function mergePins<T extends GeoPin>(pins: T[]): T[] {
  const out: T[] = [];
  const idxByKey = new Map<string, number>();
  for (const p of mergeCells(pins)) {
    const seg = (p.name ?? "").split(",")[0].trim().toLowerCase();
    const key = seg ? `${p.layer}:${p.film_slug ?? ""}:${(p.country ?? "").trim()}:${seg}` : "";
    const at = key ? idxByKey.get(key) : undefined;
    if (at !== undefined) {
      const cur = out[at];
      if (Math.abs(cur.lat - p.lat) < NAME_FUSE_DEG && Math.abs(cur.lng - p.lng) < NAME_FUSE_DEG) {
        out[at] = mergeTwo(cur, p);
        continue;
      }
    }
    if (key && at === undefined) idxByKey.set(key, out.length);
    out.push(p);
  }
  return out;
}

/** Countries present in a pin list, largest first — for lead sentences. */
export function pinCountries(pins: GeoPin[]): { name: string; pins: number }[] {
  const counts = new Map<string, number>();
  for (const p of pins) {
    const c = (p.country ?? "").trim();
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, n]) => ({ name, pins: n })).sort((a, b) => b.pins - a.pins);
}

/** Oxford-comma-free "A, B and C" for lead prose. */
export function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

// Country names that read wrong mid-sentence without an article.
const THE_COUNTRIES = new Set([
  "United States", "United Kingdom", "Netherlands", "Philippines",
  "United Arab Emirates", "Dominican Republic", "Czech Republic", "Bahamas",
  "Maldives", "Marshall Islands", "Cayman Islands", "Isle of Man",
  "Democratic Republic of the Congo", "Republic of the Congo",
]);

/** "United States" → "the United States" for running prose (not headings-only contexts). */
export function countryPhrase(name: string): string {
  return THE_COUNTRIES.has(name) ? `the ${name}` : name;
}

/** "the United States, France and Italy" / "…, France and 15 more countries". */
export function countryListPhrase(names: string[], extra = 0): string {
  const phr = names.map(countryPhrase);
  if (extra > 0) return `${phr.join(", ")} and ${extra} more ${extra === 1 ? "country" : "countries"}`;
  return listWords(phr);
}

export async function loadFilmGeo(slug: string): Promise<GeoPin[]> {
  const { data } = await db().rpc("film_geo", { p_slug: slug });
  return Array.isArray(data) ? (data as GeoPin[]) : [];
}

export async function loadDirectorGeo(slug: string): Promise<GeoPin[]> {
  const { data } = await db().rpc("director_geo", { p_slug: slug });
  return Array.isArray(data) ? (data as GeoPin[]) : [];
}

export async function loadLocationsCountry(slug: string): Promise<LocationCountry | null> {
  const { data } = await db().rpc("atlas_country_json", { p_slug: slug });
  const c = data as LocationCountry | null;
  return c && c.country ? c : null;
}

export async function loadLocationsEligibility(): Promise<LocationsEligibility> {
  const { data } = await db().rpc("atlas_eligibility_json");
  const d = (data ?? {}) as Partial<LocationsEligibility>;
  return { films: d.films ?? [], directors: d.directors ?? [], countries: d.countries ?? [] };
}

/** Eligibility roster, shared through the Data Cache — every locations page
 * needs it to avoid linking to a gated (404) sibling, so it must not cost one
 * RPC per page render. */
export function cachedLocationsEligibility(): Promise<LocationsEligibility> {
  return unstable_cache(loadLocationsEligibility, ["locations-eligibility"], { revalidate: 3600 })();
}

export type LocationsMeta = { updated: string; pins: number; films: number };

/** Dataset-level facts: the TRUE last-updated date (max created_at of the
 * location rows) and corpus size. Pages print this instead of the render
 * date — a date that changes every regeneration reads as fake freshness. */
export function cachedLocationsMeta(): Promise<LocationsMeta> {
  return unstable_cache(
    async () => {
      const { data } = await db().rpc("atlas_meta_json");
      const m = (data ?? {}) as Partial<LocationsMeta>;
      return { updated: m.updated ?? "", pins: m.pins ?? 0, films: m.films ?? 0 };
    },
    ["locations-meta"],
    { revalidate: 86400 },
  )();
}

// ---------------------------------------------------------------------------
// City / region hubs (Phase 3) — roster frozen in lib/atlas_cities.json
// (rebuilt by worker/atlas-cities-build.py; ≥3 films + p90 ≤ 150 km gates).

export type LocationCity = {
  slug: string; name: string; country: string; countrySlug: string;
  terms: string[]; lat: number; lng: number;
  films: number; pins: number; scale: "city" | "region";
};

export function allLocationCities(): LocationCity[] {
  return (atlasCitiesJson as { cities: LocationCity[] }).cities;
}

export function citiesForCountry(countrySlugValue: string): LocationCity[] {
  return allLocationCities().filter((c) => c.countrySlug === countrySlugValue);
}

export function findLocationCity(countrySlugValue: string, citySlug: string): LocationCity | null {
  return allLocationCities().find((c) => c.countrySlug === countrySlugValue && c.slug === citySlug) ?? null;
}

// MUST STAY IN SYNC with the SQL in atlas_city_candidates_json (same exclusions).
const LOCALITY_SKIP = new Set([
  "usa", "u.s.a.", "u.s.", "uk", "u.k.", "united states",
  "united states of america", "united kingdom", "czech republic",
  "holland", "republic of ireland", "republic of korea",
]);

/** Locality terms a pin's name carries — comma segments minus the
 * venue-specific head (kept when the pin IS a city) and minus country-level
 * words. Mirrors the extraction in the atlas_city_candidates_json RPC. */
export function pinLocalityTerms(name: string, kind: string | null | undefined, country: string | null | undefined): string[] {
  const parts = name.split(",").map((s) => s.trim()).filter(Boolean);
  const segs = kind !== "city" && parts.length > 1 ? parts.slice(1) : parts;
  const c = (country ?? "").toLowerCase();
  return segs
    .map((s) => s.toLowerCase())
    .filter((t) => t.length >= 3 && !/[0-9]/.test(t) && t !== c && !LOCALITY_SKIP.has(t));
}

export function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (aLat - bLat) * 111.0;
  const dLng = (aLng - bLng) * 111.0 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// A stray same-named place on another coast (Hollywood FL vs Hollywood CA)
// must not leak into a city page — membership needs the name AND proximity.
const CITY_MEMBER_KM = 250;

/** Pins belonging to a city/region hub: same country, a matching locality
 * term, and within ~250 km of the roster centroid. */
export function cityMemberPins<T extends GeoPin>(pins: T[], city: LocationCity): T[] {
  const terms = new Set(city.terms);
  return pins.filter((p) => {
    if ((p.country ?? "") !== city.country) return false;
    if (typeof p.lat !== "number" || typeof p.lng !== "number") return false;
    if (kmBetween(p.lat, p.lng, city.lat, city.lng) > CITY_MEMBER_KM) return false;
    return pinLocalityTerms(p.name, p.kind, p.country).some((t) => terms.has(t));
  });
}

export async function loadCountryGeo(countrySlugValue: string): Promise<GeoPin[]> {
  const { data } = await db().rpc("country_geo", { p_slug: countrySlugValue });
  return Array.isArray(data) ? (data as GeoPin[]) : [];
}

/** Country pin dump, shared through the Data Cache — every city page in a
 * country filters the same dump, so it must not cost one RPC per city.
 * Key bumped (2) when director fields joined the RPC payload. */
export function cachedCountryGeo(countrySlugValue: string): Promise<GeoPin[]> {
  return unstable_cache(() => loadCountryGeo(countrySlugValue), ["country-pins2", countrySlugValue], {
    revalidate: 86400,
  })();
}
