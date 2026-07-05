import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import FilmsIndex, { type FilmFeat, type FilmCat } from "@/components/indexes/FilmsIndex";
import LensQuickBar from "@/components/LensQuickBar";
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

/* ---- "All films" view (?view=all) — the whole films table, both tiers ---- */

const ALL_PAGE_SIZE = 120; // 40 rows of the existing 3-col grid; well under Supabase's 1000-row cap

type FilmAll = { slug: string; title: string; year: number | null; director: string | null; poster_path: string | null; visible: boolean | null };

const allHref = (p: number) => (p <= 1 ? "/film?view=all" : `/film?view=all&page=${p}`);

function ViewTabs({ all }: { all: boolean }) {
  return (
    <div className="idx-tabs">
      <span className="l">View</span>
      <Link className="vtab" data-on={all ? undefined : ""} href="/film">Featured &amp; read closely</Link>
      <Link className="vtab" data-on={all ? "" : undefined} href="/film?view=all">Full catalogue</Link>
    </div>
  );
}

async function AllFilmsView({ pageParam }: { pageParam?: string }) {
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * ALL_PAGE_SIZE;
  // Direct table read — unlike the films_featured/films_catalogue RPCs this is
  // NOT visible-gated: Tier-2 catalog films (visible=false) show too, marked.
  // 'tmdb-…' slugs are stub rows pending slug repair — excluded.
  const { data, count } = await db()
    .from("films")
    .select("slug, title, year, director, poster_path, visible", { count: "exact" })
    .not("slug", "like", "tmdb-%")
    .order("year", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true })
    .range(from, from + ALL_PAGE_SIZE - 1);
  const films = ((data as FilmAll[] | null) ?? []);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / ALL_PAGE_SIZE));

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap idx">
        <h1 className="idx-h1">Films</h1>

        <p className="idx-def">
          <b>The full catalogue.</b> Every film in the Metatake database, newest first — including films we haven&apos;t
          read closely yet, marked <span className="t2-chip" style={{ marginLeft: 0 }}>catalog</span>. Their pages hold
          the basics for now; the close reading comes when they graduate into the main catalogue.
        </p>

        <ViewTabs all />
        <LensQuickBar />

        <section className="idx-grp">
          <div className="idx-grph">All films <span className="gc">{total.toLocaleString()}</span></div>
          <div className="idx-fcols">
            {films.map((f) => (
              <Link key={f.slug} href={`/film/${f.slug}`} className="idx-fcell">
                <span className="ft">
                  {f.title} {f.year ? <span className="yr">({f.year})</span> : null}
                  {f.visible === false ? <span className="t2-chip">catalog</span> : null}
                </span>
                <span className="fd">{f.director ?? "—"}</span>
              </Link>
            ))}
          </div>
          {films.length === 0 && <p className="idx-empty" style={{ display: "block" }}>Nothing on this page.</p>}
        </section>

        <div className="idx-tabs" style={{ marginTop: 18 }}>
          {page > 1 && <Link className="vtab" href={allHref(page - 1)}>← Previous</Link>}
          {page < pages && <Link className="vtab" href={allHref(page + 1)}>Next →</Link>}
          <span className="tot">Page {page.toLocaleString()} of {pages.toLocaleString()} · {total.toLocaleString()} films</span>
        </div>
      </div>
    </div>
  );
}

interface Props { searchParams: Promise<{ view?: string; page?: string }> }

export default async function FilmIndexPage({ searchParams }: Props) {
  const { view, page } = await searchParams;
  if (view === "all") return <AllFilmsView pageParam={page} />;

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

        <ViewTabs all={false} />
        <LensQuickBar />

        <FilmsIndex featured={featured} catalogue={catalogue} />
      </div>
    </div>
  );
}
