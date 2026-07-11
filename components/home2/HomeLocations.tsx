"use client";

import dynamic from "next/dynamic";
import LazyMount from "./LazyMount";

// Chunk-split + lazy: FilmMap pulls MapLibre GL (a heavy script + tiles) —
// it must never compete with the home's first paint. It downloads and mounts
// only when the reader scrolls near ("atlas is slow" report, 2026-07-11).
const FilmMap = dynamic(() => import("@/components/FilmMap"), {
  ssr: false,
  loading: () => <div className="emap-skel" style={{ height: 460 }}>Loading the map…</div>,
});

/**
 * Home — the geographic Atlas. Every place our films are set in or filmed at,
 * on a real-world map (crisp vector basemap; satellite one click away).
 * Search a film to frame it; hover a pin to read what the place means.
 */
export default function HomeLocations() {
  return (
    <section className="band homelocations-sec">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>The world map of cinema <span className="chev">›</span></h2>
            <div className="sub">Every place our films are set in and filmed at, on the real map. Search a film to open it; hover a pin to read what the place means.</div>
          </div>
          <a className="seeall" href="/locations">Open the full map ›</a>
        </div>
        <div className="homelocations">
          <LazyMount height={460} label="Loading the map…">
            <FilmMap endpoint="/api/geo" height={460} search />
          </LazyMount>
        </div>
      </div>
    </section>
  );
}
