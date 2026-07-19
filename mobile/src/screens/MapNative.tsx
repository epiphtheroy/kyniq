// Locations tab — the filming-locations world map (HANDOFF §5.5).
// MapLibre GL Native (dev build only; Expo Go has no native module).
// Global pins come from the open geodata API (/api/v1/locations, CC BY 4.0);
// film focus (?film=<slug>) uses the film_geo RPC and fits the camera to it.
// Chrome: floating title pill row, "Near me" chip, Lava cluster discs, bottom
// card on pin tap.
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapView,
  type CameraRef,
  type GeoJSONSourceRef,
  type InitialViewState,
  type LngLat,
  type LngLatBounds,
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Btn, Chip, GradientBtn, Loading, Screen, Tactile, Ui } from "../components/ui";
import { METATAKE_BASE } from "../config";
import { t } from "../i18n";
import { supabase } from "../lib/supabase";
import { brand, fs, radius, shadow, sp, usePalette } from "../theme";

const MAP_STYLE = "https://demotiles.maplibre.org/style.json";
const WORLD_VIEW: InitialViewState = { center: [10, 22] as LngLat, zoom: 0.7 };

// Content floated over the map must clear the absolute blurred tab bar.
const TAB_CLEARANCE = 104;

// ---------------------------------------------------------------------------
// Pin loading
// ---------------------------------------------------------------------------

type PinProps = {
  name: string;
  country: string | null;
  layer: string | null;
  film_slug: string | null;
  film_title: string | null;
};

type PinFeature = GeoJSON.Feature<GeoJSON.Point, PinProps>;

// /api/v1/locations row (see web app/api/v1/locations/route.ts + api_locations_json)
type ApiLocRow = {
  film_slug: string | null;
  film_title: string | null;
  name: string | null;
  layer: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
};

// film_geo RPC row (web lib/locations.ts GeoPin)
type FilmGeoRow = {
  id?: string | number;
  name: string | null;
  lat: number | null;
  lng: number | null;
  country: string | null;
  layer: string | null;
  film_slug?: string | null;
  film_title?: string | null;
};

function toFeature(
  row: { name: string | null; country: string | null; layer: string | null; lat: number | null; lng: number | null; film_slug?: string | null; film_title?: string | null },
  id: number,
): PinFeature | null {
  if (row.lat == null || row.lng == null || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return null;
  if (!row.name) return null;
  return {
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates: [row.lng, row.lat] },
    properties: {
      name: row.name,
      country: row.country ?? null,
      layer: row.layer ?? null,
      film_slug: row.film_slug ?? null,
      film_title: row.film_title ?? null,
    },
  };
}

// The open API is film/country-scoped (no bare world endpoint; ?limit= caps at
// 200), so the global set is assembled from the dataset's biggest countries.
// TODO(owner): swap for a real world endpoint (or the CC BY dataset export)
// when one exists — this approximation shows ~2,000 of ~17,000 pins.
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

async function fetchCountryPins(country: string): Promise<ApiLocRow[]> {
  const res = await fetch(
    `${METATAKE_BASE}/api/v1/locations?country=${encodeURIComponent(country)}&limit=200`,
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { locations?: ApiLocRow[] };
  return json.locations ?? [];
}

async function loadGlobalPins(): Promise<PinFeature[]> {
  const rows: ApiLocRow[] = [];
  let ok = 0;
  // Small batches — the API carries a harvest guard; a 10-wide burst risks 429.
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
  const feats: PinFeature[] = [];
  for (const row of rows.slice(0, 2000)) {
    const f = toFeature(row, feats.length);
    if (f) feats.push(f);
  }
  return feats;
}

// Session cache — the world set doesn't change under the user's feet.
let globalPinCache: PinFeature[] | null = null;

async function loadFilmPins(slug: string): Promise<PinFeature[]> {
  const { data, error } = await supabase.rpc("film_geo", { p_slug: slug });
  if (error) throw error;
  const feats: PinFeature[] = [];
  for (const row of (data ?? []) as FilmGeoRow[]) {
    const f = toFeature(row, feats.length);
    if (f) feats.push(f);
  }
  return feats;
}

function boundsOf(pins: PinFeature[]): LngLatBounds {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const p of pins) {
    const [lng, lat] = p.geometry.coordinates;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MapScreen() {
  const { film } = useLocalSearchParams<{ film?: string }>();
  const filmSlug = typeof film === "string" && film.length ? film : null;
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();

  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);

  const [pins, setPins] = useState<PinFeature[] | null>(null);
  const [err, setErr] = useState(false);
  const [tries, setTries] = useState(0);
  const [selected, setSelected] = useState<PinProps | null>(null);
  const [locDenied, setLocDenied] = useState(false);

  useEffect(() => {
    let alive = true;
    setErr(false);
    setSelected(null);
    if (filmSlug) {
      setPins(null);
      loadFilmPins(filmSlug)
        .then((f) => alive && setPins(f))
        .catch(() => alive && setErr(true));
    } else if (globalPinCache) {
      setPins(globalPinCache);
    } else {
      setPins(null);
      loadGlobalPins()
        .then((f) => {
          globalPinCache = f;
          if (alive) setPins(f);
        })
        .catch(() => alive && setErr(true));
    }
    return () => {
      alive = false;
    };
  }, [filmSlug, tries]);

  // Film focus cleared while the map is mounted (cached global pins skip the
  // remount) — fly back out to the world view.
  const prevFilm = useRef<string | null>(filmSlug);
  useEffect(() => {
    if (prevFilm.current && !filmSlug) {
      cameraRef.current?.flyTo({ center: [10, 22], zoom: 0.7, duration: 900 });
    }
    prevFilm.current = filmSlug;
  }, [filmSlug]);

  // Camera mounts after pins resolve, so the initial view can be data-driven.
  const initialView = useMemo<InitialViewState>(() => {
    if (!filmSlug || !pins || !pins.length) return WORLD_VIEW;
    if (pins.length === 1) return { center: pins[0].geometry.coordinates as LngLat, zoom: 8 };
    return { bounds: boundsOf(pins), padding: { top: 64, bottom: 120, left: 48, right: 48 } };
  }, [filmSlug, pins]);

  const collection = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, PinProps>>(
    () => ({ type: "FeatureCollection", features: pins ?? [] }),
    [pins],
  );

  const filmTitle = filmSlug ? (pins?.find((p) => p.properties.film_title)?.properties.film_title ?? filmSlug) : null;

  const nearMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocDenied(true); // silent — just disable the pill
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      cameraRef.current?.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 9,
        duration: 1400,
      });
    } catch {
      // location unavailable — stay put
    }
  };

  const onSourcePress = (e: { nativeEvent: { features: GeoJSON.Feature[] }; stopPropagation: () => void }) => {
    e.stopPropagation();
    const f = e.nativeEvent.features[0];
    if (!f || f.geometry.type !== "Point") return;
    const coords = f.geometry.coordinates as LngLat;
    const props = (f.properties ?? {}) as Record<string, unknown>;
    if (props.cluster === true && typeof props.cluster_id === "number") {
      // Cluster tap → expand
      const clusterId = props.cluster_id;
      sourceRef.current
        ?.getClusterExpansionZoom(clusterId)
        .then((zoom) => cameraRef.current?.flyTo({ center: coords, zoom: zoom + 0.5, duration: 700 }))
        .catch(() => undefined);
      return;
    }
    setSelected({
      name: typeof props.name === "string" ? props.name : "",
      country: typeof props.country === "string" ? props.country : null,
      layer: typeof props.layer === "string" ? props.layer : null,
      film_slug: typeof props.film_slug === "string" ? props.film_slug : null,
      film_title: typeof props.film_title === "string" ? props.film_title : null,
    });
  };

  const openSlug = selected ? (selected.film_slug ?? filmSlug) : null;

  return (
    <Screen>
      {err ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: sp.s4 }}>
          <Ui color={pal.muted}>{t("error.network")}</Ui>
          <Btn label={t("action.retry")} onPress={() => setTries((n) => n + 1)} />
        </View>
      ) : !pins ? (
        <Loading />
      ) : (
        <View style={{ flex: 1 }}>
          <MapView
            style={{ flex: 1 }}
            mapStyle={MAP_STYLE}
            onPress={() => setSelected(null)}
            touchPitch={false}
          >
            <Camera ref={cameraRef} initialViewState={initialView} />
            <GeoJSONSource
              ref={sourceRef}
              id="pins"
              data={collection}
              cluster
              clusterRadius={40}
              onPress={onSourcePress}
            >
              {/* Clusters — Lava discs stepped by size */}
              <Layer
                type="circle"
                id="pin-clusters"
                filter={["has", "point_count"]}
                paint={{
                  "circle-color": brand.gradB,
                  "circle-opacity": 0.88,
                  "circle-radius": ["step", ["get", "point_count"], 14, 25, 18, 100, 24],
                }}
              />
              <Layer
                type="symbol"
                id="pin-cluster-count"
                filter={["has", "point_count"]}
                layout={{
                  "text-field": ["to-string", ["get", "point_count_abbreviated"]],
                  "text-size": 12,
                  "text-font": ["Noto Sans Regular"],
                  "text-allow-overlap": true,
                }}
                paint={{ "text-color": "#FFFFFF" }}
              />
              {/* Unclustered pins — small Lava dot, white stroke */}
              <Layer
                type="circle"
                id="pin-points"
                filter={["!", ["has", "point_count"]]}
                paint={{
                  "circle-color": brand.gradB,
                  "circle-radius": 5,
                  "circle-stroke-width": 1.5,
                  "circle-stroke-color": "#FFFFFF",
                }}
              />
            </GeoJSONSource>
          </MapView>

          {/* Film focus with zero mapped pins */}
          {filmSlug && !pins.length ? (
            <View
              style={[
                {
                  position: "absolute",
                  top: insets.top + 64,
                  alignSelf: "center",
                  backgroundColor: pal.card,
                  borderRadius: radius.pill,
                  paddingHorizontal: sp.s4,
                  paddingVertical: 8,
                },
                shadow.card,
              ]}
            >
              <Ui size={fs.xs + 1} color={pal.muted}>
                {t("map.noFilmPins")}
              </Ui>
            </View>
          ) : null}

          {/* Pin card — bottom sheet-lite, floats above the blurred tab bar */}
          {selected ? (
            <View
              style={[
                {
                  position: "absolute",
                  left: sp.s4,
                  right: sp.s4,
                  bottom: TAB_CLEARANCE,
                  backgroundColor: pal.card,
                  borderRadius: radius.lg,
                  paddingHorizontal: sp.s5,
                  paddingBottom: sp.s5,
                  paddingTop: sp.s3,
                  gap: sp.s2,
                },
                shadow.float,
              ]}
            >
              <View
                style={{
                  alignSelf: "center",
                  width: 36,
                  height: 4,
                  borderRadius: radius.pill,
                  backgroundColor: pal.hairline2,
                  marginBottom: sp.s1,
                }}
              />
              <Tactile
                onPress={() => setSelected(null)}
                hitSlop={10}
                style={{ position: "absolute", top: sp.s3, right: sp.s3, zIndex: 1 }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.pill,
                    backgroundColor: pal.surface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={16} color={pal.inkSoft} />
                </View>
              </Tactile>
              <Ui size={fs.md} weight="600" numberOfLines={2} style={{ paddingRight: sp.s6 }}>
                {selected.name}
              </Ui>
              <Ui size={fs.sm} color={pal.muted} numberOfLines={1}>
                {[selected.country, selected.film_title ?? filmTitle].filter(Boolean).join(" · ")}
              </Ui>
              {openSlug ? (
                <GradientBtn
                  label={t("map.openFilm")}
                  onPress={() =>
                    router.push({ pathname: "/film/[slug]", params: { slug: openSlug } })
                  }
                  style={{ marginTop: sp.s2 }}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      {/* Floating title pill row — the map owns the whole viewport */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top + sp.s2,
          left: sp.s4,
          right: sp.s4,
          zIndex: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: sp.s2,
        }}
      >
        <View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              gap: sp.s2,
              flexShrink: 1,
              backgroundColor: pal.chrome,
              borderRadius: radius.pill,
              paddingVertical: 10,
              paddingHorizontal: 16,
            },
            shadow.card,
          ]}
        >
          <Ui size={fs.md} weight="600">
            {t("map.title")}
          </Ui>
          {filmSlug ? (
            <Ui size={fs.xs} color={pal.muted} numberOfLines={1} style={{ flexShrink: 1, maxWidth: 140 }}>
              {filmTitle}
            </Ui>
          ) : pins ? (
            <Ui size={fs.xs} color={pal.muted}>
              {t("map.pins", { n: pins.length })}
            </Ui>
          ) : null}
        </View>
        {filmSlug ? (
          <Chip label={t("map.showAll")} icon="close" onPress={() => router.setParams({ film: "" })} />
        ) : null}
        <View pointerEvents="none" style={{ flex: 1 }} />
        <View
          style={[
            { borderRadius: radius.pill, backgroundColor: pal.card, opacity: locDenied ? 0.4 : 1 },
            shadow.card,
          ]}
        >
          <Chip label={t("map.nearMe")} icon="locate" onPress={locDenied ? undefined : nearMe} />
        </View>
      </View>
    </Screen>
  );
}
