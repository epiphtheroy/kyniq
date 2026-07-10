import Link from "next/link";
import type { ReactNode } from "react";
import FilmHeroReel from "@/components/FilmHeroReel";
import ShareDock from "@/components/ShareDock";

/**
 * Dark film hero for the reading pages (desk essays, misreadings, Q&A) —
 * 2026-07-08 redesign. Fixes the dark-chrome→white-article jump by giving the
 * headline a dark band of its own, and reuses the film page's video header:
 * FilmHeroReel already floats (docks bottom-left) when scrolled past, which
 * covers the "video stays with you" behaviour for free. Falls back to the
 * film's backdrop when there is no published video.
 *
 * Uses the .cur token set (curious.css) — pages importing this must also
 * import "@/app/curious/curious.css" and "./read.css" (route-local).
 */

const IMG = "https://image.tmdb.org/t/p";

export default function ReadHero({
  film,
  crumbTail,
  chip,
  meta,
  title,
  dek,
  videos = [],
  backdropPath,
  children,
  sharePath,
  shareTitle,
  shareHook,
}: {
  film: { title: string; slug: string; year: number | null };
  crumbTail: string;
  chip: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
  dek?: ReactNode;
  videos?: { id: string; title: string }[];
  backdropPath?: string | null;
  children?: ReactNode;
  /** Share: when given, a ShareDock bar (desktop) + fab (mobile) render in the hero. */
  sharePath?: string;
  shareTitle?: string;
  shareHook?: string;
}) {
  const backdrop = backdropPath ? `${IMG}/w780${backdropPath}` : undefined;
  return (
    <div className="cur rd-hero">
      <div className="rd-hero__in">
        <div className="rd-hero__txt">
          <div className="rd-crumb">
            <Link href="/film">Films</Link>
            <span>›</span>
            <Link href={`/film/${film.slug}`}>{film.title}</Link>
            <span>›</span>
            <span>{crumbTail}</span>
          </div>
          <div className="rd-chiprow">
            <span className="rd-chip">{chip}</span>
            {meta ? <span className="rd-meta">{meta}</span> : null}
          </div>
          <h1 className="rd-h1">{title}</h1>
          {dek ? <p className="rd-dek">{dek}</p> : null}
          {sharePath ? (
            <div className="rd-share">
              <ShareDock variant="bar" path={sharePath} title={shareTitle ?? film.title} hook={shareHook} />
              <ShareDock variant="fab" path={sharePath} title={shareTitle ?? film.title} hook={shareHook} />
            </div>
          ) : null}
          {children}
        </div>
        {(videos.length > 0 || backdrop) && (
          <div className="rd-hero__media">
            {videos.length > 0 ? (
              <FilmHeroReel videos={videos} poster={backdrop} start={7} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="rd-hero__bd" src={backdrop} alt={`${film.title} still`} width={780} height={439} />
            )}
            <div className="rd-hero__cap">
              From {film.title}{film.year ? ` (${film.year})` : ""} · <Link href={`/film/${film.slug}/gallery`}>gallery →</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
