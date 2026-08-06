"use client";

import type { HomeV2 as HomeV2Data } from "@/lib/home2";

import type { ScreenerTop } from "@/app/page";
import Nav from "./Nav";
import DecisionHero from "./DecisionHero";
import MyFilmsRibbon from "./MyFilmsRibbon";
import JustWatched from "./JustWatched";
import MyCinemaTeaser from "./MyCinemaTeaser";
import SurpriseStage from "./SurpriseStage";
import HomeLocations from "./HomeLocations";
import NowPlaying from "./NowPlaying";
import HomeNetwork from "./HomeNetwork";
import ExploreLinks from "./ExploreLinks";

/**
 * v9 home — the companion front door (HANDOFF-동반자-전환-마스터.md §4).
 * Sections follow the watch cycle: Decide (hero) → Understand (just watched)
 * → Journey (My Cinema + app) → one editorial rotation (Surprise) → the
 * locations wedge → the live news strip → a flat explore-links band that keeps
 * the crawl paths of every module the v7 "world's fair" home used to render.
 * Design charter §4.3: three layout grammars only (poster rail + TS chip,
 * list row, single feature); information dense, decoration light.
 */
export default function HomeV2({ data, screenerTop = [] }: { data: HomeV2Data; screenerTop?: ScreenerTop[] }) {
  return (
    <div className="mthome">
      {/* 1 — Nav (dark, sticky) */}
      <Nav counts={data.stats} />
      {/* 2 — Decide: what should I watch tonight? (dark) */}
      <DecisionHero rows={screenerTop} />
      {/* 2a — My Films lens ribbon (client-personalised, server HTML identical) */}
      <MyFilmsRibbon />
      {/* 3 — Understand: just watched something? (paper) */}
      <JustWatched />
      {/* 4 — Journey: My Room + the app (paper-2) */}
      <MyCinemaTeaser />
      {/* 5 — The one editorial rotation: Surprise me (dark hero band) */}
      <section id="surprise" className="hero surpband" aria-label="Surprise me">
        <div className="wrap">
          <div className="surp-head">Or — surprise me</div>
          <SurpriseStage auto />
        </div>
      </section>
      {/* 6 — The locations wedge (satellite) */}
      <HomeLocations />
      {/* 7 — Now Playing: the live layer (renders nothing until the first piece) */}
      <NowPlaying />
      {/* 7b — The connection map, Grouped (paper-2). Lazy-mounted below the fold:
              the graph never competes with first paint. */}
      <HomeNetwork />
      {/* 8 — Explore: flat crawlable links (paper) */}
      <ExploreLinks />
      {/* Footer is rendered globally by app/layout.tsx (single unified site footer) */}
    </div>
  );
}
