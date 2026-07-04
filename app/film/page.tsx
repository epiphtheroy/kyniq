import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import FilmsIndex, { type FilmFeat, type FilmCat } from "@/components/indexes/FilmsIndex";
import { filmUrl } from "@/lib/urls";

export const revalidate = 1800;

const TITLE = "Films — read closely through their figures";
const DESC =
  "Not a movie database. Every film on Metatake is broken into its figures and the readings & tropes they carry, then wired to every other film that shares them.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/film" },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function FilmIndexPage() {
  const supabase = db();
  const [featuredRes, catRes] = await Promise.all([
    supabase.rpc("films_featured", { p_n: 12 }),
    supabase.rpc("films_catalogue"),
  ]);

  const featured = ((featuredRes.data as FilmFeat[] | null) ?? []).filter((f) => f && f.readingList?.length);
  const catalogue = (catRes.data as FilmCat[] | null) ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": "https://metatake.net/film",
        name: TITLE,
        description: DESC,
        isPartOf: { "@type": "WebSite", "@id": "https://metatake.net" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
          { "@type": "ListItem", position: 2, name: "Films", item: "https://metatake.net/film" },
        ],
      },
      {
        "@type": "ItemList",
        numberOfItems: catalogue.length,
        itemListElement: featured.map((f, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: f.year ? `${f.title} (${f.year})` : f.title,
          url: `https://metatake.net${filmUrl(f.slug)}`,
        })),
      },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-wrap idx">
        <h1 className="idx-h1">Films</h1>

        <p className="idx-def">
          <b>Not a movie database.</b> Metatake reads each film through its <span className="term">figures</span> — the
          faces, objects, places and gestures critics single out — and the <span className="term">readings</span> &amp;{" "}
          <span className="term">tropes</span> those figures carry. A film here isn&apos;t a rating; it&apos;s a bundle of
          meanings, wired by AI embeddings to every other film that shares them.
        </p>

        <p className="idx-intro">
          <strong>Pick one and follow the thread.</strong> Each film opens onto its kin — not lookalikes, not the same
          genre or director, but films that <em>rhyme</em> in meaning. Start with one at random, then browse the
          catalogue below.
        </p>

        <FilmsIndex featured={featured} catalogue={catalogue} />
      </div>
    </div>
  );
}
