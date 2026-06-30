"use client";

/**
 * FilmMap — the geographic "Atlas": real-world pins for a film's / director's
 * narrative locations (and later, filming locations). Keyless: MapLibre GL JS
 * (CDN) + OpenFreeMap vector basemap (MapLibre-native, CORS-clean) ↔ Esri
 * satellite raster toggle. Data from /api/geo (data/presentation separated →
 * swappable to Google Maps later). Click a pin → read that location figure.
 */

import { useEffect, useRef, useState } from "react";

type Row = {
  id: string; name: string; narrative_setting?: string | null; scene_role?: string | null;
  kind?: string | null; lat: number; lng: number; precision?: string | null; country?: string | null;
  layer?: string; fig_slug?: string | null; fig_label?: string | null;
  film_slug?: string | null; film_title?: string | null; film_year?: number | null;
};

const STYLE_MAP = "https://tiles.openfreemap.org/styles/liberty";
const SAT_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const STYLE_SAT = {
  version: 8,
  sources: { esri: { type: "raster", tiles: [SAT_TILE], tileSize: 256, attribution: "© Esri" } },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mlPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadMapLibre(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.maplibregl) return Promise.resolve(w.maplibregl);
  if (mlPromise) return mlPromise;
  mlPromise = new Promise((res, rej) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
    s.onload = () => res(w.maplibregl); s.onerror = rej;
    document.head.appendChild(s);
  });
  return mlPromise;
}

function hrefFor(r: Row, filmSlug?: string): string | null {
  const fs = r.film_slug ?? filmSlug;
  if (!fs) return null;
  return r.fig_slug ? `/film/${fs}/figure/${r.fig_slug}` : `/film/${fs}`;
}
function subFor(r: Row): string {
  return [r.narrative_setting, r.film_title ? `${r.film_title}${r.film_year ? ` (${r.film_year})` : ""}` : null]
    .filter(Boolean).join(" · ");
}

export default function FilmMap({ endpoint, height = 460, filmSlug }: { endpoint: string; height?: number; filmSlug?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sat, setSat] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [inView, setInView] = useState<Set<string> | null>(null);   // ids within current map bounds (live)
  const mapEl = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const popup = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fcRef = useRef<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await fetch(endpoint, { cache: "no-store" }); const j = await r.json(); if (alive) setRows(Array.isArray(j) ? j : []); }
      catch { if (alive) setRows([]); }
    })();
    return () => { alive = false; };
  }, [endpoint]);

  useEffect(() => {
    if (!rows || rows.length === 0 || !mapEl.current) return;
    let alive = true;
    loadMapLibre().then((ml) => {
      if (!alive || !mapEl.current) return;
      const fc = {
        type: "FeatureCollection",
        features: rows.map((r) => ({
          type: "Feature", geometry: { type: "Point", coordinates: [r.lng, r.lat] },
          properties: { id: r.id, name: r.name, sub: subFor(r), href: hrefFor(r, filmSlug) ?? "" },
        })),
      };
      fcRef.current = fc;
      const m = new ml.Map({ container: mapEl.current, style: STYLE_MAP, attributionControl: true });
      map.current = m;
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      m.on("error", () => { /* swallow tile noise */ });

      const addPoints = () => {
        if (m.getSource("pts")) return;
        m.addSource("pts", { type: "geojson", data: fcRef.current, cluster: true, clusterRadius: 44, clusterMaxZoom: 9 });
        m.addLayer({ id: "clusters", type: "circle", source: "pts", filter: ["has", "point_count"], paint: { "circle-color": "#C8102E", "circle-opacity": 0.85, "circle-radius": ["step", ["get", "point_count"], 15, 10, 20, 30, 26] } });
        m.addLayer({ id: "pt", type: "circle", source: "pts", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#C8102E", "circle-radius": 7, "circle-stroke-color": "#fff", "circle-stroke-width": 1.6 } });
      };
      const fit = () => {
        try { const b = new ml.LngLatBounds(); rows.forEach((r) => b.extend([r.lng, r.lat])); m.fitBounds(b, { padding: 48, maxZoom: 9, duration: 0 }); } catch { /* single point */ }
      };

      // live: the left list reflects only what's in the current viewport
      const updateInView = () => {
        try {
          const b = m.getBounds(); const w = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth();
          const ids = rows.filter((r) => r.lat >= s && r.lat <= n && (e >= w ? (r.lng >= w && r.lng <= e) : (r.lng >= w || r.lng <= e))).map((r) => r.id);
          setInView(new Set(ids));
        } catch { /* noop */ }
      };
      m.on("load", () => { addPoints(); fit(); updateInView(); });
      m.on("styledata", addPoints);   // re-add points after a satellite/map style swap
      m.on("moveend", updateInView);

      // delegated listeners persist across style swaps (bound by layer id)
      m.on("click", "clusters", (e: { features?: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }[] }) => {
        const f = e.features?.[0]; if (!f) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m.getSource("pts") as any).getClusterExpansionZoom(f.properties.cluster_id, (_e: unknown, zoom: number) => m.easeTo({ center: f.geometry.coordinates, zoom: zoom ?? m.getZoom() + 2 }));
      });
      m.on("click", "pt", (e: { features?: { properties: Record<string, string>; geometry: { coordinates: number[] } }[] }) => {
        const f = e.features?.[0]; if (!f) return;
        setActive(f.properties.id);
        const p = f.properties;
        const link = p.href ? `<a href="${p.href}" style="color:#C8102E;font-weight:600;display:inline-block;margin-top:6px">Read this ↗</a>` : "";
        popup.current?.remove();
        popup.current = new ml.Popup({ closeButton: true, offset: 12, maxWidth: "260px" })
          .setLngLat(f.geometry.coordinates as number[])
          .setHTML(`<div style="font-family:sans-serif;font-size:13px"><b>${p.name}</b>${p.sub ? `<div style="color:#666;margin-top:2px">${p.sub}</div>` : ""}${link}</div>`)
          .addTo(m);
      });
      ["clusters", "pt"].forEach((id) => {
        m.on("mouseenter", id, () => { m.getCanvas().style.cursor = "pointer"; });
        m.on("mouseleave", id, () => { m.getCanvas().style.cursor = ""; });
      });
    }).catch(() => { /* CDN blocked → list still renders */ });
    return () => { alive = false; try { map.current?.remove(); } catch { /* noop */ } map.current = null; };
  }, [rows, filmSlug]);

  useEffect(() => {
    const m = map.current; if (!m) return;
    try { m.setStyle(sat ? STYLE_SAT : STYLE_MAP); } catch { /* noop */ }
  }, [sat]);

  const flyTo = (r: Row) => {
    setActive(r.id);
    const m = map.current; if (!m) return;
    m.flyTo({ center: [r.lng, r.lat], zoom: Math.max(m.getZoom(), 11), duration: 700 });
  };

  if (rows && rows.length === 0) return null;

  const shown = (rows ?? []).filter((r) => !inView || inView.has(r.id));

  return (
    <div className="fmap">
      <div className="fmap-head">
        <span className="fmap-hint">{rows ? `${shown.length} place${shown.length !== 1 ? "s" : ""} in view${inView && shown.length !== rows.length ? ` of ${rows.length}` : ""} · drag / zoom to explore` : "Loading the map…"}</span>
        <button type="button" className="fmap-sat" onClick={() => setSat((v) => !v)}>{sat ? "Map" : "Satellite"}</button>
      </div>
      <div className="fmap-body">
        <ul className="fmap-list">
          {shown.map((r) => {
            const href = hrefFor(r, filmSlug);
            const inner = (<><span className="fmap-li__n">{r.name}</span>{subFor(r) ? <span className="fmap-li__s">{subFor(r)}</span> : null}</>);
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
