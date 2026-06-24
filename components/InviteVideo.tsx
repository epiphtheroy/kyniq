"use client";

/**
 * InviteVideo — muted-autoplay trailer beside the film's "An invitation".
 * Lazy: the YouTube iframe only mounts once the block scrolls into view (protects initial LCP),
 * then autoplays muted (browser-policy-safe) with controls so the viewer can unmute.
 */
import { useEffect, useRef, useState } from "react";

export default function InviteVideo({ videoId, title, poster }: { videoId: string; title: string; poster?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setOn(true); io.disconnect(); } },
      { rootMargin: "250px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;

  return (
    <div
      ref={ref}
      className="iv-frame"
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
    </div>
  );
}
