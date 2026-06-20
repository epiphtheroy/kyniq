import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import AskHero from "@/components/AskHero";
import HomeClient, { type HomeBundle } from "@/components/HomeClient";
import LatestMagazine, { type LatestPool } from "@/components/LatestMagazine";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Metatake — a critical map of cinema, read figure by figure",
  description:
    "Metatake reads films closely through their figures — the concrete things a film keeps returning to — and maps how those readings recur across all of cinema. Not reviews. Not ratings. Readings.",
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

// Latest block at the foot of the home page. Never throws — if it can't load,
// the home simply renders without it (it must not jeopardise the main page).
async function loadLatest(): Promise<LatestPool | null> {
  try {
    const { data } = await db().rpc("latest_pool");
    const p = data as LatestPool | null;
    if (p && (p.films?.length || p.metas?.length || p.tropes?.length || p.directors?.length || p.concepts?.length || p.readings?.length)) return p;
  } catch {
    /* ignore — render home without the latest tail */
  }
  return null;
}

export default async function Home() {
  const [bundle, latest] = await Promise.all([loadBundle(), loadLatest()]);
  return (
    <div className="mt">
      <MetatakeNav />
      <AskHero readings={bundle.stats.metas} films={bundle.stats.films} />
      <HomeClient bundle={bundle} />

      {latest ? (
        <section className="home-latest">
          <div className="lt-wrap">
            <div className="home-latest-head">
              <div>
                <p className="home-latest-k">Fresh on the map</p>
                <h2 className="home-latest-h">Latest</h2>
                <p className="home-latest-s">What&apos;s newest across Metatake — fresh readings, meta takes, tropes, directors and concepts, edited like a magazine.</p>
              </div>
              <Link className="tg-more" href="/latest">See all latest →</Link>
            </div>
            <LatestMagazine pool={latest} />
            <div className="home-latest-foot">
              <Link className="tg-more" href="/latest">See all latest →</Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
