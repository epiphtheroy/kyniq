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
import { Image, Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Btn, Chip, GradientBtn, Loading, Screen, Tactile, Ui } from "../components/ui";
import { t } from "../i18n";
import { GEO_ARTIFACT_URL, boundsOf, loadFilmPins, toFeatureCollection, type Pin } from "../lib/pins";
import { brand, fs, radius, shadow, sp, usePalette } from "../theme";

const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css";
const TAB_CLEARANCE = 104;

/** The page starts empty and fills itself from the artifact (world view). */
const EMPTY_FC = { type: "FeatureCollection" as const, features: [] as unknown[] };

type Selected = {
  name: string;
  country: string | null;
  film_slug: string | null;
  film_title: string | null;
  poster: string | null;
};

/**
 * The page that runs inside the WebView. Film-focus pins are baked into the HTML;
 * the world view fetches the precompiled artifact itself (see ARTIFACT below).
 * It talks back over exactly one channel: ReactNativeWebView.postMessage with
 * {type:"pin"|"clear"|"open"|"pins"|"pinsError"|"ready"}.
 * onMessage re-validates every field — the page's payload is never trusted as-is.
 * Verified 2026-07-17: real tiles + clusters, and a pin tap posts
 * {name, country, film_slug, film_title} back to the card.
 */
function buildHtml(fc: string, boundsJson: string, accent: string, artifactUrl: string | null): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="${MAPLIBRE_CSS}" rel="stylesheet" />
<script src="${MAPLIBRE_JS}"></script>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#0b1020}
  .maplibregl-ctrl-attrib{font:10px/1.5 -apple-system,system-ui,sans-serif}
  /* Poster-thumbnail marker (owner directive 2026-07-20: pins ARE the films).
     MapLibre positions the marker element itself via transform, so scale the
     INNER node (.pp) and keep the wrapper (.pw) untouched. */
  .pw{cursor:pointer}
  .pw.sel{z-index:40}
  .pp{width:40px;height:58px;border-radius:7px;border:2px solid #fff;
      background-size:cover;background-position:center;background-color:#26314e;
      box-shadow:0 3px 10px rgba(0,0,0,.45);transition:transform .16s ease}
  .pw.sel .pp{transform:scale(1.45);border-color:${accent}}
  .pp.dot{width:15px;height:15px;border-radius:50%;background-color:${accent}}
  /* Speech-bubble callout (owner directive 2026-07-20) */
  .maplibregl-popup-content{border-radius:12px;padding:10px 30px 10px 12px;
      font-family:-apple-system,system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4);}
  .maplibregl-popup-close-button{font-size:19px;width:28px;height:28px;color:#777;right:1px;top:1px}
  .mtp-t{font-weight:700;font-size:13px;margin:0 0 2px;color:#111}
  .mtp-n{font-size:11.5px;color:#555;line-height:1.35;margin:0}
  .mtp-s{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:8px;
      background:${accent};color:#fff;font-weight:700;font-size:10.5px;vertical-align:1px}
  .mtp-go{display:inline-block;margin-top:5px;font-size:11.5px;font-weight:600;color:${accent}}
</style>
</head>
<body>
<div id="map"></div>
<script>
  var PINS = ${fc};
  var BOUNDS = ${boundsJson};
  // World view: the page fetches its own pins from the precompiled artifact
  // (worker/locations-build.py). Two reasons it happens HERE and not in React
  // Native: 17,337 pins is a ~2.5 MB string that would have to cross the bridge
  // on every open, and the WebView's own HTTP cache keeps the file between
  // sessions for free. The basemap draws while it lands, so the map is on screen
  // immediately and the pins arrive on top of it.
  var ARTIFACT = ${artifactUrl ? JSON.stringify(artifactUrl) : "null"};
  var post = function (msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  };
  // Satellite basemap (owner directive 2026-07-20) — Esri World Imagery raster
  // + place-label reference overlay; both key-free with attribution. Glyphs
  // endpoint is required for the cluster-count text layer.
  var map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        sat: { type: "raster", tileSize: 256, maxzoom: 19,
               attribution: "Esri · Maxar · Earthstar Geographics",
               tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"] },
        ref: { type: "raster", tileSize: 256, maxzoom: 19,
               tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"] }
      },
      layers: [
        { id: "sat", type: "raster", source: "sat" },
        { id: "ref", type: "raster", source: "ref", paint: { "raster-opacity": 0.92 } }
      ]
    },
    center: [-30, 34],
    zoom: 0.8,
    attributionControl: { compact: true },
  });
  // Poster-thumbnail markers for unclustered pins, synced with clustering:
  // clusters render as Lava discs; each pin that leaves a cluster becomes a
  // DOM marker with its film's poster (dot fallback when no poster).
  var markers = {};
  var onScreen = {};
  var selWrap = null;
  var popup = new maplibregl.Popup({ offset: 36, closeButton: true, closeOnClick: false, maxWidth: "240px" });
  popup.on("close", function () {
    if (selWrap) { selWrap.classList.remove("sel"); selWrap = null; }
    post({ type: "clear" });
  });
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Tap → enlarge the thumbnail + speech-bubble callout with the key text
  // (film title · place), dismissable via its ✕ (owner directive 2026-07-20).
  window.__openFilm = function (slug) { post({ type: "open", slug: slug }); };
  function select(wrap, props, lnglat) {
    if (selWrap) selWrap.classList.remove("sel");
    selWrap = wrap;
    if (wrap) wrap.classList.add("sel");
    var tsBadge = props.ts != null ? '<span class="mtp-s">TS ' + Math.round(props.ts) + "</span>" : "";
    var openLink = props.film_slug
      ? '<div class="mtp-go" onclick="window.__openFilm(\'' + esc(props.film_slug) + '\')">🎬 ' + esc(props.film_title || props.film_slug) + " ›</div>"
      : "";
    var html = (props.film_title ? '<div class="mtp-t">' + esc(props.film_title) + tsBadge + "</div>" : "")
      + '<div class="mtp-n">' + esc(props.name) + (props.country ? " · " + esc(props.country) : "") + "</div>"
      + openLink;
    popup.setLngLat(lnglat).setHTML(html).addTo(map);
    post({ type: "pin", props: props });
  }
  window.__clearSel = function () { popup.remove(); };
  function makeEl(props, lnglat) {
    var wrap = document.createElement("div");
    wrap.className = "pw";
    var el = document.createElement("div");
    if (props.poster) { el.className = "pp"; el.style.backgroundImage = "url(" + props.poster + ")"; }
    else { el.className = "pp dot"; }
    wrap.appendChild(el);
    wrap.addEventListener("click", function (ev) {
      ev.stopPropagation();
      select(wrap, props, lnglat);
    });
    return wrap;
  }
  function updateMarkers() {
    var next = {};
    var feats = map.querySourceFeatures("pins");
    for (var i = 0; i < feats.length; i++) {
      var f = feats[i];
      if (f.properties.cluster) continue;
      var id = f.properties.pid;
      if (next[id]) continue;
      var m = markers[id];
      if (!m) {
        m = markers[id] = new maplibregl.Marker({ element: makeEl(f.properties, f.geometry.coordinates) })
          .setLngLat(f.geometry.coordinates);
      }
      next[id] = m;
      if (!onScreen[id]) m.addTo(map);
    }
    for (var id2 in onScreen) { if (!next[id2]) onScreen[id2].remove(); }
    onScreen = next;
  }
  // Artifact → GeoJSON. Mirrors src/lib/pins.ts toFeatureCollection so both
  // renderers hand MapLibre the same properties.
  function expand(a) {
    var feats = [];
    for (var i = 0; i < a.points.length; i++) {
      var p = a.points[i];
      var f = a.films[p[4]];
      if (!f) continue;
      feats.push({
        type: "Feature",
        id: i,
        geometry: { type: "Point", coordinates: [p[3], p[2]] },
        properties: {
          pid: String(i),
          name: p[0],
          country: p[1] >= 0 ? a.countries[p[1]] : null,
          film_slug: f[0],
          film_title: f[1],
          poster: f[2] ? "https://image.tmdb.org/t/p/w154" + f[2] : null,
          ts: f[3],
        },
      });
    }
    return { type: "FeatureCollection", features: feats };
  }
  map.on("load", function () {
    map.addSource("pins", { type: "geojson", data: PINS, cluster: true, clusterRadius: 46 });
    map.addLayer({
      id: "clusters", type: "circle", source: "pins", filter: ["has", "point_count"],
      paint: { "circle-color": "${accent}", "circle-opacity": 0.92,
               "circle-stroke-width": 2, "circle-stroke-color": "#FFFFFF",
               "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26] },
    });
    map.addLayer({
      id: "cluster-count", type: "symbol", source: "pins", filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12,
                "text-font": ["Noto Sans Regular"], "text-allow-overlap": true },
      paint: { "text-color": "#FFFFFF" },
    });
    map.on("render", updateMarkers);
    map.on("sourcedata", function (e) { if (e.sourceId === "pins" && e.isSourceLoaded) updateMarkers(); });
    if (BOUNDS) {
      map.fitBounds([[BOUNDS.minLng, BOUNDS.minLat], [BOUNDS.maxLng, BOUNDS.maxLat]],
                    { padding: 56, maxZoom: 11, duration: 0 });
    }
    map.on("click", "clusters", function (e) {
      var f = e.features && e.features[0];
      if (!f) return;
      popup.remove();
      map.getSource("pins").getClusterExpansionZoom(f.properties.cluster_id).then(function (z) {
        map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.4 });
      });
    });
    map.on("click", function (e) {
      var hits = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
      if (!hits.length) { popup.remove(); post({ type: "clear" }); }
    });
    post({ type: "ready" });
    if (ARTIFACT) {
      fetch(ARTIFACT)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (a) {
          var src = map.getSource("pins");
          if (src) { src.setData(expand(a)); post({ type: "pins", n: a.pins || 0 }); }
        })
        .catch(function () { post({ type: "pinsError" }); });
    }
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
  /** How many pins the page loaded — the world count comes back over the bridge. */
  const [pinCount, setPinCount] = useState<number | null>(null);

  // Film focus needs its pins in JS (to fit the camera to them), and there are
  // only ever a handful. The world does NOT: the page fetches the artifact
  // itself, so nothing here blocks the map from appearing.
  useEffect(() => {
    let alive = true;
    setErr(false);
    setSelected(null);
    setPinCount(null);
    if (!filmSlug) {
      setPins([]);
      return;
    }
    setPins(null);
    loadFilmPins(filmSlug)
      .then((p) => alive && setPins(p))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [filmSlug, tries]);

  const html = useMemo(() => {
    if (!pins) return null;
    const bounds = filmSlug ? boundsOf(pins) : null;
    return buildHtml(
      JSON.stringify(filmSlug ? toFeatureCollection(pins) : EMPTY_FC),
      bounds ? JSON.stringify(bounds) : "null",
      brand.gradB,
      filmSlug ? null : GEO_ARTIFACT_URL,
    );
    // `tries` remounts the page on retry — the artifact fetch lives inside it.
  }, [pins, filmSlug, tries]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as
        | { type: "pin"; props: Record<string, unknown> }
        | { type: "clear" }
        | { type: "open"; slug?: unknown }
        | { type: "pins"; n?: unknown }
        | { type: "pinsError" }
        | { type: "ready" };
      if (msg.type === "pins") {
        setPinCount(typeof msg.n === "number" ? msg.n : 0);
        return;
      }
      if (msg.type === "pinsError") {
        setErr(true);
        return;
      }
      if (msg.type === "open") {
        // Bubble "open film" tap — slug re-validated before navigating.
        const slug = typeof msg.slug === "string" && /^[a-z0-9-]{1,120}$/.test(msg.slug) ? msg.slug : null;
        if (slug) router.push({ pathname: "/film/[slug]", params: { slug } });
        return;
      }
      if (msg.type === "clear") setSelected(null);
      if (msg.type === "pin") {
        const p = msg.props;
        setSelected({
          name: typeof p.name === "string" ? p.name : "",
          country: typeof p.country === "string" ? p.country : null,
          film_slug: typeof p.film_slug === "string" ? p.film_slug : null,
          film_title: typeof p.film_title === "string" ? p.film_title : null,
          poster:
            typeof p.poster === "string" && p.poster.startsWith("https://image.tmdb.org/")
              ? p.poster
              : null,
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
      // Transient GPS failure — keep the control usable for a retry.
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
            {filmSlug ? (pins[0]?.filmTitle ?? "") : pinCount == null ? t("loading") : t("map.pins", { n: pinCount })}
          </Ui>
        </View>
        {!filmSlug && router.canGoBack() ? (
          /* Opened from Explore or a film: the map is a pushed screen with no
             header and no tab of its own, so this is the ONLY way out. */
          <Chip label={t("action.back")} icon="arrow-back" onPress={() => router.back()} />
        ) : null}
        {filmSlug ? (
          <>
            {/* Back to the film brief that opened this focused map (owner
                report 2026-07-20: no way back). Tab push keeps the film in
                the stack, so back() lands there; fall back to a fresh push. */}
            <Chip
              label={t("map.backToFilm")}
              icon="arrow-back"
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.push({ pathname: "/film/[slug]", params: { slug: filmSlug } })
              }
            />
            <Chip label={t("map.showAll")} onPress={() => router.setParams({ film: "" })} />
          </>
        ) : null}
        <View style={{ flex: 1 }} />
        <Chip label={t("map.nearMe")} icon="locate" onPress={locDenied ? () => void Linking.openSettings() : nearMe} />
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
            onPress={() => {
              setSelected(null);
              webRef.current?.injectJavaScript("window.__clearSel && window.__clearSel(); true;");
            }}
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
          <View style={{ flexDirection: "row", gap: sp.s3, paddingRight: sp.s6 }}>
            {selected.poster ? (
              <Image
                source={{ uri: selected.poster }}
                style={{ width: 52, height: 76, borderRadius: 8, backgroundColor: pal.surface }}
              />
            ) : null}
            <View style={{ flex: 1 }}>
              {selected.film_title ? (
                <Ui size={fs.md} weight="600" numberOfLines={1}>
                  {selected.film_title}
                </Ui>
              ) : null}
              <Ui
                size={selected.film_title ? fs.sm : fs.md}
                weight={selected.film_title ? "400" : "600"}
                color={selected.film_title ? pal.inkSoft : pal.ink}
                numberOfLines={2}
                style={selected.film_title ? { marginTop: 2 } : undefined}
              >
                {selected.name}
              </Ui>
              {selected.country ? (
                <Ui size={fs.sm} color={pal.muted} style={{ marginTop: 2 }} numberOfLines={1}>
                  {selected.country}
                </Ui>
              ) : null}
            </View>
          </View>
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
