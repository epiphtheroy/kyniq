import "./desk.css";
import { createClient } from "@/lib/supabase/server";
import DeskWorkspace, { type DeskData, type WwiRow, type WatchedRow, type TakeSummary, type NavPoint } from "@/components/room/DeskWorkspace";

export const dynamic = "force-dynamic";

export default async function RoomDeskPage() {
  const supabase = await createClient();

  const [{ data: recsRaw }, { data: watchedRaw }, { data: summaryRaw }, { data: navHistRaw }] = await Promise.all([
    supabase.rpc("me_recommend_wwi", { p_lambda: 1.0, p_limit: 48 }),
    supabase.rpc("me_watched_scored"),
    supabase.rpc("me_takescore_summary"),
    supabase.rpc("me_nav_history", { p_days: 180 }),
  ]);

  const data: DeskData = {
    recs: (recsRaw as WwiRow[] | null) ?? [],
    watched: (watchedRaw as WatchedRow[] | null) ?? [],
    summary: (summaryRaw as TakeSummary) ?? null,
    navHistory: (navHistRaw as NavPoint[] | null) ?? [],
  };

  return <DeskWorkspace data={data} />;
}
