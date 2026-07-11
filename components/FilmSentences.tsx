"use client";

/**
 * FilmSentences — the **Embedding Fantasia** corner on a film page.
 * Rule-based sentences from the `film_sentences` layer, grouped into named
 * TOPICS with pill navigation (the pool is bigger than any one screen).
 *
 * Framing (원우, 2026-07-11): this is the designer's own fantasia — SQL-assembled
 * from Metatake's embedding space, explicitly NOT AI-written text and explicitly
 * independent of the filmmakers' intent; a spark for cinematic imagination.
 * The disclaimer below the heading is part of the contract — keep it.
 *
 * A client component, but the FULL sentence list still server-renders into the
 * HTML (Next.js SSRs client components) — the SEO internal-link mesh survives;
 * the pills only toggle visibility.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { filmUrl, takeUrl, tropeUrl, figureUrl, theoristUrl, lineageUrl } from "@/lib/urls";

export type SentenceRow = {
  id: number;
  pattern: string;
  sentence: string;
  salience: number;
  kin: number | null;
  other: { slug: string; title: string; year: number | null } | null;
  node: { slug: string; title: string; kind: string } | null;
  figure: { slug: string; label: string } | null;
  theorist: { name: string; slug: string } | null;
  lineage: { slug: string; label: string } | null;
  framework: string | null;
};

type Chip = { href: string; label: string };

// The named topics — each is a concept, not a DB code. Order = display order.
const TOPICS: { key: string; name: string; blurb: string; patterns: string[] }[] = [
  { key: "kinships", name: "Kinships", blurb: "films bound to this one by a shared reading", patterns: ["A_affinity", "H_dense", "B_bridge"] },
  { key: "readings", name: "Readings", blurb: "scenes read through a thinker's concept", patterns: ["C_reading"] },
  { key: "lenses", name: "Twin Lenses", blurb: "other films opened by the same lens", patterns: ["G_theorist_twin", "I_lens_twin"] },
  { key: "figures", name: "Tropes & Frames", blurb: "the cross-film figures it stages", patterns: ["L_trope", "M_frame"] },
  { key: "record", name: "The Record", blurb: "honors, lists, and standing", patterns: ["D_award", "E_rank"] },
  { key: "filmography", name: "Filmography", blurb: "inside the director's body of work", patterns: ["F_compare"] },
  { key: "places", name: "Locations", blurb: "where it was actually filmed", patterns: ["J_location"] },
  { key: "questions", name: "Questions", blurb: "open doors — each one leads to its answer", patterns: ["N_question"] },
];
const topicOf = (pattern: string) => TOPICS.find((t) => t.patterns.includes(pattern))?.key ?? "kinships";

function nodeHref(kind: string, slug: string): string | null {
  if (kind === "reading") return takeUrl(slug);
  if (kind === "figure_type") return tropeUrl(slug);
  return null;
}

function chipsFor(r: SentenceRow, filmSlug: string): Chip[] {
  const out: Chip[] = [];
  if (r.other) out.push({ href: filmUrl(r.other.slug), label: r.other.year ? `${r.other.title} (${r.other.year})` : r.other.title });
  if (r.node) {
    const h = nodeHref(r.node.kind, r.node.slug);
    if (h) out.push({ href: h, label: r.node.title });
  }
  if (r.theorist) out.push({ href: theoristUrl(r.theorist.slug), label: r.theorist.name });
  if (r.figure) out.push({ href: figureUrl(filmSlug, r.figure.slug), label: r.figure.label });
  if (r.lineage) out.push({ href: lineageUrl(r.lineage.slug), label: r.lineage.label });
  return out;
}

export default function FilmSentences({ slug, title, rows }: { slug: string; title: string; rows: SentenceRow[] }) {
  const [active, setActive] = useState<string>("all");

  const byTopic = useMemo(() => {
    const m = new Map<string, SentenceRow[]>();
    for (const r of rows ?? []) {
      const k = topicOf(r.pattern);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }, [rows]);

  if (!rows || rows.length < 2) return null;

  const present = TOPICS.filter((t) => (byTopic.get(t.key)?.length ?? 0) > 0);
  const activeTopic = present.find((t) => t.key === active) ?? null;
  // "All" = a curated mix: the top rows across topics (up to 2 per topic, by salience)
  const mix = present
    .flatMap((t) => (byTopic.get(t.key) ?? []).slice(0, 2))
    .sort((a, b) => b.salience - a.salience)
    .slice(0, 7);
  const shown = activeTopic ? (byTopic.get(activeTopic.key) ?? []) : mix;

  return (
    <section className="df-sec" id="df-know">
      <div className="dfk-kicker">Embedding Fantasia <span className="dfk-by">· a data fantasia by Wonwoo Yoon</span></div>
      <h2 className="df-h2">{title} — Embedding Fantasia</h2>
      <p className="df-sub dfk-disclaimer">
        <b>Not AI-written.</b> Every line here is assembled by SQL from Metatake&rsquo;s embedding space — one designer&rsquo;s
        fantasia on the data, independent of the filmmakers&rsquo; intent. Read it as a spark for cinematic imagination;
        every name it drops is a door.
      </p>
      <div className="dfk-nav" role="tablist" aria-label="Fantasia topics">
        <button className={`dfk-pill${active === "all" ? " on" : ""}`} onClick={() => setActive("all")} role="tab" aria-selected={active === "all"}>
          All <span className="dfk-n">{rows.length}</span>
        </button>
        {present.map((t) => (
          <button
            key={t.key}
            className={`dfk-pill${active === t.key ? " on" : ""}`}
            onClick={() => setActive(t.key)}
            role="tab"
            aria-selected={active === t.key}
            title={t.blurb}
          >
            {t.name} <span className="dfk-n">{byTopic.get(t.key)!.length}</span>
          </button>
        ))}
      </div>
      {activeTopic ? <p className="dfk-blurb">{activeTopic.name} — {activeTopic.blurb}.</p> : null}
      <ul className="dfk-list">
        {/* every row stays in the HTML (SEO links); pills only toggle visibility */}
        {(rows ?? []).map((r) => {
          const visible = shown.some((s) => s.id === r.id);
          const cs = chipsFor(r, slug);
          return (
            <li key={r.id} className="dfk-row" hidden={!visible}>
              <p className="dfk-sent">{r.sentence}</p>
              {cs.length ? (
                <div className="dfk-chips">
                  {cs.map((c, i) => (
                    <Link key={i} className="df-chip dfk-chip" href={c.href}>{c.label}</Link>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="df-src">Embedding Fantasia — SQL-assembled from the Metatake database · no AI-written text · unrelated to the original authors&rsquo; intent.</div>
    </section>
  );
}
