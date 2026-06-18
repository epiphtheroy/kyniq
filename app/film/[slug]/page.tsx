import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import MetatakeNav from "@/components/MetatakeNav";
import LightboxImage from "@/components/LightboxImage";
import YouTubeFacade from "@/components/YouTubeFacade";
import EntityGraphLoader from "@/components/EntityGraphLoader";
import EntityActions from "@/components/EntityActions";
import SeqNav from "@/components/SeqNav";
import Provenance from "@/components/Provenance";
import { pageRobots } from "@/lib/seo";

export const revalidate = 300;
export async function generateStaticParams() { return []; }
const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }>; }

const KIND_LABEL: Record<string, string> = {
  character: "Characters", object: "Objects & symbols", location: "Locations",
  form: "Form & technique", trope: "Themes & motifs",
};
const KIND_ORDER = ["character", "object", "location", "form", "trope"];

type Fig = { id: string; kind: string | null; label: string; slug: string | null; metaTakes: { slug: string; title: string }[] };
type FigRef = { label: string; slug: string | null };
type FilmLink = { slug: string; title: string; figs: FigRef[] };
type MediaRow = { id: string; kind: string; source: string; external_id: string; url: string; thumbnail_url: string | null; title: string | null; attribution: string | null };

async function load(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, genres, poster_path, backdrop_path, tagline, runtime, release_date, certification, overview, imdb_id, tmdb_extra, created_at")
    .eq("slug", slug).maybeSingle();
  if (!film) return null;

  const [{ data: figRows }, { data: aff }, { data: mediaRows }] = await Promise.all([
    supabase.from("figures")
      .select("id, kind, label, slug, takes(meta_take:meta_takes(slug, title, status, kind))")
      .eq("film_id", film.id).eq("status", "approved"),
    supabase.from("film_affinities").select("related_film_id, score, shared_meta_take_ids").eq("film_id", film.id).order("score", { ascending: false }).limit(8),
    supabase.from("media").select("id, kind, source, external_id, url, thumbnail_url, title, attribution")
      .eq("entity_type", "film").eq("entity_id", film.id).eq("status", "published").order("position"),
  ]);

  const figures: Fig[] = (figRows ?? []).map((f) => {
    const takes = (f.takes ?? []) as unknown as { meta_take: { slug: string; title: string; status: string; kind: string } | null }[];
    const mts = takes.map((t) => t.meta_take).filter((m): m is { slug: string; title: string; status: string; kind: string } => !!m && m.status === "published" && m.kind === "reading");
    return { id: f.id, kind: f.kind, label: f.label, slug: f.slug, metaTakes: mts.map((m) => ({ slug: m.slug, title: m.title })) };
  });

  // Layer 2 — distinct meta-takes (kind='reading'); keep which of this film's figures reach each.
  const readMap = new Map<string, FilmLink>();
  for (const f of figures) {
    const fg: FigRef = { label: f.label, slug: f.slug };
    const seen = new Set<string>();
    for (const m of f.metaTakes) {
      if (seen.has(m.slug)) continue;
      seen.add(m.slug);
      const e = readMap.get(m.slug);
      if (e) { if (!e.figs.some((x) => x.label === fg.label)) e.figs.push(fg); }
      else readMap.set(m.slug, { slug: m.slug, title: m.title, figs: [fg] });
    }
  }
  const readings = [...readMap.values()].sort((a, b) => b.figs.length - a.figs.length || a.title.localeCompare(b.title));

  // Layer 3 — tropes (kind='figure_type'); keep this film's figures per trope.
  const figIds = figures.map((f) => f.id);
  const figById = new Map<string, FigRef>(figures.map((f) => [f.id, { label: f.label, slug: f.slug }]));
  let tropes: FilmLink[] = [];
  if (figIds.length) {
    const { data: ftm } = await supabase.from("figure_type_members").select("meta_take_id, figure_id").in("figure_id", figIds);
    const mtIds = [...new Set((ftm ?? []).map((r) => r.meta_take_id))];
    if (mtIds.length) {
      const { data: tms } = await supabase.from("meta_takes").select("id, slug, title").in("id", mtIds).eq("status", "published").eq("kind", "figure_type");
      const tmMap = new Map((tms ?? []).map((m) => [m.id, m]));
      const tFigs = new Map<string, FigRef[]>();
      for (const r of (ftm ?? [])) {
        if (!tmMap.has(r.meta_take_id)) continue;
        const fg = figById.get(r.figure_id); if (!fg) continue;
        const arr = tFigs.get(r.meta_take_id) ?? [];
        if (!arr.some((x) => x.label === fg.label)) arr.push(fg);
        tFigs.set(r.meta_take_id, arr);
      }
      tropes = [...tFigs.entries()].map(([id, figs]) => { const m = tmMap.get(id)!; return { slug: m.slug, title: m.title, figs }; })
        .sort((a, b) => b.figs.length - a.figs.length || a.title.localeCompare(b.title));
    }
  }

  const media = (mediaRows ?? []) as unknown as MediaRow[];
  const stills = media.filter((m) => m.kind === "image").slice(0, 5);
  const trailer = media.find((m) => m.kind === "video") ?? null;

  // recommendations
  const relIds = (aff ?? []).map((a) => a.related_film_id);
  const sharedIds = [...new Set((aff ?? []).flatMap((a) => (a.shared_meta_take_ids ?? []) as string[]))];
  const [{ data: relFilms }, { data: sharedMts }] = await Promise.all([
    relIds.length ? supabase.from("films").select("id, title, slug, year").in("id", relIds) : Promise.resolve({ data: [] as { id: string; title: string; slug: string; year: number | null }[] }),
    sharedIds.length ? supabase.from("meta_takes").select("id, slug, title").in("id", sharedIds).eq("status", "published").eq("kind", "reading") : Promise.resolve({ data: [] as { id: string; slug: string; title: string }[] }),
  ]);
  const relFilmMap = new Map((relFilms ?? []).map((f) => [f.id, f]));
  const mtMap = new Map((sharedMts ?? []).map((m) => [m.id, m]));
  const recs = (aff ?? []).map((a) => {
    const f = relFilmMap.get(a.related_film_id);
    const reasons = ((a.shared_meta_take_ids ?? []) as string[]).map((id) => mtMap.get(id)).filter(Boolean) as { slug: string; title: string }[];
    return f ? { film: f, reasons } : null;
  }).filter(Boolean) as { film: { title: string; slug: string; year: number | null }; reasons: { slug: string; title: string }[] }[];

  return { film, figures, readings, tropes, recs, stills, trailer };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  // Thin-content gate: a film with fewer than 3 figures has no real reading yet
  // (e.g. just-added films before extraction) → noindex. Auto-flips to indexable
  // once film-extract populates its figures/takes; no manual step per film.
  const meetsBar = data.figures.length >= 3;
  const title = `${data.film.title}${data.film.year ? ` (${data.film.year})` : ""} — figures & meta takes`;
  const description = data.figures.length
    ? `${data.film.title} read closely: ${data.figures.length} figures and the ${data.readings.length} recurring ideas it shares across cinema.`
    : undefined;
  return {
    title,
    ...(description ? { description } : {}),
    openGraph: { title, ...(description ? { description } : {}) },
    robots: pageRobots(meetsBar),
  };
}

export default async function FilmPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { film, figures, readings, tropes, recs, stills, trailer } = data;
  const grouped = KIND_ORDER.map((k) => ({ kind: k, items: figures.filter((f) => (f.kind ?? "trope") === k) })).filter((g) => g.items.length > 0);
  const mtTotal = readings.length;
  const extra = (film.tmdb_extra ?? {}) as { cast?: { name: string; character: string }[]; writers?: string[]; country?: string[]; original_language?: string; vote_average?: number; collection?: string | null };
  const cast = extra.cast ?? [];
  const runtimeFmt = film.runtime ? `${film.runtime} min` : null;
  const cert = film.certification ? film.certification.replace(/^[A-Z]{2}:/, "") : null;

  const viaFigs = (figs: FigRef[]) => {
    if (!figs.length) return null;
    const show = figs.slice(0, 3);
    return (
      <span className="film-via"> · via {show.map((fg, i) => (
        <span key={i}>{i > 0 ? ", " : ""}
          {fg.slug
            ? <Link href={`/film/${film.slug}/figure/${fg.slug}`} className="mt-fig">{fg.label}</Link>
            : <span className="mt-fig">{fg.label}</span>}
        </span>
      ))}{figs.length > 3 ? ` +${figs.length - 3}` : ""}</span>
    );
  };

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
            <EntityActions entityType="film" entityId={film.id} />
          </div>
        </div>

        {figures.length > 0 ? (
          <p className="film-intro">
            Metatake reads <strong>{film.title}</strong> through {figures.length} figure{figures.length === 1 ? "" : "s"}
            {mtTotal ? <> and the {mtTotal} recurring idea{mtTotal === 1 ? "" : "s"} it shares with the rest of cinema</> : null}.
            {recs.length ? <> <Link href={`/movies-like/${film.slug}`} className="film-like-link">Movies like {film.title} →</Link></> : null}
          </p>
        ) : null}

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
        <p className="mt-sub">The characters, objects, places, forms, and motifs critics have singled out in {film.title}.</p>
        {grouped.map((g) => (
          <div key={g.kind}>
            <div className="mt-label">{KIND_LABEL[g.kind] ?? g.kind}</div>
            <ul className="mt-list">
              {g.items.map((f) => (
                <li key={f.id}>
                  {f.slug ? <Link className="mt-fig" href={`/film/${film.slug}/figure/${f.slug}`}>{f.label}</Link> : <span className="mt-fig">{f.label}</span>}
                  {f.metaTakes.length > 0 && <span className="meta"> · {f.metaTakes.length} reading{f.metaTakes.length > 1 ? "s" : ""}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <EntityGraphLoader kind="film" filmSlug={film.slug} label={film.title} height={400} />

        {readings.length > 0 && (
          <>
            <h2 className="mt-h2">Meta takes</h2>
            <p className="mt-sub">Cross-film critical patterns this film takes part in — each links to the full reading.</p>
            <ul className="mt-list">
              {readings.map((r) => (
                <li key={r.slug}>
                  <Link href={`/take/${r.slug}`}>{r.title}</Link>
                  {viaFigs(r.figs)}
                </li>
              ))}
            </ul>
          </>
        )}

        {tropes.length > 0 && (
          <>
            <h2 className="mt-h2">Tropes</h2>
            <p className="mt-sub">Screenwriting types this film instantiates — shared with other films under <Link href="/tropes">Tropes</Link>.</p>
            <ul className="mt-list">
              {tropes.map((t) => (
                <li key={t.slug}>
                  <Link href={`/trope/${t.slug}`}>{t.title}</Link>
                  {viaFigs(t.figs)}
                </li>
              ))}
            </ul>
          </>
        )}

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

        <SeqNav kind="film" id={film.id} />

        <Provenance created={film.created_at} />
      </div>
    </div>
  );
}
