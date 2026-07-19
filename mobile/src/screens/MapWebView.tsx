// Locations tab — WebView implementation (MapLibre GL JS inside react-native-webview).
//
// Why this exists: on Android, react-native-maps renders Google Maps, which
// refuses to draw without a Google Cloud API key — an Expo Go reviewer would get
// a grey rectangle. MapLibre GL Native (the canon renderer) is not in the Expo Go
// binary either. react-native-webview IS, so the browser map we already ship for
// the web preview runs here verbatim: real tiles, real clustering, zero keys.
//
// Same UX contract as MapNative/MapExpoGo: floating title pill, "Near me" chip,
// bottom card on pin tap. Data comes from src/lib/pins.ts like every other map.
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Btn, Chip, GradientBtn, Loading, Screen, Tactile, Ui } from "../components/ui";
import { t } from "../i18n";
import { boundsOf, loadFilmPins, loadGlobalPins, toFeatureCollection, type Pin } from "../lib/pins";
import { brand, fs, radius, shadow, sp, usePalette } from "../theme";

const MAP_STYLE = "https://demotiles.maplibre.org/style.json";
const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css";
const TAB_CLEARANCE = 104;

let globalPinCache: Pin[] | null = null;

type Selected = { name: string; country: string | null; film_slug: string | null; film_title: string | null };

/**
 * The page that runs inside the WebView. Pins and bounds are baked into the HTML
 * (no network call from the page itself), and it talks back over exactly one
 * channel: ReactNativeWebView.postMessage with {type:"pin"|"clear"|"ready"}.
 * onMessage re-validates every field — the page's payload is never trusted as-is.
 * Verified 2026-07-17: real tiles + clusters, and a pin tap posts
 * {name, country, film_slug, film_title} back to the card.
 */
function buildHtml(fc: string, boundsJson: string, accent: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="${MAPLIBRE_CSS}" rel="stylesheet" />
<script src="${MAPLIBRE_JS}"></script>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#e9f2fb}
  .maplibregl-ctrl-attrib{font:10px/1.5 -apple-system,system-ui,sans-serif}
</style>
</head>
<body>
<div id="map"></div>
<script>
  var PINS = ${fc};
  var BOUNDS = ${boundsJson};
  var post = function (msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  };
  var map = new maplibregl.Map({
    container: "map",
    style: "${MAP_STYLE}",
    center: [-30, 34],
    zoom: 0.6,
    attributionControl: { compact: true },
  });
  map.on("load", function () {
    map.addSource("pins", { type: "geojson", data: PINS, cluster: true, clusterRadius: 42 });
    map.addLayer({
      id: "clusters", type: "circle", source: "pins", filter: ["has", "point_count"],
      paint: { "circle-color": "${accent}", "circle-opacity": 0.9,
               "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26] },
    });
    map.addLayer({
      id: "cluster-count", type: "symbol", source: "pins", filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-allow-overlap": true },
      paint: { "text-color": "#FFFFFF" },
    });
    map.addLayer({
      id: "points", type: "circle", source: "pins", filter: ["!", ["has", "point_count"]],
      paint: { "circle-color": "${accent}", "circle-radius": 6,
               "circle-stroke-width": 1.5, "circle-stroke-color": "#FFFFFF" },
    });
    if (BOUNDS) {
      map.fitBounds([[BOUNDS.minLng, BOUNDS.minLat], [BOUNDS.maxLng, BOUNDS.maxLat]],
                    { padding: 48, maxZoom: 10, duration: 0 });
    }
    map.on("click", "clusters", function (e) {
      var f = e.features && e.features[0];
      if (!f) return;
      map.getSource("pins").getClusterExpansionZoom(f.properties.cluster_id).then(function (z) {
        map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.4 });
      });
    });
    map.on("click", "points", function (e) {
      var f = e.features && e.features[0];
      if (!f) return;
      post({ type: "pin", props: f.properties });
    });
    map.on("click", function (e) {
      var hits = map.queryRenderedFeatures(e.point, { layers: ["points", "clusters"] });
      if (!hits.length) post({ type: "clear" });
    });
    post({ type: "ready" });
  });
  window.__flyTo = function (lng, lat, zoom) { map.easeTo({ center: [lng, lat], zoom: zoom }); };
  // Handles for the app (Near me) and for automated verification.
  window.__map = map;
  window.__pinsFC = PINS;
</script>
</body>
</html>`;
}

export default function MapWebViewScreen() {
  const { film } = useLocalSearchParams<{ film?: string }>();
  const filmSlug = typeof film === "string" && film.length ? film : null;
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);

  const [pins, setPins] = useState<Pin[] | null>(null);
  const [err, setErr] = useState(false);
  const [tries, setTries] = useState(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [locDenied, setLocDenied] = useState(false);

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

  const html = useMemo(() => {
    if (!pins) return null;
    const bounds = filmSlug ? boundsOf(pins) : null;
    return buildHtml(
      JSON.stringify(toFeatureCollection(pins)),
      bounds ? JSON.stringify(bounds) : "null",
      brand.gradB,
    );
  }, [pins, filmSlug]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as
        | { type: "pin"; props: Record<string, unknown> }
        | { type: "clear" }
        | { type: "ready" };
      if (msg.type === "clear") setSelected(null);
      if (msg.type === "pin") {
        const p = msg.props;
        setSelected({
          name: typeof p.name === "string" ? p.name : "",
          country: typeof p.country === "string" ? p.country : null,
          film_slug: typeof p.film_slug === "string" ? p.film_slug : null,
          film_title: typeof p.film_title === "string" ? p.film_title : null,
        });
      }
    } catch {
      /* ignore malformed page messages */
    }
  }, []);

  const nearMe = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLocDenied(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      webRef.current?.injectJavaScript(
        `window.__flyTo && window.__flyTo(${pos.coords.longitude}, ${pos.coords.latitude}, 8.5); true;`,
      );
    } catch {
      setLocDenied(true);
    }
  }, []);

  if (err) {
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center", gap: sp.s4, padding: sp.s5 }}>
        <Ui color={pal.muted}>{t("error.network")}</Ui>
        <Btn label={t("action.retry")} style={{ alignSelf: "stretch" }} onPress={() => setTries((n) => n + 1)} />
      </Screen>
    );
  }
  if (!pins || !html) return <Loading />;

  return (
    <Screen>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: pal.bg }}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        // The page is ours and offline-authored; block navigation away from it.
        onShouldStartLoadWithRequest={(r) => r.url === "about:blank" || r.url.startsWith("data:")}
      />

      {/* Floating chrome */}
      <View
        style={{
          position: "absolute",
          top: insets.top + sp.s2,
          left: sp.s4,
          right: sp.s4,
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
              gap: 6,
              backgroundColor: pal.chrome,
              borderRadius: radius.pill,
              paddingHorizontal: sp.s4,
              paddingVertical: 10,
            },
            shadow.card,
          ]}
        >
          <Ui size={fs.md} weight="600">
            {t("map.title")}
          </Ui>
          <Ui size={fs.xs} color={pal.muted}>
            {filmSlug ? (pins[0]?.filmTitle ?? "") : t("map.pins", { n: pins.length })}
          </Ui>
        </View>
        {filmSlug ? <Chip label={t("map.showAll")} onPress={() => router.setParams({ film: "" })} /> : null}
        <View style={{ flex: 1 }} />
        {locDenied ? null : <Chip label={t("map.nearMe")} icon="locate" onPress={nearMe} />}
      </View>

      {filmSlug && pins.length === 0 ? (
        <View style={{ position: "absolute", top: insets.top + 64, left: sp.s4, right: sp.s4 }}>
          <View
            style={[
              { backgroundColor: pal.chrome, borderRadius: radius.md, padding: sp.s3 },
              shadow.card,
            ]}
          >
            <Ui size={fs.sm} color={pal.muted}>
              {t("map.noFilmPins")}
            </Ui>
          </View>
        </View>
      ) : null}

      {/* Bottom card */}
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
              padding: sp.s5,
            },
            shadow.float,
          ]}
        >
          <View style={{ alignItems: "center", marginBottom: sp.s3 }}>
            <View style={{ width: 36, height: 4, borderRadius: radius.pill, backgroundColor: pal.hairline2 }} />
          </View>
          <Tactile
            onPress={() => setSelected(null)}
            hitSlop={8}
            style={{ position: "absolute", top: sp.s3, right: sp.s3 }}
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
              <Ionicons name="close" size={15} color={pal.ink} />
            </View>
          </Tactile>
          <Ui size={fs.md} weight="600" numberOfLines={2}>
            {selected.name}
          </Ui>
          <Ui size={fs.sm} color={pal.muted} style={{ marginTop: 2 }} numberOfLines={1}>
            {[selected.country, selected.film_title].filter(Boolean).join(" · ")}
          </Ui>
          {selected.film_slug ? (
            <GradientBtn
              label={t("map.openFilm")}
              style={{ marginTop: sp.s4 }}
              onPress={() =>
                router.push({ pathname: "/film/[slug]", params: { slug: selected.film_slug as string } })
              }
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
