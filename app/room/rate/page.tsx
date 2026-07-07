import { redirect } from "next/navigation";

/** v3: the rating workstation grew into the Ledger (/room/ledger — full history,
 *  activity heatmap, histogram, inline re-rate). Route kept as a page-stub
 *  redirect for bookmark compatibility only — never next.config/middleware
 *  (the auto-deploy watcher stages app/components/lib only). */
export default function RoomRateRedirect() {
  redirect("/room/ledger");
}
