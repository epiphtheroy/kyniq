"use client";

/**
 * LensDirectorCoverage — "You've seen X of N films" line for a director's
 * filmography. Renders only for signed-in users with at least one seen film
 * anywhere on the site; server pages stay cacheable (slugs come in as props).
 */
import Link from "next/link";
import { useLens } from "@/components/LensProvider";

export default function LensDirectorCoverage({ slugs }: { slugs: string[] }) {
  const lens = useLens();
  if (!lens || !lens.uid || lens.seenCount === 0 || slugs.length === 0) return null;
  const seen = slugs.filter((s) => lens.seen(s)).length;
  const pct = Math.round((seen / slugs.length) * 100);

  return (
    <p className="mtl-cov">
      <span className="mtl-covbar" aria-hidden="true">
        <span className="mtl-covfill" style={{ width: `${pct}%` }} />
      </span>
      You&rsquo;ve seen <b>{seen}</b> of {slugs.length} — <Link href="/my-films">My Films lens</Link>
    </p>
  );
}
