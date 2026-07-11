"use client";

import type { HomeV2 as HomeV2Data } from "@/lib/home2";

import type { ScreenerTop } from "@/app/page";
import Nav from "./Nav";
import HeroSurprise from "./HeroSurprise";
import ScreenerPromo from "./ScreenerPromo";
import MyFilmsRibbon from "./MyFilmsRibbon";
import Picked from "./Picked";
import Top10 from "./EssentialTen";
import Newly from "./Newly";
import TropeList from "./TropeList";
import ConceptTiles from "./ConceptsRail";
import LensRail from "./LensRail";
import Directors from "./DirectorsBlock";
import Auteurs from "./AuteursRow";
import Rhyme from "./Rhyme";
import Canon from "./Canon";
import BlogGraph from "./BlogGraph";
import NowPlaying from "./NowPlaying";
import HomeMap from "./HomeMap";
import HomeAtlas from "./HomeAtlas";
import BigSearch from "./BigSearch";
import SixWays from "./SixWays";
import SiteFooter from "./SiteFooter";

/**
 * v7 home, ported faithfully from metatake-home-mockup-v7.html.
 * 16 sections in mockup order with the paper / dark / paper-2 band rhythm.
 * Everything renders inside a single .mthome scope so app/home2.css applies.
 */
export default function HomeV2({ data, screenerTop = [] }: { data: HomeV2Data; screenerTop?: ScreenerTop[] }) {
  return (
    <div className="mthome">
      {/* 1 — Nav (dark, sticky) */}
      <Nav counts={data.stats} />
      {/* 2 — Surprise me hero (dark): random draw + red space-bar + text panel */}
      <HeroSurprise />
      {/* 2a — The Screener: flagship entry into /takescore (dark), featured high */}
      <ScreenerPromo rows={screenerTop} />
      {/* 2b — My Films lens ribbon (client-personalised, server HTML identical) */}
      <MyFilmsRibbon />
      {/* 2c — Now Playing: the live layer, featured big (renders nothing until the first piece) */}
      <NowPlaying />
      {/* 3 — Recommended by the map (paper) */}
      <Picked data={data} />
      {/* 4 — The essential 10 (dark) */}
      <Top10 data={data} />
      {/* 5 — Newly mapped (dark) */}
      <Newly data={data} />
      {/* 6 — The widest readings (paper-2) */}
      <TropeList data={data} />
      {/* 7 — Popular concepts (paper) */}
      <ConceptTiles data={data} />
      {/* 8 — Explore by lens (dark) */}
      <LensRail data={data} />
      {/* 8b — The living map of cinema (paper-2) */}
      <HomeMap />
      {/* 8c — The geographic Atlas (satellite) */}
      <HomeAtlas />
      {/* 9 — Directors spotlight + cards (paper-2) */}
      <Directors data={data} />
      {/* 10 — Auteurs to explore (dark) */}
      <Auteurs data={data} />
      {/* 11 — Films that rhyme (paper) */}
      <Rhyme data={data} />
      {/* 12 — Recommended by (canon + guide) (paper-2) */}
      <Canon data={data} />
      {/* 13 — Between Film and the World + live node graph (paper-2) */}
      <BlogGraph />
      {/* 14 — Search the map (paper-2) */}
      <BigSearch data={data} />
      {/* 15 — Six ways in (paper) */}
      <SixWays data={data} />
      {/* 16 — Footer (dark) */}
      <SiteFooter />
    </div>
  );
}
