"use client";

import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";
import FilmCard from "./FilmCard";
import Rail from "./Rail";

export default function Rhyme({ data }: { data: HomeV2 }) {
  const { seed, films } = data.rhyme;
  return (
    <section className="band">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              Films that <em>rhyme</em> <span className="chev">›</span>
            </h2>
            <div className="sub">
              Because you opened <b>{seed}</b>
            </div>
          </div>
          <Link className="seeall" href="/lineage">
            Wander further ›
          </Link>
        </div>
        <Rail>
          {films.map((f, i) => (
            <FilmCard
              key={`${f.slug}-${i}`}
              f={f}
              cat={`${f.shared} shared readings`}
            />
          ))}
        </Rail>
        <div className="railcount">{films.length} titles — scroll ›</div>
      </div>
    </section>
  );
}
