import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/home2/SiteNav";
import LineageActions from "@/components/LineageActions";

export const revalidate = 1800;
// Empty list enables the on-demand Full Route Cache (ISR HIT) without
// prebuilding anything at build time.
export async function generateStaticParams() { return []; }
const IMG = "https://image.tmdb.org/t/p";

type Props = { params: Promise<{ slug: string }> };

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type ListRow = { label: string; facet: string; description: string | null; country: string | null; tier: string | null; film_count: number };
type FilmRow = { film_slug: string; film_title: string; film_year: number | null; poster_path: string | null; visible: boolean; analyzed: boolean; result: string | null; rank: number | null; edition_year: number | null; rep_type: string | null };

const FACET_LABEL: Record<string, string> = {
  award: "Award", canon: "Canon / list", national: "National honour", festival: "Festival", section: "Festival section", auteur: "Auteur line", movement: "Movement", style: "Style",
};

// Hidden members (catalog entries) in deterministic order: year desc, then slug.
function hiddenOf(films: FilmRow[]): FilmRow[] {
  return films
    .filter((f) => !f.visible)
    .sort((a, b) => (b.film_year ?? 0) - (a.film_year ?? 0) || a.film_slug.localeCompare(b.film_slug));
}

// Cached per slug so the page is ISR-cached instead of re-querying on every
// request (uncached Supabase calls otherwise force dynamic rendering).
function load(slug: string) {
  return unstable_cache(
    async () => {
      const supabase = db();
      const { data: list } = await supabase
        .from("lineage_lists")
        .select("label, facet, description, country, tier, film_count")
        .eq("slug", slug).maybeSingle();
      if (!list) return null;
      const { data: films } = await supabase.rpc("lineage_list_films", { p_slug: slug });
      const rows = (films as FilmRow[] | null) ?? [];
      // Native titles for the hidden-member cards (top 24 only — keeps the
      // extra query one cheap .in() inside this cache wrapper).
      let hiddenNative: Record<string, string | null> = {};
      const hiddenTop = hiddenOf(rows).slice(0, 24).map((f) => f.film_slug);
      if (hiddenTop.length) {
        const { data: nat } = await supabase.from("films").select("slug, title, original_title").in("slug", hiddenTop);
        hiddenNative = Object.fromEntries(
          ((nat ?? []) as { slug: string; title: string; original_title: string | null }[])
            .map((r) => [r.slug, r.original_title && r.original_title !== r.title ? r.original_title : null])
        );
      }
      return { list: list as unknown as ListRow, films: rows, hiddenNative };
    },
    ["lineage2", slug],
    { revalidate: 1800, tags: [`lineage:${slug}`] },
  )();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const title = `${data.list.label} — films in this lineage — Metatake`;
  return { title, description: `Films that belong to ${data.list.label}: ${data.list.film_count} on Metatake, with results and rankings.`, alternates: { canonical: `/lineage/${slug}` } };
}

export default async function LineagePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { list, films } = data;
  const hiddenNative = data.hiddenNative ?? {};
  const visibleFilms = films.filter((f) => f.visible);
  const hiddenFilms = hiddenOf(films);
  const isCanon = list.facet === "canon" || films.some((f) => f.rank != null);

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <div className="lh-crumb"><Link href="/lineage">Lineage</Link></div>
        <h1 className="lh-h1">{list.label}</h1>
        <div className="lh-kick">
          {FACET_LABEL[list.facet] ?? list.facet}
          {list.country ? ` · ${list.country.toUpperCase()}` : ""}
          <span className="lh-cnt">{list.film_count} films</span>
        </div>
        {list.description ? <p className="lh-def">{list.description}</p> : null}
        <LineageActions slug={slug} />

        <div className="lh-films">
          {visibleFilms.map((f, i) => (
            <div className="lh-film" key={i}>
              {f.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="lh-poster" src={`${IMG}/w92${f.poster_path}`} alt="" loading="lazy" />
              ) : <div className="lh-poster lh-poster--empty" aria-hidden="true" />}
              <div className="lh-fmeta">
                <div className="lh-ftitle">
                  {isCanon && f.rank ? <span className="lh-rank">#{f.rank}</span> : null}
                  <Link href={`/film/${f.film_slug}`}>{f.film_title}</Link>
                  {f.film_year ? <span className="lh-yr"> ({f.film_year})</span> : null}
                </div>
                <div className="lh-fsub">
                  {f.result === "won" ? "Won" : f.result === "listed" ? "Listed" : f.result ? f.result : ""}
                  {f.edition_year ? `${f.result ? " · " : ""}${f.edition_year}` : ""}
                  {f.rep_type ? `${(f.result || f.edition_year) ? " · " : ""}${f.rep_type === "both" ? "defining & recent" : f.rep_type} work` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Layer 2 — the hidden catalog as members of this lineage. Server-rendered
            plain <a> list; these films' own pages stay out of the index. */}
        {hiddenFilms.length > 0 && (
          <section className="mvh-sec">
            <h2 className="lh-h2" style={{ fontSize: 22 }}>
              Also in this lineage — not yet read closely <span className="lh-cnt">{hiddenFilms.length}</span>
            </h2>
            <p className="mvh-note">
              The rest of {list.label} on Metatake — catalog entries, each with its own film page. The close readings are still to come.
            </p>
            <div className="mvh-films">
              {hiddenFilms.slice(0, 24).map((f) => (
                <a className="mvh-film" key={f.film_slug} href={`/film/${f.film_slug}`}>
                  {f.poster_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="mvh-poster" src={`${IMG}/w185${f.poster_path}`} alt="" width={185} height={278} loading="lazy" />
                  ) : <div className="mvh-poster mvh-poster--empty" aria-hidden="true" />}
                  <div className="mvh-fmeta">
                    <div className="mvh-ftitle">
                      {isCanon && f.rank ? <span className="lh-rank">#{f.rank} </span> : null}
                      {f.film_title}
                      {f.film_year ? <span className="mvh-yr"> ({f.film_year})</span> : null}
                    </div>
                    {hiddenNative[f.film_slug] ? <div className="mvh-fdir">{hiddenNative[f.film_slug]}</div> : null}
                  </div>
                </a>
              ))}
            </div>
            {hiddenFilms.length > 24 ? (
              <>
                <p className="mvh-note" style={{ marginTop: 16 }}>+ {hiddenFilms.length - 24} more in this lineage:</p>
                <ul className="mt-list">
                  {hiddenFilms.slice(24).map((f) => (
                    <li key={f.film_slug}>
                      <a href={`/film/${f.film_slug}`}>{isCanon && f.rank ? `#${f.rank} ` : ""}{f.film_title}</a>{" "}
                      <span className="meta">({f.film_year ?? "?"})</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
