"use client";

import ConnectionDesk from "@/components/ConnectionDesk";

/**
 * Home — the living map of cinema, embedded mid-page. The overview hub cloud
 * (films · figures · tropes · ideas · directors) on the left, the atlas-style
 * SentenceLexicon text grid on the right (rule-based connection sentences that
 * recenter when you travel the map). Contained in .wrap for generous margins.
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
          <ConnectionDesk
            api="/api/map"
            full="/map"
            height={520}
            root={{ type: "sample", key: "A_affinity,B_bridge,H_dense,C_reading,L_trope,N_question", label: "The critical web" }}
          />
        </div>
      </div>
    </section>
  );
}
