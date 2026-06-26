"use client";

import EntityMap from "@/components/EntityMap";

/**
 * Home — the living map of cinema, embedded mid-page. The overview hub cloud
 * (films · figures · tropes · ideas · directors). Contained in .wrap so it keeps
 * generous left/right margins; drag/zoom inside; click a node to travel in.
 */
export default function HomeMap() {
  return (
    <section className="band p2">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>The map of cinema <span className="chev">›</span></h2>
            <div className="sub">Films, figures, tropes, ideas and directors — the whole critical web. Drag to wander, scroll to zoom, click a node to travel in.</div>
          </div>
          <a className="seeall" href="/map">Open full map ›</a>
        </div>
        <div className="homemap">
          <EntityMap api="/api/map" full="/map" height={520} />
        </div>
      </div>
    </section>
  );
}
