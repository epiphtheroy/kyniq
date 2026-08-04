// Which map renderer this binary can actually draw.
//
// @divergence mapEngine — see ../capabilities.ts for the argument. In short:
// iOS takes react-native-maps because it is already in the binary and draws
// instantly; Android takes MapLibre GL JS in a WebView because it needs no API
// key and carries the canonical look (Esri satellite, clustering, poster pins).
// Android is the richer map today — moving it to Google Maps would be a
// downgrade, not parity.
//
// This selector used to live in app/(tabs)/map.tsx, i.e. in a route. Routes are
// platform-blind by rule now, so the choice lives here and the route just renders
// what it is handed.
//
// The requires stay LAZY on purpose: a top-level import of a module absent from
// a given binary throws at load and red-screens the whole tab. If even the lazy
// require fails, the caller shows MapUnavailable instead of crashing.
import React from "react";
import { Platform } from "react-native";

/**
 * The full-screen Locations map for this platform, or null when no renderer is
 * present in this binary (Expo Go without the native module, for instance).
 */
export function resolveMapSurface(): React.ComponentType | null {
  try {
    if (Platform.OS === "ios") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("../../screens/MapExpoGo").default as React.ComponentType;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../../screens/MapWebView").default as React.ComponentType;
  } catch {
    return null;
  }
}

/** True when this platform's map can pan/zoom in place rather than being a picture. */
export const mapIsInteractive = true;
