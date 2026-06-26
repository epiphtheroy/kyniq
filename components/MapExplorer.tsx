"use client";

/**
 * MapExplorer — "The Map". Three modes, switchable by tabs:
 *   • Critical web — films·figures·tropes·ideas·directors·theorists, all interlinked.
 *   • Films — each film's "next" picks (→ arrow), films that recommend it (arrow →),
 *             and "like" affinities. 20 at a time; click a film for 20 more.
 *   • Directors — who's-next (→), directors who recommend them (→), and similar
 *             directors (by affine films).
 * Opens on a hub cloud; click any node to recenter; a breadcrumb trail records the
 * path; "Open ↗" jumps to the centered page.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import EntityGraph, { type GraphData, type GraphNode } from "@/components/EntityGraph";

type Mode = "critical" | "films" | "directors";
type EgoParams = { type: string; key: string; key2?: string };
type Target = { mode: Mode; ego?: EgoParams | null; key?: string | null };
type Crumb = { id: string; label: string; target: Target };

const MODES: [Mode, string][] = [["films", "Films"], ["directors", "Directors"], ["critical", "Grouped"]];

const PREFIX: Record<string, string> = {
  film: "film", fig: "figure", trope: "trope", idea: "idea", dir: "director", theo: "theorist",
};
const TYPE_LABEL: Record<string, string> = {
  film: "Film", figure: "Figure", trope: "Trope", idea: "Idea", director: "Director", theorist: "Theorist",
};

// critical-web id "type:key[/key2]" → ego params
function egoParams(id: string): EgoParams | null {
  const i = id.indexOf(":");
  if (i < 0) return null;
  const type = PREFIX[id.slice(0, i)];
  const rest = id.slice(i + 1);
  if (!type || !rest) return null;
  if (type === "figure") {
    const j = rest.indexOf("/");
    if (j < 0) return null;
    return { type, key: rest.slice(0, j), key2: rest.slice(j + 1) };
  }
  return { type, key: rest };
}
function slugOf(id: string): string | null {
  const i = id.indexOf(":");
  return i >= 0 ? id.slice(i + 1) : null;
}

async function fetchMap(t: Target): Promise<GraphData> {
  const p = new URLSearchParams();
  if (t.mode === "films" || t.mode === "directors") {
    p.set("mode", t.mode);
    if (t.key) p.set("key", t.key);
  } else if (t.ego) {
    p.set("type", t.ego.type); p.set("key", t.ego.key);
    if (t.ego.key2) p.set("key2", t.ego.key2);
  }
  p.set("_", String(Date.now()));
  try {
    const r = await fetch(`/api/map?${p.toString()}`, { cache: "no-store" });
    const j = await r.json();
    return { nodes: j.nodes ?? [], links: j.links ?? [] };
  } catch {
    return { nodes: [], links: [] };
  }
}

const ALL_LABEL: Record<Mode, string> = { critical: "All", films: "All films", directors: "All directors" };

export default function MapExplorer() {
  const [mode, setMode] = useState<Mode>("films");
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [stack, setStack] = useState<Crumb[]>([{ id: "__all_films", label: "All films", target: { mode: "films", key: null } }]);
  const [loading, setLoading] = useState(true);
  const [h, setH] = useState(620);
  const busy = useRef(false);
  const modeRef = useRef<Mode>(mode); modeRef.current = mode;

  useEffect(() => {
    const fit = () => setH(Math.max(420, window.innerHeight - 184));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); setData(await fetchMap({ mode: "films", key: null })); setLoading(false); })();
  }, []);

  const center = data.nodes.find((n) => n.center) || null;

  const switchMode = useCallback(async (m: Mode) => {
    if (busy.current || m === modeRef.current) return;
    busy.current = true; setLoading(true); setMode(m);
    const t: Target = { mode: m, ego: null, key: null };
    const d = await fetchMap(t);
    setData(d);
    setStack([{ id: `__all_${m}`, label: ALL_LABEL[m], target: t }]);
    setLoading(false); busy.current = false;
  }, []);

  const recenter = useCallback(async (node: GraphNode) => {
    if (busy.current || node.center) return;
    const m = modeRef.current;
    let target: Target | null = null;
    if (m === "critical") {
      const p = egoParams(node.id);
      if (!p) { if (node.href) window.location.assign(node.href); return; }
      target = { mode: "critical", ego: p };
    } else {
      const slug = slugOf(node.id);
      if (!slug) return;
      target = { mode: m, key: slug };
    }
    busy.current = true; setLoading(true);
    const d = await fetchMap(target);
    if (d.nodes.length) { setData(d); setStack((s) => [...s, { id: node.id, label: node.label, target: target! }]); }
    setLoading(false); busy.current = false;
  }, []);

  const goCrumb = useCallback(async (i: number) => {
    if (busy.current) return;
    busy.current = true; setLoading(true);
    const c = stack[i];
    const d = await fetchMap(c.target);
    setData(d); setStack((s) => s.slice(0, i + 1));
    setLoading(false); busy.current = false;
  }, [stack]);

  const legend = mode === "films"
    ? (<><span><i style={{ background: "#3a3a3a" }} />Film</span><span className="map-ek"><b style={{ background: "#C8102E" }} />→ Watch next</span><span className="map-ek"><b style={{ background: "#1F6FB2" }} />→ Recommended by</span><span className="map-ek"><b style={{ background: "rgba(0,0,0,.28)" }} />Film like</span></>)
    : mode === "directors"
    ? (<><span><i style={{ background: "#B5642A" }} />Director</span><span className="map-ek"><b style={{ background: "#C8102E" }} />→ Who&rsquo;s next</span><span className="map-ek"><b style={{ background: "#1F6FB2" }} />→ Recommended by</span><span className="map-ek"><b style={{ background: "rgba(0,0,0,.28)" }} />Similar (embedding)</span></>)
    : (<><span><i style={{ background: "#3a3a3a" }} />Film</span><span><i style={{ background: "#1F6FB2" }} />Figure</span><span><i style={{ background: "#0F6E56" }} />Trope</span><span><i style={{ background: "#6D4AAE" }} />Idea</span><span><i style={{ background: "#B5642A" }} />Director</span><span><i style={{ background: "#B23A8F" }} />Theorist</span></>);

  return (
    <div className="map-shell">
      <div className="map-tabs">
        {MODES.map(([m, l]) => (
          <button key={m} className={`map-tab${mode === m ? " on" : ""}`} onClick={() => switchMode(m)}>{l}</button>
        ))}
      </div>
      <div className="map-bar">
        <nav className="map-crumbs" aria-label="Map trail">
          {stack.map((c, i) => (
            <span key={c.id + i} className="map-crumb">
              {i > 0 && <span className="map-sep">›</span>}
              <button
                className={`map-cr${i === stack.length - 1 ? " on" : ""}`}
                onClick={() => goCrumb(i)}
                title={c.label}
              >
                {i === 0 ? `◎ ${c.label}` : c.label}
              </button>
            </span>
          ))}
        </nav>
        <div className="map-meta">
          {loading ? <span className="map-load">drawing…</span> : null}
          {center?.href ? (
            <Link className="map-open" href={center.href}>Open {TYPE_LABEL[center.type] || ""} ↗</Link>
          ) : (
            <span className="map-hint">Click a node to dive · drag to move · scroll to zoom</span>
          )}
        </div>
      </div>
      <EntityGraph data={data} height={h} onNodeClick={recenter} className="map-canvas" />
      <div className="map-legend">{legend}</div>
    </div>
  );
}
