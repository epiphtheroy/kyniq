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

/** Does this pin actually carry citation URLs? */
export function hasSources(p: GeoPin): boolean {
  return Array.isArray(p.sources)
    && (p.sources as unknown[]).some((s) => typeof s === "string" && s.startsWith("http"));
}

// verified (2+ independent domains) beats probable (one trusted domain) beats
// weak; a pin with no citations at all ranks last.
const TIER_RANK: Record<string, number> = { verified: 0, probable: 1, weak: 2 };
function citationRank(p: GeoPin): number {
  return hasSources(p) ? (TIER_RANK[p.tier ?? ""] ?? 3) : 9;
}

function mergeTwo<T extends GeoPin>(cur: T, p: T): T {
  const winner = precisionRank(p.precision) < precisionRank(cur.precision) ? p : cur;
  // Receipts must survive the fuse. `winner` is picked on precision alone, so a
  // sourceless duplicate can outrank the row that actually carries the citations
  // and silently strip them off a cited pin (and with them its Verified mark).
  // Carry tier + sources from whichever row is better evidenced.
  const cited = citationRank(p) < citationRank(cur) ? p : cur;
  return {
    ...winner,
    tier: cited.tier,
    sources: cited.sources,
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
  // THROW on error, never return []. The caller gates the page on pin count, so a
  // swallowed RPC timeout here is indistinguishable from "this film has no
  // locations" and 404s a live page — which ISR then caches for 24h (page.tsx
  // revalidate = 86400). Googlebot reads that 404 as a removal. A thrown error
  // is not written to the Data Cache and surfaces as a 5xx, which Google treats
  // as temporary. Errors must never decide whether a URL exists.
  const { data, error } = await db().rpc("film_geo", { p_slug: slug });
  if (error) throw new Error(`film_geo(${slug}): ${error.message}`);
  return Array.isArray(data) ? (data as GeoPin[]) : [];
}

export async function loadDirectorGeo(slug: string): Promise<GeoPin[]> {
  // Same rule as loadFilmGeo: the caller gates the page on pin/film counts, so a
  // swallowed error returns [] and 404s a live director page for the 24h that
  // route caches. Errors must never decide whether a URL exists.
  const { data, error } = await db().rpc("director_geo", { p_slug: slug });
  if (error) throw new Error(`director_geo(${slug}): ${error.message}`);
  return Array.isArray(data) ? (data as GeoPin[]) : [];
}

export async function loadLocationsCountry(slug: string): Promise<LocationCountry | null> {
  // null must mean "no such country", not "the database blinked" — the country hub
  // 404s on null and holds it for 24h.
  const { data, error } = await db().rpc("atlas_country_json", { p_slug: slug });
  if (error) throw new Error(`atlas_country_json(${slug}): ${error.message}`);
  const c = data as LocationCountry | null;
  return c && c.country ? c : null;
}

export async function loadLocationsEligibility(): Promise<LocationsEligibility> {
  // Same rule as loadFilmGeo: a swallowed error here returns empty rosters, which
  // silently strips sibling links and — where callers gate on membership — turns a
  // qualifying page into a non-qualifying one. cachedLocationsEligibility() already
  // refuses to memoise a rejection, so throwing degrades for one request instead of
  // an hour.
  const { data, error } = await db().rpc("atlas_eligibility_json");
  if (error) throw new Error(`atlas_eligibility_json: ${error.message}`);
  const d = (data ?? {}) as Partial<LocationsEligibility>;
  return { films: d.films ?? [], directors: d.directors ?? [], countries: d.countries ?? [] };
}

/**
 * Eligibility roster — every locations page and two sitemaps need it, so it must
 * not cost one RPC per render.
 *
 * It was already wrapped in unstable_cache, and that was NOT holding. Measured
 * on production 2026-07-31: six forced renders of location-hubs.xml raised
 * atlas_eligibility_json's call count by three. A 1-hour cache that answers
 * every other request is not a cache, and this RPC costs ~1.5s a call — it was
 * the largest single consumer in the database on the night the app went down.
 *
 * So the Data Cache is now a second line, not the only one. This module-scope
 * memo is the first: within a lambda instance, the first caller starts the RPC
 * and everyone else — pages and sitemaps alike — awaits the same promise. Worst
 * case is one call per warm instance per hour instead of one per render, and
 * that bound does not depend on any cache layer behaving the way its docs
 * suggest, which is the assumption that failed twice tonight.
 *
 * The in-flight promise is shared before it resolves, so a burst of concurrent
 * renders on a cold instance collapses to one query rather than stampeding. A
 * rejection is not memoised: it clears the slot so the next caller retries
 * instead of inheriting an hour of failure.
 */
const ELIGIBILITY_TTL_MS = 60 * 60 * 1000;
let eligibilityMemo: { at: number; value: Promise<LocationsEligibility> } | null = null;

/**
 * Eligibility for call sites where this roster only DECORATES — a footer link, a
 * hub listing — rather than deciding whether a page exists.
 *
 * loadLocationsEligibility() throws now (see its comment), which is right for the
 * pages that ARE locations pages: better a 5xx Google retries than a 404 it acts
 * on. But atlas_eligibility_json is the ~1.5s RPC that was the single largest
 * consumer in the database the night it fell over, and it is reached from
 * ReadPlates — rendered on ~38,000 URLs across 13 route families, most of which
 * have nothing to do with locations — and from three PRERENDERED hub pages, where
 * a throw aborts `next build` and blocks the whole production deploy.
 *
 * So: decorative callers degrade, load-bearing callers fail loudly.
 */
export function softLocationsEligibility(): Promise<LocationsEligibility> {
  return cachedLocationsEligibility().catch(() => ({ films: [], directors: [], countries: [] }));
}

export function cachedLocationsEligibility(): Promise<LocationsEligibility> {
  const now = Date.now();
  if (eligibilityMemo && now - eligibilityMemo.at < ELIGIBILITY_TTL_MS) return eligibilityMemo.value;
  const value = unstable_cache(loadLocationsEligibility, ["locations-eligibility"], {
    revalidate: 3600,
  })().catch((e) => {
    eligibilityMemo = null; // never hold a failure for an hour
    throw e;
  });
  eligibilityMemo = { at: now, value };
  return value;
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
// Exported because city_geo applies the same radius in SQL: one number, two
// implementations, and they have to agree.
export const CITY_MEMBER_KM = 250;

/** Pins belonging to a city/region hub: same country, a matching locality
 * term, and within ~250 km of the roster centroid.
 *
 * The city hubs get this from city_geo now (see cachedCityGeo); what is left
 * here is the film-page caller, which runs it over one film's own pins. */
export function cityMemberPins<T extends GeoPin>(pins: T[], city: LocationCity): T[] {
  const terms = new Set(city.terms);
  return pins.filter((p) => {
    if ((p.country ?? "") !== city.country) return false;
    if (typeof p.lat !== "number" || typeof p.lng !== "number") return false;
    if (kmBetween(p.lat, p.lng, city.lat, city.lng) > CITY_MEMBER_KM) return false;
    return pinLocalityTerms(p.name, p.kind, p.country).some((t) => terms.has(t));
  });
}

export async function loadCityGeo(city: LocationCity): Promise<GeoPin[]> {
  // Empty pins drop the city hubs below their own gate, so a swallowed error here
  // 404s a whole tier of live pages.
  const { data, error } = await db().rpc("city_geo", {
    p_country: city.country,
    p_lat: city.lat,
    p_lng: city.lng,
    p_terms: city.terms,
    p_km: CITY_MEMBER_KM,
  });
  if (error) throw new Error(`city_geo(${city.countrySlug}/${city.slug}): ${error.message}`);
  return Array.isArray(data) ? (data as GeoPin[]) : [];
}

/**
 * A city hub's own pins — membership decided in SQL (migration 0142) rather than
 * by filtering a dump of the whole country in this process.
 *
 * The country dump this replaces was 5.1 MB for the United States, which is over
 * Vercel's 2 MB Data Cache ceiling, so it was silently never cached: every render
 * of every US city page re-ran the query, and under a crawl that is what produced
 * 595 statement timeouts and a 500 on each. It also arrived capped at `limit
 * 8000` with no ORDER BY, so 1,981 of the country's 9,981 pins were dropped in
 * whatever order the scan happened to produce.
 *
 * city_geo applies the same three predicates in the same order — country, then
 * the 250 km radius, then the locality-term match — and returns 930 kB for the
 * widest city in the roster. Checked against the old path for all 511 cities:
 * 378 identical down to pin order, 133 US cities recovered pins the cap had been
 * dropping, none lost one.
 *
 * No unstable_cache wrap. Its only caller is already inside the page's own
 * `locations-city2` entry, and Next deliberately skips the cache READ of an
 * unstable_cache nested inside another one — the wrap would write an entry that
 * nothing ever reads, and drag the page's revalidate down to its own. The memo
 * is what actually bounds the RPC, to once an hour per city per warm instance.
 */
const CITY_GEO_TTL_MS = 60 * 60 * 1000;
const CITY_GEO_MEMO_MAX = 16;
const cityGeoMemo = new Map<string, { at: number; value: Promise<GeoPin[]> }>();

export function cachedCityGeo(city: LocationCity): Promise<GeoPin[]> {
  const key = `${city.countrySlug}/${city.slug}`;
  const now = Date.now();
  const hit = cityGeoMemo.get(key);
  if (hit && now - hit.at < CITY_GEO_TTL_MS) return hit.value;

  const value = loadCityGeo(city).catch((e) => {
    cityGeoMemo.delete(key); // never hold a failure for an hour
    throw e;
  });
  // delete before set: Map.set keeps an existing key's original position, so a
  // refreshed city would otherwise still look like the oldest entry below.
  cityGeoMemo.delete(key);
  cityGeoMemo.set(key, { at: now, value });

  for (const [k, entry] of cityGeoMemo) {
    if (now - entry.at >= CITY_GEO_TTL_MS) cityGeoMemo.delete(k);
  }
  // Map iterates in insertion order, so the front of it is the oldest entry.
  while (cityGeoMemo.size > CITY_GEO_MEMO_MAX) {
    const oldest = cityGeoMemo.keys().next();
    if (oldest.done) break;
    cityGeoMemo.delete(oldest.value);
  }
  return value;
}
