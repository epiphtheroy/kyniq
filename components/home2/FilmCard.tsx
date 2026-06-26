"use client";

import Link from "next/link";
import type { Film } from "@/lib/home2";
import { posterUrl, hashTone, tone, filmHref } from "./helpers";

/**
 * Light film card (.tp). Ported from the mockup's fcard(f, catHtml, sub).
 * `cat` renders the category-number metric (with the lens dot when `lens`).
 * `sub` is the .row2 link label (default "❝ Top reading").
 */
export default function FilmCard({
  f,
  cat,
  lens = true,
  sub = "❝ Top reading",
}: {
  f: Film;
  cat: React.ReactNode;
  lens?: boolean;
  sub?: string;
}) {
  const url = posterUrl(f.poster);
  return (
    <div className="tp">
      <Link className="pos" href={filmHref(f.slug)} style={{ background: tone(hashTone(f.slug)), display: "block" }}>
        {url ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
        <span className="addcirc">+</span>
        <span className="ptitle">{f.title}</span>
      </Link>
      <div className="body">
        <div className="rateline">
          <span className="star">★ {f.imdb != null ? f.imdb.toFixed(1) : "—"}</span>
          <span className="dotsep">·</span>
          <span className="catnum">
            {lens ? <span className="lz" /> : null}
            {cat}
          </span>
          <span className="save">☆</span>
        </div>
        <div className="nm">
          <Link href={filmHref(f.slug)}>{f.title}</Link>{" "}
          <span className="yr">
            {f.year ?? ""}
            {f.director ? ` · ${f.director}` : ""}
          </span>
        </div>
        <button className="wl">＋ Shelf</button>
        <div className="row2">
          <span className="tr">{sub}</span>
          <span className="inf">i</span>
        </div>
      </div>
    </div>
  );
}
