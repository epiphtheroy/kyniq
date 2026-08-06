import Link from "next/link";
import type { ReactNode } from "react";
import StillHero from "@/components/StillHero";
import ShareDock from "@/components/ShareDock";
import { filmBackdropPaths, pickStills } from "@/lib/read-media";
import { hasBroadcast } from "@/lib/tvGate";

/**
 * Dark film hero for the reading pages (desk essays, misreadings, Q&A).
 * 2026-07-14: the video header was replaced by an IMAGE-first hero (StillHero:
 * 1–3 film stills, cross-fade + Ken Burns). Reason: these pages are text-primary,
 * so Google's Video indexing report flagged the old autoplay trailer "Video is
 * not on a watch page." An image hero carries no <iframe> → no flag, faster LCP,
 * and nothing docks to the corner on scroll. When the film has a compiled
 * METATAKE TV broadcast, StillHero shows a "▶ Watch on METATAKE TV" pill to the
 * real watch page (/tv/[slug]) — the only place we carry VideoObject.
 *
 * Uses the .cur token set (curious.css) — pages importing this must also
 * import "@/app/curious/curious.css" and "./read.css" (route-local).
 */

const IMG = "https://image.tmdb.org/t/p";

export default async function ReadHero({
  film,
  crumbTail,
  chip,
  meta,
  title,
  dek,
  backdropPath,
  tmdbId,
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
  /** Legacy prop — kept for callers; no longer drives the hero (image-first now). */
  videos?: { id: string; title: string }[];
  backdropPath?: string | null;
  /** TMDB id → up to 3 clean stills for the image hero (falls back to backdropPath). */
  tmdbId?: number | null;
  children?: ReactNode;
  /** Share: when given, a ShareDock bar (desktop) + fab (mobile) render in the hero. */
  sharePath?: string;
  shareTitle?: string;
  shareHook?: string;
}) {
  const backdrop = backdropPath ? `${IMG}/w780${backdropPath}` : undefined;

  // 1–3 clean stills for the image hero (deterministic; dedupes with the page's
  // own filmBackdropPaths call via the shared 1-day fetch cache). Falls back to
  // the single backdrop when TMDB has nothing.
  const gallery = tmdbId ? await filmBackdropPaths(tmdbId) : [];
  const heroStills = gallery.length
    ? pickStills(gallery, `${film.slug}:hero`, 3)
    : (backdropPath ? [backdropPath] : []);

  // Watch pill only when a published broadcast exists for this film (no /tv 404s).
  // Asked against one globally cached slug set rather than a per-film round trip:
  // this component renders on every film read surface, and the per-film query was
  // uncached and awaited alone, so it blocked the hero once per swept URL. See
  // lib/tvGate.ts for why per-film caching cannot help a never-repeat sweep.
  const watchHref = heroStills.length && (await hasBroadcast(film.slug))
    ? `/tv/${film.slug}`
    : undefined;
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
        {(heroStills.length > 0 || backdrop) && (
          <div className="rd-hero__media">
            {heroStills.length > 0 ? (
              // image-first hero: 1–3 stills, cross-fade + Ken Burns, no <iframe>.
              // A "▶ Watch on METATAKE TV" pill appears when a broadcast exists.
              <StillHero stills={heroStills} label={`${film.title} — stills`} watchHref={watchHref} shell="bare" />
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
