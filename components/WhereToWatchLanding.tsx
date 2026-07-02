"use client";

/**
 * WhereToWatchLanding — client shell for /where-to-watch.
 * On mount, features ONE random film drawn only from the "well-filled" pool
 * (films that have a verified enrichment record → a rich Where-to-watch tab),
 * then shows the rest as clickable poster cards. Random is picked after mount
 * to avoid SSR/hydration mismatch.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

const IMG = "https://image.tmdb.org/t/p";

export type WtwFilm = {
  slug: string;
  title: string;
  year: number | null;
  director: string | null;
  poster_path: string | null;
  teaser: string;
};

export default function WhereToWatchLanding({ films }: { films: WtwFilm[] }) {
  const [idx, setIdx] = useState<number | null>(null);

  useEffect(() => {
    if (films.length) setIdx(Math.floor(Math.random() * films.length));
  }, [films.length]);

  if (!films.length) return null;

  const feat = idx == null ? films[0] : films[idx];
  const rest = films.filter((f) => f.slug !== feat.slug).slice(0, 5);

  return (
    <div className="wtw">
      <div className="wtw-featwrap">
        <span className="wtw-kicker">Try one now</span>
        <Link className="wtw-feat" href={`/whereto/${feat.slug}`}>
          {feat.poster_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="wtw-feat__pi" src={`${IMG}/w342${feat.poster_path}`} alt={feat.title} />
          ) : (
            <div className="wtw-feat__pi wtw-feat__pi--empty" aria-hidden="true" />
          )}
          <span className="wtw-feat__tx">
            <span className="wtw-feat__t">
              {feat.title} <span className="wtw-feat__yr">({feat.year ?? "?"})</span>
            </span>
            {feat.director ? <span className="wtw-feat__dir">{feat.director}</span> : null}
            <span className="wtw-feat__teaser">{feat.teaser}</span>
            <span className="wtw-feat__cta">See where to watch →</span>
          </span>
        </Link>
        {films.length > 1 ? (
          <button
            type="button"
            className="wtw-shuffle"
            onClick={() => setIdx(Math.floor(Math.random() * films.length))}
          >
            ↻ Show me another
          </button>
        ) : null}
      </div>

      {rest.length ? (
        <>
          <div className="wtw-sub">Or start with one of these</div>
          <div className="wtw-grid">
            {rest.map((f) => (
              <Link key={f.slug} className="wtw-card" href={`/whereto/${f.slug}`}>
                {f.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="wtw-card__pi" src={`${IMG}/w185${f.poster_path}`} alt={f.title} loading="lazy" />
                ) : (
                  <div className="wtw-card__pi wtw-card__pi--empty" aria-hidden="true" />
                )}
                <span className="wtw-card__t">{f.title}</span>
                <span className="wtw-card__teaser">{f.teaser}</span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
