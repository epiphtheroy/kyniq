"use client";

import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";
import FilmCard from "./FilmCard";
import Rail from "./Rail";

export default function Picked({ data }: { data: HomeV2 }) {
  return (
    <section className="band">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              Recommended by the map <span className="chev">›</span>
            </h2>
            <div className="sub">
              Films nearest in meaning — found by shared readings, no crowd needed
            </div>
          </div>
          <Link className="seeall" href="/lineage">
            How recommendations work ›
          </Link>
        </div>
        <Rail>
          {data.picks.map((f, i) => (
            <FilmCard key={`${f.slug}-${i}`} f={f} cat={`${f.shared} shared readings`} />
          ))}
        </Rail>
        <div className="railcount">{data.picks.length} titles — scroll ›</div>
      </div>
    </section>
  );
}
