import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import LensQuickBar from "@/components/LensQuickBar";

/**
 * Traditions index — the school-of-thought axis (unified taxonomy Major).
 * 2026-07-08 rework: old per-canon "traditions" (which were really concepts)
 * merged into /concept; this index now lists the real scholarly traditions.
 */
export const revalidate = 1800;

export const metadata: Metadata = {
  alternates: { canonical: "/tradition" },
  title: "Traditions — the schools of thought behind the readings",
  description:
    "The scholarly traditions Metatake's readings draw from — psychoanalytic criticism, the Frankfurt School, post-structuralism and more — each gathering the concepts, thinkers and films that carry it.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Row = { slug: string; name: string; parts: string[] | null; concepts: number; films: number };

export default async function TraditionIndex() {
  const { data } = await db().rpc("theory_schools_index");
  const rows = ((data as Row[] | null) ?? []).filter((r) => r.slug);
  const totalFilms = rows.reduce((s, r) => s + r.films, 0);
  const totalConcepts = rows.reduce((s, r) => s + r.concepts, 0);

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <div className="mt-crumb">
          <Link href="/theorist">Theory</Link> › <Link href="/concept">Concepts</Link> · <Link href="/theorist">Theorists</Link>
        </div>
        <h1 className="lh-h1">Traditions</h1>
        <p className="lh-def">
          The schools of thought behind Metatake&rsquo;s readings — {rows.length} traditions organizing{" "}
          {totalConcepts.toLocaleString()} <Link href="/concept">concepts</Link> and {totalFilms.toLocaleString()} film
          readings. Open any to see the concepts that carry it and the films they illuminate.
        </p>
        <LensQuickBar />
        {/* No mtl-swap-out here: the my-films lens has no tradition replacement list,
            so hiding this grid in only-mode would blank the page. */}
        <div className="th-grid">
          {rows.map((r) => (
            <Link className="th-row" href={`/tradition/${r.slug}`} key={r.slug}>
              <span className="th-name">
                {r.name}
                <span className="th-by"> — {r.concepts.toLocaleString()} concept{r.concepts !== 1 ? "s" : ""}{r.parts && r.parts.length > 0 ? ` · ${r.parts.join(" · ")}` : ""}</span>
              </span>
              {r.films > 0 ? <span className="th-n">{r.films}</span> : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
