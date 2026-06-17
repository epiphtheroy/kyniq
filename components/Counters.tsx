"use client";

import { useEffect, useRef, useState } from "react";

type Counts = { films: number; figures: number; takes: number; metatakes: number; tropes: number };
const ITEMS: [keyof Counts, string][] = [
  ["films", "Films"], ["figures", "Figures"], ["takes", "Takes"], ["metatakes", "Meta takes"], ["tropes", "Tropes"],
];

export default function Counters({ counts }: { counts: Counts }) {
  const [v, setV] = useState<Counts>({ films: 0, figures: 0, takes: 0, metatakes: 0, tropes: 0 });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      setV({
        films: Math.round(counts.films * e),
        figures: Math.round(counts.figures * e),
        takes: Math.round(counts.takes * e),
        metatakes: Math.round(counts.metatakes * e),
        tropes: Math.round(counts.tropes * e),
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [counts]);

  return (
    <div className="gauges">
      {ITEMS.map(([k, label]) => (
        <div className="gauge" key={k}>
          <span className="gauge__n">{v[k].toLocaleString()}</span>
          <span className="gauge__l">{label}</span>
        </div>
      ))}
    </div>
  );
}
