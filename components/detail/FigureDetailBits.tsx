"use client";

/**
 * FigureDetailBits — small client-only pieces for the v6 figure detail page.
 *
 * FigureStats: the clickable stat strip beneath the figure header. Each stat
 * is an anchor that jumps to its section (#takes / #connected) and counts up
 * from 0 → target the first time it scrolls into view (mirrors the film page /
 * mockup behaviour). Connected-figures stat is omitted when there are none.
 */

import { useEffect, useRef, useState } from "react";

function CountUp({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (target <= 0) { setN(0); return; }
    const run = () => {
      if (done.current) return;
      done.current = true;
      const dur = 900 + Math.random() * 400;
      let t0: number | null = null;
      const step = (now: number) => {
        if (t0 === null) t0 = now;
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        setN(Math.round(target * e));
        if (p < 1) requestAnimationFrame(step);
        else setN(target);
      };
      requestAnimationFrame(step);
    };
    if (typeof IntersectionObserver === "undefined") { setN(target); return; }
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) run(); }),
      { threshold: 0.6 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return <span ref={ref}>{n}</span>;
}

export function FigureStats({
  takes,
  metaTakes,
  connected,
}: {
  takes: number;
  metaTakes: number;
  connected: number | null;
}) {
  return (
    <div className="fg-stats">
      <a className="fg-stat" href="#takes">
        <span className="fg-stat__n"><CountUp target={takes} /></span>
        <span className="fg-stat__k">Takes</span>
      </a>
      <a className="fg-stat fg-stat--red" href="#takes">
        <span className="fg-stat__n"><CountUp target={metaTakes} /></span>
        <span className="fg-stat__k">Meta takes</span>
      </a>
      {connected !== null ? (
        <a className="fg-stat fg-stat--teal" href="#connected">
          <span className="fg-stat__n"><CountUp target={connected} /></span>
          <span className="fg-stat__k">Connected figures</span>
        </a>
      ) : null}
    </div>
  );
}
