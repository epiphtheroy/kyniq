import { redirect } from "next/navigation";

/**
 * /room/atlas → /room/locations (terminology cleanup 2026-07-11). Internal ops
 * surface behind auth — 307 like the other /room/* renames (no SEO signal to
 * transfer).
 */
export default function OldRoomAtlasRedirect() {
  redirect("/room/locations");
}
