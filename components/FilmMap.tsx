"use client";

/**
 * FilmMap — the geographic "Atlas". Two layers on one map:
 *   • setting (red)  — places the film is set in / names (narrative geography)
 *   • filmed (teal)  — real, sourced filming locations (production geography)
 * Keyless: MapLibre GL JS (CDN) + OpenFreeMap vector basemap ↔ Esri satellite.
 * Data from /api/geo (data/presentation separated). Left list is live (reflects the
 * current viewport); a layer toggle appears when both layers exist. Click a pin to
 * read it (figure page for setting; the film + a source link for filmed).
 */

import { useEffect, useMemo, useRef, useState } from "react";

type Row = {
  id: string; name: string; narrative_setting?: string | null; scene_role?: string | null;
  kind?: string | null; lat: number; lng: number; precision?: string | null; country?: string | null;
  layer?: string; built_set?: boolean | null; set_host?: string | null; tier?: string | null;
  sources?: string[] | null; fig_slug?: string | null; fig_label?: string | null; fig_desc?: string | null;
  film_slug?: string | null; film_title?: string | null; film_year?: number | null;
};

const STYLE_MAP = "https://tiles.openfreemap.org/styles/liberty";
const SAT_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const STYLE_SAT = { version: 8, sources: { esri: { type: "raster", tiles: [SAT_TILE], tileSize: 256, attribution: "© Esri" } }, layers: [{ id: "esri", type: "raster", source: "esri" }] };

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

function hrefFor(r: Row, filmSlug?: string): string | null {
  const fs = r.film_slug ?? filmSlug; if (!fs) return null;
  return r.fig_slug ? `/film/${fs}/figure/${r.fig_slug}` : `/film/${fs}`;
}
function subFor(r: Row): string {
  return [r.narrative_setting, r.film_title ? `${r.film_title}${r.film_year ? ` (${r.film_year})` : ""}` : null].filter(Boolean).join(" · ");
}
const esc = (x: string) => (x || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

export default function FilmMap({ endpoint, height = 460, filmSlug }: { endpoint: string; height?: number; filmSlug?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sat, setSat] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [inView, setInView] = useState<Set<string> | null>(null);
  const [lf, setLf] = useState<"all" | "setting" | "filmed">("all");
  const mapEl = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const popup = useRef<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => { try { const r = await fetch(endpoint, { cache: "no-store" }); const j = await r.json(); if (alive) setRows(Array.isArray(j) ? j : []); } catch { if (alive) setRows([]); } })();
    return () => { alive = false; };
  }, [endpoint]);

  const hasFilmed = useMemo(() => (rows ?? []).some((r) => r.layer === "filmed"), [rows]);
  const hasSetting = useMemo(() => (rows ?? []).some((r) => (r.layer ?? "setting") === "setting"), [rows]);
  const layerRows = useMemo(() => (rows ?? []).filter((r) => lf === "all" || (r.layer ?? "setting") === lf), [rows, lf]);

  const fcOf = (rs: Row[]) => ({
    type: "FeatureCollection",
    features: rs.map((r) => ({
      type: "Feature", geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, href: hrefFor(r, filmSlug) ?? "", layer: r.layer ?? "setting",
        narr: r.narrative_setting ?? "", role: r.scene_role ?? "", desc: (r.fig_desc ?? "").slice(0, 300),
        tier: r.tier ?? "", built: r.built_set ? "1" : "", host: r.set_host ?? "", src: (r.sources && r.sources[0]) || "",
        film: r.film_title ? `${r.film_title}${r.film_year ? ` (${r.film_year})` : ""}` : "",
      },
    })),
  });

  useEffect(() => {
    if (!rows || rows.length === 0 || !mapEl.current) return;
    let alive = true;
    loadMapLibre().then((ml) => {
      if (!alive || !mapEl.current) return;
      const m = new ml.Map({ container: mapEl.current, style: STYLE_MAP, attributionControl: true });
      map.current = m;
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      m.on("error", () => {});

      const addPoints = () => {
        if (m.getSource("pts")) return;
        m.addSource("pts", { type: "geojson", data: fcOf(layerRows), cluster: true, clusterRadius: 44, clusterMaxZoom: 9 });
        m.addLayer({ id: "clusters", type: "circle", source: "pts", filter: ["has", "point_count"], paint: { "circle-color": "#C8102E", "circle-opacity": 0.85, "circle-radius": ["step", ["get", "point_count"], 15, 10, 20, 30, 26] } });
        m.addLayer({ id: "pt", type: "circle", source: "pts", filter: ["!", ["has", "point_count"]], paint: { "circle-color": ["match", ["get", "layer"], "filmed", "#0F6E56", "#C8102E"], "circle-radius": 7, "circle-stroke-color": "#fff", "circle-stroke-width": 1.6 } });
      };
      const updateInView = () => {
        try { const b = m.getBounds(); const w = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth();
          setInView(new Set(rows.filter((r) => r.lat >= s && r.lat <= n && (e >= w ? (r.lng >= w && r.lng <= e) : (r.lng >= w || r.lng <= e))).map((r) => r.id))); } catch {}
      };
      const fit = () => { try { const b = new ml.LngLatBounds(); rows.forEach((r) => b.extend([r.lng, r.lat])); m.fitBounds(b, { padding: 48, maxZoom: 9, duration: 0 }); } catch {} };

      m.on("load", () => { addPoints(); fit(); updateInView(); });
      m.on("styledata", addPoints);
      m.on("moveend", updateInView);

      m.on("click", "clusters", (ev: { features?: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }[] }) => {
        const f = ev.features?.[0]; if (!f) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m.getSource("pts") as any).getClusterExpansionZoom(f.properties.cluster_id, (_e: unknown, zoom: number) => m.easeTo({ center: f.geometry.coordinates, zoom: zoom ?? m.getZoom() + 2 }));
      });
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
        if (p.narr) parts.push(`<div style="font-weight:600;margin-top:5px">${esc(p.narr)}</div>`);
        if (p.role) parts.push(`<div style="color:#55504a;margin-top:3px;line-height:1.45">${esc(p.role)}</div>`);
        else if (p.desc) parts.push(`<div style="color:#55504a;margin-top:3px;line-height:1.45">${esc(p.desc)}${p.desc.length >= 300 ? "…" : ""}</div>`);
        if (filmed && p.src) parts.push(`<a href="${p.src}" target="_blank" rel="noopener" style="color:#0F6E56;font-weight:600;display:inline-block;margin-top:7px;margin-right:12px">Source ↗</a>`);
        if (p.href) parts.push(`<a href="${p.href}" style="color:#C8102E;font-weight:600;display:inline-block;margin-top:7px">${filmed ? "Open the film ↗" : "Read this in the film ↗"}</a>`);
        popup.current?.remove();
        popup.current = new ml.Popup({ closeButton: true, offset: 12, maxWidth: "280px" }).setLngLat(f.geometry.coordinates as number[]).setHTML(`<div style="font-family:sans-serif;font-size:12.5px">${parts.join("")}</div>`).addTo(m);
      });
      ["clusters", "pt"].forEach((id) => { m.on("mouseenter", id, () => { m.getCanvas().style.cursor = "pointer"; }); m.on("mouseleave", id, () => { m.getCanvas().style.cursor = ""; }); });
    }).catch(() => {});
    return () => { alive = false; try { map.current?.remove(); } catch {} map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filmSlug]);

  // layer toggle → swap the source data live
  useEffect(() => { const m = map.current; if (!m) return; try { const s = m.getSource("pts"); if (s) s.setData(fcOf(layerRows)); } catch {} /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lf]);
  // satellite toggle
  useEffect(() => { const m = map.current; if (!m) return; try { m.setStyle(sat ? STYLE_SAT : STYLE_MAP); } catch {} }, [sat]);

  const flyTo = (r: Row) => { setActive(r.id); const m = map.current; if (!m) return; m.flyTo({ center: [r.lng, r.lat], zoom: Math.max(m.getZoom(), 11), duration: 700 }); };

  if (rows && rows.length === 0) return null;
  const shown = layerRows.filter((r) => !inView || inView.has(r.id));

  return (
    <div className="fmap">
      <div className="fmap-head">
        <span className="fmap-hint">{rows ? `${shown.length} place${shown.length !== 1 ? "s" : ""} in view${inView && shown.length !== layerRows.length ? ` of ${layerRows.length}` : ""} · drag / zoom to explore` : "Loading the map…"}</span>
        <div className="fmap-ctrls">
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
        <ul className="fmap-list">
          {shown.map((r) => {
            const href = hrefFor(r, filmSlug);
            const inner = (<><span className="fmap-li__n">{r.layer === "filmed" ? <span className="fmap-dot fmap-dot--f" /> : null}{r.name}</span>{subFor(r) || r.scene_role ? <span className="fmap-li__s">{r.scene_role || subFor(r)}</span> : null}</>);
            return (
              <li key={r.id} className={`fmap-li${active === r.id ? " on" : ""}`} onClick={() => flyTo(r)}>
                {href ? <a href={href} onClick={(e) => e.stopPropagation()}>{inner}</a> : inner}
              </li>
            );
          })}
        </ul>
        <div className="fmap-canvas" ref={mapEl} style={{ height }} />
      </div>
    </div>
  );
}
