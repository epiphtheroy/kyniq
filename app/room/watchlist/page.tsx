import { createClient } from "@/lib/supabase/server";
import WatchlistWorkspace, { type WwiRow } from "@/components/room/WatchlistWorkspace";

export const dynamic = "force-dynamic";

export default async function RoomWatchlistPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("me_recommend_wwi", { p_lambda: 1.0, p_limit: 40 });
  const rows = (data as WwiRow[] | null) ?? [];
  return <WatchlistWorkspace rows={rows} />;
}
