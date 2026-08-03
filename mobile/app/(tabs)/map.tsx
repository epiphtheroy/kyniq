// Locations tab (native) — runtime split across the map stacks. Web is handled
// by map.web.tsx (expo-router platform file), so this route only picks a native
// implementation:
//   - iOS (Expo Go AND store builds) → MapExpoGo (react-native-maps = Apple
//     Maps, in the binary, no key, draws instantly).
//   - Android → MapWebView (MapLibre GL JS inside react-native-webview).
//     react-native-maps on Android is Google Maps, which draws nothing without a
//     Google Cloud key; the WebView map needs no key.
//   - MapNative (MapLibre GL Native) is benched on both — it hard-crashes the
//     iOS store build (TestFlight build 8, 2026-07-20).
// Requires stay lazy on purpose: a top-level import of a module absent from a
// given binary throws at load and red-screens the tab. If even the lazy require
// fails, the tab explains itself instead of crashing.
import React from "react";
import { Platform } from "react-native";
import { MapUnavailable } from "../../src/screens/MapUnavailable";

export default function MapRoute() {
  let Impl: React.ComponentType | null = null;
  try {
    if (Platform.OS === "ios") {
      // Owner 08-03: the map was still slow to LOAD. On iOS the WebView path
      // had to boot WKWebView, fetch ~250 KB of maplibre off unpkg, parse it and
      // index 17,337 points before a tile appeared. react-native-maps is in the
      // binary (FilmMiniMap has used it in store builds since 07-30) and Apple
      // Maps draws immediately — so iOS takes the native renderer everywhere,
      // not just inside Expo Go. Android stays on the WebView: Google Maps there
      // needs a Cloud key, and MapLibre GL Native still crashes the store build.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Impl = require("../../src/screens/MapExpoGo").default as React.ComponentType;
    } else {
      // Android: MapLibre GL JS in a WebView — no key needed, unlike Google
      // Maps. MapLibre GL *Native* (MapNative) stays benched: it hard-crashes
      // the iOS store build (v11 + RN 0.81 new-arch, TestFlight build 8).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Impl = require("../../src/screens/MapWebView").default as React.ComponentType;
    }
  } catch {
    Impl = null; // renderer missing from this binary — fall through to stub
  }
  if (!Impl) return <MapUnavailable reason="map.expoGoUnavailable" />;
  return <Impl />;
}
