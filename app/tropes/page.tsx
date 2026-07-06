import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import IndexPattern, { type IdxCase, type IdxFeature, type IdxItem } from "@/components/IndexPattern";
import LensQuickBar from "@/components/LensQuickBar";
import MineEntityIndex from "@/components/MineEntityIndex";
import { tropeUrl } from "@/lib/urls";

export const revalidate = 1800;

const TITLE = "Film Tropes — the figure-types that recur across cinema";
const DESC =
  "Film tropes catalogued by close reading — the devices, situations and objects that return across cinema, each tied to the exact figures that carry it and the readings that say what the recurrence means.";

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
        about: {
          "@type": "DefinedTerm",
          name: "film trope",
          description:
            "A figure cinema keeps reaching for — an object, situation, character-type or piece of staging that returns across films and accumulates meaning through that recurrence.",
        },
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
        <LensQuickBar />
        <MineEntityIndex kind="tropes" hrefBase="/trope/" noun="tropes" />

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

        <div className="mtl-swap-out">
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

        {/* Definitional landing block — the head-term surface ("film tropes",
            "movie tropes") Google is already testing this page against. */}
        <section aria-labelledby="what-is-a-film-trope" style={{ marginTop: 56, maxWidth: 760 }}>
          <h2 id="what-is-a-film-trope" className="df-h2">What is a film trope?</h2>
          <p className="idx-intro">
            A film trope is a figure cinema keeps reaching for — an object, a situation, a kind of character or a
            piece of staging that returns, film after film, because it does dependable dramatic work:{" "}
            <a href="/trope/the-object-that-will-not-be-mourned">the object that will not be mourned</a>,{" "}
            <a href="/trope/the-held-shot-as-ethical-witness">the held shot as ethical witness</a>,{" "}
            <a href="/trope/the-refuge-that-is-secretly-a-border">the refuge that is secretly a border</a>. Calling
            something a trope is not an accusation. A cliché is a figure used without thought; a trope is a figure
            with a history — and that history is exactly what makes it readable.
          </p>
          <p className="idx-intro">
            Most catalogues of movie tropes stop at spotting: name the device, list the films, move on. Metatake
            starts where spotting ends. Every trope here is documented at the level of the <em>figure</em> — the
            exact scene, object or character that carries it — and wired to the close readings that say what the
            recurrence <em>means</em>. Each trope page is less a trivia entry than a map: the films that share the
            figure, and the interpretive traditions that have fought over it.
          </p>
          <p className="idx-intro">
            A trope is also not an <a href="/catalog">archetype</a>. An archetype says what a figure <em>is</em> — a
            mentor, a threshold, an heirloom — while a trope tracks how a kind of thing <em>recurs</em> and
            accumulates meaning across cinema. The two catalogues cross-reference each other; start from whichever
            end of the question you hold.
          </p>
        </section>
      </div>
    </div>
  );
}
