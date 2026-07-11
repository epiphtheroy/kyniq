"use client";

import dynamic from "next/dynamic";
import LazyMount from "./LazyMount";

// Chunk-split: the connection desk (EntityNetwork + EntityGraph + SentenceLexicon)
// stays out of the home's initial JS; it downloads only when scrolled near.
const ConnectionDesk = dynamic(() => import("@/components/ConnectionDesk"), {
  ssr: false,
  loading: () => <div className="emap-skel" style={{ height: 560 }}>Drawing connections…</div>,
});

/**
 * Home — the living map of cinema, embedded mid-page: the graph on the left,
 * the SentenceLexicon text grid beside it (tops/bottoms aligned, grid scrolls
 * inside). Header left-aligned like every other section. The whole desk is
 * lazy-mounted (LazyMount + dynamic) so the home's first paint never pays for it.
 */
export default function HomeNetwork() {
  return (
    <section className="band p2 homemap-sec">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>The map of cinema <span className="chev">›</span></h2>
            <div className="sub">Films, figures, tropes, ideas and directors — the whole critical web. Drag to wander, scroll to zoom, click a node to travel in.</div>
          </div>
          <a className="seeall" href="/network">Open Connections ›</a>
        </div>
        <div className="homemap">
          <LazyMount height={560} label="Drawing connections…">
            <ConnectionDesk
              api="/api/map"
              full="/network"
              height={560}
              root={{ type: "sample", key: "A_affinity,B_bridge,H_dense,C_reading,L_trope,N_question", label: "The critical web" }}
            />
          </LazyMount>
        </div>
      </div>
    </section>
  );
}
