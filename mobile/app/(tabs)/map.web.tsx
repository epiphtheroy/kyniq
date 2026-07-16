// Web preview stub for the Locations tab. MapLibre GL Native has no web
// renderer, and the browser build exists only so the app can be reviewed on a
// desktop — the real map ships in the iOS/Android build. Metro picks this file
// over map.tsx on web automatically (platform extension resolution).
import React from "react";
import { MapUnavailable } from "../../src/screens/MapUnavailable";

export default function MapWebRoute() {
  return <MapUnavailable />;
}
