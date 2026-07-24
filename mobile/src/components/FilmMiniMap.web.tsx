// Embedded per-film locations map — web renderer (maplibre-gl JS, same engine
// as the Locations tab's web preview). Non-interactive by design: it shows THIS
// film's pins only, fitted; a click hands off to the full Map tab (film focus).
import maplibregl from "maplibre-gl";
import React, { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import { brand, radius } from "../theme";
import type { GeoPin } from "../types";

const MAP_STYLE = "https://demotiles.maplibre.org/style.json";

// Metro web doesn't reliably bundle package CSS — inject the minimal rules once
// (same trick as app/(tabs)/map.web.tsx; shared id so only one copy lands).
const CSS_ID = "mt-maplibre-css-mini";
const CSS = [
  ".maplibregl-map{position:relative;overflow:hidden;width:100%;height:100%}",
  ".maplibregl-canvas-container,.maplibregl-canvas{position:absolute;inset:0;width:100%;height:100%}",
  ".maplibregl-canvas{outline:none}",
  ".maplibregl-ctrl-bottom-right{position:absolute;bottom:0;right:0;z-index:2}",
  ".maplibregl-ctrl-attrib{background:rgba(255,255,255,.72);font:10px/1.5 sans-serif;padding:0 6px}",
  ".maplibregl-ctrl-attrib a{color:inherit}",
  ".maplibregl-ctrl-attrib-button{display:none}",
  ".maplibregl-ctrl-attrib-inner{display:inline}",
].join("");

function injectCss(): void {
  if (typeof document === "undefined" || document.getElementById(CSS_ID)) return;
  const el = document.createElement("style");
  el.id = CSS_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

export default function FilmMiniMap({
  pins,
  height,
  onPress,
}: {
  pins: GeoPin[];
  height: number;
  onPress: () => void;
}) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!divRef.current || !pins.length) return;
    injectCss();
    // maplibre THROWS on browsers without WebGL — without this guard the error
    // boundary swallows the whole film screen, not just the mini map.
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: divRef.current,
        style: MAP_STYLE,
        interactive: false,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      for (const p of pins) {
        new maplibregl.Marker({ color: brand.accent, scale: 0.72 })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
      }
      const b = new maplibregl.LngLatBounds();
      for (const p of pins) b.extend([p.lng, p.lat]);
      map.fitBounds(b, { padding: 36, maxZoom: 9, duration: 0 });
    } catch {
      return; // quiet box — the pin-name rows below still work
    }
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [pins]);

  if (!pins.length) return null;
  return (
    <View style={{ height, borderRadius: radius.md, overflow: "hidden" }}>
      <div ref={divRef} style={{ width: "100%", height: "100%" }} />
      {/* Transparent hit layer — the mini map is a doorway, not a playground. */}
      <Pressable
        onPress={onPress}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        accessibilityRole="button"
      />
    </View>
  );
}
