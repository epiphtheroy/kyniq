"use client";

// StillHero — a calm, image-first hero for TEXT pages (film reading sub-pages and
// entity pages). Replaces the autoplay YouTube trailer heroes that Google's Video
// indexing report flagged "Video is not on a watch page" (those pages are text-
// primary; the trailer was decorative). Renders 1–3 film stills that cross-fade
// with a slow Ken Burns drift (reusing the svc-kb keyframe) — "slightly dynamic,"
// no <iframe>, so Google detects no video and the flag drains. An optional
// "▶ Watch on METATAKE TV" pill routes viewers who want the video to the real
// watch page (/tv/[slug]) — the only place we carry VideoObject + video indexing.
// No VideoMiniDock: nothing docks to the corner on scroll.
import { useEffect, useState } from "react";

const IMG = "https://image.tmdb.org/t/p";

export default function StillHero({
  stills,
  label,
  watchHref,
  watchLabel = "Watch on METATAKE TV",
  shell = "banner",
}: {
  stills: string[];                 // TMDB file_paths (backdrop preferred), 1–3
  label: string;                    // a11y label
  watchHref?: string;               // /tv/[slug] or /tv/list/[slug] — shown only when given
  watchLabel?: string;
  shell?: "banner" | "inline" | "bare"; // banner = centered block; inline = fill a slot; bare = plain 16:9 box
}) {
  const imgs = stills.filter(Boolean).slice(0, 3);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (imgs.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % imgs.length), 6500);
    return () => clearInterval(t);
  }, [imgs.length]);

  if (!imgs.length) return null;

  const cls =
    shell === "inline" ? "df-tvhero ehero--in sh" : shell === "bare" ? "df-tvhero sh" : "df-tvhero ehero sh";

  return (
    <section className={cls} aria-label={label}>
      {imgs.map((p, n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p}
          className={`sh-img${n === i ? " on" : ""}`}
          src={`${IMG}/w1280${p}`}
          alt=""
          width={1280}
          height={720}
          loading={n === 0 ? "eager" : "lazy"}
          aria-hidden={n === i ? undefined : true}
        />
      ))}
      <span className="sh-scrim" aria-hidden="true" />
      {watchHref ? (
        <a className="sh-watch" href={watchHref}>
          <b aria-hidden="true">▶</b> {watchLabel}
        </a>
      ) : null}
    </section>
  );
}
