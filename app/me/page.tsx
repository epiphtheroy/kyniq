import { permanentRedirect } from "next/navigation";

/** My Room v3: /me is retired as a page — /room is the only private surface.
 *  Its modules moved to the Room instruments (Saved/Following/Liked → Shelf,
 *  My takes → Takes, TakeScore summary → Performance, watchlist → Slate).
 *  Kept as a page-stub redirect for bookmark compatibility (never via
 *  next.config/middleware — the auto-deploy watcher only stages app/components/lib). */
export default function MeRedirect() {
  permanentRedirect("/room");
}
