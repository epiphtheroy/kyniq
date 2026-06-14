import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";

export const revalidate = 300;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }>; }

async function load(slug: string) {
  const supabase = db();
  const { data: films } = await supabase
    .from("films").select("id, title, slug, year, director").eq("director_slug", slug).order("year");
  if (!films || films.length === 0) return null;
  const director = films[0].director ?? slug.replace(/-/g, " ");
  const filmIds = films.map((f) => f.id);

  const { data: takeRows } = await supabase
    .from("takes")
    .select("meta_take:meta_takes!inner(id, slug, title, status), figure:figures!inner(film_id)")
    .in("figure.film_id", filmIds)
    .eq("meta_take.status", "published");

  const mtFilms = new Map<string, { slug: string; title: string; films: Set<string> }>();
  const perFilmCount = new Map<string, Set<string>>();
  for (const r of (takeRows ?? []) as unknown[]) {
    const t = r as { meta_take: { id: string; slug: string; title: string }; figure: { film_id: string } };
    const e = mtFilms.get(t.meta_take.id) ?? { slug: t.meta_take.slug, title: t.meta_take.title, films: new Set<string>() };
    e.films.add(t.figure.film_id); mtFilms.set(t.meta_take.id, e);
    const s = perFilmCount.get(t.figure.film_id) ?? new Set<string>(); s.add(t.meta_take.id); perFilmCount.set(t.figure.film_id, s);
  }
  const filmById = new Map<string, { id: string; title: string; slug: string; year: number | null }>(
    films.map((f) => [f.id as string, f as { id: string; title: string; slug: string; year: number | null }])
  );
  const signature = [...mtFilms.values()]
    .filter((m) => m.films.size >= 2)
    .sort((a, b) => b.films.size - a.films.size)
    .map((m) => ({ ...m, filmList: [...m.films].map((id) => filmById.get(id)!).filter(Boolean) }));

  return { director, films, signature, perFilmCount, total: films.length, mtCount: mtFilms.size };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  return { title: `${data.director} — the recurring readings of a filmography` };
}

export default async function DirectorPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { director, films, signature, perFilmCount, total, mtCount } = data;

  return (
    <div className="mt">
      <MetatakeNav active="directors" />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/director">Directors</Link></div>
        <h1 className="mt-h1">{director}</h1>

        <div className="mt-info">
          <div className="hd">Director</div>
          <div className="bd">
            <div className="row"><span className="k">Films</span><span>{total}</span></div>
            <div className="row"><span className="k">Meta takes</span><span>{mtCount}</span></div>
          </div>
        </div>

        {signature.length > 0 && (
          <>
            <h2 className="mt-h2">Signature meta takes</h2>
            <p style={{ fontSize: 11.5, color: "var(--subtle)", margin: "7px 0 8px" }}>
              Readings that recur across the films — what makes a film unmistakably theirs.
            </p>
            <ul className="mt-list">
              {signature.map((m) => (
                <li key={m.slug}>
                  <Link href={`/take/${m.slug}`}>{m.title}</Link>{" "}
                  <span className="meta">— in {m.films.size} of {total}</span>
                  <br />
                  <span style={{ color: "var(--muted)" }}>
                    {m.filmList.map((f, i) => <span key={f.slug}>{i > 0 ? " · " : ""}<Link href={`/film/${f.slug}`}>{f.title}</Link></span>)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 className="mt-h2">Filmography</h2>
        <ul className="mt-list">
          {films.map((f) => (
            <li key={f.slug}>
              <Link href={`/film/${f.slug}`}>{f.title}</Link>{" "}
              <span className="meta">({f.year ?? "?"}) — {perFilmCount.get(f.id)?.size ?? 0} meta takes</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
