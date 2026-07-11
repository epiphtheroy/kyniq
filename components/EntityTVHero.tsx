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

const IMG = "https://image.tmdb.org/t/p";

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export default function EntityTVHero({ playlist, reelSlugs, label, listHref, backdrop }: {
  playlist?: string;                 // tv_playlists.slug (omit for reel-only pages)
  reelSlugs: string[];               // the entity's film slugs — reel fallback source
  label: string;                     // entity name — a11y label only (H1 stays on the page)
  listHref?: string;                 // /tv/list/[slug], shown when a broadcast plays
  backdrop?: string | null;          // TMDB backdrop path for the loading ribbon
}) {
  // undefined = deciding; 'reel' after playlist misses; TVEntry[] once a broadcast loads
  const [entries, setEntries] = useState<TVEntry[] | null | undefined>(undefined);
  const [reelIds, setReelIds] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Step 1 — try the broadcast playlist.
  useEffect(() => {
    let on = true;
    if (!playlist) { setEntries(null); return; }
    fetch(`/api/tv/watch?list=${encodeURIComponent(playlist)}`)
      .then((r) => r.json())
      .then((j) => { if (on) { const e: TVEntry[] = j.entries ?? []; setEntries(e.length ? e : null); } })
      .catch(() => { if (on) setEntries(null); });
    return () => { on = false; };
  }, [playlist]);

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

  // 1 · broadcast playlist
  if (entries && entries.length) {
    return (
      <section className="df-tvhero ehero" aria-label={`${label} — video`}>
        <TVProgramPlayer entries={entries} entryIdx={idx} onEntryEnd={() => setIdx((i) => (entries.length ? (i + 1) % entries.length : 0))} />
        {listHref ? <a className="ehero-more" href={listHref}>Watch as a list ↗</a> : null}
      </section>
    );
  }

  // 2 · trailer reel fallback
  if (entries === null && reelIds !== null) {
    if (!reelIds.length) return null; // no broadcast and no trailers → no hero
    const src = `https://www.youtube-nocookie.com/embed/${reelIds[0]}?autoplay=1&mute=1&controls=1&loop=1&playlist=${reelIds.join(",")}&start=7&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`;
    return (
      <section className="df-tvhero ehero" aria-label={`${label} — trailers`}>
        <iframe ref={iframeRef} className="ivd-yt" src={src} title={`${label} trailers`} allow="autoplay; encrypted-media; picture-in-picture" />
        <button type="button" className="ehero-mute" aria-label={muted ? "Unmute" : "Mute"}
          onClick={() => { iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: muted ? "unMute" : "mute", args: [] }), "*"); setMuted((m) => !m); }}>
          {muted ? "🔇" : "🔊"}
        </button>
      </section>
    );
  }

  // 3 · loading — backdrop + on-air ribbon (no YT load yet)
  return (
    <section className="df-tvhero df-tvhero--load ehero" style={backdrop ? { backgroundImage: `url(${IMG}/w780${backdrop})` } : undefined} aria-label={`${label} — video`}>
      <span className="df-tvhero__badge"><b>METATAKE</b><i>TV</i></span>
      <span className="df-tvhero__tune">● Tuning in…</span>
    </section>
  );
}
