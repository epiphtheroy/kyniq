"use client";

/**
 * GalleryViewer — master-detail image gallery for a film (TMDB images).
 * Left thumbnail rail + large main viewer; toggle between Backdrops and Posters.
 * Thumbnails are w185 (lazy); the main image loads at full size only for the selected one,
 * so a film with 100+ images stays light. Keyboard ←/→ navigate. Images are TMDB/CDN-served.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

type Img = { file_path: string; width: number; height: number; iso_639_1: string | null };
const T = (size: string, p: string) => `https://image.tmdb.org/t/p/${size}${p}`;

export default function GalleryViewer({
  backdrops, posters, title, filmSlug,
}: { backdrops: Img[]; posters: Img[]; title: string; filmSlug: string }) {
  const [tab, setTab] = useState<"backdrops" | "posters">(backdrops.length ? "backdrops" : "posters");
  const list = tab === "backdrops" ? backdrops : posters;
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  useEffect(() => { setI(0); }, [tab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((p) => Math.min(list.length - 1, p + 1));
      else if (e.key === "ArrowLeft") setI((p) => Math.max(0, p - 1));
      else if (e.key === "Escape") setZoom(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.length]);

  useEffect(() => {
    document.body.style.overflow = zoom ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [zoom]);

  const cur = list[i];
  const mainSize = tab === "backdrops" ? "w1280" : "w780";

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
            <button key={im.file_path} className={`gal-th${idx === i ? " on" : ""}`} onClick={() => setI(idx)} aria-label={`Image ${idx + 1} of ${list.length}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={T("w185", im.file_path)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </aside>

      <div className="gal-main">
        {cur ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img key={cur.file_path} className={`gal-img gal-img--${tab}`} src={T(mainSize, cur.file_path)} alt={`${title} — ${tab === "backdrops" ? "backdrop" : "poster"} ${i + 1}`} onClick={() => setZoom(true)} title="Click to view full screen" />
        ) : <p className="gal-empty">No images for this title yet.</p>}
        <div className="gal-bar">
          <Link href={`/film/${filmSlug}`} className="gal-back">← {title}</Link>
          {cur ? <span className="gal-count">{i + 1} / {list.length}</span> : null}
          <span className="gal-src">Images via TMDB</span>
        </div>
      </div>

      {zoom && cur ? (
        <div className="gal-zoom" role="dialog" aria-modal="true" onClick={() => setZoom(false)}>
          <button className="gal-zoom__x" onClick={(e) => { e.stopPropagation(); setZoom(false); }} aria-label="Close">×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gal-zoom__img" src={T("w1280", cur.file_path)} alt={`${title} ${i + 1}`} onClick={(e) => e.stopPropagation()} />
          <div className="gal-zoom__nav" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setI((p) => Math.max(0, p - 1))} disabled={i === 0} aria-label="Previous">‹</button>
            <span>{i + 1} / {list.length}</span>
            <button onClick={() => setI((p) => Math.min(list.length - 1, p + 1))} disabled={i === list.length - 1} aria-label="Next">›</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
