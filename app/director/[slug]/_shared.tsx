import { Suspense } from "react";
import { t, intlTag, locPath, LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { genreName } from "@/lib/i18n/genres";
import { loadFilmTitles, filmTitle } from "@/lib/i18n/filmTitles";
import EnglishOriginalLabel from "@/components/i18n/EnglishOriginalLabel";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import EntityStills from "@/components/EntityStills";
import { playlistExists } from "@/lib/tvExists";
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
import EntityNetwork from "@/components/EntityNetwork";
import EntityFantasia from "@/components/EntityFantasia";
import { loadFantasia } from "@/lib/fantasia";
import FilmMap from "@/components/FilmMap";
import Byline from "@/components/Byline";
import { fw } from "@/lib/frameworks";
import { axisLabel, nodeHref } from "@/lib/catalog";
import { DIRECTOR_LOCATIONS_MIN_FILMS, DIRECTOR_LOCATIONS_MIN_PINS, mergeCells, mergePins, pinCountries, countryListPhrase, type GeoPin } from "@/lib/locations";
import { pageRobots } from "@/lib/seo";
import { directorIndexBar } from "@/lib/directorGate";
import SaveButton from "@/components/SaveButton";
import ShareDock from "@/components/ShareDock";
import PosterActions from "@/components/PosterActions";
import LensDirectorCoverage from "@/components/LensDirectorCoverage";
import RecordToc from "@/components/read/RecordToc";
import DirectorPlates from "@/components/read/DirectorPlates";
import JoinCard from "@/components/conversion/JoinCard";
import TakeScoreBoxes from "@/components/read/TakeScoreBoxes";
import QuickAnswers, { type QuickAnswerItem } from "@/components/read/QuickAnswers";
import { cachedRankedScores } from "@/lib/takescore-bulk";
import "@/app/film/[slug]/read.css";
import "@/app/curious/curious.css";

const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}


type Pick = { pos: number; film_slug: string | null; film_title: string | null; film_year: number | null; label: string | null; reason: string | null };
type Fact = { n: number; text: string; source?: string | null };
type Next = { pos: number; rec_name: string; reason: string; target_slug: string | null; tmdb_person_id: number | null; profile_path: string | null };

async function loadUncached(slug: string) {
  const supabase = db();
  const { data: films, error: filmsErr } = await supabase
    .from("films").select("id, title, slug, year, director, backdrop_path, poster_path, tmdb_id").eq("director_slug", slug).eq("visible", true).order("year");
  // Throw on a DB error (never return null) so unstable_cache doesn't cache a
  // poison 404: during a Supabase outage the query returns {data:null,error},
  // which would otherwise look like "no such director" and get cached (the
  // null-poison-404 trap). notFound only for a genuinely-empty result.
  if (filmsErr) throw new Error(`director films(${slug}): ${filmsErr.message}`);
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

  // Now Playing count — pieces + wire entries under this director.
  const [nowPieceCnt, nowWireCnt] = await Promise.all([
    supabase.from("now_articles").select("id", { count: "exact", head: true }).eq("status", "published").or(`anchor_slug.eq.${slug},director_slug.eq.${slug}`),
    supabase.from("now_stream").select("id", { count: "exact", head: true }).eq("director_slug", slug),
  ]);
  const newsCount = (nowPieceCnt.count ?? 0) + (nowWireCnt.count ?? 0);

  const { data: geoRows } = await supabase.rpc("director_geo", { p_slug: slug });
  const geoCount = Array.isArray(geoRows) ? geoRows.length : 0;
  // geoCells/geoFilms gate the Locations tab/link (the read page's own 404
  // rule and the sitemap SQL count the same cells); geoMerged is the fused
  // display count.
  const geoCellsArr = Array.isArray(geoRows) ? mergeCells(geoRows as GeoPin[]) : [];
  const geoCells = geoCellsArr.length;
  const geoFilms = new Set(geoCellsArr.map((p) => p.film_slug)).size;
  const geoMergedArr = Array.isArray(geoRows) ? mergePins(geoRows as GeoPin[]) : [];
  const geoMerged = geoMergedArr.length;
  // D4 (2026-07-15) — text digest beside the client-only map, which otherwise
  // renders ZERO crawlable location text. The first 6 display-merged pins (the
  // gate rule's own fusion) + the country distribution. Adding these to the
  // payload CHANGES the cached shape → the loader key is bumped to load6.
  const geoTopPins = geoMergedArr.slice(0, 6).map((p) => ({
    name: p.name, film_slug: p.film_slug ?? null, film_title: p.film_title ?? null, country: p.country ?? null,
  }));
  const geoCountries = pinCountries(geoMergedArr).slice(0, 5);

  return {
    // perFilmReadings is a Map; the Data Cache can't serialize Maps, so return
    // a plain object. Consumers read it with bracket access.
    director, dir, films, sigTropes, perFilmReadings: Object.fromEntries(perFilmReadings), total: films.length, readingCount, tropeCount: tropeFilms.size,
    portrait: portrait as { body: string; source: string } | null,
    facts: facts as { name_meaning: string | null; intro: string | null; facts: Fact[] } | null,
    picks: (picks as Pick[] | null) ?? [],
    next: nextArr,
    recBy, misreadings, archGroups, geoCount, geoCells, geoMerged, geoFilms, geoTopPins, geoCountries,
    hiddenFilms, hiddenTotal, honorsN, receptionN, newsCount,
  };
}

// generateStaticParams returns [] (nothing prebuilt) and load() is a large
// multi-query fetch, so without caching every director view re-ran the whole
// set dynamically. Cache per slug in the Data Cache so the route is ISR-cached;
// tagged director:<slug> for on-demand refresh.
function load(slug: string) {
  // Cache key history: load5 = honorsN/receptionN joined the payload;
  // load6 (2026-07-15, D4) = geoTopPins/geoCountries joined the payload. The
  // Data Cache outlives deploys, so any shape change needs a new key or new
  // render code destructures stale-shaped cached payloads.
  return unstable_cache(() => loadUncached(slug), ["director-load6", slug], {
    revalidate: 300,
    tags: [`director:${slug}`],
  })();
}

// to.W (director scope) — the curation standing: how this director's films sit
// across the Metatake index (curation.film_comment via director_curation RPC).
// Null is a real state (no non-optional films → no card), so a cached null is
// fine here; only transport errors throw (and are thus never cached).
type DirectorCuration = {
  director: string;
  n_total: number;   // films of theirs we hold (any verdict)
  n_reco: number;    // essential + start_here + deep_cut (cinephile-worthy)
  n_essential: number;
  n_start: number;
  n_deep: number;
  reco_pct: number | null;
  mean_v: number | null;
  is_auteur: boolean;
  auteur_reason: string | null;
  rec_since: string | null;
  exemplars: { title: string; slug: string; year: number | null }[];
};

function loadCuration(slug: string): Promise<DirectorCuration | null> {
  return unstable_cache(
    async () => {
      const { data, error } = await db().rpc("director_curation", { p_slug: slug });
      if (error) throw new Error(`director_curation(${slug}): ${error.message}`);
      return (data as DirectorCuration | null) ?? null;
    },
    ["director-curation4", slug],
    { revalidate: 3600, tags: [`director:${slug}`] },
  )().catch(() => null);
}

// ── Director digests (2026-07-15, HANDOFF §4 D2/D3/D5) ─────────────────────
// Three filmography-wide records the hub HAS but never renders (press/scholarship,
// honours, streaming availability), assembled deterministically as DIGESTS — a
// subset in a different sentence shape than the subpage, each linking out. Kept
// in a SEPARATE per-slug cached loader (its own key) so the hot director-load6
// payload shape is untouched (no bump). LLM-0: pure composition from DB rows.
type PressFragment = { film_slug: string; film_title: string; outlet: string | null; year: number | null; headline: string };
type DirectorDigest = {
  press: PressFragment[];   // ≤1 headline'd fragment per film, tier-ordered
  filmsWithPress: number;   // distinct films with reception in the fetched set
  honors: { awards: number; canons: number; names: string[] } | null;
  streamingFilms: number;   // distinct films with a non-rent/buy provider row
};

function loadDirectorDigest(slug: string): Promise<DirectorDigest | null> {
  return unstable_cache(
    async (): Promise<DirectorDigest> => {
      const supabase = db();
      // Self-contained (mirrors the main load's film set) so the digest is a
      // clean per-slug cache unit — film_id → slug/title for the outbound links.
      const { data: films } = await supabase
        .from("films").select("id, slug, title").eq("director_slug", slug).eq("visible", true);
      const fmap = new Map<string, { slug: string; title: string }>(
        ((films ?? []) as { id: string; slug: string; title: string }[]).map((f) => [f.id, { slug: f.slug, title: f.title }]),
      );
      const filmIds = [...fmap.keys()];
      if (filmIds.length === 0) return { press: [], filmsWithPress: 0, honors: null, streamingFilms: 0 };

      const [rcpRes, wdRes, lnRes, provRes] = await Promise.all([
        // D2 — one director's reception sits comfortably under the 1,000-row cap
        // (honors page precedent); .in()+plain select, never an RPC loop (R-Q).
        supabase.from("film_reception")
          .select("film_id, outlet, headline, review_year, year, tier")
          .in("film_id", filmIds).order("tier").limit(30),
        supabase.from("film_wd_honors").select("film_id, kind, label").in("film_id", filmIds),
        supabase.from("film_lineage").select("film_id, list_id").in("film_id", filmIds),
        // D5 — streaming = any provider row that isn't a paid rent/buy.
        supabase.from("film_provider_index").select("film_id, kind").in("film_id", filmIds).not("kind", "in", "(rent,buy)"),
      ]);

      // D2 — the sharpest lines: ≤1 headline'd fragment per film, tier-best first.
      const filmsSeen = new Set<string>();
      const fragmented = new Set<string>();
      const press: PressFragment[] = [];
      for (const r of (rcpRes.data ?? []) as { film_id: string; outlet: string | null; headline: string | null; review_year: number | null; year: number | null }[]) {
        const meta = fmap.get(r.film_id);
        if (!meta) continue;
        filmsSeen.add(r.film_id);
        if (fragmented.has(r.film_id) || press.length >= 6) continue;
        const h = (r.headline ?? "").trim();
        if (!h) continue;
        fragmented.add(r.film_id);
        press.push({
          film_slug: meta.slug, film_title: meta.title, outlet: r.outlet ?? null,
          year: r.review_year ?? r.year ?? null,
          headline: h.length > 140 ? h.slice(0, 140).trimEnd() + "…" : h,
        });
      }

      // D3 — awards (Wikidata wins) + canons (non-auteur lineage lists), names only.
      const wd = (wdRes.data ?? []) as { film_id: string; kind: string | null; label: string | null }[];
      let awards = 0;
      const winLabels: string[] = [];
      for (const w of wd) if (w.kind === "award") { awards++; if (w.label) winLabels.push(w.label); }
      const listIds = [...new Set(((lnRes.data ?? []) as { list_id: string | null }[]).map((r) => r.list_id).filter((x): x is string => !!x))];
      let canons = 0;
      const canonNames: string[] = [];
      if (listIds.length) {
        const { data: lists } = await supabase.from("lineage_lists").select("id, label, facet").in("id", listIds);
        for (const l of (lists ?? []) as { label: string | null; facet: string | null }[]) {
          if ((l.facet ?? "") === "auteur") continue; // auteur lineage isn't a canon
          canons++;
          if (l.label) canonNames.push(l.label);
        }
      }
      const nameSet = new Set<string>();
      const names: string[] = [];
      for (const n of [...winLabels, ...canonNames]) {
        const k = n.trim();
        if (!k || nameSet.has(k.toLowerCase())) continue;
        nameSet.add(k.toLowerCase());
        names.push(k);
        if (names.length >= 3) break;
      }
      const honors = awards > 0 || canons > 0 ? { awards, canons, names } : null;

      // D5 — distinct films streaming somewhere (rent/buy already excluded above).
      const provFilms = new Set<string>();
      for (const p of (provRes.data ?? []) as { film_id: string }[]) provFilms.add(p.film_id);

      return { press, filmsWithPress: filmsSeen.size, honors, streamingFilms: provFilms.size };
    },
    ["director-press-digest-1", slug],
    { revalidate: 3600, tags: [`director:${slug}`] },
  )().catch(() => null);
}

// D3 — honours in one line: names + counts only (the counted table stays on the
// subpage). Adaptive so a wins-only or canons-only director never reads "0 …".
function honorsSentence(director: string, h: { awards: number; canons: number; names: string[] }): string {
  const clauses: string[] = [];
  if (h.awards > 0) clauses.push(`carry ${h.awards} award${h.awards === 1 ? "" : "s"}`);
  if (h.canons > 0) clauses.push(`sit in ${h.canons} canon${h.canons === 1 ? "" : "s"}`);
  const tail = h.names.length ? ` — ${andList(h.names.slice(0, 3))}` : "";
  return `${director}'s films ${clauses.join(" and ")}${tail}.`;
}

// Assemble the standing prose from the aggregates — deterministic, no LLM.
// Design (2026-07-12): lead with the ABSOLUTE count of cinephile-worthy films
// (essential+start_here+deep_cut) and the essential count — a director with many
// gems is major regardless of ratio. Then, only when it is FAVOURABLE, add the
// proportion of their whole filmography as praise ("most of their work rewards
// you"). A low ratio is never stated — we don't judge the person by the films
// that fell outside; silence over the rest. Cards render only when n_reco ≥ 1,
// so a filmmaker with no cinephile-worthy films gets no standing claim at all.
function curationStanding(c: DirectorCuration): { lead: string; ratio: string | null; auteur: string | null } {
  const one = c.n_reco === 1;
  const filmWord = one ? "film" : "films";
  const rewardVerb = one ? "rewards" : "reward";
  const essClause = c.n_essential > 0 ? `, ${c.n_essential} of them essential viewing` : "";
  const lead = `In the Metatake index, ${c.director} has ${c.n_reco} ${filmWord} that ${rewardVerb} a cinephile${essClause}.`;

  // Proportion of the whole filmography — surfaced only when it reflects well.
  const pct = c.reco_pct ?? 0;
  const v = c.mean_v ?? 0;
  let ratio: string | null = null;
  if (c.n_total >= 3) {
    if (pct >= 90 && v >= 75 && c.n_total >= 5)
      ratio = `That is very nearly their whole filmography here — the rare kind of body of work where almost no evening is a wasted one.`;
    else if (pct >= 90 && c.n_total >= 4)
      ratio = `That is nearly everything of theirs we hold; a remarkably consistent filmmaker.`;
    else if (pct >= 70)
      ratio = `That is most of what we hold of theirs — the work rewards you far more often than not.`;
    else if (pct >= 45)
      ratio = `A good part of their work here is worth seeking out.`;
    // pct < 45: no proportion sentence — the count above stands on its own.
  }

  const auteur = c.is_auteur
    ? `${c.director}'s filmography is tracked as an auteur lineage: even the lesser-known titles earn their place through the body of work.`
    : null;
  return { lead, ratio, auteur };
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

export async function directorMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const native = await directorNative(data.director);
  // The director's name is a proper noun — kept as-is; only the chrome tail is
  // projected.
  const title = `${data.director}${native ? ` (${native})` : ""} — ${t(locale, "Films, Style & Where to Start")}`;
  // TMDB bio is never used as our description — our portrait when it exists,
  // otherwise the deterministic editorial summary (unique text, real numbers).
  // Both are English DB prose (§1.1); outside the source language we only have an
  // English description to offer, which is why the ko hub is not indexed (below).
  const description = data.portrait?.body
    ? metaDescription(data.portrait.body)
    : metaDescription(editorialSummary(data));
  // A director hub localizes its chrome, but its substance — bios, film titles —
  // stays English, so a ko hub is mostly English under a Korean shell: exactly
  // the mixed-language page §6.5 says Google folds into the English original. So
  // v1 renders it (reachable via switcher/banner) but never indexes it and never
  // advertises it as an EN alternate. Revisit if director bios get a ko layer.
  const indexable = locale === DEFAULT_LOCALE && directorIndexBar(data);
  return {
    title,
    description,
    // D6 (2026-07-15) — hub robots gate: index only hubs with their own
    // substance (≥2 films, or an editorial layer, or the press/honours record
    // D2/D3 now render). Every input is already in the cached payload — zero
    // new queries. pageRobots defaults to noindex,follow below the bar; the
    // sitemap's directorEntries mirrors the SAME predicate so they can't drift.
    robots: pageRobots(indexable),
    openGraph: { title, description, locale: LOCALES[locale].ogLocale },
    twitter: { card: "summary_large_image", title, description },
    // canonical is always self; no cross-locale alternates while ko is noindex
    // (a hreflang pointing at a noindex page is a broken pair — work order §6.1).
    alternates: { canonical: locPath(locale, `/director/${slug}`) },
  };
}

const SIG_LIMIT = 12;

function andList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// ── Quick answers (docs/PLAN-intent-coverage.md §0 charter + §5.6) ─────────
// Deterministic Q&A for the director hub, assembled ONLY from fields already
// in the page's render scope: a question is emitted only when its answer row is
// present, and every film title, count, date and name is verbatim from the row
// (§0-1/§0-2). Search-term variants ("films"/"direct"/"directed"/"filmography")
// are woven across the block, max two uses each — "films" carries Q1+A1,
// "direct" Q1, "directed" A1, "filmography" A5 (§0-6). The GAP list (per-film
// synopsis / box office / "best film") is intentionally not emitted: the hub
// is not a ranked surface (that's /takescore).
function directorQuickAnswers(a: {
  slug: string;
  director: string;
  total: number;
  filmoTotal: number;
  hiddenTotal: number;
  films: { title: string; year: number | null }[];
  bornLabel: string | null;
  placeOfBirth: string | null;
  picks: Pick[];
  next: Next[];
  sigTropes: { title: string }[];
}): QuickAnswerItem[] {
  const items: QuickAnswerItem[] = [];
  // 1 — the head "[director] films" query: verbatim titles, honest counts
  // (filmoTotal = closely-read + catalog; total = the closely-read subset).
  if (a.films.length > 0) {
    const sample = a.films.slice(0, 3).map((f) => `${f.title}${f.year ? ` (${f.year})` : ""}`);
    const body = a.hiddenTotal > 0
      ? `${a.director} directed ${a.filmoTotal} films on Metatake — ${a.total} read closely, including ${andList(sample)}.`
      : `${a.director} directed ${a.total} films, all read closely on Metatake, including ${andList(sample)}.`;
    items.push({ q: `What films did ${a.director} direct?`, a: body });
  }
  // 2 — birthdate, verbatim (+ place of birth when on file).
  if (a.bornLabel) {
    items.push({
      q: `When was ${a.director} born?`,
      a: `${a.director} was born ${a.bornLabel}${a.placeOfBirth ? ` in ${a.placeOfBirth}` : ""}.`,
    });
  }
  // 3 — "where to start": the Start-here pick (or the first stop), deep-linked
  // to the full route article.
  if (a.picks.length > 0) {
    const start = a.picks.find((p) => (p.label ?? "").trim().toLowerCase() === "start here") ?? a.picks[0];
    const title = start.film_title ?? "";
    if (title) {
      const yr = start.film_year ? ` (${start.film_year})` : "";
      const label = (start.label ?? "").trim();
      items.push({
        q: `Where should I start with ${a.director}?`,
        a: `${title}${yr}${label ? ` — ${label}` : ""}.`,
        href: `/director/${a.slug}/start`,
      });
    }
  }
  // 4 — "directors like X": the curated Who's Next names, deep-linked.
  if (a.next.length > 0) {
    const names = andList(a.next.slice(0, 3).map((n) => n.rec_name));
    items.push({
      q: `Which directors are like ${a.director}?`,
      a: `Try ${names} — each chosen for a specific kinship with ${a.director}.`,
      href: `/director/${a.slug}/next`,
    });
  }
  // 5 — "themes that recur": signature figure-types across the filmography,
  // titles verbatim.
  if (a.sigTropes.length > 0) {
    const themes = andList(a.sigTropes.slice(0, 3).map((t) => t.title));
    items.push({
      q: `What themes recur in ${a.director}'s work?`,
      a: `${a.director} returns to ${themes} across the filmography.`,
    });
  }
  return items.slice(0, 5);
}

export async function DirectorPage({ slug, locale }: { slug: string; locale: Locale }) {
  const data = await load(slug);
  if (!data) {
    // Renamed/merged director slugs live in the slug_aliases ledger — honor
    // them as permanent redirects before 404ing (same pattern as /film, /take).
    const alias = await resolveAlias(`/director/${slug}`);
    if (alias) permanentRedirect(alias);
    notFound();
  }
  const { director, dir, films, sigTropes, perFilmReadings, total, readingCount, tropeCount, portrait, facts, picks, next, recBy, misreadings, archGroups, geoCount, geoCells, geoMerged, geoFilms, geoTopPins = [], geoCountries = [], hiddenFilms = [], hiddenTotal = 0, honorsN = 0, receptionN = 0, newsCount = 0 } = data;
  // Localized titles for every film referenced on this page (filmography, picks,
  // hero cards) — all are this director's own films, so one batch over films +
  // hiddenFilms covers them all. Empty map on the source locale (SEO safe).
  const drFilmTitles = await loadFilmTitles(locale, [
    ...(films as { slug: string }[]).map((f) => f.slug),
    ...(hiddenFilms as { slug: string }[]).map((f) => f.slug),
  ].filter(Boolean));
  const native = await directorNative(director);
  // to.W — the curation standing across the index (fail-soft: an RPC hiccup
  // just hides the card; null is the honest "no non-optional films" state).
  const curation = await loadCuration(slug);
  const standing = curation ? curationStanding(curation) : null;
  // Embedding Fantasia rows — sentences anchored on this director's films.
  // Fail soft: an RPC hiccup hides the module for this render (never 500s, and
  // the loader's throw keeps unstable_cache from caching the empty state).
  const fantasia = await loadFantasia("director", slug, null, `director:${slug}`).catch(() => []);
  // D2/D3/D5 digests — press/scholarship, honours and streaming, assembled from
  // this director's films (own cached loader; fail-soft null just hides them).
  const digest = await loadDirectorDigest(slug);
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

  // Dynamic tabs — the film-page menu grammar (2026-07-09): two zoned rails,
  // per-section colors, live counts as tinted badges. Top rail = the overview
  // (spoiler-free: who he is, the work, the records, the maps); bottom rail =
  // the close readings that turn on specific scenes and can spoil his films.
  // Order within each zone runs intro → work → guides → record (top), and
  // flagship reading → deeper analysis (bottom).
  const nArch = archGroups.reduce((s, g) => s + g.items.length, 0);
  const filmoTotal = total + hiddenTotal;
  type DTab = { id: string; label: string; href?: string; badge?: number; color?: string; zone?: "free" | "spoiler" };
  const hasLocationsPage = geoFilms >= DIRECTOR_LOCATIONS_MIN_FILMS && geoCells >= DIRECTOR_LOCATIONS_MIN_PINS;
  const hasTvPlaylist = await playlistExists(`director-${slug}`);
  const tabs: DTab[] = [
    // ── The overview (spoiler-free) ──
    { id: "dr-portrait", label: "Portrait", color: "#5A6B86", zone: "free" },
    { id: "dr-filmography", label: "Filmography", badge: filmoTotal, color: "#2E7D9E", zone: "free" },
    { id: "dr-selection", label: "The selection", badge: total, color: "#0F6E56", zone: "free" },
  ];
  if (picks.length) tabs.push({ id: "dr-start", label: "Where to Start", badge: picks.length, color: "#C87A2C", zone: "free" });
  if (next.length) tabs.push({ id: "dr-next", label: "Who's Next", badge: next.length, color: "#B85C9E", zone: "free" });
  if (facts && Array.isArray(facts.facts) && facts.facts.length) tabs.push({ id: "dr-life", label: "The Life", badge: facts.facts.length, color: "#B8863B", zone: "free" });
  if (honorsN + receptionN > 0 || total >= 3 || readingCount > 0) tabs.push({ id: "dr-records", label: "The records", badge: honorsN + receptionN, color: "#8A6D3B", zone: "free" });
  if (newsCount > 0) tabs.push({ id: "dr-in-the-news", label: "In the news", badge: newsCount, color: "#E3120B", zone: "free" });
  tabs.push({ id: "dr-network", label: "Connections", color: "#2F6DB0", zone: "free" });
  if (fantasia.length >= 2) tabs.push({ id: "dr-fantasia", label: "Embedding Fantasia", badge: fantasia.length, color: "#E0922A", zone: "free" });
  // One "Locations" tab: the in-page map (the read article is linked from
  // inside this section via the RecordToc CTA below — same pattern as the film
  // page — so a separate "Locations" link-tab would just duplicate it).
  if (geoCount > 0) tabs.push({ id: "dr-atlas", label: "Locations", badge: geoMerged, color: "#2E8B6E", zone: "free" });
  tabs.push({ id: "dr-credits", label: "Credits", color: "#6B7280", zone: "free" });
  // ── Close readings (may spoil individual films) ──
  if (hasTvPlaylist) tabs.push({ id: "dr-tv", label: "▶ TV Broadcast", href: `/tv/list/director-${slug}`, color: "#C8102E", zone: "spoiler" });
  if (misreadings.length) tabs.push({ id: "dr-misreadings", label: "Strong Misreadings", badge: readingCount, color: "#D64534", zone: "spoiler" });
  if (sigTropes.length) tabs.push({ id: "dr-tropes", label: "Tropes", badge: tropeCount, color: "#12897A", zone: "spoiler" });
  if (archGroups.length) tabs.push({ id: "dr-archetype", label: "Archetype", badge: nArch, color: "#6B4E9E", zone: "spoiler" });

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(filmographyLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div className="dr-wrap">
        <div className="dr-crumb"><Link href="/director">{t(locale, "Directors")}</Link></div>

        <EntityTVHero playlist={`director-${slug}`} reelSlugs={films.map((f) => f.slug)} label={director}
          listHref={`/tv/list/director-${slug}`} backdrop={films.find((f) => f.backdrop_path)?.backdrop_path ?? null} />

        {/* HEADER */}
        <div className="dr-head">
          {d?.profile_path ? (
            <div className="dr-photo">
              <LightboxImage src={`${IMG}/w185${d.profile_path}`} fullUrl={`${IMG}/w342${d.profile_path}`} alt={director} caption={director} width={185} height={278} />
            </div>
          ) : (<div className="dr-photo dr-photo--empty" aria-hidden="true" />)}
          <div className="dr-txt">
            <div className="dr-role">{t(locale, "Director")}</div>
            <h1 className="dr-h1">
              {director}
              {native ? <span style={{ fontWeight: 400, opacity: 0.72, fontSize: "0.72em" }}> ({native})</span> : null}
            </h1>
            <Byline locale={locale} methodologyHref="/methodology/where-to-start" badge />
            {(bornLabel || d?.place_of_birth) && (
              <div className="dr-born">
                {bornLabel && <span>{t(locale, "Born {date}", { date: bornLabel })}</span>}
                {bornLabel && d?.place_of_birth && <span className="dr-dot" />}
                {d?.place_of_birth && <span>{d.place_of_birth}</span>}
              </div>
            )}
            <div className="dr-save"><SaveButton entityType="director" entityRef={slug} label={t(locale, "Add to favorites")} labelOn={t(locale, "Favorite")} variant="heart" /></div>
            <div className="dr-share">
              <ShareDock variant="bar" noSave path={`/director/${slug}`} title={director}
                hook={`${director} on Metatake — ${total} film${total === 1 ? "" : "s"}, traced through their signature tropes and readings`} />
              <ShareDock variant="fab" path={`/director/${slug}`} title={director} />
            </div>
          </div>
        </div>

        {/* STAT STRIP */}
        <div className="dr-stats">
          <a className="dr-stat" href="#dr-filmography"><div className="dr-n">{total}</div><div className="dr-k">{t(locale, "Films")}</div></a>
          <a className="dr-stat" href="#dr-misreadings"><div className="dr-n">{readingCount}</div><div className="dr-k">{t(locale, "Readings")}</div></a>
          <a className="dr-stat dr-teal" href="#dr-tropes"><div className="dr-n">{tropeCount}</div><div className="dr-k">{t(locale, "Tropes")}</div></a>
        </div>

        {/* to.W — the desk on this director's standing in the index.
            Deterministic prose from curation.film_comment; hidden when the
            director holds no non-optional films. Sent from the desk, not a
            person, for the reason set out in components/read/TowCard.tsx (D2). */}
        {standing && curation ? (
          <section className="dr-tow" aria-labelledby="dr-tow-h">
            <div className="dr-tow-head">
              <div>
                <div className="dr-tow-kicker">to. WY. Heo · the index</div>
                <h2 className="dr-tow-h" id="dr-tow-h">{director} in the Metatake index</h2>
              </div>
            </div>
            <p className="dr-tow-lead">
              {standing.lead}{standing.ratio ? ` ${standing.ratio}` : ""}{standing.auteur ? ` ${standing.auteur}` : ""}
            </p>
            <p className="dr-tow-metric">
              <b>{curation.n_reco}</b> of the <b>{curation.n_total}</b> {curation.n_total === 1 ? "film" : "films"} we hold reward a cinephile
              {curation.reco_pct != null ? <> · <b>{curation.reco_pct}%</b></> : null}
            </p>
            {curation.rec_since ? (
              <p className="dr-tow-recd">In the Metatake index since {curation.rec_since}</p>
            ) : null}
            <div className="dr-tow-signrow">
              <div>
                <div className="dr-tow-sign">from. Metatake AI Editorial</div>
                <div className="dr-tow-recd">{t(locale, "to a framework by W. Yoon")}</div>
              </div>
              <Link href="/editor" className="dr-tow-ava" title={t(locale, "Wonwoo Yoon — Metatake editor")} aria-label={t(locale, "Wonwoo Yoon, Metatake editor — view profile")}>w</Link>
            </div>
            <div className="dr-tow-tags">
              {curation.n_essential > 0 ? <span className="dr-tow-tag dr-tow-tag--essential">{curation.n_essential} essential</span> : null}
              {curation.n_start > 0 ? <span className="dr-tow-tag dr-tow-tag--start">{curation.n_start} start here</span> : null}
              {curation.n_deep > 0 ? <span className="dr-tow-tag dr-tow-tag--deep">{curation.n_deep} deep {curation.n_deep === 1 ? "cut" : "cuts"}</span> : null}
            </div>
            {curation.exemplars.length > 0 ? (
              <p className="dr-tow-eg">
                <span className="dr-tow-eg-k">{t(locale, "The picks:")}</span>{" "}
                {curation.exemplars.map((e, i) => (
                  <span key={e.slug}>
                    {i > 0 ? " · " : ""}
                    <Link href={`/film/${e.slug}`}>{filmTitle(drFilmTitles, locale, e.slug, e.title)}</Link>
                  </span>
                ))}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      <div className="dr-wrap">
        <QuickAnswers locale={locale}
          items={directorQuickAnswers({
            slug, director, total, filmoTotal, hiddenTotal,
            films: films as { title: string; year: number | null }[],
            bornLabel, placeOfBirth: d?.place_of_birth ?? null,
            picks, next, sigTropes,
          })}
        />

        <FilmTabBar tabs={tabs} twoRow zoneLabels={{ free: { title: "The overview", sub: "spoiler-free" }, spoiler: { title: "Close readings", sub: "may spoil his films" } }} />

        {/* PORTRAIT — our portrait when written; otherwise our numbers as
            prose. TMDB's bio is never shown (third-party duplicate text). */}
        <section className="dr-sec" id="dr-portrait">
          <h2 className="dr-h2">{portraitText ? <>{director} {t(locale, "— a Metatake Portrait")}</> : <>{director} {t(locale, "on Metatake")}</>} {portraitText ? <EnglishOriginalLabel locale={locale} /> : null}</h2>
          <div className={`dr-portrait-row${hasArt ? "" : " dr-portrait-row--solo"}`}>
            <div className="dr-portrait-main">
              {portraitText ? (
                <div className="dr-portrait-body" lang={locale === DEFAULT_LOCALE ? undefined : "en"}>
                  {portraitText.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
                  <Byline locale={locale} />
                </div>
              ) : (
                <div className="dr-portrait-body">
                  <p lang={locale === DEFAULT_LOCALE ? undefined : "en"}>{summaryText}</p>
                  <div className="dr-src">{t(locale, "A Metatake editorial summary, computed from the live corpus — the full portrait is being written.")}</div>
                </div>
              )}
            </div>
            {hasArt && (
              <div className="dr-portrait-art" aria-hidden="true">
                {wideArt.length > 0 && (
                  <div className="dr-pa-wide">
                    {wideArt.map((f) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={f.slug} className="dr-pa-w" src={`${IMG}/w300${f.backdrop_path}`} alt="" loading="lazy" title={`${filmTitle(drFilmTitles, locale, f.slug, f.title) ?? f.title}${f.year ? ` (${f.year})` : ""}`} />
                    ))}
                  </div>
                )}
                {tallArt.length > 0 && (
                  <div className="dr-pa-tall">
                    {tallArt.map((f) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={f.slug} className="dr-pa-t" src={`${IMG}/w185${f.poster_path}`} alt="" loading="lazy" title={`${filmTitle(drFilmTitles, locale, f.slug, f.title) ?? f.title}${f.year ? ` (${f.year})` : ""}`} />
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
          // D1 (2026-07-15) — the shared bulk ranking (cachedRankedScores, no
          // visible filter) is already loaded above and was thrown away for the
          // catalog rows, hard-coding score:null → "not yet scored" while the
          // very same film's /film page shows its TakeScore. Reuse it; the ~21
          // genuinely unscored catalog films keep the per-row "not yet scored"
          // fallback. TakeScore is a canonical fact — not a cross-page dupe (R-D).
          const catFilms = (hiddenFilms as { slug: string; title: string; year: number | null; poster_path: string | null }[])
            .map((f) => {
              const b = bulkScores[f.slug];
              const score: Score | null = b ? { u: b.u, v: b.v, c: b.c, r: b.r, tier: null } : null;
              return { slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path, readings: 0, score };
            });
          const allFilms = [...readFilms, ...catFilms].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));
          const scoredN = allFilms.filter((f) => f.score).length;
          return (
            <section className="dr-sec" id="dr-filmography">
              <h2 className="dr-h2">{t(locale, "Filmography")}</h2>
              <p className="dr-gloss">
                {locale === DEFAULT_LOCALE ? (
                  <>
                    Every {director} film on Metatake, oldest first — {total} read closely{hiddenTotal > 0 ? ` and ${hiddenTotal} more in the catalog` : ""}.
                    {scoredN > 0 ? <> {scoredN} carr{scoredN === 1 ? "ies" : "y"} a <Link href={`/director/${slug}/takescore`}>TakeScore</Link> — the boxed numbers are Value, Cost and Risk behind the headline score.</> : null}
                    {digest && digest.streamingFilms > 0 ? <> {digest.streamingFilms} of them {digest.streamingFilms === 1 ? "is" : "are"} streaming somewhere right now — each film&apos;s page lists where.</> : null}
                  </>
                ) : (
                  <>
                    {t(locale, "Every {director} film on Metatake, oldest first — {n} read closely{more}.", { director, n: total, more: hiddenTotal > 0 ? t(locale, ", plus {n} more in the catalog", { n: hiddenTotal }) : "" })}
                    {scoredN > 0 ? <> {t(locale, "{n} carry a", { n: scoredN })} <Link href={`/director/${slug}/takescore`}>TakeScore</Link> {t(locale, "— the boxed numbers are Value, Cost and Risk behind the headline score.")}</> : null}
                    {digest && digest.streamingFilms > 0 ? <> {t(locale, "{n} are streaming somewhere right now — each film's page lists where.", { n: digest.streamingFilms })}</> : null}
                  </>
                )}
              </p>
              <LensDirectorCoverage slugs={(films as { slug: string }[]).map((f) => f.slug)} />
              <div className="dr-filmo">
                {allFilms.map((f) => (
                  <Link key={f.slug} href={`/film/${f.slug}`} className="dr-flm">
                    <span className="dr-flm__yr">{f.year ?? "—"}</span>
                    {f.poster_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="dr-flm__po" src={`${IMG}/w92${f.poster_path}`} alt={`${filmTitle(drFilmTitles, locale, f.slug, f.title) ?? f.title}${f.year ? ` (${f.year})` : ""} poster`} width={34} height={51} loading="lazy" />
                    ) : <span className="dr-flm__po dr-flm__po--e" aria-hidden="true" />}
                    <span className="dr-flm__mid">
                      <span className="dr-flm__ti">{filmTitle(drFilmTitles, locale, f.slug, f.title)}</span>
                      <span className="dr-flm__sub">{f.readings > 0 ? (locale === DEFAULT_LOCALE ? `${f.readings} Strong Misreading${f.readings === 1 ? "" : "s"}` : t(locale, "Strong Misreadings {n}", { n: f.readings })) : t(locale, "In the catalog")}</span>
                    </span>
                    {f.score ? (
                      <span className="dr-flm__sc"><TakeScoreBoxes s={f.score} /></span>
                    ) : <span className="dr-flm__unscored">{t(locale, "not yet scored")}</span>}
                  </Link>
                ))}
              </div>
              <div className="dr-prov">{t(locale, "Filmography & images via TMDB; readings & TakeScores computed from the Metatake corpus.")}</div>
            </section>
          );
        })()}

        {/* IN THE NEWS — the Now Playing hourly desk's record for this director */}
        <EntityNews directorSlug={slug} variant="dr" />

        {/* STRONG MISREADINGS — a representative set; the full set lives on its own page */}
        {misreadings.length > 0 && (
          <section className="dr-sec" id="dr-misreadings">
            <h2 className="dr-h2">Strong Misreadings</h2>
            <p className="dr-gloss">{t(locale, "{n} bold readings across {director}'s films — here are the strongest, at most two per film.", { n: readingCount, director })} {readingCount > misreadings.length ? <>{t(locale, "The complete set is")} <Link href={`/director/${slug}/misreadings`}>{t(locale, "on its own page")}</Link>.</> : t(locale, "Open a film for its full set.")}</p>
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
            {readingCount > misreadings.length ? (
              <div className="rec-tocs" style={{ maxWidth: 420 }}>
                <RecordToc
                  href={`/director/${slug}/misreadings`}
                  kicker="Every reading"
                  title={`Every Strong Misreading of ${director}'s films — the complete set`}
                  rows={[
                    { label: "Readings", value: readingCount },
                    { label: "Films", value: new Set(misreadings.map((m) => m.film_slug)).size || total },
                  ]}
                  cta={t(locale, "Open all readings")}
                />
              </div>
            ) : null}
          </section>
        )}

        {/* TROPES — signature figure-types, just the items */}
        {sigTropes.length > 0 && (
          <section className="dr-sec dr-sec--teal" id="dr-tropes">
            <h2 className="dr-h2">{t(locale, "Tropes")}</h2>
            <p className="dr-gloss">{t(locale, "Figure-types {director} returns to — computed across the filmography.", { director })} <Link className="dr-teal-link" href="/tropes">{t(locale, "All tropes →")}</Link></p>
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
            <p className="dr-gloss">The person behind the films — {facts.facts.length} researched moments, each fact sourced; researched by Metatake AI, designed by <Link href="/editor">Wonwoo Yoon</Link>.</p>
            {facts.name_meaning ? (
              <div className="dr-namemean"><span className="dr-nm-k">{t(locale, "The name")}</span><p>{facts.name_meaning}</p></div>
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
                cta={t(locale, "Open the life")}
              />
            </div>
            <div className="dr-src">{t(locale, "Each fact is written freely, then verified against a live web source (English & native-language). Source link per fact.")}</div>
          </section>
        )}

        {/* WHO'S NEXT */}
        {next.length > 0 && (
          <section className="dr-sec" id="dr-next">
            <h2 className="dr-h2">{t(locale, "Who's Next")}</h2>
            <p className="dr-gloss">Five directors to explore after {director} — each chosen for a specific kinship. Argued by Metatake AI — a reason for each pick, not a distance score.</p>
            <div className="dr-next-grid">
              {next.map((n) => (
                <div className="dr-next-card" key={n.pos}>
                  {n.profile_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="dr-next-photo" src={`${IMG}/w185${n.profile_path}`} alt={`${n.rec_name} portrait`} loading="lazy" />
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
                <span className="dr-recby-k">{t(locale, "Pointed to from:")}</span>{" "}
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
                cta={t(locale, "Open the kinships")}
              />
            </div>
          </section>
        )}

        {/* THE RECORDS — doors to the filmography-wide aggregation articles
            (film-page grammar: counted print-TOC doors, no banners). */}
        {(honorsN + receptionN > 0 || total >= 3 || readingCount > 0) && (
          <section className="dr-sec" id="dr-records">
            <h2 className="dr-h2">{t(locale, "The records — across the filmography")}</h2>
            <p className="dr-gloss">The film-level records ({director}&apos;s scores, honors, press and theory readings) gathered into filmography-wide articles — counted below, argued in full behind each door.</p>
            {/* D3 (2026-07-15) — honours in one line: names + counts only, the
                counted table lives behind the honours door below. */}
            {digest?.honors ? (
              <p className="dr-gloss" style={{ marginTop: -2 }}>{honorsSentence(director, digest.honors)}</p>
            ) : null}
            {/* D2 (2026-07-15) — the press, in brief: one fragment per film (the
                grouped per-film record stays on /reception). Cohort reception is
                100% academic → "press and scholarship" (R-C). */}
            {receptionN >= 3 && digest?.press && digest.press.length > 0 ? (
              <div style={{ margin: "2px 0 14px" }}>
                <p className="dr-gloss">Across {digest.filmsWithPress} film{digest.filmsWithPress === 1 ? "" : "s"}, {receptionN} piece{receptionN === 1 ? "" : "s"} of press and scholarship on the record — the sharpest lines:</p>
                <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "grid", gap: 7 }}>
                  {digest.press.slice(0, 4).map((p, i) => (
                    <li key={i} style={{ fontSize: 15, lineHeight: 1.5 }}>
                      <Link href={`/film/${p.film_slug}/reception`}>
                        {p.outlet ? <b>{p.outlet}</b> : null}{p.outlet && p.year ? " · " : ""}{p.year ?? ""}{p.outlet || p.year ? " — " : ""}{p.headline}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="rec-tocs">
              {total >= 3 ? (
                <RecordToc
                  href={`/director/${slug}/takescore`}
                  kicker="TakeScore™"
                  title={`Every ${director} film, scored — the ranking`}
                  rows={[{ label: "Films scored", value: total }, { label: "Readings behind them", value: readingCount }]}
                  cta={t(locale, "Open the ranking")}
                />
              ) : null}
              {honorsN > 0 ? (
                <RecordToc
                  href={`/director/${slug}/honors`}
                  kicker="The honors record"
                  title={`Every award ${director}'s films have won — counted and sourced`}
                  rows={[{ label: "Honors on the record", value: honorsN }, { label: "Films", value: total }]}
                  cta={t(locale, "Open the record")}
                />
              ) : null}
              {receptionN > 0 ? (
                <RecordToc
                  href={`/director/${slug}/reception`}
                  kicker="Reception"
                  title={`What critics said about ${director}'s films — press & scholarship`}
                  rows={[{ label: "Press & papers", value: receptionN }, { label: "Films covered", value: total }]}
                  cta={t(locale, "Open the reception")}
                />
              ) : null}
              {readingCount > 0 ? (
                <RecordToc
                  href={`/director/${slug}/theory`}
                  kicker="Through theory"
                  title={`${director} through theory — the lenses the films answer to`}
                  rows={[{ label: "Readings", value: readingCount }, { label: "Recurring tropes", value: tropeCount }]}
                  cta={t(locale, "Open the lenses")}
                />
              ) : null}
            </div>
          </section>
        )}

        {/* STILLS — a few frames from the director's films (images only, shared
            lightbox; captions credit TMDB + note they're illustrative). */}
        <section className="dr-sec">
          <EntityStills slugs={films.map((f) => f.slug)} topic={director} heading={`Stills from ${director}'s films`} cap={4} />
        </section>

        {/* CONNECTION MAP */}
        <section className="dr-sec" id="dr-network">
          <h2 className="dr-h2">{director} — director map</h2>
          <p className="cmap-stat"><b>{total}</b> films · <b>{readingCount}</b> readings · <b>{tropeCount}</b> tropes</p>
          <p className="cmap-intro">Where {director} sits among filmmakers — who to watch next, the directors who point back here, and the directors nearest by Metatake&rsquo;s embedding of their films. Click a face to travel.</p>
          <EntityNetwork api={`/api/map?mode=directors&key=${slug}`} full={`/network?m=directors&k=${slug}`} />
        </section>

        {/* EMBEDDING FANTASIA — rule-based sentences across this director's films */}
        <EntityFantasia title={director} rows={fantasia} sectionId="dr-fantasia" sectionClass="dr-sec" selfHref={`/director/${slug}`} />

        {/* ATLAS — real-world places across the filmography */}
        {geoCount > 0 ? (
          <section className="dr-sec" id="dr-atlas">
            <h2 className="dr-h2">{director} — on the map</h2>
            <p className="cmap-intro">The real places {director}&rsquo;s films are set in and name, across the whole filmography. Click a pin to read the location.</p>
            <FilmMap endpoint={`/api/geo?director=${slug}`} height={480} />
            {/* D4 (2026-07-15) — crawlable list-form digest beside the client-only
                map (a different sentence shape than the /locations subpage's
                aggregate lead): named places, film-anchored, each linking to its
                film. mergePins is the sole merge rule (sitemap/SQL parity). */}
            {geoTopPins.length > 0 ? (
              <p className="dr-gloss" style={{ marginTop: 12 }}>
                <b>{t(locale, "Shot and set in:")}</b>{" "}
                {geoTopPins.map((p, i) => (
                  <span key={i}>
                    {i > 0 ? " · " : ""}
                    {p.film_slug ? <Link href={`/film/${p.film_slug}`}>{p.name}</Link> : <span>{p.name}</span>}
                    {p.film_title ? <span style={{ opacity: 0.6 }}> ({p.film_title})</span> : null}
                  </span>
                ))}
                {geoMerged > geoTopPins.length ? <> — and {geoMerged - geoTopPins.length} more location{geoMerged - geoTopPins.length === 1 ? "" : "s"} across the filmography.</> : "."}
                {geoCountries.length > 1 ? <> Mapped across {countryListPhrase(geoCountries.slice(0, 3).map((c) => c.name), Math.max(0, geoCountries.length - 3))}.</> : null}
              </p>
            ) : null}
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
                  cta={t(locale, "Open the locations article")}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {/* FILMOGRAPHY */}
        <section className="dr-sec" id="dr-selection">
          <h2 className="dr-h2">{t(locale, "The Metatake selection")}</h2>
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
                      <img className="dr-bd" src={art} alt={`${filmTitle(drFilmTitles, locale, film.slug, film.title) ?? film.title} backdrop`} loading="lazy" />
                    ) : (<div className="dr-bd dr-bd--empty" aria-hidden="true" />)}
                    <PosterActions filmId={f.id as string} />
                  </div>
                  <div className="dr-cap">
                    <div className="dr-ti">{filmTitle(drFilmTitles, locale, film.slug, film.title)}{" "}{film.year ? <span className="dr-yr">({film.year})</span> : null}</div>
                    <div className="dr-fmt"><b>{count}</b> reading{count === 1 ? "" : "s"}</div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="dr-prov">{t(locale, "Director fingerprint computed from the live corpus — signatures recur across two or more films. The complete filmography, with TakeScores, is above.")}</div>
        </section>

        {/* WHERE TO START — a route through the filmography (sits below it) */}
        {picks.length > 0 && (
          <section className="dr-sec" id="dr-start">
            <h2 className="dr-h2">{t(locale, "Where to Start")}</h2>
            <p className="dr-gloss">A way into {director}&apos;s filmography — where to begin, the peak, the deep cut. Curated, not ranked by box office.</p>
            <div className="dr-picks">
              {picks.map((p) => {
                const poster = p.film_slug ? posterBySlug.get(p.film_slug) : null;
                return (
                  <div className="dr-pick" key={p.pos}>
                    {p.film_slug && poster ? (
                      <Link href={`/film/${p.film_slug}`} className="dr-pick-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${IMG}/w92${poster}`} alt={`${p.film_title}${p.film_year ? ` (${p.film_year})` : ""} poster`} loading="lazy" />
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
                cta={t(locale, "Open the route")}
              />
            </div>
          </section>
        )}

        {/* CREDITS — server-rendered repertory company (the SEO copy: who this
            director keeps bringing back, each name linking to their
            /credits/[person] read page), then the interactive map below it. */}
        <section className="dr-sec" id="dr-credits" style={{ marginTop: 44, borderTop: "2px solid #16233F", paddingTop: 6 }}>
          <h2 className="dr-h2" style={{ marginTop: 18 }}>{t(locale, "Credits")}</h2>
          {crewMatch && crewHref ? (
            <p style={{ fontSize: 16.5, lineHeight: 1.6, maxWidth: "68ch", margin: "6px 0 14px" }}>
              {director} also signs the credits beyond directing — {crewMatch.n} catalog film{crewMatch.n === 1 ? "" : "s"} as {crewRoles}.{" "}
              <Link className="rcp-h" style={{ display: "inline" }} href={crewHref}>{t(locale, "See the crew page →")}</Link>
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
          <Suspense fallback={<div style={{ padding: "30px 0", opacity: 0.6 }}>{t(locale, "Loading the map…")}</div>}>
            <CreditsExplorer embed initialD={director} />
          </Suspense>
        </section>

        <JoinCard variant="director" source="director-main" />
      </div>

      {/* Bottom plate band — doors to every director article that exists
          (life/start/next/locations/honors/reception/takescore/theory). */}
      <DirectorPlates slug={slug} />
    </div>
  );
}
