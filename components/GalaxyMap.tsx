"use client";

/**
 * GalaxyMap — the whole catalogue as one starfield. Films mode: each dot is a
 * film placed by t-SNE over its taste vector; Directors mode: each dot is a
 * director placed by their figure-embedding centroid (worker/galaxy-build.py).
 * Colour = taste neighbourhood (KMeans cluster).
 *
 * Canvas-rendered, event-driven draws (no rAF loop). Wheel zooms at the cursor,
 * drag pans. Left panel lists what's in the viewport (sortable); a row's text
 * locates the dot on the map, its ↗ opens the page. Clicking a dot opens a
 * right-side info card (poster, credits, open/zoom buttons) — on narrow screens
 * it navigates directly instead.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GPoint = {
  slug: string; title: string; x: number; y: number; c: number;
  year?: number | null;      // films
  d?: string | null;         // films: director name
  p?: string | null;         // films: poster_path
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
const LABEL_MAX = 70;   // draw titles on canvas when this few dots are visible
const PANEL_CAP = 400;  // rows rendered in the side panel at once
const IMG = "https://image.tmdb.org/t/p";

const hrefOf = (kind: Kind, p: GPoint) => (kind === "films" ? `/film/${p.slug}` : `/director/${p.slug}`);

export default function GalaxyMap({ height }: { height: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [kind, setKind] = useState<Kind>("films");
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

    // titles beside the dots once the view is tight enough to read them
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

    const ring = (p: GPoint, color: string) => {
      const sx = (p.x - cx) * scale + w / 2;
      const sy = (p.y - cy) * scale + h / 2;
      ctx.beginPath();
      ctx.lineWidth = 2; ctx.strokeStyle = color;
      ctx.arc(sx, sy, r + 2.5, 0, Math.PI * 2);
      ctx.stroke();
    };
    if (selected) ring(selected, "#E3120B");
    if (hover && hover.p.slug !== selected?.slug) ring(hover.p, "#111");
  }, [data.points, centroids, clusterInfo, hover, selected]);

  useEffect(() => { draw(); }, [draw, height, narrow]);
  useEffect(() => { if (data.points.length) { draw(); scheduleVisible(); } }, [data.points, draw, scheduleVisible, narrow]);
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

  const meta = (p: GPoint) =>
    kind === "films" ? String(p.year ?? "") : `${p.n ?? 0}`;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
      {!narrow && (
        <div style={{
          flex: "0 0 272px", width: 272, height, display: "flex", flexDirection: "column",
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
            <span style={{ fontWeight: 400, opacity: .75 }}> · click a row to locate it, ↗ opens the page</span>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "2px 0 6px" }}>
            {sortedVisible.slice(0, PANEL_CAP).map((p) => (
              <div
                key={p.slug}
                onMouseEnter={() => hoverFromPanel(p)}
                onMouseLeave={() => setHover(null)}
                style={{
                  display: "flex", gap: 7, alignItems: "baseline", padding: "3px 12px", fontSize: 12.5, lineHeight: 1.35,
                  background: selected?.slug === p.slug ? "rgba(227,18,11,.07)" : "transparent",
                }}
              >
                <span style={{ color: PALETTE[p.c % PALETTE.length], fontSize: 9, flex: "0 0 auto" }}>●</span>
                <button
                  onClick={() => locate(p)}
                  title="Locate on the map"
                  style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", background: "none", border: 0, padding: 0, font: "inherit", color: "inherit", cursor: "pointer" }}
                >{p.title}</button>
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
              style={{ position: "absolute", top: 6, right: 8, border: 0, background: "none", fontSize: 15, fontWeight: 800, cursor: "pointer", opacity: .55, zIndex: 2 }}>×</button>
            {kind === "films" && selected.p ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={`${IMG}/w342${selected.p}`} alt={`${selected.title} poster`} style={{ width: "100%", display: "block", aspectRatio: "2/3", objectFit: "cover" }} loading="lazy" />
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
