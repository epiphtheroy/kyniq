"use client";

/**
 * MapExplorer — "The Map". A full-screen force graph over the whole critical web
 * (films · figures · tropes · ideas · directors · theorists). Opens on a dense hub
 * cloud; click any node to recenter the map on it (3 rings deep); a breadcrumb trail
 * across the top records where you've been; "Open ↗" jumps to the centered page.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import EntityGraph, { type GraphData, type GraphNode } from "@/components/EntityGraph";

type Crumb = { id: string; label: string; type: string; params: EgoParams | null };
type EgoParams = { type: string; key: string; key2?: string };

const PREFIX: Record<string, string> = {
  film: "film", fig: "figure", trope: "trope", idea: "idea", dir: "director", theo: "theorist",
};

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

async function fetchMap(p: EgoParams | null): Promise<GraphData> {
  const params = new URLSearchParams();
  if (p) { params.set("type", p.type); params.set("key", p.key); if (p.key2) params.set("key2", p.key2); }
  params.set("_", String(Date.now()));
  try {
    const r = await fetch(`/api/map?${params.toString()}`, { cache: "no-store" });
    const j = await r.json();
    return { nodes: j.nodes ?? [], links: j.links ?? [] };
  } catch {
    return { nodes: [], links: [] };
  }
}

const TYPE_LABEL: Record<string, string> = {
  film: "Film", figure: "Figure", trope: "Trope", idea: "Idea",
  director: "Director", theorist: "Theorist", overview: "The whole map",
};

export default function MapExplorer() {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [stack, setStack] = useState<Crumb[]>([{ id: "__all", label: "All", type: "overview", params: null }]);
  const [loading, setLoading] = useState(true);
  const [h, setH] = useState(620);
  const busy = useRef(false);

  useEffect(() => {
    const fit = () => setH(Math.max(420, window.innerHeight - 150));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); setData(await fetchMap(null)); setLoading(false); })();
  }, []);

  const center = data.nodes.find((n) => n.center) || null;

  const recenter = useCallback(async (node: GraphNode) => {
    if (busy.current || node.center) return;
    const p = egoParams(node.id);
    if (!p) { if (node.href) window.location.assign(node.href); return; }
    busy.current = true; setLoading(true);
    const d = await fetchMap(p);
    if (d.nodes.length) {
      setData(d);
      setStack((s) => [...s, { id: node.id, label: node.label, type: node.type, params: p }]);
    }
    setLoading(false); busy.current = false;
  }, []);

  const goCrumb = useCallback(async (i: number) => {
    if (busy.current) return;
    busy.current = true; setLoading(true);
    const c = stack[i];
    const d = await fetchMap(c.params);
    setData(d);
    setStack((s) => s.slice(0, i + 1));
    setLoading(false); busy.current = false;
  }, [stack]);

  return (
    <div className="map-shell">
      <div className="map-bar">
        <nav className="map-crumbs" aria-label="Map trail">
          {stack.map((c, i) => (
            <span key={c.id + i} className="map-crumb">
              {i > 0 && <span className="map-sep">›</span>}
              <button
                className={`map-cr${i === stack.length - 1 ? " on" : ""}`}
                onClick={() => goCrumb(i)}
                title={`${TYPE_LABEL[c.type] || c.type}: ${c.label}`}
              >
                {i === 0 ? "◎ All" : c.label}
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
      <div className="map-legend">
        <span><i style={{ background: "#3a3a3a" }} />Film</span>
        <span><i style={{ background: "#1F6FB2" }} />Figure</span>
        <span><i style={{ background: "#0F6E56" }} />Trope</span>
        <span><i style={{ background: "#6D4AAE" }} />Idea</span>
        <span><i style={{ background: "#B5642A" }} />Director</span>
        <span><i style={{ background: "#B23A8F" }} />Theorist</span>
      </div>
    </div>
  );
}
