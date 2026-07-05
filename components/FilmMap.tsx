"use client";

/**
 * FilmMap — the geographic "Atlas".
 *   • setting (red) — places a film is set in / names
 *   • filmed (teal) — real, sourced filming locations
 * Keyless MapLibre GL (CDN). Basemaps:
 *   • Map — Carto Voyager vector (crisp on retina, dense place-name labels)
 *   • Satellite — Esri World Imagery + the Voyager *vector label* layers on top
 *     (a Google-style hybrid: sharp text and many more names than raster overlays)
 * The map is created ONCE per mount; scope/focus/layer changes only update the
 * GeoJSON source and the camera, so toggles never rebuild or reset the view.
 * Side panel groups places by film (sortable, filterable, list/grid) and every
 * click in the panel moves the map: film → fit its pins, place → fly + card.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useLens } from "@/components/LensProvider";

type Row = {
  id: string; name: string; narrative_setting?: string | null; scene_role?: string | null;
  kind?: string | null; lat: number; lng: number; precision?: string | null; country?: string | null;
  layer?: string; built_set?: boolean | null; set_host?: string | null; tier?: string | null;
  sources?: string[] | null; fig_slug?: string | null; fig_label?: string | null; fig_desc?: string | null;
  film_slug?: string | null; film_title?: string | null; film_year?: number | null; poster_path?: string | null;
  film_places?: number | null; // total located places of the film (overview pins only)
};
type Sug = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null };
type SortKey = "inview" | "places" | "az" | "year";

// MapTiler (keyed) is preferred when NEXT_PUBLIC_MAPTILER_KEY is set: crisper 512px
// vector tiles, denser multilingual labels, and an official satellite-hybrid style.
// Without a key everything falls back to the keyless Carto/Esri stack below.
const MT_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";
const STYLE_CARTO = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const STYLE_MAP = MT_KEY ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MT_KEY}` : STYLE_CARTO;
const STYLE_SAT_MT = MT_KEY ? `https://api.maptiler.com/maps/hybrid/style.json?key=${MT_KEY}` : "";
const SAT_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SAT_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
// Raster fallback if the hybrid (vector labels over imagery) style can't be built.
const STYLE_SAT_FALLBACK = {
  version: 8,
  sources: {
    esri: { type: "raster", tiles: [SAT_TILE], tileSize: 256, maxzoom: 19, attribution: "© Esri, Maxar, Earthstar Geographics" },
    esriRef: { type: "raster", tiles: [SAT_LABELS], tileSize: 256, attribution: "© Esri" },
  },
  layers: [
    { id: "esri", type: "raster", source: "esri" },
    { id: "esriRef", type: "raster", source: "esriRef" },
  ],
};
const IMG = "https://image.tmdb.org/t/p/w92";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mlPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadMapLibre(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.maplibregl) return Promise.resolve(w.maplibregl);
  if (mlPromise) return mlPromise;
  mlPromise = new Promise((res, rej) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"; s.onload = () => res(w.maplibregl); s.onerror = rej; document.head.appendChild(s);
  });
  return mlPromise;
}

// Hybrid satellite: Esri imagery + Voyager's vector label/boundary layers restyled
// for a dark background — crisp retina text, far denser naming than raster refs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let hybridPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHybridStyle(): Promise<any> {
  if (hybridPromise) return hybridPromise;
  hybridPromise = fetch(STYLE_CARTO)
    .then((r) => r.json())
    .then((st) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const overlay = (st.layers as any[])
        .filter((l) => l.type === "symbol" || /admin|boundary/.test(l.id))
        .map((l) => {
          const paint = { ...(l.paint ?? {}) };
          if (l.type === "symbol") {
            paint["text-color"] = "#ffffff";
            paint["text-halo-color"] = "rgba(10,14,18,.85)";
            paint["text-halo-width"] = 1.3;
          } else {
            paint["line-color"] = "rgba(255,255,255,.55)";
          }
          return { ...l, paint };
        });
      return {
        version: 8, glyphs: st.glyphs, sprite: st.sprite,
        sources: {
          ...st.sources,
          esri: { type: "raster", tiles: [SAT_TILE], tileSize: 256, maxzoom: 19, attribution: "© Esri, Maxar, Earthstar Geographics" },
        },
        layers: [{ id: "esri", type: "raster", source: "esri" }, ...overlay],
      };
    })
    .catch(() => STYLE_SAT_FALLBACK);
  return hybridPromise;
}

// Small client cache so This film ↔ All films / repeated visits are instant.
const geoCache = new Map<string, Promise<Row[]>>();
function fetchGeo(url: string): Promise<Row[]> {
  if (!geoCache.has(url)) {
    geoCache.set(url, fetch(url)
      .then((r) => r.json())
      .then((j) => (Array.isArray(j) ? (j as Row[]) : []))
      .catch(() => { geoCache.delete(url); return []; }));
  }
  return geoCache.get(url)!;
}

const esc = (x: string) => (x || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
function roleOf(r: Row): string { return (r.scene_role || r.narrative_setting || (r.fig_desc ?? "")).toString(); }
function filmLabel(r: Row): string { return r.film_title ? `${r.film_title}${r.film_year ? ` (${r.film_year})` : ""}` : ""; }
function hrefFor(r: Row, filmSlug?: string): string | null {
  const fs = r.film_slug ?? filmSlug; if (!fs) return null;
  return r.fig_slug ? `/film/${fs}/figure/${r.fig_slug}` : `/film/${fs}`;
}

// Shared popup card (hover = compact, click = detailed).
function popupHTML(p: Record<string, string>, detailed: boolean): string {
  const film = p.film, filmed = p.layer === "filmed";
  const title = film || p.name;
  const sub = film ? p.name : "";
  const roleMax = detailed ? 300 : 150;
  const parts: string[] = [`<b style="font-size:12.5px;line-height:1.25;color:#1a1a1a;display:block">${esc(title)}</b>`];
  if (sub) parts.push(`<div style="color:#8a8278;font-size:11px;font-weight:600;margin-top:2px">${esc(sub)}</div>`);
  if (filmed) {
    const tag = p.built ? `Built set${p.host ? `: ${esc(p.host)}` : ""}` : "Filming location";
    parts.push(`<div style="color:#0F6E56;font-weight:700;font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;margin-top:5px">${tag}${p.tier ? ` · ${esc(p.tier)}` : ""}</div>`);
  }
  if (p.role) parts.push(`<div style="color:#55504a;font-size:11px;margin-top:4px;line-height:1.4">${esc(p.role.slice(0, roleMax))}${p.role.length > roleMax ? "…" : ""}</div>`);
  if (detailed) {
    const links: string[] = [];
    if (filmed && p.src) links.push(`<a href="${p.src}" target="_blank" rel="noopener" style="color:#0F6E56;font-weight:600;margin-right:12px">Source ↗</a>`);
    if (p.href) links.push(`<a href="${p.href}" style="color:#C8102E;font-weight:600">${filmed ? "Open the film ↗" : "Read this in the film ↗"}</a>`);
    if (links.length) parts.push(`<div style="margin-top:7px">${links.join("")}</div>`);
  }
  const poster = p.poster
    ? `<img src="${IMG}${p.poster}" alt="" style="width:46px;height:69px;object-fit:cover;border-radius:4px;flex:none;background:#eee" />`
    : "";
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;display:flex;gap:9px;align-items:flex-start">${poster}<div style="min-width:0;flex:1">${parts.join("")}</div></div>`;
}

export default function FilmMap({
  endpoint, height = 460, filmSlug, search = false, satelliteDefault = false, panelSide = "right",
}: { endpoint: string; height?: number; filmSlug?: string; search?: boolean; satelliteDefault?: boolean; panelSide?: "left" | "right" }) {
  const [primary, setPrimary] = useState<Row[] | null>(null);      // rows from `endpoint` (film/director pages)
  const [worldBase, setWorldBase] = useState<Row[] | null>(null);  // overview: one pin per film
  const [worldVer, setWorldVer] = useState(0);                     // bumped when viewport detail arrives
  const [focusRows, setFocusRows] = useState<Row[] | null>(null);  // richer rows for a searched/clicked film
  const [sat, setSat] = useState(satelliteDefault);
  const [active, setActive] = useState<string | null>(null);
  const [inView, setInView] = useState<Set<string> | null>(null);
  const [lf, setLf] = useState<"all" | "setting" | "filmed">("all");
  const [scope, setScope] = useState<"film" | "all">("film");      // film pages only
  const [focus, setFocus] = useState<{ slug: string; title: string } | null>(null);
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState<Sug[]>([]);
  const [sort, setSort] = useState<SortKey>("inview");
  const [view, setView] = useState<"list" | "grid">("list");
  const [pq, setPq] = useState("");                                // panel place/film filter
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mapReady, setMapReady] = useState(false);
  const [lang, setLang] = useState("en");                          // basemap label language (EN default)
  // Floating mini-player: the selected film's YouTube clip, autoplayed over the
  // map's bottom-left corner. Start time + mute toggle mirror the home "Surprise
  // me" hero, so you watch the film while browsing where it's set.
  const [clip, setClip] = useState<{ id: string; title: string; slug: string } | null>(null);
  const [clipHidden, setClipHidden] = useState(false);             // user closed THIS clip (a new film re-opens)
  const [clipMuted, setClipMuted] = useState(true);
  const [clipBig, setClipBig] = useState(false);                   // enlarged size (controls hidden until hover)

  const mapEl = useRef<HTMLDivElement>(null);
  const listEl = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ml = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const popup = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hoverPop = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fcRef = useRef<any>({ type: "FeatureCollection", features: [] });
  const rowsRef = useRef<Row[]>([]);
  const activeRef = useRef<string | null>(null);
  const didFit = useRef(false);
  const worldExtra = useRef<globalThis.Map<string, Row>>(new globalThis.Map());
  const worldBaseIds = useRef<Set<string>>(new Set());
  const worldOnRef = useRef(false);
  const langRef = useRef("en");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bboxTimer = useRef<any>(null);

  const globalish = !filmSlug || scope === "all";                  // panel shows many films
  const dimSlug = focus?.slug ?? (filmSlug && scope === "all" ? filmSlug : null);
  // My Films lens: applies to multi-film views (Atlas, director maps, world scope)
  // — never to a single film's own location map. only → pins filter down (cluster
  // counts stay honest); highlight → unseen pins fade.
  const lens = useLens();
  const lensMode = lens && globalish ? lens.mode : "off";
  const lensHi = lensMode === "highlight";
  const lensHiRef = useRef(false);
  const worldMode = !filmSlug && !endpoint.includes("?");          // the standalone Atlas
  const worldOn = worldMode || (!!filmSlug && scope === "all");    // world layer wanted
  worldOnRef.current = worldOn;

  // ---------- data ----------
  useEffect(() => {
    if (worldMode) return; // atlas loads via overview + viewport instead
    let alive = true;
    fetchGeo(endpoint).then((rs) => { if (alive) setPrimary(rs); });
    return () => { alive = false; };
  }, [endpoint, worldMode]);

  useEffect(() => {
    if (!worldOn) return;
    let alive = true;
    fetchGeo("/api/geo?mode=overview").then((rs) => { if (alive) setWorldBase(rs); });
    return () => { alive = false; };
  }, [worldOn]);

  useEffect(() => { worldBaseIds.current = new Set((worldBase ?? []).map((r) => r.id)); }, [worldBase]);

  const mergeWorld = useCallback((rs: Row[]) => {
    let added = 0;
    for (const r of rs) {
      if (!worldBaseIds.current.has(r.id) && !worldExtra.current.has(r.id)) { worldExtra.current.set(r.id, r); added++; }
    }
    if (added) setWorldVer((v) => v + 1);
  }, []);

  // viewport detail: after the camera settles, pull every pin inside the (snapped) bbox
  const requestBbox = useCallback(() => {
    if (!worldOnRef.current) return;
    const m = map.current; if (!m) return;
    clearTimeout(bboxTimer.current);
    bboxTimer.current = setTimeout(() => {
      try {
        const mm = map.current; if (!mm || !worldOnRef.current) return;
        const z = mm.getZoom(); if (z < 2.5) return; // world view = overview pins only
        const step = z >= 9 ? 0.25 : z >= 6.5 ? 1 : 4; // snap → repeatable URLs → CDN/browser cache hits
        const b = mm.getBounds();
        const w = Math.floor(b.getWest() / step) * step;
        const e = Math.ceil(b.getEast() / step) * step;
        const s = Math.max(-85, Math.floor(b.getSouth() / step) * step);
        const n = Math.min(85, Math.ceil(b.getNorth() / step) * step);
        fetchGeo(`/api/geo?bbox=${w},${s},${e},${n}`).then(mergeWorld);
      } catch {}
    }, 350);
  }, [mergeWorld]);

  useEffect(() => { if (worldOn) requestBbox(); }, [worldOn, requestBbox]);

  useEffect(() => {
    if (!focus) { setFocusRows(null); return; }
    let alive = true;
    fetchGeo(`/api/geo?film=${focus.slug}`).then((rs) => { if (alive) setFocusRows(rs); });
    return () => { alive = false; };
  }, [focus]);

  // Selected film → its clip for the floating mini-player. Each new film reveals
  // the player again (a prior close only hid the film you'd since moved off).
  useEffect(() => {
    if (!focus) { setClip(null); return; }
    let alive = true;
    setClipHidden(false);
    const { slug, title } = focus;
    fetch(`/api/film-clip?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setClip(j?.clip ? { id: j.clip as string, title, slug } : null); })
      .catch(() => { if (alive) setClip(null); });
    return () => { alive = false; };
  }, [focus]);

  const worldAll = useMemo(() => {
    if (!worldOn || !worldBase) return null;
    const m = new globalThis.Map<string, Row>();
    worldBase.forEach((r) => m.set(r.id, r));
    worldExtra.current.forEach((r, id) => { if (!m.has(id)) m.set(id, r); });
    return [...m.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldOn, worldBase, worldVer]);

  const combined = useMemo(() => {
    let base = primary ?? [];
    if (worldAll) {
      const ids = new Set(base.map((r) => r.id));
      base = [...base, ...worldAll.filter((r) => !ids.has(r.id))];
    }
    if (focus && focusRows) {
      const ids = new Set(focusRows.map((r) => r.id));
      base = [...base.filter((r) => !ids.has(r.id)), ...focusRows];
    }
    return base;
  }, [primary, worldAll, focusRows, focus]);

  const hasFilmed = useMemo(() => combined.some((r) => r.layer === "filmed"), [combined]);
  const hasSetting = useMemo(() => combined.some((r) => (r.layer ?? "setting") === "setting"), [combined]);
  const layerRows = useMemo(() => {
    const base = combined.filter((r) => lf === "all" || (r.layer ?? "setting") === lf);
    if (lensMode !== "only" || !lens) return base;
    return base.filter((r) => { const s = r.film_slug ?? filmSlug; return !!s && lens.seen(s); });
  }, [combined, lf, lensMode, lens, filmSlug]);

  // film search typeahead
  useEffect(() => {
    if (!search) return;
    if (q.trim().length < 2) { setSugs([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const { data } = await sb.rpc("film_search", { p_q: q.trim(), p_limit: 8 });
      if (alive) setSugs((data as Sug[] | null) ?? []);
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [q, search]);

  // Basemap label language: rewrite every name-bearing symbol layer to the chosen
  // language (vector tiles carry name:en / name:ko / … per feature), falling back
  // to English and then the local name when a translation is missing.
  const applyLang = useCallback(() => {
    const m = map.current; if (!m) return;
    const lg = langRef.current;
    const field = lg === "local"
      ? ["coalesce", ["get", "name"], ["get", "name:en"]]
      : ["coalesce", ["get", `name:${lg}`], ["get", "name:en"], ["get", "name"]];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const l of (m.getStyle().layers ?? []) as any[]) {
        if (l.type !== "symbol" || l.id === "cluster-count") continue;
        let tf: unknown;
        try { tf = m.getLayoutProperty(l.id, "text-field"); } catch { continue; }
        if (!tf || !JSON.stringify(tf).includes("name")) continue; // skip refs, house numbers, …
        try { m.setLayoutProperty(l.id, "text-field", field); } catch {}
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { const saved = localStorage.getItem("mt-atlas-lang"); if (saved) setLang(saved); } catch {}
  }, []);
  useEffect(() => {
    langRef.current = lang;
    try { localStorage.setItem("mt-atlas-lang", lang); } catch {}
    applyLang();
  }, [lang, applyLang]);

  // ---------- map (created once) ----------
  const fcOf = useCallback((rs: Row[]) => ({
    type: "FeatureCollection",
    features: rs.map((r) => ({
      type: "Feature", geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, href: hrefFor(r, filmSlug ?? focus?.slug ?? undefined) ?? "", layer: r.layer ?? "setting",
        mine: dimSlug ? ((r.film_slug ?? filmSlug) === dimSlug ? "1" : "") : "1",
        seen: lensMode !== "off" && lens?.seen(r.film_slug ?? filmSlug) ? "1" : "",
        role: roleOf(r).slice(0, 300), film: filmLabel(r), poster: r.poster_path ?? "",
        tier: r.tier ?? "", built: r.built_set ? "1" : "", host: r.set_host ?? "", src: (r.sources && r.sources[0]) || "",
      },
    })),
  }), [dimSlug, filmSlug, focus, lensMode, lens]);

  // pin opacity honours the lens; a ref-driven expression so addPoints re-applies
  // it after basemap style swaps (which rebuild the layers with fresh paint)
  const lensOpacityExpr = useCallback(() => (
    lensHiRef.current
      ? ["case", ["!=", ["get", "mine"], "1"], 0.4, ["==", ["get", "seen"], "1"], 1, 0.3]
      : ["case", ["==", ["get", "mine"], "1"], 1, 0.55]
  ), []);

  useEffect(() => {
    lensHiRef.current = lensHi;
    const m = map.current; if (!m) return;
    try { m.setPaintProperty("pt", "circle-opacity", lensOpacityExpr()); } catch {}
  }, [lensHi, mapReady, lensOpacityExpr]);

  useEffect(() => {
    if (!mapEl.current) return;
    let alive = true;
    loadMapLibre().then((mll) => {
      if (!alive || !mapEl.current || map.current) return;
      ml.current = mll;
      const m = new mll.Map({
        container: mapEl.current, style: STYLE_MAP, attributionControl: true,
        center: [12, 25], zoom: 1.4,
      });
      map.current = m;
      m.addControl(new mll.NavigationControl({ showCompass: false }), "top-right");
      if (mll.FullscreenControl) m.addControl(new mll.FullscreenControl(), "top-right");
      m.on("error", () => {});
      const applySat = () => {
        if (STYLE_SAT_MT) { try { m.setStyle(STYLE_SAT_MT); } catch {} }
        else buildHybridStyle().then((st) => { try { if (alive) m.setStyle(st); } catch {} });
      };
      if (satelliteDefault) applySat();

      // Denser naming: surface place/POI labels ~1.5 zoom levels earlier and admit
      // lower-ranked names (basemap styles hide most labels behind rank filters).
      // Runs once per style load, so re-styling (map ↔ satellite) re-applies it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loosenRank = (f: any): any => {
        let changed = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const walk = (n: any): any => {
          if (!Array.isArray(n)) return n;
          const [op, a, b] = n;
          const isRank = a === "rank" || (Array.isArray(a) && a[0] === "get" && a[1] === "rank");
          if ((op === "<=" || op === "<") && isRank && typeof b === "number") { changed = true; return [op, a, b * 2 + 6]; }
          return n.map(walk);
        };
        const out = walk(f);
        return changed ? out : null;
      };
      const densify = () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const l of (m.getStyle().layers ?? []) as any[]) {
            if (l.type !== "symbol" || l.id === "cluster-count") continue;
            if (!/place|poi|label|housenum|station|town|village|city|suburb/i.test(l.id)) continue;
            if (typeof l.minzoom === "number") { try { m.setLayerZoomRange(l.id, Math.max(2, l.minzoom - 1.5), l.maxzoom ?? 24); } catch {} }
            try { const lf = loosenRank(m.getFilter(l.id)); if (lf) m.setFilter(l.id, lf); } catch {}
          }
        } catch {}
      };
      // Re-tune whenever the active style actually changes. setStyle() may apply a
      // DIFF without ever firing "style.load", so we key off a style signature and
      // check on every style/idle event instead.
      let tuned = "";
      const tune = () => {
        try {
          const st = m.getStyle(); if (!st) return;
          const sig = st.name ?? Object.keys(st.sources ?? {}).join(",");
          if (sig === tuned || !m.isStyleLoaded()) return;
          tuned = sig;
          densify();
          applyLang();
        } catch {}
      };
      m.on("style.load", tune);
      m.on("styledata", tune);
      m.on("idle", tune);

      // cluster-count text needs a font that exists on the active glyph server —
      // borrow the first font stack the current style itself uses.
      const fontOf = (): string[] => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const l of (m.getStyle().layers ?? []) as any[]) {
            const f = l.layout?.["text-font"];
            if (Array.isArray(f) && f.length && f.every((x: unknown) => typeof x === "string")) return f as string[];
          }
        } catch {}
        return ["Noto Sans Regular"];
      };

      const addPoints = () => {
        if (!m.getStyle() || m.getSource("pts")) return;
        try {
          m.addSource("pts", { type: "geojson", data: fcRef.current, cluster: true, clusterRadius: 44, clusterMaxZoom: 11 });
          m.addLayer({ id: "clusters", type: "circle", source: "pts", filter: ["has", "point_count"], paint: { "circle-color": "#C8102E", "circle-opacity": 0.85, "circle-radius": ["step", ["get", "point_count"], 15, 10, 20, 30, 26], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
          // count labels need glyphs — may be absent in the raster fallback style, so keep separate
          try { m.addLayer({ id: "cluster-count", type: "symbol", source: "pts", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11, "text-font": fontOf(), "text-allow-overlap": true }, paint: { "text-color": "#ffffff" } }); } catch {}
          m.addLayer({
            id: "pt", type: "circle", source: "pts", filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": ["match", ["get", "layer"], "filmed", "#0F6E56", "#C8102E"],
              "circle-radius": ["case", ["==", ["get", "id"], activeRef.current ?? ""], 10, ["==", ["get", "mine"], "1"], 7, 5.5],
              "circle-opacity": lensOpacityExpr(),
              "circle-stroke-color": "#fff",
              "circle-stroke-width": ["case", ["==", ["get", "id"], activeRef.current ?? ""], 2.4, 1.6],
            },
          });
        } catch { /* style mid-swap */ }
      };
      const updateInView = () => {
        try {
          const b = m.getBounds(); const w = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth();
          setInView(new Set(rowsRef.current.filter((r) => r.lat >= s && r.lat <= n && (e >= w ? (r.lng >= w && r.lng <= e) : (r.lng >= w || r.lng <= e))).map((r) => r.id)));
        } catch {}
      };

      m.on("load", () => { addPoints(); updateInView(); setMapReady(true); });
      m.on("styledata", addPoints);
      m.on("moveend", () => { updateInView(); requestBbox(); });

      m.on("click", "clusters", (ev: { features?: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }[] }) => {
        const f = ev.features?.[0]; if (!f) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m.getSource("pts") as any).getClusterExpansionZoom(f.properties.cluster_id, (_e: unknown, zoom: number) => m.easeTo({ center: f.geometry.coordinates, zoom: zoom ?? m.getZoom() + 2 }));
      });

      m.on("mousemove", "pt", (ev: { features?: { properties: Record<string, string>; geometry: { coordinates: number[] } }[] }) => {
        const f = ev.features?.[0]; if (!f) return;
        m.getCanvas().style.cursor = "pointer";
        hoverPop.current?.remove();
        hoverPop.current = new mll.Popup({ closeButton: false, closeOnClick: false, offset: 14, maxWidth: "270px" })
          .setLngLat(f.geometry.coordinates as number[]).setHTML(popupHTML(f.properties, false)).addTo(m);
      });
      m.on("mouseleave", "pt", () => { m.getCanvas().style.cursor = ""; hoverPop.current?.remove(); hoverPop.current = null; });
      m.on("mouseenter", "clusters", () => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave", "clusters", () => { m.getCanvas().style.cursor = ""; });

      m.on("click", "pt", (ev: { features?: { properties: Record<string, string>; geometry: { coordinates: number[] } }[] }) => {
        const f = ev.features?.[0]; if (!f) return;
        setActive(f.properties.id);
        hoverPop.current?.remove();
        popup.current?.remove();
        popup.current = new mll.Popup({ closeButton: true, offset: 14, maxWidth: "300px" }).setLngLat(f.geometry.coordinates as number[]).setHTML(popupHTML(f.properties, true)).addTo(m);
      });
    }).catch(() => {});
    return () => { alive = false; try { map.current?.remove(); } catch {} map.current = null; setMapReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // data → source (no map rebuild)
  useEffect(() => {
    rowsRef.current = layerRows;
    fcRef.current = fcOf(layerRows);
    const m = map.current; if (!m) return;
    try { const s = m.getSource("pts"); if (s) s.setData(fcRef.current); } catch {}
    try { m.fire("moveend"); } catch {} // refresh the "in view" set for the panel
  }, [layerRows, fcOf]);

  // active pin emphasis
  useEffect(() => {
    activeRef.current = active;
    const m = map.current; if (!m) return;
    try {
      m.setPaintProperty("pt", "circle-radius", ["case", ["==", ["get", "id"], active ?? ""], 10, ["==", ["get", "mine"], "1"], 7, 5.5]);
      m.setPaintProperty("pt", "circle-stroke-width", ["case", ["==", ["get", "id"], active ?? ""], 2.4, 1.6]);
    } catch {}
  }, [active]);

  // basemap toggle
  useEffect(() => {
    const m = map.current; if (!m) return;
    if (sat) {
      if (STYLE_SAT_MT) { try { m.setStyle(STYLE_SAT_MT); } catch {} }
      else buildHybridStyle().then((st) => { try { m.setStyle(st); } catch {} });
    } else { try { m.setStyle(STYLE_MAP); } catch {} }
  }, [sat]);

  // ---------- camera ----------
  const fitRows = useCallback((rs: Row[], maxZoom = 9) => {
    const m = map.current, mll = ml.current; if (!m || !mll || rs.length === 0) return;
    try {
      const b = new mll.LngLatBounds();
      rs.forEach((r) => b.extend([r.lng, r.lat]));
      m.fitBounds(b, { padding: 64, maxZoom, duration: didFit.current ? 800 : 0 });
    } catch {}
  }, []);

  // initial fit once both map and data are ready
  const fitBase = primary ?? worldAll;
  useEffect(() => {
    if (!mapReady || didFit.current || !fitBase || fitBase.length === 0) return;
    fitRows(fitBase);
    didFit.current = true;
    requestBbox();
  }, [mapReady, fitBase, fitRows, requestBbox]);

  const fitFilm = useCallback((slug: string) => {
    const rs = rowsRef.current.filter((r) => (r.film_slug ?? filmSlug) === slug);
    fitRows(rs.length ? rs : rowsRef.current, 11);
  }, [fitRows, filmSlug]);

  // Focus = selected film. Panel clicks select WITHOUT moving the camera (the user
  // keeps their region); only search picks and the explicit ⌖ buttons re-frame.
  const fitOnFocus = useRef(false);
  useEffect(() => {
    if (!mapReady || !focus || !fitOnFocus.current) return;
    fitFilm(focus.slug);
    if (focusRows) fitOnFocus.current = false; // refit once the film's full rows land, then stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, focusRows, mapReady]);

  // scope back to "film" → re-frame this film; to "all" → keep the camera where it is
  const prevScope = useRef(scope);
  useEffect(() => {
    if (prevScope.current !== scope && scope === "film" && filmSlug) fitFilm(filmSlug);
    prevScope.current = scope;
  }, [scope, filmSlug, fitFilm]);

  // ---------- panel actions ----------
  const openDetail = useCallback((r: Row) => {
    const m = map.current, mll = ml.current; if (!m || !mll) return;
    const props: Record<string, string> = {
      id: r.id, name: r.name, layer: r.layer ?? "setting", role: roleOf(r).slice(0, 300), film: filmLabel(r),
      tier: r.tier ?? "", built: r.built_set ? "1" : "", host: r.set_host ?? "", src: (r.sources && r.sources[0]) || "",
      href: hrefFor(r, filmSlug ?? focus?.slug ?? undefined) ?? "", poster: r.poster_path ?? "",
    };
    hoverPop.current?.remove();
    popup.current?.remove();
    popup.current = new mll.Popup({ closeButton: true, offset: 14, maxWidth: "300px" }).setLngLat([r.lng, r.lat]).setHTML(popupHTML(props, true)).addTo(m);
  }, [filmSlug, focus]);

  const flyTo = useCallback((r: Row) => {
    setActive(r.id);
    const m = map.current; if (!m) return;
    m.flyTo({ center: [r.lng, r.lat], zoom: Math.max(m.getZoom(), 11), duration: 700 });
    openDetail(r);
  }, [openDetail]);

  const focusFilm = useCallback((slug: string, title: string, fit = false) => {
    fitOnFocus.current = fit;
    setFocus({ slug, title });
    setExpanded((s) => new Set(s).add(slug));
    setView("list");
  }, []);

  // load a film's full pins into the map without touching the camera
  const loadFilm = useCallback((slug: string) => {
    fetchGeo(`/api/geo?film=${slug}`).then(mergeWorld);
  }, [mergeWorld]);

  // the explicit "⌖" action: frame ALL of the film's places
  const fitWholeFilm = useCallback((slug: string) => {
    fetchGeo(`/api/geo?film=${slug}`).then((rs) => {
      mergeWorld(rs);
      if (rs.length) fitRows(rs, 11); else fitFilm(slug);
    });
  }, [mergeWorld, fitRows, fitFilm]);

  // pin click → reveal + scroll the matching panel row
  useEffect(() => {
    if (!active) return;
    const r = combined.find((x) => x.id === active);
    if (r?.film_slug) setExpanded((s) => (s.has(r.film_slug!) ? s : new Set(s).add(r.film_slug!)));
    const t = setTimeout(() => {
      listEl.current?.querySelector(`[data-id="${CSS.escape(active)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [active, combined]);

  // ---------- panel data ----------
  const pql = pq.trim().toLowerCase();
  const matches = useCallback((r: Row) =>
    !pql || r.name.toLowerCase().includes(pql) || (r.film_title ?? "").toLowerCase().includes(pql) || (r.country ?? "").toLowerCase().includes(pql), [pql]);

  type Group = { slug: string; title: string; year: number | null; poster: string | null; rows: Row[]; inViewCount: number; total: number };
  const groups = useMemo<Group[]>(() => {
    if (!globalish) return [];
    const by = new Map<string, Group>();
    for (const r of layerRows) {
      if (!matches(r)) continue;
      const slug = r.film_slug ?? "—";
      let g = by.get(slug);
      if (!g) { g = { slug, title: r.film_title ?? r.name, year: r.film_year ?? null, poster: r.poster_path ?? null, rows: [], inViewCount: 0, total: 0 }; by.set(slug, g); }
      g.rows.push(r);
      if (r.film_places && r.film_places > g.total) g.total = r.film_places;
      if (!inView || inView.has(r.id)) g.inViewCount++;
    }
    let gs = [...by.values()];
    gs.forEach((g) => { if (g.rows.length > g.total) g.total = g.rows.length; });
    if (sort === "inview") gs = gs.filter((g) => g.inViewCount > 0).sort((a, b) => b.inViewCount - a.inViewCount || b.total - a.total);
    else if (sort === "places") gs.sort((a, b) => b.total - a.total);
    else if (sort === "az") gs.sort((a, b) => a.title.localeCompare(b.title));
    else gs.sort((a, b) => (b.year ?? -1) - (a.year ?? -1));
    const top = focus?.slug ?? filmSlug;
    if (top) gs.sort((a, b) => (a.slug === top ? -1 : 0) - (b.slug === top ? -1 : 0));
    return gs;
  }, [globalish, layerRows, matches, inView, sort, focus, filmSlug]);

  const flatRows = useMemo(() => {
    if (globalish) return [];
    let rs = layerRows.filter(matches);
    if (sort === "inview" && inView) rs = rs.filter((r) => inView.has(r.id));
    return rs;
  }, [globalish, layerRows, matches, sort, inView]);

  const filmCount = useMemo(() => new Set(layerRows.map((r) => r.film_slug ?? "—")).size, [layerRows]);
  const loading = worldMode ? worldBase === null : primary === null;
  const worldLoading = !!(filmSlug && scope === "all" && worldBase === null);

  if (primary && primary.length === 0 && filmSlug && scope === "film") return null;

  const placeRow = (r: Row, showFilm: boolean) => {
    const href = hrefFor(r, filmSlug ?? focus?.slug ?? undefined);
    const role = roleOf(r);
    return (
      <li key={r.id} data-id={r.id} className={`fmap-li${active === r.id ? " on" : ""}`} onClick={() => flyTo(r)}>
        <span className={`fmap-dot ${r.layer === "filmed" ? "fmap-dot--f" : "fmap-dot--s"}`} />
        <div className="fmap-li__tx">
          <span className="fmap-li__ttl">{r.name}</span>
          {showFilm && filmLabel(r) ? <span className="fmap-li__place">{filmLabel(r)}</span> : null}
          {role ? <span className="fmap-li__role">{role}</span> : null}
          {href ? <a className="fmap-li__open" href={href} onClick={(e) => e.stopPropagation()}>Read in the film →</a> : null}
        </div>
      </li>
    );
  };

  // youtube-nocookie embed identical to the home hero: muted autoplay, looping,
  // seeked to the 7s mark, chrome stripped. Re-keyed on mute so the toggle takes.
  const clipSrc = clip
    ? `https://www.youtube-nocookie.com/embed/${clip.id}?autoplay=1&mute=${clipMuted ? 1 : 0}&controls=0&loop=1&playlist=${clip.id}&start=7&playsinline=1&modestbranding=1&rel=0`
    : null;
  const clipOpen = !!clipSrc && !clipHidden;

  return (
    <div className="fmap">
      <link rel="preconnect" href={MT_KEY ? "https://api.maptiler.com" : "https://basemaps.cartocdn.com"} />
      <link rel="preconnect" href="https://unpkg.com" />
      <div className="fmap-head">
        {search ? (
          <div className="fmap-search">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={focus ? "Search another film…" : "Search a film → frame it on the map…"} />
            {sugs.length ? (
              <div className="fmap-sug">
                {sugs.map((s) => (
                  <button key={s.slug} type="button" className="fmap-sug__i" onClick={() => { focusFilm(s.slug, s.title, true); setQ(""); setSugs([]); }}>
                    {s.poster_path ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`${IMG}${s.poster_path}`} alt="" /> : <span className="fmap-sug__e" />}
                    <span className="fmap-sug__t">{s.title} <i>({s.year ?? "?"}{s.director ? `, ${s.director}` : ""})</i></span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="fmap-hint">{loading ? "Loading the map…" : `${layerRows.length.toLocaleString()} place${layerRows.length !== 1 ? "s" : ""} loaded${globalish ? ` · ${filmCount.toLocaleString()} films` : ""}${worldOn ? " · zoom in for more" : ""}`}</span>
        )}
        <div className="fmap-ctrls">
          {focus ? (
            <span className="fmap-focus">
              <b>{focus.title}</b>
              <button onClick={() => fitWholeFilm(focus.slug)} title="Zoom to all its places" aria-label={`Zoom to all places of ${focus.title}`}>⌖</button>
              <button onClick={() => { setFocus(null); setActive(null); }} title="Clear selection" aria-label="Clear selection">✕</button>
            </span>
          ) : null}
          {filmSlug ? (
            <span className="fmap-seg">
              <button className={scope === "film" ? "on" : ""} onClick={() => setScope("film")}>This film</button>
              <button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>+ All films{worldLoading ? "…" : ""}</button>
            </span>
          ) : null}
          {hasFilmed && hasSetting ? (
            <span className="fmap-seg">
              <button className={lf === "all" ? "on" : ""} onClick={() => setLf("all")}>All</button>
              <button className={lf === "setting" ? "on" : ""} onClick={() => setLf("setting")}><i className="fmap-dot fmap-dot--s" />Set in</button>
              <button className={lf === "filmed" ? "on" : ""} onClick={() => setLf("filmed")}><i className="fmap-dot fmap-dot--f" />Filmed at</button>
            </span>
          ) : null}
          <select className="fmap-sort fmap-lang" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Map label language" title="Map label language">
            <option value="en">Labels · English</option>
            <option value="ko">한국어</option>
            <option value="local">Local names</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="es">Español</option>
          </select>
          <button type="button" className="fmap-sat" onClick={() => setSat((v) => !v)}>{sat ? "Map" : "Satellite"}</button>
        </div>
      </div>
      <div className={`fmap-body${panelSide === "left" ? " fmap-body--left" : ""}`}>
        <div className="fmap-stage">
          <div className="fmap-canvas" ref={mapEl} style={{ height }} />
          {clipOpen ? (
            <div className={`fmap-float${clipBig ? " fmap-float--big" : ""}`} role="dialog" aria-label={`Now playing: ${clip!.title}`}>
              <div className="fmap-float__frame">
                <iframe
                  key={`${clip!.id}-${clipMuted ? "m" : "s"}`}
                  src={clipSrc!}
                  title={clip!.title}
                  allow="autoplay; encrypted-media; picture-in-picture"
                />
                {/* controls stay hidden until hover/focus — the default is just the video */}
                <div className="fmap-float__ov">
                  <a className="fmap-float__ttl" href={`/film/${clip!.slug}`} title={clip!.title}>{clip!.title}</a>
                  <span className="fmap-float__sp" />
                  <button type="button" className={`fmap-float__btn${clipMuted ? "" : " on"}`} onClick={() => setClipMuted((v) => !v)} aria-label={clipMuted ? "Unmute" : "Mute"}>{clipMuted ? "🔇" : "🔊"}</button>
                  <button type="button" className="fmap-float__btn" onClick={() => setClipBig((v) => !v)} aria-label={clipBig ? "Shrink video" : "Enlarge video"} title={clipBig ? "Shrink" : "Enlarge"}>{clipBig ? "⤡" : "⤢"}</button>
                  <button type="button" className="fmap-float__btn" onClick={() => setClipHidden(true)} aria-label="Close video">✕</button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="fmap-side" ref={listEl} style={{ maxHeight: height }}>
          <div className="fmap-tools">
            <input className="fmap-filter" value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Filter places…" aria-label="Filter places" />
            {globalish ? (
              <select className="fmap-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
                <option value="inview">In view</option>
                <option value="places">Most places</option>
                <option value="az">Title A–Z</option>
                <option value="year">Newest</option>
              </select>
            ) : (
              <span className="fmap-seg">
                <button className={sort === "inview" ? "on" : ""} onClick={() => setSort("inview")}>In view</button>
                <button className={sort !== "inview" ? "on" : ""} onClick={() => setSort("places")}>All</button>
              </span>
            )}
            {globalish ? (
              <span className="fmap-seg fmap-view">
                <button className={view === "list" ? "on" : ""} onClick={() => setView("list")} aria-label="List view">☰</button>
                <button className={view === "grid" ? "on" : ""} onClick={() => setView("grid")} aria-label="Poster grid">▦</button>
              </span>
            ) : null}
          </div>
          {loading ? (
            <div className="fmap-empty">Loading places…</div>
          ) : globalish ? (
            view === "grid" ? (
              <div className="fmap-grid">
                {groups.map((g) => (
                  <button key={g.slug} type="button" className={`fmap-card${(focus?.slug ?? filmSlug) === g.slug ? " on" : ""}`} onClick={() => { if (worldOn) loadFilm(g.slug); focusFilm(g.slug, g.title); }} title={`${g.title} — ${g.total} places`}>
                    {g.poster ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`${IMG}${g.poster}`} alt={g.title} loading="lazy" /> : <span className="fmap-card__e">{g.title}</span>}
                    <span className="fmap-badge">{g.total}</span>
                  </button>
                ))}
                {groups.length === 0 ? <div className="fmap-empty">No films here — move the map or clear the filter.</div> : null}
              </div>
            ) : (
              <ul className="fmap-list">
                {groups.map((g) => {
                  const open = expanded.has(g.slug);
                  const mine = (focus?.slug ?? filmSlug) === g.slug;
                  return (
                    <li key={g.slug} className={`fmap-grp${mine ? " fmap-grp--mine" : ""}`}>
                      <div className="fmap-grp__hd" role="button" tabIndex={0}
                        onClick={() => {
                          setExpanded((s) => { const n = new Set(s); if (n.has(g.slug)) n.delete(g.slug); else n.add(g.slug); return n; });
                          if (!open && g.slug !== "—") {
                            if (worldOn) loadFilm(g.slug); // pins appear in place — the camera stays put
                            focusFilm(g.slug, g.title, false);
                          }
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") (e.currentTarget as HTMLElement).click(); }}>
                        {g.poster ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="fmap-grp__thumb" src={`${IMG}${g.poster}`} alt="" loading="lazy" /> : <span className="fmap-grp__thumb fmap-grp__thumb--e" />}
                        <span className="fmap-grp__tx">
                          <span className="fmap-grp__ttl">{g.title}{g.year ? <i> ({g.year})</i> : null}</span>
                          <span className="fmap-grp__meta">{g.total} place{g.total !== 1 ? "s" : ""}{sort === "inview" && g.inViewCount !== g.total ? ` · ${g.inViewCount} in view` : ""}</span>
                        </span>
                        {g.slug !== "—" ? (
                          <button type="button" className="fmap-grp__fit" title="Zoom to all its places" aria-label={`Zoom to all places of ${g.title}`}
                            onClick={(e) => { e.stopPropagation(); fitWholeFilm(g.slug); }}>⌖</button>
                        ) : null}
                        <span className={`fmap-grp__car${open ? " open" : ""}`}>›</span>
                      </div>
                      {open ? <ul className="fmap-list fmap-list--sub">{g.rows.map((r) => placeRow(r, false))}</ul> : null}
                    </li>
                  );
                })}
                {groups.length === 0 ? <li className="fmap-empty">No films here — move the map or clear the filter.</li> : null}
              </ul>
            )
          ) : (
            <ul className="fmap-list">
              {flatRows.map((r) => placeRow(r, false))}
              {flatRows.length === 0 ? <li className="fmap-empty">No places here — move the map or clear the filter.</li> : null}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
