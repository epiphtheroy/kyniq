"use client";

// EntityTVHero — the unified top-of-page video hero for entity pages (director,
// lineage, genre, trope, concept, theorist, catalog node, country…). Generalises
// FilmTVHero's fallback chain:
//   1. a compiled METATAKE TV playlist for this entity (broadcast, intro first)
//   2. else a shuffled plain-trailer reel of the entity's films (no overlay)
//   3. else nothing (page keeps its old text-first shape)
// Both play inline in a fixed 16:9 box (.df-tvhero) so there's no layout shift.
// The reel is a single youtube-nocookie iframe with a chained playlist (no YT
// API), muted-autoplay, loop — same technique as FloatingTrailerDock.
import { useEffect, useMemo, useRef, useState } from "react";
import TVProgramPlayer, { type TVEntry } from "./TVProgramPlayer";

const IMG = "https://image.tmdb.org/t/p";

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export default function EntityTVHero({ playlist, reel, label, listHref, backdrop }: {
  playlist?: string;                       // tv_playlists.slug (omit for reel-only pages)
  reel: { id: string; title: string }[];   // tv_reel result (server-fetched fallback)
  label: string;                           // entity name — for a11y label only (H1 stays on the page)
  listHref?: string;                       // /tv/list/[slug] link, shown when a broadcast plays
  backdrop?: string | null;                // TMDB backdrop path for the loading ribbon
}) {
  // undefined = still fetching the playlist; null = no playlist → use the reel
  const [entries, setEntries] = useState<TVEntry[] | null | undefined>(playlist ? undefined : null);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!playlist) { setEntries(null); return; }
    let on = true;
    fetch(`/api/tv/watch?list=${encodeURIComponent(playlist)}`)
      .then((r) => r.json())
      .then((j) => { if (on) { const e: TVEntry[] = j.entries ?? []; setEntries(e.length ? e : null); } })
      .catch(() => { if (on) setEntries(null); });
    return () => { on = false; };
  }, [playlist]);

  const reelIds = useMemo(() => shuffle(reel.map((r) => r.id)).slice(0, 12), [reel]);

  // 1 · broadcast playlist
  if (entries && entries.length) {
    return (
      <section className="df-tvhero ehero" aria-label={`${label} — video`}>
        <TVProgramPlayer entries={entries} entryIdx={idx} onEntryEnd={() => setIdx((i) => (entries.length ? (i + 1) % entries.length : 0))} />
        {listHref ? <a className="ehero-more" href={listHref}>Watch as a list ↗</a> : null}
      </section>
    );
  }

  // 2 · reel fallback (playlist resolved empty / none) — only if there are trailers
  if (entries === null) {
    if (!reelIds.length) return null;
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

  // 3 · loading a known playlist — backdrop + on-air ribbon (no YT load yet)
  return (
    <section className="df-tvhero df-tvhero--load ehero" style={backdrop ? { backgroundImage: `url(${IMG}/w780${backdrop})` } : undefined} aria-label={`${label} — video`}>
      <span className="df-tvhero__badge"><b>METATAKE</b><i>TV</i></span>
      <span className="df-tvhero__tune">● Tuning in…</span>
    </section>
  );
}
