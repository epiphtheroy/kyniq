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
  return pins;
}

/** GeoJSON view of the pins — what both MapLibre implementations consume. */
export function toFeatureCollection(pins: Pin[]): GeoJSON.FeatureCollection<
  GeoJSON.Point,
  { name: string; country: string | null; layer: string | null; film_slug: string | null; film_title: string | null }
> {
  return {
    type: "FeatureCollection",
    features: pins.map((p) => ({
      type: "Feature" as const,
      id: p.id,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      properties: {
        name: p.name,
        country: p.country,
        layer: p.layer,
        film_slug: p.filmSlug,
        film_title: p.filmTitle,
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
