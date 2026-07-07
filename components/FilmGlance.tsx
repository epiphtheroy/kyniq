import { Fragment, type ReactNode } from "react";

/** "The Record, at a glance" — the band under the film hero. Two columns:
 *  a vital-facts ledger (left) and where-it-stands (right) — a deliberately
 *  quiet external-ratings rail that defers to our TakeScore, then a matrix of
 *  Metatake's own numbers and the overall TakeScore rank. Replaces the old
 *  ratings+JustWatch strip; JustWatch now lives only in the Where-to-watch
 *  section below. Renders adaptively — every row/cell appears only with data. */

type Ratings = { imdb_rating: number | null; imdb_votes: number | null; metascore: number | null; rt_tomatometer: number | null };
export type GlanceFact = { k: string; v: ReactNode };
export type GlanceStat = { n: number | string; k: string; href?: string; wide?: boolean };

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export default function FilmGlance({
  facts, ratings, tmdbVote, imdbId, takeScore, stats, rank,
}: {
  facts: GlanceFact[];
  ratings: Ratings | null;
  tmdbVote: number | null;
  imdbId: string | null;
  takeScore: number | null;
  stats: GlanceStat[];
  rank: { rank: number; total: number } | null;
}) {
  const hasImdb = !!(ratings && ratings.imdb_rating);
  const hasRt = !!(ratings && ratings.rt_tomatometer != null);
  const hasMeta = !!(ratings && ratings.metascore != null);
  const hasTmdb = tmdbVote != null && tmdbVote > 0;
  const hasRatings = hasImdb || hasRt || hasMeta || hasTmdb;
  if (!facts.length && !hasRatings && !stats.length) return null;

  const hasRank = !!rank && rank.rank >= 1 && rank.total > 1;
  const rankPos = hasRank ? ((rank!.rank - 1) / (rank!.total - 1)) * 100 : 0;
  // "top N%" in the upper half, else an honest "bottom X%" — mirrors the
  // TakeScore panel's own rank instrument (CinecodexPanel).
  const topPct = hasRank ? Math.max(1, Math.round((rank!.rank / rank!.total) * 100)) : 0;
  const rankShare = hasRank
    ? topPct <= 50
      ? `top ${topPct}%`
      : `bottom ${Math.max(1, Math.round(((rank!.total - rank!.rank + 1) / rank!.total) * 100))}%`
    : "";

  return (
    <section className="df-glance">
      <p className="df-glance__kick">At a glance</p>
      <div className="df-glance__grid">
        {facts.length ? (
          <dl className="df-vital">
            {facts.map((f) => (
              <Fragment key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></Fragment>
            ))}
          </dl>
        ) : <div />}

        <div className="df-stands">
          {hasRatings ? (
            <div>
              <div className="df-rail__lab">Elsewhere — for comparison, not our verdict</div>
              <div className="df-rail">
                {hasImdb ? (
                  imdbId ? (
                    <a className="df-rchip df-rchip--imdb" href={`https://www.imdb.com/title/${imdbId}/`} target="_blank" rel="noopener noreferrer">
                      <b>IMDb</b><span className="star">★</span><span className="n">{ratings!.imdb_rating}</span>{ratings!.imdb_votes ? <span className="v">{fmtVotes(ratings!.imdb_votes)}</span> : null}
                    </a>
                  ) : (
                    <span className="df-rchip df-rchip--imdb">
                      <b>IMDb</b><span className="star">★</span><span className="n">{ratings!.imdb_rating}</span>{ratings!.imdb_votes ? <span className="v">{fmtVotes(ratings!.imdb_votes)}</span> : null}
                    </span>
                  )
                ) : null}
                {hasRt ? <span className="df-rchip df-rchip--rt"><b>RT</b><span className="n">{ratings!.rt_tomatometer}%</span></span> : null}
                {hasMeta ? <span className="df-rchip df-rchip--meta"><b>Metascore</b><span className="n">{ratings!.metascore}</span></span> : null}
                {hasTmdb ? <span className="df-rchip df-rchip--tmdb"><b>TMDB</b><span className="n">{tmdbVote!.toFixed(1)}</span></span> : null}
              </div>
              {takeScore != null ? (
                <p className="df-rail__note">Our own read — value minus risk, not popularity — is the <a href="#df-codex">TakeScore {takeScore} ↓</a></p>
              ) : null}
            </div>
          ) : null}

          {stats.length ? (
            <div>
              <div className="df-mtnums">On Metatake</div>
              <div className="df-numgrid">
                {stats.map((s) => {
                  const cls = `df-ncell${s.wide ? " df-ncell--wide" : ""}`;
                  const inner = <><span className="n">{s.n}</span><span className="k">{s.k}{s.href ? <span className="arr"> →</span> : null}</span></>;
                  return s.href
                    ? <a className={cls} href={s.href} key={s.k}>{inner}</a>
                    : <span className={cls} key={s.k}>{inner}</span>;
                })}
              </div>
              {hasRank ? (
                <div className="df-nrank">
                  <div className="df-nrank__head">
                    <span className="df-nrank__lbl">Where it ranks</span>
                    <span className="df-nrank__n">#{rank!.rank.toLocaleString("en-US")} of {rank!.total.toLocaleString("en-US")} by TakeScore</span>
                    <span className="df-nrank__pct">{rankShare}</span>
                  </div>
                  <div className="df-nrank__track" aria-hidden="true">
                    <span className="df-nrank__mark" style={{ left: `clamp(14px, ${rankPos}%, calc(100% - 14px))` }}>#{rank!.rank.toLocaleString("en-US")}</span>
                    <i style={{ left: `${rankPos}%` }} />
                  </div>
                  <div className="df-nrank__ends" aria-hidden="true"><span>#1</span><span>#{rank!.total.toLocaleString("en-US")}</span></div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
