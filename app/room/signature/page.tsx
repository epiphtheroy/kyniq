import { createClient } from "@/lib/supabase/server";
import { loadCollection } from "@/lib/room/loadCollection";
import SignatureWorkspace, {
  type SignatureData, type SigRow, type FigureRow, type NeighborRow, type Breakdown, type RateStats,
} from "@/components/room/SignatureWorkspace";
import "./signature.css";

export const dynamic = "force-dynamic";

/** Signature — taste identity only (spec §3.10). Asset analysis lives in
 *  Performance, lineage coverage in Coverage. The risk plane consumes the FULL
 *  collection via loadCollection() (.range() chunks) — the v2 analysis page
 *  fed it a bare me_collection call that PostgREST truncated at 1000 rows.
 *  Failed RPCs pass null so the workspace renders the shared errcard instead
 *  of a silent empty (no swallowed errors). */
export default async function RoomSignaturePage() {
  const supabase = await createClient();

  const [sig, pb, fig, nb, rs, coll] = await Promise.all([
    supabase.rpc("me_taste_signature", { p_limit: 8 }),
    supabase.rpc("portfolio_breakdown"),
    supabase.rpc("me_figure_cloud", { p_limit: 28 }),
    supabase.rpc("me_taste_neighbors", { p_limit: 8 }),
    supabase.rpc("me_rate_stats"),
    loadCollection().catch(() => null),
  ]);

  const data: SignatureData = {
    signature: sig.error ? null : ((sig.data as SigRow[] | null) ?? []),
    breakdown: pb.error ? null : ((pb.data as Breakdown) ?? null),
    figures: fig.error ? null : ((fig.data as FigureRow[] | null) ?? []),
    neighbors: nb.error ? null : ((nb.data as NeighborRow[] | null) ?? []),
    stats: rs.error ? null : (((rs.data as NonNullable<RateStats>[] | null) ?? [])[0] ?? null),
    collection: coll,
  };

  return <SignatureWorkspace data={data} />;
}
