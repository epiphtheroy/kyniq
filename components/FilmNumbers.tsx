"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/** "By the numbers" — a live scoreboard of every counted section on the film
 *  page. Each tile is a jump-link to its tab, its number lit in that section's
 *  colour and counting up from zero when the board scrolls into view. Deep-navy
 *  ground (the site's atlas-button navy) so the vivid numerals carry the energy.
 *  Server-renders the real figures (no-JS safe); JS only adds the count-up. */

export type FilmNumber = { n: number; label: string; href: string; color: string; hero?: boolean };

const MONO = "ui-monospace, \"SF Mono\", SFMono-Regular, Menlo, Consolas, monospace";

export default function FilmNumbers({ title, items }: { title: string; items: FilmNumber[] }) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const spans = Array.from(grid.querySelectorAll<HTMLElement>(".fnum__n"));
    if (!spans.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // SSR values already show the true figures

    const targets = spans.map((s) => Number(s.dataset.target || 0));
    let started = false;
    const run = () => {
      started = true;
      const dur = 1000;
      let t0 = 0;
      const step = (now: number) => {
        if (!t0) t0 = now;
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
        spans.forEach((s, i) => { s.textContent = String(Math.round(targets[i] * e)); });
        if (p < 1) requestAnimationFrame(step);
        else spans.forEach((s, i) => { s.textContent = String(targets[i]); });
      };
      // start from zero, then climb
      spans.forEach((s) => { s.textContent = "0"; });
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting && !started) { run(); io.disconnect(); break; }
      }
    }, { threshold: 0.3 });
    io.observe(grid);
    return () => io.disconnect();
  }, []);

  if (!items.length) return null;

  return (
    <section className="fnum" id="df-numbers">
      <div className="fnum__kick">{title} — by the numbers</div>
      <div className="fnum__grid" ref={gridRef}>
        {items.map((it, i) => (
          <a
            key={it.label}
            className={`fnum__tile${it.hero ? " fnum__tile--hero" : ""}`}
            href={it.href}
            style={{ "--c": it.color, animationDelay: `${i * 45}ms` } as CSSProperties}
          >
            <span className="fnum__n" data-target={it.n} style={{ fontFamily: MONO }}>{it.n}</span>
            <span className="fnum__lab">{it.label}<span className="fnum__arr">→</span></span>
          </a>
        ))}
      </div>
    </section>
  );
}
