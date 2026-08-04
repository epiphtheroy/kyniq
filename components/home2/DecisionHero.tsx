"use client";

/**
 * DecisionHero — the home's opening module (전환마스터 §4.1-1).
 * The companion identity in one screen: the question ("What should I watch
 * tonight?"), tonight's strongest films by TakeScore (SSR'd strip, no flash),
 * and two ways in — filter to your services (/what-to-watch) or be surprised
 * (#surprise band below). Absorbs the old HeroSurprise + ScreenerPromo slots.
 * Posters deep-link to the film page (the per-film decide surface: why watch,
 * where to watch), not the Screener — this module answers "tonight", not
 * "compare".
 */
import Link from "next/link";
import type { ScreenerTop } from "@/app/page";
import { displayTs } from "@/lib/cinecodex_dims";

const POSTER = "https://image.tmdb.org/t/p/w185";

export default function DecisionHero({ rows }: { rows: ScreenerTop[] }) {
  return (
    <section className="band dark scrp dhero">
      <div className="wrap">
        <div className="dhero-kick">The cinephile&rsquo;s companion</div>
        <h1 className="dhero-h">What should I watch tonight?</h1>
        <p className="dhero-sub">
          Tonight&rsquo;s strongest films by <b>TakeScore</b> — durable value, not popularity.
          Filter to your country and streaming services, or let the map surprise you.
        </p>

        {rows.length > 0 ? (
          <div className="scrp-strip" aria-label="Tonight's strongest films by TakeScore">
            {rows.map((f) => (
              <Link key={f.slug} href={`/film/${f.slug}`} className="scrp-film" title={`${f.title}${f.year ? ` (${f.year})` : ""} · TakeScore ${displayTs(f.u)}`}>
                <span className="scrp-poster">
                  {f.poster_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${POSTER}${f.poster_path}`} alt={`${f.title}${f.year ? ` (${f.year})` : ""} poster`} loading="lazy" />
                  ) : <span className="scrp-poster--e" />}
                  <span className="scrp-ts"><b>{displayTs(f.u)}</b><i>TS</i></span>
                </span>
                <span className="scrp-ti">{f.title}</span>
              </Link>
            ))}
          </div>
        ) : null}

        <div className="dhero-ctas">
          {/* .mo-sheen is opt-in and belongs to ONE button per screen (§1.3 rule 2
              budgets three looping animations for the whole product). This is the
              home screen's single positive action; the two beside it stay quiet,
              and the nav's Sign in is chrome, not the action of the page. */}
          <Link className="dhero-cta dhero-cta--primary mo-sheen" href="/what-to-watch">Find by your services →</Link>
          <a className="dhero-cta" href="#surprise">Surprise me</a>
          <Link className="dhero-cta dhero-cta--quiet" href="/takescore">Open the Screener</Link>
        </div>
      </div>
    </section>
  );
}
