"use client";

import Link from "next/link";
import SurpriseStage from "./SurpriseStage";

// Home hero — "Surprise me". Wraps the shared SurpriseStage (a random analyzed
// film seen through one curated lens: Strong Misreading, the film's / director's
// map, a figure across films, watch-next, recommended-by, why-watch, where-to-
// start, who's-next, plus the newer lenses — what critics said, the record it
// holds, a question people ask, where it takes place, the film through one
// theorist, and its whole Strong-Misreadings article) in the dark hero band, and
// adds the topic-chip rail beneath. The stage self-advances every 14s here.
export default function HeroSurprise() {
  return (
    <div className="hero">
      <div className="wrap">
        <SurpriseStage auto />

        <div className="topicchips">
          <Link className="tc" href="/strong-misreadings">Strong Misreadings <span className="ch">›</span></Link>
          <Link className="tc" href="/search?q=grief">Films about grief <span className="ch">›</span></Link>
          <Link className="tc" href="/director">Auteur fingerprints <span className="ch">›</span></Link>
          <Link className="tc" href="/network">The whole web <span className="ch">›</span></Link>
          <Link className="tc" href="/concept">The Real (le réel) <span className="ch">›</span></Link>
        </div>
      </div>
    </div>
  );
}
