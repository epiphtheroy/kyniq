import { createClient } from "@/lib/supabase/server";
import PairWorkspace, { type TodayPair, type SigRow, type PairHist } from "@/components/room/PairWorkspace";
import "./pair.css";

export const dynamic = "force-dynamic";

export default async function RoomPairPage() {
  const supabase = await createClient();
  const [{ data: pairRaw }, { data: sigRaw }, { data: histRaw }] = await Promise.all([
    supabase.rpc("me_today_pair"),
    supabase.rpc("me_taste_signature", { p_limit: 6 }),
    supabase.rpc("me_pair_history", { p_days: 7 }),
  ]);
  const pair = (pairRaw as TodayPair | null)
    ?? { has_partner: false, reason: "forming", loved_n: 0, forming: true, candidates: 0 };
  const sig = (sigRaw as SigRow[] | null) ?? [];
  const hist = (histRaw as PairHist[] | null) ?? [];
  return <PairWorkspace initial={pair} sig={sig} hist={hist} />;
}
