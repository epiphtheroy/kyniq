import { createClient } from "@/lib/supabase/server";
import RateWorkspace, { type RateStats, type RecentRow, type SigRow } from "@/components/room/RateWorkspace";
import "./rate.css";

export const dynamic = "force-dynamic";

export default async function RoomRatePage() {
  const supabase = await createClient();
  const [{ data: statsRaw }, { data: recentRaw }, { data: sigRaw }] = await Promise.all([
    supabase.rpc("me_rate_stats"),
    supabase.rpc("me_recent_ratings", { p_limit: 40 }),
    supabase.rpc("me_taste_signature", { p_limit: 6 }),
  ]);
  const stats = ((statsRaw as RateStats[] | null) ?? [])[0]
    ?? { rated: 0, loved: 0, seen: 0, watchlist: 0, session_new: 0, forming: true, loved_target: 8 };
  const recent = (recentRaw as RecentRow[] | null) ?? [];
  const sig = (sigRaw as SigRow[] | null) ?? [];
  return <RateWorkspace stats={stats} recent={recent} sig={sig} />;
}
