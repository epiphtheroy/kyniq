"use client";

/**
 * NodeGraph — a connections explorer that is BOTH categorical and graph-like.
 * Readable list of neighbours (no label overlap) + a live "rail" of curved
 * connector lines drawn from the current node to each neighbour (thickness =
 * relatedness). Drilling animates the lines + rows in, so it reads as a dynamic
 * in-map navigation, not a static list. Breadcrumb tabs (deletable) track the path.
 *
 * Data: graph_* RPCs (migration 0018). film→films, meta-take→meta-takes,
 * figure→figures; a reading opens onto its meta-take hub + kindred figures.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function sbc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// rail geometry
const FX = 13, FY = 15, DX = 27, LIST_TOP = 34, ROW = 40, RAIL_W = 40;

type Kind = "film" | "meta_take" | "figure" | "take";
interface NavNode {
  kind: Kind; id: string; label: string; sub?: string; href?: string;
  weight?: string; w?: number;
  filmSlug?: string; figureSlug?: string; mtSlug?: string; mtTitle?: string; takeId?: string;
}

type Props =
  | { kind: "film"; filmSlug: string; label: string; bare?: boolean }
  | { kind: "meta_take"; mtSlug: string; label: string; bare?: boolean }
  | { kind: "figure"; filmSlug: string; figureSlug: string; label: string; bare?: boolean }
  | { kind: "take"; mtSlug: string; mtTitle: string; label: string; excludeTakeId: string; bare?: boolean };

function startNode(p: Props): NavNode {
  if (p.kind === "film") return { kind: "film", id: `film:${p.filmSlug}`, label: p.label, href: `/film/${p.filmSlug}`, filmSlug: p.filmSlug };
  if (p.kind === "meta_take") return { kind: "meta_take", id: `mt:${p.mtSlug}`, label: p.label, href: `/take/${p.mtSlug}`, mtSlug: p.mtSlug };
  if (p.kind === "figure") return { kind: "figure", id: `fig:${p.filmSlug}/${p.figureSlug}`, label: p.label, href: `/film/${p.filmSlug}/figure/${p.figureSlug}`, filmSlug: p.filmSlug, figureSlug: p.figureSlug };
  return { kind: "take", id: "take:center", label: p.label, sub: "this reading", mtSlug: p.mtSlug, mtTitle: p.mtTitle, takeId: p.excludeTakeId };
}

const fmt = (w: number) => (w >= 10 ? String(Math.round(w)) : (Math.round(w * 10) / 10).toString());

async function neighborsOf(n: NavNode): Promise<NavNode[]> {
  const db = sbc();
  if (n.kind === "film") {
    const { data } = await db.rpc("graph_film_neighbors", { p_slug: n.filmSlug, p_limit: 16 });
    return ((data ?? []) as { slug: string; title: string; year: number | null; weight: number }[]).map((r) => ({
      kind: "film", id: `film:${r.slug}`, label: r.title, sub: r.year ? String(r.year) : undefined,
      href: `/film/${r.slug}`, weight: fmt(r.weight), w: r.weight, filmSlug: r.slug,
    }));
  }
  if (n.kind === "meta_take") {
    const { data } = await db.rpc("graph_meta_take_neighbors", { p_slug: n.mtSlug, p_limit: 16 });
    return ((data ?? []) as { slug: string; title: string; weight: number }[]).map((r) => ({
      kind: "meta_take", id: `mt:${r.slug}`, label: r.title, href: `/take/${r.slug}`,
      weight: `${Math.round(r.weight * 100)}%`, w: r.weight, mtSlug: r.slug,
    }));
  }
  if (n.kind === "figure") {
    const { data } = await db.rpc("graph_figure_neighbors", { p_film_slug: n.filmSlug, p_figure_slug: n.figureSlug, p_limit: 16 });
    return ((data ?? []) as { slug: string; label: string; film_slug: string; film_title: string; weight: number }[]).map((r) => ({
      kind: "figure", id: `fig:${r.film_slug}/${r.slug}`, label: r.label, sub: r.film_title,
      href: `/film/${r.film_slug}/figure/${r.slug}`, weight: `×${r.weight}`, w: r.weight, filmSlug: r.film_slug, figureSlug: r.slug,
    }));
  }
  const { data } = await db.rpc("graph_meta_take_siblings", { p_mt_slug: n.mtSlug, p_exclude: n.takeId, p_limit: 16 });
  const hub: NavNode = { kind: "meta_take", id: `mt:${n.mtSlug}`, label: n.mtTitle ?? "meta take", href: `/take/${n.mtSlug}`, weight: "hub", w: 1, mtSlug: n.mtSlug };
  const figs = ((data ?? []) as { take_id: string; label: string; figure_slug: string; film_slug: string; film_title: string }[]).map((r) => ({
    kind: "figure" as const, id: `fig:${r.film_slug}/${r.figure_slug}`, label: r.label, sub: r.film_title,
    href: `/film/${r.film_slug}/figure/${r.figure_slug}`, w: 1, filmSlug: r.film_slug, figureSlug: r.figure_slug,
  }));
  return [hub, ...figs];
}

const KIND_LABEL: Record<Kind, string> = { film: "film", meta_take: "meta take", figure: "figure", take: "reading" };

export default function NodeGraph(props: Props) {
  const router = useRouter();
  const bare = props.bare ?? false;
  const [trail, setTrail] = useState<NavNode[]>(() => [startNode(props)]);
  const [neighbors, setNeighbors] = useState<NavNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const crumbRef = useRef<HTMLDivElement | null>(null);
  const cur = trail[trail.length - 1];

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    neighborsOf(cur).then((ns) => { if (alive) { setNeighbors(ns); setLoading(false); } });
    return () => { alive = false; };
  }, [cur, open]);

  useEffect(() => { const el = crumbRef.current; if (el) el.scrollLeft = el.scrollWidth; }, [trail.length]);

  const drill = useCallback((n: NavNode) => setTrail((t) => [...t, n]), []);
  const jump = useCallback((i: number) => setTrail((t) => t.slice(0, i + 1)), []);
  const removeAt = useCallback((i: number) => setTrail((t) => (i <= 0 ? t : t.slice(0, i))), []);
  const go = (e: React.MouseEvent, href?: string) => { e.stopPropagation(); if (href) router.push(href); };

  const maxW = Math.max(0.0001, ...neighbors.map((n) => n.w ?? 1));
  const railH = LIST_TOP + Math.max(1, neighbors.length) * ROW + 4;

  const body = (
    <div className="ng-body">
      <div className="ng-crumbs" ref={crumbRef}>
        {trail.map((t, i) => (
          <span key={t.id + i} className={`ng-crumb${i === trail.length - 1 ? " on" : ""}`}>
            {i > 0 ? <span className="ng-crumb-sep">›</span> : null}
            <button type="button" className="ng-crumb-btn" onClick={() => jump(i)} title={t.label}>{t.label}</button>
            {t.href ? <button type="button" className="ng-go" title="Open page" onClick={(e) => go(e, t.href)}>↗</button> : null}
            {i > 0 ? <button type="button" className="ng-crumb-x" title="Remove this step" onClick={() => removeAt(i)}>×</button> : null}
          </span>
        ))}
        {trail.length > 1 ? <button type="button" className="ng-clear" title="Back to start" onClick={() => removeAt(1)}>clear</button> : null}
      </div>

      {loading ? (
        <div className="ng-loading">Loading…</div>
      ) : neighbors.length === 0 ? (
        <div className="ng-empty">No further connections from here.</div>
      ) : (
        <div className="ng-tree" key={cur.id} style={{ minHeight: railH }}>
          <svg className="ng-rail" width={RAIL_W} height={railH} viewBox={`0 0 ${RAIL_W} ${railH}`} aria-hidden="true">
            <circle className="ng-rail-focus" cx={FX} cy={FY} r={4} />
            {neighbors.map((n, i) => {
              const y = LIST_TOP + i * ROW + ROW / 2;
              const my = (FY + y) / 2;
              return (
                <g key={n.id} className="ng-rail-link" style={{ animationDelay: `${i * 35}ms` }}>
                  <path d={`M ${FX} ${FY} C ${FX} ${my} ${DX} ${my} ${DX} ${y}`} fill="none"
                        strokeWidth={0.8 + 2.4 * ((n.w ?? 1) / maxW)} />
                  <circle cx={DX} cy={y} r={2.6} />
                </g>
              );
            })}
          </svg>
          <ul className="ng-list" style={{ paddingTop: LIST_TOP }}>
            {neighbors.map((n, i) => (
              <li key={n.id} className="ng-row" style={{ height: ROW, animationDelay: `${i * 35}ms` }}
                  onClick={() => drill(n)} role="button" tabIndex={0}>
                <span className="ng-row-kind">{KIND_LABEL[n.kind]}</span>
                <span className="ng-row-label">{n.label}</span>
                {n.sub ? <span className="ng-row-sub">{n.sub}</span> : null}
                {n.weight ? <span className="ng-row-w">{n.weight}</span> : null}
                {n.href ? <button type="button" className="ng-go" title="Open page" onClick={(e) => go(e, n.href)}>↗</button> : null}
                <span className="ng-row-chev">›</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="ng-hint">Lines = relatedness · click a row to go deeper · a tab to go back · × removes a step · ↗ opens the page.</div>
    </div>
  );

  if (bare) return <div className="ng-bare">{body}</div>;

  return (
    <details className="ng-box film-info" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Map — connections</summary>
      {body}
    </details>
  );
}
