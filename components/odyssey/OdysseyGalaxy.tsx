"use client";

/**
 * OdysseyGalaxy — the cinephile film map as a similarity galaxy.
 *
 * Films are placed by t-SNE over their taste vectors (film_map_xy), drawn as
 * upright poster tiles once you zoom in. A soft hill-shaded terrain underneath
 * gives the field elevation — peaks rise where films cluster densely and where
 * canon standing + altitude run high, so the "canon summits" read as literal
 * mountains. Movement/genre LINES thread across the terrain as coloured paths —
 * the thing a pure t-SNE map lacks: roads you can follow. Zoom glides with
 * inertia toward a target. Personalization (seen films, streaming) is a
 * client-side overlay; the map artifact is identical for everyone.
 *
 * Canvas throughout (≈1.9k poster tiles + terrain). Forked from GalaxyView.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserFilms } from "@/components/UserFilmsProvider";
import type { OdyAvail, OdyMap, OdyStation } from "@/lib/odyssey/types";
import { MODES, propose, type ModeKey, type Proposal } from "@/lib/odyssey/modes";

const EMPTY_SET: ReadonlySet<string> = new Set();
const IMG = "https://image.tmdb.org/t/p";
const THUMB_MIN = 15; // node px height at which dots become posters
const LABEL_CAP = 200;
const WMIN = -112, WMAX = 112, WSPAN = WMAX - WMIN; // world bounds for terrain
const TN = 300; // terrain grid resolution
const EASE = 0.22; // camera inertia toward target

type View = { cx: number; cy: number; scale: number; pitch: number };
type Pt = OdyStation & { tx: number; ty: number };

export default function OdysseyGalaxy({ height = 640 }: { height?: number }) {
  const uf = useUserFilms();
  const seenSet = uf?.seenSlugs ?? EMPTY_SET;

  const [data, setData] = useState<OdyMap | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [avail, setAvail] = useState<OdyAvail | null>(null);
  const [country, setCountry] = useState<"KR" | "US">("US");
  const [showSeen, setShowSeen] = useState(true);
  const [showAvail, setShowAvail] = useState(false);
  const [showTerrain, setShowTerrain] = useState(true);
  const [hoverLine, setHoverLine] = useState<string | null>(null);
  const [solo, setSolo] = useState<string | null>(null);
  const [sel, setSel] = useState<OdyStation | null>(null);
  const [hover, setHover] = useState<{ st: OdyStation; sx: number; sy: number } | null>(null);
  const [prop, setProp] = useState<(Proposal & { mode: ModeKey }) | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [stageH, setStageH] = useState(760);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const view = useRef<View>({ cx: 4, cy: -3, scale: 0, pitch: 0 });
  const target = useRef<View>({ cx: 4, cy: -3, scale: 0, pitch: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean; tilt: boolean } | null>(null);
  const imgCache = useRef<Map<string, HTMLImageElement | "err">>(new Map());
  const labelCache = useRef<{ key: string; slugs: Set<string> }>({ key: "", slugs: new Set() });
  const terrainRef = useRef<HTMLCanvasElement | null>(null);
  const heightRef = useRef<Float32Array | null>(null); // normalized elevation, for tilt lift
  const drawRef = useRef<() => void>(() => {});
  const rafOn = useRef(false);
  const routeRef = useRef<{ from?: string; to: string } | null>(null);

  // ---------------------------------------------------------------- data
  useEffect(() => {
    fetch("/odyssey/map.v1.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(setData)
      .catch(() => setLoadError(true));
    try {
      if ((navigator.language || "").toLowerCase().startsWith("ko")) setCountry("KR");
      const cc = localStorage.getItem("ody.cc");
      if (cc === "KR" || cc === "US") setCountry(cc);
    } catch {}
  }, []);

  useEffect(() => {
    const fit = () => {
      setNarrow(window.innerWidth < 760);
      setStageH(Math.max(520, Math.min(window.innerHeight - 168, 1040)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const ensureAvail = useCallback((): Promise<OdyAvail | null> => {
    if (avail) return Promise.resolve(avail);
    return fetch("/odyssey/avail.v1.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((a: OdyAvail | null) => {
        if (a) setAvail(a);
        return a;
      })
      .catch(() => null);
  }, [avail]);

  useEffect(() => {
    if (showAvail) void ensureAvail();
    try {
      localStorage.setItem("ody.cc", country);
    } catch {}
  }, [showAvail, country, ensureAvail]);

  // stations that carry a t-SNE position (the galaxy layout)
  const pts = useMemo(
    () => (data?.stations ?? []).filter((s): s is Pt => s.tx != null && s.ty != null),
    [data],
  );
  const byId = useMemo(() => new Map(pts.map((s) => [s.s, s])), [pts]);
  const availCC = useMemo(() => (avail ? avail[country] ?? {} : null), [avail, country]);

  // ---------------------------------------------------------------- terrain
  // A hill-shaded height field: each film splats a gaussian weighted by
  // 1 + prestige + altitude, so dense + prestigious + demanding regions rise.
  useEffect(() => {
    if (!pts.length) return;
    const H = new Float32Array(TN * TN);
    const cell = WSPAN / TN;
    const sigma = 3.4 / cell; // world units → cells
    const rad = Math.ceil(sigma * 2.5);
    const g: number[] = [];
    for (let d = -rad; d <= rad; d++) g[d + rad] = Math.exp(-(d * d) / (2 * sigma * sigma));
    for (const s of pts) {
      const w = 0.5 + Math.min(1.4, (s.pr ?? 0) / 60) + ((s.c ?? 3) - 1) / 4 * 0.7;
      const gx = Math.round((s.tx! - WMIN) / cell);
      const gy = Math.round((s.ty! - WMIN) / cell);
      for (let dy = -rad; dy <= rad; dy++) {
        const yy = gy + dy;
        if (yy < 0 || yy >= TN) continue;
        const wy = g[dy + rad];
        for (let dx = -rad; dx <= rad; dx++) {
          const xx = gx + dx;
          if (xx < 0 || xx >= TN) continue;
          H[yy * TN + xx] += w * wy * g[dx + rad];
        }
      }
    }
    let hmax = 0;
    for (let i = 0; i < H.length; i++) if (H[i] > hmax) hmax = H[i];
    const inv = hmax > 0 ? 1 / hmax : 1;
    for (let i = 0; i < H.length; i++) H[i] *= inv; // normalize in place → 0..1
    heightRef.current = H;

    const tc = document.createElement("canvas");
    tc.width = TN;
    tc.height = TN;
    const tctx = tc.getContext("2d")!;
    const img = tctx.createImageData(TN, TN);
    // hillshade: light from upper-left; contour banding every ~0.11
    const lx = -0.5, ly = -0.7, lz = 0.5;
    for (let y = 0; y < TN; y++) {
      for (let x = 0; x < TN; x++) {
        const i = y * TN + x;
        const h = H[i];
        const hl = H[y * TN + Math.max(0, x - 1)];
        const hr = H[y * TN + Math.min(TN - 1, x + 1)];
        const hu = H[Math.max(0, y - 1) * TN + x];
        const hd = H[Math.min(TN - 1, y + 1) * TN + x];
        const nx = (hl - hr) * 11, ny = (hu - hd) * 11, nz = 1;
        const nl = Math.hypot(nx, ny, nz) || 1;
        let shade = (nx * lx + ny * ly + nz * lz) / nl; // -1..1
        shade = 0.5 + shade * 0.5;
        // elevation ramp: cool slate valley → warm paper plain → warm ridge summit
        const e = Math.pow(h, 0.7);
        let r = 224 - (1 - e) * 42 + (e > 0.5 ? (e - 0.5) * 64 : 0);
        let gg = 222 - (1 - e) * 32 + (e > 0.5 ? (e - 0.5) * 30 : 0);
        let b = 214 + (1 - e) * 10 - (e > 0.5 ? (e - 0.5) * 84 : 0);
        const s2 = 0.42 + shade * 0.82;
        r *= s2; gg *= s2; b *= s2;
        // contour banding
        const band = (h * 8) % 1;
        if (h > 0.06 && band < 0.1) { r *= 0.85; gg *= 0.85; b *= 0.85; }
        const o = i * 4;
        img.data[o] = Math.max(0, Math.min(255, r));
        img.data[o + 1] = Math.max(0, Math.min(255, gg));
        img.data[o + 2] = Math.max(0, Math.min(255, b));
        img.data[o + 3] = h > 0.015 ? 255 : Math.round(h / 0.015 * 255);
      }
    }
    tctx.putImageData(img, 0, 0);
    terrainRef.current = tc;
    drawRef.current();
  }, [pts]);

  // initial camera fit
  useEffect(() => {
    if (!pts.length || !canvasRef.current) return;
    const cv = canvasRef.current;
    const s = Math.min(cv.clientWidth, cv.clientHeight) / 210;
    view.current = { cx: 4, cy: -3, scale: s, pitch: 0 };
    target.current = { cx: 4, cy: -3, scale: s, pitch: 0 };
  }, [pts]);

  const ensureImg = useCallback((s: OdyStation) => {
    if (!s.p) return null;
    const got = imgCache.current.get(s.s);
    if (got === "err") return null;
    if (got) return got.complete && got.naturalWidth > 0 ? got : null;
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => drawRef.current();
    im.onerror = () => imgCache.current.set(s.s, "err");
    im.src = `${IMG}/w92${s.p}`;
    imgCache.current.set(s.s, im);
    return null;
  }, []);

  const lineById = useMemo(() => new Map((data?.lines ?? []).map((l) => [l.id, l])), [data]);

  // ---------------------------------------------------------------- draw
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !data) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== w * dpr || cv.height !== h * dpr) {
      cv.width = w * dpr;
      cv.height = h * dpr;
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!view.current.scale) return;
    const { cx, cy, scale, pitch } = view.current;
    const SX = (wx: number) => (wx - cx) * scale + w / 2;
    const SY = (wy: number) => (wy - cy) * scale + h / 2;

    // 3D tilt: cmd-drag pitches the camera toward the horizon. The terrain
    // becomes a real ridgeline landscape (mountains you look across), and each
    // film lifts onto its ridge by elevation — canon summits rise toward you.
    const tilted = pitch > 0.06;
    const cpi = Math.cos(pitch), spi = Math.sin(pitch);
    const horizon = h * 0.42;
    const cellW = WSPAN / TN;
    const LIFT = 300 * spi; // screen px a full-elevation (1.0) point rises under tilt
    const H = heightRef.current;
    const elevAt = (wx: number, wy: number) => {
      if (!H) return 0;
      const gx = Math.round((wx - WMIN) / cellW), gy = Math.round((wy - WMIN) / cellW);
      if (gx < 0 || gx >= TN || gy < 0 || gy >= TN) return 0;
      return H[gy * TN + gx];
    };
    // world → screen. Under tilt, y compresses toward the horizon and the point
    // rises by its elevation; base y (undistorted) drives depth sorting.
    const PROJ = (wx: number, wy: number, e?: number) => {
      const bx = (wx - cx) * scale + w / 2;
      const by = (wy - cy) * scale + h / 2;
      if (!tilted) return { x: bx, y: by, by };
      const ev = e ?? elevAt(wx, wy);
      return { x: bx, y: horizon + (by - horizon) * cpi - ev * LIFT, by };
    };

    // terrain
    if (showTerrain && terrainRef.current && !tilted) {
      // top-down: the hill-shaded image
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(terrainRef.current, 0, 0, TN, TN, SX(WMIN), SY(WMIN), WSPAN * scale, WSPAN * scale);
      ctx.globalAlpha = 1;
    } else if (showTerrain && terrainRef.current && tilted) {
      // tilted: the hill-shaded ground compressed toward the horizon, so you
      // look across it. Films then lift off it by elevation (see PROJ) — the
      // canon summits rise toward you as a 3-D point cloud over the terrain.
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 0.85;
      const left = SX(WMIN), fullTop = SY(WMIN), size = WSPAN * scale;
      const top = horizon + (fullTop - horizon) * cpi;
      ctx.drawImage(terrainRef.current, 0, 0, TN, TN, left, top, size, size * cpi);
      ctx.globalAlpha = 1;
    }

    const active = solo ?? hoverLine;
    const thumbH = Math.min(58, scale * 2.1);
    const useThumbs = thumbH >= THUMB_MIN;

    // lines (roads) — under the posters, projected through tilt.
    for (const l of data.lines) {
      const pp = l.stations.map((sl) => byId.get(sl)).filter((s): s is Pt => !!s);
      if (pp.length < 2) continue;
      // Faint by default so 35 lines don't smother the galaxy — the roads are
      // there as a wash you can sense, and a hovered/soloed line lights up.
      const dim = active ? (active === l.id ? 1 : 0.04) : (l.cls === "express" ? 0.05 : 0.1);
      ctx.globalAlpha = dim;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = active === l.id ? 3.6 : 1.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      let prev = { x: 0, y: 0 };
      for (let i = 0; i < pp.length; i++) {
        const q = PROJ(pp[i]!.tx, pp[i]!.ty);
        if (i === 0) { ctx.moveTo(q.x, q.y); prev = q; continue; }
        const mx = (prev.x + q.x) / 2, my = (prev.y + q.y) / 2;
        ctx.quadraticCurveTo(mx, my, q.x, q.y);
        prev = q;
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // route overlay (destination proposal)
    const rt = routeRef.current;
    if (rt) {
      const a = rt.from ? byId.get(rt.from) : null;
      const b = byId.get(rt.to);
      if (a && b) {
        const qa = PROJ(a.tx!, a.ty!), qb = PROJ(b.tx!, b.ty!);
        ctx.strokeStyle = "#E3120B";
        ctx.lineWidth = 2.6;
        ctx.setLineDash([2, 7]);
        ctx.beginPath();
        ctx.moveTo(qa.x, qa.y);
        ctx.lineTo(qb.x, qb.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // on-screen nodes, back-to-front (by base y) so lifted summits overlap correctly
    const onScreen: { s: OdyStation; sx: number; sy: number; by: number }[] = [];
    for (const s of pts) {
      const q = PROJ(s.tx!, s.ty!);
      if (q.x < -50 || q.y < -60 || q.x > w + 50 || q.y > h + 50) continue;
      onScreen.push({ s, sx: q.x, sy: q.y, by: q.by });
    }
    if (pitch > 0.01) onScreen.sort((a, b) => a.by - b.by);

    const onLine = active
      ? new Set(lineById.get(active)?.stations ?? [])
      : null;

    for (const o of onScreen) {
      const { s, sx, sy } = o;
      const faded = onLine && !onLine.has(s.s);
      ctx.globalAlpha = faded ? 0.25 : 1;
      const seen = showSeen && seenSet.has(s.s);
      const onSvc = showAvail && availCC && (availCC[s.s]?.length ?? 0) > 0;
      const im = useThumbs ? ensureImg(s) : null;
      if (im) {
        const th = thumbH, tw = th * (2 / 3);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(sx - tw / 2, sy - th / 2, tw, th, 2.5);
        ctx.clip();
        const nw = im.naturalWidth, nh = im.naturalHeight;
        const sA = nw / nh, dA = tw / th;
        let scw = nw, sch = nh, sx0 = 0, sy0 = 0;
        if (sA > dA) { scw = nh * dA; sx0 = (nw - scw) / 2; }
        else { sch = nw / dA; sy0 = (nh - sch) * 0.5; }
        ctx.drawImage(im, sx0, sy0, scw, sch, sx - tw / 2, sy - th / 2, tw, th);
        ctx.restore();
        ctx.lineWidth = seen ? 2.4 : 1;
        ctx.strokeStyle = seen ? "#E3120B" : "rgba(20,15,10,.55)";
        ctx.strokeRect(sx - tw / 2, sy - th / 2, tw, th);
        if (onSvc) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#0d9488";
          ctx.setLineDash([3, 2]);
          ctx.strokeRect(sx - tw / 2 - 2.5, sy - th / 2 - 2.5, tw + 5, th + 5);
          ctx.setLineDash([]);
        }
      } else {
        const r = s.pk ? 3.2 : s.ln?.length ? 2.4 : 1.7;
        ctx.beginPath();
        ctx.fillStyle = seen ? "#17140f" : s.pk ? "#b3261e" : "rgba(60,50,40,.72)";
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        if (onSvc) {
          ctx.beginPath();
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = "#0d9488";
          ctx.arc(sx, sy, r + 2.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // decluttered labels (importance = canon peak, then poster, then prestige)
    const viewKey = `${Math.round(cx * 8)}:${Math.round(cy * 8)}:${Math.round(scale * 8)}:${active ?? ""}`;
    if (labelCache.current.key !== viewKey) {
      const taken = new Set<string>();
      const slugs = new Set<string>();
      const imp = (s: OdyStation) => (s.pk ? 1e6 : 0) + (onLine?.has(s.s) ? 5e5 : 0) + (s.p ? 1e4 : 0) + (s.pr ?? 0);
      const sorted = [...onScreen].sort((a, b) => imp(b.s) - imp(a.s));
      const GX = 62, GY = 14;
      for (const o of sorted) {
        if (slugs.size >= LABEL_CAP) break;
        if (onLine && !onLine.has(o.s.s)) continue;
        const label = o.s.t.length > 22 ? o.s.t.slice(0, 21) + "…" : o.s.t;
        const lw = 8 + label.length * 5.8;
        const yr = Math.round(o.sy / GY);
        let free = true;
        for (let gx = Math.floor((o.sx + 6) / GX); gx <= Math.floor((o.sx + 6 + lw) / GX); gx++)
          if (taken.has(`${gx}:${yr}`)) { free = false; break; }
        if (!free) continue;
        for (let gx = Math.floor((o.sx + 6) / GX); gx <= Math.floor((o.sx + 6 + lw) / GX); gx++)
          taken.add(`${gx}:${yr}`);
        slugs.add(o.s.s);
      }
      labelCache.current = { key: viewKey, slugs };
    }
    ctx.font = "600 11px var(--font-display, ui-sans-serif, sans-serif)";
    ctx.textAlign = "left";
    for (const o of onScreen) {
      if (!labelCache.current.slugs.has(o.s.s)) continue;
      const label = o.s.t.length > 22 ? o.s.t.slice(0, 21) + "…" : o.s.t;
      const off = useThumbs ? thumbH / 3 + 4 : 6;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(250,249,246,.9)";
      ctx.strokeText(label, o.sx + off, o.sy + 3.5);
      ctx.fillStyle = "rgba(25,22,18,.95)";
      ctx.fillText(label, o.sx + off, o.sy + 3.5);
    }

    // selection / hover / proposal pulse
    const ring = (s: OdyStation, color: string, extra = 0) => {
      const q = PROJ(s.tx!, s.ty!);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = color;
      if (useThumbs) {
        const th = thumbH + extra, tw = (thumbH) * (2 / 3) + extra;
        ctx.strokeRect(q.x - tw / 2 - 2, q.y - th / 2 - 2, tw + 4, th + 4);
      } else {
        ctx.beginPath();
        ctx.arc(q.x, q.y, 6 + extra, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
    if (prop?.slug && byId.get(prop.slug)) {
      const s = byId.get(prop.slug)!;
      const q = PROJ(s.tx!, s.ty!);
      const pulse = 8 + (Math.sin(performance.now() * 0.005) + 1) * 7;
      ctx.strokeStyle = "rgba(227,18,11,.7)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(q.x, q.y, pulse + thumbH / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (sel) ring(sel, "#E3120B");
    if (hover && hover.st.s !== sel?.s) ring(hover.st, "#17140f");
  }, [data, pts, byId, lineById, solo, hoverLine, sel, hover, prop, showSeen, showAvail, showTerrain, availCC, seenSet, ensureImg]);

  useEffect(() => { drawRef.current = draw; }, [draw]);

  // camera inertia loop — glide view → target each frame, then draw
  useEffect(() => {
    rafOn.current = true;
    let raf = 0;
    const loop = () => {
      if (!rafOn.current) return;
      const v = view.current, t = target.current;
      const dz = t.scale - v.scale, dx = t.cx - v.cx, dy = t.cy - v.cy;
      const moving = Math.abs(dz) > 1e-3 || Math.abs(dx) > 1e-3 || Math.abs(dy) > 1e-3;
      if (moving) {
        v.scale += dz * EASE;
        v.cx += dx * EASE;
        v.cy += dy * EASE;
      }
      const pulsing = !!prop?.slug;
      if (moving || pulsing || document.visibilityState === "visible") {
        if (moving || pulsing) drawRef.current();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { rafOn.current = false; cancelAnimationFrame(raf); };
  }, [prop]);

  useEffect(() => { draw(); }, [draw, stageH, narrow]);

  // ---------------------------------------------------------------- interaction
  const pick = useCallback((mx: number, my: number): OdyStation | null => {
    const cv = canvasRef.current;
    if (!cv) return null;
    const w = cv.clientWidth, h = cv.clientHeight;
    const { cx, cy, scale, pitch } = view.current;
    const tilted = pitch > 0.06;
    const cpi = Math.cos(pitch), spi = Math.sin(pitch), horizon = h * 0.42, cellW = WSPAN / TN;
    const LIFT = 300 * spi;
    const Hf = heightRef.current;
    const ev = (wx: number, wy: number) => {
      if (!Hf) return 0;
      const gx = Math.round((wx - WMIN) / cellW), gy = Math.round((wy - WMIN) / cellW);
      if (gx < 0 || gx >= TN || gy < 0 || gy >= TN) return 0;
      return Hf[gy * TN + gx];
    };
    const tol = Math.max(9, Math.min(30, scale * 1.1));
    let best: OdyStation | null = null, bd = 9e9;
    for (const s of pts) {
      const bx = (s.tx! - cx) * scale + w / 2;
      const by = (s.ty! - cy) * scale + h / 2;
      const py = !tilted ? by : horizon + (by - horizon) * cpi - ev(s.tx!, s.ty!) * LIFT;
      const d = (bx - mx) ** 2 + (py - my) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return bd <= tol * tol ? best : null;
  }, [pts]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const t = target.current;
    const factor = Math.exp(-e.deltaY * 0.0014);
    const ns = Math.max(0.7, Math.min(90, t.scale * factor));
    // anchor the world point under the cursor (uses target, so gestures compose)
    const wx = (mx - cv.clientWidth / 2) / t.scale + t.cx;
    const wy = (my - cv.clientHeight / 2) / t.scale + t.cy;
    t.cx = wx - (mx - cv.clientWidth / 2) / ns;
    t.cy = wy - (my - cv.clientHeight / 2) / ns;
    t.scale = ns;
  }, []);

  const onDown = useCallback((e: React.MouseEvent) => {
    // cmd/ctrl-drag tilts the camera (look across the terrain); plain drag pans
    drag.current = { x: e.clientX, y: e.clientY, moved: false, tilt: e.metaKey || e.ctrlKey };
  }, []);
  const onMove = useCallback((e: React.MouseEvent) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    if (drag.current) {
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
      if (drag.current.tilt || e.metaKey || e.ctrlKey) {
        drag.current.tilt = true;
        view.current.pitch = Math.max(0, Math.min(0.95, view.current.pitch - dy * 0.006));
        target.current.pitch = view.current.pitch;
        labelCache.current.key = ""; // relayout labels under new tilt
      } else {
        const sc = view.current.scale;
        view.current.cx -= dx / sc;
        view.current.cy -= dy / sc;
        target.current.cx = view.current.cx;
        target.current.cy = view.current.cy;
        target.current.scale = view.current.scale;
      }
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      drawRef.current();
      return;
    }
    const p = pick(e.clientX - rect.left, e.clientY - rect.top);
    setHover(p ? { st: p, sx: e.clientX - rect.left, sy: e.clientY - rect.top } : null);
  }, [pick]);
  const onUp = useCallback((e: React.MouseEvent) => {
    const wasDrag = drag.current?.moved;
    drag.current = null;
    if (wasDrag) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const p = pick(e.clientX - rect.left, e.clientY - rect.top);
    if (!p) { setSel(null); setSolo(null); routeRef.current = null; return; }
    if (narrow) { window.location.assign(`/film/${p.s}`); return; }
    setSel(p);
    // clicking a film lights up the line running through it, so its whole
    // constellation of stops stands out (the owner's request)
    if (p.ln?.length) setSolo(p.ln[0]);
    else setSolo(null);
  }, [pick, narrow]);

  const flyTo = useCallback((s: OdyStation, minScale = 26) => {
    target.current = { cx: s.tx!, cy: s.ty!, scale: Math.max(target.current.scale, minScale), pitch: view.current.pitch };
  }, []);

  const focusLine = useCallback((id: string | null) => {
    setSolo(id);
    if (!id || !canvasRef.current) return;
    const l = lineById.get(id);
    if (!l) return;
    const pp = l.stations.map((sl) => byId.get(sl)).filter((s): s is Pt => !!s);
    if (!pp.length) return;
    const x1 = Math.min(...pp.map((p) => p.tx)), x2 = Math.max(...pp.map((p) => p.tx));
    const y1 = Math.min(...pp.map((p) => p.ty)), y2 = Math.max(...pp.map((p) => p.ty));
    const cv = canvasRef.current;
    const sc = Math.min(70, Math.max(3, Math.min(cv.clientWidth / (x2 - x1 + 30), cv.clientHeight / (y2 - y1 + 30))));
    target.current = { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, scale: sc, pitch: view.current.pitch };
  }, [lineById, byId]);

  const runMode = useCallback(async (mode: ModeKey) => {
    if (!data) return;
    let a = availCC;
    if (mode === "tonight" && !a) {
      const full = await ensureAvail();
      a = full ? full[country] ?? {} : null;
    }
    const p = propose(mode, { map: data, seen: seenSet, avail: a });
    if (!p) {
      setProp({ mode, slug: "", reason: "Nothing left to propose here — you have ridden this one dry." });
      routeRef.current = null;
      return;
    }
    setProp({ ...p, mode });
    routeRef.current = { from: p.from, to: p.slug };
    if (p.line) setSolo(p.line); else setSolo(null);
    const st = byId.get(p.slug);
    if (st) { setSel(st); flyTo(st, 24); }
  }, [data, availCC, ensureAvail, country, seenSet, byId, flyTo]);

  // deep link ?line=
  useEffect(() => {
    if (!data) return;
    try {
      const q = new URLSearchParams(window.location.search).get("line");
      if (q && data.lines.some((l) => l.id === q)) focusLine(q);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ---------------------------------------------------------------- render
  if (loadError) {
    return (
      <div className="ody-loading">
        The map could not load.{" "}
        <button className="ody-retry" onClick={() => { setLoadError(false);
          fetch("/odyssey/map.v1.json").then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then(setData).catch(() => setLoadError(true)); }}>Retry</button>
      </div>
    );
  }
  if (!data) return <div className="ody-loading">Charting the galaxy…</div>;

  const active = solo ?? hoverLine;

  return (
    <div className="odg-root">
      <div className="ody-toolbar">
        <div className="ody-chips" role="listbox" aria-label="Lines">
          {solo ? <button className="ody-chip ody-clear" onClick={() => focusLine(null)}>← All lines</button> : null}
          {data.lines.map((l) => (
            <button
              key={l.id}
              className="ody-chip"
              aria-pressed={solo === l.id}
              style={{ ["--lc" as string]: l.color }}
              onMouseEnter={() => setHoverLine(l.id)}
              onMouseLeave={() => setHoverLine(null)}
              onClick={() => focusLine(solo === l.id ? null : l.id)}
            >
              <span className="dot" />
              {l.name_en.replace(/ Line$/, "")}
              <span className="n">{l.stations.length}</span>
            </button>
          ))}
        </div>
        <div className="ody-controls">
          <label className="ody-tog"><input type="checkbox" checked={showSeen} onChange={(e) => setShowSeen(e.target.checked)} /> My films</label>
          <label className="ody-tog"><input type="checkbox" checked={showAvail} onChange={(e) => setShowAvail(e.target.checked)} /> On my services</label>
          <label className="ody-tog"><input type="checkbox" checked={showTerrain} onChange={(e) => { setShowTerrain(e.target.checked); requestAnimationFrame(() => drawRef.current()); }} /> Terrain</label>
          <select className="ody-cc" value={country} onChange={(e) => setCountry(e.target.value === "KR" ? "KR" : "US")} aria-label="Streaming country">
            <option value="US">US</option>
            <option value="KR">KR</option>
          </select>
        </div>
      </div>

      <div className="odg-stage" ref={wrapRef} style={{ height: stageH }}>
        <canvas
          ref={canvasRef}
          className="odg-canvas"
          style={{ cursor: hover ? "pointer" : "grab" }}
          onWheel={onWheel}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={() => { drag.current = null; setHover(null); }}
        />

        <div className="odg-hint">스크롤 확대 · 드래그 이동 · ⌘/Ctrl+드래그로 지형을 기울여 보기 · 영화를 누르면 그 노선이 켜집니다</div>

        {hover && hover.st.s !== sel?.s ? (
          <div className="odg-tip" style={{
            left: Math.min(hover.sx + 14, (wrapRef.current?.clientWidth ?? 300) - 210),
            top: Math.min(hover.sy + 14, stageH - 64),
          }}>
            <b>{hover.st.t}</b> <span>{hover.st.y ?? ""}</span>
            {hover.st.ln?.length ? <div className="ln">{hover.st.ln.map((id) => lineById.get(id)?.name_en).filter(Boolean).join(" · ")}</div> : null}
          </div>
        ) : null}

        {sel && !narrow ? (
          <aside className="ody-card odg-card">
            <button className="x" onClick={() => setSel(null)} aria-label="Close">×</button>
            <div className="row">
              {sel.p ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${IMG}/w154${sel.p}`} alt="" width={72} height={108} />
              ) : null}
              <div>
                <div className="ttl">{sel.t} <span className="yr">{sel.y ?? ""}</span></div>
                {sel.tk ? <div className="tko">{sel.tk}</div> : null}
                {sel.d ? <div className="dir">{sel.d}</div> : null}
                <div className="alt" title="Altitude — how much the film asks of you">
                  {"▲".repeat(sel.c)}{"△".repeat(5 - sel.c)} <span>altitude {sel.c}/5</span>
                  {sel.pk ? <span className="peak"> · canon peak</span> : null}
                </div>
              </div>
            </div>
            {sel.ln?.length ? (
              <div className="lns">
                {sel.ln.map((id) => {
                  const l = lineById.get(id);
                  if (!l) return null;
                  return <button key={id} style={{ ["--lc" as string]: l.color }} onClick={() => focusLine(id)}><span className="dot" /> {l.name_en}</button>;
                })}
              </div>
            ) : null}
            {showAvail && availCC?.[sel.s]?.length ? <div className="avl">Streaming ({country}): {availCC[sel.s].slice(0, 4).join(" · ")}</div> : null}
            <div className="cta">
              <a href={`/film/${sel.s}`}>Film page</a>
              <a href={`/whereto/${sel.s}`}>Where to watch</a>
              {uf ? <button className={uf.get({ slug: sel.s }).seen ? "on" : ""} onClick={() => uf.toggleSeen({ slug: sel.s })}>{uf.get({ slug: sel.s }).seen ? "✓ Seen" : "Mark seen"}</button> : null}
            </div>
          </aside>
        ) : null}
      </div>

      <div className="ody-dest">
        <div className="head">
          <h2>Destinations</h2>
          <p>You do not type a destination — the map proposes one. Pick a mode and it flies you there.</p>
        </div>
        <div className="modes">
          {MODES.map((m) => (
            <button key={m.key} className="mode" aria-pressed={prop?.mode === m.key} title={m.hint} onClick={() => void runMode(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
        {prop ? (
          <div className="result">
            {prop.slug && byId.get(prop.slug) ? (
              <>
                <span className="dest">{byId.get(prop.slug)!.t} {byId.get(prop.slug)!.y ? `(${byId.get(prop.slug)!.y})` : ""}</span>{" "}
                — {prop.reason} <a href={`/film/${prop.slug}`}>Open film page →</a>
              </>
            ) : prop.reason}
          </div>
        ) : null}
        {!uf?.uid ? <p className="anon">Sign in and mark films you have seen — the map lights up your territory and every proposal starts from where you actually stand.</p> : null}
      </div>
    </div>
  );
}
