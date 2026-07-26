import { createClient } from "@/lib/supabase/server";
import { loadWwi, loadCollection } from "@/lib/room/loadCollection";
import { num, type NavHistRow, type WwiRow } from "@/lib/room/format";
import DeskWorkspace, {
  type AuteurLite, type BlindTile, type ConquestTile, type CovBar, type DeskData, type GeoDot,
  type NavJson, type NavPrev, type PairState, type RateStats, type RecentRow,
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

  const [recsQ, stats, recent, nav, hist, cov, blind, pair, auteurs, geo] = await Promise.all([
    loadWwi(1.0, 24).then((rows) => ({ rows, err: false as const })).catch(() => ({ rows: null, err: true as const })),
    supabase.rpc("me_rate_stats"),
    supabase.rpc("me_recent_ratings", { p_limit: 12 }),
    supabase.rpc("me_portfolio_nav"),
    supabase.rpc("me_nav_history", { p_days: 90 }),
    supabase.rpc("me_coverage", { p_min_total: 5, p_limit: 300 }),
    supabase.rpc("me_blindspots", { p_limit: 1 }),
    supabase.rpc("me_pair_state"),
    // v4.1 previews (마이룸-v4): the desk SHOWS the map instead of linking to it.
    supabase.rpc("me_auteur_conquest", { p_limit: 6 }),
    supabase.rpc("me_geo_coverage"),
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
    // v4.1 previews — top in-progress canon lineages (closest to done first),
    // director conquest with faces, and the geo dots for the mini world map.
    covRows: cov.error
      ? null
      : (((cov.data as CovRow[] | null) ?? [])
          .map((c) => ({ label: c.label, seen: num(c.seen) ?? 0, total: num(c.total) ?? 0, pct: num(c.pct) ?? 0 }))
          .filter((c) => c.seen > 0 && c.pct < 100)
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 4) satisfies CovBar[]),
    auteurs: auteurs.error
      ? null
      : (((auteurs.data as { slug: string; name: string | null; profile_path: string | null; seen: number | string | null; total: number | string | null; pct: number | string | null }[] | null) ?? [])
          .map((a) => ({ slug: a.slug, name: a.name ?? a.slug, profile_path: a.profile_path, seen: num(a.seen) ?? 0, total: num(a.total) ?? 0, pct: num(a.pct) ?? 0 }))
          .slice(0, 4) satisfies AuteurLite[]),
    // Navigator "resume" preview — the top in-progress director conquest (reuses
    // the me_auteur_conquest rows already fetched for My Map). Links into the
    // full drive at /room/navigator; no extra RPC, no heavy load on the desk.
    navPrev: auteurs.error
      ? null
      : (() => {
          const rows = ((auteurs.data as { slug: string; name: string | null; seen: number | string | null; total: number | string | null; pct: number | string | null }[] | null) ?? [])
            .map((a) => ({ dir: a.slug, label: a.name ?? a.slug, seen: num(a.seen) ?? 0, total: num(a.total) ?? 0, pct: num(a.pct) ?? 0 }))
            .filter((a) => a.pct < 100 && a.seen > 0 && a.total >= 8)
            .sort((a, b) => b.pct - a.pct);
          return rows[0] ?? null;
        })() satisfies NavPrev | null,
    geoDots: (() => {
      if (geo.error) return null;
      const g = geo.data as { points?: { lat: number | string | null; lng: number | string | null; narrative_setting: string | null }[] } | null;
      const pts = (g?.points ?? [])
        .map((p) => ({ o: num(p.lng), a: num(p.lat), s: p.narrative_setting ? 1 : 0 }))
        .filter((p): p is GeoDot => p.o != null && p.a != null)
        .slice(0, 900);
      return pts;
    })(),
  };

  return <DeskWorkspace data={data} />;
}
