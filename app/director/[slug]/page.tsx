import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityNews from "@/components/EntityNews";
import CreditsExplorer from "@/app/credits/CreditsExplorer";
import { CRAFTS, personSlug, type CraftKey } from "@/app/credits/credits-logic";
import crewIndex from "@/lib/crew_index.json";
import { directorRepertory } from "@/lib/filmCrew";
import { directorNative } from "@/lib/nativeName";
import { resolveAlias } from "@/lib/aliases";
import "@/app/credits/credits.css";
import LightboxImage from "@/components/LightboxImage";
import FilmTabBar from "@/components/FilmTabBar";
import EntityMap from "@/components/EntityMap";
import FilmMap from "@/components/FilmMap";
import Byline from "@/components/Byline";
import { fw } from "@/lib/frameworks";
import { axisLabel, nodeHref } from "@/lib/catalog";
import { DIRECTOR_LOCATIONS_MIN_FILMS, DIRECTOR_LOCATIONS_MIN_PINS, mergeCells, mergePins, type GeoPin } from "@/lib/atlas";
import SaveButton from "@/components/SaveButton";
import PosterActions from "@/components/PosterActions";
import LensDirectorCoverage from "@/components/LensDirectorCoverage";
import RecordToc from "@/components/read/RecordToc";
import DirectorPlates from "@/components/read/DirectorPlates";
import TakeScoreBoxes from "@/components/read/TakeScoreBoxes";
import { cachedRankedScores } from "@/lib/takescore-bulk";
import "@/app/film/[slug]/read.css";
import "@/app/curious/curious.css";

export const revalidate = 300;
export async function generateStaticParams() { return []; }
const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }>; }

type Pick = { pos: number; film_slug: string | null; film_title: string | null; film_year: number | null; label: string | null; reason: string | null };
type Fact = { n: number; text: string; source?: string | null };
type Next = { pos: number; rec_name: string; reason: string; target_slug: string | null; tmdb_person_id: number | null; profile_path: string | null };

async function loadUncached(slug: string) {
  const supabase = db();
  const { data: films } = await supabase
    .from("films").select("id, title, slug, year, director, backdrop_path, poster_path, tmdb_id").eq("director_slug", slug).eq("visible", true).order("year");
  if (!films || films.length === 0) return null;
  const director = films[0].director ?? slug.replace(/-/g, " ");
  const filmIds = films.map((f) => f.id);

  // Layer 2 — the rest of the filmography: hidden catalog films by this
  // director. Matched by director_slug where backfilled, else by the exact
  // TMDB director name (most hidden rows carry only the name).
  type HiddenFilm = { slug: string; title: string; original_title: string | null; year: number | null; poster_path: string | null };
  const { data: hiddenRows, count: hiddenCount } = await supabase
    .from("films")
    .select("slug, title, original_title, year, poster_path", { count: "exact" })
    .eq("visible", false)
    .or(`director_slug.eq.${slug},director.eq."${director.replace(/"/g, '\\"')}"`)
    .order("year", { ascending: false, nullsFirst: false })
    .order("slug")
    .limit(24);
  const hiddenFilms = (hiddenRows as HiddenFilm[] | null) ?? [];
  const hiddenTotal = hiddenCount ?? hiddenFilms.length;

  const [{ data: dir }, { data: portrait }, { data: facts }, { data: picks }, { data: next }, { data: recByRaw }, { data: misRows }, { data: archRows }] = await Promise.all([
    supabase.from("directors").select("name, profile_path, bio, birthday, place_of_birth").eq("slug", slug).maybeSingle(),
    supabase.from("director_portrait").select("body, source").eq("director_slug", slug).maybeSingle(),
    supabase.from("director_facts").select("name_meaning, intro, facts").eq("director_slug", slug).maybeSingle(),
    supabase.from("director_picks").select("pos, film_slug, film_title, film_year, label, reason").eq("director_slug", slug).order("pos"),
    supabase.from("director_next").select("pos, rec_name, reason, target_slug, tmdb_person_id, profile_path").eq("director_slug", slug).order("pos"),
    supabase.from("director_next").select("director_slug").eq("target_slug", slug),
    supabase.rpc("director_misreadings", { p_slug: slug, p_limit: 30 }),
    supabase.rpc("director_catalog", { p_slug: slug }),
  ]);

  // Strong Misreadings — pick a representative set: strongest first, max 2 per film, cap 8.
  type Mis = { framework: string | null; take_title: string | null; rationale: string | null; strength: number | null; figure_label: string | null; figure_slug: string | null; film_title: string; film_slug: string; film_year: number | null };
  const perFilm = new Map<string, number>(); const misreadings: Mis[] = [];
  for (const m of ((misRows as Mis[] | null) ?? [])) {
    const c = perFilm.get(m.film_slug) ?? 0;
    if (c >= 2) continue;
    perFilm.set(m.film_slug, c + 1); misreadings.push(m);
    if (misreadings.length >= 8) break;
  }
  // Archetype — aggregate across the filmography, cap per axis.
  type Arch = { axis: string; slug: string; label: string; n: number };
  const archByAxis = new Map<string, Arch[]>();
  for (const a of ((archRows as Arch[] | null) ?? [])) {
    const arr = archByAxis.get(a.axis) ?? []; if (arr.length < 12) arr.push(a); archByAxis.set(a.axis, arr);
  }
  const ARCH_AXES = ["char_archetype", "char_identity", "char_complex", "object", "location", "theme"];
  const archGroups = ARCH_AXES.map((axis) => ({ axis, items: archByAxis.get(axis) ?? [] })).filter((g) => g.items.length > 0);

  // reverse "recommended by" — resolve recommender slugs → display names
  const recBySlugs = [...new Set(((recByRaw ?? []) as { director_slug: string }[]).map((r) => r.director_slug))];
  let recBy: { slug: string; name: string }[] = [];
  if (recBySlugs.length) {
    const { data: names } = await supabase.from("directors").select("slug, name").in("slug", recBySlugs);
    const nameOf = new Map((names ?? []).map((n: { slug: string; name: string }) => [n.slug, n.name]));
    recBy = recBySlugs.map((s) => ({ slug: s, name: nameOf.get(s) || s.replace(/-/g, " ") }));
  }

  // Per-film Strong Misreading (reading) counts across the filmography.
  const { data: readRows } = await supabase
    .from("takes").select("figure:figures!inner(film_id)").in("figure.film_id", filmIds).eq("status", "published");
  const perFilmReadings = new Map<string, number>();
  for (const r of (readRows ?? []) as unknown[]) {
    const fid = (r as { figure: { film_id: string } }).figure.film_id;
    perFilmReadings.set(fid, (perFilmReadings.get(fid) ?? 0) + 1);
  }
  let readingCount = 0;
  for (const v of perFilmReadings.values()) readingCount += v;

  const filmById = new Map<string, { id: string; title: string; slug: string; year: number | null }>(
    films.map((f) => [f.id as string, f as { id: string; title: string; slug: string; year: number | null }])
  );

  // Tropes (figure-types) recurring across the filmography.
  const { data: tropeRows } = await supabase
    .from("figure_type_members")
    .select("meta_take:meta_takes!inner(id, slug, title, status, kind), figure:figures!inner(film_id)")
    .in("figure.film_id", filmIds).eq("meta_take.status", "published").eq("meta_take.kind", "figure_type");
  const tropeFilms = new Map<string, { slug: string; title: string; films: Set<string> }>();
  for (const r of (tropeRows ?? []) as unknown[]) {
    const t = r as { meta_take: { id: string; slug: string; title: string }; figure: { film_id: string } };
    const e = tropeFilms.get(t.meta_take.id) ?? { slug: t.meta_take.slug, title: t.meta_take.title, films: new Set<string>() };
    e.films.add(t.figure.film_id); tropeFilms.set(t.meta_take.id, e);
  }
  const sigTropes = [...tropeFilms.values()]
    .filter((m) => m.films.size >= 2).sort((a, b) => b.films.size - a.films.size)
    // Drop the `films` Set from the returned shape — the Data Cache can't
    // serialize Sets, and consumers only read `filmList`.
    .map((m) => ({ slug: m.slug, title: m.title, filmList: [...m.films].map((id) => filmById.get(id)!).filter(Boolean) }));

  // Who's Next photos: matched directors (target_slug set) have their photo in `directors`,
  // not in director_next — pull it so the circles aren't grey.
  const nextArr = (next as Next[] | null) ?? [];
  const needPhoto = [...new Set(nextArr.filter((n) => n.target_slug && !n.profile_path).map((n) => n.target_slug as string))];
  if (needPhoto.length) {
    const { data: dp } = await supabase.from("directors").select("slug, profile_path").in("slug", needPhoto);
    const pmap = new Map((dp ?? []).map((r: { slug: string; profile_path: string | null }) => [r.slug, r.profile_path]));
    for (const n of nextArr) { if (n.target_slug && !n.profile_path) n.profile_path = pmap.get(n.target_slug) ?? null; }
  }

  // Record-layer counts (2026-07-09) — the doors to the aggregation articles
  // (honors/reception; theory uses readingCount, takescore uses total films).
  const [lnCnt, wdCnt, rcpCnt] = await Promise.all([
    supabase.from("film_lineage").select("id", { count: "exact", head: true }).in("film_id", filmIds),
    supabase.from("film_wd_honors").select("id", { count: "exact", head: true }).in("film_id", filmIds),
    supabase.from("film_reception").select("id", { count: "exact", head: true }).in("film_id", filmIds),
  ]);
  const honorsN = (lnCnt.count ?? 0) + (wdCnt.count ?? 0);
  const receptionN = rcpCnt.count ?? 0;

  const { data: geoRows } = await supabase.rpc("director_geo", { p_slug: slug });
  const geoCount = Array.isArray(geoRows) ? geoRows.length : 0;
  // geoCells/geoFilms gate the Locations tab/link (the read page's own 404
  // rule and the sitemap SQL count the same cells); geoMerged is the fused
  // display count.
  const geoCellsArr = Array.isArray(geoRows) ? mergeCells(geoRows as GeoPin[]) : [];
  const geoCells = geoCellsArr.length;
  const geoFilms = new Set(geoCellsArr.map((p) => p.film_slug)).size;
  const geoMerged = Array.isArray(geoRows) ? mergePins(geoRows as GeoPin[]).length : 0;

  return {
    // perFilmReadings is a Map; the Data Cache can't serialize Maps, so return
    // a plain object. Consumers read it with bracket access.
    director, dir, films, sigTropes, perFilmReadings: Object.fromEntries(perFilmReadings), total: films.length, readingCount, tropeCount: tropeFilms.size,
    portrait: portrait as { body: string; source: string } | null,
    facts: facts as { name_meaning: string | null; intro: string | null; facts: Fact[] } | null,
    picks: (picks as Pick[] | null) ?? [],
    next: nextArr,
    recBy, misreadings, archGroups, geoCount, geoCells, geoMerged, geoFilms,
    hiddenFilms, hiddenTotal, honorsN, receptionN,
  };
}

// generateStaticParams returns [] (nothing prebuilt) and load() is a large
// multi-query fetch, so without caching every director view re-ran the whole
// set dynamically. Cache per slug in the Data Cache so the route is ISR-cached;
// tagged director:<slug> for on-demand refresh.
function load(slug: string) {
  // Cache key bumped (load5) when honorsN/receptionN joined the payload —
  // the Data Cache outlives deploys, so a shape change needs a new key.
  return unstable_cache(() => loadUncached(slug), ["director-load5", slug], {
    revalidate: 300,
    tags: [`director:${slug}`],
  })();
}

// First 1–2 sentences of prose, plain text, ≤155 chars, truncated at a word boundary with "…".
function metaDescription(text: string, maxLen = 155): string {
  const plain = text.replace(/\s+/g, " ").trim();
  const sentences = plain.match(/[^.!?]+[.!?]+(\s+|$)/g);
  let out = sentences ? sentences.slice(0, 2).join("").trim() : plain;
  if (out.length > maxLen) {
    const cut = out.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    out = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
  }
  return out;
}

// The no-portrait fallback: our own numbers as prose — unique text with real
// counts instead of TMDB boilerplate. Deterministic; no LLM in the path.
function editorialSummary(d: {
  director: string; total: number; readingCount: number;
  films: { year?: number | null }[];
  sigTropes: { title: string }[];
  picks: { film_title?: string | null }[];
}): string {
  const years = d.films.map((f) => f.year).filter((y): y is number => typeof y === "number");
  const span = years.length > 1 ? ` (${Math.min(...years)}–${Math.max(...years)})` : "";
  const parts = [
    `On Metatake, ${d.director}'s ${d.total} film${d.total === 1 ? "" : "s"}${span} ${d.total === 1 ? "carries" : "carry"} ${d.readingCount} original critical readings.`,
  ];
  if (d.sigTropes.length) parts.push(`The shapes that recur across the work: ${d.sigTropes.slice(0, 3).map((t) => t.title).join(" · ")}.`);
  const first = d.picks?.[0]?.film_title;
  if (first) parts.push(`New here? Start with ${first}.`);
  return parts.join(" ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const native = await directorNative(data.director);
  const title = `${data.director}${native ? ` (${native})` : ""} — Films, Style & Where to Start`;
  // TMDB bio is never used as our description — our portrait when it exists,
  // otherwise the deterministic editorial summary (unique text, real numbers).
  const description = data.portrait?.body
    ? metaDescription(data.portrait.body)
    : metaDescription(editorialSummary(data));
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `/director/${slug}` },
  };
}

const SIG_LIMIT = 12;

export default async function DirectorPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) {
    // Renamed/merged director slugs live in the slug_aliases ledger — honor
    // them as permanent redirects before 404ing (same pattern as /film, /take).
    const alias = await resolveAlias(`/director/${slug}`);
    if (alias) permanentRedirect(alias);
    notFound();
  }
  const { director, dir, films, sigTropes, perFilmReadings, total, readingCount, tropeCount, portrait, facts, picks, next, recBy, misreadings, archGroups, geoCount, geoCells, geoMerged, geoFilms, hiddenFilms = [], hiddenTotal = 0, honorsN = 0, receptionN = 0 } = data;
  const native = await directorNative(director);
  // Repertory company — the SEO-crawlable credits copy: recurring key-craft
  // collaborators across this director's catalog films, each linking to their
  // /credits/[person] read page. Per-film crew is 24h-cached (shared cache).
  const crewTmdbIds = (films as { tmdb_id?: number | null }[]).map((f) => f.tmdb_id).filter((x): x is number => !!x);
  // Directors who write/edit their own films would top their own list — the
  // company they keep is everyone else.
  // The repertory fan-out (≤40 TMDB credit fetches on a cold cache) was the
  // page's TTFB bottleneck — cache the aggregated result per director.
  const repertory = (crewTmdbIds.length
    ? await unstable_cache(
        () => directorRepertory(crewTmdbIds),
        ["director-repertory", slug],
        { revalidate: 86400, tags: [`director:${slug}`] },
      )()
    : []
  ).filter((r) => r.name.toLowerCase() !== director.toLowerCase());
  const d = dir as { profile_path?: string | null; bio?: string | null; birthday?: string | null; place_of_birth?: string | null } | null;

  // TakeScore per film for the complete filmography table (4 boxed metrics).
  // From the shared bulk ranking (one fast cached query for the whole corpus)
  // — cinecodex_card in a per-film loop starved Postgres into timeouts.
  type Score = { u: number; v: number; c: number; r: number; tier: string | null };
  const { scores: bulkScores } = await cachedRankedScores();
  const filmScores: Record<string, Score> = {};
  for (const f of films as { slug: string }[]) {
    const b = bulkScores[f.slug];
    if (b) filmScores[f.slug] = { u: b.u, v: b.v, c: b.c, r: b.r, tier: null };
  }

  // Entity stitching — same human as a /credits crew page? Exact, unique name
  // match against the crew index; namesakes (0 or >1 hits) are skipped silently.
  const crewPeople = (crewIndex as unknown as { people: { id: number; name: string; n: number; c: string[] }[] }).people;
  const crewMatches = crewPeople.filter((c) => c.name === director);
  const crewMatch = crewMatches.length === 1 ? crewMatches[0] : null;
  const crewHref = crewMatch ? `/credits/${personSlug(crewMatch.name, crewMatch.id)}` : null;
  const crewRoles = crewMatch
    ? crewMatch.c.filter((k): k is CraftKey => k in CRAFTS).map((k) => CRAFTS[k].role.toLowerCase()).join(", ")
    : null;

  const jsonld = {
    "@context": "https://schema.org", "@type": "Person", name: director, jobTitle: "Film director",
    ...(crewHref ? { sameAs: [`https://metatake.net${crewHref}`] } : {}),
    ...(native ? { alternateName: native } : {}),
    ...(d?.profile_path ? { image: `${IMG}/w342${d.profile_path}` } : {}),
    ...(d?.birthday ? { birthDate: d.birthday } : {}),
    ...(d?.place_of_birth ? { birthPlace: d.place_of_birth } : {}),
    ...(portrait?.body ? { description: portrait.body.slice(0, 500) } : { description: editorialSummary(data) }),
  };

  // Filmography as ItemList — the machine-readable answer to "[director] films",
  // the highest-volume query class a director page can win.
  const filmographyLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Films by ${director}`,
    numberOfItems: films.length + hiddenTotal,
    itemListElement: (films as { slug: string; title: string; year: number | null }[]).map((f, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: { "@type": "Movie", name: f.title, url: `https://metatake.net/film/${f.slug}`, ...(f.year ? { datePublished: String(f.year) } : {}) },
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
      { "@type": "ListItem", position: 2, name: "Directors", item: "https://metatake.net/director" },
      { "@type": "ListItem", position: 3, name: director, item: `https://metatake.net/director/${slug}` },
    ],
  };

  const summaryText = portrait?.body ? null : editorialSummary(data);

  let bornLabel: string | null = null;
  if (d?.birthday) {
    const dt = new Date(d.birthday);
    bornLabel = isNaN(dt.getTime()) ? d.birthday : dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  }

  const tropesShown = sigTropes.slice(0, SIG_LIMIT);
  // TMDB bio deliberately dropped from display: third-party boilerplate reads
  // worse than our own numbers, and duplicates text Google has seen elsewhere.
  const portraitText = portrait?.body || null;

  // Portrait art: 2 wide stills (backdrops) over 3 tall posters — seeded shuffle → stable per ISR.
  type FilmArt = { id: string; slug: string; title: string; year: number | null; poster_path?: string | null; backdrop_path?: string | null };
  const seed = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 7);
  const shuf = (arr: FilmArt[]) => arr.map((f, i) => ({ f, k: (i * 2654435761 + seed * 40503) % 1000000 })).sort((a, b) => a.k - b.k).map((x) => x.f);
  const wideArt = shuf((films as FilmArt[]).filter((f) => f.backdrop_path)).slice(0, 2);
  const wideSlugs = new Set(wideArt.map((f) => f.slug));
  const tallArt = shuf((films as FilmArt[]).filter((f) => f.poster_path && !wideSlugs.has(f.slug))).slice(0, 3);
  const hasArt = wideArt.length > 0 || tallArt.length > 0;

  // poster for each pick (picks reference the director's own films)
  const posterBySlug = new Map<string, string | null>((films as FilmArt[]).map((f) => [f.slug, f.poster_path || f.backdrop_path || null]));

  // Dynamic tabs — the film-page menu grammar (2026-07-09): two offset rails,
  // per-section colors, live counts as tinted badges. Portrait + Filmography
  // always; others when their data exists.
  const nArch = archGroups.reduce((s, g) => s + g.items.length, 0);
  const filmoTotal = total + hiddenTotal;
  const tabs: { id: string; label: string; href?: string; badge?: number; color?: string }[] = [
    { id: "dr-portrait", label: "Portrait", color: "#5A6B86" },
    { id: "dr-filmography", label: "Filmography", badge: filmoTotal, color: "#2E7D9E" },
  ];
  if (misreadings.length) tabs.push({ id: "dr-misreadings", label: "Strong Misreadings", badge: readingCount, color: "#D64534" });
  tabs.push({ id: "dr-selection", label: "The selection", badge: total, color: "#0F6E56" });
  if (sigTropes.length) tabs.push({ id: "dr-tropes", label: "Tropes", badge: tropeCount, color: "#12897A" });
  if (archGroups.length) tabs.push({ id: "dr-archetype", label: "Archetype", badge: nArch, color: "#6B4E9E" });
  if (facts && Array.isArray(facts.facts) && facts.facts.length) tabs.push({ id: "dr-life", label: "The Life", badge: facts.facts.length, color: "#B8863B" });
  if (next.length) tabs.push({ id: "dr-next", label: "Who's Next", badge: next.length, color: "#B85C9E" });
  if (picks.length) tabs.push({ id: "dr-start", label: "Where to Start", badge: picks.length, color: "#C87A2C" });
  if (honorsN + receptionN > 0 || total >= 3 || readingCount > 0) tabs.push({ id: "dr-records", label: "The records", badge: honorsN + receptionN, color: "#8A6D3B" });
  tabs.push({ id: "dr-map", label: "Connections", color: "#2F6DB0" });
  if (geoCount > 0) tabs.push({ id: "dr-atlas", label: "Atlas", badge: geoMerged, color: "#2E8B6E" });
  const hasLocationsPage = geoFilms >= DIRECTOR_LOCATIONS_MIN_FILMS && geoCells >= DIRECTOR_LOCATIONS_MIN_PINS;
  if (hasLocationsPage) tabs.push({ id: "dr-locations", label: "Locations", href: `/director/${slug}/locations`, badge: geoMerged, color: "#3F7E8C" });
  tabs.push({ id: "dr-credits", label: "Credits", color: "#6B7280" });

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(filmographyLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div className="dr-wrap">
        <div className="dr-crumb"><Link href="/director">Directors</Link></div>

        {/* HEADER */}
        <div className="dr-head">
          {d?.profile_path ? (
            <div className="dr-photo">
              <LightboxImage src={`${IMG}/w185${d.profile_path}`} fullUrl={`${IMG}/w342${d.profile_path}`} alt={director} caption={director} width={185} height={278} />
            </div>
          ) : (<div className="dr-photo dr-photo--empty" aria-hidden="true" />)}
          <div className="dr-txt">
            <div className="dr-role">Director</div>
            <h1 className="dr-h1">
              {director}
              {native ? <span style={{ fontWeight: 400, opacity: 0.72, fontSize: "0.72em" }}> ({native})</span> : null}
            </h1>
            <Byline />
            {(bornLabel || d?.place_of_birth) && (
              <div className="dr-born">
                {bornLabel && <span>Born {bornLabel}</span>}
                {bornLabel && d?.place_of_birth && <span className="dr-dot" />}
                {d?.place_of_birth && <span>{d.place_of_birth}</span>}
              </div>
            )}
            <div className="dr-save"><SaveButton entityType="director" entityRef={slug} label="Add to favorites" labelOn="Favorite" variant="heart" /></div>
          </div>
        </div>

        {/* STAT STRIP */}
        <div className="dr-stats">
          <a className="dr-stat" href="#dr-filmography"><div className="dr-n">{total}</div><div className="dr-k">Films</div></a>
          <a className="dr-stat" href="#dr-misreadings"><div className="dr-n">{readingCount}</div><div className="dr-k">Readings</div></a>
          <a className="dr-stat dr-teal" href="#dr-tropes"><div className="dr-n">{tropeCount}</div><div className="dr-k">Tropes</div></a>
        </div>
      </div>

      <div className="dr-wrap">
        <FilmTabBar tabs={tabs} twoRow />

        {/* PORTRAIT — our portrait when written; otherwise our numbers as
            prose. TMDB's bio is never shown (third-party duplicate text). */}
        <section className="dr-sec" id="dr-portrait">
          <h2 className="dr-h2">{portraitText ? <>{director} — a Metatake Portrait</> : <>{director} on Metatake</>}</h2>
          <div className={`dr-portrait-row${hasArt ? "" : " dr-portrait-row--solo"}`}>
            <div className="dr-portrait-main">
              {portraitText ? (
                <div className="dr-portrait-body">
                  {portraitText.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
                  <Byline />
                </div>
              ) : (
                <div className="dr-portrait-body">
                  <p>{summaryText}</p>
                  <div className="dr-src">A Metatake editorial summary, computed from the live corpus — the full portrait is being written.</div>
                </div>
              )}
            </div>
            {hasArt && (
              <div className="dr-portrait-art" aria-hidden="true">
                {wideArt.length > 0 && (
                  <div className="dr-pa-wide">
                    {wideArt.map((f) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={f.slug} className="dr-pa-w" src={`${IMG}/w300${f.backdrop_path}`} alt="" loading="lazy" title={`${f.title}${f.year ? ` (${f.year})` : ""}`} />
                    ))}
                  </div>
                )}
                {tallArt.length > 0 && (
                  <div className="dr-pa-tall">
                    {tallArt.map((f) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={f.slug} className="dr-pa-t" src={`${IMG}/w185${f.poster_path}`} alt="" loading="lazy" title={`${f.title}${f.year ? ` (${f.year})` : ""}`} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* FILMOGRAPHY — the COMPLETE list (closely-read + catalog), pulled up
            and shown expanded: year · title · reading count · TakeScore boxes.
            Every film links to its page. (2026-07-09 restructure) */}
        {(() => {
          const readFilms = (films as { slug: string; title: string; year: number | null; poster_path?: string | null; id: string }[])
            .map((f) => ({ slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path ?? null, readings: perFilmReadings[f.id] ?? 0, score: filmScores[f.slug] ?? null }));
          const catFilms = (hiddenFilms as { slug: string; title: string; year: number | null; poster_path: string | null }[])
            .map((f) => ({ slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path, readings: 0, score: null as Score | null }));
          const allFilms = [...readFilms, ...catFilms].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));
          const scoredN = readFilms.filter((f) => f.score).length;
          return (
            <section className="dr-sec" id="dr-filmography">
              <h2 className="dr-h2">Filmography</h2>
              <p className="dr-gloss">
                Every {director} film on Metatake, oldest first — {total} read closely{hiddenTotal > 0 ? ` and ${hiddenTotal} more in the catalog` : ""}.
                {scoredN > 0 ? <> {scoredN} carr{scoredN === 1 ? "ies" : "y"} a <Link href={`/director/${slug}/takescore`}>TakeScore</Link> — the boxed numbers are Value, Cost and Risk behind the headline score.</> : null}
              </p>
              <LensDirectorCoverage slugs={(films as { slug: string }[]).map((f) => f.slug)} />
              <div className="dr-filmo">
                {allFilms.map((f) => (
                  <Link key={f.slug} href={`/film/${f.slug}`} className="dr-flm">
                    <span className="dr-flm__yr">{f.year ?? "—"}</span>
                    {f.poster_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="dr-flm__po" src={`${IMG}/w92${f.poster_path}`} alt="" width={34} height={51} loading="lazy" />
                    ) : <span className="dr-flm__po dr-flm__po--e" aria-hidden="true" />}
                    <span className="dr-flm__mid">
                      <span className="dr-flm__ti">{f.title}</span>
                      <span className="dr-flm__sub">{f.readings > 0 ? `${f.readings} Strong Misreading${f.readings === 1 ? "" : "s"}` : "In the catalog"}</span>
                    </span>
                    {f.score ? (
                      <span className="dr-flm__sc"><TakeScoreBoxes s={f.score} /></span>
                    ) : <span className="dr-flm__unscored">not yet scored</span>}
                  </Link>
                ))}
              </div>
              <div className="dr-prov">Filmography &amp; images via TMDB; readings &amp; TakeScores computed from the Metatake corpus.</div>
            </section>
          );
        })()}

        {/* IN THE NEWS — the Now Playing hourly desk's record for this director */}
        <EntityNews directorSlug={slug} variant="dr" />

        {/* STRONG MISREADINGS — a representative set; the full set lives on its own page */}
        {misreadings.length > 0 && (
          <section className="dr-sec" id="dr-misreadings">
            <h2 className="dr-h2">Strong Misreadings</h2>
            <p className="dr-gloss">{readingCount} bold readings across {director}&apos;s films — here are the strongest, at most two per film. {readingCount > misreadings.length ? <>The complete set is <Link href={`/director/${slug}/misreadings`}>on its own page</Link>.</> : "Open a film for its full set."}</p>
            <div className="dr-mr-cards">
              {misreadings.map((m, i) => {
                const f = fw(m.framework);
                const thesis = m.rationale ? (m.rationale.length > 220 ? m.rationale.slice(0, 220).trimEnd() + "…" : m.rationale) : null;
                return (
                  <div className="dr-mr-card" key={i}>
                    <div className="dr-mr-top">
                      <span className="dr-mr-fw" style={{ color: f.color }}>{f.label}</span>
                      <Link className="dr-mr-film" href={`/film/${m.film_slug}#df-readings`}>{m.film_title}{m.film_year ? ` (${m.film_year})` : ""}</Link>
                    </div>
                    {m.take_title ? (
                      <Link className="dr-mr-title" href={m.figure_slug ? `/film/${m.film_slug}/figure/${m.figure_slug}` : `/film/${m.film_slug}#df-readings`}>{m.take_title}</Link>
                    ) : null}
                    {thesis ? <p className="dr-mr-thesis">{thesis}</p> : null}
                    {m.figure_label ? (
                      <div className="dr-mr-via"><span className="dr-mr-vk">via</span>{" "}
                        {m.figure_slug ? <Link href={`/film/${m.film_slug}/figure/${m.figure_slug}`}>{m.figure_label}</Link> : <span>{m.figure_label}</span>}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TROPES — signature figure-types, just the items */}
        {sigTropes.length > 0 && (
          <section className="dr-sec dr-sec--teal" id="dr-tropes">
            <h2 className="dr-h2">Tropes</h2>
            <p className="dr-gloss">Figure-types {director} returns to — computed across the filmography. <Link className="dr-teal-link" href="/tropes">All tropes →</Link></p>
            <div className="dr-chips">
              {tropesShown.map((m) => (
                <Link key={m.slug} className="dr-chip dr-chip--teal" href={`/trope/${m.slug}`}>{m.title}<span className="dr-chip-n">{m.filmList.length}</span></Link>
              ))}
            </div>
          </section>
        )}

        {/* ARCHETYPE — catalog classification aggregated across the filmography */}
        {archGroups.length > 0 && (
          <section className="dr-sec" id="dr-archetype">
            <h2 className="dr-h2">Archetype</h2>
            <p className="dr-gloss">What recurs across {director}&apos;s films by the figure catalog — characters, objects, places, themes. Each links into the <Link href="/catalog">Archetype</Link> catalog.</p>
            {archGroups.map((g) => (
              <div className="dr-arch-grp" key={g.axis}>
                <div className="dr-arch-axis">{axisLabel(g.axis)}</div>
                <div className="dr-chips">
                  {g.items.map((a) => (
                    <Link key={a.slug} className="dr-chip" href={nodeHref(g.axis, a.slug)}>{a.label}{a.n > 1 ? <span className="dr-chip-n">{a.n}</span> : null}</Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* THE LIFE */}
        {facts && Array.isArray(facts.facts) && facts.facts.length > 0 && (
          <section className="dr-sec" id="dr-life">
            <h2 className="dr-h2">The Life of {director}</h2>
            <p className="dr-gloss">The person behind the films — {facts.facts.length} researched moments, compiled by Metatake Editorial and edited by <Link href="/editor">Wonwoo Yoon</Link>.</p>
            {facts.name_meaning ? (
              <div className="dr-namemean"><span className="dr-nm-k">The name</span><p>{facts.name_meaning}</p></div>
            ) : null}
            {facts.intro ? <p className="dr-life-intro">{facts.intro}</p> : null}
            <ol className="dr-life-list">
              {facts.facts.slice().sort((a, b) => a.n - b.n).slice(0, 6).map((f) => {
                let host = "";
                try { if (f.source) host = new URL(f.source).hostname.replace(/^www\./, ""); } catch {}
                return (
                  <li key={f.n} className="dr-fact">
                    {f.text}
                    {f.source ? <> <a className="dr-fact-src" href={f.source} target="_blank" rel="noopener nofollow" title={f.source}>↗ {host}</a></> : null}
                  </li>
                );
              })}
            </ol>
            <div className="rec-tocs" style={{ maxWidth: 420 }}>
              <RecordToc
                href={`/director/${slug}/life`}
                kicker="The full life"
                title={`Who is ${director}? — every researched moment, sourced`}
                rows={[
                  { label: "Researched moments", value: facts.facts.length },
                  { label: "Films on Metatake", value: total },
                ]}
                cta="Open the life"
              />
            </div>
            <div className="dr-src">Each fact is written freely, then verified against a live web source (English &amp; native-language). Source link per fact.</div>
          </section>
        )}

        {/* WHO'S NEXT */}
        {next.length > 0 && (
          <section className="dr-sec" id="dr-next">
            <h2 className="dr-h2">Who&apos;s Next</h2>
            <p className="dr-gloss">Five directors to explore after {director} — each chosen for a specific kinship. Curated, not algorithmic.</p>
            <div className="dr-next-grid">
              {next.map((n) => (
                <div className="dr-next-card" key={n.pos}>
                  {n.profile_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="dr-next-photo" src={`${IMG}/w185${n.profile_path}`} alt="" loading="lazy" />
                  ) : <span className="dr-next-photo dr-next-photo--e" aria-hidden="true" />}
                  <div className="dr-next-b">
                    <div className="dr-next-name">
                      {n.target_slug ? <Link href={`/director/${n.target_slug}`}>{n.rec_name}</Link> : <>{n.rec_name} <span className="dr-next-off">not yet on Metatake</span></>}
                    </div>
                    <p className="dr-next-why">{n.reason}</p>
                  </div>
                </div>
              ))}
            </div>
            {recBy.length > 0 && (
              <div className="dr-recby">
                <span className="dr-recby-k">Pointed to from:</span>{" "}
                {recBy.map((r, i) => (<span key={r.slug}>{i > 0 ? " · " : ""}<Link href={`/director/${r.slug}`}>{r.name}</Link></span>))}
              </div>
            )}
            <div className="rec-tocs" style={{ maxWidth: 420 }}>
              <RecordToc
                href={`/director/${slug}/next`}
                kicker="Who's next"
                title={`${next.length} directors to watch after ${director} — and exactly why`}
                rows={[
                  { label: "Recommendations", value: next.length },
                  ...(recBy.length ? [{ label: "Pointed to from", value: recBy.length }] : []),
                ]}
                cta="Open the kinships"
              />
            </div>
          </section>
        )}

        {/* THE RECORDS — doors to the filmography-wide aggregation articles
            (film-page grammar: counted print-TOC doors, no banners). */}
        {(honorsN + receptionN > 0 || total >= 3 || readingCount > 0) && (
          <section className="dr-sec" id="dr-records">
            <h2 className="dr-h2">The records — across the filmography</h2>
            <p className="dr-gloss">The film-level records ({director}&apos;s scores, honors, press and theory readings) gathered into filmography-wide articles — counted below, argued in full behind each door.</p>
            <div className="rec-tocs">
              {total >= 3 ? (
                <RecordToc
                  href={`/director/${slug}/takescore`}
                  kicker="TakeScore™"
                  title={`Every ${director} film, scored — the ranking`}
                  rows={[{ label: "Films scored", value: total }, { label: "Readings behind them", value: readingCount }]}
                  cta="Open the ranking"
                />
              ) : null}
              {honorsN > 0 ? (
                <RecordToc
                  href={`/director/${slug}/honors`}
                  kicker="The honors record"
                  title={`Every award ${director}'s films have won — counted and sourced`}
                  rows={[{ label: "Honors on the record", value: honorsN }, { label: "Films", value: total }]}
                  cta="Open the record"
                />
              ) : null}
              {receptionN > 0 ? (
                <RecordToc
                  href={`/director/${slug}/reception`}
                  kicker="Reception"
                  title={`What critics said about ${director}'s films — press & scholarship`}
                  rows={[{ label: "Press & papers", value: receptionN }, { label: "Films covered", value: total }]}
                  cta="Open the reception"
                />
              ) : null}
              {readingCount > 0 ? (
                <RecordToc
                  href={`/director/${slug}/theory`}
                  kicker="Through theory"
                  title={`${director} through theory — the lenses the films answer to`}
                  rows={[{ label: "Readings", value: readingCount }, { label: "Recurring tropes", value: tropeCount }]}
                  cta="Open the lenses"
                />
              ) : null}
            </div>
          </section>
        )}

        {/* CONNECTION MAP */}
        <section className="dr-sec" id="dr-map">
          <h2 className="dr-h2">{director} — director map</h2>
          <p className="cmap-stat"><b>{total}</b> films · <b>{readingCount}</b> readings · <b>{tropeCount}</b> tropes</p>
          <p className="cmap-intro">Where {director} sits among filmmakers — who to watch next, the directors who point back here, and the directors nearest by Metatake&rsquo;s embedding of their films. Click a face to travel.</p>
          <EntityMap api={`/api/map?mode=directors&key=${slug}`} full={`/map?m=directors&k=${slug}`} />
        </section>

        {/* ATLAS — real-world places across the filmography */}
        {geoCount > 0 ? (
          <section className="dr-sec" id="dr-atlas">
            <h2 className="dr-h2">{director} — on the map</h2>
            <p className="cmap-intro">The real places {director}&rsquo;s films are set in and name, across the whole filmography. Click a pin to read the location.</p>
            <FilmMap endpoint={`/api/geo?director=${slug}`} height={480} />
            {hasLocationsPage ? (
              <div className="rec-tocs" style={{ maxWidth: 420, marginTop: 14 }}>
                <RecordToc
                  href={`/director/${slug}/locations`}
                  kicker="On location"
                  title={`Where does ${director} film? — every location, film by film`}
                  rows={[
                    { label: "Locations", value: geoMerged },
                    { label: "Films on the map", value: geoFilms },
                  ]}
                  cta="Open the map article"
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {/* FILMOGRAPHY */}
        <section className="dr-sec" id="dr-selection">
          <h2 className="dr-h2">The Metatake selection</h2>
          <p className="dr-gloss">
            The {total === 1 ? "one film" : `${total} films`} Metatake has read closely — our curation, not the full filmography (that&apos;s above). The count is the number of Strong Misreadings written for each.
          </p>
          <div className="dr-films-grid">
            {films.map((f) => {
              const film = f as { slug: string; title: string; year: number | null; backdrop_path?: string | null; poster_path?: string | null };
              const art = film.backdrop_path ? `${IMG}/w500${film.backdrop_path}` : film.poster_path ? `${IMG}/w342${film.poster_path}` : null;
              const count = perFilmReadings[f.id] ?? 0;
              return (
                <Link className="dr-fcard" href={`/film/${film.slug}`} key={film.slug}>
                  <div className="dr-bdwrap">
                    {art ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img className="dr-bd" src={art} alt={`${film.title} backdrop`} loading="lazy" />
                    ) : (<div className="dr-bd dr-bd--empty" aria-hidden="true" />)}
                    <PosterActions filmId={f.id as string} />
                  </div>
                  <div className="dr-cap">
                    <div className="dr-ti">{film.title}{" "}{film.year ? <span className="dr-yr">({film.year})</span> : null}</div>
                    <div className="dr-fmt"><b>{count}</b> reading{count === 1 ? "" : "s"}</div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="dr-prov">Director fingerprint computed from the live corpus — signatures recur across two or more films. The complete filmography, with TakeScores, is above.</div>
        </section>

        {/* WHERE TO START — a route through the filmography (sits below it) */}
        {picks.length > 0 && (
          <section className="dr-sec" id="dr-start">
            <h2 className="dr-h2">Where to Start</h2>
            <p className="dr-gloss">A way into {director}&apos;s filmography — where to begin, the peak, the deep cut. Curated, not ranked by box office.</p>
            <div className="dr-picks">
              {picks.map((p) => {
                const poster = p.film_slug ? posterBySlug.get(p.film_slug) : null;
                return (
                  <div className="dr-pick" key={p.pos}>
                    {p.film_slug && poster ? (
                      <Link href={`/film/${p.film_slug}`} className="dr-pick-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${IMG}/w92${poster}`} alt="" loading="lazy" />
                      </Link>
                    ) : <span className="dr-pick-thumb dr-pick-thumb--e" aria-hidden="true" />}
                    <div className="dr-pick-b">
                      {p.label ? <span className="dr-pick-label">{p.label}</span> : null}
                      <div className="dr-pick-film">
                        {p.film_slug ? <Link href={`/film/${p.film_slug}`}>{p.film_title}</Link> : <span>{p.film_title}</span>}
                        {p.film_year ? <span className="dr-yr"> ({p.film_year})</span> : null}
                      </div>
                      {p.reason ? <p className="dr-pick-why">{p.reason}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="rec-tocs" style={{ maxWidth: 420 }}>
              <RecordToc
                href={`/director/${slug}/start`}
                kicker="The route in"
                title={`Where to start with ${director} — the ${picks.length}-film route, argued`}
                rows={[
                  { label: "Route stops", value: picks.length },
                  { label: "Films read", value: total },
                  { label: "Readings", value: readingCount },
                ]}
                cta="Open the route"
              />
            </div>
          </section>
        )}

        {/* CREDITS — server-rendered repertory company (the SEO copy: who this
            director keeps bringing back, each name linking to their
            /credits/[person] read page), then the interactive map below it. */}
        <section className="dr-sec" id="dr-credits" style={{ marginTop: 44, borderTop: "2px solid #16233F", paddingTop: 6 }}>
          <h2 className="dr-h2" style={{ marginTop: 18 }}>Credits</h2>
          {crewMatch && crewHref ? (
            <p style={{ fontSize: 16.5, lineHeight: 1.6, maxWidth: "68ch", margin: "6px 0 14px" }}>
              {director} also signs the credits beyond directing — {crewMatch.n} catalog film{crewMatch.n === 1 ? "" : "s"} as {crewRoles}.{" "}
              <Link className="rcp-h" style={{ display: "inline" }} href={crewHref}>See the crew page →</Link>
            </p>
          ) : null}
          {repertory.length > 0 ? (
            <>
              <p style={{ fontSize: 16.5, lineHeight: 1.6, maxWidth: "68ch", margin: "6px 0 14px" }}>
                Across {films.length} films on Metatake, {director} keeps returning to{" "}
                {repertory.slice(0, 3).map((r, i) => (
                  <span key={r.id}>
                    {i > 0 ? (i === Math.min(repertory.length, 3) - 1 ? " and " : ", ") : ""}
                    <Link href={`/credits/${personSlug(r.name, r.id)}`}>{r.name}</Link>
                    {` (${CRAFTS[r.craft].role.toLowerCase()}, ${r.n} films)`}
                  </span>
                ))}
                {" — the repertory company behind the work."}
              </p>
              <div className="rcp-list" style={{ marginBottom: 20 }}>
                {repertory.slice(0, 10).map((r) => (
                  <div key={r.id} className="rcp-row">
                    <Link className="rcp-h" href={`/credits/${personSlug(r.name, r.id)}`}>{r.name}</Link>
                    <div className="rcp-m">{CRAFTS[r.craft].label} · {r.n} films together</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          <Suspense fallback={<div style={{ padding: "30px 0", opacity: 0.6 }}>Loading the map…</div>}>
            <CreditsExplorer embed initialD={director} />
          </Suspense>
        </section>
      </div>

      {/* Bottom plate band — doors to every director article that exists
          (life/start/next/locations/honors/reception/takescore/theory). */}
      <DirectorPlates slug={slug} />
    </div>
  );
}
