"use client";

/**
 * ScreenerPromo — the home's featured entry into /takescore (The Screener),
 * placed high on the page as the flagship module. Matches the dark-band rhythm
 * (band dark). SSR'd: the top-TakeScore poster strip comes from the server as a
 * prop (no flash); each poster deep-links into the Screener pre-pinned, and the
 * preset chips deep-link into pre-filtered screens.
 */
import Link from "next/link";
import type { ScreenerTop } from "@/app/page";
import { TAKESCORE_PRESETS, presetHref } from "@/lib/takescore_presets";
import { displayTs } from "@/lib/cinecodex_dims";

const POSTER = "https://image.tmdb.org/t/p/w185";

export default function ScreenerPromo({ rows }: { rows: ScreenerTop[] }) {
  return (
    <section className="band dark scrp">
      <div className="wrap">
        <div className="shead">
          <div>
            <div className="scrp-kick">TakeScore™ · The Screener</div>
            <h2>Find your next film by its score <span className="chev">›</span></h2>
            <div className="sub">Every film scored on durable value, not popularity — search one, pin and compare many, screen 6,701 films by year, country, your streaming services and what you haven&apos;t seen.</div>
          </div>
          <Link className="seeall" href="/takescore">Open the Screener ›</Link>
        </div>

        {rows.length > 0 ? (
          <div className="scrp-strip" aria-label="Top films by TakeScore">
            {rows.map((f) => (
              <Link key={f.slug} href={`/takescore?pin=${f.slug}`} className="scrp-film" title={`${f.title}${f.year ? ` (${f.year})` : ""} · TakeScore ${displayTs(f.u)}`}>
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

        <div className="scrp-foot">
          <span className="scrp-foot-l">Jump in:</span>
          {TAKESCORE_PRESETS.map((p) => (
            <Link key={p.key} href={presetHref(p)} className="scrp-preset" title={p.blurb}>{p.label}</Link>
          ))}
          <Link href="/takescore" className="scrp-cta">Open the Screener →</Link>
        </div>
      </div>
    </section>
  );
}
