"use client";

import Link from "next/link";

/** Shared shape of a retrieved close-reading citation (mirrors /api/ask). */
export type Cite = {
  rank: number; take_id: string; rationale: string; register: string | null; theorist: string | null;
  film_title: string; film_slug: string; figure_label: string; figure_slug: string;
  meta_title: string | null; meta_slug: string | null;
};

/** register → [label, color] — single source of truth, shared with the ASK page. */
export const REG: Record<string, [string, string]> = {
  formal: ["Formal", "#5B8FB9"],
  semiotic: ["Semiotic", "#B8860B"],
  psychoanalytic: ["Psychoanalytic", "#A8434F"],
  ideological: ["Ideological", "#C0392B"],
  politico_economic: ["Politico-economic", "#2E7D5B"],
  philosophical: ["Philosophical", "#7E57C2"],
  existential: ["Existential", "#546E7A"],
  mythic: ["Mythic", "#A9743B"],
  genealogical: ["Film-historical", "#2E86C1"],
  reception: ["Reception", "#159A8A"],
};

export type AskMode = "answer" | "readings";

/**
 * Answer / Readings mode toggle. Keyboard-usable (native buttons,
 * arrow keys move between the two), accessible via aria-pressed + a group label.
 */
export function AskModeToggle({
  mode,
  onChange,
  readingCount,
}: {
  mode: AskMode;
  onChange: (m: AskMode) => void;
  readingCount: number;
}) {
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      onChange(mode === "answer" ? "readings" : "answer");
    }
  }
  return (
    <div className="ak-mode" role="group" aria-label="Result view" onKeyDown={onKey}>
      <button
        type="button"
        className={`ak-mode__btn${mode === "answer" ? " ak-mode__btn--on" : ""}`}
        aria-pressed={mode === "answer"}
        aria-label="Show the synthesized answer"
        onClick={() => onChange("answer")}
      >
        Answer
      </button>
      <button
        type="button"
        className={`ak-mode__btn${mode === "readings" ? " ak-mode__btn--on" : ""}`}
        aria-pressed={mode === "readings"}
        aria-label={`Show the ${readingCount} retrieved close readings`}
        onClick={() => onChange("readings")}
      >
        Readings
        {readingCount > 0 ? <span className="ak-mode__n">{readingCount}</span> : null}
      </button>
    </div>
  );
}

/** A short, sentence-aware snippet of a rationale for the card preview. */
function snippet(text: string, max = 220): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  const base = lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, "");
  return `${base.trim()}…`;
}

/**
 * Readings view — the retrieved close-readings as first-class, browsable cards.
 * Backs the stamp "retrieved, then composed — every claim linked to its source":
 * the answer prose is LLM-synthesised, so the receipt is these cards — every one
 * a real reading you can open (2026-07-17, HANDOFF-AI집필크레딧-표기개편.md §5-7).
 */
export default function AskReadings({ citations }: { citations: Cite[] }) {
  if (!citations.length) return null;
  return (
    <div className="ak-reads" aria-label="Retrieved close readings">
      <div className="ak-reads__lbl">
        {citations.length} {citations.length === 1 ? "reading" : "readings"} retrieved — browse the corpus directly
      </div>
      <ol className="ak-cards">
        {citations.map((c) => {
          const reg = c.register ? REG[c.register] : null;
          return (
            <li key={c.rank} className="ak-card">
              <div className="ak-card__rank" aria-hidden="true">{c.rank}</div>
              <div className="ak-card__body">
                <div className="ak-card__head">
                  <Link
                    href={`/film/${c.film_slug}/figure/${c.figure_slug}`}
                    className="ak-card__fig"
                    aria-label={`Open reading: ${c.figure_label} in ${c.film_title}`}
                  >
                    {c.figure_label}
                  </Link>
                  <span className="ak-card__film">{c.film_title}</span>
                  {reg ? (
                    <span className="ak-reg" style={{ background: reg[1] }}>{reg[0]}</span>
                  ) : null}
                  {c.theorist ? <span className="ak-card__after">after {c.theorist}</span> : null}
                </div>
                {c.rationale ? <p className="ak-card__rat">{snippet(c.rationale)}</p> : null}
                {c.meta_slug && c.meta_title ? (
                  <Link href={`/trope/${c.meta_slug}`} className="ak-card__to">
                    {c.meta_title} →
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
