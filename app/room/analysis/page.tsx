import { createClient } from "@/lib/supabase/server";
import AnalysisWorkspace, {
  type AnalysisData, type SigRow, type CollRow, type NeighborRow, type FigureRow, type Breakdown,
} from "@/components/room/AnalysisWorkspace";
import "./analysis.css";

export const dynamic = "force-dynamic";

export default async function RoomAnalysisPage() {
  const supabase = await createClient();

  const [sig, pb, coll, fig, nb] = await Promise.all([
    supabase.rpc("me_taste_signature", { p_limit: 8 }),
    supabase.rpc("portfolio_breakdown"),
    supabase.rpc("me_collection"),
    supabase.rpc("me_figure_cloud", { p_limit: 28 }),
    supabase.rpc("me_taste_neighbors", { p_limit: 8 }),
  ]);

  const data: AnalysisData = {
    signature: (sig.data as SigRow[] | null) ?? [],
    breakdown: (pb.data as Breakdown) ?? null,
    collection: (coll.data as CollRow[] | null) ?? [],
    figures: (fig.data as FigureRow[] | null) ?? [],
    neighbors: (nb.data as NeighborRow[] | null) ?? [],
  };

  return <AnalysisWorkspace data={data} />;
}
