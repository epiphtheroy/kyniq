import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import MetatakeNav from "@/components/MetatakeNav";
import { pageRobots } from "@/lib/seo";

export const revalidate = 300;
export async function generateStaticParams() { return []; }
const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
interface Props { params: Promise<{ slug: string }> }

type Film = { id: string; title: string; slug: string; year: number | null; director: string | null; director_slug: string | null; poster_path: string | null; backdrop_path: string | null; visible: boolean };
type Rec = { film: { title: string; slug: string; year: number | null; director: string | null; backdrop_path: string | null }; reasons: { slug: string; title: string }[]; score: number };

async function load(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, poster_path, backdrop_path, visible")
    .eq("slug", slug).maybeSingle();
  if (!film) return null;

  const { data: aff } = await supabase
    .from("film_affinities")
    .select("related_film_id, score, shared_meta_take_ids")
    .eq("film_id", (film as Film).id)
    .order("score", { ascending: false })
    .limit(24);

  const relIds = (aff ?? []).map((a) => a.related_film_id);
  const sharedIds = [...new Set((aff ?? []).flatMap((a) => (a.shared_meta_take_ids ?? []) as string[]))];
  const [{ data: relFilms }, { data: sharedMts }] = await Promise.all([
    relIds.length ? supabase.from("films").select("id, title, slug, year, director, backdrop_path").in("id", relIds).eq("visible", true)
      : Promise.resolve({ data: [] as { id: string; title: string; slug: string; year: number | null; director: string | null; backdrop_path: string | null }[] }),
    sharedIds.length ? supabase.from("meta_takes").select("id, slug, title").in("id", sharedIds).eq("status", "published").eq("kind", "reading")
      : Promise.resolve({ data: [] as { id: string; slug: string; title: string }[] }),
  ]);
  const relMap = new Map((relFilms ?? []).map((f) => [f.id, f]));
  const mtMap = new Map((sharedMts ?? []).map((m) => [m.id, m]));
  const recs: Rec[] = (aff ?? []).map((a) => {
    const f = relMap.get(a.related_film_id);
    if (!f) return null;  // skip hidden/thin related films
    const reasons = ((a.shared_meta_take_ids ?? []) as string[]).map((id) => mtMap.get(id)).filter(Boolean) as { slug: string; title: string }[];
    return { film: f, reasons, score: Number(a.score) };
  }).filter(Boolean) as Rec[];

  return { film: film as Film, recs };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const { film, recs } = data;
  const yr = film.year ? ` (${film.year})` : "";
  const title = `Movies like ${film.title}${yr} — ${recs.length} similar films`;
  const description = recs.length
    ? `Films like ${film.title}, matched by the critical ideas they share — not just genre. ${recs.slice(0, 5).map((r) => r.film.title).join(", ")} and more, each with why it's kin.`
    : `Films similar to ${film.title}.`;
  const meetsBar = film.visible && recs.length >= 3;
  return {
    title,
    description,
    openGraph: { title, description },
    alternates: { canonical: `/movies-like/${film.slug}` },
    robots: pageRobots(meetsBar),
  };
}

export default async function MoviesLikePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { film, recs } = data;

  const jsonld = {
    "@context": "https://schema.org", "@type": "ItemList",
    name: `Movies like ${film.title}`,
    numberOfItems: recs.length,
    itemListElement: recs.map((r, i) => ({
      "@type": "ListItem", position: i + 1,
      item: { "@type": "Movie", name: r.film.title, ...(r.film.year ? { datePublished: String(r.film.year) } : {}), url: `https://metatake.net/film/${r.film.slug}` },
    })),
  };

  return (
    <div className="mt">
      <MetatakeNav active="films" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <div className="mt-wrap">
        <div className="mt-crumb">
          <Link href="/film">Films</Link> &nbsp;›&nbsp; <Link href={`/film/${film.slug}`}>{film.title}</Link>
        </div>
        <h1 className="mt-h1">Movies like {film.title}{film.year ? ` (${film.year})` : ""}</h1>
        <p className="mt-laconic">
          {recs.length} films Metatake places near {film.title} — matched not by genre or era but by the critical ideas they share. Each one lists what makes it kin.
        </p>

        {recs.length === 0 ? (
          <p className="mt-see" style={{ fontStyle: "italic" }}>No similar films yet — this film&apos;s readings are still being connected.</p>
        ) : (
          <ul className="ml-list">
            {recs.map((r) => (
              <li key={r.film.slug} className="ml-item">
                <div className="ml-row">
                  {r.film.backdrop_path ? (
                    <Link href={`/film/${r.film.slug}`} className="ml-thumb" aria-label={r.film.title}>
                      <img src={`${IMG}/w300${r.film.backdrop_path}`} alt="" loading="lazy" />
                    </Link>
                  ) : null}
                  <div className="ml-txt">
                    <Link href={`/film/${r.film.slug}`} className="ml-title">{r.film.title}</Link>{" "}
                    <span className="yr">({r.film.year ?? "?"})</span>
                    {r.film.director ? <span className="ml-dir"> · {r.film.director}</span> : null}
                    {r.reasons.length ? (
                      <p className="ml-why">Shares: {r.reasons.slice(0, 4).map((m, i) => (
                        <span key={m.slug}>{i > 0 ? ", " : ""}<Link href={`/take/${m.slug}`}>{m.title}</Link></span>
                      ))}{r.reasons.length > 4 ? ` +${r.reasons.length - 4}` : ""}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-see" style={{ marginTop: "1.5rem" }}>
          ← Back to <Link href={`/film/${film.slug}`}>{film.title}</Link>
        </p>
      </div>
    </div>
  );
}
