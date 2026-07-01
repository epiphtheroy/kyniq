"use client";

/**
 * FilmMap — the geographic "Atlas".
 *   • setting (red) — places a film is set in / names
 *   • filmed (teal) — real, sourced filming locations
 * Keyless MapLibre GL (CDN) + OpenFreeMap vector ↔ Esri satellite.
 * Right-hand panel is film-centric (poster + big film title + place + role).
 * Pins show a popup on hover (no click needed); click opens the detailed card.
 * `search` shows a film search box that jumps to a film's page.
 * On a film page, a "This film / All films" toggle overlays the whole Atlas.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Row = {
  id: string; name: string; narrative_setting?: string | null; scene_role?: string | null;
  kind?: string | null; lat: number; lng: number; precision?: string | null; country?: string | null;
  layer?: string; built_set?: boolean | null; set_host?: string | null; tier?: string | null;
  sources?: string[] | null; fig_slug?: string | null; fig_label?: string | null; fig_desc?: string | null;
  film_slug?: string | null; film_title?: string | null; film_year?: number | null; poster_path?: string | null;
};
type Sug = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null };

const STYLE_MAP = "https://tiles.openfreemap.org/styles/liberty";
const SAT_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const STYLE_SAT = { version: 8, sources: { esri: { type: "raster", tiles: [SAT_TILE], tileSize: 256, attribution: "© Esri" } }, layers: [{ id: "esri", type: "raster", source: "esri" }] };
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

const esc = (x: string) => (x || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
function roleOf(r: Row): string { return (r.scene_role || r.narrative_setting || (r.fig_desc ?? "")).toString(); }
function filmLabel(r: Row): string { return r.film_title ? `${r.film_title}${r.film_year ? ` (${r.film_year})` : ""}` : ""; }
function hrefFor(r: Row, filmSlug?: string): string | null {
  const fs = r.film_slug ?? filmSlug; if (!fs) return null;
  return r.fig_slug ? `/film/${fs}/figure/${r.fig_slug}` : `/film/${fs}`;
}

export default function FilmMap({
  endpoint, height = 460, filmSlug, search = false, satelliteDefault = false,
}: { endpoint: string; height?: number; filmSlug?: string; search?: boolean; satelliteDefault?: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sat, setSat] = useState(satelliteDefault);
  const [active, setActive] = useState<string | null>(null);
  const [inView, setInView] = useState<Set<string> | null>(null);
  const [lf, setLf] = useState<"all" | "setting" | "filmed">("all");
  const [scope, setScope] = useState<"film" | "all">("film"); // film pages only
  const [focus, setFocus] = useState<{ slug: string; title: string } | null>(null); // atlas: search-focused film
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState<Sug[]>([]);
  const mapEl = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const popup = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hoverPop = useRef<any>(null);

  const effFilm = filmSlug ?? focus?.slug ?? undefined;   // the film currently framed
  const globalMode = !effFilm || (!!filmSlug && scope === "all");
  const effEndpoint = focus ? `/api/geo?film=${focus.slug}`
    : filmSlug && scope === "all" ? "/api/geo"
    : endpoint;

  useEffect(() => {
    let alive = true;
    setRows(null);
    (async () => { try { const r = await fetch(effEndpoint, { cache: "no-store" }); const j = await r.json(); if (alive) setRows(Array.isArray(j) ? j : []); } catch { if (alive) setRows([]); } })();
    return () => { alive = false; };
  }, [effEndpoint]);

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

  const hasFilmed = useMemo(() => (rows ?? []).some((r) => r.layer === "filmed"), [rows]);
  const hasSetting = useMemo(() => (rows ?? []).some((r) => (r.layer ?? "setting") === "setting"), [rows]);
  const layerRows = useMemo(() => (rows ?? []).filter((r) => lf === "all" || (r.layer ?? "setting") === lf), [rows, lf]);
  const isMine = (r: Row) => !!(filmSlug && (r.film_slug ?? filmSlug) === filmSlug);

  const fcOf = (rs: Row[]) => ({
    type: "FeatureCollection",
    features: rs.map((r) => ({
      type: "Feature", geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, href: hrefFor(r, effFilm) ?? "", layer: r.layer ?? "setting",
        mine: filmSlug && scope === "all" ? (isMine(r) ? "1" : "") : "1",
        role: roleOf(r).slice(0, 300), film: filmLabel(r),
        tier: r.tier ?? "", built: r.built_set ? "1" : "", host: r.set_host ?? "", src: (r.sources && r.sources[0]) || "",
      },
    })),
  });

  useEffect(() => {
    if (!rows || rows.length === 0 || !mapEl.current) return;
    let alive = true;
    loadMapLibre().then((ml) => {
      if (!alive || !mapEl.current) return;
      const m = new ml.Map({ container: mapEl.current, style: sat ? STYLE_SAT : STYLE_MAP, attributionControl: true });
      map.current = m;
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      m.on("error", () => {});

      const addPoints = () => {
        if (!m.getStyle() || m.getSource("pts")) return;
        try {
          m.addSource("pts", { type: "geojson", data: fcOf(layerRows), cluster: true, clusterRadius: 44, clusterMaxZoom: 9 });
          m.addLayer({ id: "clusters", type: "circle", source: "pts", filter: ["has", "point_count"], paint: { "circle-color": "#C8102E", "circle-opacity": 0.85, "circle-radius": ["step", ["get", "point_count"], 15, 10, 20, 30, 26] } });
          m.addLayer({
            id: "pt", type: "circle", source: "pts", filter: ["!", ["has", "point_count"]],
            paint: {
              // every dot the same — setting vs filmed by colour, no dimming
              "circle-color": ["match", ["get", "layer"], "filmed", "#0F6E56", "#C8102E"],
              "circle-radius": 7,
              "circle-stroke-color": "#fff", "circle-stroke-width": 1.6,
            },
          });
        } catch { /* style mid-swap */ }
      };
      const updateInView = () => {
        try { const b = m.getBounds(); const w = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth();
          setInView(new Set(rows.filter((r) => r.lat >= s && r.lat <= n && (e >= w ? (r.lng >= w && r.lng <= e) : (r.lng >= w || r.lng <= e))).map((r) => r.id))); } catch {}
      };
      const fit = () => { try { const b = new ml.LngLatBounds(); (filmSlug && scope === "all" ? rows.filter(isMine) : rows).forEach((r) => b.extend([r.lng, r.lat])); m.fitBounds(b, { padding: 56, maxZoom: 9, duration: 0 }); } catch {} };

      m.on("load", () => { addPoints(); fit(); updateInView(); });
      m.on("styledata", addPoints);
      m.on("moveend", updateInView);

      m.on("click", "clusters", (ev: { features?: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }[] }) => {
        const f = ev.features?.[0]; if (!f) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m.getSource("pts") as any).getClusterExpansionZoom(f.properties.cluster_id, (_e: unknown, zoom: number) => m.easeTo({ center: f.geometry.coordinates, zoom: zoom ?? m.getZoom() + 2 }));
      });

      // hover popup — no click needed
      m.on("mousemove", "pt", (ev: { features?: { properties: Record<string, string>; geometry: { coordinates: number[] } }[] }) => {
        const f = ev.features?.[0]; if (!f) return;
        m.getCanvas().style.cursor = "pointer";
        const p = f.properties;
        const h = [`<b style="font-size:13px">${esc(p.name)}</b>`];
        if (p.film) h.push(`<div style="color:#8a8278;font-size:11px;margin-top:1px">${esc(p.film)}</div>`);
        if (p.role) h.push(`<div style="color:#55504a;margin-top:4px;line-height:1.4">${esc(p.role.slice(0, 150))}${p.role.length > 150 ? "…" : ""}</div>`);
        hoverPop.current?.remove();
        hoverPop.current = new ml.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: "240px" })
          .setLngLat(f.geometry.coordinates as number[]).setHTML(`<div style="font-family:sans-serif;font-size:12px">${h.join("")}</div>`).addTo(m);
      });
      m.on("mouseleave", "pt", () => { m.getCanvas().style.cursor = ""; hoverPop.current?.remove(); hoverPop.current = null; });
      m.on("mouseenter", "clusters", () => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave", "clusters", () => { m.getCanvas().style.cursor = ""; });

      m.on("click", "pt", (ev: { features?: { properties: Record<string, string>; geometry: { coordinates: number[] } }[] }) => {
        const f = ev.features?.[0]; if (!f) return;
        setActive(f.properties.id);
        const p = f.properties; const filmed = p.layer === "filmed";
        const parts = [`<b style="font-size:14px">${esc(p.name)}</b>`];
        if (p.film) parts.push(`<div style="color:#8a8278;font-size:11.5px;margin-top:1px">${esc(p.film)}</div>`);
        if (filmed) {
          const tag = p.built ? `Built set${p.host ? `: ${esc(p.host)}` : ""}` : "Filming location";
          parts.push(`<div style="color:#0F6E56;font-weight:700;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;margin-top:7px">${tag}${p.tier ? ` · ${esc(p.tier)}` : ""}</div>`);
        }
        if (p.role) parts.push(`<div style="color:#55504a;margin-top:5px;line-height:1.45">${esc(p.role)}${p.role.length >= 300 ? "…" : ""}</div>`);
        if (filmed && p.src) parts.push(`<a href="${p.src}" target="_blank" rel="noopener" style="color:#0F6E56;font-weight:600;display:inline-block;margin-top:7px;margin-right:12px">Source ↗</a>`);
        if (p.href) parts.push(`<a href="${p.href}" style="color:#C8102E;font-weight:600;display:inline-block;margin-top:7px">${filmed ? "Open the film ↗" : "Read this in the film ↗"}</a>`);
        hoverPop.current?.remove();
        popup.current?.remove();
        popup.current = new ml.Popup({ closeButton: true, offset: 12, maxWidth: "280px" }).setLngLat(f.geometry.coordinates as number[]).setHTML(`<div style="font-family:sans-serif;font-size:12.5px">${parts.join("")}</div>`).addTo(m);
      });
    }).catch(() => {});
    return () => { alive = false; try { map.current?.remove(); } catch {} map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(() => { const m = map.current; if (!m) return; try { const s = m.getSource("pts"); if (s) s.setData(fcOf(layerRows)); } catch {} /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lf]);
  useEffect(() => { const m = map.current; if (!m) return; try { m.setStyle(sat ? STYLE_SAT : STYLE_MAP); } catch {} }, [sat]);

  const flyTo = (r: Row) => { setActive(r.id); const m = map.current; if (!m) return; m.flyTo({ center: [r.lng, r.lat], zoom: Math.max(m.getZoom(), 11), duration: 700 }); };

  if (rows && rows.length === 0 && filmSlug && scope === "film") return null; // film page with no locations
  const shown = layerRows.filter((r) => !inView || inView.has(r.id));

  return (
    <div className="fmap">
      <div className="fmap-head">
        {search ? (
          <div className="fmap-search">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={focus ? "Search another film…" : "Search a film → show it on the map…"} />
            {focus ? <span className="fmap-focus">Showing <b>{focus.title}</b><button onClick={() => { setFocus(null); setActive(null); }} aria-label="Show all films">✕</button></span> : null}
            {sugs.length ? (
              <div className="fmap-sug">
                {sugs.map((s) => (
                  <button key={s.slug} type="button" className="fmap-sug__i" onClick={() => { setFocus({ slug: s.slug, title: s.title }); setQ(""); setSugs([]); }}>
                    {s.poster_path ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`${IMG}${s.poster_path}`} alt="" /> : <span className="fmap-sug__e" />}
                    <span className="fmap-sug__t">{s.title} <i>({s.year ?? "?"}{s.director ? `, ${s.director}` : ""})</i></span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="fmap-hint">{rows ? `${shown.length} place${shown.length !== 1 ? "s" : ""} in view · drag / zoom to explore` : "Loading the map…"}</span>
        )}
        <div className="fmap-ctrls">
          {filmSlug ? (
            <span className="fmap-seg">
              <button className={scope === "film" ? "on" : ""} onClick={() => setScope("film")}>This film</button>
              <button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>All films</button>
            </span>
          ) : null}
          {hasFilmed && hasSetting ? (
            <span className="fmap-seg">
              <button className={lf === "all" ? "on" : ""} onClick={() => setLf("all")}>All</button>
              <button className={lf === "setting" ? "on" : ""} onClick={() => setLf("setting")}>Set in</button>
              <button className={lf === "filmed" ? "on" : ""} onClick={() => setLf("filmed")}>Filmed at</button>
            </span>
          ) : null}
          <button type="button" className="fmap-sat" onClick={() => setSat((v) => !v)}>{sat ? "Map" : "Satellite"}</button>
        </div>
      </div>
      <div className="fmap-body">
        <div className="fmap-canvas" ref={mapEl} style={{ height }} />
        <ul className="fmap-list" style={{ maxHeight: height }}>
          {shown.map((r) => {
            const href = hrefFor(r, effFilm);
            const role = roleOf(r);
            const big = globalMode ? filmLabel(r) || r.name : r.name;
            const small = globalMode ? r.name : filmLabel(r);
            return (
              <li key={r.id} className={`fmap-li${active === r.id ? " on" : ""}${filmSlug && scope === "all" && !isMine(r) ? " fmap-li--other" : ""}`} onClick={() => flyTo(r)}>
                {r.poster_path ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="fmap-li__thumb" src={`${IMG}${r.poster_path}`} alt="" loading="lazy" /> : <span className="fmap-li__thumb fmap-li__thumb--e" />}
                <div className="fmap-li__tx">
                  <span className="fmap-li__ttl">{r.layer === "filmed" ? <span className="fmap-dot fmap-dot--f" /> : null}{big}</span>
                  {small ? <span className="fmap-li__place">{small}</span> : null}
                  {role ? <span className="fmap-li__role">{role}</span> : null}
                  {href ? <a className="fmap-li__open" href={href} onClick={(e) => e.stopPropagation()}>{globalMode ? "Open the film →" : "Read in the film →"}</a> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
