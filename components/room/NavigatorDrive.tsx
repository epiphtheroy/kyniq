"use client";
/**
 * NavigatorDrive — the web drive view (P3/P5). The familiar Google-Maps driving
 * shape: green turn card (next film) · a PANNABLE/ZOOMABLE map with standing
 * poster signposts · a collapsible peek sheet so the map owns the screen.
 * The route preference switches via a plain link (?pref=) — the server re-sorts
 * deterministically, no client math.
 *
 * The MAP scene is a Mario-style overworld built on the REAL /odyssey film-map
 * (public/odyssey/map.v1.json): the route's films stand at their true odyssey
 * positions, lineage lines become chunky roads, continent bands become terrain.
 * A wide region around the journey is framed dynamically. If the odyssey data
 * hasn't loaded (or the route is entirely off-map), the original synthetic
 * overworld is drawn instead so the screen never breaks.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { DriveLoad } from "@/lib/navigator/load";
import type { RoutePref, RouteStop, NavFilm } from "@/lib/navigator/route";
import { turnReason, fmtRuntimeK, fmtHM } from "@/lib/navigator/route";
import type { OdyMap, OdyStation } from "@/lib/odyssey/types";

const POSTER = "https://image.tmdb.org/t/p/w185";
const POSTER92 = "https://image.tmdb.org/t/p/w92";
const po = (p: string | null) => (p ? `${POSTER}${p}` : "");

/* The winding "overworld" route (viewBox 0-100) + the poster stops that stand at its
   nodes, near→far (nearer = larger, for depth). The synthetic fallback map. */
const ROUTE_D = "M11,80 C18,70 22,64 27,60 C34,55 40,68 45,72 C52,76 56,54 62,50 C68,46 74,56 78,60 C83,63 87,42 90,33";
const WAYPOINTS = [
  { top: 60, left: 27, w: 78 },
  { top: 72, left: 45, w: 64 },
  { top: 50, left: 62, w: 52 },
  { top: 60, left: 78, w: 44 },
];

/* Terrain tints for the 4 odyssey continent bands (anglo · europe · eastasia · south) —
   a soft daytime overworld: meadow · grassland · sand · shallow water. */
const TERRAIN = [
  { fill: "#D7E8B4", op: 0.7 },
  { fill: "#E7E6BA", op: 0.62 },
  { fill: "#F0E3C0", op: 0.68 },
  { fill: "#C9E6E4", op: 0.68 },
];
const BAND_DOT = ["#8AA85B", "#B9A24A", "#C79A5A", "#5FA3A0"];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r2 = (n: number) => Math.round(n * 100) / 100;

/* A smooth-through-points path (quadratic midpoints) for winding roads. */
function smoothD(pts: Array<{ x: number; y: number }>): string {
  const n = pts.length;
  if (!n) return "";
  if (n === 1) return `M${r2(pts[0].x)} ${r2(pts[0].y)}`;
  if (n === 2) return `M${r2(pts[0].x)} ${r2(pts[0].y)} L${r2(pts[1].x)} ${r2(pts[1].y)}`;
  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`;
  for (let i = 1; i < n - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${r2(pts[i].x)} ${r2(pts[i].y)} ${r2(mx)} ${r2(my)}`;
  }
  d += ` L${r2(pts[n - 1].x)} ${r2(pts[n - 1].y)}`;
  return d;
}

/* ── The odyssey-driven scene ─────────────────────────────────────────────── */

interface ScenePt { stop: RouteStop; nx: number; ny: number; w: number; now: boolean; dest: boolean; missing: boolean }
interface SceneRoad { id: string; name: string; color: string; d: string; lx: number; ly: number; n: number }
interface SceneBand { i: number; y0: number; y1: number }
interface SceneBgP { key: string; nx: number; ny: number; p: string }
interface SceneDot { key: string; nx: number; ny: number; c: string }
interface Scene {
  routePts: ScenePt[];
  routeD: string;
  roads: SceneRoad[];
  bands: SceneBand[];
  bgPosters: SceneBgP[];
  bgDots: SceneDot[];
  me: { nx: number; ny: number };
  missingCount: number;
}

/**
 * Frame the journey on the real odyssey plane.
 *  1. Look each stop's slug up to its station (x, yy). Slugs absent from the map
 *     are placed by interpolating between their charted neighbours (or, at the
 *     ends, extrapolating along the route's mean heading) so the path stays whole.
 *  2. Bounding-box the route, pad generously, then widen the short axis to the
 *     screen's aspect → a wide region with no distortion. Normalise (x,yy)→[0,100].
 *  3. Draw the lineage lines that cross that region as chunky roads, the ordered
 *     films as level nodes, and nearby stations as faint terrain population.
 * Returns null when NO stop is on the map (caller falls back to the synthetic map).
 */
function buildScene(map: OdyMap, stops: RouteStop[], aspect: number): Scene | null {
  if (!stops.length) return null;
  const byId = new Map(map.stations.map((s) => [s.s, s]));

  type P = { x: number; y: number };
  const pts: P[] = new Array(stops.length);
  const missing: boolean[] = new Array(stops.length);
  const known: number[] = [];
  stops.forEach((stop, i) => {
    const st = byId.get(stop.film.slug);
    if (st) { pts[i] = { x: st.x, y: st.yy }; missing[i] = false; known.push(i); }
    else { missing[i] = true; }
  });
  if (!known.length) return null;

  // mean heading, for extrapolating unknown runs at either end
  const kf = known[0], kl = known[known.length - 1];
  const dir: P = kl > kf
    ? { x: (pts[kl].x - pts[kf].x) / (kl - kf), y: (pts[kl].y - pts[kf].y) / (kl - kf) }
    : { x: 70, y: 45 };
  for (let i = 0; i < stops.length; i++) {
    if (!missing[i]) continue;
    let lo = -1, hi = -1;
    for (const k of known) { if (k < i) lo = k; if (k > i) { hi = k; break; } }
    if (lo >= 0 && hi >= 0) {
      const t = (i - lo) / (hi - lo);
      pts[i] = { x: pts[lo].x + (pts[hi].x - pts[lo].x) * t, y: pts[lo].y + (pts[hi].y - pts[lo].y) * t };
    } else if (lo >= 0) {
      pts[i] = { x: pts[lo].x + dir.x * (i - lo), y: pts[lo].y + dir.y * (i - lo) };
    } else {
      pts[i] = { x: pts[hi].x - dir.x * (hi - i), y: pts[hi].y - dir.y * (hi - i) };
    }
  }

  // bounding box of the route → generous pad → aspect-fit the short axis (wider region)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let hx = Math.max((maxX - minX) / 2, 200) * 1.5;
  let hy = Math.max((maxY - minY) / 2, 200) * 1.5;
  const asp = aspect > 0 ? aspect : 0.78;
  if (hx / hy < asp) hx = hy * asp; else hy = hx / asp;
  const bx0 = cx - hx, by0 = cy - hy, sx = 100 / (2 * hx), sy = 100 / (2 * hy);
  const nx = (x: number) => (x - bx0) * sx;
  const ny = (y: number) => (y - by0) * sy;

  const last = stops.length - 1;
  const routePts: ScenePt[] = stops.map((stop, i) => ({
    stop, nx: nx(pts[i].x), ny: ny(pts[i].y),
    w: Math.max(24, 62 - i * 5), now: i === 0, dest: i === last, missing: missing[i],
  }));
  const routeD = smoothD(pts.map((p) => ({ x: nx(p.x), y: ny(p.y) })));
  const me = { nx: clamp(nx(pts[0].x - dir.x * 0.5), 2, 98), ny: clamp(ny(pts[0].y - dir.y * 0.5), 2, 98) };

  // lineage roads — lines with ≥2 stations inside the region (drawn locally + clipped)
  const roads: SceneRoad[] = [];
  for (const line of map.lines) {
    const mem: OdyStation[] = [];
    for (const sl of line.stations) { const s = byId.get(sl); if (s) mem.push(s); }
    if (mem.length < 2) continue;
    const proj = mem.map((s) => ({ x: nx(s.x), y: ny(s.yy) }));
    const inIdx: number[] = [];
    proj.forEach((p, i) => { if (p.x >= -15 && p.x <= 115 && p.y >= -15 && p.y <= 115) inIdx.push(i); });
    if (inIdx.length < 2) continue;
    const lo = Math.max(0, inIdx[0] - 1), hi = Math.min(proj.length - 1, inIdx[inIdx.length - 1] + 1);
    let lxs = 0, lys = 0; for (const i of inIdx) { lxs += proj[i].x; lys += proj[i].y; }
    roads.push({
      id: line.id, name: line.name_en, color: line.color, d: smoothD(proj.slice(lo, hi + 1)),
      lx: clamp(lxs / inIdx.length, 7, 93), ly: clamp(lys / inIdx.length, 6, 94), n: inIdx.length,
    });
  }
  roads.sort((a, b) => b.n - a.n);

  // terrain bands (continents) overlapping the region
  const bands: SceneBand[] = [];
  map.bands.forEach((b, i) => {
    const y0 = ny(b.y0), y1 = ny(b.y1);
    if (y1 >= -5 && y0 <= 105) bands.push({ i, y0, y1 });
  });

  // faint population — nearby stations not on the route (dots for texture, a few posters)
  const onRoute = new Set(stops.map((s) => s.film.slug));
  const cand: Array<{ s: OdyStation; nx: number; ny: number }> = [];
  for (const s of map.stations) {
    if (onRoute.has(s.s)) continue;
    const px = nx(s.x), py = ny(s.yy);
    if (px < -2 || px > 102 || py < -2 || py > 102) continue;
    cand.push({ s, nx: px, ny: py });
  }
  cand.sort((a, b) => (b.s.v ?? 0) - (a.s.v ?? 0));
  const bgDots: SceneDot[] = cand.slice(0, 200).map((c) => ({ key: c.s.s, nx: c.nx, ny: c.ny, c: BAND_DOT[c.s.b] ?? "#9c927c" }));
  const bgPosters: SceneBgP[] = cand.filter((c) => c.s.p).slice(0, 18).map((c) => ({ key: c.s.s, nx: c.nx, ny: c.ny, p: c.s.p as string }));

  return { routePts, routeD, roads, bands, bgPosters, bgDots, me, missingCount: known.length === stops.length ? 0 : stops.length - known.length };
}

export default function NavigatorDrive({ load, pref }: { load: DriveLoad; pref: RoutePref }) {
  const { destination: dest, stats } = load;
  const route = load.routes[pref];
  const next = route.next;

  // pan/zoom — the map is navigable in its own right
  const [view, setView] = useState({ tx: 0, ty: 0, k: 1 });
  const [open, setOpen] = useState(false); // sheet peek(false) / expanded(true)
  const [pick, setPick] = useState<NavFilm | null>(null); // map poster → info card
  const [ody, setOdy] = useState<OdyMap | null>(null); // the real /odyssey film-map
  const [aspect, setAspect] = useState(0.78); // map viewport w/h — keeps roads undistorted
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  // load the odyssey map once (same-origin static asset); silent fallback on failure
  useEffect(() => {
    let live = true;
    fetch("/odyssey/map.v1.json").then((r) => r.json()).then((m: OdyMap) => { if (live) setOdy(m); }).catch(() => {});
    return () => { live = false; };
  }, []);
  // track the map viewport aspect so the framed region isn't stretched
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (el.clientHeight) setAspect(el.clientWidth / el.clientHeight); });
    ro.observe(el);
    if (el.clientHeight) setAspect(el.clientWidth / el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const onDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  }, [view.tx, view.ty]);
  const onMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, tx: drag.current!.tx + (e.clientX - drag.current!.x), ty: drag.current!.ty + (e.clientY - drag.current!.y) }));
  }, []);
  const onUp = useCallback(() => { drag.current = null; }, []);
  const onWheel = useCallback((e: React.WheelEvent) => {
    setView((v) => ({ ...v, k: clamp(v.k * (e.deltaY < 0 ? 1.12 : 0.89), 0.55, 3) }));
  }, []);
  const zoom = (f: number) => setView((v) => ({ ...v, k: clamp(v.k * f, 0.55, 3) }));
  const fit = () => setView({ tx: 0, ty: 0, k: 1 });

  // Route-pref links must PRESERVE the destination params (?dir/?lineage/?label/…)
  // and only change ?pref — otherwise the click drops to the picker instead of re-sorting.
  const params = useSearchParams();
  const prefHref = useCallback((p: RoutePref) => {
    const q = new URLSearchParams(params?.toString() ?? "");
    q.set("pref", p);
    return `?${q.toString()}`;
  }, [params]);

  const share = useCallback(() => {
    const text = `🏁 Finished ${dest.label} — ${stats.total} films · ${fmtRuntimeK(stats.runtimeTraveled)}. Charted with the Metatake Navigator.`;
    const url = "https://metatake.net/room/navigator";
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    if (nav.share) void nav.share({ title: "The Navigator", text, url }).catch(() => {});
    else void navigator.clipboard?.writeText(`${text} ${url}`);
  }, [dest.label, stats.total, stats.runtimeTraveled]);

  const scene = useMemo(() => (ody ? buildScene(ody, route.stops, aspect) : null), [ody, route.stops, aspect]);

  if (!next) {
    return (
      <div className="navd">
        <div className="arrived">
          <div style={{ fontSize: 38 }}>🏁</div>
          <div className="big">Arrived — {dest.label}</div>
          <div style={{ color: "var(--sub)", fontSize: 13 }}>{stats.total} films · {fmtRuntimeK(stats.runtimeTraveled)} total</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="ar-btn" onClick={share}>Share journey ↗</button>
            <Link href="/room/navigator" className="ar-btn ar-btn--2">New destination →</Link>
          </div>
        </div>
      </div>
    );
  }

  const then = route.stops[1]?.film ?? null;
  const near = route.stops.slice(0, 4);
  const finalStop = route.stops[route.stops.length - 1];
  const destIsNear = near.some((s) => s.film.slug === finalStop.film.slug);
  const progressPct = stats.total ? Math.round((stats.seenCount / stats.total) * 100) : 0;
  const travMin = stats.runtimeTraveled ?? 0;
  const remMin = stats.runtimeRemaining ?? 0;
  const donePct = travMin + remMin > 0 ? Math.round((travMin / (travMin + remMin)) * 100) : 0;
  const laneRent = next.availability === "rent";
  const roadName = dest.family === "director" ? `${dest.label} filmography` : dest.label;

  // synthetic (fallback) signpost
  const sp = (stop: RouteStop, slot: { top: number; left: number; w: number }, isNow: boolean) => (
    <button
      type="button"
      key={stop.film.slug}
      className={`sp${isNow ? " now" : ""}`}
      style={{ left: `${slot.left}%`, top: `${slot.top}%` }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => setPick(stop.film)}
    >
      <img src={po(stop.film.poster_path)} alt="" style={{ width: slot.w, height: slot.w * 1.5 }} loading="lazy" draggable={false} />
      <span className="pole" /><span className="shadow" />
      {isNow ? <span className="cap">Now · {stop.film.title}</span> : slot.w >= 60 ? <span className="cap">{stop.film.title}</span> : null}
    </button>
  );

  return (
    <div className="navd">
      {/* turn card — the next film */}
      <div className="turn">
        <div className="row">
          <div className="mnv"><div className="ar">↰</div><div className="k">NEXT</div></div>
          <span className="po" style={{ backgroundImage: `url(${po(next.poster_path)})` }} />
          <div className="tx">
            <div className="tt">{next.title}</div>
            <div className="mt">{next.year ?? "?"} · {next.runtime ? `${next.runtime} min` : "—"} · {turnReason(next, dest, stats)}</div>
            {next.availability !== "none" ? (
              <span className={`lane${laneRent ? " rent" : ""}`}><span className="d" />{laneRent ? "Rent" : "Play now"}</span>
            ) : null}
          </div>
        </div>
        {then ? <div className="then"><span className="a">Then ↑</span> <b>{then.title}</b>{then.runtime ? ` · ${then.runtime} min` : ""}</div> : null}
        <div className="turn-excl">✓ Excludes films you&apos;ve seen{stats.seenCount ? ` · ${stats.seenCount} behind you` : ""}</div>
      </div>

      {/* the map — pannable & zoomable */}
      <div className="map" ref={mapRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onWheel={onWheel}>
        <div className="haze" />
        <div className="mapview" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})` }}>
          {scene ? (
            /* ── the real /odyssey overworld ── */
            <>
              <svg className="roadsvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {/* terrain — base grass + continent bands + a couple of soft hills */}
                <rect x="-10" y="-10" width="120" height="120" fill="#DCE9C2" opacity="0.55" />
                {scene.bands.map((b) => (
                  <rect key={b.i} x="-10" y={b.y0} width="120" height={Math.max(0, b.y1 - b.y0)} fill={TERRAIN[b.i]?.fill} opacity={TERRAIN[b.i]?.op} />
                ))}
                <ellipse cx="20" cy="22" rx="17" ry="11" fill="#C9DEA0" opacity="0.42" />
                <ellipse cx="83" cy="80" rx="19" ry="12" fill="#C9DEA0" opacity="0.38" />
                {/* faint population dots */}
                {scene.bgDots.map((d) => <circle key={d.key} cx={d.nx} cy={d.ny} r="0.55" fill={d.c} opacity="0.3" />)}
                {/* lineage roads — the streets you pass are all real lineages */}
                {scene.roads.slice(0, 9).map((rd) => (
                  <g key={rd.id}>
                    <path d={rd.d} fill="none" stroke="#2a2a2a" strokeOpacity="0.12" strokeWidth="12" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={rd.d} fill="none" stroke={rd.color} strokeWidth="8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity="0.88" />
                    <path d={rd.d} fill="none" stroke="#fff" strokeWidth="1.3" strokeDasharray="0.4 3.4" vectorEffect="non-scaling-stroke" opacity="0.6" strokeLinecap="round" />
                  </g>
                ))}
                {/* THE journey — the ordered films you'll drive, as a bold road */}
                <path d={scene.routeD} fill="none" stroke="#B58C4A" strokeWidth="13" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <path d={scene.routeD} fill="none" stroke="#fff" strokeWidth="9.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <path d={scene.routeD} fill="none" stroke="var(--blue)" strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <path d={scene.routeD} fill="none" stroke="#ffffffcc" strokeWidth="1.3" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
              </svg>
              {/* road-name signs — each is a real lineage (top few, to stay legible) */}
              {scene.roads.slice(0, 6).map((rd) => (
                <div key={rd.id} className="street" style={{ left: `${rd.lx}%`, top: `${rd.ly}%`, background: rd.color }}>{rd.name}</div>
              ))}
              <div className="street cur" style={{ left: `${scene.me.nx}%`, top: `${clamp(scene.me.ny + 8, 4, 96)}%` }}>{roadName}</div>
              {/* faint background posters so the world feels populated */}
              {scene.bgPosters.map((bp) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={bp.key} className="bgp" src={`${POSTER92}${bp.p}`} alt="" aria-hidden="true" loading="lazy" draggable={false} style={{ left: `${bp.nx}%`, top: `${bp.ny}%` }} />
              ))}
              {/* the route's films — poster "level nodes" at their real odyssey positions */}
              {scene.routePts.map((rp) => (
                <button
                  type="button"
                  key={rp.stop.film.slug}
                  className={`sp${rp.now ? " now" : ""}${rp.dest ? " dest" : ""}`}
                  style={{ left: `${rp.nx}%`, top: `${rp.ny}%` }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setPick(rp.stop.film)}
                >
                  {rp.dest ? <span className="flag">🏁</span> : null}
                  <img src={po(rp.stop.film.poster_path)} alt="" style={{ width: rp.w, height: rp.w * 1.5 }} loading="lazy" draggable={false} />
                  <span className="pole" /><span className="shadow" />
                  {rp.now ? <span className="cap">Now · {rp.stop.film.title}</span>
                    : rp.dest || rp.w >= 46 ? <span className="cap">{rp.stop.film.title}</span> : null}
                </button>
              ))}
              {/* "me" — the chevron just before the next film */}
              <div className="me" style={{ left: `${scene.me.nx}%`, top: `${scene.me.ny}%` }}><div className="chev" /><div className="dot" /><div className="back">↓ {stats.seenCount} behind you</div></div>
            </>
          ) : (
            /* ── synthetic fallback (odyssey data not ready / route off-map) ── */
            <>
              <svg className="roadsvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <ellipse cx="20" cy="26" rx="28" ry="19" fill="#D9E6BE" opacity=".65" />
                <ellipse cx="84" cy="74" rx="26" ry="17" fill="#D7E4B8" opacity=".6" />
                <ellipse cx="16" cy="86" rx="20" ry="13" fill="#EBDCB4" opacity=".6" />
                <path d="M62,-6 C76,6 71,21 86,27 C99,32 110,23 114,31 L114,-8 Z" fill="#CFE2EA" opacity=".6" />
                <path d="M-6,42 C18,36 34,51 54,43 C74,35 92,47 108,39" fill="none" stroke="#D6CDB2" strokeWidth="4.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity=".85" />
                <path d="M41,-6 C37,18 47,33 39,53 C32,71 43,87 37,108" fill="none" stroke="#D6CDB2" strokeWidth="4" vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity=".8" />
                <path d="M-6,90 C22,82 41,93 63,85 C83,78 97,87 108,81" fill="none" stroke="#D6CDB2" strokeWidth="3.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity=".7" />
                <path d={ROUTE_D} fill="none" stroke="var(--road)" strokeWidth="12" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <path d={ROUTE_D} fill="none" stroke="#fff" strokeWidth="9" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <path d={ROUTE_D} fill="none" stroke="var(--blue)" strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <path d={ROUTE_D} fill="none" stroke="#ffffffcc" strokeWidth="1.3" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="street cur" style={{ left: "12%", top: "91%" }}>{roadName}</div>
              <div className="street" style={{ left: "31%", top: "40%" }}>Noir Line →</div>
              <div className="street" style={{ left: "55%", top: "27%" }}>New Wave Way</div>
              <div className="street" style={{ left: "73%", top: "88%" }}>Neorealism Rd</div>
              <div className="street" style={{ left: "89%", top: "17%" }}>Formalist Blvd</div>
              {near.map((stop, i) => sp(stop, WAYPOINTS[i], i === 0))}
              {!destIsNear ? (
                <button type="button" className="sp dest" style={{ left: "90%", top: "33%" }} onClick={() => setPick(finalStop.film)}>
                  <span className="flag">🏁</span>
                  <img src={po(finalStop.film.poster_path)} alt="" style={{ width: 30, height: 45 }} loading="lazy" draggable={false} />
                  <span className="shadow" /><span className="cap">{finalStop.film.title}</span>
                </button>
              ) : null}
              <div className="me" style={{ left: "11%", top: "81%" }}><div className="chev" /><div className="dot" /><div className="back">↓ {stats.seenCount} behind you</div></div>
            </>
          )}
        </div>
        {/* map controls (outside the transformed layer) */}
        <div className="mapctl">
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1.25)}>＋</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(0.8)}>－</button>
          <button type="button" aria-label="Fit whole journey" onClick={fit}>◎</button>
        </div>
        {/* note when some route films aren't charted on the odyssey plane */}
        {scene && scene.missingCount > 0 ? (
          <div className="offmap">✦ {scene.missingCount} off-map film{scene.missingCount > 1 ? "s" : ""} placed by lineage</div>
        ) : null}
        {/* poster tap → a place card: director · year · TakeScore */}
        {pick ? (
          <div className="filmcard" onPointerDown={(e) => e.stopPropagation()}>
            <span className="fc-po" style={{ backgroundImage: `url(${po(pick.poster_path)})` }} />
            <div className="fc-tx">
              <div className="fc-t">{pick.title}</div>
              <div className="fc-m">{[pick.director, pick.year != null ? String(pick.year) : null].filter(Boolean).join(" · ") || "—"}</div>
              <div className="fc-s">
                {pick.takescore != null ? <><b>{Math.round(pick.takescore)}</b> TakeScore</> : "TakeScore —"}
                {pick.availability === "sub" ? " · ▶ Play now" : pick.availability === "rent" ? " · Rent" : ""}
              </div>
            </div>
            <Link className="fc-open" href={`/film/${pick.slug}`}>Open →</Link>
            <button type="button" className="fc-x" aria-label="Close" onClick={() => setPick(null)}>×</button>
          </div>
        ) : null}
      </div>

      {/* peek sheet — short by default so the map owns the screen; tap to expand */}
      <div className={`sheet${open ? " open" : ""}`}>
        <button type="button" className="grip" aria-label={open ? "Collapse" : "Expand"} onClick={() => setOpen((o) => !o)} />
        <div className="peek" onClick={() => setOpen((o) => !o)}>
          <div className="headline">
            <span className="dur">{fmtRuntimeK(stats.runtimeRemaining)}</span>
            <span className="films">{stats.remaining} films</span>
            <span className="soft">{open ? "time remaining" : "tap for detail"}{stats.etaWeeks ? ` · ~${stats.etaWeeks} wk` : ""}</span>
          </div>
          {!open ? <div className="peekbar"><span style={{ width: `${progressPct}%` }} /></div> : null}
        </div>
        {open ? (
          <>
            <div className="meter">
              <div className="track"><span className="done" style={{ width: `${donePct}%` }} /><span className="knob" style={{ left: `${donePct}%` }} /></div>
              <div className="ends">
                <span className="l"><span className="cap">Traveled</span><b>{stats.seenCount} films · {fmtHM(stats.runtimeTraveled)}</b></span>
                <span className="r"><span className="cap">Remaining</span><b>{stats.remaining} films · {fmtHM(stats.runtimeRemaining)}</b></span>
              </div>
            </div>
            <div className="prefs">
              {(["fewest", "fastest", "no_tolls"] as RoutePref[]).map((p) => (
                <Link key={p} className={p === pref ? "on" : ""} href={prefHref(p)} scroll={false}>
                  {p === "fewest" ? "Fewest" : p === "fastest" ? "Fastest" : "No tolls"}
                </Link>
              ))}
            </div>
            {/* the full remaining route — every film left, in drive order (Google-Maps "steps") */}
            <div className="steps">
              <div className="steps-h">Remaining route · {stats.remaining} films</div>
              <div className="steps-row">
                {route.stops.map((s, i) => (
                  <Link key={s.film.slug} href={`/film/${s.film.slug}`} className={`step${i === 0 ? " now" : ""}`} title={s.film.title}>
                    <span className="step-po" style={{ backgroundImage: `url(${po(s.film.poster_path)})` }}>
                      <span className="step-n">{i + 1}</span>
                    </span>
                    <span className="step-t">{s.film.title}</span>
                    <span className="step-m">{s.film.runtime ? `${s.film.runtime}m` : "—"}{s.toll ? " · toll" : s.film.availability === "sub" ? " · ▶" : ""}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="fnote">{progressPct}% complete · {dest.label} · position from your ledger · <Link href="/room/navigator">Change destination</Link></div>
          </>
        ) : null}
      </div>
    </div>
  );
}
