import { redirect } from "next/navigation";

/** v3: Write became Takes — /room/takes (spec §6 route map).
 *  Bookmark-compat page-stub redirect ONLY: no next.config/middleware rules
 *  (the auto-deploy watcher stages app/components/lib, nothing else). */
export default function RoomWriteRedirect() {
  redirect("/room/takes");
}
