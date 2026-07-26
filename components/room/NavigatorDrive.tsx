"use client";
/**
 * NavigatorDrive — the web drive view (P3/P5). The familiar Google-Maps driving
 * shape: green turn card (next film) · a PANNABLE/ZOOMABLE map with standing
 * poster signposts · a collapsible peek sheet so the map owns the screen.
 * The route preference switches via a plain link (?pref=) — the server re-sorts
 * deterministically, no client math.
 *
 * The MAP is a Mario-style overworld whose HERO is the route: the ordered films
 * are laid along one clean, evenly-spaced, gently-flowing LANE (their real
 * /odyssey positions idealised into a legible road, not plotted as scattered
 * coords). Every non-route lineage + station is hard-faded to muted grey context
 * behind it. The lane's length scales with the number of remaining films and the
 * initial zoom adapts to journey size — short journeys frame intimately, long
 * journeys frame the road ahead and pan forward. If the odyssey data hasn't
 * loaded (or no film is on the map) the original synthetic overworld is drawn.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { DriveLoad } from "@/lib/navigator/load";
import type { RoutePref, RouteStop, NavFilm } from "@/lib/navigator/route";
import { turnReason, fmtRuntimeK, fmtHM } from "@/lib/navigator/route";
import type { OdyMap } from "@/lib/odyssey/types";

const POSTER = "https://image.tmdb.org/t/p/w185";
const POSTER92 = "https://image.tmdb.org/t/p/w92";
const po = (p: string | null) => (p ? `${POSTER}${p}` : "");

/* The synthetic fallback overworld (viewBox 0-100) + its poster stops. */
const ROUTE_D = "M11,80 C18,70 22,64 27,60 C34,55 40,68 45,72 C52,76 56,54 62,50 C68,46 74,56 78,60 C83,63 87,42 90,33";
const WAYPOINTS = [
  { top: 60, left: 27, w: 78 },
  { top: 72, left: 45, w: 64 },
  { top: 50, left: 62, w: 52 },
  { top: 60, left: 78, w: 44 },
];

/* Lane geometry, in "lane units" that equal % of the map's width. 100 units = one
   viewport wide, so nodes past 100 are reached by panning right. */
const SP = 20;   // even spacing between nodes (generous)
const X0 = 22;   // the first node's x (room for the "me" chevron on the left)
const AMP = 12;  // gentle vertical undulation of the lane

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r2 = (n: number) => Math.round(n * 100) / 100;

/* A smooth-through-points path (quadratic midpoints) for the flowing lane. */
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

/* Linear-interpolate null entries by index (edges hold the nearest known value). */
function fillNulls(a: Array<number | null>): void {
  const n = a.length;
  let first = -1;
  for (let i = 0; i < n; i++) if (a[i] != null) { first = i; break; }
  if (first < 0) return;
  for (let i = 0; i < first; i++) a[i] = a[first];
  let lastK = first;
  for (let i = first + 1; i < n; i++) {
    if (a[i] != null) {
      const v0 = a[lastK] as number, v1 = a[i] as number;
      for (let j = lastK + 1; j < i; j++) a[j] = v0 + (v1 - v0) * (j - lastK) / (i - lastK);
      lastK = i;
    }
  }
  for (let i = lastK + 1; i < n; i++) a[i] = a[lastK];
}

/* Moving-average smoothing (window ±w) — flattens the lane's drift so it reads
   as a gentle flow rather than a scribble. */
function smoothArr(a: number[], w: number): number[] {
  const n = a.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) { s += a[j]; c++; }
    out[i] = s / c;
  }
  return out;
}

/* Deterministic 0..1 hash of a slug — for stable, scattered background placement. */
function hsh(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

/* ── The odyssey-driven scene ─────────────────────────────────────────────── */

interface ScenePt { stop: RouteStop; nx: number; ny: number; w: number; now: boolean; dest: boolean; missing: boolean }
interface SceneCross { id: string; name: string; d: string; lx: number; ly: number }
interface SceneBgP { key: string; nx: number; ny: number; p: string }
interface SceneDot { key: string; nx: number; ny: number }
interface Scene {
  L: number;                 // total lane length, in lane units (= % of map width)
  routePts: ScenePt[];
  routeD: string;
  cross: SceneCross[];       // ambient (faded) lineage cross-streets
  bgPosters: SceneBgP[];
  bgDots: SceneDot[];
  me: { nx: number; ny: number };
  missingCount: number;
}

/**
 * Lay the journey out as the hero lane.
 *  1. The ordered stops become evenly-spaced nodes on a gently-flowing centreline.
 *     x is purely the drive order (clean, even); y drifts slightly with a smoothed,
 *     idealised echo of each film's real odyssey band, so the lane bends naturally.
 *     Films absent from the odyssey map keep their place in the sequence (their
 *     missing band is interpolated) — the lane never breaks.
 *  2. The real lineages the journey passes become faded grey cross-streets;
 *     nearby stations become faint background posters/dots — soft context only.
 *  3. The lane length grows with the film count (a long road you pan to follow).
 * Returns null when NO stop is on the map (caller draws the synthetic fallback).
 */
function buildScene(map: OdyMap, stops: RouteStop[]): Scene | null {
  const N = stops.length;
  if (!N) return null;
  const byId = new Map(map.stations.map((s) => [s.s, s]));

  // real vertical position per node (drives the gentle, idealised lane drift)
  const yReal: Array<number | null> = stops.map((s) => byId.get(s.film.slug)?.yy ?? null);
  const missing = stops.map((s) => !byId.has(s.film.slug));
  const knownCount = missing.filter((m) => !m).length;
  if (!knownCount) return null;
  fillNulls(yReal);
  let mn = Infinity, mx = -Infinity;
  for (const v of yReal) if (v != null) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  const span = mx - mn;
  const norm = yReal.map((v) => (span > 1 && v != null ? ((v - mn) / span) * 2 - 1 : 0));
  const drift = smoothArr(norm, 2);

  // the hero lane — evenly-spaced nodes on a gently flowing centreline
  const nodes = stops.map((stop, i) => ({
    stop, i,
    lx: X0 + i * SP,
    ly: clamp(50 + AMP * (0.55 * Math.sin(i * 0.7 + 0.6) + 0.45 * drift[i]), 30, 70),
  }));
  const L = Math.max(150, X0 + (N - 1) * SP + 40);
  const last = N - 1;
  const routePts: ScenePt[] = nodes.map((n) => ({
    stop: n.stop, nx: n.lx, ny: n.ly, w: clamp(58 - n.i * 2.5, 40, 58),
    now: n.i === 0, dest: n.i === last, missing: missing[n.i],
  }));
  const routeD = smoothD(nodes.map((n) => ({ x: n.lx, y: n.ly })));
  const me = { nx: X0 - SP * 0.55, ny: nodes[0].ly };

  // ambient cross-streets — the real lineages this journey passes, hard-faded,
  // spread across the whole lane so panning keeps revealing context
  const lineById = new Map(map.lines.map((l) => [l.id, l]));
  const touched: string[] = [];
  const seenL = new Set<string>();
  for (const s of stops) {
    const st = byId.get(s.film.slug);
    for (const id of st?.ln ?? []) if (!seenL.has(id)) { seenL.add(id); touched.push(id); }
  }
  const lineIds = touched.slice(0, 6);
  for (const l of map.lines) { if (lineIds.length >= 4) break; if (!seenL.has(l.id)) { seenL.add(l.id); lineIds.push(l.id); } }
  const cross: SceneCross[] = lineIds.map((id, idx) => {
    const cx = X0 + (idx + 0.5) * (L - X0) / Math.max(1, lineIds.length);
    return {
      id, name: lineById.get(id)?.name_en ?? "Lineage",
      d: `M${r2(cx)} 3 C${r2(cx + 6)} 30 ${r2(cx - 6)} 70 ${r2(cx)} 97`,
      lx: clamp(cx, 6, L - 4), ly: idx % 2 ? 12 : 88,
    };
  });

  // faint background population, scattered along the whole pannable lane
  const onRoute = new Set(stops.map((s) => s.film.slug));
  const cand = map.stations.filter((s) => !onRoute.has(s.s) && s.p);
  cand.sort((a, b) => (b.v ?? 0) - (a.v ?? 0));
  const posterN = Math.round(clamp(L / 46, 6, 22));
  const dotN = Math.round(clamp(L / 7, 40, 200));
  const bgPosters: SceneBgP[] = [];
  const bgDots: SceneDot[] = [];
  for (let i = 0; i < cand.length && (bgPosters.length < posterN || bgDots.length < dotN); i++) {
    const s = cand[i];
    const hx = hsh(s.s), hy = hsh(`${s.s}~`);
    const x = hx * L;
    const y = hy < 0.5 ? 5 + hy * 2 * 25 : 70 + (hy - 0.5) * 2 * 23; // top band [5,30] / bottom [70,93]
    if (bgPosters.length < posterN && i % 3 === 0) bgPosters.push({ key: s.s, nx: x, ny: y, p: s.p as string });
    else if (bgDots.length < dotN) bgDots.push({ key: s.s, nx: x, ny: y });
  }

  return { L, routePts, routeD, cross, bgPosters, bgDots, me, missingCount: N - knownCount };
}

/**
 * Adaptive default view. The zoom scales INVERSELY with the film count: a short
 * journey zooms in (big, intimate nodes), a long one holds a comfortable zoom and
 * frames the road ahead so you pan forward. "me"/the next film sits toward the
 * left third. Needs the map's pixel size (the pan transform is in px).
 */
function computeDefaultView(n: number, w: number, h: number): { tx: number; ty: number; k: number } {
  if (!w || !h) return { tx: 0, ty: 0, k: 1 };
  const k = clamp(2.0 - n * 0.16, 0.92, 1.85);
  const visSpan = 100 / k;               // % of lane width shown across the viewport
  const frameLx = (X0 - SP * 0.55) + visSpan * 0.30;
  return { tx: k * w * (0.5 - frameLx / 100), ty: 0, k };
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
  const [size, setSize] = useState({ w: 0, h: 0 }); // map viewport px (for adaptive framing)
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  // load the odyssey map once (same-origin static asset); silent fallback on failure
  useEffect(() => {
    let live = true;
    fetch("/odyssey/map.v1.json").then((r) => r.json()).then((m: OdyMap) => { if (live) setOdy(m); }).catch(() => {});
    return () => { live = false; };
  }, []);
  // measure the map viewport so the initial zoom can adapt to it
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const scene = useMemo(() => (ody ? buildScene(ody, route.stops) : null), [ody, route.stops]);
  const defaultView = useMemo(
    () => (scene ? computeDefaultView(scene.routePts.length, size.w, size.h) : { tx: 0, ty: 0, k: 1 }),
    [scene, size.w, size.h],
  );
  // re-frame when the journey (or viewport) changes — plain panning never triggers this
  useEffect(() => { setView(defaultView); }, [defaultView]);

  const onDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  }, [view.tx, view.ty]);
  const onMove = useCallback((e: React.PointerEvent) => {
    // Snapshot the drag origin + pointer coords into locals BEFORE setView. A functional
    // updater can run after onUp clears drag.current (fast flings batch updates), so it must
    // never read the ref — otherwise `drag.current!.tx` throws "reading 'tx' of null".
    const d = drag.current;
    if (!d) return;
    const cx = e.clientX, cy = e.clientY;
    setView((v) => ({ ...v, tx: d.tx + (cx - d.x), ty: d.ty + (cy - d.y) }));
  }, []);
  const onUp = useCallback(() => { drag.current = null; }, []);
  const onWheel = useCallback((e: React.WheelEvent) => {
    setView((v) => ({ ...v, k: clamp(v.k * (e.deltaY < 0 ? 1.12 : 0.89), 0.55, 3) }));
  }, []);
  const zoom = (f: number) => setView((v) => ({ ...v, k: clamp(v.k * f, 0.55, 3) }));
  const fit = () => setView(defaultView); // ◎ returns to the adaptive default, not a whole-world fit

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
            /* ── the real /odyssey journey: the hero lane over faded context ── */
            <>
              {/* back layer — soft terrain + faded lineage cross-streets */}
              <svg className="roadsvg" style={{ width: `${scene.L}%` }} viewBox={`0 0 ${scene.L} 100`} preserveAspectRatio="none" aria-hidden="true">
                <rect x="-10" y="-10" width={scene.L + 20} height="120" fill="#DCE9C2" opacity="0.5" />
                <rect x="-10" y="2" width={scene.L + 20} height="22" fill="#CFE0A8" opacity="0.3" />
                <rect x="-10" y="76" width={scene.L + 20} height="24" fill="#CFE0A8" opacity="0.3" />
                <rect x="-10" y="34" width={scene.L + 20} height="32" fill="#E9E1C6" opacity="0.5" />
                {scene.cross.map((c) => (
                  <g key={c.id}>
                    <path d={c.d} fill="none" stroke="#C3B89E" strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity="0.5" />
                    <path d={c.d} fill="none" stroke="#DAD1BA" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity="0.5" />
                  </g>
                ))}
              </svg>
              {/* faded background population — never competes with the route */}
              {scene.bgDots.map((d) => <span key={d.key} className="bgdot" style={{ left: `${d.nx}%`, top: `${d.ny}%` }} />)}
              {scene.bgPosters.map((bp) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={bp.key} className="bgp" src={`${POSTER92}${bp.p}`} alt="" aria-hidden="true" loading="lazy" draggable={false} style={{ left: `${bp.nx}%`, top: `${bp.ny}%` }} />
              ))}
              {/* THE journey — one bold, bright, evenly-flowing lane */}
              <svg className="roadsvg routesvg" style={{ width: `${scene.L}%` }} viewBox={`0 0 ${scene.L} 100`} preserveAspectRatio="none" aria-hidden="true">
                <path d={scene.routeD} fill="none" stroke="#2B5FB0" strokeWidth="14" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <path d={scene.routeD} fill="none" stroke="var(--blue)" strokeWidth="10" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <path d={scene.routeD} fill="none" stroke="#fff" strokeWidth="1.8" strokeDasharray="2.4 3.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              </svg>
              {/* faded lineage road-name signs */}
              {scene.cross.map((c) => <div key={c.id} className="street amb" style={{ left: `${c.lx}%`, top: `${c.ly}%` }}>{c.name}</div>)}
              <div className="street cur" style={{ left: `${scene.me.nx}%`, top: `${clamp(scene.me.ny + 10, 6, 94)}%` }}>{roadName}</div>
              {/* the route's films — prominent poster level nodes, in drive order */}
              {scene.routePts.map((rp, i) => (
                <button
                  type="button"
                  key={rp.stop.film.slug}
                  className={`sp${rp.now ? " now" : ""}${rp.dest ? " dest" : ""}`}
                  style={{ left: `${rp.nx}%`, top: `${rp.ny}%` }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setPick(rp.stop.film)}
                >
                  {rp.dest ? <span className="flag">🏁</span> : null}
                  <span className="num">{i + 1}</span>
                  <img src={po(rp.stop.film.poster_path)} alt="" style={{ width: rp.w, height: rp.w * 1.5 }} loading="lazy" draggable={false} />
                  <span className="pole" /><span className="shadow" />
                  {rp.now ? <span className="cap">Now · {rp.stop.film.title}</span>
                    : rp.dest || i < 4 ? <span className="cap">{rp.stop.film.title}</span> : null}
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
          <button type="button" aria-label="Reset view" onClick={fit}>◎</button>
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
