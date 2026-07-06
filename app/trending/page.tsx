import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import LensQuickBar from "@/components/LensQuickBar";
import TrendingSections, { type TrendPool } from "@/components/TrendingSections";

// Reading ?window forces this route to render dynamically, so `revalidate`
// alone can't cache it — every request re-ran the ~1.3s trending_pool RPC.
// Cache the RPC result per window value (only "week" | "all") in the Data
// Cache instead; tagged "trending" for on-demand refresh via /api/revalidate.
export const revalidate = 600;

const getTrendingPool = (win: "week" | "all") =>
  unstable_cache(
    async () => {
      const { data } = await db().rpc("trending_pool", { p_window: win });
      return (data as TrendPool | null) ?? { metas: [], takes: [], tropes: [], films: [] };
    },
    ["trending-pool", win],
    { revalidate: 600, tags: ["trending"] },
  )();

export const metadata: Metadata = {
  title: "Trending — the readings drawing the most attention",
  description:
    "The Strong Misreadings, tropes and films drawing the most attention on Metatake — shown through the films and figures that carry them.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function TrendingPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const sp = await searchParams;
  const win: "week" | "all" = sp.window === "week" ? "week" : "all";
  const pool = await getTrendingPool(win);

  const now = new Date();
  const TZ = "Asia/Seoul";
  const wd = now.toLocaleDateString("en-US", { weekday: "long", timeZone: TZ }).toUpperCase();
  const md = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: TZ }).toUpperCase();

  return (
    <div className="mt">
      <SiteNav />
      <div className="lt-wrap">
        <div className="lt-edition">
          <span className="date">{wd} · {md}</span>
          <span className="tag">A critical map of cinema — edited as it grows</span>
        </div>

        <div className="lt-h1row">
          <h1 className="lt-h1">Trending</h1>
          <span className="lt-toggle">
            <Link href="/latest">Latest</Link>
            <a data-on>Trending</a>
          </span>
        </div>
        <p className="lt-subline">The readings and tropes drawing the most attention — shown through the films and figures that carry them.</p>
        <LensQuickBar />

        <div className="tg-twin">
          <span className="lbl">Window</span>
          <Link href="/trending?window=week" data-on={win === "week" ? "" : undefined}>This week</Link>
          <Link href="/trending" data-on={win === "all" ? "" : undefined}>All time</Link>
        </div>
        <p className="tg-note">
          {win === "week"
            ? "Ranked by views in the last 7 days, with likes and connectedness as a baseline — real-time data sharpens as the site is used."
            : "Ranked by views and likes, with connectedness as a baseline — four areas, each in rank order, shown through the films & figures that carry them."}
        </p>

        <TrendingSections pool={pool} />
      </div>
    </div>
  );
}
