"use client";

/**
 * MapExplorer — "The Map". Tabs: Films (default) · Directors · Grouped.
 * Film/director nodes show poster/face; year & birth-year sit faint inline; every node
 * has a small ↗ to its page and a single-click recenter. A fuzzy search box (top-left of
 * the graph) jumps the map to any film/director/trope/idea/theorist/figure. A filter grid
 * (Year/IMDb/Rotten Tomatoes for films, Year for directors) reshapes the opening cloud on Apply.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import EntityGraph, { type GraphData, type GraphNode } from "@/components/EntityGraph";
import GalaxyMap from "@/components/GalaxyMap";

type Mode = "films" | "directors" | "critical" | "galaxy";
type EgoParams = { type: string; key: string; key2?: string };
type Filt = { yr?: number | null; imdb?: number | null; rt?: number | null };
type Target = { mode: Mode; ego?: EgoParams | null; key?: string | null; filt?: Filt };
type Crumb = { id: string; label: string; target: Target };
type SearchHit = { type: string; key: string; key2: string | null; label: string; sub: string | null; score: number };

const MODES: [Mode, string][] = [["films", "Films"], ["directors", "Directors"], ["critical", "Grouped"], ["galaxy", "Galaxy"]];
const ALL_LABEL: Record<Mode, string> = { films: "All films", directors: "All directors", critical: "All", galaxy: "Galaxy" };
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
  } else if (t.ego) { p.set("type", t.ego.type); p.set("key", t.ego.key); if (t.ego.key2) p.set("key2", t.ego.key2); }
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
  const [filt, setFilt] = useState<Filt>({ yr: null, imdb: null, rt: null });   // pending (selects)
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const busy = useRef(false);
  const modeRef = useRef<Mode>(mode); modeRef.current = mode;

  useEffect(() => {
    const fit = () => setH(Math.max(420, window.innerHeight - 210));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const loadOverview = useCallback(async (m: Mode, f: Filt) => {
    busy.current = true; setLoading(true);
    const t: Target = m === "critical" ? { mode: "critical", ego: null } : { mode: m, key: null, filt: f };
    const d = await fetchMap(t);
    setData(d);
    setStack([{ id: `__all_${m}`, label: ALL_LABEL[m], target: t }]);
    setLoading(false); busy.current = false;
  }, []);

  // initial view: focus from URL (?m=&t=&k=&k2=) if present, else films overview
  useEffect(() => {
    (async () => {
      const sp = new URLSearchParams(window.location.search);
      const m = sp.get("m"); const t = sp.get("t"); const k = sp.get("k"); const k2 = sp.get("k2");
      busy.current = true; setLoading(true);
      if (m === "galaxy") {
        setMode("galaxy"); modeRef.current = "galaxy";
        setLoading(false); busy.current = false;
        return;
      }
      if (k && m === "directors") {
        setMode("directors"); modeRef.current = "directors";
        const target: Target = { mode: "directors", key: k };
        const d = await fetchMap(target); setData(d);
        setStack([{ id: `dir:${k}`, label: k.replace(/-/g, " "), target }]);
      } else if (k && m === "films") {
        setMode("films"); modeRef.current = "films";
        const target: Target = { mode: "films", key: k };
        const d = await fetchMap(target); setData(d);
        setStack([{ id: `film:${k}`, label: k.replace(/-/g, " "), target }]);
      } else if (k && t) {
        setMode("critical"); modeRef.current = "critical";
        const target: Target = { mode: "critical", ego: { type: t, key: k, key2: k2 ?? undefined } };
        const d = await fetchMap(target); setData(d);
        setStack([{ id: `${t}:${k}`, label: k.replace(/-/g, " "), target }]);
      } else {
        const target: Target = { mode: "films", key: null, filt: {} };
        const d = await fetchMap(target); setData(d);
        setStack([{ id: "__all_films", label: "All films", target }]);
      }
      setLoading(false); busy.current = false;
    })();
  }, []);

  // debounced fuzzy search
  useEffect(() => {
    const t = query.trim();
    if (t.length < 2) { setHits([]); return; }
    const id = setTimeout(async () => {
      try { const r = await fetch(`/api/map/search?q=${encodeURIComponent(t)}`, { cache: "no-store" }); const j = await r.json(); setHits(Array.isArray(j) ? j : []); } catch { setHits([]); }
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  const center = data.nodes.find((n) => n.center) || null;

  const switchMode = useCallback((m: Mode) => {
    if (busy.current || m === modeRef.current) return;
    if (m === "galaxy") { setMode(m); setLoading(false); return; }  // galaxy fetches its own payload
    setMode(m); loadOverview(m, filt);
  }, [loadOverview, filt]);

  const applyFilters = useCallback(() => {
    if (modeRef.current !== "critical") loadOverview(modeRef.current, filt);
  }, [loadOverview, filt]);

  const goTarget = useCallback(async (target: Target, crumb: Crumb) => {
    busy.current = true; setLoading(true);
    const d = await fetchMap(target);
    if (d.nodes.length) setData((prev) => { setStack((s) => [...s, crumb]); return d; });
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
    } else { const slug = slugOf(node.id); if (!slug) return; target = { mode: m, key: slug }; }
    await goTarget(target, { id: node.id, label: node.label, target });
  }, [goTarget]);

  const goCrumb = useCallback(async (i: number) => {
    if (busy.current) return;
    busy.current = true; setLoading(true);
    const c = stack[i];
    const d = await fetchMap(c.target);
    setData(d); setStack((s) => s.slice(0, i + 1));
    setLoading(false); busy.current = false;
  }, [stack]);

  const openNode = useCallback((n: GraphNode) => { if (n.href) window.location.assign(n.href); }, []);

  // jump from a search hit → set the right mode and recenter the map on it
  const jumpTo = useCallback(async (hit: SearchHit) => {
    setQuery(""); setHits([]);
    let m: Mode; let target: Target;
    if (hit.type === "film") { m = "films"; target = { mode: "films", key: hit.key }; }
    else if (hit.type === "director") { m = "directors"; target = { mode: "directors", key: hit.key }; }
    else { m = "critical"; target = { mode: "critical", ego: { type: hit.type, key: hit.key, key2: hit.key2 ?? undefined } }; }
    setMode(m); modeRef.current = m;
    await goTarget(target, { id: `${hit.type}:${hit.key}`, label: hit.label, target });
  }, [goTarget]);

  const legend = mode === "galaxy"
    ? (<span className="map-hint">Every dot is one film, placed by its taste vector — colours are neighbourhoods. Scroll to zoom, drag to pan, click a dot to open the film.</span>)
    : mode === "films"
    ? (<><span><i style={{ background: "#3a3a3a" }} />Film</span><span className="map-ek"><b style={{ background: "#C8102E" }} />→ Watch next</span><span className="map-ek"><b style={{ background: "#1F6FB2" }} />→ Recommended by</span><span className="map-ek"><b style={{ background: "rgba(0,0,0,.28)" }} />Film like</span><span className="map-ek"><b style={{ background: "#E67E22" }} />⇄ Counterpoint</span></>)
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

      {(mode === "films" || mode === "directors") && (
        <div className="map-filters">
          <label>Year
            <select value={filt.yr ?? ""} onChange={(e) => setFilt({ ...filt, yr: e.target.value ? Number(e.target.value) : null })}>
              {YEARS.map((y) => <option key={String(y)} value={y ?? ""}>{y ? `from ${y}` : "Any"}</option>)}
            </select>
          </label>
          {mode === "films" && (
            <>
              <label>IMDb
                <select value={filt.imdb ?? ""} onChange={(e) => setFilt({ ...filt, imdb: e.target.value ? Number(e.target.value) : null })}>
                  {IMDBS.map((v) => <option key={String(v)} value={v ?? ""}>{v ? `${v}★+` : "Any"}</option>)}
                </select>
              </label>
              <label>Rotten Tomatoes
                <select value={filt.rt ?? ""} onChange={(e) => setFilt({ ...filt, rt: e.target.value ? Number(e.target.value) : null })}>
                  {RTS.map((v) => <option key={String(v)} value={v ?? ""}>{v ? `${v}%+` : "Any"}</option>)}
                </select>
              </label>
            </>
          )}
          <button className="map-apply" onClick={applyFilters}>Apply</button>
        </div>
      )}

      {mode !== "galaxy" && (
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
      )}

      {mode === "galaxy" ? (
        <div className="map-graphwrap">
          <GalaxyMap height={h} />
        </div>
      ) : (
      <div className="map-graphwrap">
        <div className="map-search">
          <input
            className="map-sinput"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the map — films, directors, ideas…"
            spellCheck={false}
          />
          {hits.length > 0 && (
            <div className="map-sresults">
              {hits.map((hit, i) => (
                <button key={hit.type + hit.key + i} className="map-shit" onClick={() => jumpTo(hit)}>
                  <span className={`map-stype map-stype--${hit.type}`}>{TYPE_LABEL[hit.type] || hit.type}</span>
                  <span className="map-slabel">{hit.label}</span>
                  {hit.sub ? <span className="map-ssub">{hit.sub}</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
        <EntityGraph data={data} height={h} onNodeClick={recenter} onOpen={openNode} className="map-canvas" />
      </div>
      )}

      <div className="map-legend">{legend}</div>
    </div>
  );
}
