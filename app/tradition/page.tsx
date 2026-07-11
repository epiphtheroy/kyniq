import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import LensQuickBar from "@/components/LensQuickBar";
import TheoryExplorer from "@/components/theory/TheoryExplorer";
import TraditionDirectory, { type TraditionRow } from "@/components/theory/TraditionDirectory";
import { pageRobots } from "@/lib/seo";

/**
 * Traditions index — the school-of-thought axis (unified taxonomy Major).
 * 2026-07-08: old per-canon "traditions" (really concepts) merged into
 * /concept; this lists the real scholarly schools. 2026-07-11: rebuilt on the
 * shared TheoryExplorer shell (unified search + axis tabs), grouped by domain,
 * with the 26 no-films-yet schools gated behind a toggle.
 */
export const revalidate = 1800;
const SITE = "https://metatake.net";
const TITLE = "Schools of Film Theory — traditions and the films that carry them";
const DESC =
  "Psychoanalytic criticism, the Frankfurt School, post-structuralism and more — each scholarly tradition gathers the concepts, thinkers and films that carry it. A tradition is a shared way of making the unintelligible legible; cinema is where you see it applied.";

export const metadata: Metadata = {
  alternates: { canonical: "/tradition" },
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC },
  robots: pageRobots(true),
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function TraditionIndex() {
  const { data } = await db().rpc("theory_schools_index");
  const rows = ((data as TraditionRow[] | null) ?? []).filter((r) => r.slug);
  const withFilms = rows.filter((r) => r.films > 0);
  const totalFilms = rows.reduce((s, r) => s + r.films, 0);
  const totalConcepts = rows.reduce((s, r) => s + r.concepts, 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${SITE}/tradition`, url: `${SITE}/tradition`, name: TITLE, description: DESC },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE },
        { "@type": "ListItem", position: 2, name: "Traditions", item: `${SITE}/tradition` },
      ] },
      { "@type": "ItemList", numberOfItems: withFilms.length,
        itemListElement: [...withFilms].sort((a, b) => b.films - a.films).slice(0, 25).map((r, i) => ({
          "@type": "ListItem", position: i + 1, name: r.name, url: `${SITE}/tradition/${r.slug}`,
        })) },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-wrap lh">
        <TheoryExplorer
          axis="traditions"
          heroTitle="The schools of thought behind the readings"
          heroLede={
            <>
              A tradition is a shared way of making the unintelligible legible — a lineage of thinkers pointing the same
              lens at the world. {withFilms.length} of them carry films here, organizing{" "}
              {totalConcepts.toLocaleString()} <Link href="/concept">concepts</Link> and {totalFilms.toLocaleString()} film
              readings. Open any to see the concepts it gathers and the films they illuminate.
            </>
          }
        >
          <LensQuickBar />
          <TraditionDirectory rows={rows} />
        </TheoryExplorer>
      </div>
    </div>
  );
}
