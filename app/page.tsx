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

// Real home bundle from home_v2_bundle_v2(). Throws on total failure so a
// transient empty read is NOT written into the Data Cache (unstable_cache does
// not cache thrown errors); the caller falls back to PLACEHOLDER instead.
async function fetchBundle(): Promise<HomeV2Data> {
  for (let i = 0; i < 3; i++) {
    try {
      const { data } = await db().rpc("home_v2_bundle_v2");
      const b = data as HomeV2Data | null;
      if (b && Array.isArray(b.picks) && b.picks.length > 0 && b.stats?.films) return b;
    } catch {
      /* retry */
    }
    if (i < 2) await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("home_v2_bundle_v2 returned no usable data");
}

// Persist the RPC result in the Data Cache. Tagged "home-v2" so the publisher
// can force an immediate refresh via revalidateTag; also refreshed hourly.
const getCachedBundle = unstable_cache(fetchBundle, ["home-v2-bundle-v2"], {
  revalidate: 3600,
  tags: ["home-v2"],
});

// Falls back to PLACEHOLDER so the home never renders empty under DB write-load.
async function loadV2(): Promise<HomeV2Data> {
  try {
    return await getCachedBundle();
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

export default async function Home() {
  const [data, screenerTop] = await Promise.all([loadV2(), getScreenerTop()]);
  return <HomeV2 data={data} screenerTop={screenerTop} />;
}
