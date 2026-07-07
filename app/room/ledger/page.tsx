import "./ledger.css";
import { createClient } from "@/lib/supabase/server";
import { loadCollection } from "@/lib/room/loadCollection";
import { STR } from "@/components/room/strings";
import LedgerWorkspace, { type RateStats } from "@/components/room/LedgerWorkspace";
import type { CollRow } from "@/lib/room/format";

export const dynamic = "force-dynamic";

/** Ledger — the complete rating record (spec §3.4). Entries come from the full
 *  me_collection via loadCollection() (.range() chunks — 1000-row-cap safe);
 *  the stats row comes from me_rate_stats. RPC failures render the shared
 *  error card instead of a silently empty ledger. */
export default async function RoomLedgerPage() {
  const supabase = await createClient();
  let stats: RateStats;
  let rows: CollRow[];
  try {
    const [statsRes, coll] = await Promise.all([
      supabase.rpc("me_rate_stats"),
      loadCollection(),
    ]);
    if (statsRes.error) throw new Error(`me_rate_stats: ${statsRes.error.message}`);
    stats = ((statsRes.data as RateStats[] | null) ?? [])[0]
      ?? { rated: 0, loved: 0, seen: 0, watchlist: 0, session_new: 0, forming: true, loved_target: 8 };
    rows = coll;
  } catch {
    return (
      <div className="v2wrap">
        <div><h1 className="v2title">Ledger</h1></div>
        <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
      </div>
    );
  }
  return <LedgerWorkspace stats={stats} rows={rows} />;
}
