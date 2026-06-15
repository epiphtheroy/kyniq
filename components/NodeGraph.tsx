"use client";

/**
 * NodeGraph — a directory-style drill-down explorer of a node's connections.
 * (Replaces the radial force graph, whose labels overlapped.) A breadcrumb tab
 * bar at the top grows sideways as you drill; the current node's neighbours fall
 * down as a readable list. Click a row to go onward; click a tab to jump back;
 * click ↗ to open that node's real page.
 *
 * Neighbours come from the graph_* RPCs (migration 0018). Homogeneous per type
 * (film→films, meta-take→meta-takes, figure→figures); a reading opens onto its
 * meta-take hub + the figures of kindred readings.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function sbc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Kind = "film" | "meta_take" | "figure" | "take";
interface NavNode {
  kind: Kind; id: string; label: string; sub?: string; href?: string; weight?: string;
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
      href: `/film/${r.slug}`, weight: fmt(r.weight), filmSlug: r.slug,
    }));
  }
  if (n.kind === "meta_take") {
    const { data } = await db.rpc("graph_meta_take_neighbors", { p_slug: n.mtSlug, p_limit: 16 });
    return ((data ?? []) as { slug: string; title: string; weight: number }[]).map((r) => ({
      kind: "meta_take", id: `mt:${r.slug}`, label: r.title, href: `/take/${r.slug}`,
      weight: `${Math.round(r.weight * 100)}%`, mtSlug: r.slug,
    }));
  }
  if (n.kind === "figure") {
    const { data } = await db.rpc("graph_figure_neighbors", { p_film_slug: n.filmSlug, p_figure_slug: n.figureSlug, p_limit: 16 });
    return ((data ?? []) as { slug: string; label: string; film_slug: string; film_title: string; weight: number }[]).map((r) => ({
      kind: "figure", id: `fig:${r.film_slug}/${r.slug}`, label: r.label, sub: r.film_title,
      href: `/film/${r.film_slug}/figure/${r.slug}`, weight: `×${r.weight}`, filmSlug: r.film_slug, figureSlug: r.slug,
    }));
  }
  // take → meta-take hub + the figures of kindred readings
  const { data } = await db.rpc("graph_meta_take_siblings", { p_mt_slug: n.mtSlug, p_exclude: n.takeId, p_limit: 16 });
  const hub: NavNode = { kind: "meta_take", id: `mt:${n.mtSlug}`, label: n.mtTitle ?? "meta take", href: `/take/${n.mtSlug}`, weight: "hub", mtSlug: n.mtSlug };
  const figs = ((data ?? []) as { take_id: string; label: string; figure_slug: string; film_slug: string; film_title: string }[]).map((r) => ({
    kind: "figure" as const, id: `fig:${r.film_slug}/${r.figure_slug}`, label: r.label, sub: r.film_title,
    href: `/film/${r.film_slug}/figure/${r.figure_slug}`, filmSlug: r.film_slug, figureSlug: r.figure_slug,
  }));
  return [hub, ...figs];
}

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

  // keep the newest breadcrumb in view (it grows sideways)
  useEffect(() => { const el = crumbRef.current; if (el) el.scrollLeft = el.scrollWidth; }, [trail.length]);

  const drill = useCallback((n: NavNode) => setTrail((t) => [...t, n]), []);
  const jump = useCallback((i: number) => setTrail((t) => t.slice(0, i + 1)), []);
  const go = (e: React.MouseEvent, href?: string) => { e.stopPropagation(); if (href) router.push(href); };

  const KIND_LABEL: Record<Kind, string> = { film: "film", meta_take: "meta take", figure: "figure", take: "reading" };

  const body = (
    <div className="ng-body">
      <div className="ng-crumbs" ref={crumbRef}>
        {trail.map((t, i) => (
          <span key={t.id + i} className={`ng-crumb${i === trail.length - 1 ? " on" : ""}`}>
            {i > 0 ? <span className="ng-crumb-sep">›</span> : null}
            <button type="button" className="ng-crumb-btn" onClick={() => jump(i)} title={t.label}>{t.label}</button>
            {t.href ? <button type="button" className="ng-go" title="Open page" onClick={(e) => go(e, t.href)}>↗</button> : null}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="ng-loading">Loading…</div>
      ) : neighbors.length === 0 ? (
        <div className="ng-empty">No further connections from here.</div>
      ) : (
        <ul className="ng-list">
          {neighbors.map((n) => (
            <li key={n.id} className="ng-row" onClick={() => drill(n)} role="button" tabIndex={0}>
              <span className="ng-row-kind">{KIND_LABEL[n.kind]}</span>
              <span className="ng-row-label">{n.label}</span>
              {n.sub ? <span className="ng-row-sub">{n.sub}</span> : null}
              {n.weight ? <span className="ng-row-w">{n.weight}</span> : null}
              {n.href ? <button type="button" className="ng-go" title="Open page" onClick={(e) => go(e, n.href)}>↗</button> : null}
              <span className="ng-row-chev">›</span>
            </li>
          ))}
        </ul>
      )}
      <div className="ng-hint">Click a row to go deeper · click a tab above to go back · ↗ opens the page.</div>
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
