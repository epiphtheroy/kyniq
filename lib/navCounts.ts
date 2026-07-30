import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { NavCounts } from "@/components/home2/Nav";

/**
 * Nav counts, cached.
 *
 * nav_counts() was the third-heaviest thing in the database: 2,498 calls for
 * 1,607 seconds (2026-07-30 pg_stat_statements). Not because it is slow —
 * 643ms — but because SiteNav sits on every non-home page and ran it on every
 * render, while SiteNavClient ran it again from each visitor's browser.
 *
 * These are catalogue totals ("how many films, how many directors"). They move
 * when the factory ingests, which is on the order of days — so an hour of
 * staleness is invisible to a reader and removes essentially all of the load.
 *
 * Errors are thrown, never cached as {}: caching a failure would freeze the nav
 * into arrows-without-numbers for the whole revalidate window (the null-poison
 * trap this codebase has hit before).
 */
export function getNavCounts(): Promise<NavCounts> {
  return unstable_cache(
    async () => {
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data, error } = await db.rpc("nav_counts");
      if (error) throw error;
      return (data ?? {}) as NavCounts;
    },
    ["nav-counts-v1"],
    { revalidate: 3600 },
  )();
}
