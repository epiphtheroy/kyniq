import "./screener.css";
import ScreenerWorkspace from "@/components/room/ScreenerWorkspace";
import { STR } from "@/components/room/strings";
import { num, REASON_MAP, type WwiRow } from "@/lib/room/format";
import { loadCollection, loadWwi } from "@/lib/room/loadCollection";

export const dynamic = "force-dynamic";

/** Screener — /room/screener (spec §3.2). Server-fetches me_recommend_wwi(1.0, 60)
 *  through the request-cached loader; client λ re-dials go through the
 *  SessionStore cache, never a second server fetch. `?reason=` (the frontier
 *  chip's deep link) pre-selects that reason toggle. */
export default async function RoomScreenerPage({ searchParams }: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const initialReason = reason && REASON_MAP[reason] ? reason : null;

  let rows: WwiRow[];
  try {
    rows = await loadWwi(1.0, 60);
  } catch {
    return (
      <div className="v2wrap">
        <div>
          <h1 className="v2title">Screener</h1>
        </div>
        <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
      </div>
    );
  }

  /* Forming gate needs the exact unlock progress: films rated ★3.5+ (the engine's
   *  own threshold). Only computed on the cold path — an empty WWI result almost
   *  always means a near-empty collection, so this stays cheap. */
  let formingHave = 0;
  if (rows.length === 0) {
    try {
      const coll = await loadCollection();
      formingHave = coll.filter((c) => (num(c.rating) ?? 0) >= 3.5).length;
    } catch {
      formingHave = 0; // gate still renders with an honest zero
    }
  }

  return <ScreenerWorkspace initialRows={rows} formingHave={formingHave} initialReason={initialReason} />;
}
