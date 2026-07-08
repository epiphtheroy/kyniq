import Link from "next/link";
import TermHighlight from "@/components/TermHighlight";

/**
 * ReadingLedger — the sentence layer of "spelled out" (2026-07-08), per
 * concept-verbalization-spec.md. Deterministic assembly only: every sentence
 * is film + year + figure + the reading, framed reportively — readings say
 * "was read", essays say "can be read"; the reading's content never gets an
 * assertive ending of its own. No desk names, no framework labels, no counts
 * inside sentences (spec §3). Grouped by decade behind curtains (credits-page
 * grammar); exactly ONE curtain ships open as the sample — the decade whose
 * count sits closest to 10. Curtain headers carry the decade plus the film
 * titles inside, so the reader knows what opens before opening it. Every
 * entry leads with a small film thumbnail and ends with an arrow that jumps
 * to the matching card in the slate/essay list further down the page.
 */

export type LedgerReading = {
  take_id: string; thesis: string | null; leap: string | null;
  theorist_name?: string | null; theorist_slug?: string | null;
  fig_label: string; fig_slug: string;
  film_title: string; film_slug: string; film_year: number | null;
  backdrop_path?: string | null;
};

export type LedgerEssay = {
  film_slug: string; film_title: string; film_year: number | null;
  desk_key: string; excerpt: string | null; backdrop_path?: string | null;
};

const IMG = "https://image.tmdb.org/t/p";
const WHOLE_FILM = /^the (whole )?(film|movie)( itself| as a whole)?$/i;

function FilmT({ slug, title, year }: { slug: string; title: string; year: number | null }) {
  return <><Link href={`/film/${slug}`}><em>{title}</em></Link>{year ? ` (${year})` : ""}</>;
}

function Thumb({ slug, bd }: { slug: string; bd?: string | null }) {
  if (!bd) return null;
  return (
    <Link href={`/film/${slug}`} className="vl-th" tabIndex={-1} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${IMG}/w300${bd}`} alt="" width={64} height={36} loading="lazy" />
    </Link>
  );
}

/** Curtain-header keyword preview: the first film titles inside, deduped. */
function kwPreview(titles: string[], max = 3): string {
  const uniq = [...new Set(titles)];
  const head = uniq.slice(0, max).join(" · ");
  const rest = uniq.length - Math.min(max, uniq.length);
  return rest > 0 ? `${head} +${rest} more` : head;
}

export default function ReadingLedger({ subject, readings, essays = [] }: {
  subject: string; readings: LedgerReading[]; essays?: LedgerEssay[];
}) {
  // Spec §6: all four elements (title, year, figure, content) or no sentence.
  const seen = new Set<string>();
  const rows = readings.filter((r) => {
    if (!r.film_title || !r.film_year || !r.fig_label || !r.thesis) return false;
    if (seen.has(r.take_id)) return false;
    seen.add(r.take_id);
    return true;
  });
  const byDecade = new Map<number, LedgerReading[]>();
  for (const r of rows) {
    const d = Math.floor((r.film_year as number) / 10) * 10;
    byDecade.set(d, [...(byDecade.get(d) ?? []), r]);
  }
  const decadeData = [...byDecade.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([d, list]) => ({
      d,
      list: list.sort((a, b) => (b.film_year ?? 0) - (a.film_year ?? 0) || a.film_title.localeCompare(b.film_title)),
    }));
  // Exactly one curtain opens as the sample: the decade closest to 10 entries
  // (ties go to the newer decade).
  let openIdx = -1, bestDist = Infinity;
  decadeData.forEach(({ list }, i) => {
    const dist = Math.abs(list.length - 10);
    if (dist < bestDist) { bestDist = dist; openIdx = i; }
  });
  const essayRows = essays
    .filter((e) => e.film_title && e.film_year && e.excerpt)
    .sort((a, b) => a.film_title.localeCompare(b.film_title));
  if (!rows.length && !essayRows.length) return null;

  let i = 0; // global rotation index — deterministic rhythm (spec §5)
  return (
    <div className="vl">
      {rows.length ? (
        <>
          <h3 className="vl-h3">What was read — the ledger</h3>
          <p className="vl-lede">One sentence per reading: the film, the exact passage it turns on, and what it was read as there. The arrow jumps to the full card in the slate.</p>
          {decadeData.map(({ d, list }, di) => (
            <details key={d} className="vl-d" open={di === openIdx}>
              <summary>
                <span className="vl-sum-d">{d}s</span>
                <span className="vl-n">{list.length}</span>
                <span className="vl-sum-kw">{kwPreview(list.map((r) => r.film_title))}</span>
              </summary>
              <ul className="vl-ul">
                {list.map((r) => {
                  const k = i++ % 3;
                  const film = <FilmT slug={r.film_slug} title={r.film_title} year={r.film_year} />;
                  const fig = <Link href={`/film/${r.film_slug}/figure/${r.fig_slug}`}>{r.fig_label}</Link>;
                  const via = r.theorist_name ? (
                    <>, read through {r.theorist_slug
                      ? <Link href={`/theorist/${r.theorist_slug}`}>{r.theorist_name}</Link>
                      : r.theorist_name}</>
                  ) : null;
                  const thesis = <TermHighlight text={r.thesis} terms={[subject]} />;
                  const leap = r.leap && r.leap !== r.thesis
                    ? <> — the leap: <TermHighlight text={r.leap} terms={[subject]} /></>
                    : null;
                  return (
                    <li key={r.take_id}>
                      <Thumb slug={r.film_slug} bd={r.backdrop_path} />
                      <div className="vl-tx">
                        {WHOLE_FILM.test(r.fig_label.trim()) ? (
                          <>{film} was read whole{via}: {thesis}</>
                        ) : k === 0 ? (
                          <>In {film}, {fig} carried the reading{via}: {thesis}</>
                        ) : k === 1 ? (
                          <>{film} staged it in {fig}{via} — the reading ran: {thesis}</>
                        ) : (
                          <>The reading of {film} turned on {fig}{via}: {thesis}</>
                        )}
                        {leap}
                        {" "}<a className="vl-go" href={`#take-${r.take_id}`} aria-label={`Jump to the ${r.film_title} reading in the slate`}>→</a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </>
      ) : null}
      {essayRows.length ? (
        <>
          <h3 className="vl-h3">What can still be read</h3>
          <p className="vl-lede">These stay open — possibilities the essays hold, not verdicts. The arrow jumps to the essay card below.</p>
          {/* essays-only pages still get exactly one sample curtain open */}
          <details className="vl-d" open={rows.length === 0}>
            <summary>
              <span className="vl-sum-d">The open readings</span>
              <span className="vl-n">{essayRows.length}</span>
              <span className="vl-sum-kw">{kwPreview(essayRows.map((e) => e.film_title))}</span>
            </summary>
            <ul className="vl-ul">
              {essayRows.map((e, j) => {
                const film = <FilmT slug={e.film_slug} title={e.film_title} year={e.film_year} />;
                const q = <TermHighlight text={e.excerpt} terms={[subject]} />;
                return (
                  <li key={`${e.film_slug}/${e.desk_key}`}>
                    <Thumb slug={e.film_slug} bd={e.backdrop_path} />
                    <div className="vl-tx">
                      {j % 3 === 0 ? (
                        <>{film} can still be read another way — the essay opens: &ldquo;{q}&rdquo;</>
                      ) : j % 3 === 1 ? (
                        <>There is another way into {film}: &ldquo;{q}&rdquo;</>
                      ) : (
                        <>{film} leaves the question open: &ldquo;{q}&rdquo;</>
                      )}
                      {" "}<a className="vl-go" href={`#desk-${e.film_slug}-${e.desk_key}`} aria-label={`Jump to the ${e.film_title} essay card`}>→</a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        </>
      ) : null}
    </div>
  );
}
