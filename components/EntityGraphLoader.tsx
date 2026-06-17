"use client";

/**
 * EntityGraphLoader — fetches a graph seed (graph_film_seed / graph_figure_seed)
 * on mount and hands it to the Obsidian-style <EntityGraph>. Client-side + lazy
 * so the (large) graph payload never bloats the page's SSR HTML.
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
  height = 520,
}: {
  kind: "film" | "figure";
  filmSlug: string;
  figureSlug?: string;
  height?: number;
}) {
  const [data, setData] = useState<GraphData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = sb();
      const res =
        kind === "film"
          ? await s.rpc("graph_film_seed", { p_slug: filmSlug })
          : await s.rpc("graph_figure_seed", { p_film_slug: filmSlug, p_figure_slug: figureSlug });
      if (!alive) return;
      const d = res.data as GraphData | null;
      if (res.error || !d || !Array.isArray(d.nodes) || d.nodes.length === 0) { setFailed(true); return; }
      setData(d);
    })();
    return () => { alive = false; };
  }, [kind, filmSlug, figureSlug]);

  if (failed) return null;

  return (
    <div className="eg">
      <div className="eg-cap">Connections <span>· drag a node, hover to focus, click to travel</span></div>
      {data
        ? <EntityGraph data={data} height={height} />
        : <div className="eg-skel" style={{ height }}>Drawing connections…</div>}
    </div>
  );
}
