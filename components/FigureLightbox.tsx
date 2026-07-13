"use client";

// FigureLightbox — progressive enhancement for the desk-essay body figures that
// lib/read-media.injectFigures drops into the article as HTML (figure.rd-fig).
// On mount it collects those figures, makes each open a shared lightbox on click
// (with a small ⤢ hint), and steps through the whole set with next/prev + arrow
// keys. Images only — no video. Reuses the .slx-lb* lightbox styles.
import { useEffect, useState, useCallback } from "react";

export default function FigureLightbox({ scope = ".rd-body" }: { scope?: string }) {
  const [imgs, setImgs] = useState<{ src: string; cap: string }[]>([]);
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    const root = document.querySelector(scope) ?? document;
    const figs = Array.from(root.querySelectorAll<HTMLElement>("figure.rd-fig"));
    if (!figs.length) return;
    const collected = figs.map((fig) => {
      const img = fig.querySelector("img");
      const src = (img?.getAttribute("src") || "").replace("/w780", "/w1280");
      const cap = fig.querySelector("figcaption")?.textContent || "";
      return { src, cap };
    }).filter((x) => x.src);
    setImgs(collected);

    const handlers: Array<() => void> = [];
    figs.forEach((fig, i) => {
      if (!collected[i]?.src) return;
      fig.classList.add("rd-fig--zoom");
      const h = () => setZoom(i);
      fig.addEventListener("click", h);
      handlers.push(() => fig.removeEventListener("click", h));
    });
    return () => handlers.forEach((off) => off());
  }, [scope]);

  const close = useCallback(() => setZoom(null), []);
  const step = useCallback(
    (d: number) => setZoom((z) => (z === null ? z : (z + d + imgs.length) % imgs.length)),
    [imgs.length],
  );

  useEffect(() => {
    if (zoom === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [zoom, close, step]);

  if (zoom === null || !imgs.length) return null;
  return (
    <div className="slx-lb" role="dialog" aria-modal="true" onClick={close}>
      <button type="button" className="slx-lb__x" onClick={close} aria-label="Close">✕</button>
      {imgs.length > 1 ? (
        <button type="button" className="slx-lb__nav slx-lb__nav--l" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous">‹</button>
      ) : null}
      <figure className="slx-lb__fig" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgs[zoom].src} alt={imgs[zoom].cap} />
        <figcaption>
          {imgs[zoom].cap}
          {imgs.length > 1 ? <span className="slx-lb__count"> · {zoom + 1} / {imgs.length}</span> : null}
        </figcaption>
      </figure>
      {imgs.length > 1 ? (
        <button type="button" className="slx-lb__nav slx-lb__nav--r" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next">›</button>
      ) : null}
    </div>
  );
}
