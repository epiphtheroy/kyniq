"use client";

/**
 * FilmMap — the geographic "Atlas": real-world pins for a film's / director's
 * narrative locations (and later, filming locations). Keyless: MapLibre GL JS
 * loaded from CDN + Esri raster basemaps (street ↔ satellite). Data comes from
 * /api/geo (data/presentation separated → swappable to Google Maps later).
 * Click a pin → read that location figure. Empty data → renders nothing.
 */

import { useEffect, useRef, useState } from "react";

type Row = {
  id: string; name: string; narrative_setting?: string | null; scene_role?: string | null;
  kind?: string | null; lat: number; lng: number; precision?: string | null; country?: string | null;
  layer?: string; fig_slug?: string | null; fig_label?: string | null;
  film_slug?: string | null; film_title?: string | null; film_year?: number | null;
};

const STREET = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";
const SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

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
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const popup = useRef<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await fetch(endpoint, { cache: "no-store" }); const j = await r.json(); if (alive) setRows(Array.isArray(j) ? j : []); }
      catch { if (alive) setRows([]); }
    })();
    return () => { alive = false; };
  }, [endpoint]);

  useEffect(() => {
    if (!rows || rows.length === 0 || !mapRef.current) return;
    let alive = true;
    loadMapLibre().then((ml) => {
      if (!alive || !mapRef.current) return;
      const fc = {
        type: "FeatureCollection",
        features: rows.map((r) => ({
          type: "Feature", geometry: { type: "Point", coordinates: [r.lng, r.lat] },
          properties: { id: r.id, name: r.name, sub: subFor(r), href: hrefFor(r, filmSlug) ?? "" },
        })),
      };
      const m = new ml.Map({
        container: mapRef.current,
        style: {
          version: 8,
          sources: {
            base: { type: "raster", tiles: [STREET], tileSize: 256, attribution: "© Esri, OpenStreetMap contributors" },
            pts: { type: "geojson", data: fc, cluster: true, clusterRadius: 44, clusterMaxZoom: 9 },
          },
          layers: [
            { id: "base", type: "raster", source: "base" },
            { id: "clusters", type: "circle", source: "pts", filter: ["has", "point_count"], paint: { "circle-color": "#C8102E", "circle-opacity": 0.85, "circle-radius": ["step", ["get", "point_count"], 15, 10, 20, 30, 26] } },
            { id: "pt", type: "circle", source: "pts", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#C8102E", "circle-radius": 7, "circle-stroke-color": "#fff", "circle-stroke-width": 1.6 } },
          ],
        },
        attributionControl: true,
        cooperativeGestures: false,
      });
      map.current = m;
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");

      m.on("load", () => {
        try {
          const b = new ml.LngLatBounds();
          rows.forEach((r) => b.extend([r.lng, r.lat]));
          m.fitBounds(b, { padding: 48, maxZoom: 9, duration: 0 });
        } catch { /* single point */ }
      });

      m.on("click", "clusters", (e: { features?: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }[] }) => {
        const f = e.features?.[0]; if (!f) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m.getSource("pts") as any).getClusterExpansionZoom(f.properties.cluster_id, (_err: unknown, zoom: number) => {
          m.easeTo({ center: f.geometry.coordinates, zoom: zoom ?? m.getZoom() + 2 });
        });
      });
      const openPopup = (lngLat: number[], p: Record<string, string>) => {
        const link = p.href ? `<a href="${p.href}" style="color:#C8102E;font-weight:600;display:inline-block;margin-top:6px">Read this ↗</a>` : "";
        popup.current?.remove();
        popup.current = new ml.Popup({ closeButton: true, offset: 12, maxWidth: "260px" })
          .setLngLat(lngLat)
          .setHTML(`<div style="font-family:var(--font-ui,sans-serif);font-size:13px"><b>${p.name}</b>${p.sub ? `<div style="color:#666;margin-top:2px">${p.sub}</div>` : ""}${link}</div>`)
          .addTo(m);
      };
      m.on("click", "pt", (e: { features?: { properties: Record<string, string>; geometry: { coordinates: number[] } }[] }) => {
        const f = e.features?.[0]; if (!f) return;
        setActive(f.properties.id);
        openPopup(f.geometry.coordinates as number[], f.properties);
      });
      ["clusters", "pt"].forEach((id) => {
        m.on("mouseenter", id, () => { m.getCanvas().style.cursor = "pointer"; });
        m.on("mouseleave", id, () => { m.getCanvas().style.cursor = ""; });
      });
    }).catch(() => { /* CDN blocked → list still renders */ });
    return () => { alive = false; try { map.current?.remove(); } catch { /* noop */ } map.current = null; };
  }, [rows, filmSlug]);

  // satellite toggle
  useEffect(() => {
    const m = map.current; if (!m) return;
    try { const s = m.getSource("base"); if (s) s.setTiles([sat ? SAT : STREET]); } catch { /* noop */ }
  }, [sat]);

  const flyTo = (r: Row) => {
    setActive(r.id);
    const m = map.current; if (!m) return;
    m.flyTo({ center: [r.lng, r.lat], zoom: Math.max(m.getZoom(), 11), duration: 700 });
  };

  if (rows && rows.length === 0) return null;

  return (
    <div className="fmap">
      <div className="fmap-head">
        <span className="fmap-hint">{rows ? `${rows.length} place${rows.length !== 1 ? "s" : ""} · drag · scroll to zoom` : "Loading the map…"}</span>
        <button type="button" className="fmap-sat" onClick={() => setSat((v) => !v)}>{sat ? "Map" : "Satellite"}</button>
      </div>
      <div className="fmap-body">
        <ul className="fmap-list">
          {(rows ?? []).map((r) => {
            const href = hrefFor(r, filmSlug);
            const inner = (<><span className="fmap-li__n">{r.name}</span>{subFor(r) ? <span className="fmap-li__s">{subFor(r)}</span> : null}</>);
            return (
              <li key={r.id} className={`fmap-li${active === r.id ? " on" : ""}`} onClick={() => flyTo(r)}>
                {href ? <a href={href} onClick={(e) => e.stopPropagation()}>{inner}</a> : inner}
              </li>
            );
          })}
        </ul>
        <div className="fmap-canvas" ref={mapRef} style={{ height }} />
      </div>
    </div>
  );
}
