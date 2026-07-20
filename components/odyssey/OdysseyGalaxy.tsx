"use client";

/**
 * OdysseyGalaxy — the cinephile film map as a flat time × tendency plane.
 *
 * Layout: x = generation (release year, left→right), y = taste tendency (the
 * t-SNE axis over film_taste_vector), so films of a kindred sensibility stack
 * vertically while cinema flows through the decades horizontally. Films are
 * upright poster tiles once you zoom in. Movement/genre LINES thread across the
 * plane as coloured roads — and because each movement sits in a narrow band of
 * years, its road reads as a legible vertical streak rather than a scribble.
 *
 * The plane is flat, but the CAMERA can tilt (⌘/Ctrl-drag): the view pitches so
 * you look across the plane, which spreads the roads out and makes them easier
 * to trace. Personalization (seen films, streaming) is a client-side overlay.
 *
 * Canvas throughout (≈1.9k poster tiles). Forked from GalaxyView.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserFilms } from "@/components/UserFilmsProvider";
import type { OdyAvail, OdyMap, OdyStation } from "@/lib/odyssey/types";
import { MODES, propose, type ModeKey, type Proposal } from "@/lib/odyssey/modes";

const EMPTY_SET: ReadonlySet<string> = new Set();
const IMG = "https://image.tmdb.org/t/p";
const THUMB_MIN = 15; // node px height at which dots become posters
const LABEL_CAP = 200;
const EASE = 0.22; // camera inertia toward target
const XPER = 3.4; // world x-units per year (time axis)
const YSCALE = 1.15; // world y stretch of the tendency axis

type View = { cx: number; cy: number; scale: number; pitch: number };
type Pt = OdyStation & { tx: number; ty: number };

export default function OdysseyGalaxy() {
  const uf = useUserFilms();
  const seenSet = uf?.seenSlugs ?? EMPTY_SET;

  const [data, setData] = useState<OdyMap | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [avail, setAvail] = useState<OdyAvail | null>(null);
  const [country, setCountry] = useState<"KR" | "US">("US");
  const [showSeen, setShowSeen] = useState(true);
  const [showAvail, setShowAvail] = useState(false);
  const [hoverLine, setHoverLine] = useState<string | null>(null);
  const [solo, setSolo] = useState<string | null>(null);
  const [sel, setSel] = useState<OdyStation | null>(null);
  const [hover, setHover] = useState<{ st: OdyStation; sx: number; sy: number } | null>(null);
  const [prop, setProp] = useState<(Proposal & { mode: ModeKey }) | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [stageH, setStageH] = useState(760);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const view = useRef<View>({ cx: 0, cy: 0, scale: 0, pitch: 0 });
  const target = useRef<View>({ cx: 0, cy: 0, scale: 0, pitch: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean; tilt: boolean } | null>(null);
  const imgCache = useRef<Map<string, HTMLImageElement | "err">>(new Map());
  const labelCache = useRef<{ key: string; slugs: Set<string> }>({ key: "", slugs: new Set() });
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

  const pts = useMemo(
    () => (data?.stations ?? []).filter((s): s is Pt => s.tx != null && s.ty != null),
    [data],
  );
  const byId = useMemo(() => new Map(pts.map((s) => [s.s, s])), [pts]);
  const availCC = useMemo(() => (avail ? avail[country] ?? {} : null), [avail, country]);
  const lineById = useMemo(() => new Map((data?.lines ?? []).map((l) => [l.id, l])), [data]);

  // ---- layout: x = year (generation), y = taste tendency (t-SNE y) -----------
  const midYear = useMemo(() => {
    let lo = 1e9, hi = -1e9;
    for (const s of pts) {
      const yr = s.y ?? 0;
      if (yr) { if (yr < lo) lo = yr; if (yr > hi) hi = yr; }
    }
    return lo > hi ? 1970 : (lo + hi) / 2;
  }, [pts]);
  const wx = useCallback((s: OdyStation) => ((s.y ?? midYear) - midYear) * XPER, [midYear]);
  const wy = useCallback((s: Pt) => s.ty * YSCALE, []);
  const decades = useMemo(() => {
    const out: number[] = [];
    for (let d = 1900; d <= 2030; d += 10) out.push(d);
    return out;
  }, []);

  // initial camera fit: frame the whole time span
  useEffect(() => {
    if (!pts.length || !canvasRef.current) return;
    const cv = canvasRef.current;
    let x0 = 1e9, x1 = -1e9;
    for (const s of pts) { const x = wx(s); if (x < x0) x0 = x; if (x > x1) x1 = x; }
    const span = Math.max(200, x1 - x0);
    const s = (cv.clientWidth * 0.92) / span;
    view.current = { cx: 0, cy: 0, scale: s, pitch: 0 };
    target.current = { cx: 0, cy: 0, scale: s, pitch: 0 };
  }, [pts, wx]);

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

  // ---------------------------------------------------------------- draw
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !data) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!view.current.scale) return;
    const { cx, cy, scale, pitch } = view.current;
    const tilted = pitch > 0.06;
    const cpi = Math.cos(pitch), horizon = h * 0.4;
    // world → screen; a vertical tilt pitches the flat plane toward a horizon.
    const PX = (x: number) => (x - cx) * scale + w / 2;
    const PY = (y: number) => {
      const by = (y - cy) * scale + h / 2;
      return tilted ? horizon + (by - horizon) * cpi : by;
    };

    const active = solo ?? hoverLine;
    const thumbH = Math.min(58, scale * 2.1);
    const useThumbs = thumbH >= THUMB_MIN;

    // decade gridlines + labels (the time axis)
    ctx.save();
    ctx.strokeStyle = "rgba(120,110,95,0.14)";
    ctx.fillStyle = "rgba(120,110,95,0.6)";
    ctx.lineWidth = 1;
    ctx.font = "600 11px var(--font-display, ui-sans-serif, sans-serif)";
    ctx.textAlign = "center";
    for (const d of decades) {
      const x = PX((d - midYear) * XPER);
      if (x < -20 || x > w + 20) continue;
      ctx.beginPath();
      ctx.moveTo(x, PY(-130));
      ctx.lineTo(x, PY(130));
      ctx.stroke();
      ctx.fillText(String(d), x, tilted ? PY(130) + 14 : h - 8);
    }
    ctx.restore();

    // lines (roads) — under the posters, projected through the tilt.
    for (const l of data.lines) {
      const pp = l.stations.map((sl) => byId.get(sl)).filter((s): s is Pt => !!s);
      if (pp.length < 2) continue;
      const dim = active ? (active === l.id ? 1 : 0.05) : (l.cls === "express" ? 0.06 : 0.13);
      ctx.globalAlpha = dim;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = active === l.id ? 3.4 : 1.3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      let prev = { x: 0, y: 0 };
      for (let i = 0; i < pp.length; i++) {
        const p = pp[i]!;
        const x = PX(wx(p)), y = PY(wy(p));
        if (i === 0) { ctx.moveTo(x, y); prev = { x, y }; continue; }
        const mx = (prev.x + x) / 2, my = (prev.y + y) / 2;
        ctx.quadraticCurveTo(mx, my, x, y);
        prev = { x, y };
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
        ctx.strokeStyle = "#E3120B";
        ctx.lineWidth = 2.6;
        ctx.setLineDash([2, 7]);
        ctx.beginPath();
        ctx.moveTo(PX(wx(a)), PY(wy(a)));
        ctx.lineTo(PX(wx(b)), PY(wy(b)));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // on-screen nodes, back-to-front so nearer posters overlap correctly
    const onScreen: { s: Pt; sx: number; sy: number; by: number }[] = [];
    for (const s of pts) {
      const sx = PX(wx(s));
      const byRaw = (wy(s) - cy) * scale + h / 2;
      const sy = PY(wy(s));
      if (sx < -50 || sy < -60 || sx > w + 50 || sy > h + 60) continue;
      onScreen.push({ s, sx, sy, by: byRaw });
    }
    if (tilted) onScreen.sort((a, b) => a.by - b.by);

    const onLine = active ? new Set(lineById.get(active)?.stations ?? []) : null;

    for (const o of onScreen) {
      const { s, sx, sy } = o;
      const faded = onLine && !onLine.has(s.s);
      ctx.globalAlpha = faded ? 0.22 : 1;
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
        ctx.strokeStyle = seen ? "#E3120B" : "rgba(20,15,10,.5)";
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

    // decluttered labels
    const viewKey = `${Math.round(cx * 8)}:${Math.round(cy * 8)}:${Math.round(scale * 8)}:${Math.round(pitch * 40)}:${active ?? ""}`;
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
    const ring = (s: Pt, color: string, extra = 0) => {
      const x = PX(wx(s)), y = PY(wy(s));
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = color;
      if (useThumbs) {
        const th = thumbH + extra, tw = thumbH * (2 / 3) + extra;
        ctx.strokeRect(x - tw / 2 - 2, y - th / 2 - 2, tw + 4, th + 4);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 6 + extra, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
    if (prop?.slug && byId.get(prop.slug)) {
      const s = byId.get(prop.slug)!;
      const x = PX(wx(s)), y = PY(wy(s));
      const pulse = 8 + (Math.sin(performance.now() * 0.005) + 1) * 7;
      ctx.strokeStyle = "rgba(227,18,11,.7)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, pulse + thumbH / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (sel && byId.get(sel.s)) ring(byId.get(sel.s)!, "#E3120B");
    if (hover && hover.st.s !== sel?.s && byId.get(hover.st.s)) ring(byId.get(hover.st.s)!, "#17140f");
  }, [data, pts, byId, lineById, solo, hoverLine, sel, hover, prop, showSeen, showAvail, availCC, seenSet, ensureImg, wx, wy, midYear, decades]);

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
      if (moving) { v.scale += dz * EASE; v.cx += dx * EASE; v.cy += dy * EASE; }
      if (moving || prop?.slug) drawRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { rafOn.current = false; cancelAnimationFrame(raf); };
  }, [prop]);

  useEffect(() => { draw(); }, [draw, stageH, narrow]);

  // ---------------------------------------------------------------- interaction
  const pick = useCallback((mx: number, my: number): Pt | null => {
    const cv = canvasRef.current;
    if (!cv) return null;
    const w = cv.clientWidth, h = cv.clientHeight;
    const { cx, cy, scale, pitch } = view.current;
    const tilted = pitch > 0.06;
    const cpi = Math.cos(pitch), horizon = h * 0.4;
    const tol = Math.max(9, Math.min(30, scale * 1.1));
    let best: Pt | null = null, bd = 9e9;
    for (const s of pts) {
      const sx = (wx(s) - cx) * scale + w / 2;
      const by = (wy(s) - cy) * scale + h / 2;
      const sy = tilted ? horizon + (by - horizon) * cpi : by;
      const d = (sx - mx) ** 2 + (sy - my) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return bd <= tol * tol ? best : null;
  }, [pts, wx, wy]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const t = target.current;
    const factor = Math.exp(-e.deltaY * 0.0014);
    const ns = Math.max(0.5, Math.min(90, t.scale * factor));
    const wxp = (mx - cv.clientWidth / 2) / t.scale + t.cx;
    const wyp = (my - cv.clientHeight / 2) / t.scale + t.cy;
    t.cx = wxp - (mx - cv.clientWidth / 2) / ns;
    t.cy = wyp - (my - cv.clientHeight / 2) / ns;
    t.scale = ns;
  }, []);

  const onDown = useCallback((e: React.MouseEvent) => {
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
        labelCache.current.key = "";
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
    // clicking a film lights up the line running through it
    if (p.ln?.length) setSolo(p.ln[0]); else setSolo(null);
  }, [pick, narrow]);

  const flyTo = useCallback((s: Pt, minScale = 24) => {
    target.current = { cx: wx(s), cy: wy(s), scale: Math.max(target.current.scale, minScale), pitch: view.current.pitch };
  }, [wx, wy]);

  const focusLine = useCallback((id: string | null) => {
    setSolo(id);
    if (!id || !canvasRef.current) return;
    const l = lineById.get(id);
    if (!l) return;
    const pp = l.stations.map((sl) => byId.get(sl)).filter((s): s is Pt => !!s);
    if (!pp.length) return;
    const xs = pp.map(wx), ys = pp.map(wy);
    const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
    const cv = canvasRef.current;
    const sc = Math.min(60, Math.max(2, Math.min(cv.clientWidth / (x2 - x1 + 40), cv.clientHeight / (y2 - y1 + 40))));
    target.current = { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, scale: sc, pitch: view.current.pitch };
  }, [lineById, byId, wx, wy]);

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
    if (st) { setSel(st); flyTo(st, 22); }
  }, [data, availCC, ensureAvail, country, seenSet, byId, flyTo]);

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
  if (!data) return <div className="ody-loading">Charting the map…</div>;

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

        <div className="odg-axis odg-axis-x">← 과거 · 세대(시대) · 현재 →</div>
        <div className="odg-axis odg-axis-y">취향·성향</div>
        <div className="odg-hint">가로=시대 · 세로=취향 · 스크롤 확대 · ⌘/Ctrl+드래그로 기울여 길 보기 · 영화를 누르면 그 노선이 켜집니다</div>

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
