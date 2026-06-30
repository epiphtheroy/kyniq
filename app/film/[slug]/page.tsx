import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SiteNav from "@/components/home2/SiteNav";
import FilmTabBar from "@/components/FilmTabBar";
import PosterActions from "@/components/PosterActions";
import SaveChip from "@/components/SaveChip";
import FilmTopInfo from "@/components/FilmTopInfo";
import FilmLineageSection from "@/components/FilmLineageSection";
import FilmRecommendedBy from "@/components/FilmRecommendedBy";
import InviteVideo from "@/components/InviteVideo";
import FilmHeroReel from "@/components/FilmHeroReel";
import LightboxImage from "@/components/LightboxImage";
import YouTubeFacade from "@/components/YouTubeFacade";
import EntityMap from "@/components/EntityMap";
import FilmMap from "@/components/FilmMap";
import EntityActions from "@/components/EntityActions";
import MovieListActions from "@/components/MovieListActions";
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
type TakeRow = { id: string; figure_id: string; framework: string | null; take_title: string | null; rationale: string | null; leap: string | null; strength: number | null; is_invitation: boolean | null };
type SM = { id: string; framework: string | null; take_title: string | null; thesis: string | null; leap: string | null; strength: number | null; figLabel: string; figSlug: string | null };
type ArchRow = { axis: string; slug: string; label: string; n: number; fig_label: string | null; fig_slug: string | null };
type RcpRow = { kind: string; outlet: string; critic: string | null; year: number | null; tier: string; headline: string; comment: string; verdict: string | null; url: string };
type WnRow = { pos: number; rec_title: string; rec_year: number | null; rec_director: string | null; reason: string; target_slug: string | null; target_title: string | null; target_year: number | null; target_poster: string | null; tmdb_id: number | null; poster_path: string | null };
type WwPoint = { label?: string; text: string };
type WwLens = { key: string; points: WwPoint[] };
type RevRow = { source_slug: string; source_title: string; source_year: number | null };
type Ratings = { imdb_rating: number | null; imdb_votes: number | null; metascore: number | null; rt_tomatometer: number | null };
type WatchProv = { provider_id: number; provider_name: string; logo_path: string | null };
type WatchCountry = { link?: string; flatrate?: WatchProv[]; rent?: WatchProv[]; buy?: WatchProv[]; free?: WatchProv[]; ads?: WatchProv[] };
type Watch = { results: Record<string, WatchCountry>; countries: string[] };
type LinRow = { facet: string; list_slug: string; list_label: string; parent_label: string | null; result: string | null; rank: number | null; edition_year: number | null; rank_max: number | null; rep_type: string | null };
const WW_TITLE: Record<string, string> = { auteur_vision: "AUTEUR_VISION", aesthetic_innovation: "AESTHETIC_INNOVATION", technical_mastery: "TECHNICAL_MASTERY", philosophical_inquiry: "PHILOSOPHICAL_INQUIRY", cinematic_lineage: "CINEMATIC_LINEAGE", spatial_aesthetics: "SPATIAL_AESTHETICS", critical_reception: "CRITICAL_RECEPTION", context_discourse: "CONTEXT_&_DISCOURSE" };

async function load(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, genres, poster_path, backdrop_path, tagline, runtime, release_date, certification, overview, imdb_id, tmdb_extra, created_at, visible, is_analyzed")
    .eq("slug", slug).maybeSingle();
  if (!film) return null;
  if (film.is_analyzed === false) {
    // Tier-2 catalog record: still surface the ambient data we DO have (no figures/readings).
    const [{ data: lnRows }, { data: revRows }, { data: ratRow }, { data: wpRow }] = await Promise.all([
      supabase.rpc("film_lineage_for", { p_film_id: film.id }),
      supabase.rpc("film_next_reverse", { p_film_id: film.id }),
      supabase.from("film_ratings").select("imdb_rating, imdb_votes, metascore, rt_tomatometer").eq("film_id", film.id).maybeSingle(),
      supabase.from("film_watch_providers").select("results, countries").eq("film_id", film.id).maybeSingle(),
    ]);
    return {
      minimal: true as const, film,
      lineage: (lnRows ?? []) as LinRow[],
      recommendedBy: (revRows ?? []) as RevRow[],
      ratings: (ratRow as Ratings | null) ?? null,
      watch: (wpRow as Watch | null) ?? null,
    };
  }

  const [{ data: figRows }, { data: aff }, { data: mediaRows }, { data: catRows }, { data: rcpRows }, { data: wnRows }, { data: waRows }, { data: revRows }, { data: lnRows }, { data: ratRow }, { data: wpRow }] = await Promise.all([
    supabase.from("figures").select("id, kind, label, slug, description").eq("film_id", film.id).eq("status", "approved"),
    supabase.from("film_affinities").select("related_film_id, score").eq("film_id", film.id).order("score", { ascending: false }).limit(8),
    supabase.from("media").select("id, kind, source, external_id, url, thumbnail_url, title, attribution")
      .eq("entity_type", "film").eq("entity_id", film.id).eq("status", "published").order("position"),
    supabase.rpc("film_catalog", { p_film_id: film.id }),
    supabase.rpc("film_reception", { p_film_id: film.id }),
    supabase.rpc("film_next", { p_film_id: film.id }),
    supabase.rpc("film_asset", { p_film_id: film.id }),
    supabase.rpc("film_next_reverse", { p_film_id: film.id }),
    supabase.rpc("film_lineage_for", { p_film_id: film.id }),
    supabase.from("film_ratings").select("imdb_rating, imdb_votes, metascore, rt_tomatometer").eq("film_id", film.id).maybeSingle(),
    supabase.from("film_watch_providers").select("results, countries").eq("film_id", film.id).maybeSingle(),
  ]);
  const archetypes = (catRows ?? []) as ArchRow[];
  const reception = (rcpRows ?? []) as RcpRow[];
  const watchNext = (wnRows ?? []) as WnRow[];
  const whyWatch = (Array.isArray(waRows) ? waRows : []) as WwLens[];
  const recommendedBy = (revRows ?? []) as RevRow[];
  const lineage = (lnRows ?? []) as LinRow[];
  const ratings = (ratRow as Ratings | null) ?? null;
  const watch = (wpRow as Watch | null) ?? null;

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
      .select("id, figure_id, framework, take_title, rationale, leap, strength, is_invitation")
      .in("figure_id", figIds).eq("status", "published");
    for (const t of (takeRows ?? []) as TakeRow[]) {
      if (t.is_invitation) { if (!invitation) invitation = t.rationale; continue; }
      const f = figById.get(t.figure_id);
      misreadings.push({ id: t.id, framework: t.framework, take_title: t.take_title, thesis: t.rationale, leap: t.leap, strength: t.strength, figLabel: f?.label ?? "", figSlug: f?.slug ?? null });
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
  // Hero reel: all videos, clips first (title not "trailer/teaser") and trailer last.
  // media is already position-ordered, and Array.sort is stable, so order is preserved within groups.
  const isTrailerTitle = (t: string | null) => !!t && /trailer|teaser/i.test(t);
  const orderedVids = media.filter((m) => m.kind === "video").sort((a, b) => (isTrailerTitle(a.title) ? 1 : 0) - (isTrailerTitle(b.title) ? 1 : 0));
  const videos = orderedVids.map((m) => ({ id: m.external_id, title: m.title ?? "" }));
  const heroPoster = orderedVids[0]?.thumbnail_url ?? null;

  // Connected films — nearest neighbours by affinity (reasons layer retired with old readings).
  const relIds = (aff ?? []).map((a) => a.related_film_id);
  const { data: relFilms } = relIds.length
    ? await supabase.from("films").select("id, title, slug, year").in("id", relIds)
    : { data: [] as { id: string; title: string; slug: string; year: number | null }[] };
  const relFilmMap = new Map((relFilms ?? []).map((f) => [f.id, f]));
  const recs = (aff ?? []).map((a) => relFilmMap.get(a.related_film_id)).filter(Boolean) as { title: string; slug: string; year: number | null }[];

  const { data: geoRows } = await supabase.rpc("film_geo", { p_slug: slug });
  const geoCount = Array.isArray(geoRows) ? geoRows.length : 0;

  return { film, figures, takeCount, invitation, misreadings, tropes, recs, stills, trailer, videos, heroPoster, archetypes, reception, watchNext, whyWatch, recommendedBy, lineage, ratings, watch, geoCount };
}

// order + cap for the film-page Archetype section
const ARCH_ORDER = ["object", "char_archetype", "char_identity", "char_complex", "location", "theme"];
const ARCH_CAP: Record<string, number> = { theme: 12, char_identity: 18 };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  if ("minimal" in data && data.minimal) {
    const f = data.film as { title: string; year: number | null };
    const t = `${f.title}${f.year ? ` (${f.year})` : ""} — Metatake`;
    return { title: t, robots: pageRobots(false) };
  }
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
  if ("minimal" in data && data.minimal) {
    const f = data.film as { id: string; title: string; slug: string; year: number | null; director: string | null; director_slug: string | null; genres: string[] | null; poster_path: string | null; backdrop_path: string | null; imdb_id: string | null };
    const { lineage, recommendedBy, ratings, watch } = data;
    const mTabs = ([
      lineage.length ? { id: "df-lineage", label: "Lineage" } : null,
      recommendedBy.length ? { id: "df-recby", label: "Recommended by" } : null,
      f.poster_path ? { id: "gallery", label: "Gallery", href: `/film/${f.slug}/gallery` } : null,
    ].filter(Boolean)) as { id: string; label: string; href?: string }[];
    return (
      <div className="mt">
        <SiteNav />
        <div className="df-wrap">
          <div className="df-crumb"><Link href="/film">Films</Link></div>
          <section className="df-hero">
            {f.backdrop_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="df-backdrop" src={`${IMG}/w780${f.backdrop_path}`} alt={`${f.title} backdrop`} />
            ) : <div className="df-backdrop df-backdrop--empty" aria-hidden="true" />}
            <div className="df-headrow">
              {f.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="df-poster" src={`${IMG}/w342${f.poster_path}`} alt={`${f.title} poster`} />
              ) : <div className="df-poster df-poster--empty" aria-hidden="true" />}
              <div className="df-htxt">
                <h1>{f.title} <span className="df-yr">({f.year ?? "?"})</span></h1>
                <div className="df-facts">
                  {f.director ? (f.director_slug ? <Link href={`/director/${f.director_slug}`}>{f.director}</Link> : <span>{f.director}</span>) : null}
                  {f.genres?.length ? <><span className="df-d" />{f.genres.slice(0, 3).join(" · ")}</> : null}
                </div>
                <div className="df-hactions">
                  <MovieListActions filmId={f.id} />
                  {f.poster_path ? <Link className="df-like" href={`/film/${f.slug}/gallery`}>🖼 Gallery →</Link> : null}
                </div>
                <p className="df-catnote">Catalog entry — not yet deeply analyzed on Metatake. Track it in your lists; the films most readers add are the ones we analyze next.</p>
              </div>
            </div>
          </section>

          <FilmTopInfo ratings={ratings} watch={watch} imdbId={f.imdb_id} />

          {mTabs.length > 1 ? <FilmTabBar tabs={mTabs} /> : null}

          <FilmLineageSection lineage={lineage} title={f.title} />
          <FilmRecommendedBy rows={recommendedBy} title={f.title} />

          <div className="df-src">Data &amp; images via TMDB. Not endorsed or certified by TMDB.</div>
        </div>
      </div>
    );
  }
  const { film, figures, takeCount, invitation, misreadings, tropes, recs, stills, trailer, videos, heroPoster, archetypes, reception, watchNext, whyWatch, recommendedBy, lineage, ratings, watch } = data;
  const reviews = reception.filter((r) => r.kind === "criticism");
  const papers = reception.filter((r) => r.kind === "academic");
  const hasLineage = lineage.length > 0;

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
    whyWatch.length ? { id: "df-whywatch", label: "Why watch" } : null,
    hasLineage ? { id: "df-lineage", label: "Lineage" } : null,
    recommendedBy.length ? { id: "df-recby", label: "Recommended by" } : null,
    misreadings.length ? { id: "df-readings", label: "Strong Misreadings!" } : null,
    grouped.length ? { id: "df-figures", label: "Figures" } : null,
    tropes.length ? { id: "df-tropes", label: "Tropes" } : null,
    { id: "df-map", label: "Connections" },
    geoCount > 0 ? { id: "df-atlas", label: "Atlas" } : null,
    archGroups.length ? { id: "df-archetype", label: "Archetype" } : null,
    reception.length ? { id: "df-reception", label: "Reception" } : null,
    watchNext.length ? { id: "df-watchnext", label: "Watch next" } : null,
    recs.length ? { id: "df-connected", label: "Films like" } : null,
    filmInfoPresent ? { id: "df-information", label: "Information" } : null,
    (film.backdrop_path || film.poster_path) ? { id: "df-gallery", label: "Gallery", href: `/film/${film.slug}/gallery` } : null,
  ].filter(Boolean)) as { id: string; label: string; href?: string }[];

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
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <div className="df-wrap">
        <div className="df-crumb">
          <Link href="/film">Films</Link>
          {film.director_slug ? <><span className="df-sep">›</span><Link href={`/director/${film.director_slug}`}>{film.director}</Link></> : null}
        </div>

        {/* HERO — autoplay (muted) trailer in full 16:9; falls back to the colour backdrop */}
        <section className={`df-hero${videos.length ? " df-hero--vid" : ""}`}>
          {videos.length ? (
            <FilmHeroReel videos={videos} poster={heroPoster ?? undefined} start={7} />
          ) : film.backdrop_path ? (
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
                <MovieListActions filmId={film.id} />
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

        {/* TOP INFO BAND — ratings + where to watch, directly under the poster/hero */}
        <FilmTopInfo ratings={ratings} watch={watch} imdbId={film.imdb_id} />

        {/* SECTION TABS — sticky scroll-nav (SEO-safe anchors) */}
        {tabs.length > 1 ? <FilmTabBar tabs={tabs} /> : null}

        {/* INVITATION — spoiler-free way in */}
        {invitation ? (
          <section className={`df-invite${false && trailer ? " df-invite--vid" : ""}`} id="df-invitation">
            <div className="df-invite__txt">
              <div className="df-invite__k">An invitation</div>
              <p className="df-invite__p">{invitation}</p>
              <div className="df-invite__note">Spoiler-free. The readings below do not hold back.</div>
            </div>
            {/* PRESERVED: the trailer now plays in the hero, so this duplicate is disabled.
                To bring it back, remove the `false && ` here and on the section's df-invite--vid class above. */}
            {false && trailer ? (
              <div className="df-invite__vid">
                <InviteVideo videoId={trailer.external_id} title={trailer.title ?? `${film.title} trailer`} poster={trailer.thumbnail_url ?? undefined} />
              </div>
            ) : null}
          </section>
        ) : null}

        {/* WHY WATCH — spoiler-free dossier of what the film offers, across 7 lenses */}
        {whyWatch.length > 0 ? (
          <section className="df-sec" id="df-whywatch">
            <h2 className="df-h2">Why watch</h2>
            <p className="df-sub">A spoiler-free brief on what {film.title} offers — the director&apos;s vision, its craft and ideas, its space and its place in film history.</p>
            <div className="ww-grid">
              {whyWatch.map((L, i) => (
                <div key={i} className="ww-lens">
                  <div className="ww-h">{WW_TITLE[L.key] ?? L.key}</div>
                  <ul className="ww-pts">
                    {(L.points ?? []).map((p, j) => <li key={j}>{p.label ? <b className="ww-lab">{p.label}</b> : null}{p.label ? " — " : ""}{p.text}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* LINEAGE — where the film sits: awards, canons, auteur line */}
        <FilmLineageSection lineage={lineage} title={film.title} />

        {/* RECOMMENDED BY — reverse graph: films whose "Watch next" points here */}
        <FilmRecommendedBy rows={recommendedBy} title={film.title} />

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
                        <SaveChip entityType="take" entityRef={m.id} />
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

        {/* CONNECTION MAP */}
        <section className="df-sec" id="df-map">
          <h2 className="df-h2">{film.title} — connection map</h2>
          <p className="cmap-stat"><b>{figures.length}</b> figures · <b>{misreadings.length}</b> strong misreadings · <b>{tropes.length}</b> tropes</p>
          <p className="cmap-intro">Where {film.title} sits in Metatake&rsquo;s critical web of cinema — its figures, the tropes and ideas they carry, its director, and the films nearest by shared reading. Click any node to open it.</p>
          <EntityMap api={`/api/map?type=film&key=${film.slug}`} full={`/map?m=critical&t=film&k=${film.slug}`} />
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

        {/* RECEPTION — critics & scholarship (copyright-safe: headlines + ≤10-word verbatim verdicts) */}
        {reception.length > 0 ? (
          <section className="df-sec" id="df-reception">
            <h2 className="df-h2">Reception</h2>
            <p className="df-sub">What critics and scholars have written about {film.title} — each headline links to the source; short quotes are verbatim from publishers&apos; own link previews and paper abstracts.</p>
            {reviews.length > 0 ? (
              <div className="df-rcpgrp">
                <div className="df-flabel">Reviews <span className="df-cnt">{reviews.length}</span></div>
                <div className="rcp-list">
                  {reviews.map((r, i) => (
                    <div key={i} className="rcp-row">
                      <a className="rcp-h" href={r.url} target="_blank" rel="noopener nofollow">{r.headline}</a>
                      <div className="rcp-m">{r.outlet}{r.critic ? ` · ${r.critic}` : ""}{r.year ? ` · ${r.year}` : ""}</div>
                      {r.verdict ? <p className="rcp-v">“{r.verdict}”</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {papers.length > 0 ? (
              <div className="df-rcpgrp">
                <div className="df-flabel">Scholarship <span className="df-cnt">{papers.length}</span></div>
                <div className="rcp-list">
                  {papers.map((r, i) => (
                    <div key={i} className="rcp-row">
                      <a className="rcp-h" href={r.url} target="_blank" rel="noopener nofollow">{r.headline}</a>
                      <div className="rcp-m">{r.outlet}{r.critic ? ` · ${r.critic}` : ""}{r.year ? ` · ${r.year}` : ""}</div>
                      {r.verdict ? <p className="rcp-v">“{r.verdict}”</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="df-src">Headlines &amp; ≤10-word quotes from publishers&apos; link previews (og:description) and paper abstracts (OpenAlex/Crossref). No article text is stored.</div>
          </section>
        ) : null}

        {/* WATCH NEXT — curated 9 next films (LLM, with the bridge), linked if in our DB */}
        {watchNext.length > 0 ? (
          <section className="df-sec" id="df-watchnext">
            <h2 className="df-h2">Watch next</h2>
            <p className="df-sub">Where to go after {film.title} — nine films that continue its conversation, each chosen for a specific bridge. Curated, not algorithmic.</p>
            <div className="wn-list">
              {watchNext.map((w, i) => {
                const href = w.target_slug ? `/film/${w.target_slug}` : null;
                const poster = w.target_poster ?? w.poster_path;
                const title = w.target_title ?? w.rec_title;
                const year = w.target_year ?? w.rec_year;
                return (
                  <div key={i} className="wn-card">
                    <div className="wn-pos">{i + 1}</div>
                    {poster ? (
                      href
                        ? <Link href={href} className="wn-pl">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="wn-pi" src={`${IMG}/w185${poster}`} alt="" loading="lazy" />{w.target_slug ? <PosterActions slug={w.target_slug} compact /> : null}</Link>
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img className="wn-pi" src={`${IMG}/w185${poster}`} alt="" loading="lazy" />
                    ) : <div className="wn-pi wn-pi--empty" aria-hidden="true" />}
                    <div className="wn-tx">
                      <div className="wn-h">{href ? <Link href={href}>{title}</Link> : title} <span className="wn-yr">({year ?? "?"})</span></div>
                      {w.rec_director ? <div className="wn-dir">{w.rec_director}</div> : null}
                      {w.reason ? <p className="wn-why">{w.reason}</p> : null}
                      {!href && w.tmdb_id ? (
                        <span className="wn-ext">not yet on Metatake · <a href={`https://www.themoviedb.org/movie/${w.tmdb_id}`} target="_blank" rel="noopener nofollow">TMDB ↗</a></span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
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
              {trailer && !invitation ? (
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
