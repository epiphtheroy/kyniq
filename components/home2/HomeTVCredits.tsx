"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// Chunk-split: the TV player's JS (YouTube iframe logic, channel patterns)
// downloads only when the section actually mounts on scroll — it must not
// sit in the home's initial bundle.
const MetatakeTV = dynamic(() => import("@/components/MetatakeTV"), {
  ssr: false,
  loading: () => <div className="hxtv-ph" aria-hidden="true" />,
});

/**
 * Lower-page two-column row: Metatake TV (the screen-essay channel) on one side,
 * the credits web on the other. The TV iframe is LAZY-mounted (IntersectionObserver,
 * 400px pre-roll) so the home's LCP/edge-cache is untouched — the channel only
 * loads once the reader scrolls near it.
 */
export default function HomeTVCredits() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show]);

  return (
    <section className="band dark hxtv-sec">
      <div className="wrap">
        <div className="hxtv-row">
          <div className="hxtv-tv" ref={ref}>
            <div className="shead">
              <div>
                <h2>Metatake TV <span className="chev">›</span></h2>
                <div className="sub">A screen-essay channel: the archive&apos;s data, read as a broadcast. On-site clips only.</div>
              </div>
              <a className="seeall" href="/tv/full">Open the channel ›</a>
            </div>
            <div className="hxtv-box">
              {show ? <MetatakeTV embed /> : <div className="hxtv-ph" aria-hidden="true" />}
            </div>
          </div>

          <a className="hxtv-credits" href="/credits">
            <div className="hxc-k">The credits web</div>
            <h3>Follow anyone across the films they made</h3>
            <p>Every cast and crew connection — actors, directors, writers, composers — mapped across the whole corpus, one person at a time.</p>
            <span className="hxc-go">Explore the credits →</span>
          </a>
        </div>
      </div>
    </section>
  );
}
