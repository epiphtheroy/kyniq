import { createClient } from "@/lib/supabase/server";
import CommandCenterWorkspace, {
  type CommandData, type Nav, type Breakdown, type WwiRow, type NeighborRow,
} from "@/components/room/CommandCenterWorkspace";
import "./command.css";

export const dynamic = "force-dynamic";

/* collection rows carry `discovery` (숨은가치) as numeric → coerce & average client-side here. */
type CollDisc = { discovery: number | string | null };
const num = (x: number | string | null | undefined): number | null =>
  x == null ? null : typeof x === "number" ? x : Number.isNaN(Number(x)) ? null : Number(x);

export default async function RoomHome() {
  const supabase = await createClient();

  const [nav, pb, recs, nb, coll] = await Promise.all([
    supabase.rpc("me_portfolio_nav"),
    supabase.rpc("portfolio_breakdown"),
    supabase.rpc("me_recommend_wwi", { p_lambda: 1.0, p_limit: 12 }),
    supabase.rpc("me_taste_neighbors", { p_limit: 12 }),
    supabase.rpc("me_collection"),
  ]);

  const discVals = ((coll.data as CollDisc[] | null) ?? [])
    .map((c) => num(c.discovery))
    .filter((x): x is number => x != null);
  const avgDiscovery = discVals.length ? discVals.reduce((a, b) => a + b, 0) / discVals.length : null;

  const data: CommandData = {
    nav: (nav.data as Nav) ?? null,
    breakdown: (pb.data as Breakdown) ?? null,
    recs: (recs.data as WwiRow[] | null) ?? [],
    neighbors: (nb.data as NeighborRow[] | null) ?? [],
    avgDiscovery,
  };

  return <CommandCenterWorkspace data={data} />;
}
