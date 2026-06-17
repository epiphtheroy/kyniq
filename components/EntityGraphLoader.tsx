"use client";

/**
 * EntityGraphLoader — fetches a graph seed (graph_film_seed / graph_figure_seed)
 * on mount and hands it to the Obsidian-style <EntityGraph>. Client-side + lazy
 * so the (large) graph payload never bloats the page's SSR HTML.
 * Shows a caption (what the graph is) and an Expand toggle to enlarge it.
 */

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import EntityGraph, { type GraphData } from "./EntityGraph";

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default function EntityGraphLoader({
  kind,
  filmSlug,
  figureSlug,
  slug,
  label,
  height = 440,
}: {
  kind: "film" | "figure" | "metatake" | "trope";
  filmSlug?: string;
  figureSlug?: string;
  slug?: string;
  label?: string;
  height?: number;
}) {
  const [data, setData] = useState<GraphData | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = sb();
      const res =
        kind === "film"
          ? await s.rpc("graph_film_seed", { p_slug: filmSlug })
          : kind === "figure"
          ? await s.rpc("graph_figure_seed", { p_film_slug: filmSlug, p_figure_slug: figureSlug })
          : kind === "metatake"
          ? await s.rpc("graph_metatake_seed", { p_slug: slug })
          : await s.rpc("graph_trope_seed", { p_slug: slug });
      if (!alive) return;
      const d = res.data as GraphData | null;
      if (res.error || !d || !Array.isArray(d.nodes) || d.nodes.length === 0) { setFailed(true); return; }
      setData(d);
    })();
    return () => { alive = false; };
  }, [kind, filmSlug, figureSlug, slug]);

  if (failed) return null;

  const h = expanded ? 820 : height;
  const subject =
    label ?? (kind === "film" ? "this film" : kind === "figure" ? "this figure" : kind === "metatake" ? "this reading" : "this trope");

  return (
    <div className="eg">
      <div className="eg-head">
        <div className="eg-cap">
          <span className="eg-cap__t">Connection map · {subject}</span>
          <span className="eg-cap__s">Built from AI embeddings — the films, figures, readings and tropes nearest in meaning. Drag a node, hover to focus, click to travel.</span>
        </div>
        {data ? (
          <button type="button" className="eg-exp" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? "Collapse" : "Expand ⤢"}
          </button>
        ) : null}
      </div>
      {data
        ? <EntityGraph data={data} height={h} />
        : <div className="eg-skel" style={{ height: h }}>Drawing connections…</div>}
    </div>
  );
}
