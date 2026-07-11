"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_CATEGORIES, categoryEntryHref, docBySlug } from "@/lib/docs/registry";

/** Top category strip. Real <Link>s (crawlable); active state is client-only. */
export default function DocsTopTabs() {
  const path = usePathname() || "/methodology";
  const slug = path === "/methodology" ? "overview" : path.replace(/^\/methodology\//, "").split("/")[0];
  const currentCat = docBySlug(slug)?.category ?? "start-here";

  return (
    <div className="mdocs-topbar">
      <nav className="mdocs-topbar__in" aria-label="Methodology sections">
        {DOC_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={categoryEntryHref(c.key)}
            className={`mdocs-tab${c.key === currentCat ? " is-on" : ""}`}
            aria-current={c.key === currentCat ? "true" : undefined}
          >
            {c.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
