import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import AskHero from "@/components/AskHero";
import HomeClient, { type HomeBundle } from "@/components/HomeClient";
import LatestMagazine, { type LatestPool } from "@/components/LatestMagazine";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "How Metatake reads — a critical map of cinema, figure by figure",
  description:
    "How Metatake reads films closely through their figures — the concrete things a film keeps returning to — and maps how those readings recur across all of cinema. Not reviews. Not ratings. Readings.",
  alternates: { canonical: "/manifesto" },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function loadBundle(): Promise<HomeBundle> {
  const supabase = db();
  // At BUILD time a throw here kills the entire deploy (observed 2026-07-11:
  // one transient DB blip failed the whole build at "prerendering /manifesto").
  // So the build gets long patient retries to ride out blips; runtime keeps the
  // short cycle, because at runtime a throw is CORRECT — Next serves the last
  // good ISR page and recovers on the next 900s regeneration.
  const building = process.env.NEXT_PHASE === "phase-production-build";
  const tries = building ? 8 : 3;
  const waitMs = building ? 2500 : 500;
  for (let i = 0; i < tries; i++) {
    const { data } = await supabase.rpc("home_bundle_cached");
    const b = data as HomeBundle | null;
    if (b && Array.isArray(b.pairs) && b.pairs.length > 0) return b;
    if (i < tries - 1) await new Promise((r) => setTimeout(r, waitMs));
  }
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
      <SiteNav />
      <AskHero readings={bundle.stats.takes} films={bundle.stats.films} />
      <HomeClient bundle={bundle} />

      {latest ? (
        <section className="home-latest">
          <div className="lt-wrap">
            <div className="home-latest-head">
              <div>
                <p className="home-latest-k">Fresh on the map</p>
                <h2 className="home-latest-h">Latest</h2>
                <p className="home-latest-s">What&apos;s newest across Metatake — fresh Strong Misreadings, tropes, directors and concepts, edited like a magazine.</p>
              </div>
              <Link className="tg-more" href="/latest">See all latest →</Link>
            </div>
            <LatestMagazine pool={latest} cap={12} />
            <div className="home-latest-foot">
              <Link className="tg-more" href="/latest">See all latest →</Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="home-about">
        <div className="lt-wrap">
          <p className="home-about-k">About Metatake</p>
          <p className="home-about-t">Metatake is an independent project mapping cinema through <b>close reading</b> — every film broken into the figures it keeps returning to and the criticism they carry, then linked by the meanings films share. Built in Seoul, edited as it grows.</p>
          <p className="home-about-cta">
            <Link href="/about">About the project →</Link>
            <Link href="/contact">Contact →</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
