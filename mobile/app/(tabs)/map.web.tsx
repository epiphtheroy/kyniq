// Locations tab — web preview (Metro platform extension picks this over map.tsx).
// Real MapLibre GL JS map in the browser, mirroring MapNative's UX: floating
// title pill chrome, "Near me" chip, Lava cluster discs, bottom card on pin tap.
// Data comes from src/lib/pins.ts — the shared contract for all three map builds.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import maplibregl, {
  type GeoJSONSource as MLGeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Btn, Chip, GradientBtn, Loading, Screen, Tactile, Ui } from "../../src/components/ui";
import { t } from "../../src/i18n";
import { boundsOf, loadFilmPins, loadGlobalPins, toFeatureCollection, type Pin } from "../../src/lib/pins";
import { brand, fs, radius, shadow, sp, usePalette } from "../../src/theme";

const MAP_STYLE = "https://demotiles.maplibre.org/style.json";
// Atlantic-centered so the two biggest pin sets (US + Europe) share the frame.
const WORLD_CENTER: [number, number] = [-30, 34];
const WORLD_ZOOM = 0.9;

const SRC_ID = "pins";
const LAYER_CLUSTERS = "pins-clusters";
const LAYER_COUNT = "pins-cluster-count";
const LAYER_POINTS = "pins-points";

// Content floated over the map must clear the absolute blurred tab bar.
const TAB_CLEARANCE = 104;

// Metro web doesn't reliably bundle package CSS, so the minimal rules maplibre
// needs (canvas position/size + a legible compact attribution) are injected once.
const CSS_ID = "mt-maplibre-css";
const CSS_RULES = [
  ".maplibregl-map{position:relative;overflow:hidden;width:100%;height:100%}",
  ".maplibregl-canvas-container,.maplibregl-canvas{position:absolute;inset:0;width:100%;height:100%}",
  ".maplibregl-canvas{outline:none}",
  ".maplibregl-ctrl-bottom-right{position:absolute;bottom:0;right:0;z-index:2}",
  ".maplibregl-ctrl-attrib{background:rgba(255,255,255,.72);font:10px/1.5 sans-serif;padding:0 6px}",
  ".maplibregl-ctrl-attrib a{color:inherit}",
  ".maplibregl-ctrl-attrib-button{display:none}",
  ".maplibregl-ctrl-attrib-inner{display:inline}",
].join("");

function ensureMapCss(): void {
  if (typeof document === "undefined" || document.getElementById(CSS_ID)) return;
  const el = document.createElement("style");
  el.id = CSS_ID;
  el.textContent = CSS_RULES;
  document.head.appendChild(el);
}

// react-native-web passes host elements through, but RN's JSX types don't know
// "div" — cast a typed alias once so the container ref lands on a real DOM node.
const Div = "div" as unknown as React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement>; style?: React.CSSProperties }
>;

type PinProps = {
  name: string;
  country: string | null;
  layer: string | null;
  film_slug: string | null;
  film_title: string | null;
};

function propsOf(raw: Record<string, unknown>): PinProps {
  return {
    name: typeof raw.name === "string" ? raw.name : "",
    country: typeof raw.country === "string" ? raw.country : null,
    layer: typeof raw.layer === "string" ? raw.layer : null,
    film_slug: typeof raw.film_slug === "string" ? raw.film_slug : null,
    film_title: typeof raw.film_title === "string" ? raw.film_title : null,
  };
}

// Session cache — the world set doesn't change under the user's feet.
let globalPinCache: Pin[] | null = null;

export default function MapWebRoute() {
  const { film } = useLocalSearchParams<{ film?: string }>();
  const filmSlug = typeof film === "string" && film.length ? film : null;
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [pins, setPins] = useState<Pin[] | null>(null);
  const [err, setErr] = useState(false);
  const [tries, setTries] = useState(0);
  const [selected, setSelected] = useState<PinProps | null>(null);
  const [geoOk, setGeoOk] = useState(
    () => typeof navigator !== "undefined" && !!navigator.geolocation,
  );

  // -- Pin loading (alive-flag pattern, same as the other screens) -----------
  useEffect(() => {
    let alive = true;
    setErr(false);
    setSelected(null);
    if (filmSlug) {
      setPins(null);
      loadFilmPins(filmSlug)
        .then((p) => alive && setPins(p))
        .catch(() => alive && setErr(true));
    } else if (globalPinCache) {
      setPins(globalPinCache);
    } else {
      setPins(null);
      loadGlobalPins()
        .then((p) => {
          globalPinCache = p;
          if (alive) setPins(p);
        })
        .catch(() => alive && setErr(true));
    }
    return () => {
      alive = false;
    };
  }, [filmSlug, tries]);

  // -- Map lifecycle ----------------------------------------------------------
  // The container div only mounts once pins resolve, and pins only change on a
  // film-param flip or retry — so the map is created/destroyed per pin set,
  // which also handles the film→world camera reset by construction.
  useEffect(() => {
    if (!pins) return;
    const container = containerRef.current;
    if (!container) return;
    ensureMapCss();

    const bounds = filmSlug ? boundsOf(pins) : null;
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: WORLD_CENTER,
      zoom: WORLD_ZOOM,
      attributionControl: false,
      ...(bounds
        ? {
            bounds: [
              [bounds.minLng, bounds.minLat],
              [bounds.maxLng, bounds.maxLat],
            ] as [[number, number], [number, number]],
            fitBoundsOptions: { padding: 60, maxZoom: 10 },
          }
        : null),
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    mapRef.current = map;

    map.on("load", () => {
      map.addSource(SRC_ID, {
        type: "geojson",
        data: toFeatureCollection(pins),
        cluster: true,
        clusterRadius: 42,
      });
      // Clusters — Lava discs stepped by size
      map.addLayer({
        id: LAYER_CLUSTERS,
        type: "circle",
        source: SRC_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": brand.gradB,
          "circle-opacity": 0.9,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
        },
      });
      map.addLayer({
        id: LAYER_COUNT,
        type: "symbol",
        source: SRC_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#FFFFFF" },
      });
      // Unclustered pins — small Lava dot, white stroke
      map.addLayer({
        id: LAYER_POINTS,
        type: "circle",
        source: SRC_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": brand.gradB,
          "circle-radius": 5,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#FFFFFF",
        },
      });

      map.on("click", LAYER_CLUSTERS, (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        const clusterId = (f.properties as Record<string, unknown>).cluster_id;
        if (typeof clusterId !== "number") return;
        const src = map.getSource(SRC_ID) as MLGeoJSONSource | undefined;
        const center = f.geometry.coordinates as [number, number];
        src
          ?.getClusterExpansionZoom(clusterId)
          .then((zoom) => map.easeTo({ center, zoom: zoom + 0.5, duration: 700 }))
          .catch(() => undefined);
      });
      map.on("click", LAYER_POINTS, (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        setSelected(propsOf((f.properties ?? {}) as Record<string, unknown>));
      });
      // Background click clears the card
      map.on("click", (e) => {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: [LAYER_CLUSTERS, LAYER_POINTS],
        });
        if (!hits.length) setSelected(null);
      });
      for (const layer of [LAYER_CLUSTERS, LAYER_POINTS]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [pins, filmSlug]);

  const nearMe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoOk(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.easeTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 8.5,
          duration: 1400,
        });
      },
      () => setGeoOk(false), // denied/unavailable — hide the pill
    );
  };

  const filmTitle = filmSlug ? (pins?.find((p) => p.filmTitle)?.filmTitle ?? filmSlug) : null;
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
          {/* Real DOM node hosting the maplibre canvas — RNW passes host elements through */}
          <Div
            ref={containerRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />

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
                  onPress={() => router.push({ pathname: "/film/[slug]", params: { slug: openSlug } })}
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
        {geoOk ? (
          <View style={[{ borderRadius: radius.pill, backgroundColor: pal.card }, shadow.card]}>
            <Chip label={t("map.nearMe")} icon="locate" onPress={nearMe} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
