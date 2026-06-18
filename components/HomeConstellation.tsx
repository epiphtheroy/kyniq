"use client";

import { useEffect, useRef, useState } from "react";

type CPair = { mt: string; a: { f: string; fig: string }; b: { f: string; fig: string } };
type Node = { id: string; label: string; type: "film" | "meta" | "figure"; deg: number; x: number; y: number; bx: number; by: number; ph: number };
type Link = { a: Node; b: Node };

export default function HomeConstellation({ pairs }: { pairs: CPair[] }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"film" | "figure">("film");

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, raf = 0;
    const HINT_DEFAULT = "hover a star — its neighbours light up";

    function size() { const r = cv!.getBoundingClientRect(); W = r.width; H = r.height; cv!.width = W * DPR; cv!.height = H * DPR; ctx!.setTransform(DPR, 0, 0, DPR, 0, 0); }

    let nodes: Node[] = [], links: Link[] = [];
    function build() {
      const films: Record<string, Node> = {}, metas: Record<string, Node> = {}, figs: Record<string, Node> = {};
      nodes = []; links = [];
      const addFilm = (f: string): Node => { if (!films[f]) films[f] = { id: f, label: f, type: "film", deg: 0, x: 0, y: 0, bx: 0, by: 0, ph: 0 }; return films[f]; };
      const addMeta = (m: string): Node => { if (!metas[m]) metas[m] = { id: "M:" + m, label: m, type: "meta", deg: 0, x: 0, y: 0, bx: 0, by: 0, ph: 0 }; return metas[m]; };
      const addFig = (g: string): Node => { if (!figs[g]) figs[g] = { id: "F:" + g, label: g, type: "figure", deg: 0, x: 0, y: 0, bx: 0, by: 0, ph: 0 }; return figs[g]; };
      pairs.forEach((p) => {
        const fa = addFilm(p.a.f), fb = addFilm(p.b.f), m = addMeta(p.mt);
        if (mode === "film") { links.push({ a: fa, b: m }); links.push({ a: fb, b: m }); }
        else {
          const ga = addFig(p.a.fig + " · " + p.a.f), gb = addFig(p.b.fig + " · " + p.b.f);
          links.push({ a: fa, b: ga }); links.push({ a: ga, b: m });
          links.push({ a: fb, b: gb }); links.push({ a: gb, b: m });
        }
      });
      [films, metas, figs].forEach((D) => { for (const k0 in D) nodes.push(D[k0]); });
      links.forEach((l) => { l.a.deg++; l.b.deg++; });
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.34;
      nodes.forEach((nd, i) => {
        const ang = (i / nodes.length) * Math.PI * 2 + (nd.type === "meta" ? 0.3 : 0);
        const rr = nd.type === "meta" ? R * 0.45 : R * (0.85 + Math.random() * 0.3);
        nd.x = cx + Math.cos(ang) * rr + (Math.random() - 0.5) * 40;
        nd.y = cy + Math.sin(ang) * rr + (Math.random() - 0.5) * 40;
        nd.bx = nd.x; nd.by = nd.y; nd.ph = Math.random() * Math.PI * 2;
      });
    }

    const radius = (n: Node) => n.type === "meta" ? 6.5 : n.type === "figure" ? 4 : 5 + Math.min(4, n.deg);
    const col = (n: Node, lit: boolean) =>
      n.type === "meta" ? (lit ? "#ff6a64" : "rgba(242,85,79,.85)")
        : n.type === "figure" ? (lit ? "#7fe0d6" : "rgba(79,182,173,.8)")
          : (lit ? "#f2efe6" : "rgba(233,228,216,.82)");

    let k = 1, tx = 0, ty = 0, hover: Node | null = null, dragging = false;
    let dragStart: { x: number; y: number; tx: number; ty: number } | null = null;
    const neighborsOf = (n: Node) => { const s: Record<string, 1> = {}; s[n.id] = 1; links.forEach((l) => { if (l.a === n) s[l.b.id] = 1; if (l.b === n) s[l.a.id] = 1; }); return s; };

    function draw() {
      ctx!.clearRect(0, 0, W, H); ctx!.save(); ctx!.translate(tx, ty); ctx!.scale(k, k);
      const nb = hover ? neighborsOf(hover) : null;
      links.forEach((l) => {
        const lit = !!(nb && nb[l.a.id] && nb[l.b.id]);
        ctx!.beginPath(); ctx!.moveTo(l.a.x, l.a.y); ctx!.lineTo(l.b.x, l.b.y);
        ctx!.strokeStyle = lit ? "rgba(242,85,79,.5)" : "rgba(150,150,160,.13)";
        ctx!.lineWidth = (lit ? 1.4 : 0.8) / k; ctx!.stroke();
      });
      nodes.forEach((n) => {
        const lit = !nb || !!nb[n.id]; const r = radius(n);
        if (hover === n) { ctx!.beginPath(); ctx!.arc(n.x, n.y, r + 5, 0, 7); ctx!.fillStyle = "rgba(242,85,79,.18)"; ctx!.fill(); }
        ctx!.beginPath(); ctx!.arc(n.x, n.y, r, 0, 7); ctx!.fillStyle = col(n, hover === n); ctx!.globalAlpha = lit ? 1 : 0.25; ctx!.fill(); ctx!.globalAlpha = 1;
        if (n.type === "meta" || hover === n) {
          ctx!.font = "600 11px Inter, sans-serif"; ctx!.fillStyle = lit ? "#e8e3d8" : "rgba(232,227,216,.3)"; ctx!.textAlign = "left";
          ctx!.fillText(n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label, n.x + r + 5, n.y + 3);
        }
      });
      ctx!.restore();
    }
    function tick() { nodes.forEach((n) => { n.ph += 0.008; n.x = n.bx + Math.cos(n.ph) * 6; n.y = n.by + Math.sin(n.ph * 0.9) * 6; }); draw(); raf = requestAnimationFrame(tick); }

    const toLocal = (ev: MouseEvent) => { const r = cv!.getBoundingClientRect(); return { x: (ev.clientX - r.left - tx) / k, y: (ev.clientY - r.top - ty) / k }; };
    const hit = (p: { x: number; y: number }) => { let best: Node | null = null, bd = 18; nodes.forEach((n) => { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < bd) { bd = d; best = n; } }); return best; };
    const onMove = (ev: MouseEvent) => {
      if (dragging && dragStart) { tx = dragStart.tx + (ev.clientX - dragStart.x); ty = dragStart.ty + (ev.clientY - dragStart.y); return; }
      hover = hit(toLocal(ev));
      if (hintRef.current) hintRef.current.textContent = hover ? (hover.type + " · " + hover.label) : HINT_DEFAULT;
    };
    const onDown = (ev: MouseEvent) => { dragging = true; dragStart = { x: ev.clientX, y: ev.clientY, tx, ty }; };
    const onUp = () => { dragging = false; };
    const onLeave = () => { hover = null; };
    const onWheel = (ev: WheelEvent) => { ev.preventDefault(); const r = cv!.getBoundingClientRect(); const px = ev.clientX - r.left, py = ev.clientY - r.top; const fac = ev.deltaY < 0 ? 1.1 : 0.9; const nk = Math.max(0.5, Math.min(2.4, k * fac)); const wx = (px - tx) / k, wy = (py - ty) / k; k = nk; tx = px - wx * k; ty = py - wy * k; };
    const onResize = () => { size(); build(); };

    cv.addEventListener("mousemove", onMove);
    cv.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    cv.addEventListener("mouseleave", onLeave);
    cv.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);

    size(); build(); raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("mousemove", onMove);
      cv.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cv.removeEventListener("mouseleave", onLeave);
      cv.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
    };
  }, [pairs, mode]);

  return (
    <div className="hm-mapwrap">
      <div className="hm-mapbar">
        <span className="ttl">Constellation</span>
        <span className="sub">{mode === "film" ? "film graph" : "figure graph"} · cosine-near neighbours</span>
        <span className="tg">
          <button className={mode === "film" ? "on" : ""} onClick={() => setMode("film")}>Films</button>
          <button className={mode === "figure" ? "on" : ""} onClick={() => setMode("figure")}>Figures</button>
        </span>
      </div>
      <canvas ref={cvRef} />
      <div className="hm-maphint" ref={hintRef}>hover a star — its neighbours light up</div>
    </div>
  );
}
