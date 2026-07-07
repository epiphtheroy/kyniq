import { createClient } from "@/lib/supabase/server";
import { loadWwi, loadCollection } from "@/lib/room/loadCollection";
import { num, type NavHistRow, type WwiRow } from "@/lib/room/format";
import DeskWorkspace, {
  type BlindTile, type ConquestTile, type DeskData, type NavJson, type PairState, type RateStats, type RecentRow,
} from "@/components/room/DeskWorkspace";

export const dynamic = "force-dynamic";

/** me_coverage row (only what the nearest-conquest tile needs). */
type CovRow = {
  list_id: string; slug: string; label: string; facet: string;
  aw: number | string | null; seen: number | string | null; total: number | string | null;
  pct: number | string | null; state: string;
};

/* Next milestone per state: lock→50% · prog→75% · near→100% (done has no remainder). */
const MILESTONE: Record<string, number> = { lock: 50, prog: 75, near: 100 };

/** Nearest conquest = smallest remainder to the next milestone among lineages
 *  with at least one seen film; ties break on authority weight. */
function nearestConquest(rows: CovRow[]): ConquestTile | null {
  let best: (ConquestTile & { aw: number }) | null = null;
  for (const c of rows) {
    const s = num(c.seen) ?? 0, t = num(c.total) ?? 0, ms = MILESTONE[c.state];
    if (s <= 0 || !ms || t <= 0) continue;
    const rem = Math.ceil((t * ms) / 100) - s;
    if (rem <= 0) continue;
    const aw = num(c.aw) ?? 0;
    if (!best || rem < best.rem || (rem === best.rem && aw > best.aw)) best = { label: c.label, rem, ms, aw };
  }
  return best ? { label: best.label, rem: best.rem, ms: best.ms } : null;
}

/** Desk — /room (v3 §3.1). The server loads all five bands' RPCs in parallel and
 *  hands one payload to the client workspace. me_recommend_wwi goes through
 *  loadWwi (React cache — any same-args caller this request shares the fetch).
 *  Per-RPC failures degrade honestly: data bands render the shared errcard,
 *  job tiles fall back to their numberless door or drop out. */
export default async function RoomDesk() {
  const supabase = await createClient();

  const [recsQ, stats, recent, nav, hist, cov, blind, pair] = await Promise.all([
    loadWwi(1.0, 24).then((rows) => ({ rows, err: false as const })).catch(() => ({ rows: null, err: true as const })),
    supabase.rpc("me_rate_stats"),
    supabase.rpc("me_recent_ratings", { p_limit: 12 }),
    supabase.rpc("me_portfolio_nav"),
    supabase.rpc("me_nav_history", { p_days: 90 }),
    supabase.rpc("me_coverage", { p_min_total: 5, p_limit: 300 }),
    supabase.rpc("me_blindspots", { p_limit: 1 }),
    supabase.rpc("me_pair_state"),
  ]);

  /* FormingCard meter (only needed when the engine returns nothing — the
     collection is tiny in that cold-start state, so this stays cheap). */
  let ratedHigh = 0;
  if (!recsQ.err && (recsQ.rows?.length ?? 0) === 0) {
    const coll = await loadCollection().catch(() => []);
    ratedHigh = coll.filter((c) => (num(c.rating) ?? 0) >= 3.5).length;
  }

  const data: DeskData = {
    recs: recsQ.err ? null : ((recsQ.rows as WwiRow[] | null) ?? []),
    stats: stats.error ? null : (((stats.data as RateStats[] | null) ?? [])[0] ?? null),
    recent: recent.error ? null : ((recent.data as RecentRow[] | null) ?? []),
    nav: nav.error ? null : ((nav.data as NavJson) ?? null),
    navErr: !!nav.error,
    hist: hist.error ? null : ((hist.data as NavHistRow[] | null) ?? []),
    conquest: cov.error ? null : nearestConquest((cov.data as CovRow[] | null) ?? []),
    blind: blind.error ? null : ((((blind.data as BlindTile[] | null) ?? [])[0]) ?? null),
    pair: pair.error ? null : (((pair.data as PairState[] | null) ?? [])[0] ?? null),
    pairErr: !!pair.error,
    ratedHigh,
  };

  return <DeskWorkspace data={data} />;
}
