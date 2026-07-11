"use client";

// FilmTVHero — the film page's hero when the film has a compiled METATAKE TV
// broadcast. Fetches the program from the (cached) watch API and plays it in a
// 16:9 box in place of the plain trailer reel. While it loads it shows the
// backdrop with an on-air ribbon (no double YouTube load); if the program has
// vanished it falls back to the trailer reel. The full broadcast lives at
// /tv/[slug] — this is the same program embedded.
import { useEffect, useState } from "react";
import FilmHeroReel from "./FilmHeroReel";
import TVProgramPlayer, { type TVEntry } from "./TVProgramPlayer";
import VideoMiniDock from "./VideoMiniDock";

const IMG = "https://image.tmdb.org/t/p";

export default function FilmTVHero({ slug, videos, poster, backdrop }: {
  slug: string;
  videos: { id: string; title: string }[];
  poster?: string;
  backdrop?: string | null;
}) {
  const [entry, setEntry] = useState<TVEntry | null | undefined>(undefined); // undefined = loading
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let on = true;
    fetch(`/api/tv/watch?v=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => { if (on) setEntry((j.entries ?? [])[0] ?? null); })
      .catch(() => { if (on) setEntry(null); });
    return () => { on = false; };
  }, [slug]);

  if (entry) {
    // scroll-follow: the broadcast ITSELF shrinks into a bottom-right mini
    // player (text scales with it) — replaces the old plain-trailer dock
    return (
      <VideoMiniDock>
        <div className="df-tvhero">
          <TVProgramPlayer key={nonce} entries={[entry]} entryIdx={0} onEntryEnd={() => setNonce((n) => n + 1)} />
        </div>
      </VideoMiniDock>
    );
  }

  if (entry === null) {
    // program gone — the trailer reel is the honest fallback
    if (videos.length) return <FilmHeroReel videos={videos} poster={poster} start={7} />;
    return backdrop
      // eslint-disable-next-line @next/next/no-img-element
      ? <img className="df-backdrop" src={`${IMG}/w780${backdrop}`} alt="" width={780} height={439} />
      : <div className="df-backdrop df-backdrop--empty" aria-hidden="true" />;
  }

  // loading — backdrop with an ON AIR ribbon, no YouTube load yet
  return (
    <div className="df-tvhero df-tvhero--load" style={backdrop ? { backgroundImage: `url(${IMG}/w780${backdrop})` } : undefined}>
      <span className="df-tvhero__badge"><b>METATAKE</b><i>TV</i></span>
      <span className="df-tvhero__tune">● Tuning in…</span>
    </div>
  );
}
