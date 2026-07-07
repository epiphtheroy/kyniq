import { createClient } from "@/lib/supabase/server";
import { loadRanged } from "@/lib/room/loadCollection";
import TakesWorkspace, { type TakeRow, type TakesStats } from "@/components/room/TakesWorkspace";
import { STR } from "@/components/room/strings";
import "./takes.css";

export const dynamic = "force-dynamic";

/** Takes — write & manage your readings (spec §3.13, /room/write successor).
 *  me_authored_takes is a big-list RPC → pulled through .range() chunks
 *  (PostgREST 1000-row cap, spec §1 invariant 6). Header stats come from one
 *  me_takes_stats() aggregate (§8-R8) — the whole takes set counted
 *  server-side, not a client fold over the paged rows. */
export default async function RoomTakesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let takes: TakeRow[];
  try {
    takes = await loadRanged<TakeRow>(supabase, "me_authored_takes", {}, 20000, (r) => r.take_id);
  } catch {
    return (
      <div className="mainpad">
        <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
      </div>
    );
  }
  // §8-R8 me_takes_stats — single-row aggregate. null on failure → the header
  // shows em-dashes instead of fabricated zeros (honest degradation).
  const { data: statsData } = await supabase.rpc("me_takes_stats");
  const stats: TakesStats | null = ((statsData as TakesStats[] | null) ?? [])[0] ?? null;
  return <TakesWorkspace takes={takes} uid={user?.id ?? ""} stats={stats} />;
}
