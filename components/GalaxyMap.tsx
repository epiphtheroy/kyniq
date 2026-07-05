"use client";

/**
 * GalaxyMap — the whole catalogue as one starfield. Films mode: each dot is a
 * film placed by t-SNE over its taste vector; Directors mode: each dot is a
 * director placed by their figure-embedding centroid (worker/galaxy-build.py).
 * Colour = taste neighbourhood (KMeans cluster).
 *
 * Rendering: canvas. Zoomed out, points are coloured dots with decluttered
 * always-on name labels (importance-first, grid collision). Zoomed in, dots
 * become poster thumbnails (films) / circular faces (directors). A gentle
 * sinusoidal drift keeps the field alive (rAF, paused on hidden tabs).
 * Left panel lists the viewport (thumbnails, sortable; row text locates the
 * dot, ↗ opens the page). Clicking a dot opens a right info card.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLens } from "@/components/LensProvider";

type GPoint = {
  slug: string; title: string; x: number; y: number; c: number;
  year?: number | null;      // films
  d?: string | null;         // films: director name
  p?: string | null;         // films: poster_path · directors: profile_path
  n?: number | null;         // directors: visible film count
};
type GCluster = { c: number; n: number; genre: string | null; trope?: string | null };
type Payload = { points: GPoint[]; clusters: GCluster[] };
type Kind = "films" | "directors";
type Sort = "year-desc" | "year-asc" | "title" | "hood" | "films-desc";

const PALETTE = [
  "#C8102E", "#1F6FB2", "#0F6E56", "#6D4AAE", "#B5642A", "#B23A8F", "#2E7D32",
  "#8D6E63", "#00838F", "#F9A825", "#5D4037", "#7B1FA2", "#455A64", "#AD1457",
];
const PANEL_CAP = 400;   // rows rendered in the side panel at once
const LABEL_CAP = 240;   // decluttered labels per view
const THUMB_MIN = 16;    // px node height at which dots become thumbnails
const IMG = "https://image.tmdb.org/t/p";

const hrefOf = (kind: Kind, p: GPoint) => (kind === "films" ? `/film/${p.slug}` : `/director/${p.slug}`);
const thumbUrl = (kind: Kind, p: GPoint) =>
  p.p ? `${IMG}/${kind === "films" ? "w92" : "w185"}${p.p}` : null;

// stable per-point phase for the drift animation
function phase(slug: string) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return (h % 628) / 100; // 0..~6.28
}

export default function GalaxyMap({ height }: { height: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [kind, setKind] = useState<Kind>("films");
  const lens = useLens();
  const [data, setData] = useState<Payload>({ points: [], clusters: [] });
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<{ p: GPoint; sx: number; sy: number } | null>(null);
  const [selected, setSelected] = useState<GPoint | null>(null);
  const [visible, setVisible] = useState<GPoint[]>([]);
  const [sort, setSort] = useState<Sort>("year-desc");
  const [narrow, setNarrow] = useState(false);
  // view: world-coords centre + pixels-per-world-unit (world is ~[-100,100]²)
  const view = useRef({ cx: 0, cy: 0, scale: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const visTimer = useRef<number | null>(null);
  const imgCache = useRef<Map<string, HTMLImageElement | "err">>(new Map());
  const labelCache = useRef<{ key: string; slugs: Set<string> }>({ key: "", slugs: new Set() });
  const drawRef = useRef<() => void>(() => {});
  const rafOn = useRef(false);

  // deep link: /map?m=galaxy&g=directors
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("g");
    if (g === "directors") { setKind("directors"); setSort("films-desc"); }
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      setLoading(true); setSelected(null); setHover(null);
      try {
        const r = await fetch(`/api/map/galaxy${kind === "directors" ? "?mode=directors" : ""}`);
        const j = (await r.json()) as Payload;
        if (!dead) {
          view.current = { cx: 0, cy: 0, scale: 0 }; // refit on next draw
          imgCache.current = new Map();
          labelCache.current = { key: "", slugs: new Set() };
          setData({ points: j.points ?? [], clusters: j.clusters ?? [] });
        }
      } catch { if (!dead) setData({ points: [], clusters: [] }); }
      if (!dead) setLoading(false);
    })();
    return () => { dead = true; };
  }, [kind]);

  useEffect(() => {
    const fit = () => setNarrow(window.innerWidth < 760);
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // My Films lens: "only" filters the starfield down to seen films; "highlight"
  // keeps everything and rings the seen ones. Directors mode is untouched.
  const lensOn = kind === "films" && !!lens && lens.mode !== "off";
  const lensOnly = lensOn && lens!.mode === "only";
  const points = useMemo(
    () => (lensOnly ? data.points.filter((p) => lens!.seen(p.slug)) : data.points),
    [data.points, lensOnly, lens],
  );

  const centroids = useMemo(() => {
    const acc = new Map<number, { x: number; y: number; n: number }>();
    for (const p of points) {
      const a = acc.get(p.c) ?? { x: 0, y: 0, n: 0 };
      a.x += p.x; a.y += p.y; a.n += 1; acc.set(p.c, a);
    }
    return [...acc.entries()].map(([c, a]) => ({ c, x: a.x / a.n, y: a.y / a.n }));
  }, [points]);
  const clusterInfo = useMemo(() => new Map(data.clusters.map((c) => [c.c, c])), [data.clusters]);

  const toScreen = useCallback((p: GPoint) => {
    const cv = canvasRef.current;
    if (!cv) return { sx: -9999, sy: -9999 };
    const { cx, cy, scale } = view.current;
    return { sx: (p.x - cx) * scale + cv.clientWidth / 2, sy: (p.y - cy) * scale + cv.clientHeight / 2 };
  }, []);

  const computeVisible = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    const { cx, cy, scale } = view.current;
    const out: GPoint[] = [];
    for (const p of points) {
      const sx = (p.x - cx) * scale + w / 2;
      const sy = (p.y - cy) * scale + h / 2;
      if (sx >= 0 && sy >= 0 && sx <= w && sy <= h) out.push(p);
    }
    setVisible(out);
  }, [points]);

  const scheduleVisible = useCallback(() => {
    if (visTimer.current) window.clearTimeout(visTimer.current);
    visTimer.current = window.setTimeout(computeVisible, 150);
  }, [computeVisible]);

  const ensureImg = useCallback((p: GPoint) => {
    const url = thumbUrl(kind, p);
    if (!url) return null;
    const got = imgCache.current.get(p.slug);
    if (got === "err") return null;
    if (got) return got.complete && got.naturalWidth > 0 ? got : null;
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => drawRef.current();
    im.onerror = () => { imgCache.current.set(p.slug, "err"); };
    im.src = url;
    imgCache.current.set(p.slug, im);
    return null;
  }, [kind]);

  const importance = useCallback((p: GPoint) =>
    kind === "films" ? (p.p ? 10000 : 0) + (p.year ?? 0) : (p.n ?? 0), [kind]);

  const draw = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!view.current.scale) view.current.scale = Math.min(w, h) / 230; // fit [-100,100] + margin
    const { cx, cy, scale } = view.current;

    const t = performance.now() * 0.001;
    const ampW = 1.7 / scale;                       // ~1.7px drift regardless of zoom
    const thumbH = Math.min(52, scale * 2.0);
    const useThumbs = thumbH >= THUMB_MIN;
    const dotR = Math.max(1.6, Math.min(4.5, scale * 0.9));

    // collect on-screen points at BASE coords (labels/pick stay stable under drift)
    const onScreen: { p: GPoint; bx: number; by: number; sx: number; sy: number }[] = [];
    for (const p of points) {
      const bx = (p.x - cx) * scale + w / 2;
      const by = (p.y - cy) * scale + h / 2;
      if (bx < -40 || by < -40 || bx > w + 40 || by > h + 40) continue;
      const ph = phase(p.slug);
      const sx = bx + Math.sin(t * 0.45 + ph) * ampW * scale;
      const sy = by + Math.cos(t * 0.34 + ph * 1.7) * ampW * scale;
      onScreen.push({ p, bx, by, sx, sy });
    }

    // aspect-preserving cover crop: draw the centre of the source into a w×h box
    // (faces crop from the upper third — that's where faces live in portraits)
    const drawCover = (im: HTMLImageElement, dx: number, dy: number, dw: number, dh: number, faceBias = false) => {
      const nw = im.naturalWidth, nh = im.naturalHeight;
      if (!nw || !nh) return;
      const srcAspect = nw / nh, dstAspect = dw / dh;
      let sw = nw, sh = nh, sx0 = 0, sy0 = 0;
      if (srcAspect > dstAspect) { sw = nh * dstAspect; sx0 = (nw - sw) / 2; }
      else { sh = nw / dstAspect; sy0 = (nh - sh) * (faceBias ? 0.18 : 0.5); }
      ctx.drawImage(im, sx0, sy0, sw, sh, dx, dy, dw, dh);
    };

    // nodes
    for (const o of onScreen) {
      const { p, sx, sy } = o;
      const col = PALETTE[p.c % PALETTE.length];
      // highlight mode: seen films trade the cluster-coloured border for the accent
      const lensSeen = lensOn && !lensOnly && lens!.seen(p.slug);
      const im = useThumbs ? ensureImg(p) : null;
      if (im) {
        if (kind === "films") {
          const th = thumbH, tw = th * (2 / 3);
          ctx.save();
          ctx.beginPath();
          if ("roundRect" in ctx) (ctx as CanvasRenderingContext2D).roundRect(sx - tw / 2, sy - th / 2, tw, th, 3);
          else ctx.rect(sx - tw / 2, sy - th / 2, tw, th);
          ctx.clip();
          drawCover(im, sx - tw / 2, sy - th / 2, tw, th);
          ctx.restore();
          ctx.lineWidth = lensSeen ? 2.4 : 1.4; ctx.strokeStyle = lensSeen ? "#E3120B" : col;
          ctx.strokeRect(sx - tw / 2, sy - th / 2, tw, th);
        } else {
          const rr = thumbH / 2;
          ctx.save();
          ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2); ctx.clip();
          drawCover(im, sx - rr, sy - rr, rr * 2, rr * 2, true);
          ctx.restore();
          ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2);
          ctx.lineWidth = 1.6; ctx.strokeStyle = col; ctx.stroke();
        }
      } else {
        const r = useThumbs ? Math.max(dotR, thumbH * 0.22) : dotR;
        ctx.beginPath();
        ctx.fillStyle = col + "B8";
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        if (lensSeen) {
          ctx.beginPath();
          ctx.lineWidth = 1.5; ctx.strokeStyle = "#E3120B";
          ctx.arc(sx, sy, r + 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // always-on decluttered labels: decide WHICH points get labels once per view,
    // then draw them at drifted positions each frame
    const viewKey = `${kind}:${Math.round(cx * 10)}:${Math.round(cy * 10)}:${Math.round(scale * 10)}:${points.length}`;
    if (labelCache.current.key !== viewKey) {
      const taken = new Set<string>();
      const slugs = new Set<string>();
      const sorted = [...onScreen].sort((a, b) => importance(b.p) - importance(a.p));
      const GX = 68, GY = 15;
      for (const o of sorted) {
        if (slugs.size >= LABEL_CAP) break;
        const label = o.p.title.length > 24 ? o.p.title.slice(0, 23) + "…" : o.p.title;
        const lw = 8 + label.length * 6.2;
        const x0 = o.bx + 6, x1 = o.bx + 6 + lw, yr = Math.round(o.by / GY);
        let free = true;
        for (let gx = Math.floor(x0 / GX); gx <= Math.floor(x1 / GX); gx++) {
          if (taken.has(`${gx}:${yr}`)) { free = false; break; }
        }
        if (!free) continue;
        for (let gx = Math.floor(x0 / GX); gx <= Math.floor(x1 / GX); gx++) taken.add(`${gx}:${yr}`);
        slugs.add(o.p.slug);
      }
      labelCache.current = { key: viewKey, slugs };
    }
    ctx.font = "500 11px var(--font-display, sans-serif)";
    ctx.textAlign = "left";
    const labelSet = labelCache.current.slugs;
    for (const o of onScreen) {
      if (!labelSet.has(o.p.slug)) continue;
      const label = o.p.title.length > 24 ? o.p.title.slice(0, 23) + "…" : o.p.title;
      const off = useThumbs ? (kind === "films" ? thumbH / 3 + 4 : thumbH / 2 + 4) : dotR + 4;
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.strokeText(label, o.sx + off, o.sy + 3.5);
      ctx.fillStyle = "rgba(25,25,25,.92)";
      ctx.fillText(label, o.sx + off, o.sy + 3.5);
    }

    // cluster genre labels — only in dot mode (thumbnails carry their own info)
    if (!useThumbs) {
      ctx.font = "700 12.5px var(--font-display, sans-serif)";
      ctx.textAlign = "center";
      for (const c of centroids) {
        const info = clusterInfo.get(c.c);
        if (!info?.genre) continue;
        const sx = (c.x - cx) * scale + w / 2;
        const sy = (c.y - cy) * scale + h / 2;
        if (sx < 0 || sy < 0 || sx > w || sy > h) continue;
        ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,.88)";
        ctx.strokeText(info.genre, sx, sy);
        ctx.fillStyle = "rgba(20,20,20,.9)";
        ctx.fillText(info.genre, sx, sy);
      }
    }

    // hover / selected highlight
    const ring = (p: GPoint, color: string) => {
      const o = onScreen.find((q) => q.p.slug === p.slug);
      const sx = o ? o.sx : (p.x - cx) * scale + w / 2;
      const sy = o ? o.sy : (p.y - cy) * scale + h / 2;
      ctx.lineWidth = 2.2; ctx.strokeStyle = color;
      if (useThumbs && kind === "films") {
        const th = thumbH, tw = th * (2 / 3);
        ctx.strokeRect(sx - tw / 2 - 2.5, sy - th / 2 - 2.5, tw + 5, th + 5);
      } else {
        const rr = useThumbs ? thumbH / 2 + 2.5 : dotR + 2.5;
        ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2); ctx.stroke();
      }
    };
    if (selected) ring(selected, "#E3120B");
    if (hover && hover.p.slug !== selected?.slug) ring(hover.p, "#111");
  }, [points, centroids, clusterInfo, hover, selected, kind, ensureImg, importance, lensOn, lensOnly, lens]);

  useEffect(() => { drawRef.current = draw; }, [draw]);

  // gentle drift loop — ~30fps, paused when the tab is hidden
  useEffect(() => {
    let raf = 0; let tick = 0;
    rafOn.current = true;
    const loop = () => {
      if (!rafOn.current) return;
      tick++;
      if (tick % 2 === 0 && !document.hidden) drawRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { rafOn.current = false; cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => { draw(); }, [draw, height, narrow]);
  useEffect(() => { if (points.length) { draw(); scheduleVisible(); } }, [points, draw, scheduleVisible, narrow]);
  // lens mode change → recompute labels + panel for the new point set
  useEffect(() => { labelCache.current = { key: "", slugs: new Set() }; draw(); scheduleVisible(); }, [lensOnly, draw, scheduleVisible]);
  useEffect(() => {
    const onResize = () => { draw(); scheduleVisible(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw, scheduleVisible]);

  const pick = useCallback((mx: number, my: number): GPoint | null => {
    const cv = canvasRef.current; if (!cv) return null;
    const w = cv.clientWidth, h = cv.clientHeight;
    const { cx, cy, scale } = view.current;
    const tol = Math.max(10, Math.min(52, scale * 2.0) / 2 + 3);
    let best: GPoint | null = null; let bd = 9e9;
    for (const p of points) {
      const sx = (p.x - cx) * scale + w / 2;
      const sy = (p.y - cy) * scale + h / 2;
      const d = (sx - mx) * (sx - mx) + (sy - my) * (sy - my);
      if (d < bd) { bd = d; best = p; }
    }
    return bd <= tol * tol ? best : null;
  }, [points]);

  const locate = useCallback((p: GPoint) => {
    const v = view.current;
    v.cx = p.x; v.cy = p.y;
    v.scale = Math.max(v.scale, 22);
    setSelected(p);
    draw(); scheduleVisible();
  }, [draw, scheduleVisible]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const cv = canvasRef.current; if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const v = view.current;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const ns = Math.max(1, Math.min(60, v.scale * factor));
    const wx = (mx - cv.clientWidth / 2) / v.scale + v.cx;
    const wy = (my - cv.clientHeight / 2) / v.scale + v.cy;
    v.cx = wx - (mx - cv.clientWidth / 2) / ns;
    v.cy = wy - (my - cv.clientHeight / 2) / ns;
    v.scale = ns;
    draw();
    scheduleVisible();
  }, [draw, scheduleVisible]);

  const onDown = useCallback((e: React.MouseEvent) => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; }, []);
  const onMove = useCallback((e: React.MouseEvent) => {
    const cv = canvasRef.current; if (!cv) return;
    const rect = cv.getBoundingClientRect();
    if (drag.current) {
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
      view.current.cx -= dx / view.current.scale;
      view.current.cy -= dy / view.current.scale;
      drag.current.x = e.clientX; drag.current.y = e.clientY;
      draw();
      scheduleVisible();
      return;
    }
    const p = pick(e.clientX - rect.left, e.clientY - rect.top);
    setHover(p ? { p, sx: e.clientX - rect.left, sy: e.clientY - rect.top } : null);
  }, [pick, draw, scheduleVisible]);
  const onUp = useCallback((e: React.MouseEvent) => {
    const wasDrag = drag.current?.moved; drag.current = null;
    if (wasDrag) { scheduleVisible(); return; }
    const cv = canvasRef.current; if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const p = pick(e.clientX - rect.left, e.clientY - rect.top);
    if (!p) { setSelected(null); return; }
    if (narrow) { window.location.assign(hrefOf(kind, p)); return; }
    setSelected(p);
  }, [pick, narrow, kind]);

  const sortedVisible = useMemo(() => {
    const arr = [...visible];
    if (sort === "title") arr.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "year-asc") arr.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));
    else if (sort === "hood") arr.sort((a, b) => a.c - b.c || a.title.localeCompare(b.title));
    else if (sort === "films-desc") arr.sort((a, b) => (b.n ?? 0) - (a.n ?? 0) || a.title.localeCompare(b.title));
    else arr.sort((a, b) => (b.year ?? -1) - (a.year ?? -1) || a.title.localeCompare(b.title));
    return arr;
  }, [visible, sort]);

  const hoverFromPanel = useCallback((p: GPoint) => {
    const { sx, sy } = toScreen(p);
    setHover({ p, sx, sy });
  }, [toScreen]);

  const switchKind = useCallback((k: Kind) => {
    if (k === kind) return;
    setKind(k);
    setSort(k === "directors" ? "films-desc" : "year-desc");
  }, [kind]);

  const hoverInfo = hover ? clusterInfo.get(hover.p.c) : null;
  const selInfo = selected ? clusterInfo.get(selected.c) : null;

  const kindToggle = (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {(["films", "directors"] as Kind[]).map((k) => (
        <button key={k} onClick={() => switchKind(k)} style={{
          fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, cursor: "pointer",
          border: "1px solid rgba(0,0,0,.14)",
          background: kind === k ? "#1a1a1a" : "transparent", color: kind === k ? "#fff" : "inherit",
        }}>{k === "films" ? "Films" : "Directors"}</button>
      ))}
    </span>
  );

  const rowThumb = (p: GPoint) => {
    const u = thumbUrl(kind, p);
    if (!u) return (
      <span aria-hidden="true" style={{
        flex: "0 0 auto", width: kind === "films" ? 22 : 24, height: kind === "films" ? 33 : 24,
        borderRadius: kind === "films" ? 3 : "50%", background: PALETTE[p.c % PALETTE.length] + "33",
        display: "inline-grid", placeItems: "center", fontSize: 10, fontWeight: 800,
        color: PALETTE[p.c % PALETTE.length],
      }}>{p.title.slice(0, 1)}</span>
    );
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={u} alt="" loading="lazy" width={kind === "films" ? 22 : 24} height={kind === "films" ? 33 : 24}
        style={{
          flex: "0 0 auto", width: kind === "films" ? 22 : 24, height: kind === "films" ? 33 : 24,
          objectFit: "cover", borderRadius: kind === "films" ? 3 : "50%",
          border: `1.5px solid ${PALETTE[p.c % PALETTE.length]}55`,
        }} />
    );
  };

  const meta = (p: GPoint) => kind === "films" ? String(p.year ?? "") : `${p.n ?? 0}`;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
      {!narrow && (
        <div style={{
          flex: "0 0 288px", width: 288, height, display: "flex", flexDirection: "column",
          border: "1px solid rgba(0,0,0,.08)", borderRadius: 10, background: "rgba(255,255,255,.72)", overflow: "hidden",
        }}>
          <div style={{ padding: "9px 12px 7px", borderBottom: "1px solid rgba(0,0,0,.07)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
            {kindToggle}
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ fontSize: 12, padding: "2px 4px", maxWidth: 118 }} aria-label="Sort">
              {kind === "films" ? (
                <>
                  <option value="year-desc">Year ↓</option>
                  <option value="year-asc">Year ↑</option>
                  <option value="title">Title A–Z</option>
                  <option value="hood">Neighbourhood</option>
                </>
              ) : (
                <>
                  <option value="films-desc">Films ↓</option>
                  <option value="title">Name A–Z</option>
                  <option value="hood">Neighbourhood</option>
                </>
              )}
            </select>
          </div>
          <div style={{ padding: "6px 12px 5px", fontSize: 12, fontWeight: 700, opacity: .75 }}>
            {visible.length} {kind === "films" ? "films" : "directors"} in view
            {lensOnly ? <span style={{ color: "#E3120B" }}> · yours only</span> : null}
            <span style={{ fontWeight: 400, opacity: .75 }}> · click a row to locate it, ↗ opens the page</span>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "2px 0 6px" }}>
            {sortedVisible.slice(0, PANEL_CAP).map((p) => (
              <div
                key={p.slug}
                onMouseEnter={() => hoverFromPanel(p)}
                onMouseLeave={() => setHover(null)}
                style={{
                  display: "flex", gap: 8, alignItems: "center", padding: "3px 12px", fontSize: 12.5, lineHeight: 1.3,
                  background: selected?.slug === p.slug ? "rgba(227,18,11,.07)" : "transparent",
                }}
              >
                {rowThumb(p)}
                <button
                  onClick={() => locate(p)}
                  title="Locate on the map"
                  style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", background: "none", border: 0, padding: 0, font: "inherit", color: "inherit", cursor: "pointer" }}
                >{p.title}</button>
                {lensOn && lens!.seen(p.slug) ? (
                  <span style={{ color: "#E3120B", fontWeight: 800, fontSize: 11, flex: "0 0 auto" }} title="Seen">✓</span>
                ) : null}
                <span style={{ opacity: .55, fontSize: 11.5, flex: "0 0 auto" }}>{meta(p)}</span>
                <a href={hrefOf(kind, p)} title={kind === "films" ? "Open film page" : "Open director page"}
                   style={{ flex: "0 0 auto", fontSize: 12, fontWeight: 800, color: "#C8102E", textDecoration: "none" }}>↗</a>
              </div>
            ))}
            {sortedVisible.length > PANEL_CAP ? (
              <div style={{ padding: "7px 12px", fontSize: 11.5, opacity: .6 }}>
                +{sortedVisible.length - PANEL_CAP} more — zoom in to narrow the view
              </div>
            ) : null}
            {!loading && sortedVisible.length === 0 ? (
              <div style={{ padding: "7px 12px", fontSize: 11.5, opacity: .6 }}>Nothing in view — zoom out.</div>
            ) : null}
          </div>
        </div>
      )}

      <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
        {narrow ? (
          <div style={{ position: "absolute", top: 8, left: 8, zIndex: 6 }}>{kindToggle}</div>
        ) : null}
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height, display: "block", cursor: hover ? "pointer" : "grab", touchAction: "none" }}
          onWheel={onWheel}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={() => { drag.current = null; setHover(null); }}
        />
        {loading ? (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 14, color: "var(--muted, #777)" }}>
            charting the galaxy…
          </div>
        ) : null}
        {hover && hover.p.slug !== selected?.slug ? (
          <div style={{
            position: "absolute", left: Math.min(hover.sx + 14, (wrapRef.current?.clientWidth ?? 300) - 240), top: Math.min(hover.sy + 14, height - 70),
            background: "rgba(255,255,255,.96)", border: "1px solid rgba(0,0,0,.12)", borderRadius: 8,
            padding: "8px 10px", maxWidth: 230, pointerEvents: "none", boxShadow: "0 4px 18px rgba(0,0,0,.12)", zIndex: 5,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>
              {hover.p.title}{" "}
              <span style={{ fontWeight: 400, opacity: .6 }}>
                {kind === "films" ? `(${hover.p.year ?? "?"})` : `· ${hover.p.n ?? 0} films`}
              </span>
            </div>
            {hoverInfo?.genre ? (
              <div style={{ fontSize: 12, opacity: .65, marginTop: 2 }}>
                <span style={{ color: PALETTE[hover.p.c % PALETTE.length] }}>●</span> {hoverInfo.genre}
              </div>
            ) : null}
          </div>
        ) : null}

        {selected && !narrow ? (
          <div style={{
            position: "absolute", top: 10, right: 10, width: 216, zIndex: 6,
            background: "rgba(255,255,255,.97)", border: "1px solid rgba(0,0,0,.12)", borderRadius: 10,
            boxShadow: "0 6px 24px rgba(0,0,0,.14)", overflow: "hidden",
          }}>
            <button onClick={() => setSelected(null)} aria-label="Close"
              style={{ position: "absolute", top: 6, right: 8, border: 0, background: "rgba(255,255,255,.8)", borderRadius: 999, width: 22, height: 22, fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: .8, zIndex: 2 }}>×</button>
            {selected.p ? (
              kind === "films" ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`${IMG}/w342${selected.p}`} alt={`${selected.title} poster`} style={{ width: "100%", display: "block", aspectRatio: "2/3", objectFit: "cover" }} loading="lazy" />
              ) : (
                <div style={{ display: "grid", placeItems: "center", padding: "16px 0 4px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${IMG}/w185${selected.p}`} alt={selected.title} style={{ width: 108, height: 108, borderRadius: "50%", objectFit: "cover", border: `3px solid ${PALETTE[selected.c % PALETTE.length]}` }} loading="lazy" />
                </div>
              )
            ) : (
              <div style={{ height: 64, display: "grid", placeItems: "center", background: PALETTE[selected.c % PALETTE.length] + "22", fontSize: 26, fontWeight: 800, color: PALETTE[selected.c % PALETTE.length] }}>
                {selected.title.slice(0, 1)}
              </div>
            )}
            <div style={{ padding: "10px 12px 12px" }}>
              <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.25 }}>{selected.title}</div>
              <div style={{ fontSize: 12, opacity: .7, marginTop: 3 }}>
                {kind === "films"
                  ? <>{selected.year ?? "?"}{selected.d ? <> · {selected.d}</> : null}</>
                  : <>{selected.n ?? 0} films on Metatake</>}
              </div>
              {selInfo?.genre ? (
                <div style={{ fontSize: 11.5, marginTop: 6 }}>
                  <span style={{ color: PALETTE[selected.c % PALETTE.length] }}>●</span>{" "}
                  <span style={{ opacity: .72 }}>{selInfo.genre} neighbourhood{selInfo.n ? ` · ${selInfo.n} ${kind}` : ""}</span>
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <a href={hrefOf(kind, selected)} style={{
                  flex: 1, textAlign: "center", fontSize: 12, fontWeight: 800, padding: "6px 0", borderRadius: 8,
                  background: "#1a1a1a", color: "#fff", textDecoration: "none",
                }}>Open {kind === "films" ? "film" : "director"} ↗</a>
                <button onClick={() => locate(selected)} title="Zoom to this dot" style={{
                  flex: "0 0 auto", fontSize: 12, fontWeight: 800, padding: "6px 10px", borderRadius: 8,
                  border: "1px solid rgba(0,0,0,.16)", background: "transparent", cursor: "pointer",
                }}>◎</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
