"use client";

/**
 * MetatakeDetailBits — small client-only pieces for the v6 meta-take detail page.
 *
 * MetatakeStats: the clickable stat strip beneath the meta-take header (Films /
 * Takes / Registers). Each stat is an anchor that jumps to its section and counts
 * up from 0 → target the first time it scrolls into view (mirrors the film /
 * figure pages and the mockup). Mirrors FigureStats so the two pages stay in sync.
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

export function MetatakeStats({
  films,
  takes,
  registers,
}: {
  films: number;
  takes: number;
  registers: number;
}) {
  return (
    <div className="mk-stats">
      <a className="mk-stat" href="#rep">
        <span className="mk-stat__n"><CountUp target={films} /></span>
        <span className="mk-stat__k">Films</span>
      </a>
      <a className="mk-stat mk-stat--red" href="#all-takes">
        <span className="mk-stat__n"><CountUp target={takes} /></span>
        <span className="mk-stat__k">Takes</span>
      </a>
      <a className="mk-stat" href="#all-takes">
        <span className="mk-stat__n"><CountUp target={registers} /></span>
        <span className="mk-stat__k">Registers</span>
      </a>
    </div>
  );
}
