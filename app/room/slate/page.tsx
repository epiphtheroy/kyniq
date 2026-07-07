import "./slate.css";
import { createClient } from "@/lib/supabase/server";
import { loadRanged } from "@/lib/room/loadCollection";
import { STR } from "@/components/room/strings";
import SlateWorkspace, { type SlateRow } from "@/components/room/SlateWorkspace";

export const dynamic = "force-dynamic";

/** Slate — /room/slate (spec §3.3, new screen on the existing RPC).
 *  me_watchlist_scored is pulled through the shared .range() chunk loader —
 *  PostgREST caps every response at 1000 rows, and big imported watchlists
 *  must not silently truncate (launch-gate invariant §1-6). §8-R6 (0045) only
 *  added the avail column; ordering (added_at desc, slug) and the slug natural
 *  key are unchanged, so the chunk-boundary dedupe below still holds. */
export default async function RoomSlatePage() {
  const supabase = await createClient();

  let rows: SlateRow[];
  try {
    rows = await loadRanged<SlateRow>(supabase, "me_watchlist_scored", {}, 20000, (r) => r.slug);
  } catch {
    return (
      <div className="v2wrap">
        <div>
          <h1 className="v2title">Slate</h1>
        </div>
        <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
      </div>
    );
  }

  return <SlateWorkspace rows={rows} />;
}
