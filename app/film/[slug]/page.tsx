import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import MetatakeNav from "@/components/MetatakeNav";

export const revalidate = 300;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }>; }

const KIND_LABEL: Record<string, string> = {
  character: "Characters", object: "Objects & symbols", location: "Locations",
  form: "Form & technique", trope: "Tropes",
};
const KIND_ORDER = ["character", "object", "location", "form", "trope"];

type MetaTake = { slug: string; title: string } | null;
type Fig = { id: string; kind: string | null; label: string; slug: string | null; metaTakes: { slug: string; title: string }[] };

async function load(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films").select("id, title, slug, year, director, director_slug, genres").eq("slug", slug).maybeSingle();
  if (!film) return null;

  const [{ data: figRows }, { data: pitch }, { data: aff }] = await Promise.all([
    supabase.from("figures")
      .select("id, kind, label, slug, takes(meta_take:meta_takes(slug, title, status))")
      .eq("film_id", film.id).eq("status", "approved"),
    supabase.from("film_features").select("body, payload").eq("film_id", film.id).eq("kind", "pitch").eq("status", "published").maybeSingle(),
    supabase.from("film_affinities").select("related_film_id, score, shared_meta_take_ids").eq("film_id", film.id).order("score", { ascending: false }).limit(8),
  ]);

  const figures: Fig[] = (figRows ?? []).map((f) => {
    const takes = (f.takes ?? []) as unknown as { meta_take: { slug: string; title: string; status: string } | null }[];
    const mts = takes.map((t) => t.meta_take).filter((m): m is { slug: string; title: string; status: string } => !!m && m.status === "published");
    return { id: f.id, kind: f.kind, label: f.label, slug: f.slug, metaTakes: mts.map((m) => ({ slug: m.slug, title: m.title })) };
  });

  // recommendations: resolve related films + the shared meta take titles
  const relIds = (aff ?? []).map((a) => a.related_film_id);
  const sharedIds = [...new Set((aff ?? []).flatMap((a) => (a.shared_meta_take_ids ?? []) as string[]))];
  const [{ data: relFilms }, { data: sharedMts }] = await Promise.all([
    relIds.length ? supabase.from("films").select("id, title, slug, year").in("id", relIds) : Promise.resolve({ data: [] as { id: string; title: string; slug: string; year: number | null }[] }),
    sharedIds.length ? supabase.from("meta_takes").select("id, slug, title").in("id", sharedIds).eq("status", "published") : Promise.resolve({ data: [] as { id: string; slug: string; title: string }[] }),
  ]);
  const relFilmMap = new Map((relFilms ?? []).map((f) => [f.id, f]));
  const mtMap = new Map((sharedMts ?? []).map((m) => [m.id, m]));
  const recs = (aff ?? []).map((a) => {
    const f = relFilmMap.get(a.related_film_id);
    const reasons = ((a.shared_meta_take_ids ?? []) as string[]).map((id) => mtMap.get(id)).filter(Boolean) as { slug: string; title: string }[];
    return f ? { film: f, reasons } : null;
  }).filter(Boolean) as { film: { title: string; slug: string; year: number | null }; reasons: { slug: string; title: string }[] }[];

  return { film, figures, pitch, recs };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  return { title: `${data.film.title}${data.film.year ? ` (${data.film.year})` : ""} — figures & meta takes` };
}

export default async function FilmPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { film, figures, pitch, recs } = data;
  const pitchLine = (pitch?.body as string | null) ?? null;
  const grouped = KIND_ORDER.map((k) => ({ kind: k, items: figures.filter((f) => (f.kind ?? "trope") === k) })).filter((g) => g.items.length > 0);
  const mtTotal = new Set(figures.flatMap((f) => f.metaTakes.map((m) => m.slug))).size;

  return (
    <div className="mt">
      <MetatakeNav active="films" />
      <div className="mt-wrap">
        <div className="mt-crumb">
          <Link href="/film">Films</Link>
          {film.director_slug ? <> &nbsp;›&nbsp; <Link href={`/director/${film.director_slug}`}>{film.director}</Link></> : null}
        </div>
        <h1 className="mt-h1">{film.title} <span className="yr">({film.year ?? "?"})</span></h1>

        <div className="mt-info">
          <div className="hd">Film</div>
          <div className="bd">
            {film.director ? <div className="row"><span className="k">Director</span><Link href={`/director/${film.director_slug}`}>{film.director}</Link></div> : null}
            {film.genres && film.genres.length ? <div className="row"><span className="k">Genre</span><span style={{ textAlign: "right" }}>{film.genres.slice(0, 2).join(" · ")}</span></div> : null}
            <div className="row"><span className="k">Meta takes</span><span>{mtTotal}</span></div>
          </div>
        </div>

        {pitchLine ? <p>{pitchLine}</p> : null}

        <h2 className="mt-h2">Figures</h2>
        {grouped.map((g) => (
          <div key={g.kind}>
            <div className="mt-label">{KIND_LABEL[g.kind] ?? g.kind}</div>
            <ul className="mt-list">
              {g.items.map((f) => (
                <li key={f.id}>
                  {f.slug ? <Link href={`/film/${film.slug}/figure/${f.slug}`}>{f.label}</Link> : f.label}
                  {f.metaTakes.length > 0 && (
                    <> {" "}
                      {f.metaTakes.map((m, i) => <span key={m.slug}>{i > 0 ? " · " : "→ "}<Link href={`/take/${m.slug}`}>{m.title}</Link></span>)}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {recs.length > 0 && (
          <>
            <h2 className="mt-h2">Films most connected to {film.title}</h2>
            <ul className="mt-list">
              {recs.map((r) => (
                <li key={r.film.slug}>
                  <Link href={`/film/${r.film.slug}`}>{r.film.title}</Link>{" "}
                  <span className="yr">({r.film.year ?? "?"})</span>
                  {r.reasons.length > 0 && (
                    <span className="meta"> — via {r.reasons.map((m, i) => <span key={m.slug}>{i > 0 ? ", " : ""}<Link href={`/take/${m.slug}`}>{m.title}</Link></span>)}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
