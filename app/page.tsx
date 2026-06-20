import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import AskHero from "@/components/AskHero";
import HomeClient, { type HomeBundle } from "@/components/HomeClient";
import TrendingSections, { type TrendPool } from "@/components/TrendingSections";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Metatake — the unconscious lines between films",
  description:
    "A large-scale AI project that uses embeddings to map the unconscious lines between films — two films you'd never shelve together, and the reading they secretly share. Not reviews. Not ratings. Readings.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function loadBundle(): Promise<HomeBundle> {
  const supabase = db();
  for (let i = 0; i < 3; i++) {
    const { data } = await supabase.rpc("home_bundle");
    const b = data as HomeBundle | null;
    if (b && Array.isArray(b.pairs) && b.pairs.length > 0) return b;
    if (i < 2) await new Promise((r) => setTimeout(r, 500));
  }
  // Persistent empty/timeout (e.g. DB under heavy write load): throw so Next keeps
  // serving the last good statically-generated page instead of caching an empty one
  // (no featured pair, zero stats). It recovers automatically on the next good render.
  throw new Error("home_bundle returned empty after retries");
}

// Trending block at the foot of the home page. Never throws — if it can't load,
// the home simply renders without it (it must not jeopardise the main page).
async function loadTrending(): Promise<TrendPool | null> {
  try {
    const { data } = await db().rpc("trending_pool", { p_window: "all" });
    const p = data as TrendPool | null;
    if (p && (p.metas?.length || p.films?.length || p.tropes?.length || p.takes?.length)) return p;
  } catch {
    /* ignore — render home without the trending tail */
  }
  return null;
}

export default async function Home() {
  const [bundle, trend] = await Promise.all([loadBundle(), loadTrending()]);
  return (
    <div className="mt">
      <MetatakeNav />
      <AskHero readings={bundle.stats.metas} films={bundle.stats.films} />
      <HomeClient bundle={bundle} />

      {trend ? (
        <section className="home-trend">
          <div className="lt-wrap">
            <div className="home-trend-head">
              <div>
                <p className="home-trend-k">Live on the map</p>
                <h2 className="home-trend-h">Trending now</h2>
                <p className="home-trend-s">The readings, tropes and films drawing the most attention — shown through the films and figures that carry them.</p>
              </div>
              <Link className="tg-more" href="/trending">See all trending →</Link>
            </div>
            <TrendingSections pool={trend} />
            <div className="home-trend-foot">
              <Link className="tg-more" href="/trending">See all trending →</Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
