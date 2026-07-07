import { redirect } from "next/navigation";

/** v3: Pair became Masquerade (spec §6 route map). Bookmark-compat page-stub
 *  redirect ONLY — never via next.config/middleware (the auto-deploy watcher
 *  stages app/components/lib, so root config files would need manual commits). */
export default function RoomPairRedirect() {
  redirect("/room/masquerade");
}
