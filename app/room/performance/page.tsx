import { createClient } from "@/lib/supabase/server";
import { loadWwi, loadCollection } from "@/lib/room/loadCollection";
import type { WwiRow, CollRow, NavHistRow } from "@/lib/room/format";
import PerformanceWorkspace, {
  type PerformanceData, type NavJson, type AlphaJson,
} from "@/components/room/PerformanceWorkspace";
import "./performance.css";

export const dynamic = "force-dynamic";

/** /room/performance — Performance instrument (spec §3.6).
 *  Four parallel reads; a failed read passes null so the workspace renders the
 *  shared .errcard for that module instead of silently showing empty data. */
export default async function RoomPerformancePage() {
  const supabase = await createClient();

  const [navRes, histRes, alphaRes, movers] = await Promise.all([
    supabase.rpc("me_portfolio_nav"),
    supabase.rpc("me_nav_history", { p_days: 365 }), // ≤366 rows — under the 1000-row cap
    supabase.rpc("me_takescore_summary"),
    loadWwi(1.0, 40).then((r): WwiRow[] | null => r, (): WwiRow[] | null => null),
  ]);

  const nav = navRes.error ? null : ((navRes.data as NavJson | null) ?? null);
  const hist = histRes.error ? null : ((histRes.data as NavHistRow[] | null) ?? []);
  const alpha = alphaRes.error ? null : ((alphaRes.data as AlphaJson | null) ?? null);

  /* Enrich Alpha's best/riskiest with their full me_collection rows so their
     inspectors can fill the never-blend CinecodexCard (poster, V/C/R/U, external
     signals, my ★) without a new RPC. loadCollection() is React-cached per
     request and .range()-chunked (1000-row-cap safe). */
  let best: CollRow | null = null;
  let riskiest: CollRow | null = null;
  const bestSlug = alpha?.best?.slug ?? null;
  const riskSlug = alpha?.riskiest?.slug ?? null;
  if (bestSlug || riskSlug) {
    try {
      const coll = await loadCollection();
      best = coll.find((r) => r.slug === bestSlug) ?? null;
      riskiest = coll.find((r) => r.slug === riskSlug) ?? null;
    } catch {
      /* Inspector falls back to the honest slug-only view + appraisal link. */
    }
  }

  const data: PerformanceData = { nav, hist, alpha, movers, best, riskiest };
  return <PerformanceWorkspace data={data} />;
}
