"use client";

/**
 * InviteVideo — muted-autoplay trailer beside the film's "An invitation".
 * - Lazy: the YouTube iframe mounts once the block first scrolls into view (LCP-safe).
 * - Sticky follow: when the inline spot scrolls out of view it detaches into a small
 *   floating player (bottom-right) so playback continues; returns inline on scroll-back.
 *   The iframe DOM node never remounts (only a class toggles) so playback is uninterrupted.
 * - Dismissable: an × on the floating player removes it.
 * The observed sentinel (.iv-wrap) always stays in flow, so toggling never flickers.
 */
import { useEffect, useRef, useState } from "react";

export default function InviteVideo({ videoId, title, poster, start = 0, loop = false }: { videoId: string; title: string; poster?: string; start?: number; loop?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [floating, setFloating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const onRef = useRef(false); onRef.current = on;
  const dismRef = useRef(false); dismRef.current = dismissed;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting) { setOn(true); setFloating(false); }
        else if (onRef.current && !dismRef.current) { setFloating(true); }
      },
      { threshold: 0, rootMargin: "-72px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // controls left ON (no controls=0) so the viewer can unmute and scrub. start/loop optional.
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1${start > 0 ? `&start=${start}` : ""}${loop ? `&loop=1&playlist=${videoId}` : ""}`;

  return (
    <div ref={ref} className="iv-wrap">
      <div
        className={`iv-frame${floating ? " iv-frame--float" : ""}`}
        style={poster && !on ? { backgroundImage: `url(${poster})` } : undefined}
      >
        {on ? (
          <iframe
            src={src}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <span className="iv-ph" aria-hidden="true">▶</span>
        )}
        {floating ? (
          <button type="button" className="iv-close" onClick={() => { setDismissed(true); setFloating(false); }} aria-label="Close floating video">×</button>
        ) : null}
      </div>
    </div>
  );
}
