"use client";

/**
 * MapExplorer — "The Map". Three modes (tabs): Films (default) · Directors · Grouped.
 * Film/director nodes show poster / face; year & birth-year sit faint inline; every
 * node carries an ↗ shortcut to its page. A filter grid (year / IMDb / Rotten Tomatoes
 * for films, year for directors) reshapes the opening cloud. Click a node to recenter;
 * a breadcrumb records the path; the centered node is enlarged.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import EntityGraph, { type GraphData, type GraphNode } from "@/components/EntityGraph";

type Mode = "films" | "directors" | "critical";
type EgoParams = { type: string; key: string; key2?: string };
type Filt = { yr?: number | null; imdb?: number | null; rt?: number | null };
type Target = { mode: Mode; ego?: EgoParams | null; key?: string | null; filt?: Filt };
type Crumb = { id: string; label: string; target: Target };

const MODES: [Mode, string][] = [["films", "Films"], ["directors", "Directors"], ["critical", "Grouped"]];
const ALL_LABEL: Record<Mode, string> = { films: "All films", directors: "All directors", critical: "All" };

const PREFIX: Record<string, string> = { film: "film", fig: "figure", trope: "trope", idea: "idea", dir: "director", theo: "theorist" };
const TYPE_LABEL: Record<string, string> = { film: "Film", figure: "Figure", trope: "Trope", idea: "Idea", director: "Director", theorist: "Theorist" };

const YEARS = [null, 1970, 1980, 1990, 2000, 2010, 2020];
const IMDBS = [null, 6, 7, 7.5, 8];
const RTS = [null, 60, 75, 90];

function egoParams(id: string): EgoParams | null {
  const i = id.indexOf(":");
  if (i < 0) return null;
  const type = PREFIX[id.slice(0, i)];
  const rest = id.slice(i + 1);
  if (!type || !rest) return null;
  if (type === "figure") { const j = rest.indexOf("/"); if (j < 0) return null; return { type, key: rest.slice(0, j), key2: rest.slice(j + 1) }; }
  return { type, key: rest };
}
const slugOf = (id: string) => { const i = id.indexOf(":"); return i >= 0 ? id.slice(i + 1) : null; };

async function fetchMap(t: Target): Promise<GraphData> {
  const p = new URLSearchParams();
  if (t.mode === "films" || t.mode === "directors") {
    p.set("mode", t.mode);
    if (t.key) p.set("key", t.key);
    else if (t.filt) {
      if (t.filt.yr) p.set("yr", String(t.filt.yr));
      if (t.mode === "films") { if (t.filt.imdb) p.set("imdb", String(t.filt.imdb)); if (t.filt.rt) p.set("rt", String(t.filt.rt)); }
    }
  } else if (t.ego) {
    p.set("type", t.ego.type); p.set("key", t.ego.key); if (t.ego.key2) p.set("key2", t.ego.key2);
  }
  p.set("_", String(Date.now()));
  try {
    const r = await fetch(`/api/map?${p.toString()}`, { cache: "no-store" });
    const j = await r.json();
    return { nodes: j.nodes ?? [], links: j.links ?? [] };
  } catch { return { nodes: [], links: [] }; }
}

export default function MapExplorer() {
  const [mode, setMode] = useState<Mode>("films");
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [stack, setStack] = useState<Crumb[]>([{ id: "__all_films", label: "All films", target: { mode: "films", key: null, filt: {} } }]);
  const [loading, setLoading] = useState(true);
  const [h, setH] = useState(600);
  const [filt, setFilt] = useState<Filt>({ yr: null, imdb: null, rt: null });
  const busy = useRef(false);
  const modeRef = useRef<Mode>(mode); modeRef.current = mode;
  const filtRef = useRef<Filt>(filt); filtRef.current = filt;

  useEffect(() => {
    const fit = () => setH(Math.max(420, window.innerHeight - 210));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const loadOverview = useCallback(async (m: Mode, f: Filt) => {
    busy.current = true; setLoading(true);
    const t: Target = { mode: m, key: null, filt: f };
    const d = await fetchMap(t);
    setData(d);
    setStack([{ id: `__all_${m}`, label: ALL_LABEL[m], target: t }]);
    setLoading(false); busy.current = false;
  }, []);

  useEffect(() => { loadOverview("films", { yr: null, imdb: null, rt: null }); }, [loadOverview]);

  const center = data.nodes.find((n) => n.center) || null;

  const switchMode = useCallback((m: Mode) => {
    if (busy.current || m === modeRef.current) return;
    setMode(m);
    if (m === "critical") { // grouped overview ignores filters
      (async () => { busy.current = true; setLoading(true);
        const t: Target = { mode: "critical", ego: null };
        const d = await fetchMap(t); setData(d);
        setStack([{ id: "__all_critical", label: "All", target: t }]);
        setLoading(false); busy.current = false; })();
    } else loadOverview(m, filtRef.current);
  }, [loadOverview]);

  const changeFilt = useCallback((patch: Filt) => {
    const f = { ...filtRef.current, ...patch };
    setFilt(f);
    if (modeRef.current !== "critical") loadOverview(modeRef.current, f);
  }, [loadOverview]);

  const recenter = useCallback(async (node: GraphNode) => {
    if (busy.current || node.center) return;
    const m = modeRef.current;
    let target: Target | null = null;
    if (m === "critical") {
      const p = egoParams(node.id);
      if (!p) { if (node.href) window.location.assign(node.href); return; }
      target = { mode: "critical", ego: p };
    } else { const slug = slugOf(node.id); if (!slug) return; target = { mode: m, key: slug }; }
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

  const openNode = useCallback((n: GraphNode) => { if (n.href) window.location.assign(n.href); }, []);

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

      {mode !== "critical" && (
        <div className="map-filters">
          <label>Year
            <select value={filt.yr ?? ""} onChange={(e) => changeFilt({ yr: e.target.value ? Number(e.target.value) : null })}>
              {YEARS.map((y) => <option key={String(y)} value={y ?? ""}>{y ? `from ${y}` : "Any"}</option>)}
            </select>
          </label>
          {mode === "films" && (
            <>
              <label>IMDb
                <select value={filt.imdb ?? ""} onChange={(e) => changeFilt({ imdb: e.target.value ? Number(e.target.value) : null })}>
                  {IMDBS.map((v) => <option key={String(v)} value={v ?? ""}>{v ? `${v}★+` : "Any"}</option>)}
                </select>
              </label>
              <label>Rotten Tomatoes
                <select value={filt.rt ?? ""} onChange={(e) => changeFilt({ rt: e.target.value ? Number(e.target.value) : null })}>
                  {RTS.map((v) => <option key={String(v)} value={v ?? ""}>{v ? `${v}%+` : "Any"}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
      )}

      <div className="map-bar">
        <nav className="map-crumbs" aria-label="Map trail">
          {stack.map((c, i) => (
            <span key={c.id + i} className="map-crumb">
              {i > 0 && <span className="map-sep">›</span>}
              <button className={`map-cr${i === stack.length - 1 ? " on" : ""}`} onClick={() => goCrumb(i)} title={c.label}>
                {i === 0 ? `◎ ${c.label}` : c.label}
              </button>
            </span>
          ))}
        </nav>
        <div className="map-meta">
          {loading ? <span className="map-load">drawing…</span> : null}
          {center?.href ? (
            <a className="map-open" href={center.href}>Open {TYPE_LABEL[center.type] || ""} ↗</a>
          ) : (
            <span className="map-hint">Click a node to dive · ↗ opens its page · drag · scroll to zoom</span>
          )}
        </div>
      </div>

      <EntityGraph data={data} height={h} onNodeClick={recenter} onOpen={openNode} className="map-canvas" />
      <div className="map-legend">{legend}</div>
    </div>
  );
}
