"use client";

import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";
import FilmCard from "./FilmCard";
import Rail from "./Rail";
import { filmHref, directorHref } from "./helpers";

export default function Canon({ data }: { data: HomeV2 }) {
  const { canon, guide, stats } = data;
  return (
    <section className="band p2">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              Recommended by <span className="chev">›</span>
            </h2>
            <div className="sub">
              Not by clicks — by the canon lists and the directors that vouch for a film · per card: ★ IMDb · canon lists
            </div>
          </div>
          <Link className="seeall" href="/lineage">
            All {stats.lists} lists ›
          </Link>
        </div>
        <Rail>
          {canon.map((f, i) => (
            <FilmCard key={`${f.slug}-${i}`} f={f} cat={`${f.lists} canon lists`} sub="▤ On the canon" />
          ))}
        </Rail>
        <div className="railcount">
          On the canon — Sight &amp; Sound · Palme d&apos;Or · Best Picture · Golden Lion · TSPDT 1,000 Greatest · and{" "}
          {Math.max(0, stats.lists - 5)} more lists
        </div>
        <div className="apath">
          <div className="apath-h">
            A way into <em>{guide.director}</em> — a guided path
          </div>
          <div className="apath-row" id="apath">
            {guide.steps.map((p, i) => {
              const inner = (
                <>
                  <div className="lab">{p.label}</div>
                  <div className="ti">{p.title}</div>
                  <div className="yr">{p.year ?? ""}</div>
                  <div className="rs">{p.reason}</div>
                </>
              );
              return p.slug ? (
                <Link className="apk" href={filmHref(p.slug)} key={i}>
                  {inner}
                </Link>
              ) : (
                <Link className="apk" href={directorHref(guide.slug)} key={i}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
