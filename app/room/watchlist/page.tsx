import { redirect } from "next/navigation";

/** v3: the old watchlist split into Screener (pure discovery, /room/screener)
 *  and Slate (kept films, /room/slate). Old bookmarks land on the Screener.
 *  Page-stub redirect only — next.config/middleware are off-limits (the
 *  auto-deploy watcher stages app/components/lib only). */
export default function RoomWatchlistRedirect() {
  redirect("/room/screener");
}
