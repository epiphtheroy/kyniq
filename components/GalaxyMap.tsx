"use client";

/**
 * GalaxyMap — the whole catalogue as one starfield. Each dot is a film placed by
 * t-SNE over its taste vector (worker/galaxy-build.py); colour = taste
 * neighbourhood (KMeans cluster). Canvas-rendered (one draw per state change, no
 * rAF loop — hidden tabs stay cheap). Wheel zooms at the cursor, drag pans,
 * hover names the film, click opens its page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GPoint = { slug: string; title: string; year: number | null; x: number; y: number; c: number };
type GCluster = { c: number; n: number; genre: string | null; trope: string | null };
type Payload = { points: GPoint[]; clusters: GCluster[] };

const PALETTE = [
  "#C8102E", "#1F6FB2", "#0F6E56", "#6D4AAE", "#B5642A", "#B23A8F", "#2E7D32",
  "#8D6E63", "#00838F", "#F9A825", "#5D4037", "#7B1FA2", "#455A64", "#AD1457",
];

export default function GalaxyMap({ height }: { height: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<Payload>({ points: [], clusters: [] });
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<{ p: GPoint; sx: number; sy: number } | null>(null);
  // view: world-coords centre + pixels-per-world-unit (world is ~[-100,100]²)
  const view = useRef({ cx: 0, cy: 0, scale: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/map/galaxy");
        const j = (await r.json()) as Payload;
        setData({ points: j.points ?? [], clusters: j.clusters ?? [] });
      } catch { /* leave empty */ }
      setLoading(false);
    })();
  }, []);

  const centroids = useMemo(() => {
    const acc = new Map<number, { x: number; y: number; n: number }>();
    for (const p of data.points) {
      const a = acc.get(p.c) ?? { x: 0, y: 0, n: 0 };
      a.x += p.x; a.y += p.y; a.n += 1; acc.set(p.c, a);
    }
    return [...acc.entries()].map(([c, a]) => ({ c, x: a.x / a.n, y: a.y / a.n }));
  }, [data.points]);
  const clusterInfo = useMemo(() => new Map(data.clusters.map((c) => [c.c, c])), [data.clusters]);

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
    const r = Math.max(1.6, Math.min(4.5, scale * 0.9));

    for (const p of data.points) {
      const sx = (p.x - cx) * scale + w / 2;
      const sy = (p.y - cy) * scale + h / 2;
      if (sx < -6 || sy < -6 || sx > w + 6 || sy > h + 6) continue;
      ctx.beginPath();
      ctx.fillStyle = PALETTE[p.c % PALETTE.length] + "B8";
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // cluster labels — genre pair, faint halo for legibility
    ctx.font = "600 12px var(--font-display, sans-serif)";
    ctx.textAlign = "center";
    for (const c of centroids) {
      const info = clusterInfo.get(c.c);
      if (!info?.genre) continue;
      const sx = (c.x - cx) * scale + w / 2;
      const sy = (c.y - cy) * scale + h / 2;
      if (sx < 0 || sy < 0 || sx > w || sy > h) continue;
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.82)";
      ctx.strokeText(info.genre, sx, sy);
      ctx.fillStyle = "rgba(20,20,20,.85)";
      ctx.fillText(info.genre, sx, sy);
    }
    if (hover) {
      const sx = (hover.p.x - cx) * scale + w / 2;
      const sy = (hover.p.y - cy) * scale + h / 2;
      ctx.beginPath();
      ctx.lineWidth = 2; ctx.strokeStyle = "#111";
      ctx.arc(sx, sy, r + 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [data.points, centroids, clusterInfo, hover]);

  useEffect(() => { draw(); }, [draw, height]);
  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  const pick = useCallback((mx: number, my: number): GPoint | null => {
    const cv = canvasRef.current; if (!cv) return null;
    const w = cv.clientWidth, h = cv.clientHeight;
    const { cx, cy, scale } = view.current;
    let best: GPoint | null = null; let bd = 9e9;
    for (const p of data.points) {
      const sx = (p.x - cx) * scale + w / 2;
      const sy = (p.y - cy) * scale + h / 2;
      const d = (sx - mx) * (sx - mx) + (sy - my) * (sy - my);
      if (d < bd) { bd = d; best = p; }
    }
    return bd <= 100 ? best : null; // within 10px
  }, [data.points]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const cv = canvasRef.current; if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const v = view.current;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const ns = Math.max(1, Math.min(60, v.scale * factor));
    // keep the world point under the cursor fixed
    const wx = (mx - cv.clientWidth / 2) / v.scale + v.cx;
    const wy = (my - cv.clientHeight / 2) / v.scale + v.cy;
    v.cx = wx - (mx - cv.clientWidth / 2) / ns;
    v.cy = wy - (my - cv.clientHeight / 2) / ns;
    v.scale = ns;
    draw();
  }, [draw]);

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
      return;
    }
    const p = pick(e.clientX - rect.left, e.clientY - rect.top);
    setHover(p ? { p, sx: e.clientX - rect.left, sy: e.clientY - rect.top } : null);
  }, [pick, draw]);
  const onUp = useCallback((e: React.MouseEvent) => {
    const wasDrag = drag.current?.moved; drag.current = null;
    if (wasDrag) return;
    const cv = canvasRef.current; if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const p = pick(e.clientX - rect.left, e.clientY - rect.top);
    if (p) window.location.assign(`/film/${p.slug}`);
  }, [pick]);

  const hoverInfo = hover ? clusterInfo.get(hover.p.c) : null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
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
      {hover ? (
        <div style={{
          position: "absolute", left: Math.min(hover.sx + 14, (wrapRef.current?.clientWidth ?? 300) - 240), top: hover.sy + 14,
          background: "rgba(255,255,255,.96)", border: "1px solid rgba(0,0,0,.12)", borderRadius: 8,
          padding: "8px 10px", maxWidth: 230, pointerEvents: "none", boxShadow: "0 4px 18px rgba(0,0,0,.12)", zIndex: 5,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>
            {hover.p.title} <span style={{ fontWeight: 400, opacity: .6 }}>({hover.p.year ?? "?"})</span>
          </div>
          {hoverInfo?.genre ? (
            <div style={{ fontSize: 12, opacity: .65, marginTop: 2 }}>
              <span style={{ color: PALETTE[hover.p.c % PALETTE.length] }}>●</span> {hoverInfo.genre}
              {hoverInfo.trope ? <> · near “{hoverInfo.trope}”</> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
