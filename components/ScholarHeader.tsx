import Link from "next/link";

/**
 * ScholarHeader — the single right-rail box on a meta-take (reading) page.
 * Merges what used to be two boxes (the "Meta take" info box + the academic
 * header) into one, with no duplicated facts:
 *  - the scholarly term + its canonical lineage (theorist),
 *  - the theory family, the film count, and a jump to all takes,
 *  - a "lens map" (which critical registers this concept is read through),
 *  - outbound links to scholarship databases (search, not generated citations).
 */

function enc(s: string) { return encodeURIComponent(s); }
function regSlug(label: string) { return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export default function ScholarHeader({
  term, theorist, family, registers, filmCount, takeCount,
}: {
  term: string;
  theorist: string | null;
  family: { name: string; slug: string } | null;
  registers: { label: string; color: string; n: number }[];
  filmCount: number;
  takeCount: number;
}) {
  const top = registers.slice(0, 6);
  const maxN = Math.max(1, ...top.map((r) => r.n));
  return (
    <div className="sch">
      <div className="sch-row">
        <span className="sch-k">Scholarly term</span>
        <span className="sch-term">{term}{theorist ? <span className="sch-after"> · after {theorist}</span> : null}</span>
      </div>

      {family && (
        <div className="sch-row">
          <span className="sch-k">Theory</span>
          <span className="sch-val"><Link href={`/meta-takes?family=${family.slug}`}>{family.name}</Link></span>
        </div>
      )}

      <div className="sch-row">
        <span className="sch-k">Films</span>
        <span className="sch-val">{filmCount}</span>
      </div>

      {takeCount > 0 && (
        <div className="sch-row">
          <span className="sch-k">Takes</span>
          <span className="sch-val"><a href="#all-takes" className="mt-jump">{takeCount} ↓</a></span>
        </div>
      )}

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
        Readings are AI-drafted critical interpretations — cite the films and scholarship, not this page, as a source.
      </div>
    </div>
  );
}
