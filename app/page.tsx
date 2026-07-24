import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import HomeV2 from "@/components/home2/HomeV2";
import { PLACEHOLDER, type HomeV2 as HomeV2Data } from "@/lib/home2";
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
  // Companion positioning (전환마스터 §0): lead with the decision value; the
  // critical map stays as the underlying method, not the headline.
  title: { absolute: "Metatake — The Cinephile's Companion" },
  description:
    "What should you watch tonight? Films scored for durable value (TakeScore), filtered to your streaming services — then understood: meanings, shooting locations, and the patterns they share. Your watch history as one map.",
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
  // 2 attempts max: under DB stress, retries amplify the stampede (observed in
  // the 2026-07-11 restart). One quick retry covers transient blips; anything
  // worse should fail fast into PLACEHOLDER and let the stale cache carry us.
  for (let i = 0; i < 2; i++) {
    try {
      const { data } = await db().rpc("home_v2_bundle_v3", { p_seed: seed });
      const b = data as HomeV2Data | null;
      if (b && Array.isArray(b.picks) && b.picks.length > 0 && b.stats?.films) return b;
    } catch {
      /* retry */
    }
    if (i < 1) await new Promise((r) => setTimeout(r, 300));
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

// (v9 companion home: the daily-exhibits and readings-desk loaders left with
//  their bands — HANDOFF-동반자-전환-마스터.md §4. Their RPCs remain in the DB;
//  restore from git history if a band ever returns.)

export default async function Home() {
  const [data, screenerTop] = await Promise.all([loadV2(), getScreenerTop()]);
  return <HomeV2 data={data} screenerTop={screenerTop} />;
}
