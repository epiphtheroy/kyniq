import "./holdings.css";
import { loadCollection } from "@/lib/room/loadCollection";
import { STR } from "@/components/room/strings";
import HoldingsWorkspace from "@/components/room/HoldingsWorkspace";
import type { CollRow } from "@/lib/room/format";

export const dynamic = "force-dynamic";

/** Holdings — every seen film as a position (spec §3.5). The only full surface
 *  of me_collection's 20 columns, loaded through loadCollection() (.range()
 *  chunks — 1000-row-cap safe). The page offset travels in the URL (?p=3) so
 *  the back button lands on the same table page. */
export default async function RoomHoldingsPage({ searchParams }: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const initialPage = Math.max(1, Number.parseInt(p ?? "1", 10) || 1);
  let rows: CollRow[];
  try {
    rows = await loadCollection();
  } catch {
    return (
      <div className="v2wrap">
        <div><h1 className="v2title">Holdings</h1></div>
        <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
      </div>
    );
  }
  return <HoldingsWorkspace rows={rows} initialPage={initialPage} />;
}
