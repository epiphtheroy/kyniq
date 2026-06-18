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

type Fig = { id: string; kind: string | null; label: string; slug: string | null; description: string | null; metaTakes: { slug: string; title: string }[] };
type FigRef = { label: string; slug: string | null };
type FilmLink = { slug: string; title: string; figs: FigRef[] };
type MediaRow = { id: string; kind: string; source: string; external_id: string; url: string; thumbnail_url: string | null; title: string | null; attribution: string | null };

async function load(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, genres, poster_path, backdrop_path, tagline, runtime, release_date, certification, overview, imdb_id, tmdb_extra, created_at, visible")
    .eq("slug", slug).maybeSingle();
  if (!film) return null;

  const [{ data: figRows }, { data: aff }, { data: mediaRows }] = await Promise.all([
    supabase.from("figures")
      .select("id, kind, label, slug, description, takes(meta_take:meta_takes(slug, title, status, kind))")
      .eq("film_id", film.id).eq("status", "approved"),
    supabase.from("film_affinities").select("related_film_id, score, shared_meta_take_ids").eq("film_id", film.id).order("score", { ascending: false }).limit(8),
    supabase.from("media").select("id, kind, source, external_id, url, thumbnail_url, title, attribution")
      .eq("entity_type", "film").eq("entity_id", film.id).eq("status", "published").order("position"),
  ]);

  const figures: Fig[] = (figRows ?? []).map((f) => {
    const takes = (f.takes ?? []) as unknown as { meta_take: { slug: string; title: string; status: string; kind: string } | null }[];
    const mts = takes.map((t) => t.meta_take).filter((m): m is { slug: string; title: string; status: string; kind: string } => !!m && m.status === "published" && m.kind === "reading");
    return { id: f.id, kind: f.kind, label: f.label, slug: f.slug, description: (f.description as string | null) ?? null, metaTakes: mts.map((m) => ({ slug: m.slug, title: m.title })) };
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
  const meetsBar = data.figures.length >= 3 && (data.film as { visible?: boolean }).visible !== false;
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
  const country = extra.country?.length ? extra.country[0] : null;

  // "via [figure]" inline list — red figure links, used in the two-column lists.
  const viaFigs = (figs: FigRef[]) => {
    if (!figs.length) return null;
    const show = figs.slice(0, 3);
    return (
      <span className="df-via"><span className="df-via__lab">via</span>{show.map((fg, i) => (
        <span key={i}>{i > 0 ? ", " : ""}
          {fg.slug
            ? <Link href={`/film/${film.slug}/figure/${fg.slug}`} className="df-f">{fg.label}</Link>
            : <span className="df-f">{fg.label}</span>}
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
      <div className="df-wrap">
        <div className="df-crumb">
          <Link href="/film">Films</Link>
          {film.director_slug ? <><span className="df-sep">›</span><Link href={`/director/${film.director_slug}`}>{film.director}</Link></> : null}
        </div>

        {/* HERO — colour backdrop + poster */}
        <section className="df-hero">
          {film.backdrop_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="df-backdrop" src={`${IMG}/w780${film.backdrop_path}`} alt={`${film.title} backdrop`} />
          ) : <div className="df-backdrop df-backdrop--empty" aria-hidden="true" />}
          <div className="df-headrow">
            {film.poster_path ? (
              <LightboxImage
                src={`${IMG}/w342${film.poster_path}`} fullUrl={`${IMG}/w500${film.poster_path}`}
                alt={`${film.title} poster`} className="df-poster" caption={film.title}
              />
            ) : <div className="df-poster df-poster--empty" aria-hidden="true" />}
            <div className="df-htxt">
              <h1>{film.title} <span className="df-yr">({film.year ?? "?"})</span></h1>
              {film.tagline ? <div className="df-tagline">{film.tagline}</div> : null}
              <div className="df-facts">
                {film.director ? <Link href={`/director/${film.director_slug}`}>{film.director}</Link> : null}
                {film.genres?.length ? <><span className="df-d" />{film.genres.slice(0, 3).join(" · ")}</> : null}
                {runtimeFmt ? <><span className="df-d" />{runtimeFmt}</> : null}
                {cert ? <><span className="df-d" />{cert}</> : null}
                {country ? <><span className="df-d" />{country}</> : null}
              </div>
              <div className="df-hactions">
                <EntityActions entityType="film" entityId={film.id} />
                {recs.length ? <Link className="df-like" href={`/movies-like/${film.slug}`}>🎬 Movies like {film.title} →</Link> : null}
              </div>
            </div>
          </div>

          {figures.length > 0 ? (
            <p className="df-intro">
              Metatake reads <b>{film.title}</b> through <b>{figures.length} figure{figures.length === 1 ? "" : "s"}</b>
              {mtTotal ? <> and the <b>{mtTotal} recurring idea{mtTotal === 1 ? "" : "s"}</b> it shares with the rest of cinema</> : null}.
              {" "}Not a review — a reading: the concrete things the film keeps returning to, and the lines they draw to other films.
            </p>
          ) : null}

          {/* STAT STRIP — clickable jump links, static numbers */}
          <div className="df-stats">
            <Link className="df-stat" href="#df-figures"><span className="df-n">{figures.length}</span><span className="df-k">Figures</span></Link>
            <Link className="df-stat df-red" href="#df-metatakes"><span className="df-n">{mtTotal}</span><span className="df-k">Meta takes</span></Link>
            <Link className="df-stat df-teal" href="#df-tropes"><span className="df-n">{tropes.length}</span><span className="df-k">Tropes</span></Link>
            <Link className="df-stat" href="#df-connected"><span className="df-n">{recs.length}</span><span className="df-k">Connected films</span></Link>
          </div>
        </section>

        {stills.length > 0 ? (
          <div className="df-stills">
            {stills.map((s) => (
              <LightboxImage key={s.id} src={s.thumbnail_url ?? s.url} fullUrl={s.url} alt={s.title ?? `${film.title} still`} className="df-still" caption={`${film.title} — still · TMDB`} />
            ))}
          </div>
        ) : null}

        {/* FIGURES — grouped by kind, wide rows with full description + reaches */}
        {grouped.length > 0 ? (
          <section className="df-sec" id="df-figures">
            <h2 className="df-h2">Figures</h2>
            <p className="df-sub">The characters, objects, places, forms and motifs critics have singled out in {film.title} — each described in full, with the readings it reaches.</p>
            {grouped.map((g) => (
              <div key={g.kind} className="df-fgroup">
                <div className="df-flabel">{KIND_LABEL[g.kind] ?? g.kind}</div>
                {g.items.map((f) => {
                  const n = f.metaTakes.length;
                  return (
                    <div key={f.id} className="df-fig">
                      <div className="df-figL">
                        <div className="df-lab">{f.label}</div>
                        <div className="df-figmeta">
                          <span className={`df-rc${n === 0 ? " df-rc--zero" : ""}`}>{n} reading{n === 1 ? "" : "s"}</span>
                          {f.slug ? <Link className="df-figopen" href={`/film/${film.slug}/figure/${f.slug}`}>Open →</Link> : null}
                        </div>
                      </div>
                      <div className="df-figR">
                        {f.description ? <p className="df-figdesc">{f.description}</p> : null}
                        {n > 0 ? (
                          <div className="df-reaches">
                            <span className="df-rl">reaches</span>
                            {f.metaTakes.map((m, i) => (
                              <span key={m.slug}>{i > 0 ? ", " : ""}<Link href={`/take/${m.slug}`}>{m.title}</Link></span>
                            ))}
                          </div>
                        ) : (
                          <div className="df-reaches df-reaches--none"><span className="df-rl">reaches</span>figure only — no published reading yet</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        ) : null}

        {/* LIVING MAP */}
        <section className="df-sec">
          <h2 className="df-h2">The map of {film.title}</h2>
          <p className="df-sub">The film at the centre, its figures around it, and the readings each figure reaches. Drag to pan, scroll to zoom, hover a node.</p>
          <div className="df-map">
            <EntityGraphLoader kind="film" filmSlug={film.slug} label={film.title} height={400} />
          </div>
        </section>

        {/* META TAKES | TROPES — two columns */}
        {(readings.length > 0 || tropes.length > 0) ? (
          <section className="df-sec">
            <div className="df-cols">
              <div className="df-col" id="df-metatakes">
                <h2 className="df-h2">Meta takes</h2>
                <p className="df-sub">Cross-film critical patterns {film.title} takes part in. <b>Via</b> = the figure that reaches it.</p>
                <div className="df-mlist">
                  {readings.map((r) => (
                    <div key={r.slug} className={`df-mrow${r.figs.length >= 2 ? " df-top" : ""}`}>
                      <Link className="df-t" href={`/take/${r.slug}`}>{r.title}</Link>
                      {r.figs.length > 1 ? <span className="df-cnt">{r.figs.length}</span> : null}
                      {viaFigs(r.figs)}
                    </div>
                  ))}
                  {readings.length === 0 ? <p className="df-empty">No meta takes yet.</p> : null}
                </div>
              </div>

              <div className="df-col df-tcol" id="df-tropes">
                <h2 className="df-h2">Tropes</h2>
                <p className="df-sub">Screenwriting types it instantiates — shared under <Link href="/tropes">Tropes</Link>.</p>
                <div className="df-mlist">
                  {tropes.map((t) => (
                    <div key={t.slug} className={`df-mrow${t.figs.length >= 2 ? " df-top" : ""}`}>
                      <Link className="df-t" href={`/trope/${t.slug}`}>{t.title}</Link>
                      {t.figs.length > 1 ? <span className="df-cnt">{t.figs.length}</span> : null}
                      {viaFigs(t.figs)}
                    </div>
                  ))}
                  {tropes.length === 0 ? <p className="df-empty">No tropes yet.</p> : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* CONNECTED FILMS */}
        {recs.length > 0 ? (
          <section className="df-sec" id="df-connected">
            <h2 className="df-h2">Films most connected to {film.title}<Link className="df-more" href={`/movies-like/${film.slug}`}>see all →</Link></h2>
            <p className="df-sub">Nearest neighbours in meaning-space — films that share the most readings. <b>Shared</b> = the meta takes they hold in common.</p>
            <div className="df-conn">
              {recs.map((r) => (
                <div key={r.film.slug} className="df-crow">
                  <Link className="df-ti" href={`/film/${r.film.slug}`}>{r.film.title}</Link>{" "}
                  <span className="df-cyr">({r.film.year ?? "?"})</span>
                  {r.reasons.length > 0 ? (
                    <span className="df-cvia"><span className="df-via__lab">shared</span>{r.reasons.map((m, i) => (
                      <span key={m.slug}>{i > 0 ? ", " : ""}<Link href={`/take/${m.slug}`}>{m.title}</Link></span>
                    ))}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* FILM INFO — accordion (keeps trailer + stills inside) */}
        {(film.overview || cast.length || extra.writers?.length || film.release_date || extra.country?.length || trailer) ? (
          <details className="df-finfo">
            <summary>Film info &amp; credits</summary>
            <div className="df-finfo__body">
              {film.overview ? <p className="df-ov">{film.overview}</p> : null}
              {trailer ? (
                <div className="df-trailer">
                  <YouTubeFacade videoId={trailer.external_id} title={trailer.title ?? "Trailer"} thumbnailUrl={trailer.thumbnail_url ?? undefined} attribution={trailer.attribution ?? undefined} />
                </div>
              ) : null}
              <dl className="df-dl">
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
              <div className="df-src">Data &amp; images via TMDB. Not endorsed or certified by TMDB.</div>
            </div>
          </details>
        ) : null}

        <div className="df-seq">
          <SeqNav kind="film" id={film.id} />
        </div>

        <Provenance created={film.created_at} />
      </div>
    </div>
  );
}
