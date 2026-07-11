"use client";

/**
 * ASK · W7 — "Further reading — beyond the corpus".
 *
 * Renders the SEPARATE `further_reading` field from /api/ask/v2 (academic
 * metadata from OpenAlex / Crossref / Semantic Scholar). This is scaffolding —
 * link-out only. It is deliberately styled DISTINCT from the grounded corpus
 * sources (teal frame + a "beyond the corpus" label, not the red `--accent`
 * the corpus citations use) so a reader never mistakes it for a corpus citation.
 *
 * GROUNDING INVARIANT: these items are not part of the grounded answer and are
 * never cited with [n]. They only ever appear under their own labeled heading.
 *
 * Renders nothing unless items exist. The live /ask page calls v1 (which has no
 * `further_reading`), so this simply no-ops there — it activates wherever the
 * field is present.
 */

/** Mirror of lib/sources/academic.ts `AcademicRef` (kept local to the client). */
export type AcademicRef = {
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  abstractSnippet: string | null;
  citationCount: number | null;
  source: "openalex" | "crossref" | "s2";
};

const SOURCE_LABEL: Record<AcademicRef["source"], string> = {
  openalex: "OpenAlex",
  crossref: "Crossref",
  s2: "Semantic Scholar",
};

/** "Smith, Doe & Lee" — up to three names, then "et al." */
function bylineOf(authors: string[]): string | null {
  const a = (authors ?? []).filter((n) => typeof n === "string" && n.trim());
  if (a.length === 0) return null;
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} & ${a[1]}`;
  if (a.length === 3) return `${a[0]}, ${a[1]} & ${a[2]}`;
  return `${a[0]} et al.`;
}

export default function FurtherReading({ items }: { items?: AcademicRef[] | null }) {
  const refs = Array.isArray(items) ? items.filter((r) => r && r.title) : [];
  if (refs.length === 0) return null;

  return (
    <section className="ak-fr" aria-label="Further reading beyond the corpus">
      <div className="ak-fr__lbl">
        Further reading — beyond the corpus
        <span className="ak-fr__note">
          Scholarly links, not part of the grounded answer
        </span>
      </div>

      <ol className="ak-fr__list">
        {refs.map((r, i) => {
          const byline = bylineOf(r.authors);
          const metaBits = [byline, r.year != null ? String(r.year) : null, r.venue]
            .filter((b): b is string => !!b)
            .join(" · ");
          return (
            <li key={r.doi || r.url || `${r.title}-${i}`} className="ak-fr__item">
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener"
                  className="ak-fr__title"
                >
                  {r.title}
                </a>
              ) : (
                <span className="ak-fr__title ak-fr__title--plain">{r.title}</span>
              )}

              {metaBits ? <div className="ak-fr__meta">{metaBits}</div> : null}

              {r.abstractSnippet ? <p className="ak-fr__abs">{r.abstractSnippet}</p> : null}

              <div className="ak-fr__foot">
                <span className="ak-fr__src">{SOURCE_LABEL[r.source] ?? r.source}</span>
                {r.citationCount != null ? (
                  <span className="ak-fr__cites">
                    {r.citationCount.toLocaleString()}{" "}
                    {r.citationCount === 1 ? "citation" : "citations"}
                  </span>
                ) : null}
                {r.doi ? <span className="ak-fr__doi">doi:{r.doi}</span> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
