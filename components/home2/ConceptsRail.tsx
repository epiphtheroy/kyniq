"use client";

import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";
import { hashTone, tone, conceptHref, backdropUrl } from "./helpers";
import Rail from "./Rail";

export default function ConceptTiles({ data }: { data: HomeV2 }) {
  return (
    <section className="band">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              Popular concepts <span className="chev">›</span>
            </h2>
            <div className="sub">The critical ideas cinema returns to · a film still per tile</div>
          </div>
          <Link className="seeall" href="/concept">
            All concepts ›
          </Link>
        </div>
        <Rail>
          {data.concepts.map((c) => (
            <Link className="tile" href={conceptHref(c.slug)} key={c.name}>
              <div className="img" style={{ background: tone(hashTone(c.name)) }}>
                {backdropUrl(c.backdrop) ? (
                  <img src={backdropUrl(c.backdrop)!} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : null}
                <span className="addcirc">+</span>
                <div className="lab">
                  <div className="l1">{c.name}</div>
                  <div className="l2">{c.n} films</div>
                </div>
              </div>
            </Link>
          ))}
        </Rail>
        <div className="railcount">{data.concepts.length} concepts — scroll ›</div>
      </div>
    </section>
  );
}
