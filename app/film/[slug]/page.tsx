import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import MetatakeNav from "@/components/MetatakeNav";
import FilmTabBar from "@/components/FilmTabBar";
import LightboxImage from "@/components/LightboxImage";
import YouTubeFacade from "@/components/YouTubeFacade";
import EntityGraphLoader from "@/components/EntityGraphLoader";
import EntityActions from "@/components/EntityActions";
import SeqNav from "@/components/SeqNav";
import Provenance from "@/components/Provenance";
import { fw, fwOrder, FAMILIES } from "@/lib/frameworks";
import { axisLabel, nodeHref } from "@/lib/catalog";
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
  form: "Form & technique", trope: "Themes & motifs", title: "Title", film: "The film itself",
};
const KIND_ORDER = ["film", "character", "object", "location", "form", "trope", "title"];

type Fig = { id: string; kind: string | null; label: string; slug: string | null; description: string | null };
type FigRef = { label: string; slug: string | null };
type FilmLink = { slug: string; title: string; figs: FigRef[] };
type MediaRow = { id: string; kind: string; source: string; external_id: string; url: string; thumbnail_url: string | null; title: string | null; attribution: string | null };
type TakeRow = { figure_id: string; framework: string | null; take_title: string | null; rationale: string | null; leap: string | null; strength: number | null; is_invitation: boolean | null };
type SM = { framework: string | null; take_title: string | null; thesis: string | null; leap: string | null; strength: number | null; figLabel: string; figSlug: string | null };
type ArchRow = { axis: string; slug: string; label: string; n: number; fig_label: string | null; fig_slug: string | null };

async function load(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, genres, poster_path, backdrop_path, tagline, runtime, release_date, certification, overview, imdb_id, tmdb_extra, created_at, visible")
    .eq("slug", slug).maybeSingle();
  if (!film) return null;

  const [{ data: figRows }, { data: aff }, { data: mediaRows }, { data: catRows }] = await Promise.all([
    supabase.from("figures").select("id, kind, label, slug, description").eq("film_id", film.id).eq("status", "approved"),
    supabase.from("film_affinities").select("related_film_id, score").eq("film_id", film.id).order("score", { ascending: false }).limit(8),
    supabase.from("media").select("id, kind, source, external_id, url, thumbnail_url, title, attribution")
      .eq("entity_type", "film").eq("entity_id", film.id).eq("status", "published").order("position"),
    supabase.rpc("film_catalog", { p_film_id: film.id }),
  ]);
  const archetypes = (catRows ?? []) as ArchRow[];

  const figures = (figRows ?? []) as Fig[];
  const figById = new Map<string, Fig>(figures.map((f) => [f.id, f]));
  const figIds = figures.map((f) => f.id);

  // Strong Misreadings (new model) — published takes anchored to this film's figures.
  let invitation: string | null = null;
  const misreadings: SM[] = [];
  const takeCount = new Map<string, number>();
  if (figIds.length) {
    const { data: takeRows } = await supabase
      .from("takes")
      .select("figure_id, framework, take_title, rationale, leap, strength, is_invitation")
      .in("figure_id", figIds).eq("status", "published");
    for (const t of (takeRows ?? []) as TakeRow[]) {
      if (t.is_invitation) { if (!invitation) invitation = t.rationale; continue; }
      const f = figById.get(t.figure_id);
      misreadings.push({ framework: t.framework, take_title: t.take_title, thesis: t.rationale, leap: t.leap, strength: t.strength, figLabel: f?.label ?? "", figSlug: f?.slug ?? null });
      takeCount.set(t.figure_id, (takeCount.get(t.figure_id) ?? 0) + 1);
    }
  }
  misreadings.sort((a, b) => fwOrder(a.framework) - fwOrder(b.framework));

  // Tropes (kind='figure_type') — cross-film types this film's figures belong to.
  const figRefById = new Map<string, FigRef>(figures.map((f) => [f.id, { label: f.label, slug: f.slug }]));
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
        const fg = figRefById.get(r.figure_id); if (!fg) continue;
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

  // Connected films — nearest neighbours by affinity (reasons layer retired with old readings).
  const relIds = (aff ?? []).map((a) => a.related_film_id);
  const { data: relFilms } = relIds.length
    ? await supabase.from("films").select("id, title, slug, year").in("id", relIds)
    : { data: [] as { id: string; title: string; slug: string; year: number | null }[] };
  const relFilmMap = new Map((relFilms ?? []).map((f) => [f.id, f]));
  const recs = (aff ?? []).map((a) => relFilmMap.get(a.related_film_id)).filter(Boolean) as { title: string; slug: string; year: number | null }[];

  return { film, figures, takeCount, invitation, misreadings, tropes, recs, stills, trailer, archetypes };
}

// order + cap for the film-page Archetype section
const ARCH_ORDER = ["object", "char_archetype", "char_identity", "char_complex", "location", "theme"];
const ARCH_CAP: Record<string, number> = { theme: 12, char_identity: 18 };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const meetsBar = data.figures.length >= 3 && (data.film as { visible?: boolean }).visible !== false;
  const title = `${data.film.title}${data.film.year ? ` (${data.film.year})` : ""} — figures & strong misreadings`;
  const description = data.misreadings.length
    ? `${data.film.title} read closely: ${data.figures.length} figures and ${data.misreadings.length} strong misreadings across 14 critical frameworks.`
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
  const { film, figures, takeCount, invitation, misreadings, tropes, recs, stills, trailer, archetypes } = data;

  // Figures shown in the catalogue exclude the synthetic 'film'/'title' anchors.
  const catalogue = figures.filter((f) => f.kind !== "film" && f.kind !== "title" && (takeCount.get(f.id) ?? 0) > 0);
  const grouped = KIND_ORDER.filter((k) => k !== "film" && k !== "title")
    .map((k) => ({ kind: k, items: catalogue.filter((f) => (f.kind ?? "trope") === k) })).filter((g) => g.items.length > 0);

  const smByFamily = FAMILIES.map((fam) => ({ fam, items: misreadings.filter((m) => fw(m.framework).family === fam.key) })).filter((g) => g.items.length > 0);

  const extra = (film.tmdb_extra ?? {}) as { cast?: { name: string; character: string }[]; writers?: string[]; country?: string[]; original_language?: string; vote_average?: number; collection?: string | null };
  const cast = extra.cast ?? [];
  const runtimeFmt = film.runtime ? `${film.runtime} min` : null;
  const cert = film.certification ? film.certification.replace(/^[A-Z]{2}:/, "") : null;
  const country = extra.country?.length ? extra.country[0] : null;

  const archGroups = ARCH_ORDER
    .map((axis) => ({ axis, items: archetypes.filter((a) => a.axis === axis).slice(0, ARCH_CAP[axis] ?? 999) }))
    .filter((g) => g.items.length > 0);
  const filmInfoPresent = !!(film.overview || cast.length || extra.writers?.length || film.release_date || extra.country?.length || trailer);
  const tabs = ([
    invitation ? { id: "df-invitation", label: "Invitation" } : null,
    misreadings.length ? { id: "df-readings", label: "Strong Misreadings!" } : null,
    grouped.length ? { id: "df-figures", label: "Figures" } : null,
    tropes.length ? { id: "df-tropes", label: "Tropes" } : null,
    archGroups.length ? { id: "df-archetype", label: "Archetype" } : null,
    recs.length ? { id: "df-connected", label: "Films like" } : null,
    filmInfoPresent ? { id: "df-information", label: "Information" } : null,
  ].filter(Boolean)) as { id: string; label: string }[];

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

          {/* STAT STRIP — clickable jump links */}
          <div className="df-stats">
            <Link className="df-stat" href="#df-figures"><span className="df-n">{catalogue.length}</span><span className="df-k">Figures</span></Link>
            <Link className="df-stat df-red" href="#df-readings"><span className="df-n">{misreadings.length}</span><span className="df-k">Strong misreadings</span></Link>
            <Link className="df-stat df-teal" href="#df-tropes"><span className="df-n">{tropes.length}</span><span className="df-k">Tropes</span></Link>
            <Link className="df-stat" href="#df-connected"><span className="df-n">{recs.length}</span><span className="df-k">Connected films</span></Link>
          </div>
        </section>

        {/* SECTION TABS — sticky scroll-nav (SEO-safe anchors) */}
        {tabs.length > 1 ? <FilmTabBar tabs={tabs} /> : null}

        {/* INVITATION — spoiler-free way in */}
        {invitation ? (
          <section className="df-invite" id="df-invitation">
            <div className="df-invite__k">An invitation</div>
            <p className="df-invite__p">{invitation}</p>
            <div className="df-invite__note">Spoiler-free. The readings below do not hold back.</div>
          </section>
        ) : null}

        {/* STRONG MISREADINGS — first; full reading + the leap, grouped by framework family */}
        {misreadings.length > 0 ? (
          <section className="df-sec" id="df-readings">
            <h2 className="df-h2">Strong Misreadings!</h2>
            <p className="df-sub">
              Bold readings of {film.title}, filed across 14 <Link href="/about#strong-misreadings">critical frameworks</Link> — each a deliberate over-reading, a provocation rather than a verdict.
            </p>
            {smByFamily.map(({ fam, items }) => (
              <div key={fam.key} className="df-smfam">
                <div className="df-smfam__h">{fam.label}</div>
                {items.map((m, i) => {
                  const F = fw(m.framework);
                  const href = m.figSlug ? `/film/${film.slug}/figure/${m.figSlug}` : null;
                  const fwHref = F.slug && m.framework !== "INVITATION" ? `/strong-misreadings/${F.slug}` : null;
                  return (
                    <div key={i} className="sm-row" style={{ borderLeftColor: F.color }}>
                      <div className="sm-row__top">
                        {fwHref
                          ? <Link className="sm-fw" href={fwHref} style={{ color: F.color }}>{F.label}</Link>
                          : <span className="sm-fw" style={{ color: F.color }}>{F.label}</span>}
                        <span className="sm-via">via {href ? <Link href={href}>{m.figLabel}</Link> : m.figLabel}</span>
                      </div>
                      {m.take_title ? (
                        <div className="sm-row__title">{href ? <Link href={href}>{m.take_title}</Link> : m.take_title}</div>
                      ) : null}
                      {m.thesis ? <p className="sm-row__thesis sm-row__thesis--full">{m.thesis}</p> : null}
                      {m.leap ? <p className="sm-row__leap"><span className="sm-leap__l">The leap</span> {m.leap}</p> : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        ) : null}

        {stills.length > 0 ? (
          <div className="df-stills">
            {stills.map((s) => (
              <LightboxImage key={s.id} src={s.thumbnail_url ?? s.url} fullUrl={s.url} alt={s.title ?? `${film.title} still`} className="df-still" caption={`${film.title} — still · TMDB`} />
            ))}
          </div>
        ) : null}

        {/* FIGURES — grouped by kind */}
        {grouped.length > 0 ? (
          <section className="df-sec" id="df-figures">
            <h2 className="df-h2">Figures</h2>
            <p className="df-sub">The characters, objects, places, forms and motifs Metatake singled out in {film.title} — each the anchor for one or more strong misreadings.</p>
            {grouped.map((g) => (
              <div key={g.kind} className="df-fgroup">
                <div className="df-flabel">{KIND_LABEL[g.kind] ?? g.kind}</div>
                {g.items.map((f) => {
                  const n = takeCount.get(f.id) ?? 0;
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

        {/* TROPES */}
        {tropes.length > 0 ? (
          <section className="df-sec" id="df-tropes">
            <h2 className="df-h2">Tropes</h2>
            <p className="df-sub">Cross-film types {film.title} instantiates — shared under <Link href="/tropes">Tropes</Link>. <b>Via</b> = the figure that carries it.</p>
            <div className="df-mlist df-mlist--wide">
              {tropes.map((t) => (
                <div key={t.slug} className={`df-mrow${t.figs.length >= 2 ? " df-top" : ""}`}>
                  <Link className="df-t" href={`/trope/${t.slug}`}>{t.title}</Link>
                  {t.figs.length > 1 ? <span className="df-cnt">{t.figs.length}</span> : null}
                  {t.figs.length ? (
                    <span className="df-via"><span className="df-via__lab">via</span>{t.figs.slice(0, 3).map((fg, i) => (
                      <span key={i}>{i > 0 ? ", " : ""}
                        {fg.slug
                          ? <Link href={`/film/${film.slug}/figure/${fg.slug}`} className="df-f">{fg.label}</Link>
                          : <span className="df-f">{fg.label}</span>}
                      </span>
                    ))}{t.figs.length > 3 ? ` +${t.figs.length - 3}` : ""}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ARCHETYPE — catalog classification of this film's figures */}
        {archGroups.length > 0 ? (
          <section className="df-sec" id="df-archetype">
            <h2 className="df-h2">Archetype</h2>
            <p className="df-sub">What {film.title}&apos;s figures <i>are</i> — their catalog classification, each linking into the <Link href="/catalog">Archetype</Link> catalog. <b>Via</b> = the figure that carries it.</p>
            {archGroups.map((g) => (
              <div key={g.axis} className="df-archgrp">
                <div className="df-flabel">{axisLabel(g.axis)}</div>
                <div className="df-mlist df-mlist--wide">
                  {g.items.map((a) => (
                    <div key={a.slug} className="df-mrow">
                      <Link className="df-t" href={nodeHref(g.axis, a.slug)}>{a.label}</Link>
                      {a.n > 1 ? <span className="df-cnt">{a.n}</span> : null}
                      {a.fig_label ? (
                        <span className="df-via"><span className="df-via__lab">via</span>{" "}
                          {a.fig_slug
                            ? <Link href={`/film/${film.slug}/figure/${a.fig_slug}`} className="df-f">{a.fig_label}</Link>
                            : <span className="df-f">{a.fig_label}</span>}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {/* CONNECTED FILMS */}
        {recs.length > 0 ? (
          <section className="df-sec" id="df-connected">
            <h2 className="df-h2">Films most connected to {film.title}<Link className="df-more" href={`/movies-like/${film.slug}`}>see all →</Link></h2>
            <p className="df-sub">Nearest neighbours in meaning-space — films Metatake places closest to this one.</p>
            <div className="df-conn">
              {recs.map((r) => (
                <div key={r.slug} className="df-crow">
                  <Link className="df-ti" href={`/film/${r.slug}`}>{r.title}</Link>{" "}
                  <span className="df-cyr">({r.year ?? "?"})</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* FILM INFO — accordion */}
        {(film.overview || cast.length || extra.writers?.length || film.release_date || extra.country?.length || trailer) ? (
          <details className="df-finfo" id="df-information">
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
