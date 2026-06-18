"use client";

import EntityGraph, { type GraphData, type GraphNode, type GraphLink } from "@/components/EntityGraph";

type CPair = { mt: string; slug: string; a: { f: string; fs: string }; b: { f: string; fs: string } };

/** Home constellation — the unlikely pairs as a graph: two films joined by the
 *  meta-take they secretly share. Uses the proven EntityGraph force renderer. */
export default function HomeConstellation({ pairs }: { pairs: CPair[] }) {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const seen = new Set<string>();
  const add = (nd: GraphNode) => { if (!seen.has(nd.id)) { seen.add(nd.id); nodes.push(nd); } };

  for (const p of pairs) {
    if (!p.a?.f || !p.b?.f || !p.mt) continue;
    const aId = "f:" + (p.a.fs || p.a.f);
    const bId = "f:" + (p.b.fs || p.b.f);
    const mId = "m:" + (p.slug || p.mt);
    add({ id: aId, type: "film", label: p.a.f, href: p.a.fs ? `/film/${p.a.fs}` : null });
    add({ id: bId, type: "film", label: p.b.f, href: p.b.fs ? `/film/${p.b.fs}` : null });
    add({ id: mId, type: "reading", label: p.mt, href: p.slug ? `/take/${p.slug}` : null });
    links.push({ s: aId, t: mId, kind: "reading" });
    links.push({ s: bId, t: mId, kind: "reading" });
  }

  const data: GraphData = { nodes, links };
  if (nodes.length === 0) return null;
  return <EntityGraph data={data} height={440} />;
}
