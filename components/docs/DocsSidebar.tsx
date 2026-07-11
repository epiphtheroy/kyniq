"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_CATEGORIES, DOCS, docHref } from "@/lib/docs/registry";

/**
 * Full docs tree — every category and doc as a real <Link> (strong internal
 * link graph, all SSR-rendered). The active doc is highlighted client-side.
 */
export default function DocsSidebar() {
  const path = usePathname() || "/methodology";
  const activeSlug = path === "/methodology" ? "overview" : path.replace(/^\/methodology\//, "").split("/")[0];

  return (
    <aside className="mdocs-side" aria-label="Methodology documents">
      {DOC_CATEGORIES.map((c) => (
        <div className="mdocs-side__cat" key={c.key}>
          <div className="mdocs-side__catlabel">{c.label}</div>
          <ul className="mdocs-side__list">
            {DOCS.filter((d) => d.category === c.key).map((d) => (
              <li key={d.slug}>
                <Link
                  href={docHref(d.slug)}
                  className={`mdocs-side__link${d.slug === activeSlug ? " is-on" : ""}`}
                  aria-current={d.slug === activeSlug ? "page" : undefined}
                >
                  {d.nav}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
