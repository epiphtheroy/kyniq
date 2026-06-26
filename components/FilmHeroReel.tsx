"use client";

/**
 * FilmHeroReel — the film hero's autoplay video.
 * - Plays a playlist of the film's videos (clips first, trailer last — ordered by caller).
 * - Each video starts at `start` seconds; when one ends, the next starts (also at `start`);
 *   after the last it wraps to the first, so it runs forever.
 * - Muted autoplay (browser policy); YouTube controls stay ON so the viewer can unmute + scrub.
 * - Scroll-follow: when the inline spot leaves the viewport it docks into a small floating
 *   player (bottom-left) so playback continues; the player is never re-created (uninterrupted).
 * Uses the YouTube IFrame Player API (needed to detect "ended" and seek the next clip to `start`).
 */
import { useEffect, useRef, useState } from "react";

type Vid = { id: string; title: string };

// Singleton loader for the YT IFrame API.
let ytReady: Promise<void> | null = null;
function loadYT(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as unknown as { YT?: { Player?: unknown }; onYouTubeIframeAPIReady?: () => void };
  if (w.YT && w.YT.Player) return Promise.resolve();
  if (ytReady) return ytReady;
  ytReady = new Promise<void>((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytReady;
}

export default function FilmHeroReel({ videos, poster, start = 7 }: { videos: Vid[]; poster?: string; start?: number }) {
  const holderRef = useRef<HTMLDivElement>(null); // replaced by the YT iframe
  const wrapRef = useRef<HTMLDivElement>(null);   // in-flow sentinel for the observer
  const playerRef = useRef<{ destroy?: () => void } | null>(null);
  const idxRef = useRef(0);
  const [floating, setFloating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const dismRef = useRef(false); dismRef.current = dismissed;

  // Build the player once.
  useEffect(() => {
    if (!videos.length) return;
    let cancelled = false;
    loadYT().then(() => {
      const w = window as unknown as { YT?: { Player: new (el: Element, cfg: unknown) => unknown } };
      if (cancelled || !holderRef.current || !w.YT) return;
      playerRef.current = new w.YT.Player(holderRef.current, {
        videoId: videos[0].id,
        playerVars: { autoplay: 1, mute: 1, controls: 1, start, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e: { target: { mute: () => void; playVideo: () => void } }) => {
            try { e.target.mute(); e.target.playVideo(); } catch { /* noop */ }
          },
          onStateChange: (e: { data: number; target: { loadVideoById: (o: { videoId: string; startSeconds: number }) => void } }) => {
            if (e.data === 0) { // YT.PlayerState.ENDED
              idxRef.current = (idxRef.current + 1) % videos.length;
              try { e.target.loadVideoById({ videoId: videos[idxRef.current].id, startSeconds: start }); } catch { /* noop */ }
            }
          },
        },
      }) as { destroy?: () => void };
    });
    return () => { cancelled = true; try { playerRef.current?.destroy?.(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Float when the inline spot scrolls out of view.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting) setFloating(false);
        else if (!dismRef.current) setFloating(true);
      },
      { threshold: 0, rootMargin: "-72px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!videos.length) return null;

  return (
    <div ref={wrapRef} className="iv-wrap">
      <div
        className={`iv-frame${floating && !dismissed ? " iv-frame--float" : ""}`}
        style={poster ? { backgroundImage: `url(${poster})` } : undefined}
      >
        <div ref={holderRef} className="iv-yt" />
        {floating && !dismissed ? (
          <button type="button" className="iv-close" onClick={() => { setDismissed(true); setFloating(false); }} aria-label="Close floating video">×</button>
        ) : null}
      </div>
    </div>
  );
}
