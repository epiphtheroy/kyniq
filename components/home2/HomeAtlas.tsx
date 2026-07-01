"use client";

import FilmMap from "@/components/FilmMap";

/**
 * Home — the geographic Atlas (satellite by default). Every place our films are
 * set in or filmed at, on a real-world map. Search a film to jump to its page;
 * hover a pin to read what the place means.
 */
export default function HomeAtlas() {
  return (
    <section className="band">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>The Atlas of cinema <span className="chev">›</span></h2>
            <div className="sub">Every place our films are set in and filmed at, on the real map. Search a film to open it; hover a pin to read what the place means.</div>
          </div>
          <a className="seeall" href="/atlas">Open the full Atlas ›</a>
        </div>
        <div className="homeatlas">
          <FilmMap endpoint="/api/geo" height={460} search satelliteDefault />
        </div>
      </div>
    </section>
  );
}
