"use client";

/**
 * LensQuickBar — compact My Films lens switcher for the top of film-list pages
 * (atlas, genre, trope, lineage, catalog, movies-like, …). Same three modes as
 * the nav toggle, inline where the list actually is. Signed-out / no-seen users
 * get a one-line pointer to /my-films instead. Renders nothing until the lens
 * is ready, so server HTML stays untouched.
 */
import Link from "next/link";
import { useLens, type LensMode } from "@/components/LensProvider";

const OPTS: { m: LensMode; t: string }[] = [
  { m: "off", t: "All" },
  { m: "highlight", t: "Highlight mine" },
  { m: "only", t: "Only mine" },
];

export default function LensQuickBar() {
  const lens = useLens();
  if (!lens || !lens.ready) return null;

  if (!lens.uid || lens.seenCount === 0) {
    return (
      <div className="mtl-qb mtl-qb--intro">
        <Link href="/my-films">◎ See this page through the films you&rsquo;ve watched →</Link>
      </div>
    );
  }

  return (
    <div className="mtl-qb" role="group" aria-label="My Films lens">
      <span className="mtl-qb__lb">◎ My films</span>
      {OPTS.map((o) => (
        <button
          key={o.m}
          type="button"
          className={`mtl-qb__b${lens.rawMode === o.m ? " on" : ""}`}
          onClick={() => lens.setMode(o.m)}
          aria-pressed={lens.rawMode === o.m}
        >
          {o.t}
        </button>
      ))}
      <span className="mtl-qb__n">{lens.seenCount.toLocaleString()} seen</span>
    </div>
  );
}
