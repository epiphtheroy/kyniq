"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { POE_CATEGORIES, poeCategoryEntryHref, poeBySlug } from "@/lib/poetics/registry";

/** Top category strip. Real <Link>s; active state is client-only. */
export default function PoeTopTabs() {
  const path = usePathname() || "/poetics";
  const slug = path.replace(/^\/poetics\/?/, "").split("/")[0];
  const currentCat = poeBySlug(slug)?.category ?? "value";

  return (
    <div className="poe-topbar">
      <nav className="poe-topbar__in" aria-label="Poetics sections">
        {POE_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={poeCategoryEntryHref(c.key)}
            className={`poe-tab${c.key === currentCat ? " is-on" : ""}`}
            aria-current={c.key === currentCat ? "true" : undefined}
          >
            {c.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
