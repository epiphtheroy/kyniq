"use client";

/**
 * GalleryViewer — a scrolling, framed image feed for a film (TMDB images).
 * Left: small thumbnail rail (jump nav, scroll-spy highlight).
 * Right: a vertical feed of large framed images ("matted" like artwork), each with a caption
 * styled as the work's title. Renders the first few, then loads more on scroll (incremental).
 * Click any image → fullscreen lightbox (covers the rail); close via ×, backdrop, or Esc.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Img = { file_path: string; width: number; height: number; iso_639_1: string | null };
const T = (size: string, p: string) => `https://image.tmdb.org/t/p/${size}${p}`;
const STEP = 6;

export default function GalleryViewer({
  backdrops, posters, title, year, filmSlug,
}: { backdrops: Img[]; posters: Img[]; title: string; year: number | null; filmSlug: string }) {
  const [tab, setTab] = useState<"backdrops" | "posters">(backdrops.length ? "backdrops" : "posters");
  const list = tab === "backdrops" ? backdrops : posters;
  const [count, setCount] = useState(STEP);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => { setCount(STEP); setActive(0); }, [tab]);

  // Incremental load: grow the rendered count as the sentinel approaches the viewport.
  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) setCount((c) => Math.min(list.length, c + STEP)); });
    }, { rootMargin: "900px" });
    io.observe(el);
    return () => io.disconnect();
  }, [list.length, tab, count]);

  // Scroll-spy: highlight the rail thumb for the image currently centered in the feed.
  useEffect(() => {
    const root = feedRef.current; if (!root) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { const n = Number((e.target as HTMLElement).dataset.idx); if (!Number.isNaN(n)) setActive(n); } });
    }, { rootMargin: "-45% 0px -45% 0px" });
    root.querySelectorAll<HTMLElement>("[data-idx]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [count, tab]);

  const jump = useCallback((idx: number) => {
    setActive(idx);
    if (idx >= count) setCount(Math.min(list.length, idx + STEP));
    requestAnimationFrame(() => document.getElementById(`gimg-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [count, list.length]);

  // Lightbox keyboard + body lock.
  useEffect(() => {
    if (zoom === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
      else if (e.key === "ArrowRight") setZoom((z) => (z === null ? z : Math.min(list.length - 1, z + 1)));
      else if (e.key === "ArrowLeft") setZoom((z) => (z === null ? z : Math.max(0, z - 1)));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [zoom, list.length]);

  const feedSize = tab === "backdrops" ? "w1280" : "w780";
  const shown = list.slice(0, count);

  return (
    <div className="gal">
      <aside className="gal-rail">
        {backdrops.length > 0 && posters.length > 0 ? (
          <div className="gal-toggle">
            <button className={tab === "backdrops" ? "on" : ""} onClick={() => setTab("backdrops")}>Backdrops <span>{backdrops.length}</span></button>
            <button className={tab === "posters" ? "on" : ""} onClick={() => setTab("posters")}>Posters <span>{posters.length}</span></button>
          </div>
        ) : null}
        <div className={`gal-thumbs gal-thumbs--${tab}`}>
          {list.map((im, idx) => (
            <button key={im.file_path} className={`gal-th${idx === active ? " on" : ""}`} onClick={() => jump(idx)} aria-label={`Image ${idx + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={T("w185", im.file_path)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </aside>

      <div className="gal-feed" ref={feedRef}>
        {shown.length === 0 ? <p className="gal-empty">No images for this title yet.</p> : null}
        {shown.map((im, idx) => (
          <figure className={`gal-frame gal-frame--${tab}`} key={im.file_path} id={`gimg-${idx}`} data-idx={idx}>
            <div className="gal-mat">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="gal-fimg" src={T(feedSize, im.file_path)} alt={`${title} — ${tab === "backdrops" ? "backdrop" : "poster"} ${idx + 1}`} loading="lazy" onClick={() => setZoom(idx)} title="Click to view full screen" />
            </div>
            <figcaption className="gal-cap">
              <span className="gal-cap__t">{title}</span>{year ? <span className="gal-cap__y">, {year}</span> : null}
              <span className="gal-cap__m">{tab === "backdrops" ? "Backdrop" : "Poster"} {idx + 1} / {list.length}</span>
            </figcaption>
          </figure>
        ))}
        {count < list.length ? <div className="gal-more" ref={sentinel}>Loading more…</div> : null}
        <div className="gal-bar">
          <Link href={`/film/${filmSlug}`} className="gal-back">← {title}</Link>
          <span className="gal-src">Images via TMDB</span>
        </div>
      </div>

      {zoom !== null && list[zoom] ? (
        <div className="gal-zoom" role="dialog" aria-modal="true" onClick={() => setZoom(null)}>
          <button className="gal-zoom__x" onClick={(e) => { e.stopPropagation(); setZoom(null); }} aria-label="Close">×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gal-zoom__img" src={T("w1280", list[zoom].file_path)} alt={`${title} ${zoom + 1}`} onClick={(e) => e.stopPropagation()} />
          <div className="gal-zoom__nav" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setZoom((z) => (z === null ? z : Math.max(0, z - 1)))} disabled={zoom === 0} aria-label="Previous">‹</button>
            <span>{zoom + 1} / {list.length}</span>
            <button onClick={() => setZoom((z) => (z === null ? z : Math.min(list.length - 1, z + 1)))} disabled={zoom === list.length - 1} aria-label="Next">›</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
