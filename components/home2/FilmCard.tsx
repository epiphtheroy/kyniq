"use client";

import Link from "next/link";
import type { Film } from "@/lib/home2";
import { posterUrl, hashTone, tone, filmHref, tsQuadrant } from "./helpers";
import { displayTs } from "@/lib/cinecodex_dims";

/**
 * Light film card (.tp). `cat` renders the category-number metric (with the
 * lens dot when `lens`). IMDb star and the "Top reading" row were removed;
 * the TakeScore poster-overlay badge was retired site-wide (2026-07-05).
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
            alt={`${f.title}${f.year ? ` (${f.year})` : ""} poster`}
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
          {f.ts != null ? (
            <Link
              className="tsc"
              href={`/takescore/film/${f.slug}`}
              title={`TakeScore ${displayTs(f.ts)}${tsQuadrant(f.tsv, f.tsr) ? ` — ${tsQuadrant(f.tsv, f.tsr)}` : ""}`}
            >
              TS&nbsp;{displayTs(f.ts)}
            </Link>
          ) : null}
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
