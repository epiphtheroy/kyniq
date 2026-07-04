import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import IndexPattern, { type IdxCase, type IdxFeature, type IdxItem } from "@/components/IndexPattern";
import { tropeUrl } from "@/lib/urls";

export const revalidate = 1800;

const TITLE = "Tropes — figure-types that recur across cinema";
const DESC =
  "Recurring figure-types — the devices, situations and objects that return across films. Where a meta take is a recurring reading, a trope is a recurring kind of thing.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/tropes" },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type TropeRow = { slug: string; title: string; lac: string | null; def: string | null; figs: number; films: number; cases: IdxCase[] };

export default async function TropesIndex() {
  const supabase = db();
  const [featuredRes, catRes] = await Promise.all([
    supabase.rpc("tropes_featured", { p_n: 12 }),
    supabase.rpc("tropes_catalogue"),
  ]);

  const featured: IdxFeature[] = ((featuredRes.data as TropeRow[] | null) ?? [])
    .filter((r) => r && r.cases?.length)
    .map((r) => ({
      slug: r.slug, title: r.title, lac: r.lac, thesis: null, def: r.def,
      n: r.films, figs: r.figs, reg: null, family: null, theorist: null, cases: r.cases,
    }));
  const catalogue = (catRes.data as IdxItem[] | null) ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": "https://metatake.net/tropes",
        name: TITLE,
        description: DESC,
        isPartOf: { "@type": "WebSite", "@id": "https://metatake.net" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
          { "@type": "ListItem", position: 2, name: "Tropes", item: "https://metatake.net/tropes" },
        ],
      },
      {
        "@type": "ItemList",
        numberOfItems: catalogue.length,
        itemListElement: featured.map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: r.title,
          url: `https://metatake.net${tropeUrl(r.slug)}`,
        })),
      },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-wrap idx idx--teal">
        <h1 className="idx-h1">Tropes</h1>

        <p className="idx-def">
          Recurring <span className="term">figure-types</span> — the dramatic devices, situations and objects that
          return across films. Where a <span className="term r">meta take</span> is a recurring <em>reading</em> (what
          something <em>means</em>), a trope is a recurring <em>kind of thing</em> (what it <em>is</em>). A working
          catalogue for readers — and for writers.
        </p>

        <p className="idx-intro">
          <strong>Pick one and see it recur.</strong> Each trope opens onto the films that instantiate it — and,
          crucially, the exact <em>figure</em> on screen where it appears. Start with one at random, then browse the
          catalogue below.
        </p>

        <IndexPattern
          featured={featured}
          catalogue={catalogue}
          rowBase="/trope"
          unit="films"
          variant="trope"
          totOverride="a working catalogue"
          showSeeded={false}
          defaultSort="alpha"
          catalogueTitle="The full catalogue of tropes"
          catalogueSub="Every figure-type on Metatake — the devices, situations and objects that recur across cinema. Click any one to open it."
          filterPlaceholder="Filter tropes…"
          emptyText="No trope matches that."
        />
      </div>
    </div>
  );
}
