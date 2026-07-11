"use client";

/**
 * ASK · W8 — "From the critics".
 *
 * Renders the SEPARATE `critics` field from /api/rag (short, fair-use quotes from
 * allow-listed magazine passages). Each item is a length-capped quote + a link
 * out to the original. Styled DISTINCT from corpus citations and the academic
 * rail so a reader never confuses an external critic quote with the grounded
 * close-readings. No-ops unless `critics` is present (MAGAZINE_QUOTES enabled).
 */

export type Critic = {
  snippet: string;
  outlet: string;
  author: string | null;
  url: string;
  year: number | null;
};

export default function CriticQuotes({ items }: { items?: Critic[] | null }) {
  const refs = Array.isArray(items) ? items.filter((c) => c && c.snippet) : [];
  if (refs.length === 0) return null;

  return (
    <section className="ak-cr" aria-label="Quotes from critics">
      <div className="ak-cr__lbl">
        From the critics
        <span className="ak-cr__note">Short, attributed quotes — follow the link to read in full</span>
      </div>
      <ol className="ak-cr__list">
        {refs.map((c, i) => {
          const by = [c.author, c.outlet, c.year != null ? String(c.year) : null]
            .filter(Boolean)
            .join(", ");
          return (
            <li key={c.url || `${c.outlet}-${i}`} className="ak-cr__item">
              <span className="ak-cr__quote">“{c.snippet}”</span>
              {c.url ? (
                <a href={c.url} target="_blank" rel="noopener" className="ak-cr__by">
                  — {by || c.outlet}
                </a>
              ) : (
                <span className="ak-cr__by">— {by || c.outlet}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
