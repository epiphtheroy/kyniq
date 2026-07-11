"use client";

/**
 * EntityMap — embeds the live Metatake graph centered on one entity, as a tab/section
 * on its page (and inside the home "Surprise me" panel). Fetches a ready-made ego
 * payload from /api/map (same engine as /map). Clicking any node RECENTERS the map on
 * that node (fetching its ego in place) with a breadcrumb to step back; the tiny ↗ on a
 * node opens its page. "Open in the full map" jumps into the full explorer.
 */

import { useCallback, useEffect, useState } from "react";
import EntityGraph, { type GraphData, type GraphNode } from "@/components/EntityGraph";

const PREFIX: Record<string, string> = { film: "film", fig: "figure", trope: "trope", idea: "idea", dir: "director", theo: "theorist" };

// node id ("type:key[/key2]") → the /api/map ego URL to recenter on it
function egoUrl(id: string): string | null {
  const i = id.indexOf(":");
  if (i < 0) return null;
  const type = PREFIX[id.slice(0, i)];
  const rest = id.slice(i + 1);
  if (!type || !rest) return null;
  if (type === "figure") {
    const j = rest.indexOf("/");
    if (j < 0) return null;
    return `/api/map?type=figure&key=${rest.slice(0, j)}&key2=${rest.slice(j + 1)}`;
  }
  return `/api/map?type=${type}&key=${rest}`;
}

type Crumb = { label: string; url: string };

// entity descriptor for onCenter (consumed by SentenceLexicon via ConnectionDesk)
export type CenterEnt = { type: string; key: string; key2?: string | null; label: string };

// "type:key[/key2]" node id → CenterEnt (full-word type per PREFIX)
function parseCenter(id: string, label: string): CenterEnt | null {
  const i = id.indexOf(":");
  if (i < 0) return null;
  const type = PREFIX[id.slice(0, i)];
  const rest = id.slice(i + 1);
  if (!type || !rest) return null;
  if (type === "figure") {
    const j = rest.indexOf("/");
    if (j < 0) return null;
    return { type, key: rest.slice(0, j), key2: rest.slice(j + 1), label };
  }
  return { type, key: rest, label };
}

// ego URL (crumb) → CenterEnt, for breadcrumb jumps
function parseCenterUrl(url: string, label: string): CenterEnt | null {
  try {
    const u = new URL(url, "http://x");
    const type = u.searchParams.get("type"); const key = u.searchParams.get("key");
    if (!type || !key) return null;
    return { type, key, key2: u.searchParams.get("key2"), label };
  } catch { return null; }
}

export default function EntityMap({ api, full, height = 460, onCenter }: { api: string; full: string; height?: number; onCenter?: (e: CenterEnt | null) => void }) {
  const [stack, setStack] = useState<Crumb[]>([{ label: "Start", url: api }]);
  const [data, setData] = useState<GraphData | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // reset to root if the page's root api changes
  useEffect(() => { setStack([{ label: "Start", url: api }]); }, [api]);

  const cur = stack[stack.length - 1];
  const atRoot = stack.length === 1;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(cur.url, { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        const nodes = Array.isArray(j.nodes) ? j.nodes : [];
        if (atRoot && nodes.length <= 1) { setFailed(true); return; }
        setData({ nodes, links: Array.isArray(j.links) ? j.links : [] });
      } catch { if (alive && atRoot) setFailed(true); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur.url]);

  const recenter = useCallback((node: GraphNode) => {
    const u = egoUrl(node.id);
    if (!u) { if (node.href) window.location.assign(node.href); return; }
    setStack((s) => (s[s.length - 1].url === u ? s : [...s, { label: node.label, url: u }]));
    onCenter?.(parseCenter(node.id, node.label));
  }, [onCenter]);
  const openNode = useCallback((n: GraphNode) => { if (n.href) window.location.assign(n.href); }, []);
  const jumpTo = (i: number) => {
    setStack((s) => s.slice(0, i + 1));
    onCenter?.(i === 0 ? null : parseCenterUrl(stack[i].url, stack[i].label));
  };

  if (failed) return null;
  const h = expanded ? 820 : height;

  return (
    <div className="emap">
      <div className="emap-head">
        {atRoot ? (
          <span className="emap-hint">Drag · scroll to zoom · click a node to recenter · ↗ opens it</span>
        ) : (
          <div className="emap-crumbs">
            {stack.map((c, i) => (
              <span key={i}>
                {i > 0 ? <span className="emap-sep">›</span> : null}
                {i < stack.length - 1
                  ? <button type="button" className="emap-crumb" onClick={() => jumpTo(i)}>{c.label}</button>
                  : <span className="emap-cur">{c.label}</span>}
              </span>
            ))}
          </div>
        )}
        <div className="emap-actions">
          {data ? (
            <button type="button" className="emap-exp" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
              {expanded ? "Collapse" : "Expand ⤢"}
            </button>
          ) : null}
          <a className="emap-full" href={full}>Open in the full map ↗</a>
        </div>
      </div>
      {data ? <EntityGraph data={data} height={h} onNodeClick={recenter} onOpen={openNode} /> : <div className="emap-skel" style={{ height: h }}>Drawing connections…</div>}
    </div>
  );
}
