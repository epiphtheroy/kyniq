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
 *
 * The ~2,000 background stations live in a large pannable field (their real odyssey
 * x,yy mapped over an area bigger than the viewport). Google-Maps style, only the
 * films inside the current window + a one-screen buffer are rendered, recomputed
 * from the pan transform on a throttled rAF and capped — so panning keeps revealing
 * films with no blank flash and a fast fling never lags or crashes.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/* ── The odyssey-driven scene ─────────────────────────────────────────────── */

const BG_CAP = 250;     // max background stations rendered at once (viewport-culled)
const BG_POSTERS = 40;  // of those, the highest-TakeScore few render as posters (rest = dots)
const MAX_X = 4;        // max transit interchanges drawn on screen at once (keep it legible)

/** A crossing lineage line at an interchange — its name/colour + a few nearby member films. */
interface XLine { name: string; color: string; members: NavFilm[] }
interface ScenePt { stop: RouteStop; nx: number; ny: number; w: number; now: boolean; dest: boolean; missing: boolean; x?: XLine }
interface SceneCross { id: string; name: string; d: string; lx: number; ly: number }
/** A non-route station in the pannable "field" — its real odyssey (x,yy) mapped to lane units. */
interface BgStation { key: string; fx: number; fy: number; v: number; p: string }
interface Scene {
  L: number;                 // total lane length, in lane units (= % of map width)
  routePts: ScenePt[];
  routeD: string;
  cross: SceneCross[];       // ambient (faded) lineage cross-streets
  bgAll: BgStation[];        // the whole background field (v-sorted desc), culled per-view
  me: { nx: number; ny: number };
  missingCount: number;
}

/** The field-coordinate window currently visible, padded by one screen on every side
 *  (the pre-render buffer). Inverts the pan transform (translate·scale, origin 50%):
 *  a node at left:lx% sits at px = lx/100·w, screen = w/2 + k·(px − w/2) + tx. */
function visibleWindow(tx: number, ty: number, k: number, w: number, h: number) {
  const fx = (sx: number) => 100 * ((sx - tx - w / 2) / k + w / 2) / w;
  const fy = (sy: number) => 100 * ((sy - ty - h / 2) / k + h / 2) / h;
  return { lxMin: fx(-w), lxMax: fx(2 * w), lyMin: fy(-h), lyMax: fy(2 * h) };
}

/** The highest-TakeScore background stations inside the buffered window, capped. bg is
 *  v-sorted desc, so iterating in order and stopping at the cap keeps the strongest films. */
function cullField(bg: BgStation[], win: { lxMin: number; lxMax: number; lyMin: number; lyMax: number }, cap: number): BgStation[] {
  const out: BgStation[] = [];
  for (let i = 0; i < bg.length && out.length < cap; i++) {
    const b = bg[i];
    if (b.fx >= win.lxMin && b.fx <= win.lxMax && b.fy >= win.lyMin && b.fy <= win.lyMax) out.push(b);
  }
  return out;
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

  // background FIELD — every non-route station at its real odyssey position, mapped over
  // an area wider & taller than the viewport so panning keeps revealing films. This is the
  // full pool (v-sorted); the rendered subset is viewport-culled per-view (see cullField).
  const onRoute = new Set(stops.map((s) => s.film.slug));
  let ox0 = Infinity, ox1 = -Infinity, oy0 = Infinity, oy1 = -Infinity;
  for (const s of map.stations) {
    if (s.x < ox0) ox0 = s.x; if (s.x > ox1) ox1 = s.x;
    if (s.yy < oy0) oy0 = s.yy; if (s.yy > oy1) oy1 = s.yy;
  }
  const oxs = ox1 - ox0 || 1, oys = oy1 - oy0 || 1;
  const FW = Math.max(L + 140, 360), FH = 250;          // field spans, in lane units
  const FX0 = (X0 + L) / 2 - FW / 2, FY0 = 50 - FH / 2; // centred on the lane
  const bgAll: BgStation[] = [];
  for (const s of map.stations) {
    if (onRoute.has(s.s) || !s.p) continue;
    bgAll.push({
      key: s.s,
      fx: FX0 + ((s.x - ox0) / oxs) * FW,
      fy: FY0 + ((s.yy - oy0) / oys) * FH,
      v: s.v ?? 0, p: s.p,
    });
  }
  bgAll.sort((a, b) => b.v - a.v);

  // INTERCHANGES — a route film that also rides ANOTHER lineage line is a transfer station.
  // For each such stop, pick its strongest crossing line (the member-richest lineage it belongs
  // to) and 2–4 of that line's NEAREST members (by riding order, excluding the route film and any
  // other route film), so the node can branch perpendicular like a subway interchange. This is
  // data only — memoised with the scene, never recomputed on pan; rendering is culled + capped.
  const nearOrder = (n: number, idx: number): number[] => {
    const out: number[] = [];
    for (let d = 1; d < n && out.length < 10; d++) {
      if (idx - d >= 0) out.push(idx - d);
      if (idx + d < n) out.push(idx + d);
    }
    return out;
  };
  for (let i = 0; i < routePts.length; i++) {
    const st = byId.get(stops[i].film.slug);
    const lns = st?.ln;
    if (!st || !lns || lns.length < 2) continue; // interchange = station on ≥2 lines
    let best: OdyMap["lines"][number] | null = null;
    for (const id of lns) {
      const l = lineById.get(id);
      if (l && (!best || l.stations.length > best.stations.length)) best = l;
    }
    if (!best) continue;
    const idx = best.stations.indexOf(st.s);
    if (idx < 0) continue;
    const members: NavFilm[] = [];
    for (const j of nearOrder(best.stations.length, idx)) {
      if (members.length >= 4) break;
      const ms = byId.get(best.stations[j]);
      if (!ms || !ms.p || onRoute.has(ms.s)) continue; // need a poster; skip route films (no dupes)
      members.push({
        slug: ms.s, title: ms.t, year: ms.y, poster_path: ms.p ?? null, runtime: null,
        seen: false, availability: "none", director: ms.d ?? null, takescore: ms.v ?? null,
      });
    }
    if (members.length >= 2) routePts[i].x = { name: best.name_en, color: best.color, members };
  }

  return { L, routePts, routeD, cross, bgAll, me, missingCount: N - knownCount };
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
  const [culled, setCulled] = useState<BgStation[]>([]); // viewport-culled background films
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapviewRef = useRef<HTMLDivElement | null>(null);      // the pannable layer — transform written imperatively
  const viewRef = useRef({ tx: 0, ty: 0, k: 1 });              // live view (source of truth); `view` state lags on a throttle
  const commitTimerRef = useRef<number | null>(null);          // trailing-throttle handle for committing view → state
  const winSigRef = useRef<string>("");        // last culled-window signature (skip idle recomputes)
  const sceneRef = useRef<Scene | null>(null); // detect a new journey → force a recompute

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
  // Write the live view straight to the pannable layer's transform (GPU, no React render).
  const paint = useCallback(() => {
    const el = mapviewRef.current, v = viewRef.current;
    if (el) el.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.k})`;
  }, []);
  // Commit the live view → React state on a trailing throttle, so the culled node sets
  // (route full-poster window + background) re-cull ~7×/sec instead of every pan frame.
  const scheduleCommit = useCallback(() => {
    if (commitTimerRef.current != null) return; // one commit already in flight
    commitTimerRef.current = window.setTimeout(() => {
      commitTimerRef.current = null;
      setView({ ...viewRef.current });
    }, 140);
  }, []);
  useEffect(() => () => { if (commitTimerRef.current != null) clearTimeout(commitTimerRef.current); }, []);

  // re-frame when the journey (or viewport) changes — plain panning never triggers this
  useEffect(() => { viewRef.current = { ...defaultView }; setView(defaultView); paint(); }, [defaultView, paint]);

  // Throttled viewport culling (Google-Maps style): once per animation frame recompute which
  // background films fall inside the buffered window, and only when that window actually moved
  // — so a fast fling can't queue work or thrash React. Null-safe on every early exit; the rAF
  // callback reads only snapshot locals (tx/ty/k/bg), never a ref, so it can't crash mid-fling.
  useEffect(() => {
    if (!scene || !size.w || !size.h) { setCulled([]); winSigRef.current = ""; return; }
    if (sceneRef.current !== scene) { sceneRef.current = scene; winSigRef.current = ""; }
    const { tx, ty, k } = view;
    const bg = scene.bgAll;
    const id = requestAnimationFrame(() => {
      const wn = visibleWindow(tx, ty, k, size.w, size.h);
      const sig = `${Math.round(wn.lxMin / 5)}|${Math.round(wn.lxMax / 5)}|${Math.round(wn.lyMin / 5)}|${Math.round(wn.lyMax / 5)}`;
      if (sig === winSigRef.current) return; // window unchanged → keep current set (cheap idle)
      winSigRef.current = sig;
      setCulled(cullField(bg, wn, BG_CAP)); // BACKGROUND culling only (route uses the live window)
    });
    return () => cancelAnimationFrame(id);
  }, [scene, view, size.w, size.h]);

  const onDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const v = viewRef.current;
    drag.current = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty };
  }, []);
  const onMove = useCallback((e: React.PointerEvent) => {
    // Snapshot the drag origin into a local BEFORE touching anything else (onUp can clear
    // drag.current mid-fling → reading the ref later throws). Panning is a CHEAP transform:
    // update the live ref + paint the DOM directly, NO setState — so no per-frame re-render.
    const d = drag.current;
    if (!d) return;
    viewRef.current = { ...viewRef.current, tx: d.tx + (e.clientX - d.x), ty: d.ty + (e.clientY - d.y) };
    paint();
    scheduleCommit();
  }, [paint, scheduleCommit]);
  const onUp = useCallback(() => {
    drag.current = null;
    if (commitTimerRef.current != null) { clearTimeout(commitTimerRef.current); commitTimerRef.current = null; }
    setView({ ...viewRef.current }); // final commit → cull exactly at the resting position
  }, []);
  const onWheel = useCallback((e: React.WheelEvent) => {
    const v = viewRef.current;
    viewRef.current = { ...v, k: clamp(v.k * (e.deltaY < 0 ? 1.12 : 0.89), 0.55, 3) };
    paint();
    scheduleCommit();
  }, [paint, scheduleCommit]);
  const zoom = (f: number) => {
    const v = viewRef.current;
    viewRef.current = { ...v, k: clamp(v.k * f, 0.55, 3) };
    paint();
    setView({ ...viewRef.current });
  };
  const fit = () => { viewRef.current = { ...defaultView }; paint(); setView({ ...defaultView }); }; // ◎ → adaptive default

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

  // Route-node culling. The window is computed DIRECTLY from the live view every render
  // (cheap, O(1)) so poster coverage never lags the pan transform: every node on screen —
  // plus a full one-screen buffer on each side — renders as a FULL POSTER, and panning
  // keeps turning the next ones into posters. A wider band renders lightweight numbered
  // dots (for 1000-stop lists); the rest render nothing (the SVG lane still shows the road).
  // Background stays on the throttled `culled` set (its lag is invisible).
  const rWin = size.w && size.h ? visibleWindow(view.tx, view.ty, view.k, size.w, size.h) : null;
  const rPad = rWin ? (rWin.lxMax - rWin.lxMin) * 0.6 : 0;
  const inWin = (nx: number, ny: number) =>
    !!rWin && nx >= rWin.lxMin && nx <= rWin.lxMax && ny >= rWin.lyMin && ny <= rWin.lyMax;
  const inDotBand = (nx: number, ny: number) =>
    !!rWin && nx >= rWin.lxMin - rPad && nx <= rWin.lxMax + rPad && ny >= rWin.lyMin - rPad && ny <= rWin.lyMax + rPad;

  // Draw interchanges only for the NEAREST (lowest drive-index) ~4 that are in view — so a big
  // drive with many transfer stations never clutters. Bounded scan, cheap; runs only on commits.
  const xIdx = new Set<number>();
  if (scene && rWin) {
    for (let i = 0; i < scene.routePts.length && xIdx.size < MAX_X; i++) {
      const rp = scene.routePts[i];
      if (rp.x && inWin(rp.nx, rp.ny)) xIdx.add(i);
    }
  }
  // A transfer station's perpendicular branch: the crossing line's few nearby films, stacked
  // vertically clear of the standing route poster (above it) and its caption/pole (below).
  const renderX = (rp: ScenePt) => {
    const x = rp.x!;
    const ph = size.h ? (rp.w * 1.5) / size.h * 100 : 16;      // standing-poster height, % of H
    const upY0 = rp.ny - ph - 3;                               // first slot above clears the poster
    const dnY0 = rp.ny + (size.h ? 3400 / size.h : 7) + 3;     // first slot below clears pole+caption
    const gap = 9;                                             // spacing between stacked crossing films
    let up = 0, dn = 0;
    const ys = x.members.map((_, k) => clamp(k % 2 === 0 ? upY0 - up++ * gap : dnY0 + dn++ * gap, 4, 96));
    const top = Math.min(rp.ny, ...ys), bot = Math.max(rp.ny, ...ys);
    return (
      <>
        <span className="xline" style={{ left: `${rp.nx}%`, top: `${top}%`, height: `${bot - top}%`, background: x.color }} />
        <span className="xlabel" style={{ left: `${rp.nx}%`, top: `${clamp(top - 3.5, 2, 97)}%`, background: x.color }}>{x.name}</span>
        {x.members.map((m, k) => (
          <button type="button" key={m.slug} className="xp" style={{ left: `${rp.nx}%`, top: `${ys[k]}%`, borderColor: x.color }}
            onPointerDown={(e) => e.stopPropagation()} onClick={() => setPick(m)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={po(m.poster_path)} alt="" loading="eager" draggable={false} />
          </button>
        ))}
      </>
    );
  };

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
        <div className="mapview" ref={mapviewRef} style={{ transform: `translate(${viewRef.current.tx}px, ${viewRef.current.ty}px) scale(${viewRef.current.k})` }}>
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
                    <path d={c.d} fill="none" stroke="#A2946C" strokeWidth="6.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity="0.9" />
                    <path d={c.d} fill="none" stroke="#DAD1B5" strokeWidth="2.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity="0.8" />
                  </g>
                ))}
              </svg>
              {/* faded background — viewport-culled from the full odyssey field, with a
                  one-screen pre-render buffer so panning reveals films with no blank flash */}
              {culled.slice(BG_POSTERS).map((b) => <span key={b.key} className="bgdot" style={{ left: `${b.fx}%`, top: `${b.fy}%` }} />)}
              {culled.slice(0, BG_POSTERS).map((b) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={b.key} className="bgp" src={`${POSTER92}${b.p}`} alt="" aria-hidden="true" loading="lazy" draggable={false} style={{ left: `${b.fx}%`, top: `${b.fy}%` }} />
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
              {/* the route's films — poster level nodes in drive order, VIEWPORT-CULLED:
                  full posters near the window (Now & the destination always), lightweight
                  numbered dots in a wider band, nothing far off (the SVG lane shows the road) */}
              {scene.routePts.map((rp, i) => {
                const full = rp.now || rp.dest || inWin(rp.nx, rp.ny) || (!rWin && i < 10);
                if (full) {
                  const f = rp.stop.film;
                  const meta = [f.year != null ? String(f.year) : null, f.director || null].filter(Boolean).join(" · ");
                  const ts = f.takescore != null ? Math.round(f.takescore) : null;
                  return (
                    <Fragment key={f.slug}>
                      {/* transit interchange: crossing lineage branches perpendicular (nearest ~4 in view) */}
                      {xIdx.has(i) ? renderX(rp) : null}
                      <button
                        type="button"
                        className={`sp${rp.now ? " now" : ""}${rp.dest ? " dest" : ""}`}
                        style={{ left: `${rp.nx}%`, top: `${rp.ny}%` }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setPick(f)}
                      >
                        {rp.dest ? <span className="flag">🏁</span> : null}
                        <span className="num">{i + 1}</span>
                        {ts != null ? <span className="ts">TS {ts}</span> : null}
                        {/* culled to the viewport already → load eagerly so every on-screen node shows its board */}
                        <img src={po(f.poster_path)} alt="" style={{ width: rp.w, height: rp.w * 1.5 }} loading="eager" draggable={false} />
                        <span className="pole" /><span className="shadow" />
                        <span className="cap">
                          <span className="cap-t">{rp.now ? "Now · " : ""}{f.title}</span>
                          {meta ? <span className="cap-m">{meta}</span> : null}
                        </span>
                      </button>
                    </Fragment>
                  );
                }
                if (inDotBand(rp.nx, rp.ny)) {
                  return <span key={rp.stop.film.slug} className="sp-dot" style={{ left: `${rp.nx}%`, top: `${rp.ny}%` }}>{i + 1}</span>;
                }
                return null;
              })}
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
