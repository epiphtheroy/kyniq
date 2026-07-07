import { redirect } from "next/navigation";

/** v3: the collection became Holdings (/room/holdings — the full 20-column
 *  positions table). Route kept as a page-stub redirect for bookmark
 *  compatibility only — never next.config/middleware (the auto-deploy watcher
 *  stages app/components/lib only). */
export default function RoomCollectionRedirect() {
  redirect("/room/holdings");
}
