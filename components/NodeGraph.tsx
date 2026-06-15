"use client";

/**
 * NodeGraph — an Obsidian-style force-directed "map" of a node's DIRECT neighbours.
 * Lightweight custom simulation (no heavy dep) rendered as SVG, themed with the
 * site's CSS variables. Lives at the bottom of film / meta-take / figure pages and
 * inline (bare) under a reading card for the take → meta-take → kindred-takes view.
 *
 *  - edge thickness + a small number = relatedness (weight)
 *  - click a node body  → re-centre the graph on it (in-graph navigation; same type)
 *  - click the small ↗  → navigate the real page for that node
 *
 * Neighbour data comes from the graph_* RPCs (migration 0018).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const W = 680, H = 360, CX = W / 2, CY = H / 2;

function sbc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Center =
  | { kind: "film"; slug: string; label: string }
  | { kind: "meta_take"; slug: string; label: string }
  | { kind: "figure"; filmSlug: string; figureSlug: string; label: string }
  | { kind: "take"; mtSlug: string; mtTitle: string; label: string; excludeTakeId: string };

type Role = "center" | "hub" | "neighbor";
interface GNode {
  id: string; label: string; sub?: string; href?: string; wlabel?: string;
  role: Role; weight: number; recenter?: Center;
  x: number; y: number; vx: number; vy: number; fx?: number; fy?: number;
}
interface GLink { s: string; t: string; w: number; }

type Props =
  | { kind: "film"; filmSlug: string; label: string; bare?: boolean }
  | { kind: "meta_take"; mtSlug: string; label: string; bare?: boolean }
  | { kind: "figure"; filmSlug: string; figureSlug: string; label: string; bare?: boolean }
  | { kind: "take"; mtSlug: string; mtTitle: string; label: string; excludeTakeId: string; bare?: boolean };

function initialCenter(p: Props): Center {
  if (p.kind === "film") return { kind: "film", slug: p.filmSlug, label: p.label };
  if (p.kind === "meta_take") return { kind: "meta_take", slug: p.mtSlug, label: p.label };
  if (p.kind === "figure") return { kind: "figure", filmSlug: p.filmSlug, figureSlug: p.figureSlug, label: p.label };
  return { kind: "take", mtSlug: p.mtSlug, mtTitle: p.mtTitle, label: p.label, excludeTakeId: p.excludeTakeId };
}

const rnd = () => (Math.random() - 0.5) * 130;
function mk(o: Partial<GNode> & { id: string; label: string; role: Role; weight: number }): GNode {
  return { x: CX + rnd(), y: CY + rnd(), vx: 0, vy: 0, sub: undefined, href: undefined, ...o } as GNode;
}

async function build(c: Center): Promise<{ nodes: GNode[]; links: GLink[]; title: string }> {
  const db = sbc();

  if (c.kind === "film") {
    const { data } = await db.rpc("graph_film_neighbors", { p_slug: c.slug, p_limit: 12 });
    const center = mk({ id: `film:${c.slug}`, label: c.label, role: "center", weight: 1, href: `/film/${c.slug}`, fx: CX, fy: CY });
    const nodes = [center]; const links: GLink[] = [];
    for (const r of (data ?? []) as { slug: string; title: string; year: number | null; weight: number }[]) {
      const id = `film:${r.slug}`;
      nodes.push(mk({ id, label: r.title, sub: r.year ? String(r.year) : undefined, href: `/film/${r.slug}`,
        role: "neighbor", weight: r.weight, wlabel: fmt(r.weight),
        recenter: { kind: "film", slug: r.slug, label: r.title } }));
      links.push({ s: center.id, t: id, w: r.weight });
    }
    return { nodes, links, title: "Related films" };
  }

  if (c.kind === "meta_take") {
    const { data } = await db.rpc("graph_meta_take_neighbors", { p_slug: c.slug, p_limit: 12 });
    const center = mk({ id: `mt:${c.slug}`, label: c.label, role: "center", weight: 1, href: `/take/${c.slug}`, fx: CX, fy: CY });
    const nodes = [center]; const links: GLink[] = [];
    for (const r of (data ?? []) as { slug: string; title: string; weight: number }[]) {
      const id = `mt:${r.slug}`;
      nodes.push(mk({ id, label: r.title, href: `/take/${r.slug}`, role: "neighbor", weight: r.weight,
        wlabel: `${Math.round(r.weight * 100)}%`,
        recenter: { kind: "meta_take", slug: r.slug, label: r.title } }));
      links.push({ s: center.id, t: id, w: r.weight });
    }
    return { nodes, links, title: "Related meta takes" };
  }

  if (c.kind === "figure") {
    const { data } = await db.rpc("graph_figure_neighbors", { p_film_slug: c.filmSlug, p_figure_slug: c.figureSlug, p_limit: 12 });
    const center = mk({ id: `fig:${c.filmSlug}/${c.figureSlug}`, label: c.label, role: "center", weight: 1,
      href: `/film/${c.filmSlug}/figure/${c.figureSlug}`, fx: CX, fy: CY });
    const nodes = [center]; const links: GLink[] = [];
    for (const r of (data ?? []) as { slug: string; label: string; film_slug: string; film_title: string; weight: number }[]) {
      const id = `fig:${r.film_slug}/${r.slug}`;
      nodes.push(mk({ id, label: r.label, sub: r.film_title, href: `/film/${r.film_slug}/figure/${r.slug}`,
        role: "neighbor", weight: r.weight, wlabel: `×${r.weight}`,
        recenter: { kind: "figure", filmSlug: r.film_slug, figureSlug: r.slug, label: r.label } }));
      links.push({ s: center.id, t: id, w: r.weight });
    }
    return { nodes, links, title: "Related figures" };
  }

  // take: this reading → its meta take → kindred takes
  const { data } = await db.rpc("graph_meta_take_siblings", { p_mt_slug: c.mtSlug, p_exclude: c.excludeTakeId, p_limit: 10 });
  const center = mk({ id: "take:center", label: c.label, sub: "this reading", role: "center", weight: 1, fx: CX, fy: CY });
  const hub = mk({ id: `mt:${c.mtSlug}`, label: c.mtTitle, href: `/take/${c.mtSlug}`, role: "hub", weight: 1,
    recenter: { kind: "meta_take", slug: c.mtSlug, label: c.mtTitle } });
  const nodes = [center, hub]; const links: GLink[] = [{ s: center.id, t: hub.id, w: 1 }];
  for (const r of (data ?? []) as { take_id: string; label: string; figure_slug: string; film_slug: string; film_title: string }[]) {
    const id = `take:${r.take_id}`;
    nodes.push(mk({ id, label: r.label, sub: r.film_title, href: `/film/${r.film_slug}/figure/${r.figure_slug}`, role: "neighbor", weight: 0.6 }));
    links.push({ s: hub.id, t: id, w: 0.6 });
  }
  return { nodes, links, title: "This reading → meta take → kindred readings" };
}

function fmt(w: number): string {
  if (w >= 10) return String(Math.round(w));
  return (Math.round(w * 10) / 10).toString();
}
function trunc(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function step(nodes: GNode[], links: GLink[]) {
  const REP = 2600, GRAV = 0.016, SPRING = 0.045, DAMP = 0.85, L0 = 120;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y; let d2 = dx * dx + dy * dy; if (d2 < 1) d2 = 1;
      const d = Math.sqrt(d2); const f = REP / d2;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
  }
  for (const l of links) {
    const a = byId.get(l.s), b = byId.get(l.t); if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const target = L0 * (1 - 0.32 * Math.min(1, l.w));
    const f = SPRING * (d - target);
    a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
  }
  for (const n of nodes) {
    n.vx += (CX - n.x) * GRAV; n.vy += (CY - n.y) * GRAV;
    n.vx *= DAMP; n.vy *= DAMP;
    if (n.fx != null) { n.x = n.fx; n.y = n.fy as number; n.vx = 0; n.vy = 0; }
    else {
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(46, Math.min(W - 46, n.x));
      n.y = Math.max(28, Math.min(H - 30, n.y));
    }
  }
}

export default function NodeGraph(props: Props) {
  const router = useRouter();
  const bare = props.bare ?? false;
  const [center, setCenter] = useState<Center>(() => initialCenter(props));
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [, setFrame] = useState(0);

  const nodesRef = useRef<GNode[]>([]);
  const linksRef = useRef<GLink[]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const loadedRef = useRef(false);

  const runSim = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let iters = 0;
    const tick = () => {
      step(nodesRef.current, linksRef.current);
      iters++;
      setFrame((f) => f + 1);
      const e = nodesRef.current.reduce((s, n) => s + Math.abs(n.vx) + Math.abs(n.vy), 0);
      if (iters < 500 && e > 0.5) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    build(center).then((g) => {
      if (!alive) return;
      nodesRef.current = g.nodes; linksRef.current = g.links;
      setTitle(g.title); setCount(g.nodes.length - 1); setLoading(false);
      loadedRef.current = true;
      runSim();
    });
    return () => { alive = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [center, open, runSim]);

  const nodes = nodesRef.current, links = linksRef.current;
  const maxW = Math.max(0.0001, ...links.map((l) => l.w));

  const onNode = (n: GNode) => { if (n.recenter && n.role !== "center") setCenter(n.recenter); };
  const onGo = (e: React.MouseEvent, href?: string) => { e.stopPropagation(); if (href) router.push(href); };

  const svg = (
    <svg className="ng-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={title}>
      {links.map((l, i) => {
        const a = nodes.find((n) => n.id === l.s), b = nodes.find((n) => n.id === l.t);
        if (!a || !b) return null;
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="ng-edge" strokeWidth={0.6 + 2.8 * (l.w / maxW)} />;
      })}
      {nodes.map((n) => {
        const r = n.role === "center" ? 7.5 : n.role === "hub" ? 6 : 4.5;
        return (
          <g key={n.id} transform={`translate(${n.x},${n.y})`} className={`ng-node ng-${n.role}`}
             onClick={() => onNode(n)} style={{ cursor: n.recenter && n.role !== "center" ? "pointer" : "default" }}>
            <circle r={r} className="ng-dot" />
            <text className="ng-label" y={r + 12} textAnchor="middle">
              {trunc(n.label, 22)}{n.wlabel ? ` ${n.wlabel}` : ""}
            </text>
            {n.sub ? <text className="ng-sub" y={r + 23} textAnchor="middle">{trunc(n.sub, 26)}</text> : null}
            {n.href ? (
              <text className="ng-go" x={r + 2} y={-r + 2} onClick={(e) => onGo(e, n.href)}>↗</text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );

  if (bare) {
    return (
      <div className="ng-bare">
        {loading ? <div className="ng-loading">map…</div> : count === 0 ? <div className="ng-empty">No kindred readings yet.</div> : svg}
      </div>
    );
  }

  return (
    <details className="ng-box film-info" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Map{open && !loading ? ` — ${title} (${count})` : ""}</summary>
      <div className="ng-body">
        {loading ? <div className="ng-loading">Building map…</div>
          : count === 0 ? <div className="ng-empty">No direct connections yet.</div>
          : (<>
              {svg}
              <div className="ng-hint">Click a node to recenter · click ↗ to open its page · line weight = relatedness.</div>
            </>)}
      </div>
    </details>
  );
}
