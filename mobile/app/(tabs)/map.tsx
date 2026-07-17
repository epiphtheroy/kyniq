// Locations tab (native) — runtime split across the map stacks. Web is handled
// by map.web.tsx (expo-router platform file), so this route only picks a native
// implementation:
//   - Expo Go + iOS  → MapExpoGo (react-native-maps = Apple Maps; in the Expo Go
//     binary, no API key on iOS).
//   - Expo Go + Android → MapWebView (MapLibre GL JS inside react-native-webview).
//     react-native-maps on Android is Google Maps, which draws nothing without a
//     Google Cloud key; the WebView map needs no key and matches the web preview.
//   - dev/store builds → MapNative (MapLibre GL Native, the canon renderer, both
//     platforms, no key).
// Requires stay lazy on purpose: a top-level import of a module absent from a
// given binary throws at load and red-screens the tab. If even the lazy require
// fails, the tab explains itself instead of crashing.
import Constants from "expo-constants";
import React from "react";
import { Platform } from "react-native";
import { MapUnavailable } from "../../src/screens/MapUnavailable";

const IN_EXPO_GO = Constants.executionEnvironment === "storeClient";

export default function MapRoute() {
  let Impl: React.ComponentType | null = null;
  try {
    if (IN_EXPO_GO) {
      Impl =
        Platform.OS === "android"
          ? // eslint-disable-next-line @typescript-eslint/no-require-imports
            (require("../../src/screens/MapWebView").default as React.ComponentType)
          : // eslint-disable-next-line @typescript-eslint/no-require-imports
            (require("../../src/screens/MapExpoGo").default as React.ComponentType);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Impl = require("../../src/screens/MapNative").default as React.ComponentType;
    }
  } catch {
    Impl = null; // native module missing from this binary — fall through to stub
  }
  if (!Impl) return <MapUnavailable reason="map.expoGoUnavailable" />;
  return <Impl />;
}
