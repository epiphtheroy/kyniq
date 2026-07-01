"use client";

import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";
import { posterUrl, hashTone, tone, filmHref } from "./helpers";
import Rail from "./Rail";

export default function Top10({ data }: { data: HomeV2 }) {
  const { top3, top10 } = data;
  return (
    <section className="band dark">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              The essential 10 <span className="chev">›</span>
            </h2>
            <div className="sub">Ranked by metatake&apos;s prestige + discovery score — not by traffic</div>
          </div>
          <Link className="seeall" href="/lineage">
            How the score works ›
          </Link>
        </div>
        <div className="t3grid" id="t3">
          {top3.map((f, i) => {
            const url = posterUrl(f.poster);
            return (
              <Link className="t3" href={filmHref(f.slug)} key={f.slug}>
                <div className="pp" style={{ background: tone(hashTone(f.slug)) }}>
                  {url ? (
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : null}
                  <div className="rk">#{i + 1}</div>
                </div>
                <div className="info">
                  <div className="ti">{f.title}</div>
                  <div className="mt">{f.meta}</div>
                  <div className="rt">
                    <span>
                      Metascore {f.metascore ?? "—"} · RT {f.rt ?? "—"}%
                    </span>
                  </div>
                  <div className="watched">◉ Mark as read</div>
                  <div className="syn">Strong Misreading — {f.syn}</div>
                </div>
              </Link>
            );
          })}
        </div>
        <Rail>
          {top10.map((f) => (
            <Link className="tr10" href={filmHref(f.slug)} key={f.slug}>
              <div className="pp" style={{ background: tone(hashTone(f.slug)) }}>
                {posterUrl(f.poster) ? (
                  <img src={posterUrl(f.poster)!} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : null}
                <div className="rk">#{f.rank}</div>
              </div>
              <div className="nm">{f.title}</div>
              <div className="rt">on the canon</div>
            </Link>
          ))}
        </Rail>
      </div>
    </section>
  );
}
