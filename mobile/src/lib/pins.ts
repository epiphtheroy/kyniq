// Shared filming-location pin loading for the three map implementations:
// MapNative (MapLibre GL Native, dev/store builds), MapExpoGo (react-native-maps,
// bundled in Expo Go) and map.web (maplibre-gl JS, browser preview).
//
// The open API is film/country-scoped (no bare world endpoint; ?limit= caps at
// 200), so the global set is assembled from the dataset's biggest countries.
// TODO(owner): swap for a real world endpoint (or the CC BY dataset export)
// when one exists — this approximation shows ~2,000 of ~17,000 pins.
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

const SEED_COUNTRIES = [
  "United States",
  "United Kingdom",
  "France",
  "Italy",
  "Japan",
  "South Korea",
  "Germany",
  "Spain",
  "Canada",
  "Australia",
];

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

async function fetchCountryPins(country: string): Promise<ApiLocRow[]> {
  const res = await fetch(
    `${METATAKE_BASE}/api/v1/locations?country=${encodeURIComponent(country)}&limit=200`,
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { locations?: ApiLocRow[] };
  return json.locations ?? [];
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

/** World view: biggest countries, batched small — the API carries a harvest guard. */
export async function loadGlobalPins(): Promise<Pin[]> {
  const rows: ApiLocRow[] = [];
  let ok = 0;
  for (let i = 0; i < SEED_COUNTRIES.length; i += 3) {
    const settled = await Promise.allSettled(SEED_COUNTRIES.slice(i, i + 3).map(fetchCountryPins));
    for (const r of settled) {
      if (r.status === "fulfilled") {
        ok += 1;
        rows.push(...r.value);
      }
    }
  }
  if (!ok) throw new Error("locations unreachable");
  const pins: Pin[] = [];
  for (const row of rows.slice(0, 2000)) {
    const p = toPin(row, pins.length);
    if (p) pins.push(p);
  }
  await attachPosters(pins);
  return pins;
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
