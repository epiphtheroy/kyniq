"use client";

/**
 * EntityMap — embeds the live Metatake graph centered on one entity, as a tab/section
 * on its page. Fetches a ready-made ego payload from /api/map (the same engine as
 * /map) and renders it with <EntityGraph>. Clicking a node opens that entity's page
 * (EntityGraph's default), and "Explore in the full map" jumps into the explorer.
 * The SEO heading + intro + stats are rendered server-side by the page above this.
 */

import { useEffect, useState } from "react";
import EntityGraph, { type GraphData } from "@/components/EntityGraph";

export default function EntityMap({ api, full, height = 460 }: { api: string; full: string; height?: number }) {
  const [data, setData] = useState<GraphData | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(api, { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        if (!j || !Array.isArray(j.nodes) || j.nodes.length <= 1) { setFailed(true); return; }
        setData({ nodes: j.nodes, links: Array.isArray(j.links) ? j.links : [] });
      } catch { if (alive) setFailed(true); }
    })();
    return () => { alive = false; };
  }, [api]);

  if (failed) return null;
  const h = expanded ? 820 : height;

  return (
    <div className="emap">
      <div className="emap-head">
        <span className="emap-hint">Drag · scroll to zoom · click a node to open it</span>
        <div className="emap-actions">
          {data ? (
            <button type="button" className="emap-exp" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
              {expanded ? "Collapse" : "Expand ⤢"}
            </button>
          ) : null}
          <a className="emap-full" href={full}>Explore in the full map ↗</a>
        </div>
      </div>
      {data ? <EntityGraph data={data} height={h} /> : <div className="emap-skel" style={{ height: h }}>Drawing connections…</div>}
    </div>
  );
}
