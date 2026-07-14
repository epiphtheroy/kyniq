import Link from "next/link";

/**
 * Curious shared UI — ScreenRant-style building blocks (see curious.css).
 * All server components; the search box is a plain GET form so it works
 * without JS and lands on /curious/search?q=.
 */

const IMG = "https://image.tmdb.org/t/p";

export type FilmArt = {
  slug: string;
  title: string;
  year: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
};

/** 16:9 art for cards/rows: backdrop first, poster as fallback. */
export function thumbUrl(f: FilmArt, size: "w342" | "w780" = "w342"): string | null {
  if (f.backdrop_path) return `${IMG}/${size}${f.backdrop_path}`;
  if (f.poster_path) return `${IMG}/${size === "w780" ? "w500" : "w342"}${f.poster_path}`;
  return null;
}

export const monDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function CuriousSearchBar({ defaultValue = "", big = false }: { defaultValue?: string; big?: boolean }) {
  return (
    <form className="cur-search" action="/curious/search" method="get" role="search">
      <button className="cur-search__ico" type="submit" aria-label="Search Curious">⌕</button>
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={big ? "Search Curious" : "Search questions, films, desks…"}
        aria-label="Search Curious"
        autoComplete="off"
      />
    </form>
  );
}

export function SectionHead({
  title,
  count,
  moreHref,
  moreLabel = "More",
}: {
  title: string;
  count?: number | string;
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <div className="cur-sechd">
      <h2>{title}</h2>
      {count != null ? <span className="n">{typeof count === "number" ? count.toLocaleString() : count}</span> : null}
      {moreHref ? (
        <Link className="cur-more" href={moreHref}>
          {moreLabel} <span className="ar">→</span>
        </Link>
      ) : null}
    </div>
  );
}

export function Card({
  href,
  film,
  title,
  tag,
  date,
  spoilerNote,
}: {
  href: string;
  film: FilmArt;
  title: string;
  tag: string;
  date?: string | null;
  spoilerNote?: boolean;
}) {
  const img = thumbUrl(film);
  return (
    <div className="cur-card">
      <Link href={href}>
        <div className="th">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img ? <img src={img} alt={`${film.title}${film.year ? ` (${film.year})` : ""} — still`} loading="lazy" width={342} height={192} /> : null}
          {date ? <span className="dt">{monDate(date)}</span> : null}
        </div>
        <div className="tag">{tag}</div>
        <h3>{title}</h3>
      </Link>
      <div className="by">
        <b>{film.title}{film.year ? ` (${film.year})` : ""}</b>
        {spoilerNote ? " · discusses the ending" : ""}
      </div>
    </div>
  );
}

export function ResultRow({
  href,
  film,
  title,
  tag,
  date,
  excerpt,
  spoilerNote,
}: {
  href: string;
  film: FilmArt;
  title: string;
  tag: string;
  date?: string | null;
  excerpt?: string | null;
  spoilerNote?: boolean;
}) {
  const img = thumbUrl(film);
  return (
    <div className="cur-row">
      <Link href={href} className="th" aria-hidden="true" tabIndex={-1}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img ? <img src={img} alt={`${film.title}${film.year ? ` (${film.year})` : ""} — still`} loading="lazy" width={342} height={192} /> : null}
      </Link>
      <div>
        <span className="dt">{date ? monDate(date) : ""}</span>
        <span className="tag">{tag}</span>
        <Link href={href}>
          <h3>{title}</h3>
        </Link>
        {excerpt ? <p className="ex">{excerpt}</p> : null}
        <div className="by">
          <b>{film.title}{film.year ? ` (${film.year})` : ""}</b>
          {spoilerNote ? " · discusses the ending" : ""}
        </div>
      </div>
    </div>
  );
}
