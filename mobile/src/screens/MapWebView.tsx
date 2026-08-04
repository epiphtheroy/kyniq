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
import { FlatList, Image, Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Btn, Chip, GradientBtn, Loading, Screen, Tactile, Ui } from "../components/ui";
import { t } from "../i18n";
import { GEO_ARTIFACT_URL, boundsOf, loadFilmPins, toFeatureCollection, type Pin } from "../lib/pins";
import { useAndroidBack } from "../platform/back";
import { brand, fs, radius, shadow, sp, usePalette } from "../theme";

const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css";
const TAB_CLEARANCE = 104;

/** The page starts empty and fills itself from the artifact (world view). */
const EMPTY_FC = { type: "FeatureCollection" as const, features: [] as unknown[] };

/** One film in view — the unit the bottom strip walks through. */
type MapFilm = { slug: string; title: string; poster: string | null; ts: number | null };

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
 * {type:"pin"|"clear"|"open"|"films"|"pinsError"|"ready"}.
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
<script>
  /* The failure channel, installed BEFORE anything can fail.
     Until 2026-08-03 the page could only report trouble from inside
     map.on("load"), which by definition cannot run when the engine itself is
     missing — so a dead map showed a bare #0b1020 rectangle and a title stuck on
     "Loading…" forever, with no error and no retry. Reproduced on Android.
     Everything below posts a reason instead. */
  var post = function (m) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m));
  };
  window.onerror = function (msg, src, line) {
    post({ type: "fatal", reason: String(msg) + (line ? " @" + line : "") });
    return false;
  };
  window.__engineFailed = function () { post({ type: "fatal", reason: "engine-fetch-failed" }); };
  post({ type: "boot" });
</script>
<link href="${MAPLIBRE_CSS}" rel="stylesheet" />
<script src="${MAPLIBRE_JS}" onerror="window.__engineFailed()"></script>
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
  // The engine can be absent for reasons the script tag's onerror never sees
  // (a 200 that returns HTML, a proxy, a partial body). Say so rather than
  // throwing a bare ReferenceError into the void.
  if (typeof maplibregl === "undefined") {
    post({ type: "fatal", reason: "engine-missing" });
    throw new Error("maplibre-gl unavailable");
  }
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
  // The callout's "open this film" row carries its slug in a data attribute and
  // is handled by ONE delegated listener, rather than by an inline onclick built
  // out of nested quotes.
  //
  // It used to be an inline onclick, and that broke the entire map. This whole
  // page lives inside a TypeScript template literal, so a backslash written to
  // escape a quote for the BROWSER is eaten by TypeScript first. The emitted
  // page ended up calling __openFilm with two empty strings where the slug
  // should have been, which is a syntax error — and a syntax error anywhere in
  // this script means NONE of it runs. No map, no pins, no ready message: just
  // the bare background and a title stuck on loading, with nothing anywhere
  // saying why. Found 2026-08-03 on Android, by the error channel added above.
  //
  // Escaping quotes through two languages is a trap that gets re-entered — the
  // first draft of THIS comment fell into it again by quoting the broken line
  // with backticks, which closed the template literal. A data attribute has no
  // quotes to escape, so the shape is the fix, not more careful escaping.
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    while (t && t !== document.body) {
      if (t.className === "mtp-go" && t.getAttribute("data-slug")) {
        window.__openFilm(t.getAttribute("data-slug"));
        return;
      }
      t = t.parentNode;
    }
  });
  function select(wrap, props, lnglat) {
    if (selWrap) selWrap.classList.remove("sel");
    selWrap = wrap;
    if (wrap) wrap.classList.add("sel");
    var tsBadge = props.ts != null ? '<span class="mtp-s">TS ' + Math.round(props.ts) + "</span>" : "";
    var openLink = props.film_slug
      ? '<div class="mtp-go" data-slug="' + esc(props.film_slug) + '">🎬 ' + esc(props.film_title || props.film_slug) + " ›</div>"
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
  // Poster markers are DOM nodes, and DOM nodes are the expensive thing on a map.
  // This used to run on every "render" event over the whole source; at 2,000 pins
  // that was survivable and at 17,337 it made the wide view crawl (owner 08-03).
  // Now: never below POSTER_ZOOM (where a poster is a smudge anyway — the GPU dot
  // layer carries those zooms), never more than MAX_MARKERS of them, and only on
  // moveend/idle instead of per frame.
  var POSTER_ZOOM = 8.5;
  var MAX_MARKERS = 80;
  function clearMarkers() {
    for (var id in onScreen) onScreen[id].remove();
    onScreen = {};
  }
  function updateMarkers() {
    if (map.getZoom() < POSTER_ZOOM) { if (selWrap) selWrap = null; clearMarkers(); return; }
    var next = {};
    var feats = map.querySourceFeatures("pins");
    var n = 0;
    for (var i = 0; i < feats.length && n < MAX_MARKERS; i++) {
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
      n++;
      if (!onScreen[id]) m.addTo(map);
    }
    for (var id2 in onScreen) { if (!next[id2]) onScreen[id2].remove(); }
    onScreen = next;
  }
  // Films currently in view — the bottom strip the app uses to walk the map.
  var ALL = [];
  function reportFilms() {
    if (!ALL.length) return;
    var b = map.getBounds();
    var w = b.getWest(), e = b.getEast(), s2 = b.getSouth(), n2 = b.getNorth();
    var seen = {}, out = [];
    for (var i = 0; i < ALL.length; i++) {
      var p = ALL[i];
      if (p.lat < s2 || p.lat > n2) continue;
      if (w <= e ? (p.lng < w || p.lng > e) : (p.lng < w && p.lng > e)) continue;
      if (seen[p.slug]) continue;
      seen[p.slug] = 1;
      out.push(p);
    }
    out.sort(function (x, y) { return (y.ts == null ? -1 : y.ts) - (x.ts == null ? -1 : x.ts); });
    post({ type: "films", films: out.slice(0, 40) });
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
  // maplibre measures its container once, at construction, and never watches it
  // again. On iOS that is invisible — the window is a fixed size for the life of
  // the app. Android windows are not: split-screen, foldables, desktop modes and
  // plain rotation all resize the view under a live map, and without this the
  // canvas keeps its first size and leaves a dead band of background where the
  // map should be. Reproduced 2026-08-03 simply by changing the emulator's
  // display size — which is exactly what a user does by unfolding a phone.
  (function () {
    var el = document.getElementById("map");
    var resize = function () { map.resize(); };
    if (window.ResizeObserver) new ResizeObserver(resize).observe(el);
    else window.addEventListener("resize", resize);
  })();
  map.on("load", function () {
    map.addSource("pins", {
      type: "geojson", data: PINS, cluster: true, clusterRadius: 60, clusterMaxZoom: 12,
    });
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
    // Everything that is not a cluster is a GPU circle — free at any zoom, and
    // the only thing drawn when the whole world is on screen.
    map.addLayer({
      id: "dots", type: "circle", source: "pins", filter: ["!", ["has", "point_count"]],
      paint: { "circle-color": "${accent}", "circle-radius": 4.5,
               "circle-stroke-width": 1.5, "circle-stroke-color": "#FFFFFF" },
    });
    map.on("moveend", function () { updateMarkers(); reportFilms(); });
    map.on("idle", updateMarkers);
    map.on("sourcedata", function (e) {
      if (e.sourceId === "pins" && e.isSourceLoaded) { updateMarkers(); reportFilms(); }
    });
    // A dot is tappable even when it never became a poster (below POSTER_ZOOM).
    map.on("click", "dots", function (e) {
      var f = e.features && e.features[0];
      if (!f) return;
      select(null, f.properties, f.geometry.coordinates);
    });
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
      // "dots" must be in this list: the layer handler above opens the callout
      // and THIS handler runs for the same tap, so without it every dot tap
      // opened and closed the bubble in the same frame. DOM markers are immune
      // (their listener stops propagation); a GPU layer has no such shield.
      var hits = map.queryRenderedFeatures(e.point, { layers: ["clusters", "dots"] });
      if (!hits.length) { popup.remove(); post({ type: "clear" }); }
    });
    post({ type: "ready" });
    if (ARTIFACT) {
      fetch(ARTIFACT)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (a) {
          var src = map.getSource("pins");
          if (!src) return;
          src.setData(expand(a));
          for (var i = 0; i < a.points.length; i++) {
            var p = a.points[i], f = a.films[p[4]];
            if (!f) continue;
            ALL.push({ slug: f[0], title: f[1],
                       poster: f[2] ? "https://image.tmdb.org/t/p/w154" + f[2] : null,
                       ts: f[3], lat: p[2], lng: p[3] });
          }
          reportFilms();
        })
        .catch(function () { post({ type: "pinsError" }); });
    }
  });
  window.__flyTo = function (lng, lat, zoom) { map.easeTo({ center: [lng, lat], zoom: zoom }); };
  // Walk to a film from the app's bottom strip: fly there, then open its callout.
  window.__showFilm = function (slug) {
    for (var i = 0; i < ALL.length; i++) {
      if (ALL[i].slug !== slug) continue;
      var p = ALL[i];
      map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 10.5) });
      map.once("moveend", function () {
        var hits = map.querySourceFeatures("pins");
        for (var j = 0; j < hits.length; j++) {
          var h = hits[j];
          if (!h.properties.cluster && h.properties.film_slug === slug) {
            select(null, h.properties, h.geometry.coordinates);
            return;
          }
        }
      });
      return;
    }
  };
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
  /** Why the map could not draw. Null while it is merely still loading. */
  const [fatal, setFatal] = useState<string | null>(null);
  /** Set once the page reports the map is alive; stops the watchdog. */
  const [ready, setReady] = useState(false);
  const [tries, setTries] = useState(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  /** Films inside the current viewport, best-scored first — the bottom strip. */
  const [inView, setInView] = useState<MapFilm[]>([]);

  // Film focus needs its pins in JS (to fit the camera to them), and there are
  // only ever a handful. The world does NOT: the page fetches the artifact
  // itself, so nothing here blocks the map from appearing.
  useEffect(() => {
    let alive = true;
    setErr(false);
    setFatal(null);
    setReady(false);
    setSelected(null);
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
        | { type: "films"; films?: unknown }
        | { type: "pinsError" }
        | { type: "boot" }
        | { type: "fatal"; reason?: unknown }
        | { type: "ready" };
      if (msg.type === "fatal") {
        setFatal(typeof msg.reason === "string" ? msg.reason : "unknown");
        return;
      }
      if (msg.type === "ready") {
        setReady(true);
        return;
      }
      if (msg.type === "pinsError") {
        setErr(true);
        return;
      }
      if (msg.type === "films") {
        // Never trusted as-is: the page's payload is re-validated field by field.
        const raw = Array.isArray(msg.films) ? msg.films : [];
        const out: MapFilm[] = [];
        for (const r of raw as Record<string, unknown>[]) {
          if (typeof r?.slug !== "string" || !/^[a-z0-9-]{1,120}$/.test(r.slug)) continue;
          out.push({
            slug: r.slug,
            title: typeof r.title === "string" ? r.title : r.slug,
            poster:
              typeof r.poster === "string" && r.poster.startsWith("https://image.tmdb.org/")
                ? r.poster
                : null,
            ts: typeof r.ts === "number" ? r.ts : null,
          });
        }
        setInView(out);
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

  // The watchdog. Some failures are silent by nature — WebGL unavailable on a
  // software renderer, a CDN that accepts the connection and then stalls, a
  // proxy that never answers. In every one of those the page neither errors nor
  // becomes ready, and the old screen sat on "Loading…" indefinitely. If the map
  // has not reported itself alive by now, say so and offer the retry.
  useEffect(() => {
    if (!html || ready || fatal) return;
    const timer = setTimeout(() => setFatal("timeout"), 15000);
    return () => clearTimeout(timer);
  }, [html, ready, fatal, tries]);

  // One selection drawn by two renderers: the card is React state, the callout is
  // a DOM node inside the page. Dismissing one without the other leaves a bubble
  // floating over a map with nothing selected, so every dismissal goes through
  // here — the ✕, and Android's back below.
  const dismissSelection = useCallback(() => {
    setSelected(null);
    webRef.current?.injectJavaScript("window.__clearSel && window.__clearSel(); true;");
  }, []);

  // Back closes what is open before it leaves the map. Until now the map answered
  // nothing, so back on an open pin threw the whole screen away — and when the map
  // is the tab's root there is nothing under it, so it left the app instead. iOS
  // never had the question: it dismisses by tapping the map or the ✕, which both
  // still work here.
  useAndroidBack(() => {
    if (!selected) return false; // nothing open: the press belongs to navigation
    dismissSelection();
    return true;
  }, !!selected);

  const nearMe = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        // iOS has one kind of denial and it is final, so "denied → send them to
        // Settings" is right there. Android's first "Don't allow" is soft: the OS
        // reports canAskAgain and expects the app to ask again in place. Latching
        // on it threw the user out to Settings for a permission the system would
        // still have granted, and the map never flew anywhere again this session.
        setLocDenied(!perm.canAskAgain);
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

  if (err || fatal) {
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center", gap: sp.s4, padding: sp.s5 }}>
        <Ui color={pal.muted} style={{ textAlign: "center" }}>
          {t("error.network")}
        </Ui>
        {/* The reason, verbatim and unlocalised. A map that cannot draw is a bug
            report waiting to be filed, and "engine-fetch-failed" vs "timeout" vs
            "webview renderer stopped" is the difference between a fix and a
            guess. It is deliberately not an i18n key: these are diagnostics, not
            copy, and inventing four translations of "engine-missing" would make
            them worse. */}
        {fatal ? (
          <Ui size={fs.xs} color={pal.subtle} style={{ textAlign: "center" }}>
            {fatal}
          </Ui>
        ) : null}
        <Btn label={t("action.retry")} style={{ alignSelf: "stretch" }} onPress={() => setTries((n) => n + 1)} />
      </Screen>
    );
  }
  if (!pins || !html) return <Loading />;

  // The first pin is not guaranteed to carry the title; the slug is the honest
  // last resort, since a blank pill is worse than an ugly one.
  const filmTitle = filmSlug ? (pins.find((p) => p.filmTitle)?.filmTitle ?? filmSlug) : null;

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
        // Three failures the page itself can never report, because they kill or
        // precede the page: the load failing, an HTTP error serving it, and
        // Android's WebView renderer process being killed under memory pressure
        // (which leaves a permanently blank view until it is remounted).
        onError={(e) => setFatal(`webview: ${e.nativeEvent.description || "load failed"}`)}
        onHttpError={(e) => setFatal(`webview http ${e.nativeEvent.statusCode}`)}
        onRenderProcessGone={() => {
          setFatal("webview renderer stopped");
          setReady(false);
        }}
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
        {/* Owner 08-03: the "Locations" pill said nothing the screen didn't
            already say, and wrapped to two lines doing it — while eating the top
            band it shares with Back and Near me. The world view now carries no
            title at all; film focus keeps a slim pill because WHICH film you are
            looking at is the one thing the map cannot show. Landed on iOS the
            same day and never crossed to here (ledger: mapFeatureDelta). */}
        {filmSlug ? (
          <View
            style={[
              {
                flexShrink: 1,
                backgroundColor: pal.chrome,
                borderRadius: radius.pill,
                paddingVertical: 8,
                paddingHorizontal: 14,
              },
              shadow.card,
            ]}
          >
            <Ui size={fs.sm} weight="600" numberOfLines={1}>
              {filmTitle}
            </Ui>
          </View>
        ) : null}
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
        {/* Once the chip leaves for Settings instead of flying the map, it is a
            different control and has to look like one — same signal as iOS. */}
        <View style={{ opacity: locDenied ? 0.4 : 1 }}>
          <Chip label={t("map.nearMe")} icon="locate" onPress={locDenied ? () => void Linking.openSettings() : nearMe} />
        </View>
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
      {/* Walk the map (owner 08-03): every film in view, best-scored first. Tap
          one and the map flies to it and opens its callout — selecting swaps
          this strip for the detail card, so the two never fight for the bottom. */}
      {!selected && inView.length ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: TAB_CLEARANCE }}>
          <FlatList
            horizontal
            data={inView}
            keyExtractor={(f) => f.slug}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: sp.s4, gap: sp.s2 }}
            renderItem={({ item }) => (
              <Tactile
                feedback="tap"
                onPress={() =>
                  webRef.current?.injectJavaScript(
                    `window.__showFilm && window.__showFilm(${JSON.stringify(item.slug)}); true;`,
                  )
                }
              >
                <View
                  style={[
                    {
                      width: 132,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: sp.s2,
                      backgroundColor: pal.card,
                      borderRadius: radius.md,
                      padding: 6,
                    },
                    shadow.card,
                  ]}
                >
                  {item.poster ? (
                    <Image
                      source={{ uri: item.poster }}
                      style={{ width: 30, height: 45, borderRadius: 5, backgroundColor: pal.surface }}
                    />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Ui size={fs.xs} weight="600" numberOfLines={2}>
                      {item.title}
                    </Ui>
                    {item.ts != null ? (
                      <Ui size={fs.xs - 1} weight="700" color={brand.accent} style={{ marginTop: 2 }}>
                        {t("nav.ts", { n: Math.round(item.ts) })}
                      </Ui>
                    ) : null}
                  </View>
                </View>
              </Tactile>
            )}
          />
        </View>
      ) : null}

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
            onPress={dismissSelection}
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
          {/* The two directions a pin can take you (owner 08-03): out to the film,
              or down into just that film's locations. Film focus was already fully
              built here — camera fit, Back-to-film and Show-all chips — and was
              only reachable by leaving for the film brief and coming back. */}
          {!filmSlug && selected.film_slug ? (
            <Btn
              kind="ghost"
              label={t("map.onlyThisFilm")}
              style={{ marginTop: sp.s2 }}
              onPress={() => {
                const slug = selected.film_slug as string;
                dismissSelection();
                router.setParams({ film: slug });
              }}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
