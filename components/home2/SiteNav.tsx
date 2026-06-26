import { createClient } from "@supabase/supabase-js";
import Nav, { type NavCounts } from "./Nav";
import "@/app/home2.css";

/**
 * Server wrapper that supplies the shared home v7 nav (dark, expanded 5 groups)
 * to any non-home page. Fetches nav_counts() once (ISR-cached on the host page)
 * and renders the client Nav inside a scoped .mthome wrapper.
 */
export default async function SiteNav() {
  let counts: NavCounts = {};
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await db.rpc("nav_counts");
    if (data) counts = data as NavCounts;
  } catch {
    /* degrade gracefully → arrows without numbers */
  }
  return (
    <div className="mthome">
      <Nav counts={counts} />
    </div>
  );
}
