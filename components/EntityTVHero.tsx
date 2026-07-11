"use client";

// EntityTVHero — the unified top-of-page video hero for entity pages (director,
// lineage, genre, trope, concept, theorist, catalog node, country…). Generalises
// FilmTVHero's fallback chain:
//   1. a compiled METATAKE TV playlist for this entity (broadcast, intro first)
//   2. else a shuffled plain-trailer reel of the entity's films (no overlay)
//   3. else nothing (page keeps its old text-first shape)
// Both play inline in a fixed 16:9 box (.df-tvhero) so there's no layout shift.
// The reel is fetched client-side (/api/tv/reel) ONLY when the playlist is
// absent/empty, so pages with a broadcast pay no reel query. The reel plays via
// a single youtube-nocookie iframe with a chained playlist (no YT API).
import { useEffect, useRef, useState } from "react";
import TVProgramPlayer, { type TVEntry } from "./TVProgramPlayer";
import VideoMiniDock, { DockFullscreenButton } from "./VideoMiniDock";

const IMG = "https://image.tmdb.org/t/p";

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export default function EntityTVHero({ program, playlist, reelSlugs, label, listHref, backdrop, inline }: {
  program?: string;                  // a single film's slug → its broadcast (?v=); takes precedence
  playlist?: string;                 // tv_playlists.slug (omit for reel-only pages)
  reelSlugs: string[];               // the entity's film slugs — reel fallback source
  label: string;                     // entity name — a11y label only (H1 stays on the page)
  listHref?: string;                 // /tv/list/[slug], shown when a broadcast plays
  backdrop?: string | null;          // TMDB backdrop path for the loading ribbon
  inline?: boolean;                  // render as an absolute overlay filling a hero media slot,
                                     // over the slot's static backdrop (which shows until/if no video)
}) {
  // In inline mode the wrapper fills the hero's right media slot instead of the
  // full-width centered banner, and while deciding / with no video it renders
  // nothing so the slot's own backdrop image shows through (no top-of-page bar).
  const shell = inline ? "df-tvhero ehero--in" : "df-tvhero ehero";
  // undefined = deciding; null = no broadcast → use the reel; TVEntry[] once a broadcast loads
  const [entries, setEntries] = useState<TVEntry[] | null | undefined>(undefined);
  const [reelIds, setReelIds] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Step 1 — try the broadcast (a single program via ?v=, else a playlist via ?list=).
  useEffect(() => {
    let on = true;
    const url = program
      ? `/api/tv/watch?v=${encodeURIComponent(program)}`
      : playlist ? `/api/tv/watch?list=${encodeURIComponent(playlist)}` : null;
    if (!url) { setEntries(null); return; }
    fetch(url)
      .then((r) => r.json())
      .then((j) => { if (on) { const e: TVEntry[] = j.entries ?? []; setEntries(e.length ? e : null); } })
      .catch(() => { if (on) setEntries(null); });
    return () => { on = false; };
  }, [program, playlist]);

  // Step 2 — no broadcast → fetch the trailer reel.
  useEffect(() => {
    if (entries !== null) return; // only when the playlist missed
    const slugs = reelSlugs.filter(Boolean).slice(0, 60);
    if (!slugs.length) { setReelIds([]); return; }
    let on = true;
    fetch(`/api/tv/reel?slugs=${encodeURIComponent(slugs.join(","))}&cap=12`)
      .then((r) => r.json())
      .then((j) => { if (on) setReelIds(shuffle(((j.reel ?? []) as { id: string }[]).map((x) => x.id))); })
      .catch(() => { if (on) setReelIds([]); });
    return () => { on = false; };
  }, [entries, reelSlugs]);

  // Scroll-follow: banner heroes shrink into a bottom-right mini player (the
  // broadcast text scales with them). Inline slot heroes stay put — their
  // absolute-fill geometry doesn't survive re-anchoring.
  const dock = (node: React.ReactElement) => (inline ? node : <VideoMiniDock>{node}</VideoMiniDock>);

  // 1 · broadcast playlist
  if (entries && entries.length) {
    return dock(
      <section className={shell} aria-label={`${label} — video`}>
        <TVProgramPlayer entries={entries} entryIdx={idx} onEntryEnd={() => setIdx((i) => (entries.length ? (i + 1) % entries.length : 0))} />
        {listHref ? <a className="ehero-more" href={listHref}>Watch as a list ↗</a> : null}
      </section>,
    );
  }

  // 2 · trailer reel fallback
  if (entries === null && reelIds !== null) {
    if (!reelIds.length) return null; // no broadcast and no trailers → no hero
    const src = `https://www.youtube-nocookie.com/embed/${reelIds[0]}?autoplay=1&mute=1&controls=1&loop=1&playlist=${reelIds.join(",")}&start=7&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`;
    return dock(
      <section className={shell} aria-label={`${label} — trailers`}>
        <iframe ref={iframeRef} className="ivd-yt" src={src} title={`${label} trailers`} allow="autoplay; encrypted-media; picture-in-picture" />
        <button type="button" className="ehero-mute" aria-label={muted ? "Unmute" : "Mute"}
          onClick={() => { iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: muted ? "unMute" : "mute", args: [] }), "*"); setMuted((m) => !m); }}>
          {muted ? "🔇" : "🔊"}
        </button>
        <DockFullscreenButton className="ehero-fs" />
      </section>,
    );
  }

  // 3 · loading. Inline: render nothing so the slot's own backdrop shows through
  // (no flash of a second ribbon). Top-banner: the backdrop + on-air ribbon.
  if (inline) return null;
  return (
    <section className="df-tvhero df-tvhero--load ehero" style={backdrop ? { backgroundImage: `url(${IMG}/w780${backdrop})` } : undefined} aria-label={`${label} — video`}>
      <span className="df-tvhero__badge"><b>METATAKE</b><i>TV</i></span>
      <span className="df-tvhero__tune">● Tuning in…</span>
    </section>
  );
}
