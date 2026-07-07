import { createClient } from "@/lib/supabase/server";
import { loadWwi } from "@/lib/room/loadCollection";
import type { WwiRow } from "@/lib/room/format";
import CoverageWorkspace, {
  type CoverageData, type CovRow, type BlindRow,
} from "@/components/room/CoverageWorkspace";
import "./coverage.css";

export const dynamic = "force-dynamic";

/** /room/coverage — Coverage instrument (spec §3.7).
 *  Three parallel reads; a failed read passes null so the workspace renders the
 *  shared .errcard for that module instead of silently showing empty data.
 *  me_coverage/me_blindspots are RPC-capped (300/12 rows) — cap-safe by design.
 *  NOTE: the deployed me_blindspots signature is (p_limit, p_min_total,
 *  p_min_aw) per migration 0027 — the spec's `p_max_pct` name does not exist in
 *  the DB; 0.55 is the authority floor. */
export default async function RoomCoveragePage() {
  const supabase = await createClient();

  const [covRes, bsRes, wwi] = await Promise.all([
    supabase.rpc("me_coverage", { p_min_total: 5, p_limit: 300 }),
    supabase.rpc("me_blindspots", { p_limit: 12, p_min_total: 10, p_min_aw: 0.55 }),
    loadWwi(1.0, 40).then((r): WwiRow[] | null => r, (): WwiRow[] | null => null),
  ]);

  const data: CoverageData = {
    coverage: covRes.error ? null : ((covRes.data as CovRow[] | null) ?? []),
    blind: bsRes.error ? null : ((bsRes.data as BlindRow[] | null) ?? []),
    wwi,
  };

  return <CoverageWorkspace data={data} />;
}
