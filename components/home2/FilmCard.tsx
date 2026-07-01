"use client";

import Link from "next/link";
import type { Film } from "@/lib/home2";
import { posterUrl, hashTone, tone, filmHref } from "./helpers";

/**
 * Light film card (.tp). `cat` renders the category-number metric (with the
 * lens dot when `lens`). IMDb star and the "Top reading" row were removed;
 * the TakeScore badge is overlaid on the poster site-wide (TakeScoreBadges).
 */
export default function FilmCard({
  f,
  cat,
  lens = true,
}: {
  f: Film;
  cat: React.ReactNode;
  lens?: boolean;
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
      </div>
    </div>
  );
}
