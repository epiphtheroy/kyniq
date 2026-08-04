// Locations tab (native). Web is handled by map.web.tsx (expo-router platform
// file). Which renderer this platform uses is not a route's business — that
// decision, and the reasoning behind it, lives in src/platform/map.
import React from "react";
import { resolveMapSurface } from "../../src/platform/map";
import { MapUnavailable } from "../../src/screens/MapUnavailable";

export default function MapRoute() {
  const Impl = resolveMapSurface();
  if (!Impl) return <MapUnavailable reason="map.expoGoUnavailable" />;
  return <Impl />;
}
