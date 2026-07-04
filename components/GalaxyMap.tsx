"use client";

/**
 * GalaxyMap — the whole catalogue as one starfield. Each dot is a film placed by
 * t-SNE over its taste vector (worker/galaxy-build.py); colour = taste
 * neighbourhood (KMeans cluster). Canvas-rendered (one draw per state change, no
 * rAF loop — hidden tabs stay cheap). Wheel zooms at the cursor, drag pans,
 * hover names the film, click opens its page.
 *
 * Side panel (Atlas-style): lists the films currently in the viewport, sortable
 * by year/title/neighbourhood; hovering a row rings its dot, clicking opens the
 * film. When few enough dots are on screen, titles are drawn on the canvas too.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GPoint = { slug: string; title: string; year: number | null; x: number; y: number; c: number };
type GCluster = { c: number; n: number; genre: string | null; trope: string | null };
type Payload = { points: GPoint[]; clusters: GCluster[] };
type Sort = "year-desc" | "year-asc" | "title" | "hood";

const PALETTE = [
  "#C8102E", "#1F6FB2", "#0F6E56", "#6D4AAE", "#B5642A", "#B23A8F", "#2E7D32",
  "#8D6E63", "#00838F", "#F9A825", "#5D4037", "#7B1FA2", "#455A64", "#AD1457",
];
const LABEL_MAX = 70;   // draw titles on canvas when this few dots are visible
const PANEL_CAP = 400;  // rows rendered in the side panel at once

export default function GalaxyMap({ height }: { height: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<Payload>({ points: [], clusters: [] });
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<{ p: GPoint; sx: number; sy: number } | null>(null);
  const [visible, setVisible] = useState<GPoint[]>([]);
  const [sort, setSort] = useState<Sort>("year-desc");
  const [narrow, setNarrow] = useState(false);
  // view: world-coords centre + pixels-per-world-unit (world is ~[-100,100]²)
  const view = useRef({ cx: 0, cy: 0, scale: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const visTimer = useRef<number | null>(null);

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

  useEffect(() => {
    const fit = () => setNarrow(window.innerWidth < 760);
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
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
    for (const p of data.points) {
      const sx = (p.x - cx) * scale + w / 2;
      const sy = (p.y - cy) * scale + h / 2;
      if (sx >= 0 && sy >= 0 && sx <= w && sy <= h) out.push(p);
    }
    setVisible(out);
  }, [data.points]);

  const scheduleVisible = useCallback(() => {
    if (visTimer.current) window.clearTimeout(visTimer.current);
    visTimer.current = window.setTimeout(computeVisible, 150);
  }, [computeVisible]);

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

    const onScreen: { p: GPoint; sx: number; sy: number }[] = [];
    for (const p of data.points) {
      const sx = (p.x - cx) * scale + w / 2;
      const sy = (p.y - cy) * scale + h / 2;
      if (sx < -6 || sy < -6 || sx > w + 6 || sy > h + 6) continue;
      if (onScreen.length <= LABEL_MAX) onScreen.push({ p, sx, sy });
      ctx.beginPath();
      ctx.fillStyle = PALETTE[p.c % PALETTE.length] + "B8";
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // film titles beside the dots once the view is tight enough to read them
    if (onScreen.length > 0 && onScreen.length <= LABEL_MAX) {
      ctx.font = "500 11px var(--font-display, sans-serif)";
      ctx.textAlign = "left";
      for (const { p, sx, sy } of onScreen) {
        const label = p.title.length > 26 ? p.title.slice(0, 25) + "…" : p.title;
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.85)";
        ctx.strokeText(label, sx + r + 4, sy + 3.5);
        ctx.fillStyle = "rgba(25,25,25,.92)";
        ctx.fillText(label, sx + r + 4, sy + 3.5);
      }
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

  useEffect(() => { draw(); }, [draw, height, narrow]);
  useEffect(() => { if (data.points.length) scheduleVisible(); }, [data.points, scheduleVisible, narrow]);
  useEffect(() => {
    const onResize = () => { draw(); scheduleVisible(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw, scheduleVisible]);

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
    if (p) window.location.assign(`/film/${p.slug}`);
  }, [pick, scheduleVisible]);

  const sortedVisible = useMemo(() => {
    const arr = [...visible];
    if (sort === "title") arr.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "year-asc") arr.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));
    else if (sort === "hood") arr.sort((a, b) => a.c - b.c || a.title.localeCompare(b.title));
    else arr.sort((a, b) => (b.year ?? -1) - (a.year ?? -1) || a.title.localeCompare(b.title));
    return arr;
  }, [visible, sort]);

  const hoverFromPanel = useCallback((p: GPoint) => {
    const { sx, sy } = toScreen(p);
    setHover({ p, sx, sy });
  }, [toScreen]);

  const hoverInfo = hover ? clusterInfo.get(hover.p.c) : null;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
      {!narrow && (
        <div style={{
          flex: "0 0 264px", width: 264, height, display: "flex", flexDirection: "column",
          border: "1px solid rgba(0,0,0,.08)", borderRadius: 10, background: "rgba(255,255,255,.72)", overflow: "hidden",
        }}>
          <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid rgba(0,0,0,.07)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{visible.length} films in view</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ fontSize: 12, padding: "2px 4px" }} aria-label="Sort films in view">
              <option value="year-desc">Year ↓</option>
              <option value="year-asc">Year ↑</option>
              <option value="title">Title A–Z</option>
              <option value="hood">Neighbourhood</option>
            </select>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "5px 0" }}>
            {sortedVisible.slice(0, PANEL_CAP).map((p) => (
              <a
                key={p.slug}
                href={`/film/${p.slug}`}
                onMouseEnter={() => hoverFromPanel(p)}
                onMouseLeave={() => setHover(null)}
                style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "3px 12px", textDecoration: "none", color: "inherit", fontSize: 12.5, lineHeight: 1.35 }}
              >
                <span style={{ color: PALETTE[p.c % PALETTE.length], fontSize: 9, flex: "0 0 auto" }}>●</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                <span style={{ opacity: .55, fontSize: 11.5, flex: "0 0 auto" }}>{p.year ?? ""}</span>
              </a>
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
            position: "absolute", left: Math.min(hover.sx + 14, (wrapRef.current?.clientWidth ?? 300) - 240), top: Math.min(hover.sy + 14, height - 70),
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
    </div>
  );
}
