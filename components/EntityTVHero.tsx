"use client";

// EntityTVHero — the top-of-page hero for entity pages (director, lineage, genre,
// trope, concept, theorist, catalog node, country…). As of 2026-07-14 it is
// IMAGE-FIRST: it shows 1–3 stills of the entity's films (StillHero: cross-fade +
// Ken Burns), NOT an autoplay YouTube trailer reel. Reason: Google's Video
// indexing report flagged every one of these text pages "Video is not on a watch
// page" (the trailer was decorative, not the main content), and the flag only
// clears when there is no <iframe> in the rendered DOM. When a compiled broadcast
// or playlist exists for the entity, StillHero shows a "▶ Watch on METATAKE TV"
// pill that routes to the real watch page — where we DO carry VideoObject. No
// autoplay, so nothing docks to the corner on scroll.
import { useEffect, useState } from "react";
import StillHero from "./StillHero";

export default function EntityTVHero({ program, playlist, reelSlugs, label, listHref, backdrop, inline }: {
  program?: string;                  // a single film's slug → its broadcast; takes precedence for the watch link
  playlist?: string;                 // tv_playlists.slug
  reelSlugs: string[];               // the entity's film slugs — the stills source
  label: string;                     // entity name — a11y label only (H1 stays on the page)
  listHref?: string;                 // /tv/list/[slug] — the watch destination when a playlist plays
  backdrop?: string | null;          // TMDB backdrop path — the immediate (SSR) still while more load
  inline?: boolean;                  // fill a hero media slot instead of a centered banner
}) {
  // undefined = loading; string[] once resolved (may be empty)
  const [stills, setStills] = useState<string[] | undefined>(undefined);
  const [watchHref, setWatchHref] = useState<string | undefined>(undefined);

  // Stills — up to 3 of the entity's films' backdrops (one <img>, no video).
  useEffect(() => {
    const slugs = reelSlugs.filter(Boolean).slice(0, 24);
    if (!slugs.length) { setStills([]); return; }
    let on = true;
    fetch(`/api/stills?slugs=${encodeURIComponent(slugs.join(","))}&cap=3`)
      .then((r) => r.json())
      .then((j) => { if (on) setStills(((j.stills ?? []) as { path: string }[]).map((x) => x.path).filter(Boolean)); })
      .catch(() => { if (on) setStills([]); });
    return () => { on = false; };
  }, [reelSlugs]);

  // Watch link — shown only when a broadcast/playlist actually exists (avoids /tv 404s).
  useEffect(() => {
    const url = program
      ? `/api/tv/watch?v=${encodeURIComponent(program)}`
      : playlist ? `/api/tv/watch?list=${encodeURIComponent(playlist)}` : null;
    if (!url) return;
    let on = true;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (!on) return;
        if (((j.entries ?? []) as unknown[]).length > 0) {
          setWatchHref(program ? `/tv/${program}` : (listHref || undefined));
        }
      })
      .catch(() => { /* no watch link */ });
    return () => { on = false; };
  }, [program, playlist, listHref]);

  // Seed with the SSR backdrop until the stills fetch resolves (keeps LCP fast on
  // banner heroes that pass a backdrop; inline slots show their own art meanwhile).
  const imgs = stills && stills.length ? stills : (backdrop ? [backdrop] : []);
  if (!imgs.length) return null; // no films / no art → keep the page's text-first shape

  return (
    <StillHero
      stills={imgs}
      label={`${label} — stills`}
      watchHref={watchHref}
      shell={inline ? "inline" : "banner"}
    />
  );
}
