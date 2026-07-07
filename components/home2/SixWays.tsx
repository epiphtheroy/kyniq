"use client";

import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";

export default function SixWays({ data }: { data: HomeV2 }) {
  const { stats } = data;
  return (
    <section className="band">
      <div className="wrap">
        <div className="shead">
          <div>
            <span className="kicker">Start anywhere</span>
            <h2 style={{ marginTop: 8 }}>Six ways in</h2>
          </div>
        </div>
        <div className="facetgrid">
          <Link className="facet" href="/film">
            <div className="fk">{stats.films.toLocaleString()} films</div>
            <h3>Films</h3>
            <p>Every film, broken into the figures it keeps returning to.</p>
            <span className="go">Browse films →</span>
          </Link>
          <Link className="facet" href="/director">
            <div className="fk">{stats.directors.toLocaleString()} auteurs</div>
            <h3>Directors</h3>
            <p>Signature readings and tropes that recur across a filmography.</p>
            <span className="go">Browse directors →</span>
          </Link>
          <Link className="facet" href="/tropes">
            <div className="fk">{stats.tropes.toLocaleString()} figure-types</div>
            <h3>Tropes</h3>
            <p>The shapes cinema keeps reaching for — the hubs of the map.</p>
            <span className="go">Browse tropes →</span>
          </Link>
          <Link className="facet" href="/strong-misreadings">
            <div className="fk">{stats.readings.toLocaleString()} readings</div>
            <h3>Strong Misreadings</h3>
            <p>The bold close readings — one figure, argued through a critical framework.</p>
            <span className="go">Browse readings →</span>
          </Link>
          <Link className="facet" href="/concept">
            <div className="fk">{stats.concepts.toLocaleString()} concepts</div>
            <h3>Concepts</h3>
            <p>The critical ideas every reading is built on, traced across cinema.</p>
            <span className="go">Browse concepts →</span>
          </Link>
          <Link className="facet" href="/lineage">
            <div className="fk">{stats.lists} canon lists</div>
            <h3>Lineage</h3>
            <p>Follow a film across the canon — Sight &amp; Sound, Palme d&apos;Or, Best Picture and more.</p>
            <span className="go">Follow a lineage →</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
