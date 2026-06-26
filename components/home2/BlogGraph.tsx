"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HomeV2, GraphNode } from "@/lib/home2";
import { hashTone, tone, blogHref, filmHref, tropeHref } from "./helpers";

// Note: graph nodes use plain SVG <a> (faithful to the mockup, which rendered
// <a href> inside <svg>). Using next/link inside <svg> would emit an HTML anchor
// in the SVG namespace and risk hydration warnings.

// ── Node graph (ported from mockup graph()/shuffle/clip) ──
type GNode = { l: string; t: "film" | "trope"; slug: string; x: number; y: number };

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function clip(s: string): string {
  return s.length > 17 ? s.slice(0, 16) + "…" : s;
}

function buildGraph(pool: GraphNode[]): { nodes: GNode[]; edges: { x1: number; y1: number; x2: number; y2: number }[] } {
  const pick = shuffle(pool).slice(0, 9);
  const cols = [70, 180, 290];
  const rows = [80, 185, 300];
  const nodes: GNode[] = pick.map((p, i) => {
    const cx = cols[i % 3] + (Math.random() * 44 - 22);
    const cy = rows[Math.floor(i / 3)] + (Math.random() * 40 - 20);
    return { l: p.label, t: p.kind, slug: p.slug, x: cx, y: cy };
  });
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  nodes.forEach((n, i) => {
    const j = (i + 1) % nodes.length;
    edges.push({ x1: n.x, y1: n.y, x2: nodes[j].x, y2: nodes[j].y });
    if (Math.random() > 0.5) {
      const k = Math.floor(Math.random() * nodes.length);
      edges.push({ x1: n.x, y1: n.y, x2: nodes[k].x, y2: nodes[k].y });
    }
  });
  return { nodes, edges };
}

function nodeHref(n: GNode): string {
  if (n.t === "film") return n.slug ? filmHref(n.slug) : "/film";
  return n.slug ? tropeHref(n.slug) : "/tropes";
}

function LiveGraph({ pool }: { pool: GraphNode[] }) {
  // Start empty so the SSR markup is deterministic (no hydration mismatch from
  // Math.random); build + redraw only on the client.
  const [g, setG] = useState<{ nodes: GNode[]; edges: { x1: number; y1: number; x2: number; y2: number }[] }>({
    nodes: [],
    edges: [],
  });
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    const redraw = () => {
      setG(buildGraph(pool));
      setFadeKey((k) => k + 1);
    };
    redraw(); // initial draw on mount
    const id = setInterval(redraw, 3600);
    return () => clearInterval(id);
  }, [pool]);

  return (
    <svg
      key={fadeKey}
      className="gfade"
      id="graph"
      viewBox="0 0 360 380"
      preserveAspectRatio="xMidYMid meet"
    >
      {g.edges.map((e, i) => (
        <line key={i} className="gedge" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
      ))}
      {g.nodes.map((n, i) => {
        const anchor = n.x > 250 ? "end" : "start";
        const tx = anchor === "end" ? n.x - 11 : n.x + 11;
        return (
          <a key={i} href={nodeHref(n)} className="gnode">
            <title>Open: {n.l}</title>
            {n.t === "film" ? (
              <circle cx={n.x} cy={n.y} r={7} fill="#C8102E" />
            ) : (
              <circle cx={n.x} cy={n.y} r={6} fill="#1b1712" stroke="#C8102E" strokeWidth={1.6} />
            )}
            <text x={tx} y={n.y + 3.5} textAnchor={anchor}>
              {clip(n.l)}
            </text>
          </a>
        );
      })}
    </svg>
  );
}

export default function BlogGraph({ data }: { data: HomeV2 }) {
  const { lead, more } = data.blog;
  return (
    <section className="band p2">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              Between Film and the World <span className="chev">›</span>
            </h2>
            <div className="sub">
              The daily column — the day&apos;s events, and the films that already knew · with the live map
            </div>
          </div>
          <Link className="seeall" href="/blog">
            All editions ›
          </Link>
        </div>
        <div className="news">
          <div className="newsmain">
            <Link className="lead" href={blogHref(lead.slug)} id="lead">
              <div className="th" style={{ background: tone(hashTone(lead.title)) }} />
              <div>
                <div className="hl">
                  <em>Between Film and the World</em> — the day&apos;s events, and the films that already knew
                </div>
                <div className="ex">{lead.dek}</div>
                <div className="src">{lead.meta}</div>
              </div>
            </Link>
            <div className="sub2" id="sub2">
              {more.map((a, i) => (
                <Link className="na" href={blogHref(a.slug)} key={i}>
                  <div className="th" style={{ background: tone(hashTone(a.title)) }} />
                  <div>
                    <div className="hl">{a.title}</div>
                    <div className="src">{a.meta}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div className="graphbox">
            <div className="gcap">Wander the map · live</div>
            <div className="gsub">redraws every few seconds — click a node to travel in</div>
            <LiveGraph pool={data.graph} />
          </div>
        </div>
      </div>
    </section>
  );
}
