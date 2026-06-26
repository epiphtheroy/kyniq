"use client";

import { useState } from "react";
import Link from "next/link";
import type { HomeV2, LensFilm } from "@/lib/home2";
import { posterUrl, hashTone, tone, filmHref } from "./helpers";
import Rail from "./Rail";

function LensCard({ f }: { f: LensFilm }) {
  const url = posterUrl(f.poster);
  return (
    <div className="lcard">
      <Link className="pp" href={filmHref(f.slug)} style={{ background: tone(hashTone(f.slug)), display: "block" }}>
        {url ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
        <span className="addc">+</span>
      </Link>
      <div className="lrate">
        <span className="lstar">★ {f.imdb != null ? f.imdb.toFixed(1) : "—"}</span>
        <span className="lread">{f.readings ?? 0} readings</span>
      </div>
      <div className="nm">
        <Link href={filmHref(f.slug)}>{f.title}</Link> <span className="ly">{f.year ?? ""}</span>
      </div>
      <div className="vi">via {f.figureLabel ?? "a figure"}</div>
      <button className="lwl">＋ Shelf</button>
    </div>
  );
}

export default function LensRail({ data }: { data: HomeV2 }) {
  const { frameworks, byFramework } = data.lens;
  const [cur, setCur] = useState(frameworks[0] ?? "");
  const list = byFramework[cur] ?? [];

  return (
    <section className="band dark">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              Explore by lens <span className="chev">›</span>
            </h2>
            <div className="sub">Pick a framework · per card: ★ rating · readings · the figure it reads through</div>
          </div>
          <Link className="seeall" href="/strong-misreadings">
            Edit your lenses ✎
          </Link>
        </div>
        <div className="tabs" id="tabs">
          {frameworks.map((k) => (
            <div key={k} className={`tab ${k === cur ? "on" : ""}`} onClick={() => setCur(k)}>
              {k}
            </div>
          ))}
        </div>
        <Rail>
          {list.map((f, i) => (
            <LensCard f={f} key={`${cur}-${f.slug}-${i}`} />
          ))}
        </Rail>
        <div className="railcount">{list.length} titles — scroll ›</div>
      </div>
    </section>
  );
}
