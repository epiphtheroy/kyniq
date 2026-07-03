import { createClient } from "@/lib/supabase/server";
import HomeWorkspace, {
  type HomeData, type NavJson, type RateStats, type WwiRow, type CovRow, type RecentRow,
} from "@/components/room/HomeWorkspace";

export const dynamic = "force-dynamic";

/** /room 홈 v2 — "오늘" 페이지. 5 RPC 병렬 로드 → HomeWorkspace(클라이언트). */
export default async function RoomHome() {
  const supabase = await createClient();

  const [nav, stats, recs, cov, recent] = await Promise.all([
    supabase.rpc("me_portfolio_nav"),
    supabase.rpc("me_rate_stats"),
    supabase.rpc("me_recommend_wwi", { p_lambda: 1.0, p_limit: 24 }),
    supabase.rpc("me_coverage", { p_min_total: 5, p_limit: 300 }),
    supabase.rpc("me_recent_ratings", { p_limit: 12 }),
  ]);

  const data: HomeData = {
    nav: (nav.data as NavJson) ?? null,
    stats: ((stats.data as RateStats[] | null) ?? [])[0] ?? null,
    recs: (recs.data as WwiRow[] | null) ?? [],
    coverage: (cov.data as CovRow[] | null) ?? [],
    recent: (recent.data as RecentRow[] | null) ?? [],
  };

  return <HomeWorkspace data={data} />;
}
