"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/**
 * DomainConcepts — the field → concept level of a domain page, with the
 * "no film yet" concepts gated. A domain registry holds far more concepts than
 * cinema has staged (e.g. Management: 600 concepts, ~35 on screen). Showing all
 * of them by default buries the ones with an actual film example and reads, to
 * both a visitor and a crawler, as a wall of thin entries. So by default we
 * show only concepts a film stages; a toggle reveals the rest (kept in the DOM,
 * so the full registry stays crawlable). Fields that go empty are hidden too.
 */
export type ConceptRow = { concept: string; concept_slug: string; one_liner: string | null; films: number; theorist: string | null };
export type FieldGroup = { major: string; rows: ConceptRow[] };

export default function DomainConcepts({ groups, hiddenCount }: { groups: FieldGroup[]; hiddenCount: number }) {
  const [showAll, setShowAll] = useState(false);

  const view = useMemo(() => {
    return groups
      .map((g) => ({ major: g.major, rows: showAll ? g.rows : g.rows.filter((r) => r.films > 0) }))
      .filter((g) => g.rows.length > 0);
  }, [groups, showAll]);

  return (
    <div>
      {hiddenCount > 0 ? (
        <div className="dc-toolbar">
          <button type="button" className="dc-toggle" data-on={showAll ? "" : undefined} onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Showing every concept" : `Show ${hiddenCount.toLocaleString()} not yet on screen`}
          </button>
          <span className="dc-hint">{showAll ? "including concepts no film stages yet" : "concepts with a film example first"}</span>
        </div>
      ) : null}

      {view.map((g) => {
        const gFilms = g.rows.reduce((s, r) => s + r.films, 0);
        const gLive = g.rows.filter((r) => r.films > 0).length;
        return (
          <section key={g.major} style={{ marginTop: 26 }}>
            <h2 className="cmap-h2">
              {g.major}{" "}
              <span style={{ fontWeight: 500, fontSize: "0.8em", opacity: 0.6 }}>
                {g.rows.length} concept{g.rows.length !== 1 ? "s" : ""}{gFilms > 0 ? ` · ${gFilms} film example${gFilms !== 1 ? "s" : ""} across ${gLive}` : ""}
              </span>
            </h2>
            <ul className="mt-cols" style={{ marginTop: 8 }}>
              {g.rows.map((r) => (
                <li key={r.concept_slug}>
                  <Link href={`/concept/${r.concept_slug}`}>{r.concept}</Link>
                  {r.films > 0 ? <span className="yr"> ({r.films})</span> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <style>{`
        .dc-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:4px 0 2px}
        .dc-toggle{font-family:var(--font-ui);font-size:12.5px;font-weight:700;color:var(--muted);background:transparent;border:1px solid var(--hairline-2,#ccc);border-radius:999px;padding:6px 14px;cursor:pointer}
        .dc-toggle[data-on]{background:var(--accent,#e3120b);color:#fff;border-color:var(--accent,#e3120b)}
        .dc-toggle:not([data-on]):hover{border-color:var(--accent);color:var(--accent)}
        .dc-hint{font-family:var(--font-ui);font-size:12px;color:var(--subtle,#999)}
      `}</style>
    </div>
  );
}
