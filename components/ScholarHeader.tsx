import Link from "next/link";

/**
 * ScholarHeader — the academic header on a meta-take (reading) page.
 * Surfaces what we already have, framed for researchers/students/critics:
 *  - the precise scholarly term + its canonical lineage (theorist),
 *  - a "lens map" (which critical registers this concept is read through),
 *  - outbound links to real scholarship databases (search, not generated citations),
 *  - the cross-film count framed as a working filmography.
 * No generated citations — links go to Google Scholar / JSTOR / PhilPapers searches.
 */

function enc(s: string) { return encodeURIComponent(s); }

function regSlug(label: string) { return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export default function ScholarHeader({
  term, theorist, registers, filmCount,
}: {
  term: string;
  theorist: string | null;
  registers: { label: string; color: string; n: number }[];
  filmCount: number;
}) {
  const top = registers.slice(0, 6);
  const maxN = Math.max(1, ...top.map((r) => r.n));
  return (
    <div className="sch">
      <div className="sch-row">
        <span className="sch-k">Scholarly term</span>
        <span className="sch-term">{term}{theorist ? <span className="sch-after"> · after {theorist}</span> : null}</span>
      </div>

      {top.length > 0 && (
        <div className="sch-row">
          <span className="sch-k">Read through</span>
          <span className="sch-regs">
            {top.map((r) => (
              <Link
                key={r.label}
                href={`/meta-takes?group=register#g-${regSlug(r.label)}`}
                className="sch-reg"
                title={`${r.n} takes read through the ${r.label} register — browse all readings by register`}
              >
                <span className="sch-reg-bar" style={{ background: r.color, width: `${Math.round(10 + 34 * (r.n / maxN))}px` }} />
                {r.label} <span className="sch-reg-n">{r.n}</span>
              </Link>
            ))}
          </span>
        </div>
      )}

      <div className="sch-row">
        <span className="sch-k">Find scholarship</span>
        <span className="sch-links">
          <a href={`https://scholar.google.com/scholar?q=${enc(term + " cinema")}`} target="_blank" rel="noopener noreferrer">Google Scholar ↗</a>
          <a href={`https://www.jstor.org/action/doBasicSearch?Query=${enc(term + " film")}`} target="_blank" rel="noopener noreferrer">JSTOR ↗</a>
          <a href={`https://philpapers.org/s/${enc(term)}`} target="_blank" rel="noopener noreferrer">PhilPapers ↗</a>
        </span>
      </div>

      <div className="sch-note">
        A working filmography: this reading recurs across <strong>{filmCount}</strong> {filmCount === 1 ? "film" : "films"} (below).
        Readings are AI-drafted critical interpretations — cite the films and scholarship, not this page, as a source.
      </div>
    </div>
  );
}
