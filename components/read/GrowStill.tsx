"use client";

import { useEffect, useRef, useState } from "react";

/**
 * GrowStill — a film still that starts a touch wider than the text column and
 * grows toward full-bleed as it travels up the viewport (2026-07-08, credits
 * person pages). Pure presentation: rAF-throttled scroll → width interpolation;
 * without JS it simply renders at its starting width. Caption is mandatory
 * (film title + person tie-in + source).
 */
export default function GrowStill({
  src,
  alt,
  caption,
  startPx = 840,
}: {
  src: string;
  alt: string;
  caption: string;
  startPx?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<string>(`min(${startPx}px, 94vw)`);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const vh = window.innerHeight;
      const r = el.getBoundingClientRect();
      // Rise-and-fall: widest when the still sits around the upper-middle of
      // the viewport, easing back down as it scrolls in from below OR out the
      // top — and it never goes truly full-bleed (breathing room stays).
      const center = r.top + r.height / 2;
      const t = Math.min(1, Math.max(0, 1 - Math.abs(center - vh * 0.42) / (vh * 0.6)));
      const eased = t * t * (3 - 2 * t); // smoothstep
      setW(`min(calc(${startPx}px + ${(eased * 100).toFixed(1)} * ((100vw - 72px) - ${startPx}px) / 100), calc(100vw - 72px))`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [startPx]);

  return (
    <div ref={ref} style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", display: "flex", flexDirection: "column", alignItems: "center", margin: "34px 0 34px calc(50% - 50vw)" }}>
      <figure style={{ margin: 0, width: w, maxWidth: "100vw", transition: "width 80ms linear" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          width={1280}
          height={720}
          style={{ width: "100%", height: "auto", display: "block", borderRadius: 6, background: "#0c0c0c" }}
        />
        <figcaption style={{ maxWidth: 860, margin: "8px auto 0", padding: "0 16px", fontSize: 12.5, color: "#6f6a60", textAlign: "center" }}>
          {caption}
        </figcaption>
      </figure>
    </div>
  );
}
