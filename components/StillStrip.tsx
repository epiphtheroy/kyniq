"use client";

// StillStrip — a small in-body strip of film stills with a shared lightbox.
// Each still carries a caption (small text, NOT body copy) that states: the
// source film's title, the TMDB credit, the page's topic, and — plainly — that
// the still is illustrative and may not directly depict that topic. Every image
// has a small "⤢ View" button; the lightbox steps through the whole set with
// next/prev + keyboard arrows, so a reader can browse a few large and leave.
//
// Images only (no video) — never flagged by video indexing. Used on entity
// pages (net-new body images) and, unified, on film/reading pages.
import { useCallback, useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/i18n/LocaleProvider";

const IMG = "https://image.tmdb.org/t/p";

export type Still = { path: string; filmTitle: string; filmYear?: number | null; filmSlug?: string | null };

export default function StillStrip({
  stills,
  topic,
  heading,
  disclaim = true,
}: {
  stills: Still[];
  topic: string;      // the page's subject, named in each caption
  heading?: string;
  disclaim?: boolean; // true on entity pages (stills are from OTHER films than the topic);
                      // false on a film's own page (the stills ARE that film)
}) {
  const locale = useLocale();
  const imgs = stills.filter((s) => s && s.path);
  const [zoom, setZoom] = useState<number | null>(null);

  const close = useCallback(() => setZoom(null), []);
  const step = useCallback(
    (d: number) => setZoom((z) => (z === null ? z : (z + d + imgs.length) % imgs.length)),
    [imgs.length],
  );

  useEffect(() => {
    if (zoom === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoom, close, step]);

  if (!imgs.length) return null;

  const cap = (s: Still) => `${s.filmTitle}${s.filmYear ? ` (${s.filmYear})` : ""}`;

  return (
    <div className="slx">
      {heading ? <p className="slx-head">{heading}</p> : null}
      <div className="slx-row">
        {imgs.map((s, i) => (
          <figure className="slx-fig" key={`${s.path}-${i}`}>
            <button type="button" className="slx-open" onClick={() => setZoom(i)} aria-label={t(locale, "View larger — {cap}", { cap: cap(s) })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${IMG}/w780${s.path}`} alt={cap(s)} loading="lazy" width={780} height={439} />
              <span className="slx-zoom" aria-hidden="true">⤢</span>
            </button>
            <figcaption className="slx-cap">
              <span className="slx-cap__src">{cap(s)}</span>
              {disclaim ? (
                <span className="slx-cap__note">{t(locale, "Shown with {topic} — an illustrative still, not necessarily a scene about it.", { topic })}</span>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>

      {zoom !== null ? (
        <div className="slx-lb" role="dialog" aria-modal="true" onClick={close}>
          <button type="button" className="slx-lb__x" onClick={close} aria-label={t(locale, "Close")}>✕</button>
          {imgs.length > 1 ? (
            <button type="button" className="slx-lb__nav slx-lb__nav--l" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label={t(locale, "Previous")}>‹</button>
          ) : null}
          <figure className="slx-lb__fig" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG}/w1280${imgs[zoom].path}`} alt={cap(imgs[zoom])} />
            <figcaption>
              {cap(imgs[zoom])}{disclaim ? t(locale, " — shown with {topic}, an illustrative still, not necessarily a scene about it", { topic }) : ""}.
              {imgs.length > 1 ? <span className="slx-lb__count"> · {zoom + 1} / {imgs.length}</span> : null}
            </figcaption>
          </figure>
          {imgs.length > 1 ? (
            <button type="button" className="slx-lb__nav slx-lb__nav--r" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label={t(locale, "Next")}>›</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
