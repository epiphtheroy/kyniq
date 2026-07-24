"use client";

/**
 * ExploreLinks — structural link band closing the home (전환마스터 §4.1).
 * Preserves the internal-link paths of the modules the v9 home dropped
 * (network graph, concepts rail, directors block, TV credits …) as plain
 * crawlable links: same link equity, none of the module furniture.
 */
import Link from "next/link";

const LINKS: Array<{ t: string; h: string }> = [
  { t: "What to Watch", h: "/what-to-watch" },
  { t: "TakeScore", h: "/takescore" },
  { t: "Where to watch", h: "/where-to-watch" },
  { t: "Films", h: "/film" },
  { t: "Directors", h: "/director" },
  { t: "Locations", h: "/locations" },
  { t: "Lineage", h: "/lineage" },
  { t: "Connections", h: "/network" },
  { t: "Tropes", h: "/tropes" },
  { t: "Archetypes", h: "/catalog" },
  { t: "Concepts", h: "/concept" },
  { t: "Theorists", h: "/theorist" },
  { t: "Traditions", h: "/tradition" },
  { t: "Strong Misreadings", h: "/strong-misreadings" },
  { t: "Movements", h: "/movements" },
  { t: "Credits", h: "/credits" },
  { t: "Now Playing", h: "/now" },
  { t: "The Daily", h: "/blog" },
  { t: "Metatake TV", h: "/tv" },
  { t: "My Room", h: "/room" },
];

export default function ExploreLinks() {
  return (
    <section className="band xpl">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>Explore Metatake <span className="chev">›</span></h2>
            <div className="sub">Every layer of the map, one click deep.</div>
          </div>
        </div>
        <div className="xpl-links">
          {LINKS.map((l) => (
            <Link key={l.h} className="xpl-link" href={l.h}>{l.t}</Link>
          ))}
        </div>
      </div>
    </section>
  );
}
