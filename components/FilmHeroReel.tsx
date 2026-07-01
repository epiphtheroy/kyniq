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
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

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
  const frameRef = useRef<HTMLDivElement>(null);  // the (floating) player box
  const playerRef = useRef<{ destroy?: () => void; mute?: () => void; unMute?: () => void; setVolume?: (v: number) => void } | null>(null);
  const idxRef = useRef(0);
  const [floating, setFloating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null); // dragged float position
  const dismRef = useRef(false); dismRef.current = dismissed;
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const toggleMute = () => {
    const p = playerRef.current; if (!p) return;
    if (muted) { try { p.unMute?.(); p.setVolume?.(100); } catch {} setMuted(false); }
    else { try { p.mute?.(); } catch {} setMuted(true); }
  };

  // drag the floating player by its handle
  const onDragDown = (e: ReactPointerEvent) => {
    const el = frameRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    const move = (ev: PointerEvent) => {
      if (!drag.current) return;
      const w = el.offsetWidth, h = el.offsetHeight;
      const x = Math.max(6, Math.min(window.innerWidth - w - 6, ev.clientX - drag.current.dx));
      const y = Math.max(6, Math.min(window.innerHeight - h - 6, ev.clientY - drag.current.dy));
      setPos({ x, y });
    };
    const up = () => { drag.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

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

  const isFloat = floating && !dismissed;
  const frameStyle: CSSProperties = { ...(poster ? { backgroundImage: `url(${poster})` } : {}) };
  if (isFloat && pos) { frameStyle.left = pos.x; frameStyle.top = pos.y; frameStyle.right = "auto"; frameStyle.bottom = "auto"; }

  return (
    <div ref={wrapRef} className="iv-wrap">
      <div ref={frameRef} className={`iv-frame${isFloat ? " iv-frame--float" : ""}`} style={frameStyle}>
        {isFloat ? <div className="iv-drag" onPointerDown={onDragDown} title="Drag to move">⋮⋮ drag</div> : null}
        <div ref={holderRef} className="iv-yt" />
        <button type="button" className={`iv-mute${muted ? "" : " on"}`} onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇 Sound off" : "🔊 Sound on"}
        </button>
        {isFloat ? (
          <button type="button" className="iv-close" onClick={() => { setDismissed(true); setFloating(false); setPos(null); }} aria-label="Close floating video">×</button>
        ) : null}
      </div>
    </div>
  );
}
