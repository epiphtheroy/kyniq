// Shared filming-location pin loading for the three map implementations:
// MapNative (MapLibre GL Native, dev/store builds), MapExpoGo (react-native-maps,
// bundled in Expo Go) and map.web (maplibre-gl JS, browser preview).
//
// The world set comes from ONE precompiled artifact (see loadGlobalPins below);
// film focus still reads the film_geo RPC, which is small and always current.
import { METATAKE_BASE } from "../config";
import { supabase } from "./supabase";

export type Pin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  country: string | null;
  layer: string | null;
  filmSlug: string | null;
  filmTitle: string | null;
  /** TMDB poster path of the pin's film — drives the poster-thumbnail markers. */
  posterPath: string | null;
  /** TakeScore of the pin's film — shown in the map callout bubble. */
  ts: number | null;
};

type ApiLocRow = {
  film_slug: string | null;
  film_title: string | null;
  name: string | null;
  layer: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
};

function toPin(row: ApiLocRow, id: number): Pin | null {
  if (row.lat == null || row.lng == null || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) {
    return null;
  }
  if (!row.name) return null;
  return {
    id: String(id),
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    country: row.country ?? null,
    layer: row.layer ?? null,
    filmSlug: row.film_slug ?? null,
    filmTitle: row.film_title ?? null,
    posterPath: null,
    ts: null,
  };
}

/**
 * Fill posterPath for every pin via one bulk anon lookup (films is public
 * content; RLS-safe select). Fail-soft: no posters just means dot markers.
 */
async function attachPosters(pins: Pin[]): Promise<void> {
  const slugs = [...new Set(pins.map((p) => p.filmSlug).filter(Boolean))] as string[];
  if (!slugs.length) return;
  const posterBySlug = new Map<string, string>();
  const tsBySlug = new Map<string, number>();
  for (let i = 0; i < slugs.length; i += 150) {
    const chunk = slugs.slice(i, i + 150);
    try {
      const [posters, scores] = await Promise.all([
        supabase.from("films").select("slug,poster_path").in("slug", chunk),
        supabase.rpc("takescore_for_slugs", { p_slugs: chunk }),
      ]);
      for (const r of (posters.data ?? []) as { slug: string; poster_path: string | null }[]) {
        if (r.poster_path) posterBySlug.set(r.slug, r.poster_path);
      }
      for (const r of (scores.data ?? []) as { slug: string; ts: number }[]) {
        tsBySlug.set(r.slug, r.ts);
      }
    } catch {
      /* fail-soft */
    }
  }
  for (const p of pins) {
    if (p.filmSlug) {
      p.posterPath = posterBySlug.get(p.filmSlug) ?? null;
      p.ts = tsBySlug.get(p.filmSlug) ?? null;
    }
  }
}

// ---------------------------------------------------------------------------
// The world, precompiled.
//
// Owner 2026-08-03: the world map "barely loaded". It was assembling itself at
// runtime — ten /api/v1/locations calls (Vercel function → DB, one per seed
// country) plus ~28 Supabase round trips to decorate the result with posters and
// TakeScores. Thirty-eight requests, and the map still only held ~2,000 of the
// 17,337 pins because the open API caps at 200 per country.
//
// It is now one immutable file compiled by worker/locations-build.py: every pin
// on every published film, posters and scores baked in, ~525 KB gzipped, cached
// forever (the version is in the filename). One request, then never again.

/** Compact artifact shape — arrays, because field names would be half the file. */
type GeoArtifact = {
  v: number;
  countries: string[];
  /** [slug, title, poster_path|null, ts|null] */
  films: [string, string, string | null, number | null][];
  /** [name, countryIdx|-1, lat, lng, filmIdx] */
  points: [string, number, number, number, number][];
};

/** Public URL of the artifact — see vercel.json for its cache headers. */
export const GEO_ARTIFACT_URL = `${METATAKE_BASE}/geo/pins.v1.json`;

let worldCache: Pin[] | null = null;
let worldInflight: Promise<Pin[]> | null = null;

/** World view: one precompiled artifact, expanded once and kept for the session. */
export async function loadGlobalPins(): Promise<Pin[]> {
  if (worldCache) return worldCache;
  if (worldInflight) return worldInflight;
  worldInflight = (async () => {
    const res = await fetch(GEO_ARTIFACT_URL, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const a = (await res.json()) as GeoArtifact;
    const pins: Pin[] = [];
    for (let i = 0; i < a.points.length; i++) {
      const [name, ci, lat, lng, fi] = a.points[i];
      const f = a.films[fi];
      if (!f || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      pins.push({
        id: String(i),
        name,
        lat,
        lng,
        country: ci >= 0 ? (a.countries[ci] ?? null) : null,
        layer: null,
        filmSlug: f[0],
        filmTitle: f[1],
        posterPath: f[2],
        ts: f[3],
      });
    }
    worldCache = pins;
    worldInflight = null;
    return pins;
  })();
  try {
    return await worldInflight;
  } catch (e) {
    worldInflight = null;
    throw e;
  }
}

/** Film focus (?film=<slug>): film_geo is a SECURITY DEFINER RPC, Tier-2 safe. */
export async function loadFilmPins(slug: string): Promise<Pin[]> {
  const { data, error } = await supabase.rpc("film_geo", { p_slug: slug });
  if (error) throw error;
  const pins: Pin[] = [];
  for (const row of (data ?? []) as ApiLocRow[]) {
    const p = toPin(row, pins.length);
    if (p) pins.push(p);
  }
  await attachPosters(pins);
  return pins;
}

/** GeoJSON view of the pins — what both MapLibre implementations consume. */
export function toFeatureCollection(pins: Pin[]): GeoJSON.FeatureCollection<
  GeoJSON.Point,
  {
    pid: string;
    name: string;
    country: string | null;
    layer: string | null;
    film_slug: string | null;
    film_title: string | null;
    poster: string | null;
    ts: number | null;
  }
> {
  return {
    type: "FeatureCollection",
    features: pins.map((p) => ({
      type: "Feature" as const,
      id: p.id,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      properties: {
        pid: p.id,
        name: p.name,
        country: p.country,
        layer: p.layer,
        film_slug: p.filmSlug,
        film_title: p.filmTitle,
        // Full URL baked here so the WebView page needs zero TMDB knowledge.
        poster: p.posterPath ? `https://image.tmdb.org/t/p/w154${p.posterPath}` : null,
        ts: p.ts,
      },
    })),
  };
}

/** Bounding box of a pin set — for fitting the camera on film focus. */
export function boundsOf(pins: Pin[]): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
  if (!pins.length) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const p of pins) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}
