"use client";

import Link from "next/link";
import type { HomeV2, TropeRow } from "@/lib/home2";
import { tropeHref } from "./helpers";

// Mockup: title.replace(/(Ethical|Imperative|...)/, '<em>$1</em>') — wrap one keyword.
const EM = /(Ethical|Imperative|Repeat|Mourned|Evil|Witness|Confession|Ritual)/;
function emphasize(title: string): React.ReactNode {
  const m = title.match(EM);
  if (!m || m.index == null) return title;
  const i = m.index;
  return (
    <>
      {title.slice(0, i)}
      <em>{m[0]}</em>
      {title.slice(i + m[0].length)}
    </>
  );
}

export default function TropeList({ data }: { data: HomeV2 }) {
  return (
    <section className="band p2">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              The widest readings <span className="chev">›</span>
            </h2>
            <div className="sub">One reading, shared across the most films — the busiest lines on the map</div>
          </div>
          <Link className="seeall" href="/tropes">
            All {data.stats.tropes.toLocaleString()} tropes ›
          </Link>
        </div>
        <div className="bo" id="bo">
          {data.tropes.map((t: TropeRow, i) => (
            <Link className="li" href={tropeHref(t.slug)} key={`${t.title}-${i}`} style={{ display: "flex" }}>
              <div className="num">{t.rank ?? i + 1}</div>
              <div className="addc">+</div>
              <div className="bd2">
                <div className="tt">{emphasize(t.title)}</div>
                <div className="mt">{t.pair}</div>
              </div>
              <div className="delta flat">{t.n} films</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
