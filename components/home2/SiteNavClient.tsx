"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Nav, { type NavCounts } from "./Nav";
import "@/app/home2.css";

/**
 * Client variant of SiteNav for pages that are themselves client components
 * (chat, ask, rag). Fetches nav_counts() on mount; Nav degrades to arrows
 * without numbers until the counts arrive.
 */
export default function SiteNavClient() {
  const [counts, setCounts] = useState<NavCounts>({});
  useEffect(() => {
    let on = true;
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    db.rpc("nav_counts").then(({ data }) => {
      if (on && data) setCounts(data as NavCounts);
    });
    return () => { on = false; };
  }, []);
  return (
    <div className="mthome mthome--bare">
      <Nav counts={counts} />
    </div>
  );
}
