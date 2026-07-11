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
import { mtEvent } from "@/components/mtTrack";

export type GraphNode = {
  id: string;
  type: "film" | "figure" | "reading" | "trope" | "idea" | "director" | "theorist";
  label: string;
  sub?: string | null;
  href?: string | null;
  center?: boolean;
  img?: string | null;   // poster (film) or profile photo (director)
  dim?: string | null;   // faint inline suffix — film year / director birth year
};
export type GraphLink = { s: string; t: string; kind?: "struct" | "reading" | "trope" | "next" | "recby" | "like" | "counter"; arrow?: boolean; w?: number | null };
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
  next: "rgba(200,16,46,0.40)",
  recby: "rgba(31,111,178,0.42)",
  like: "rgba(0,0,0,0.13)",
  counter: "rgba(230,126,34,0.42)",
};
const EDGE_HI = { struct: "rgba(0,0,0,0.42)", reading: "#C0392B", trope: "#0F6E56", next: "#C8102E", recby: "#1F6FB2", like: "rgba(0,0,0,0.45)", counter: "#E67E22" };

type SimNode = GraphNode & {
  x: number; y: number; vx: number; vy: number;
  fx: number | null; fy: number | null; deg: number;
  el?: HTMLDivElement;
};
type SimLink = { source: SimNode; target: SimNode; kind: string; arrow: boolean; el?: SVGLineElement };

export default function EntityGraph({
  data,
  height = 560,
  className,
  onNodeClick,
  onOpen,
}: {
  data: GraphData;
  height?: number;
  className?: string;
  // When provided, a (non-drag) click invokes this instead of navigating to href.
  // Used by The Map to recenter the graph on the clicked node.
  onNodeClick?: (n: GraphNode) => void;
  // The little ↗ shortcut on each node — navigate to the entity page.
  onOpen?: (n: GraphNode) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const clickRef = useRef(onNodeClick);
  clickRef.current = onNodeClick;
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

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
    // arrowhead markers for directed links: next (red) and recommended-by (blue)
    const defs = document.createElementNS(SVGNS, "defs");
    const mkArrow = (id: string, fill: string) => {
      const mk = document.createElementNS(SVGNS, "marker");
      mk.setAttribute("id", id); mk.setAttribute("viewBox", "0 0 10 10");
      mk.setAttribute("refX", "9"); mk.setAttribute("refY", "5");
      mk.setAttribute("markerWidth", "7"); mk.setAttribute("markerHeight", "7");
      mk.setAttribute("orient", "auto-start-reverse");
      const mp = document.createElementNS(SVGNS, "path");
      mp.setAttribute("d", "M0,0 L10,5 L0,10 z"); mp.setAttribute("fill", fill);
      mk.appendChild(mp); defs.appendChild(mk);
    };
    mkArrow("mk-next", "#C8102E");
    mkArrow("mk-recby", "#1F6FB2");
    svg.appendChild(defs);
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
      .map((l) => ({ source: byId[l.s], target: byId[l.t], kind: l.kind || "struct", arrow: !!l.arrow }))
      .filter((l) => l.source && l.target) as SimLink[];
    links.forEach((l) => { l.source.deg++; l.target.deg++; });

    const neighbors = (n: SimNode) => {
      const s = new Set<SimNode>([n]);
      links.forEach((l) => { if (l.source === n) s.add(l.target); if (l.target === n) s.add(l.source); });
      return s;
    };
    const radius = (n: SimNode) => {
      if (n.img) return n.center ? 30 : 22;           // poster / face nodes
      if (n.center) return 15;
      if (n.type === "figure") return Math.min(11, 5 + n.deg * 1.5);
      if (n.type === "reading" || n.type === "trope") return 7;
      return Math.min(11, 5 + n.deg * 1.5);
    };

    // ---- edges (svg) ----
    links.forEach((l) => {
      const ln = document.createElementNS(SVGNS, "line");
      ln.setAttribute("stroke", EDGE[l.kind as keyof typeof EDGE] || EDGE.struct);
      // kin-weighted width for film↔film "like" edges (film_kinship.kin, 0–100);
      // arrows keep their fixed width; unweighted edges fall back to 1.1.
      ln.setAttribute("stroke-width", l.arrow ? "1.5" : l.w != null ? String(1 + 1.6 * Math.min(l.w, 100) / 100) : "1.1");
      if (l.arrow) ln.setAttribute("marker-end", l.kind === "recby" ? "url(#mk-recby)" : "url(#mk-next)");
      svg.appendChild(ln);
      l.el = ln;
    });

    // ---- nodes (dom) ----
    const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
    nodes.forEach((n) => {
      const el = document.createElement("div");
      // film nodes opt into the My Films lens (LensProvider's DOM engine marks
      // [data-lens-film] elements; CSS rings seen posters / dims unseen in only-mode)
      if (n.type === "film" && n.id.startsWith("film:")) el.dataset.lensFilm = n.id.slice(5);
      const r = radius(n);
      const col = n.center ? CENTER_COL : COLORS[n.type] || COLORS.figure;
      const big = !!n.center;
      el.style.cssText =
        "position:absolute;transform:translate(-50%,-50%);cursor:pointer;user-select:none;transition:opacity .22s;";
      const ring = big ? ",0 0 0 3px rgba(227,18,11,.55)" : "";

      // marker: poster (film) / face circle (director) / coloured dot
      let marker: string;
      if (n.img && n.type === "film") {
        const w = big ? 48 : 36, h = Math.round(w * 1.45);
        marker = `<img src="${esc(n.img)}" alt="" draggable="false" style="width:${w}px;max-width:none;height:${h}px;object-fit:cover;border-radius:4px;display:block;margin:0 auto;box-shadow:0 2px 9px rgba(0,0,0,.30)${ring};">`;
      } else if (n.img && (n.type === "director" || n.type === "theorist")) {
        const d = big ? 62 : 46;
        marker = `<img src="${esc(n.img)}" alt="" draggable="false" style="width:${d}px;max-width:none;height:${d}px;object-fit:cover;border-radius:50%;display:block;margin:0 auto;box-shadow:0 2px 9px rgba(0,0,0,.30)${ring};">`;
      } else {
        const dotShadow = big ? "box-shadow:0 0 0 4px rgba(227,18,11,.14),0 0 20px rgba(227,18,11,.28);" : "";
        marker = `<div style="width:${r * 2}px;height:${r * 2}px;border-radius:50%;margin:0 auto;background:${col.dot};${dotShadow}transition:transform .18s;"></div>`;
      }
      el.innerHTML = marker;
      el.title = n.label + (n.sub ? " — " + n.sub : "");

      // label — title, faint inline year, then a small ↗ that opens the page.
      const labelText = n.type === "figure" && !n.center ? trunc(n.label, 42) : trunc(n.label, 60);
      const dimHtml = n.dim ? ` <span style="color:#a39c91;font-weight:400;">${esc(n.dim)}</span>` : "";
      const labelDiv = document.createElement("div");
      labelDiv.style.cssText =
        `position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:5px;white-space:nowrap;` +
        `font:${big ? "600 14px" : "500 12px"}/1.15 ui-sans-serif,system-ui,sans-serif;color:${col.label};` +
        `text-shadow:0 1px 3px rgba(255,255,255,.95),0 0 2px rgba(255,255,255,.95);pointer-events:none;`;
      labelDiv.innerHTML = `<span class="eg-nodelabel" style="pointer-events:auto;cursor:pointer;">${esc(labelText)}${dimHtml}</span>`;
      if (n.href) {
        const open = document.createElement("span");
        open.textContent = "↗";
        open.title = "Open page";
        open.style.cssText = "pointer-events:auto;cursor:pointer;margin-left:4px;font-size:0.8em;font-weight:700;color:#C8102E;vertical-align:baseline;";
        open.addEventListener("pointerdown", (e) => { e.stopPropagation(); });
        open.addEventListener("click", (e) => {
          e.stopPropagation();
          if (openRef.current) openRef.current(n); else if (n.href) router.push(n.href);
        });
        labelDiv.appendChild(open);
      }
      if (n.sub) {
        const s = document.createElement("span");
        s.style.cssText = "display:block;font:400 10px/1.1 ui-sans-serif,system-ui;color:#8a857b;margin-top:2px;";
        s.textContent = n.sub;
        labelDiv.appendChild(s);
      }
      el.appendChild(labelDiv);

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
        // Don't pin/drag yet — only once the pointer clearly moves. A still press
        // (incl. trackpad clicks that jitter a few px) stays a click → recenter.
        (el as HTMLElement).setPointerCapture?.(e.pointerId);
      });
      el.addEventListener("mouseenter", () => focus(n));
      el.addEventListener("mouseleave", unfocus);
      // single click = navigate within the map (recenter). Drags are filtered by `moved`.
      el.addEventListener("click", () => {
        if (moved) return;
        mtEvent("graph:node");
        if (clickRef.current) clickRef.current(n);
        else if (n.href) router.push(n.href);
      });
    }

    const onMove = (e: PointerEvent) => {
      if (dragNode) {
        if (!moved) {
          if (Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y) > 8) { moved = true; mtEvent("graph:drag"); }
          else return; // small jitter — keep it a click, don't start dragging
        }
        const w = toWorld(e.clientX, e.clientY);
        dragNode.fx = w.x; dragNode.fy = w.y;
        alpha = Math.max(alpha, 0.6);
      } else if (panning) {
        mtEvent("graph:pan");
        tx = panStart.tx + (e.clientX - panStart.x);
        ty = panStart.ty + (e.clientY - panStart.y);
        applyView();
      }
    };
    const onUp = () => {
      // recenter/open is handled by the element's click listener; here we only end a drag
      if (dragNode) {
        const n = dragNode;
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
          let x2 = l.target.x, y2 = l.target.y;
          if (l.arrow) { // pull the head back to the node edge so the arrow is visible
            const dx = x2 - l.source.x, dy = y2 - l.source.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
            const pad = radius(l.target) + 8;
            x2 -= (dx / d) * pad; y2 -= (dy / d) * pad;
          }
          l.el.setAttribute("x1", String(l.source.x)); l.el.setAttribute("y1", String(l.source.y));
          l.el.setAttribute("x2", String(x2)); l.el.setAttribute("y2", String(y2));
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
