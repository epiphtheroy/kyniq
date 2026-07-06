import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import DirectorsIndex, { type DirFeat, type DirCat } from "@/components/indexes/DirectorsIndex";
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
  const [featuredRes, catRes] = await Promise.all([
    supabase.rpc("directors_featured", { p_n: 12 }),
    supabase.rpc("directors_catalogue_v2"),
  ]);

  const featured = ((featuredRes.data as DirFeat[] | null) ?? []).filter((d) => d && d.tropesList?.length);
  const cat = (catRes.data as DirCatalogue | null) ?? { total: 0, items: [] };
  const catalogue = cat.items;
  const total = cat.total;

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
        <h1 className="idx-h1">Directors</h1>
        <LensQuickBar />
        <MineEntityIndex kind="directors" hrefBase="/director/" noun="directors" filmsNoun="of your films" />

        <p className="idx-def">
          <b>Not a filmography list.</b> On Metatake a director is the sum of their obsessions. We break every film into
          its <span className="term">figures</span>, then compute what recurs across a whole body of work — the{" "}
          <span className="term">signature readings</span> and <span className="term t">signature tropes</span> that make
          a film unmistakably theirs.
        </p>

        <p className="idx-intro">
          <strong>{total.toLocaleString()} directors.</strong> Each signature is shown with the{" "}
          <em>figure</em> that carries it — the concrete thing on screen, traced through one of the director&apos;s films.
          Start with one at random, then browse the catalogue below.
        </p>

        <div className="mtl-swap-out">
          <DirectorsIndex featured={featured} catalogue={catalogue} />
        </div>
      </div>
    </div>
  );
}
