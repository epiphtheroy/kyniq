import { redirect } from "next/navigation";

/** v3: the analysis workbench split — taste identity lives at /room/signature
 *  (asset modules moved to /room/performance, lineage coverage to
 *  /room/coverage). Route kept as a bookmark-compatible page-stub redirect —
 *  never via next.config/middleware (the auto-deploy watcher stages app/
 *  components/ lib/ only; spec §6). */
export default function RoomAnalysisRedirect() {
  redirect("/room/signature");
}
