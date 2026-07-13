"use client";

// BroadcastCard — a bottom-of-page, CLICK-TO-PLAY METATAKE TV broadcast. Before
// the click it is a poster + framing text + a "Open on METATAKE TV" link — NO
// <iframe>, so Google detects no video (the "not on a watch page" flag stays
// clear). On click it fetches the compiled broadcast and mounts TVProgramPlayer
// wrapped in VideoMiniDock, so it PLAYS INLINE and then docks to a mini player
// when the reader scrolls away (dockAnyDirection — this sits at the page bottom).
//
// What plays is the broadcast (our criticism, as caption beats, over the film's
// images) — an audiovisual reading meant to be watched WHILE reading, not a bare
// trailer. The framing + authorship line say so. The card only appears when a
// broadcast/playlist exists (the caller gates on that), so the ▶ link never 404s.
import { useState } from "react";
import TVProgramPlayer, { type TVEntry } from "./TVProgramPlayer";
import VideoMiniDock from "./VideoMiniDock";

const IMG = "https://image.tmdb.org/t/p";

export default function BroadcastCard({
  program,
  playlist,
  watchHref,
  poster,
  title,
  theme,
  openLabel = "Open on METATAKE TV",
}: {
  program?: string;        // a film slug → /api/tv/watch?v= (single broadcast)
  playlist?: string;       // a playlist slug → /api/tv/watch?list= (entity reel of broadcasts)
  watchHref: string;       // /tv/[slug] or /tv/list/[slug] — the full watch page (closed loop)
  poster?: string | null;  // TMDB backdrop path for the pre-click poster
  title: string;           // heading, e.g. "Watch: Dogville — the Metatake broadcast"
  theme?: string;          // one-line subject framing (what the reading is about)
  openLabel?: string;
}) {
  const [entries, setEntries] = useState<TVEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const [nonce, setNonce] = useState(0);

  const play = () => {
    if (entries || loading) return;
    const url = program
      ? `/api/tv/watch?v=${encodeURIComponent(program)}`
      : playlist ? `/api/tv/watch?list=${encodeURIComponent(playlist)}` : null;
    if (!url) return;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((j) => setEntries((j.entries ?? []) as TVEntry[]))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  // ── playing: inline broadcast that docks on scroll ──────────────────────────
  if (entries && entries.length) {
    const advance = () =>
      entries.length > 1 ? setIdx((i) => (i + 1) % entries.length) : setNonce((n) => n + 1);
    return (
      <section className="bcast bcast--live" aria-label={title}>
        <VideoMiniDock dockAnyDirection>
          <div className="bcast-player">
            <TVProgramPlayer key={nonce} entries={entries} entryIdx={idx} onEntryEnd={advance} />
          </div>
        </VideoMiniDock>
        <p className="bcast-note">
          {title} — a compiled audiovisual reading (our criticism over the film&rsquo;s images),
          made to watch while you read. Assembled from the Metatake record, no LLM. © Metatake.
          {" "}<a className="bcast-open" href={watchHref}>{openLabel} →</a>
        </p>
      </section>
    );
  }

  // ── pre-click: poster + framing + open link (NO iframe) ─────────────────────
  return (
    <section className="bcast" aria-label={title}>
      <button
        type="button"
        className="bcast-stage"
        onClick={play}
        aria-label={`Play — ${title}`}
        style={poster ? { backgroundImage: `url(${IMG}/w1280${poster})` } : undefined}
      >
        <span className="bcast-badge"><b>METATAKE</b><i>TV</i></span>
        <span className="bcast-play" aria-hidden="true">{loading ? "◌" : "▶"}</span>
        {loading ? <span className="bcast-tune">Tuning in…</span> : null}
      </button>
      <div className="bcast-meta">
        <h2 className="bcast-title">{title}</h2>
        {theme ? <p className="bcast-theme">{theme}</p> : null}
        <p className="bcast-desc">
          Not a trailer — a compiled audiovisual reading: our criticism plays as captions over the
          film&rsquo;s images, made to watch <em>while you read</em>. Assembled from the Metatake
          record with no LLM. <span className="bcast-rights">© Metatake</span>
        </p>
        <a className="bcast-open" href={watchHref}>▶ {openLabel} →</a>
      </div>
    </section>
  );
}
