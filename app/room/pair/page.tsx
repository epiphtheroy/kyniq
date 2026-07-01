import { createClient } from "@/lib/supabase/server";
import PairWorkspace, { type PairState, type SigRow } from "@/components/room/PairWorkspace";
import "./pair.css";

export const dynamic = "force-dynamic";

export default async function RoomPairPage() {
  const supabase = await createClient();
  const [{ data: stateRaw }, { data: sigRaw }] = await Promise.all([
    supabase.rpc("me_pair_state"),
    supabase.rpc("me_taste_signature", { p_limit: 6 }),
  ]);
  const state = ((stateRaw as PairState[] | null) ?? [])[0]
    ?? { candidates: 0, loved_n: 0, forming: true };
  const sig = (sigRaw as SigRow[] | null) ?? [];
  return <PairWorkspace state={state} sig={sig} />;
}
