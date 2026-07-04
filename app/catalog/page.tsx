import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { SECTIONS, sectionCounts, sectionHref, nodeHref, type KindCount } from "@/lib/catalog";

export const revalidate = 600;

const SITE = "https://metatake.net";
const TITLE = "Film Archetypes — what each figure is";
const DESC =
  "The film archetypes catalogue — a controlled vocabulary for every figure in the archive: character archetypes, objects, places, themes and theory. Browse cinema by what its elements are, not only what they mean.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/catalog" },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Top = { slug: string; label: string; code: string | null; n: number };

export default async function CatalogHub() {
  const supabase = db();
  const { data: countRows } = await supabase.rpc("catalog_kind_counts");
  const counts = sectionCounts((countRows as KindCount[]) ?? []);

  // featured named archetypes per section (skip theory — sourced from the canon)
  const featutedKinds = SECTIONS.filter((s) => s.key !== "theory");
  const tops = await Promise.all(
    featutedKinds.map((s) => supabase.rpc("catalog_top_nodes", { p_kind: s.primaryKind, p_n: 4 }))
  );
  const topBySection: Record<string, Top[]> = {};
  featutedKinds.forEach((s, i) => { topBySection[s.key] = (tops[i].data as Top[]) ?? []; });

  // Theory section is sourced from the concept layer (takes.concept), not figure_taxonomy.
  const { data: cRows } = await supabase.rpc("concept_index");
  const concepts = (cRows as { slug: string; title: string; n: number }[]) ?? [];
  const conceptCount = concepts.length;
  topBySection["theory"] = concepts.slice(0, 4).map((c) => ({ slug: c.slug, label: c.title, code: null, n: c.n }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE}/catalog`,
        url: `${SITE}/catalog`,
        name: TITLE,
        description: DESC,
        about: {
          "@type": "DefinedTerm",
          name: "film archetype",
          description:
            "A named answer to what a figure is — the character-type, object, place or theme a figure on screen instantiates, held in a controlled vocabulary so the same name means the same thing across every film.",
        },
      },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE },
        { "@type": "ListItem", position: 2, name: "Archetypes", item: `${SITE}/catalog` },
      ] },
      { "@type": "ItemList", numberOfItems: SECTIONS.length,
        itemListElement: SECTIONS.map((s, i) => ({
          "@type": "ListItem", position: i + 1, name: s.cardTitle, url: `${SITE}${sectionHref(s.key)}`,
        })) },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="cat-wrap">
        <div className="cat-kick">Archetype</div>
        <h1 className="cat-h1">What each figure <em>is</em></h1>
        <p className="cat-intro">
          A controlled vocabulary for every figure in the archive — its <strong>objects</strong>,{" "}
          <strong>characters</strong>, <strong>places</strong>, <strong>themes</strong>, and{" "}
          <strong>theory</strong>. This is the descriptive layer: what a figure <em>is</em>. It sits
          beside <Link href="/tropes">Tropes</Link>, the interpretive layer — what a figure{" "}
          <em>means</em>.
        </p>

        <div className="cat-sections">
          {SECTIONS.map((s) => {
            const c = counts[s.key];
            const feat = topBySection[s.key] ?? [];
            return (
              <section key={s.key} className="cat-scard">
                <Link href={sectionHref(s.key)} className="cat-scard__h">
                  <i className={`ti ti-${s.icon}`} aria-hidden="true" />
                  <span className="cat-scard__title">{s.cardTitle}</span>
                </Link>
                <div className="cat-scard__count">
                  {s.key === "theory"
                    ? `${conceptCount.toLocaleString()} concepts · from the readings`
                    : `${c.nodes.toLocaleString()} ${s.key === "themes" ? "themes" : "archetypes"} · ${c.figures.toLocaleString()} figures`}
                </div>
                <p className="cat-scard__blurb">{s.blurb}</p>
                {feat.length > 0 ? (
                  <div className="cat-chips">
                    {feat.map((f) => (
                      <Link key={f.slug} href={s.key === "theory" ? `/concept/${f.slug}` : nodeHref(s.primaryKind, f.slug)} className="cat-chip">
                        {f.label}<span className="cat-chip__n">{f.n}</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
                <Link href={s.key === "theory" ? "/concept" : sectionHref(s.key)} className="cat-scard__go">
                  Browse {s.label} <span aria-hidden="true">→</span>
                </Link>
              </section>
            );
          })}
        </div>

        {/* Definitional landing block — the head-term surface ("film archetypes",
            "character archetypes in film") this hub is aligned to. Mirrors /tropes. */}
        <section aria-labelledby="what-is-a-film-archetype" style={{ marginTop: 56, maxWidth: 760 }}>
          <h2 id="what-is-a-film-archetype" className="df-h2">What is a film archetype?</h2>
          <p className="idx-intro">
            A film archetype names what a figure <em>is</em>. Character archetypes are the familiar half of the
            vocabulary — <a href="/catalog/character/tragic-hero">the tragic hero</a> alone accounts for hundreds of
            figures in this archive — but characters are only one section. Objects have archetypes too (
            <a href="/catalog/object/symbolic-animal">the symbolic animal</a>), and so do places (
            <a href="/catalog/place/noir-city">the noir city</a>) and themes. An archetype is not a judgment about
            quality or originality; it is a classification, the noun a figure answers to.
          </p>
          <p className="idx-intro">
            Most lists of movie archetypes stop at a dozen character labels borrowed from screenwriting manuals.
            Metatake treats the vocabulary as controlled: every archetype here is a node in a taxonomy, and every
            node is backed by the actual figures classified under it — the exact character, object or place, in the
            exact film, each linked to its close reading. Open any archetype and you get its members, not an essay
            about heroes in general.
          </p>
          <p className="idx-intro">
            An archetype is also not a <a href="/tropes">trope</a>. An archetype says what a figure <em>is</em> — a
            mentor, a threshold, an heirloom — while a trope tracks how a kind of thing <em>recurs</em> and
            accumulates meaning across cinema. The two catalogues cross-reference each other; start from whichever
            end of the question you hold.
          </p>
        </section>
      </div>
    </div>
  );
}
