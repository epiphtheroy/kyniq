import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import TrendingSections, { type TrendPool } from "@/components/TrendingSections";

export const revalidate = 600;

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
  const win = sp.window === "week" ? "week" : "all";
  const supabase = db();
  const { data } = await supabase.rpc("trending_pool", { p_window: win });
  const pool = (data as TrendPool | null) ?? { metas: [], takes: [], tropes: [], films: [] };

  const now = new Date();
  const wd = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const md = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase();

  return (
    <div className="mt">
      <MetatakeNav active="trending" />
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
