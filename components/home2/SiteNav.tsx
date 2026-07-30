import Nav, { type NavCounts } from "./Nav";
import { getNavCounts } from "@/lib/navCounts";
import "@/app/home2.css";

/**
 * Server wrapper that supplies the shared home v7 nav (dark, expanded 5 groups)
 * to any non-home page, rendering the client Nav inside a scoped .mthome
 * wrapper. Counts come from getNavCounts(), cached for an hour — this renders
 * on every non-home page, and the uncached call was the third-largest consumer
 * of database time on 2026-07-30 (2,498 calls / 1,607s).
 */
export default async function SiteNav() {
  let counts: NavCounts = {};
  try {
    counts = await getNavCounts();
  } catch {
    /* degrade gracefully → arrows without numbers */
  }
  return (
    <div className="mthome mthome--bare">
      <Nav counts={counts} />
    </div>
  );
}
