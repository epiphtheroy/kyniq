import { createClient } from "@/lib/supabase/server";
import MasqueradeWorkspace, { type TodayPair, type SigRow, type PairHist } from "@/components/room/MasqueradeWorkspace";
import { STR } from "@/components/room/strings";
import "./masquerade.css";

export const dynamic = "force-dynamic";

/** /room/masquerade — one masked taste partner a day (spec §3.14; replaces /room/pair).
 *  me_today_pair() is the daily-match source of truth (creating today's match is
 *  this instrument's job); the 30-day history feeds the sync trend line. */
export default async function RoomMasqueradePage() {
  const supabase = await createClient();
  const [{ data: pairRaw, error: pairErr }, { data: sigRaw }, { data: histRaw }] = await Promise.all([
    supabase.rpc("me_today_pair"),
    supabase.rpc("me_taste_signature", { p_limit: 6 }),
    supabase.rpc("me_pair_history", { p_days: 30 }),
  ]);

  if (pairErr) {
    return (
      <div className="mainpad">
        <h1 className="secttl">Masquerade</h1>
        <div className="errcard"><i className="ti ti-alert-triangle" /> {STR.common.errorLoad}</div>
      </div>
    );
  }

  const pair = (pairRaw as TodayPair | null)
    ?? { has_partner: false, reason: "forming", loved_n: 0, forming: true, candidates: 0 };
  const sig = (sigRaw as SigRow[] | null) ?? [];
  const hist = (histRaw as PairHist[] | null) ?? [];
  return <MasqueradeWorkspace initial={pair} sig={sig} hist={hist} />;
}
