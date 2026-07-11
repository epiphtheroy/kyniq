import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import ShareDock from "@/components/ShareDock";
import ForWHeoList, { type WHeoFilm } from "@/components/ForWHeoList";

// /lineage/for-w-heo — the flagship curated list: every film our curation marks
// "essential" (cinephile required viewing). A dedicated interactive surface —
// poster grid with sort (year/title/director) and filter (genre/director/text).
// This static segment overrides the generic /lineage/[slug] read page.
export const revalidate = 1800;

const SITE = "https://metatake.net";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

function load() {
  return unstable_cache(
    async () => {
      const { data, error } = await db().rpc("for_w_heo_films");
      if (error) throw new Error(`for_w_heo_films: ${error.message}`);
      return (data as WHeoFilm[] | null) ?? [];
    },
    ["for-w-heo-films1"],
    { revalidate: 1800, tags: ["for-w-heo"] },
  )();
}

const TITLE = "for W. Heo — the essential films every cinephile should see";
const DESC =
  "Our curated list of essential viewing: the films Metatake marks as required watching for cinephiles. Browse by year, genre, director or title — poster grid, sortable and filterable.";

export const metadata: Metadata = {
  alternates: { canonical: "/lineage/for-w-heo" },
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, url: `${SITE}/lineage/for-w-heo` },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export default async function ForWHeoPage() {
  const films = await load();
  const directors = new Set(films.map((f) => f.director).filter(Boolean)).size;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE}/lineage/for-w-heo`,
        name: TITLE,
        description: DESC,
        isPartOf: { "@type": "WebSite", "@id": "https://metatake.net" },
      },
      {
        "@type": "ItemList",
        name: "for W. Heo — essential films",
        numberOfItems: films.length,
        itemListElement: films.slice(0, 100).map((f, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: { "@type": "Movie", name: f.title, url: `${SITE}/film/${f.slug}`, ...(f.year ? { datePublished: String(f.year) } : {}) },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
          { "@type": "ListItem", position: 2, name: "Lineage", item: "https://metatake.net/lineage" },
          { "@type": "ListItem", position: 3, name: "for W. Heo", item: `${SITE}/lineage/for-w-heo` },
        ],
      },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-wrap lh">
        <div className="lh-crumb">
          <Link href="/">Home</Link> › <Link href="/lineage">Lineage</Link> › for W. Heo
        </div>
        <h1 className="lh-h1">for W. Heo</h1>
        <p className="lh-def">
          The films we recommend to cinephiles — from canon <strong>essentials</strong> and approachable
          <strong> start-here</strong> picks to auteur <strong>deep cuts</strong>.{" "}
          {`${films.length} films across ${directors} directors`}, each on a major critics&apos; canon, a top festival, or its
          director&apos;s own auteur line.{" "}
          <Link href="/methodology#index" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>How we choose them →</Link>
        </p>
        <div style={{ margin: "10px 0 4px" }}>
          <ShareDock variant="bar" path="/lineage/for-w-heo" title={TITLE}
            hook={`Metatake's essential-films list — ${films.length} cinephile must-sees, sortable by year, genre and director`}
            saveType="lineage" saveRef="for-w-heo" />
        </div>

        <ForWHeoList films={films} />
      </div>
    </div>
  );
}
