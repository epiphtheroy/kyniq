import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

/**
 * Atlas read layer — shared data helpers (docs/PLAN-atlas-seo.md).
 * The map embeds stay on /api/geo; these helpers feed the SERVER-rendered
 * location pages (/film/x/locations, /director/x/locations, /atlas/[country])
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
};

export type AtlasCountry = {
  country: string;
  pins: number;
  films: {
    slug: string; title: string; year: number | null;
    director: string | null; director_slug: string | null;
    pins: number; top_location: string | null;
  }[];
  landmarks: { name: string; films: number; note: string | null }[];
};

export type AtlasEligibility = {
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

export async function loadFilmGeo(slug: string): Promise<GeoPin[]> {
  const { data } = await db().rpc("film_geo", { p_slug: slug });
  return Array.isArray(data) ? (data as GeoPin[]) : [];
}

export async function loadDirectorGeo(slug: string): Promise<GeoPin[]> {
  const { data } = await db().rpc("director_geo", { p_slug: slug });
  return Array.isArray(data) ? (data as GeoPin[]) : [];
}

export async function loadAtlasCountry(slug: string): Promise<AtlasCountry | null> {
  const { data } = await db().rpc("atlas_country_json", { p_slug: slug });
  const c = data as AtlasCountry | null;
  return c && c.country ? c : null;
}

export async function loadAtlasEligibility(): Promise<AtlasEligibility> {
  const { data } = await db().rpc("atlas_eligibility_json");
  const d = (data ?? {}) as Partial<AtlasEligibility>;
  return { films: d.films ?? [], directors: d.directors ?? [], countries: d.countries ?? [] };
}

/** Eligibility roster, shared through the Data Cache — every locations page
 * needs it to avoid linking to a gated (404) sibling, so it must not cost one
 * RPC per page render. */
export function cachedAtlasEligibility(): Promise<AtlasEligibility> {
  return unstable_cache(loadAtlasEligibility, ["atlas-eligibility"], { revalidate: 3600 })();
}
