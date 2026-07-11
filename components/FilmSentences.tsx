/**
 * FilmSentences — "Did you know" module. Renders the top rule-based sentences for
 * one film from the `film_sentences` layer (see sentence-engine/MASS-PRODUCTION.md).
 * Server component: the point is SEO — each sentence is a factual, verifiable claim
 * whose named entities become descriptive-anchor internal links.
 *
 * Sentences render verbatim (v1 factual style, no LLM). We do NOT linkify substrings
 * inside the sentence (hydration-brittle); instead the linked entities follow as chips.
 */

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
  if (!rows || rows.length < 2) return null;
  return (
    <section className="df-sec" id="df-know">
      <h2 className="df-h2">Did you know — {title}?</h2>
      <p className="df-sub">
        Connections computed from the Metatake graph — links no plot summary would surface. Every claim opens the films, readings, and thinkers it names.
      </p>
      <ul className="dfk-list">
        {rows.map((r) => {
          const cs = chipsFor(r, slug);
          return (
            <li key={r.id} className="dfk-row">
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
      <div className="df-src">Generated from the Metatake database · rule-based, no AI-written text.</div>
    </section>
  );
}
