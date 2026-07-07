import { redirect } from "next/navigation";

/** v3: the Library became the Shelf — /room/shelf (spec §6 route map).
 *  Bookmark-compat page-stub redirect ONLY: no next.config/middleware rules
 *  (the auto-deploy watcher stages app/components/lib, nothing else). */
export default function RoomLibraryRedirect() {
  redirect("/room/shelf");
}
