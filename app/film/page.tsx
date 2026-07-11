import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import FilmsIndex, { type FilmFeat, type FilmCat } from "@/components/indexes/FilmsIndex";
import LensQuickBar from "@/components/LensQuickBar";
import MineEntityIndex from "@/components/MineEntityIndex";
import { filmUrl } from "@/lib/urls";

export const revalidate = 1800;

const TITLE = "Films — read closely through their figures";
const DESC =
  "Not a movie database. Every film on Metatake is broken into its figures and the readings & tropes they carry, then wired to every other film that shares them.";
const ALL_DESC =
  "Every film in the Metatake database, newest first — the read-closely catalogue plus the catalog tier still waiting for its close reading.";

interface Props { searchParams: Promise<{ view?: string; page?: string }> }

// Each ?view=all page is its own indexable surface: unique title, self-canonical,
// crawlable prev/next links in the body. Never noindex past page 1.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { view, page } = await searchParams;
  if (view === "all") {
    const p = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
    const title = p <= 1 ? "All films — the full catalogue" : `All films — page ${p}`;
    const canonical = p <= 1 ? "/film?view=all" : `/film?view=all&page=${p}`;
    return {
      title,
      description: ALL_DESC,
      alternates: { canonical },
      openGraph: { title, description: ALL_DESC, url: canonical },
    };
  }
  return {
    title: TITLE,
    description: DESC,
    alternates: { canonical: "/film" },
    openGraph: { title: TITLE, description: DESC, url: "/film" },
  };
}

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
        <MineEntityIndex kind="films" hrefBase="/film/" noun="films" imgShape="poster" />

        <section className="idx-grp mtl-swap-out">
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

type FilmCatalogue = { total: number; items: FilmCat[] };

export default async function FilmIndexPage({ searchParams }: Props) {
  const { view, page } = await searchParams;
  if (view === "all") return <AllFilmsView pageParam={page} />;

  const supabase = db();
  const [featuredRes, catRes, invRes] = await Promise.all([
    supabase.rpc("films_featured", { p_n: 12 }),
    // v2 returns one jsonb row {total, items} — the TABLE-returning v1 was
    // silently truncated to 1,000 of 1,935 visible films by PostgREST's row cap.
    supabase.rpc("films_catalogue_v2"),
    // Whole-inventory count (both tiers) for the "browse all" pointer below.
    supabase.from("films").select("slug", { count: "exact", head: true }).not("slug", "like", "tmdb-%"),
  ]);

  const featured = ((featuredRes.data as FilmFeat[] | null) ?? []).filter((f) => f && f.readingList?.length);
  const cat = (catRes.data as FilmCatalogue | null) ?? { total: 0, items: [] };
  const catalogue = cat.items;
  const inventoryTotal = invRes.count ?? 0;

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
        // Representative of the catalogue, not just the featured deck:
        // numberOfItems is the DB-real total; the elements are the first 100 A–Z.
        "@type": "ItemList",
        numberOfItems: cat.total,
        itemListElement: catalogue.slice(0, 100).map((f, i) => ({
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
        <LensQuickBar />
        <MineEntityIndex kind="films" hrefBase="/film/" noun="films" imgShape="poster" />

        <div className="mtl-swap-out">
          <FilmsIndex featured={featured} catalogue={catalogue} inventoryTotal={inventoryTotal} />
        </div>
      </div>
    </div>
  );
}
