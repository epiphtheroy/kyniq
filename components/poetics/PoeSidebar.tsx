"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { POE_CATEGORIES, POE_ESSAYS, poeHref } from "@/lib/poetics/registry";

/** Full essay tree — every category and essay as a real <Link> (SSR-crawlable). */
export default function PoeSidebar() {
  const path = usePathname() || "/poetics";
  const activeSlug = path.replace(/^\/poetics\/?/, "").split("/")[0];

  return (
    <aside className="poe-side" aria-label="Poetics essays">
      {POE_CATEGORIES.map((c) => (
        <div className="poe-side__cat" key={c.key}>
          <div className="poe-side__catlabel">{c.label}</div>
          <ul className="poe-side__list">
            {POE_ESSAYS.filter((e) => e.category === c.key).map((e) => (
              <li key={e.slug}>
                <Link
                  href={poeHref(e.slug)}
                  className={`poe-side__link${e.slug === activeSlug ? " is-on" : ""}`}
                  aria-current={e.slug === activeSlug ? "page" : undefined}
                >
                  {e.nav}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
