import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MetatakeNav from "@/components/MetatakeNav";
import LineageActions from "@/components/LineageActions";

export const revalidate = 1800;
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

async function load(slug: string) {
  const supabase = db();
  const { data: list } = await supabase
    .from("lineage_lists")
    .select("label, facet, description, country, tier, film_count")
    .eq("slug", slug).maybeSingle();
  if (!list) return null;
  const { data: films } = await supabase.rpc("lineage_list_films", { p_slug: slug });
  return { list: list as unknown as ListRow, films: (films as FilmRow[] | null) ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const title = `${data.list.label} — films in this lineage — Metatake`;
  return { title, description: `Films that belong to ${data.list.label}: ${data.list.film_count} on Metatake, with results and rankings.` };
}

export default async function LineagePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { list, films } = data;
  const isCanon = list.facet === "canon" || films.some((f) => f.rank != null);

  return (
    <div className="mt">
      <MetatakeNav active="lineage" />
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
          {films.map((f, i) => (
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
                  {!f.visible ? <span className="lh-stub"> · catalog entry</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
