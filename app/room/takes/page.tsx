import { createClient } from "@/lib/supabase/server";
import { loadRanged } from "@/lib/room/loadCollection";
import TakesWorkspace, { type TakeRow } from "@/components/room/TakesWorkspace";
import { STR } from "@/components/room/strings";
import "./takes.css";

export const dynamic = "force-dynamic";

/** Takes — write & manage your readings (spec §3.13, /room/write successor).
 *  me_authored_takes is a big-list RPC → pulled through .range() chunks
 *  (PostgREST 1000-row cap, spec §1 invariant 6). Stats render client-side
 *  over these rows until §8-R8 me_takes_stats ships. */
export default async function RoomTakesPage() {
  const supabase = await createClient();
  let takes: TakeRow[];
  try {
    takes = await loadRanged<TakeRow>(supabase, "me_authored_takes");
  } catch {
    return (
      <div className="mainpad">
        <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
      </div>
    );
  }
  return <TakesWorkspace takes={takes} />;
}
