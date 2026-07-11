import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import DirectorsIndex, { type DirCat } from "@/components/indexes/DirectorsIndex";
import LensQuickBar from "@/components/LensQuickBar";
import MineEntityIndex from "@/components/MineEntityIndex";
import { directorUrl } from "@/lib/urls";

export const revalidate = 1800;

const TITLE = "Directors — the recurring obsessions of a filmography";
const DESC =
  "Not a filmography list. On Metatake a director is the sum of their obsessions — the signature readings and tropes that recur across a whole body of work.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/director" },
  openGraph: { title: TITLE, description: DESC, url: "/director" },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type DirCatalogue = { total: number; items: DirCat[] };

export default async function DirectorIndexPage() {
  const supabase = db();
  const catRes = await supabase.rpc("directors_catalogue_v2");

  const cat = (catRes.data as DirCatalogue | null) ?? { total: 0, items: [] };
  const catalogue = cat.items;
  const total = cat.total;
  // server-seeded spotlight (loads from first paint; "↻ another" rotates)
  const spotlightSlug = catalogue.length ? catalogue[Math.floor(Math.random() * catalogue.length)].slug : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": "https://metatake.net/director",
        name: TITLE,
        description: DESC,
        isPartOf: { "@type": "WebSite", "@id": "https://metatake.net" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
          { "@type": "ListItem", position: 2, name: "Directors", item: "https://metatake.net/director" },
        ],
      },
      {
        // Representative of the catalogue, not just the featured deck:
        // numberOfItems is the DB-real total; the elements are the first 100 A–Z.
        "@type": "ItemList",
        numberOfItems: total,
        itemListElement: catalogue.slice(0, 100).map((d, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: d.name,
          url: `https://metatake.net${directorUrl(d.slug)}`,
        })),
      },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-wrap idx">
        <LensQuickBar />
        <MineEntityIndex kind="directors" hrefBase="/director/" noun="directors" filmsNoun="of yours" imgShape="round" />

        <div className="mtl-swap-out">
          <DirectorsIndex
            catalogue={catalogue}
            initialSlug={spotlightSlug}
          />
        </div>
      </div>
    </div>
  );
}
