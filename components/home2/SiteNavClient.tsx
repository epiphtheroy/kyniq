"use client";

import { useEffect, useState } from "react";
import Nav, { type NavCounts } from "./Nav";
import "@/app/home2.css";

/**
 * Client variant of SiteNav for pages that are themselves client components
 * (chat, ask, rag). Nav degrades to arrows without numbers until counts arrive.
 *
 * Reads /api/nav-counts rather than calling nav_counts() straight from the
 * browser: that was one database round trip per page view for numbers that
 * change on the order of days, and nav_counts was the third-largest consumer
 * of database time on 2026-07-30. The route is CDN-cached.
 */
export default function SiteNavClient() {
  const [counts, setCounts] = useState<NavCounts>({});
  useEffect(() => {
    let on = true;
    fetch("/api/nav-counts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (on && data) setCounts(data as NavCounts);
      })
      .catch(() => {
        /* arrows without numbers is an acceptable nav */
      });
    return () => {
      on = false;
    };
  }, []);
  return (
    <div className="mthome mthome--bare">
      <Nav counts={counts} />
    </div>
  );
}
