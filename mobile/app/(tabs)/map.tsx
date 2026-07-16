// Locations tab (native). The real screen lives in src/screens/MapNative and is
// required lazily on purpose: MapLibre is a custom native module, so importing it
// inside Expo Go — which ships a fixed binary without it — throws at module load
// and red-screens the tab. Reviewers use Expo Go before the first dev build
// exists, so the tab explains itself there instead of crashing. In a dev or
// store build the require resolves and the real map renders.
import Constants from "expo-constants";
import React from "react";
import { MapUnavailable } from "../../src/screens/MapUnavailable";

const IN_EXPO_GO = Constants.executionEnvironment === "storeClient";

export default function MapRoute() {
  if (IN_EXPO_GO) return <MapUnavailable reason="map.expoGoUnavailable" />;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MapNative = require("../../src/screens/MapNative").default as React.ComponentType;
  return <MapNative />;
}
