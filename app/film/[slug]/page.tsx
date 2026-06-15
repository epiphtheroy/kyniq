import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import MetatakeNav from "@/components/MetatakeNav";
import LightboxImage from "@/components/LightboxImage";
import YouTubeFacade from "@/components/YouTubeFacade";
import NodeGraph from "@/components/NodeGraph";

export const revalidate = 300;
export async function generateStaticParams() { return []; }
const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }>; }

const KIND_LABEL: Record<string, string> = {
  character: "Characters", object: "Objects & symbols", location: "Locations",
  form: "Form & technique", trope: "Tropes",
};
const KIND_ORDER = ["character", "object", "location", "form", "trope"];

type Fig = { id: string; kind: string | null; label: string; slug: string | null; metaTakes: { slug: string; title: string }[] };
type MediaRow = { id: string; kind: string; source: string; external_id: string; url: string; thumbnail_url: string | null; title: string | null; attribution: string | null };

async function load(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, genres, poster_path, backdrop_path, tagline, runtime, release_date, certification, overview, imdb_id, tmdb_extra")
    .eq("slug", slug).maybeSingle();
  if (!film) return null;

  const [{ data: figRows }, { data: aff }, { data: mediaRows }] = await Promise.all([
    supabase.from("figures")
      .select("id, kind, label, slug, takes(meta_take:meta_takes(slug, title, status))")
      .eq("film_id", film.id).eq("status", "approved"),
    supabase.from("film_affinities").select("related_film_id, score, shared_meta_take_ids").eq("film_id", film.id).order("score", { ascending: false }).limit(8),
    supabase.from("media").select("id, kind, source, external_id, url, thumbnail_url, title, attribution")
      .eq("entity_type", "film").eq("entity_id", film.id).eq("status", "published").order("position"),
  ]);

  const figures: Fig[] = (figRows ?? []).map((f) => {
    const takes = (f.takes ?? []) as unknown as { meta_take: { slug: string; title: string; status: string } | null }[];
    const mts = takes.map((t) => t.meta_take).filter((m): m is { slug: string; title: string; status: string } => !!m && m.status === "published");
    return { id: f.id, kind: f.kind, label: f.label, slug: f.slug, metaTakes: mts.map((m) => ({ slug: m.slug, title: m.title })) };
  });

  const media = (mediaRows ?? []) as unknown as MediaRow[];
  const stills = media.filter((m) => m.kind === "image").slice(0, 5);
  const trailer = media.find((m) => m.kind === "video") ?? null;

  // recommendations
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

  return { film, figures, recs, stills, trailer };
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
  const { film, figures, recs, stills, trailer } = data;
  const grouped = KIND_ORDER.map((k) => ({ kind: k, items: figures.filter((f) => (f.kind ?? "trope") === k) })).filter((g) => g.items.length > 0);
  const mtTotal = new Set(figures.flatMap((f) => f.metaTakes.map((m) => m.slug))).size;
  const extra = (film.tmdb_extra ?? {}) as { cast?: { name: string; character: string }[]; writers?: string[]; country?: string[]; original_language?: string; vote_average?: number; collection?: string | null };
  const cast = extra.cast ?? [];
  const runtimeFmt = film.runtime ? `${film.runtime} min` : null;
  const cert = film.certification ? film.certification.replace(/^[A-Z]{2}:/, "") : null;

  const jsonld = {
    "@context": "https://schema.org", "@type": "Movie", name: film.title,
    ...(film.release_date ? { datePublished: film.release_date } : film.year ? { datePublished: String(film.year) } : {}),
    ...(film.genres?.length ? { genre: film.genres } : {}),
    ...(film.runtime ? { duration: `PT${film.runtime}M` } : {}),
    ...(film.director ? { director: { "@type": "Person", name: film.director } } : {}),
    ...(cast.length ? { actor: cast.map((c) => ({ "@type": "Person", name: c.name })) } : {}),
    ...(film.poster_path ? { image: `${IMG}/w500${film.poster_path}` } : {}),
    ...(film.overview ? { description: film.overview } : {}),
    ...(film.imdb_id ? { sameAs: `https://www.imdb.com/title/${film.imdb_id}/` } : {}),
  };

  return (
    <div className="mt">
      <MetatakeNav active="films" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <div className="mt-wrap">
        <div className="mt-crumb">
          <Link href="/film">Films</Link>
          {film.director_slug ? <> &nbsp;›&nbsp; <Link href={`/director/${film.director_slug}`}>{film.director}</Link></> : null}
        </div>

        <div className="film-head">
          {film.poster_path ? (
            <LightboxImage
              src={`${IMG}/w185${film.poster_path}`} fullUrl={`${IMG}/w500${film.poster_path}`}
              alt={`${film.title} poster`} className="film-poster" caption={film.title}
            />
          ) : null}
          <div className="film-head__txt">
            <h1 className="mt-h1" style={{ borderBottom: "none" }}>{film.title} <span className="yr">({film.year ?? "?"})</span></h1>
            {film.tagline ? <div className="film-tagline">{film.tagline}</div> : null}
          </div>
        </div>

        <div className="mt-info">
          <div className="hd">Film</div>
          <div className="bd">
            {film.director ? <div className="row"><span className="k">Director</span><Link href={`/director/${film.director_slug}`}>{film.director}</Link></div> : null}
            {film.genres && film.genres.length ? <div className="row"><span className="k">Genre</span><span style={{ textAlign: "right" }}>{film.genres.slice(0, 2).join(" · ")}</span></div> : null}
            {runtimeFmt ? <div className="row"><span className="k">Runtime</span><span>{runtimeFmt}</span></div> : null}
            {cert ? <div className="row"><span className="k">Rated</span><span>{cert}</span></div> : null}
            <div className="row"><span className="k">Meta takes</span><span>{mtTotal}</span></div>
          </div>
          {trailer ? (
            <div className="mt-info__trailer">
              <YouTubeFacade videoId={trailer.external_id} title={trailer.title ?? "Trailer"} thumbnailUrl={trailer.thumbnail_url ?? undefined} attribution={trailer.attribution ?? undefined} />
            </div>
          ) : null}
        </div>

        {stills.length > 0 ? (
          <div className="film-stills">
            {stills.map((s) => (
              <LightboxImage key={s.id} src={s.thumbnail_url ?? s.url} fullUrl={s.url} alt={s.title ?? `${film.title} still`} className="film-still" caption={`${film.title} — still · TMDB`} />
            ))}
          </div>
        ) : null}

        {(film.overview || cast.length || extra.writers?.length || film.release_date || extra.country?.length) ? (
          <details className="film-info">
            <summary>Film info</summary>
            <div className="film-info__body">
              {film.overview ? <p className="film-info__overview">{film.overview}</p> : null}
              <dl className="film-info__dl">
                {film.director ? <><dt>Director</dt><dd><Link href={`/director/${film.director_slug}`}>{film.director}</Link></dd></> : null}
                {cast.length ? <><dt>Cast</dt><dd>{cast.slice(0, 5).map((c) => c.character ? `${c.name} (${c.character})` : c.name).join(", ")}</dd></> : null}
                {extra.writers?.length ? <><dt>Writing</dt><dd>{extra.writers.join(", ")}</dd></> : null}
                {film.release_date ? <><dt>Released</dt><dd>{film.release_date}</dd></> : null}
                {runtimeFmt ? <><dt>Runtime</dt><dd>{runtimeFmt}</dd></> : null}
                {film.genres?.length ? <><dt>Genre</dt><dd>{film.genres.join(", ")}</dd></> : null}
                {cert ? <><dt>Rated</dt><dd>{cert}</dd></> : null}
                {extra.original_language ? <><dt>Language</dt><dd>{extra.original_language.toUpperCase()}</dd></> : null}
                {extra.country?.length ? <><dt>Country</dt><dd>{extra.country.join(", ")}</dd></> : null}
                {extra.collection ? <><dt>Collection</dt><dd>{extra.collection}</dd></> : null}
              </dl>
              <div className="film-info__src">Data &amp; images via TMDB. Not endorsed or certified by TMDB.</div>
            </div>
          </details>
        ) : null}

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

        <NodeGraph kind="film" filmSlug={film.slug} label={film.title} />
      </div>
    </div>
  );
}
