"use client";

import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";
import { backdropUrl, hashTone, tone, filmHref } from "./helpers";
import Rail from "./Rail";

export default function Newly({ data }: { data: HomeV2 }) {
  return (
    <section className="band dark" style={{ paddingTop: 8 }}>
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              Newly mapped <span className="chev">›</span>
            </h2>
            <div className="sub">Films just read closely · per card: ★ rating · readings added</div>
          </div>
          <Link className="seeall" href="/latest">
            All just-added ›
          </Link>
        </div>
        <Rail>
          {data.newly.map((f) => {
            const url = backdropUrl(f.backdrop);
            return (
              <div className="wide" key={f.slug}>
                <Link className="bd" href={filmHref(f.slug)} style={{ background: tone(hashTone(f.slug)), display: "block" }}>
                  {url ? (
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : null}
                  <span className="trope">{f.trope}</span>
                  <span className="addcirc">+</span>
                  <span className="play">
                    <span className="pc">▸</span>
                    <span className="lbl">READ · {f.framework}</span>
                  </span>
                </Link>
                <div className="meta">
                  <div className="addc">+</div>
                  <div>
                    <div className="dt">JUST ADDED · {f.year ?? ""}</div>
                    <Link className="wt" href={filmHref(f.slug)}>
                      {f.title}
                    </Link>
                    <div className="react">
                      <span className="star">★ {f.imdb != null ? f.imdb.toFixed(1) : "—"}</span>
                      <span>
                        <b>{f.readings ?? 0}</b> readings
                      </span>
                      <span>
                        <b>{f.tropes ?? 0}</b> tropes
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </Rail>
      </div>
    </section>
  );
}
