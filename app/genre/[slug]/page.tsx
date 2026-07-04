import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import ListFilter from "@/components/ListFilter";

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
  const { data: films } = await supabase.from("films").select("title, slug, year, genres").eq("visible", true).limit(5000);
  const want = slug.toLowerCase();
  const inGenre = (films ?? []).filter((f) =>
    ((f.genres ?? []) as string[]).some((g) => slugifyGenre(g) === want)
  ).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  if (inGenre.length === 0) notFound();

  // Layer 2 — hidden catalog films in this genre. Membership uses the SAME
  // slugify matching: the exact genre strings that map to this slug (taken
  // from the visible rows above) are matched against films.genres.
  const genreNames = [...new Set(
    (films ?? []).flatMap((f) => (f.genres ?? []) as string[]).filter((g) => slugifyGenre(g) === want)
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
        <ListFilter targetId="genre-list" total={inGenre.length} placeholder="Filter these films…" />
        <ul className="mt-list" id="genre-list" style={{ marginTop: 12 }}>
          {inGenre.map((f) => (
            <li key={f.slug} data-filter-item data-filter-text={`${f.title} ${f.year ?? ""}`.toLowerCase()}><Link href={`/film/${f.slug}`}>{f.title}</Link> <span className="meta">({f.year ?? "?"})</span></li>
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
      </div>
    </div>
  );
}
