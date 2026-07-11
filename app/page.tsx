import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import HomeV2 from "@/components/home2/HomeV2";
import { PLACEHOLDER, type HomeV2 as HomeV2Data, type Exhibits } from "@/lib/home2";
import "@/app/home2.css";

// The home bundle changes ~nightly, so there is no reason to re-run the ~1.4s
// home_v2_bundle_v2 RPC (311 KB payload) on every request. Serve a statically
// prerendered, edge-cached page and refresh it via ISR. Freshness is covered
// three ways: hourly time-based revalidation, every deploy (frequent), and the
// nightly publisher hitting /api/revalidate with path "/" + tag "home-v2".
// The RPC is a POST, which Next's fetch cache never caches, so we wrap the call
// in unstable_cache to persist the result in the Data Cache across requests.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Metatake — a critical map of cinema",
  description:
    "Read films closely — a critical map of cinema that links films through the readings they share. Strong Misreadings, tropes, directors, concepts and the canon, all on one map.",
  alternates: {
    canonical: "/",
    // Page-level alternates shallow-replace the layout's, so the RSS
    // autodiscovery link must be repeated here or the homepage loses it.
    types: { "application/rss+xml": [{ url: "/feed.xml", title: "Between Film and the World — Metatake" }] },
  },
};

// Plain client — caching is governed entirely by the unstable_cache wrapper
// below, so no per-fetch cache override is needed here (and `no-store` inside
// unstable_cache only triggers Next warnings).
function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Real home bundle from home_v2_bundle_v3(p_seed). The seed (UTC YYYYMMDDHH)
// rotates the featured cards hourly while staying deterministic within the hour,
// so the edge-cached HTML is consistent. Throws on total failure so a transient
// empty read is NOT written into the Data Cache (unstable_cache does not cache
// thrown errors); the caller falls back to PLACEHOLDER instead.
async function fetchBundle(seed: string): Promise<HomeV2Data> {
  for (let i = 0; i < 3; i++) {
    try {
      const { data } = await db().rpc("home_v2_bundle_v3", { p_seed: seed });
      const b = data as HomeV2Data | null;
      if (b && Array.isArray(b.picks) && b.picks.length > 0 && b.stats?.films) return b;
    } catch {
      /* retry */
    }
    if (i < 2) await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("home_v2_bundle_v3 returned no usable data");
}

// CONSTANT cache key + hour seed captured at regeneration time. The key must
// NOT contain the seed: a per-hour key means no stale entry exists at the hour
// boundary, so every concurrent request blocks on the live RPC (the stampede
// that helped push the DB over on 2026-07-11). With one key, unstable_cache
// serves the STALE hour while ONE background regeneration picks up the new
// seed — rotation still lands hourly, with zero request-blocking.
async function loadV2(): Promise<HomeV2Data> {
  const getCached = unstable_cache(
    () => {
      const seed = new Date().toISOString().slice(0, 13).replace(/[-T]/g, ""); // YYYYMMDDHH, UTC — evaluated when the cache entry regenerates
      return fetchBundle(seed);
    },
    ["home-v2-bundle-v3"],
    { revalidate: 3600, tags: ["home-v2"] },
  );
  try {
    return await getCached();
  } catch {
    return PLACEHOLDER;
  }
}

// Top TakeScores for the Screener promo strip (SSR'd, no flash). Cached hourly
// with the rest of the home; a tiny slice of the same cinecodex_ranked the
// Screener itself serves.
export type ScreenerTop = { slug: string; title: string; year: number | null; poster_path: string | null; u: number };
const getScreenerTop = unstable_cache(
  async (): Promise<ScreenerTop[]> => {
    try {
      const { data } = await db().rpc("cinecodex_ranked", { p_sort: "u", p_lambda: 1.0, p_limit: 14, p_offset: 0 });
      return (((data as { rows?: ScreenerTop[] } | null)?.rows) ?? []).map((r) => ({
        slug: r.slug, title: r.title, year: r.year, poster_path: r.poster_path, u: r.u,
      }));
    } catch { return []; }
  },
  ["home-screener-top-1"],
  { revalidate: 3600 },
);

// "Today at Metatake" band — one sample per content layer, held a full day
// (YYYYMMDD seed) then rotated. Its own Data-Cache entry per day; never blocks
// the home (null on any failure → the band self-omits).
async function loadExhibits(): Promise<Exhibits> {
  // Constant key for the same anti-stampede reason as loadV2; the day seed is
  // read at regeneration time, so the band still flips on the UTC day change.
  const getEx = unstable_cache(
    async (): Promise<Exhibits> => {
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD, UTC
      try {
        const { data } = await db().rpc("home_daily_exhibits", { p_seed: day });
        return (data as Exhibits) ?? null;
      } catch {
        return null;
      }
    },
    ["home-exhibits"],
    { revalidate: 3600, tags: ["home-v2"] },
  );
  return getEx();
}

export default async function Home() {
  const [data, screenerTop, exhibits] = await Promise.all([loadV2(), getScreenerTop(), loadExhibits()]);
  return <HomeV2 data={data} screenerTop={screenerTop} exhibits={exhibits} />;
}
