"use client";

import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";
import { hashTone, tone, initials, directorHref, profileUrl } from "./helpers";
import Rail from "./Rail";

export default function Auteurs({ data }: { data: HomeV2 }) {
  return (
    <section className="band dark">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              Auteurs to explore <span className="chev">›</span>
            </h2>
            <div className="sub">Follow a director and new readings come to you · per portrait: films on the map</div>
          </div>
          <Link className="seeall" href="/director">
            All {data.stats.directors} directors ›
          </Link>
        </div>
        <Rail variant="born">
          {data.auteurs.map((p) => (
            <Link className="bp" href={directorHref(p.slug)} key={p.slug}>
              <div className="av" style={{ background: tone(hashTone(p.slug)) }}>
                {profileUrl(p.image) ? (
                  <img src={profileUrl(p.image)!} alt={`${p.name} portrait`} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div className="di">{initials(p.name)}</div>
                )}
                <div className="hrt" title="Follow">
                  ♡
                </div>
              </div>
              <div className="nm">{p.name}</div>
              <div className="ag">{p.films} films</div>
            </Link>
          ))}
        </Rail>
      </div>
    </section>
  );
}
