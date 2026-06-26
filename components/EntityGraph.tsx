"use client";

/**
 * EntityGraph — Obsidian-style force graph for a single entity's ego-network.
 * Renders a { nodes, links } payload from graph_film_seed / graph_figure_seed.
 *
 * - Text nodes (no images), sized by degree, coloured by type.
 * - Drag a node and the connected nodes follow elastically (springs reheat the sim).
 * - Hover focuses (dims the rest). Click an internal node → router.push(href).
 * - Drag the empty canvas to pan; wheel to zoom. The layout settles dynamically on mount.
 *
 * Zero dependencies beyond React + next/navigation. Drop in components/EntityGraph.tsx.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type GraphNode = {
  id: string;
  type: "film" | "figure" | "reading" | "trope";
  label: string;
  sub?: string | null;
  href?: string | null;
  center?: boolean;
};
export type GraphLink = { s: string; t: string; kind?: "struct" | "reading" | "trope" };
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] };

// Light theme — readable on a white canvas. Dots carry the category colour;
// labels are the same hue darkened for contrast.
const COLORS: Record<string, { dot: string; label: string }> = {
  film: { dot: "#3a3a3a", label: "#2a2a2a" },
  figure: { dot: "#1F6FB2", label: "#1a4e7a" },
  reading: { dot: "#C0392B", label: "#8f2a20" },
  trope: { dot: "#0F6E56", label: "#0b5343" },
  idea: { dot: "#6D4AAE", label: "#4e3380" },
  director: { dot: "#B5642A", label: "#8a4a1f" },
  theorist: { dot: "#B23A8F", label: "#86286a" },
};
const CENTER_COL = { dot: "#E3120B", label: "#1a1a1a" };
const EDGE = {
  struct: "rgba(0,0,0,0.10)",
  reading: "rgba(192,57,43,0.22)",
  trope: "rgba(15,110,86,0.24)",
};
const EDGE_HI = { struct: "rgba(0,0,0,0.42)", reading: "#C0392B", trope: "#0F6E56" };

type SimNode = GraphNode & {
  x: number; y: number; vx: number; vy: number;
  fx: number | null; fy: number | null; deg: number;
  el?: HTMLDivElement;
};
type SimLink = { source: SimNode; target: SimNode; kind: string; el?: SVGLineElement };

export default function EntityGraph({
  data,
  height = 560,
  className,
  onNodeClick,
}: {
  data: GraphData;
  height?: number;
  className?: string;
  // When provided, a (non-drag) click invokes this instead of navigating to href.
  // Used by The Map to recenter the graph on the clicked node.
  onNodeClick?: (n: GraphNode) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const clickRef = useRef(onNodeClick);
  clickRef.current = onNodeClick;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !data || !data.nodes || data.nodes.length === 0) return;

    const W = wrap.clientWidth || 800;
    const H = height;
    const VW = Math.max(1300, W * 1.5);
    const VH = Math.max(950, H * 1.7);
    const CX = VW / 2;
    const CY = VH / 2;
    const SVGNS = "http://www.w3.org/2000/svg";

    // ---- scene ----
    const world = document.createElement("div");
    world.style.cssText = "position:absolute;left:0;top:0;transform-origin:0 0;";
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("width", String(VW));
    svg.setAttribute("height", String(VH));
    svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none;";
    world.appendChild(svg);
    wrap.appendChild(world);

    // ---- model ----
    const byId: Record<string, SimNode> = {};
    const nodes: SimNode[] = data.nodes.map((n) => {
      const o: SimNode = {
        ...n,
        x: CX + (Math.random() - 0.5) * 110,
        y: CY + (Math.random() - 0.5) * 110,
        vx: 0, vy: 0, fx: null, fy: null, deg: 0,
      };
      if (o.center) { o.fx = CX; o.fy = CY; }
      byId[o.id] = o;
      return o;
    });
    const links: SimLink[] = data.links
      .map((l) => ({ source: byId[l.s], target: byId[l.t], kind: l.kind || "struct" }))
      .filter((l) => l.source && l.target) as SimLink[];
    links.forEach((l) => { l.source.deg++; l.target.deg++; });

    const neighbors = (n: SimNode) => {
      const s = new Set<SimNode>([n]);
      links.forEach((l) => { if (l.source === n) s.add(l.target); if (l.target === n) s.add(l.source); });
      return s;
    };
    const radius = (n: SimNode) =>
      n.center ? 13 : n.type === "figure" ? Math.min(11, 5 + n.deg * 1.5)
      : n.type === "reading" || n.type === "trope" ? 7
      : Math.min(11, 5 + n.deg * 1.5);

    // ---- edges (svg) ----
    links.forEach((l) => {
      const ln = document.createElementNS(SVGNS, "line");
      ln.setAttribute("stroke", EDGE[l.kind as keyof typeof EDGE] || EDGE.struct);
      ln.setAttribute("stroke-width", "1.1");
      svg.appendChild(ln);
      l.el = ln;
    });

    // ---- nodes (dom) ----
    const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
    nodes.forEach((n) => {
      const el = document.createElement("div");
      const r = radius(n);
      const col = n.center ? CENTER_COL : COLORS[n.type] || COLORS.figure;
      const big = !!n.center;
      el.style.cssText =
        "position:absolute;transform:translate(-50%,-50%);cursor:pointer;user-select:none;transition:opacity .22s;";
      const dotShadow = big ? "box-shadow:0 0 0 4px rgba(227,18,11,.14),0 0 20px rgba(227,18,11,.28);" : "";
      const labelText = n.type === "figure" && !n.center ? trunc(n.label, 42) : n.label;
      const subHtml = n.sub
        ? `<span style="display:block;font:400 10px/1.1 ui-sans-serif,system-ui;color:#8a857b;margin-top:2px;">${esc(n.sub)}</span>`
        : "";
      el.innerHTML =
        `<div style="width:${r * 2}px;height:${r * 2}px;border-radius:50%;margin:0 auto;background:${col.dot};${dotShadow}transition:transform .18s;"></div>` +
        `<div style="position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:5px;white-space:nowrap;` +
        `font:${big ? "500 14px" : "500 12px"}/1.15 ui-sans-serif,system-ui,sans-serif;color:${col.label};` +
        `text-shadow:0 1px 3px rgba(255,255,255,.95),0 0 2px rgba(255,255,255,.95);pointer-events:none;">${esc(labelText)}${subHtml}</div>`;
      el.title = n.label + (n.sub ? " — " + n.sub : "");
      n.el = el;
      world.appendChild(el);
      attachNode(n, el);
    });

    // ---- view transform (pan / zoom) ----
    let k = 1, tx = W / 2 - CX, ty = H / 2 - CY;
    const applyView = () => { world.style.transform = `translate(${tx}px,${ty}px) scale(${k})`; };
    applyView();
    const toWorld = (clientX: number, clientY: number) => {
      const r = wrap.getBoundingClientRect();
      return { x: (clientX - r.left - tx) / k, y: (clientY - r.top - ty) / k };
    };

    // ---- interaction state ----
    let dragNode: SimNode | null = null;
    let downAt = { x: 0, y: 0 };
    let moved = false;
    let panning = false;
    let panStart = { x: 0, y: 0, tx: 0, ty: 0 };
    let alpha = 0.5;

    function attachNode(n: SimNode, el: HTMLDivElement) {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        dragNode = n; moved = false; downAt = { x: e.clientX, y: e.clientY };
        const w = toWorld(e.clientX, e.clientY);
        n.fx = w.x; n.fy = w.y;
        alpha = Math.max(alpha, 0.7);
        (el as HTMLElement).setPointerCapture?.(e.pointerId);
      });
      el.addEventListener("mouseenter", () => focus(n));
      el.addEventListener("mouseleave", unfocus);
    }

    const onMove = (e: PointerEvent) => {
      if (dragNode) {
        if (Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y) > 4) moved = true;
        const w = toWorld(e.clientX, e.clientY);
        dragNode.fx = w.x; dragNode.fy = w.y;
        alpha = Math.max(alpha, 0.5);
      } else if (panning) {
        tx = panStart.tx + (e.clientX - panStart.x);
        ty = panStart.ty + (e.clientY - panStart.y);
        applyView();
      }
    };
    const onUp = () => {
      if (dragNode) {
        const n = dragNode;
        if (!moved) {
          if (clickRef.current) clickRef.current(n);
          else if (n.href) router.push(n.href);
        }
        if (!n.center) { n.fx = null; n.fy = null; }
        dragNode = null;
      }
      panning = false;
    };
    const onDownBg = (e: PointerEvent) => {
      panning = true; panStart = { x: e.clientX, y: e.clientY, tx, ty };
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nk = Math.max(0.4, Math.min(2.4, k * f));
      const wx = (px - tx) / k, wy = (py - ty) / k;
      k = nk; tx = px - wx * k; ty = py - wy * k; applyView();
    };

    wrap.addEventListener("pointerdown", onDownBg);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    wrap.addEventListener("wheel", onWheel, { passive: false });

    // ---- focus / dim ----
    function focus(n: SimNode) {
      const nb = neighbors(n);
      nodes.forEach((m) => { if (m.el) m.el.style.opacity = nb.has(m) ? "1" : "0.12"; });
      links.forEach((l) => {
        const on = l.source === n || l.target === n;
        if (l.el) {
          l.el.setAttribute("stroke", on ? EDGE_HI[l.kind as keyof typeof EDGE_HI] || EDGE_HI.struct : EDGE[l.kind as keyof typeof EDGE] || EDGE.struct);
          l.el.setAttribute("stroke-width", on ? "2" : "1.1");
        }
      });
    }
    function unfocus() {
      nodes.forEach((m) => { if (m.el) m.el.style.opacity = "1"; });
      links.forEach((l) => {
        if (l.el) { l.el.setAttribute("stroke", EDGE[l.kind as keyof typeof EDGE] || EDGE.struct); l.el.setAttribute("stroke-width", "1.1"); }
      });
    }

    // ---- force simulation ----
    let raf = 0;
    const tick = () => {
      const n = nodes.length;
      // repulsion (O(n^2) — fine for an ego-network)
      for (let i = 0; i < n; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < n; j++) {
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 1) d2 = 1;
          if (d2 < 160000) {
            const f = 2400 / d2, d = Math.sqrt(d2), fx = (f * dx) / d, fy = (f * dy) / d;
            a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
          }
        }
      }
      // springs
      for (const l of links) {
        const len = l.kind === "struct" ? 96 : l.source.center || l.target.center ? 150 : 82;
        let dx = l.target.x - l.source.x, dy = l.target.y - l.source.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = ((d - len) * 0.035 * (0.35 + alpha)), fx = (f * dx) / d, fy = (f * dy) / d;
        l.source.vx += fx; l.source.vy += fy; l.target.vx -= fx; l.target.vy -= fy;
      }
      // gravity + integrate
      for (const a of nodes) {
        if (a.fx != null) { a.x = a.fx; a.y = a.fy as number; a.vx = 0; a.vy = 0; }
        else {
          a.vx += (CX - a.x) * 0.006; a.vy += (CY - a.y) * 0.006;
          a.vx *= 0.82; a.vy *= 0.82; a.x += a.vx; a.y += a.vy;
        }
        if (a.el) { a.el.style.left = a.x + "px"; a.el.style.top = a.y + "px"; }
      }
      for (const l of links) {
        if (l.el) {
          l.el.setAttribute("x1", String(l.source.x)); l.el.setAttribute("y1", String(l.source.y));
          l.el.setAttribute("x2", String(l.target.x)); l.el.setAttribute("y2", String(l.target.y));
        }
      }
      // keep a touch of life so drags always feel elastic; never fully freeze
      alpha = Math.max(0, alpha * 0.95);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // ---- cleanup ----
    return () => {
      cancelAnimationFrame(raf);
      wrap.removeEventListener("pointerdown", onDownBg);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeChild(world);
    };
  }, [data, height, router]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height,
        overflow: "hidden",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "radial-gradient(120% 100% at 50% 30%, #ffffff, #f6f4ee)",
        touchAction: "pan-y",
        cursor: "grab",
      }}
    />
  );
}

function esc(s: string) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
