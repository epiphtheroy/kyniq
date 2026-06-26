"use client";

import EntityGraph, { type GraphData, type GraphNode, type GraphLink } from "@/components/EntityGraph";

type FilmNode = { title: string; slug: string };
type TropeNode = { title: string; slug: string };

// Connection map for a concept: the concept at the hub, its films + tropes as spokes.
// Reuses the proven EntityGraph force renderer (same as the home constellation).
export default function ConceptMap({
  name,
  films,
  tropes,
}: {
  name: string;
  films: FilmNode[];
  tropes: TropeNode[];
}) {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const cId = "c:concept";
  nodes.push({ id: cId, type: "reading", label: name, href: null, center: true });

  for (const f of films.slice(0, 12)) {
    if (!f.slug) continue;
    const id = "f:" + f.slug;
    nodes.push({ id, type: "film", label: f.title, href: `/film/${f.slug}` });
    links.push({ s: cId, t: id, kind: "reading" });
  }
  for (const t of tropes.slice(0, 6)) {
    if (!t.slug) continue;
    const id = "m:" + t.slug;
    nodes.push({ id, type: "trope", label: t.title, href: `/trope/${t.slug}` });
    links.push({ s: cId, t: id, kind: "trope" });
  }

  const data: GraphData = { nodes, links };
  if (nodes.length <= 1) return null;
  return <EntityGraph data={data} height={420} />;
}
