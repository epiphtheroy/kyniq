import { createClient } from "@/lib/supabase/server";
import { loadRanged } from "@/lib/room/loadCollection";
import ShelfWorkspace, { type ShelfRow } from "@/components/room/ShelfWorkspace";
import { STR } from "@/components/room/strings";
import "./shelf.css";

export const dynamic = "force-dynamic";

/** Shelf — the pin archive (spec §3.12, /room/library successor).
 *  me_library is a big-list RPC → pulled through .range() chunks (PostgREST
 *  1000-row cap, spec §1 invariant 6). Poster-less until §8-R3 me_library v2. */
export default async function RoomShelfPage() {
  const supabase = await createClient();
  let rows: ShelfRow[];
  try {
    rows = await loadRanged<ShelfRow>(supabase, "me_library");
  } catch {
    return (
      <div className="mainpad">
        <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
      </div>
    );
  }
  return <ShelfWorkspace rows={rows} />;
}
