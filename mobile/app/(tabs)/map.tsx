// Locations tab (native) — runtime split between the two native map stacks.
// Web is handled by map.web.tsx (expo-router platform file), so this route only
// decides which native implementation to mount:
//   - Expo Go: react-native-maps ships inside the Expo Go binary → MapExpoGo
//     (Apple Maps) — the map an iPhone reviewer sees before any dev build.
//   - dev/store builds: MapLibre GL Native → MapNative (the canon UX).
// Both requires stay lazy on purpose: a top-level import of the module absent
// from a given binary (MapLibre in Expo Go, and vice versa) throws at module
// load and red-screens the tab. If even the lazy require fails, the tab
// explains itself with the stub instead of crashing.
import Constants from "expo-constants";
import React from "react";
import { MapUnavailable } from "../../src/screens/MapUnavailable";

const IN_EXPO_GO = Constants.executionEnvironment === "storeClient";

export default function MapRoute() {
  let Impl: React.ComponentType | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Impl = IN_EXPO_GO
      ? (require("../../src/screens/MapExpoGo").default as React.ComponentType)
      : (require("../../src/screens/MapNative").default as React.ComponentType);
  } catch {
    Impl = null; // native module missing from this binary — fall through to stub
  }
  if (!Impl) return <MapUnavailable reason="map.expoGoUnavailable" />;
  return <Impl />;
}
