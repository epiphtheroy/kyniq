import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import LineageTabsClient, { type IdxRow } from "@/components/LineageTabsClient";
import type { MvHub } from "@/app/movements/page";

export const revalidate = 1800;

const TITLE = "Lineage — national cinemas, movements, awards & canons";
const DESC =
  "Where a film comes from and where it sits in cinema's record: national cinemas and movements, the awards it won and the canons it entered. Browse any tradition to see the films that belong to it.";

export const metadata: Metadata = {
  alternates: { canonical: "/lineage" },
  // No brand suffix here — the root layout template appends "· Metatake".
  title: TITLE,
  description: DESC,
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function LineageIndex() {
  const supabase = db();
  const [{ data: idx }, { data: mv }] = await Promise.all([
    supabase.rpc("lineage_index"),
    supabase.rpc("movements_index"),
  ]);
  const lists = (idx as IdxRow[] | null) ?? [];
  const mvd = (mv as { national: MvHub[]; movements: MvHub[] } | null) ?? { national: [], movements: [] };

  // Mirror the hub cards LineageTabsClient renders: national + movement hubs
  // with at least one film, linked to /movements/{slug}.
  const hubs = [...(mvd.national ?? []), ...(mvd.movements ?? [])].filter((h) => h.film_count > 0);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": "https://metatake.net/lineage",
        name: TITLE,
        description: DESC,
        isPartOf: { "@type": "WebSite", "@id": "https://metatake.net" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
          { "@type": "ListItem", position: 2, name: "Lineage", item: "https://metatake.net/lineage" },
        ],
      },
      {
        "@type": "ItemList",
        numberOfItems: hubs.length,
        itemListElement: hubs.slice(0, 20).map((h, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: h.label,
          url: `https://metatake.net/movements/${h.slug}`,
        })),
      },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-wrap lh">
        <h1 className="lh-h1">Lineage</h1>
        <p className="lh-def">
          Where a film comes from and where it sits in cinema&apos;s record — its <span className="term">national cinema</span> and
          <span className="term"> movement</span>, the awards it won and the canons it entered. Pick a tradition to see its films;
          open a film&apos;s <em>Lineage</em> tab to see everything it belongs to.
        </p>
        <LineageTabsClient national={mvd.national ?? []} movements={mvd.movements ?? []} lists={lists} />
      </div>
    </div>
  );
}
