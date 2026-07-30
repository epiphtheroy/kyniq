// Embedded per-film locations map.
//   iOS (Expo Go AND store builds) → react-native-maps. GOOGLE Maps when the
//                                    Maps SDK key is in the binary (build 15+),
//                                    Apple Maps otherwise — both native, no CDN,
//                                    native pinch/zoom.
//   Android                        → MapLibre GL JS inside react-native-webview.
//                                    The key now in the config would let this be
//                                    native Google too; left alone until the
//                                    Android launch actually tests it.
//   MapLibre GL Native             → BENCHED: hard-crashes the iOS store build
//                                    (TestFlight build 8, 2026-07-20). Do not revive.
// Owner 07-30: the map used to be a dead picture that outlinked to the Maps app —
// slow, and you could not zoom. On iOS it is now a real map you can pinch, pan and
// tap; the outlink survives as an explicit button for turn-by-turn.
// Requires stay lazy: importing a module absent from the running binary would
// red-screen the film card. If nothing can draw, render nothing (the pin-name
// rows below the map still work).
import Constants from "expo-constants";
import React from "react";
import { Platform, Pressable, View } from "react-native";
import { brand, radius } from "../theme";
import type { GeoPin } from "../types";

const IN_EXPO_GO = Constants.executionEnvironment === "storeClient";
/**
 * Owner asked for Google Maps in-app. react-native-maps can render Google on
 * iOS, but only if the Maps SDK key was baked into the binary (see
 * app.config.js). Read it back at runtime: with a key we ask for Google, and
 * without one we stay on Apple Maps rather than render a blank Google view —
 * a missing key must not look like a broken map.
 */
const MAPS_KEY_PRESENT = !!(
  Constants.expoConfig as unknown as { ios?: { config?: { googleMapsApiKey?: string } } }
)?.ios?.config?.googleMapsApiKey;
const MAP_STYLE = "https://demotiles.maplibre.org/style.json";
const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css";

type Props = {
  pins: GeoPin[];
  height: number;
  /** Tapping the map surface. Ignored when the map is interactive — pinching a
   *  map that navigates away on touch is the worst of both. */
  onPress: () => void;
  /** Let the user pan/zoom in place (iOS native renderer only). */
  interactive?: boolean;
};

function bounds(pins: GeoPin[]) {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const p of pins) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

/** Apple Maps mini (react-native-maps ships inside Expo Go on iOS). */
function AppleMini({ pins, height, onPress, interactive = false }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Maps = require("react-native-maps") as typeof import("react-native-maps");
  const MapView = Maps.default;
  const { Marker, PROVIDER_GOOGLE } = Maps;
  const b = bounds(pins);
  const latDelta = Math.min(120, Math.max(0.08, (b.maxLat - b.minLat) * 1.7));
  const lngDelta = Math.min(120, Math.max(0.08, (b.maxLng - b.minLng) * 1.7));
  return (
    <View style={{ height, borderRadius: radius.md, overflow: "hidden" }}>
      <MapView
        style={{ flex: 1 }}
        provider={MAPS_KEY_PRESENT ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: (b.minLat + b.maxLat) / 2,
          longitude: (b.minLng + b.maxLng) / 2,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        }}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterest={false}
      >
        {pins.slice(0, 60).map((p) => (
          <Marker
            key={String(p.id)}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            pinColor={brand.accent}
            title={p.name}
            description={p.country ?? undefined}
          />
        ))}
      </MapView>
      {interactive ? null : (
        <Pressable
          onPress={onPress}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityRole="button"
        />
      )}
    </View>
  );
}

/** MapLibre-in-WebView mini (the Android Expo Go path; also the dev-build fallback). */
function WebViewMini({ pins, height, onPress }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WebView } = require("react-native-webview") as typeof import("react-native-webview");
  const feats = pins
    .slice(0, 120)
    .map((p) => `[${p.lng.toFixed(5)},${p.lat.toFixed(5)}]`)
    .join(",");
  const html = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link href="${MAPLIBRE_CSS}" rel="stylesheet"><script src="${MAPLIBRE_JS}"></script>
<style>html,body,#m{margin:0;padding:0;height:100%;width:100%;background:#0b1020}
.maplibregl-ctrl-attrib{font:9px/1.5 -apple-system,system-ui,sans-serif}</style>
</head><body><div id="m"></div><script>
var pts=[${feats}];
var map=new maplibregl.Map({container:"m",interactive:false,attributionControl:{compact:true},style:{
  version:8,
  sources:{
    sat:{type:"raster",tileSize:256,maxzoom:19,attribution:"Esri · Maxar · Earthstar Geographics",
         tiles:["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"]},
    ref:{type:"raster",tileSize:256,maxzoom:19,
         tiles:["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"]}
  },
  layers:[{id:"sat",type:"raster",source:"sat"},{id:"ref",type:"raster",source:"ref",paint:{"raster-opacity":0.9}}]
}});
pts.forEach(function(c){new maplibregl.Marker({color:"${brand.accent}",scale:0.7}).setLngLat(c).addTo(map);});
var b=new maplibregl.LngLatBounds();pts.forEach(function(c){b.extend(c);});
map.fitBounds(b,{padding:34,maxZoom:9,duration:0});
</script></body></html>`;
  return (
    <View style={{ height, borderRadius: radius.md, overflow: "hidden" }}>
      <WebView
        source={{ html }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        androidLayerType="hardware"
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
      <Pressable
        onPress={onPress}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        accessibilityRole="button"
      />
    </View>
  );
}

/** MapLibre GL Native mini (dev/store builds — the canon renderer).
 * v11 API (@maplibre/maplibre-react-native ≥10): `Map` + `Camera` +
 * `GeoJSONSource`/`Layer` — matches MapNative. The old v9 names (`MapView`,
 * `PointAnnotation`) no longer exist and would render `undefined` → red-screen. */
function NativeMini({ pins, height, onPress }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ML = require("@maplibre/maplibre-react-native") as {
    Map: React.ComponentType<Record<string, unknown>>;
    Camera: React.ComponentType<Record<string, unknown>>;
    GeoJSONSource: React.ComponentType<Record<string, unknown>>;
    Layer: React.ComponentType<Record<string, unknown>>;
  };
  const { Map: MLMap, Camera, GeoJSONSource, Layer } = ML;
  const b = bounds(pins);
  const single = pins.length === 1 || (b.minLat === b.maxLat && b.minLng === b.maxLng);
  const initialViewState = single
    ? { center: [(b.minLng + b.maxLng) / 2, (b.minLat + b.maxLat) / 2], zoom: 8 }
    : { bounds: [b.minLng, b.minLat, b.maxLng, b.maxLat], padding: { top: 34, bottom: 34, left: 34, right: 34 } };
  const collection = {
    type: "FeatureCollection" as const,
    features: pins.slice(0, 120).map((p, i) => ({
      type: "Feature" as const,
      id: i,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      properties: {},
    })),
  };
  return (
    <View style={{ height, borderRadius: radius.md, overflow: "hidden" }}>
      <MLMap style={{ flex: 1 }} mapStyle={MAP_STYLE} logo={false}>
        <Camera initialViewState={initialViewState} />
        <GeoJSONSource id="fmm-src" data={collection}>
          <Layer
            type="circle"
            id="fmm-pts"
            paint={{
              "circle-color": brand.accent,
              "circle-radius": 6,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#FFFFFF",
            }}
          />
        </GeoJSONSource>
      </MLMap>
      <Pressable
        onPress={onPress}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        accessibilityRole="button"
      />
    </View>
  );
}

export default function FilmMiniMap(props: Props) {
  if (!props.pins.length) return null;
  // Probe the require HERE (not via JSX — element creation defers the child's
  // render, so a try around `return <Child/>` would never catch its require).
  let Impl: React.ComponentType<Props> | null = null;
  try {
    if (Platform.OS === "ios") {
      // Apple Maps: in the binary (autolinked), draws instantly, costs nothing,
      // and pinch-zooms natively. The WebView path pulled maplibre-gl off unpkg
      // and raster tiles off ArcGIS on every open — that was the slowness.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("react-native-maps");
      Impl = AppleMini;
    } else {
      // Android: MapLibre GL JS in a WebView (Google Maps there would need a
      // Cloud key). NativeMini (MapLibre GL Native) stays benched — it
      // hard-crashes the iOS store build (confirmed TestFlight build 8).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("react-native-webview");
      Impl = WebViewMini;
    }
  } catch {
    try {
      // Fall back rather than lose the map if the native module is missing.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("react-native-webview");
      Impl = WebViewMini;
    } catch {
      Impl = null; // no renderer in this binary — the pin-name rows still stand
    }
  }
  if (!Impl) return null;
  return <Impl {...props} />;
}
