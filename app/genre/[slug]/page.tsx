import { createClient } from "@supabase/supabase-js";
import ShareDock from "@/components/ShareDock";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import PlaylistTVEmbed from "@/components/PlaylistTVEmbed";
import ListFilter from "@/components/ListFilter";
import LensQuickBar from "@/components/LensQuickBar";

export const revalidate = 600;
export async function generateStaticParams() { return []; }

interface Props { params: Promise<{ slug: string }>; }
function unslug(s: string) { return s.replace(/-/g, " "); }
// The one genre matcher this page uses — visible list and hidden archive both go through it.
function slugifyGenre(g: string) { return g.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
const IMG = "https://image.tmdb.org/t/p";
type HiddenFilm = { title: string; original_title: string | null; slug: string; year: number | null; poster_path: string | null };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${unslug(slug)} — films`, alternates: { canonical: `/genre/${slug}` } };
}

export default async function GenrePage({ params }: Props) {
  const { slug } = await params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  // PostgREST caps every response at 1,000 rows regardless of .limit(), and the
  // catalog holds 1,900+ visible films — page through with .range() (same
  // pattern as fetchAll in lib/sitemap-data.ts) so genre lists don't undercount.
  type FilmRow = { title: string; slug: string; year: number | null; genres: string[] | null };
  const PAGE = 1000;
  const films: FilmRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("films").select("title, slug, year, genres")
      .eq("visible", true).order("slug").range(from, from + PAGE - 1);
    if (!data?.length) break;
    films.push(...(data as FilmRow[]));
    if (data.length < PAGE) break;
  }
  const want = slug.toLowerCase();
  const inGenre = films.filter((f) =>
    ((f.genres ?? []) as string[]).some((g) => slugifyGenre(g) === want)
  ).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  if (inGenre.length === 0) notFound();

  // Layer 2 — hidden catalog films in this genre. Membership uses the SAME
  // slugify matching: the exact genre strings that map to this slug (taken
  // from the visible rows above) are matched against films.genres.
  const genreNames = [...new Set(
    films.flatMap((f) => (f.genres ?? []) as string[]).filter((g) => slugifyGenre(g) === want)
  )];
  let hidden: HiddenFilm[] = [];
  let hiddenTotal = 0;
  if (genreNames.length) {
    const { data: h, count } = await supabase
      .from("films")
      .select("title, original_title, slug, year, poster_path", { count: "exact" })
      .eq("visible", false)
      .overlaps("genres", genreNames)
      .order("year", { ascending: false, nullsFirst: false })
      .order("slug")
      .limit(24);
    hidden = (h as HiddenFilm[] | null) ?? [];
    hiddenTotal = count ?? hidden.length;
  }
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/genre">Genres</Link></div>
        <h1 className="mt-h1" style={{ textTransform: "capitalize" }}>{unslug(slug)}</h1>
        <div className="mt-share">
          <ShareDock variant="bar" path={`/genre/${slug}`} title={`${unslug(slug)} films`}
            hook={`${inGenre.length} ${unslug(slug)} films on Metatake — ranked by TakeScore, read scene by scene`} />
          <ShareDock variant="fab" path={`/genre/${slug}`} title={`${unslug(slug)} films`} />
        </div>
        <LensQuickBar />
        <ListFilter targetId="genre-list" total={inGenre.length} placeholder="Filter these films…" />
        <ul className="mt-list mtl-rows" id="genre-list" style={{ marginTop: 12 }}>
          {inGenre.map((f) => (
            <li key={f.slug} data-lens-film={f.slug} data-filter-item data-filter-text={`${f.title} ${f.year ?? ""}`.toLowerCase()}><Link href={`/film/${f.slug}`}>{f.title}</Link> <span className="meta">({f.year ?? "?"})</span></li>
          ))}
        </ul>

        {/* Layer 2 — the hidden catalog as members of this genre. Server-rendered
            plain <a> list; these films' own pages stay out of the index. */}
        {hidden.length > 0 && (
          <section className="mvh-sec">
            <h2 className="mvh-h2" style={{ textTransform: "capitalize" }}>More {unslug(slug)} films in the archive</h2>
            <p className="mvh-note">Catalog entries, not yet read closely — each has its own film page; the close readings are still to come.</p>
            <div className="mvh-films">
              {hidden.map((f) => (
                <a className="mvh-film" key={f.slug} href={`/film/${f.slug}`}>
                  {f.poster_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="mvh-poster" src={`${IMG}/w185${f.poster_path}`} alt="" width={185} height={278} loading="lazy" />
                  ) : <div className="mvh-poster mvh-poster--empty" aria-hidden="true" />}
                  <div className="mvh-fmeta">
                    <div className="mvh-ftitle">{f.title}{f.year ? <span className="mvh-yr"> ({f.year})</span> : null}</div>
                    {f.original_title && f.original_title !== f.title ? <div className="mvh-fdir">{f.original_title}</div> : null}
                  </div>
                </a>
              ))}
            </div>
            {hiddenTotal > hidden.length ? (
              <p className="mvh-note" style={{ marginTop: 16 }}>+ {hiddenTotal - hidden.length} more in the archive.</p>
            ) : null}
          </section>
        )}

        <PlaylistTVEmbed slug={`genre-${slug}`} heading={`${unslug(slug).replace(/\b\w/g, (c) => c.toUpperCase())} films on METATAKE TV`} />
      </div>
    </div>
  );
}
