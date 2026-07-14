/**
 * lib/related.ts — "related boxes" module system for thin detail pages
 * (figure / trope / take / Q&A). Each page ends with THEMED SECTIONS of
 * server-rendered boxes (kind badge + title + excerpt, optionally a poster)
 * so readers keep reading without hunting and crawlers see every leaf open
 * onto the graph. Owner's principle: every DB node type reachable from the
 * current page surfaces as a module, strongest relevance first.
 *
 * SEO rules ENCODED here — do not relax:
 *  - Deterministic selection only. Every query orders by stable keys
 *    (confidence DESC NULLS LAST → created_at ASC → id ASC, or
 *    published_at/year sorted with NULLS LAST → slug/id ASC). No randomness,
 *    no per-request rotation — freshness comes from each page's existing
 *    ISR revalidate.
 *  - Selection is relevance-driven per entity (this figure's takes, this
 *    film's questions, this director's films…), so every page gets a
 *    DIFFERENT mix — never a global "top N" list repeated site-wide.
 *  - The current page's href is always excluded, and boxes are deduped by
 *    href across ALL sections: a box appears in at most one section.
 *  - Excerpts are plain text ≤ EXCERPT_MAX chars, truncated at a word
 *    boundary with an ellipsis.
 *
 * Live-graph note (verified 2026-07-04): published trope membership lives on
 * takes.trope_id (19.5k rows); takes.meta_take_id is currently empty and
 * meta_takes kind='reading' has 0 published rows. Both columns are honoured
 * (trope_id first) so restored readings light up without a code change.
 * meta_takes.tradition exists but is currently all-null — the Tradition box
 * activates automatically once the column is populated.
 */
import { createClient } from "@supabase/supabase-js";
import {
  figureUrl, questionUrl, takeUrl, tropeUrl, moviesLikeUrl, whereToUrl,
  filmUrl, directorUrl, genreUrl, theoristUrl,
} from "@/lib/urls";
import { fw, BROWSABLE } from "@/lib/frameworks";

export type RelatedBox = {
  kind: string; title: string; excerpt: string; href: string;
  /** TMDB poster URL (w185) for the "posters" variant. */
  image?: string;
  /** One-line meta, e.g. "2019 · Bong Joon Ho". */
  meta?: string;
};
export type RelatedSection = { heading: string; variant: "cards" | "rows" | "posters"; boxes: RelatedBox[] };

const EXCERPT_MAX = 220;
const IMG = "https://image.tmdb.org/t/p/w185";

// No helper in lib/urls.ts for these two hubs yet; keep the literals in ONE place.
const strongMisreadingsUrl = (slug: string) => `/strong-misreadings/${slug}`;
const TRADITION_HUB = "/tradition";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** Plain-text excerpt: resolves {{entity:slug}} tokens, strips markdown marks,
 *  collapses whitespace, truncates ≤ max at a word boundary with "…". */
export function excerptOf(text: string | null | undefined, max = EXCERPT_MAX): string {
  if (!text) return "";
  const plain = text
    .replace(/\{\{(?:film|meta_take|take|figure):([^}]+)\}\}/g, (_m, id: string) => id.replace(/-/g, " "))
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[\s,;:.!?…—–-]+$/, "") + "…";
}

/* ── deterministic ordering helpers ─────────────────────────────────────── */

type Ranked = { id: string; confidence: number | null; created_at: string | null };

/** confidence DESC (nulls last) → created_at ASC → id ASC. */
function relCmp(a: Ranked, b: Ranked): number {
  const ca = a.confidence ?? -1e9;
  const cb = b.confidence ?? -1e9;
  if (cb !== ca) return cb - ca;
  const ta = a.created_at ?? "";
  const tb = b.created_at ?? "";
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

type TakeEdge = Ranked & {
  trope_id: string | null; meta_take_id: string | null;
  framework?: string | null; theorist_id?: string | null;
};

const edgeTarget = (e: TakeEdge) => e.trope_id ?? e.meta_take_id;

/** Unique target meta_take ids in edge order (edges pre-sorted by relCmp). */
function orderedTargets(edges: TakeEdge[], excludeId?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of edges) {
    const t = edgeTarget(e);
    if (!t || t === excludeId || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Target ids ranked by shared-edge count DESC, then first-seen edge order. */
function rankedTargets(edges: TakeEdge[], excludeId?: string): string[] {
  const count = new Map<string, number>();
  const first: string[] = [];
  for (const e of edges) {
    const t = edgeTarget(e);
    if (!t || t === excludeId) continue;
    if (!count.has(t)) first.push(t);
    count.set(t, (count.get(t) ?? 0) + 1);
  }
  const pos = new Map(first.map((id, i) => [id, i]));
  return [...first].sort((a, b) => (count.get(b)! - count.get(a)!) || (pos.get(a)! - pos.get(b)!));
}

function uniqueInOrder<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const it of items) { if (!seen.has(it)) { seen.add(it); out.push(it); } }
  return out;
}

/* ── raw take-edge fetchers (edges feed several node sources at once:
      tropes/readings, frameworks and theorists) ──────────────────────────── */

async function figureTakeEdges(figureId: string): Promise<TakeEdge[]> {
  const { data } = await db()
    .from("takes")
    .select("id, confidence, created_at, trope_id, meta_take_id, framework, theorist_id")
    .eq("figure_id", figureId)
    .eq("status", "published")
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(40);
  return ((data ?? []) as TakeEdge[]).sort(relCmp);
}

async function filmTakeEdges(filmId: string): Promise<TakeEdge[]> {
  const { data } = await db()
    .from("takes")
    .select("id, confidence, created_at, trope_id, meta_take_id, framework, theorist_id, figure:figures!inner(film_id)")
    .eq("figure.film_id", filmId)
    .eq("status", "published")
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(80);
  return ((data ?? []) as unknown as TakeEdge[]).sort(relCmp);
}

/* ── meta_takes (tropes + readings) ─────────────────────────────────────── */

type MetaTakeRow = {
  id: string; slug: string; title: string; kind: string; status: string;
  thesis: string | null; laconic: string | null;
};

function metaTakeBox(mt: MetaTakeRow): RelatedBox {
  const isTrope = mt.kind === "figure_type";
  return {
    kind: isTrope ? "Trope" : "Reading",
    title: mt.title,
    excerpt: excerptOf(mt.thesis ?? mt.laconic),
    href: isTrope ? tropeUrl(mt.slug) : takeUrl(mt.slug),
  };
}

/** Fetch published meta_takes by id, returned in the given (relevance) order. */
async function metaTakesByIds(orderedIds: string[]): Promise<RelatedBox[]> {
  if (orderedIds.length === 0) return [];
  const { data } = await db()
    .from("meta_takes")
    .select("id, slug, title, kind, status, thesis, laconic")
    .in("id", orderedIds)
    .eq("status", "published")
    .in("kind", ["reading", "figure_type"]);
  const byId = new Map(((data ?? []) as MetaTakeRow[]).map((r) => [r.id, r]));
  const out: RelatedBox[] = [];
  for (const id of orderedIds) {
    const r = byId.get(id);
    if (r) out.push(metaTakeBox(r));
  }
  return out;
}

/* ── source: readings/tropes citing one figure or one film ──────────────── */

export async function readingsCitingFigure(figureId: string, cap = 12): Promise<RelatedBox[]> {
  return metaTakesByIds(orderedTargets(await figureTakeEdges(figureId)).slice(0, cap));
}

export async function readingsCitingFilm(filmId: string, cap = 12): Promise<RelatedBox[]> {
  return metaTakesByIds(rankedTargets(await filmTakeEdges(filmId)).slice(0, cap));
}

/* ── source: sibling figures of a film (only those with published takes, so
      the boxes never point at figure pages that redirect away) ───────────── */

type FigureRow = { id: string; slug: string | null; label: string; description: string | null; created_at: string | null };

export async function siblingFigures(
  filmId: string, filmSlug: string, filmTitle: string, excludeFigureId?: string, cap = 12,
): Promise<RelatedBox[]> {
  let q = db()
    .from("figures")
    .select("id, slug, label, description, created_at, takes!inner(id)")
    .eq("film_id", filmId)
    .eq("status", "approved")
    .not("slug", "is", null)
    .eq("takes.status", "published")
    .order("created_at", { ascending: true })
    .order("slug", { ascending: true })
    .limit(cap);
  if (excludeFigureId) q = q.neq("id", excludeFigureId);
  const { data } = await q;
  return ((data ?? []) as unknown as FigureRow[])
    .filter((f) => !!f.slug)
    .map((f) => ({
      kind: "Figure",
      title: `${f.label} — ${filmTitle}`,
      excerpt: excerptOf(f.description),
      href: figureUrl(filmSlug, f.slug as string),
    }));
}

/* ── source: figures cited by a meta take (trope members / reading cases) ── */

type CitedFilm = {
  id: string; slug: string; title: string; year: number | null; visible: boolean | null;
  poster_path: string | null; director: string | null; overview: string | null;
};
type CitedFigureRow = TakeEdge & {
  figure: {
    id: string; slug: string | null; label: string; description: string | null; status: string;
    film: CitedFilm;
  };
};

async function citedFigures(metaTakeId: string): Promise<CitedFigureRow[]> {
  const { data } = await db()
    .from("takes")
    .select("id, confidence, created_at, framework, theorist_id, figure:figures!inner(id, slug, label, description, status, film:films!inner(id, slug, title, year, visible, poster_path, director, overview))")
    .or(`trope_id.eq.${metaTakeId},meta_take_id.eq.${metaTakeId}`)
    .eq("status", "published")
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(40);
  return ((data ?? []) as unknown as CitedFigureRow[])
    .filter((r) => r.figure && r.figure.status === "approved" && !!r.figure.slug && r.figure.film && r.figure.film.visible !== false)
    .sort(relCmp);
}

function citedFigureBoxes(rows: CitedFigureRow[], cap: number): RelatedBox[] {
  const seen = new Set<string>();
  const out: RelatedBox[] = [];
  for (const r of rows) {
    if (seen.has(r.figure.id)) continue;
    seen.add(r.figure.id);
    out.push({
      kind: "Figure",
      title: `${r.figure.label} — ${r.figure.film.title}`,
      excerpt: excerptOf(r.figure.description),
      href: figureUrl(r.figure.film.slug, r.figure.slug as string),
    });
    if (out.length >= cap) break;
  }
  return out;
}

export async function figuresCitedByMetaTake(metaTakeId: string, cap = 12): Promise<RelatedBox[]> {
  return citedFigureBoxes(await citedFigures(metaTakeId), cap);
}

/* ── source: film boxes (posters variant) ───────────────────────────────── */

function filmBox(f: {
  slug: string; title: string; year: number | null;
  poster_path: string | null; director: string | null; overview: string | null;
}): RelatedBox {
  const meta = [f.year ? String(f.year) : null, f.director].filter(Boolean).join(" · ");
  return {
    kind: "Film",
    title: f.title,
    excerpt: excerptOf(f.overview),
    href: filmUrl(f.slug),
    ...(f.poster_path ? { image: `${IMG}${f.poster_path}` } : {}),
    ...(meta ? { meta } : {}),
  };
}

/** Member films of a meta take, unique, in relevance order (posters section). */
function memberFilmBoxes(rows: CitedFigureRow[], cap: number): RelatedBox[] {
  const seen = new Set<string>();
  const out: RelatedBox[] = [];
  for (const r of rows) {
    const f = r.figure.film;
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(filmBox(f));
    if (out.length >= cap) break;
  }
  return out;
}

/** The director's OTHER visible films (posters section). */
export async function directorFilms(directorSlug: string, excludeFilmId: string, cap = 4): Promise<RelatedBox[]> {
  const { data } = await db()
    .from("films")
    .select("id, slug, title, year, poster_path, director, overview")
    .eq("director_slug", directorSlug)
    .eq("visible", true)
    .neq("id", excludeFilmId)
    .order("year", { ascending: true, nullsFirst: false })
    .order("slug", { ascending: true })
    .limit(cap);
  return ((data ?? []) as {
    id: string; slug: string; title: string; year: number | null;
    poster_path: string | null; director: string | null; overview: string | null;
  }[]).map(filmBox);
}

/* ── source: frameworks / theorists / tradition (the theory layer) ──────── */

const BROWSABLE_SLUGS = new Set(BROWSABLE.map((f) => f.slug));

/** Strong-Misreading lenses used by the given takes → /strong-misreadings/{fw}.
 *  takes.framework stores the framework KEY; fw() maps key → slug/label/short,
 *  and only BROWSABLE slugs are linked (INVITATION and unknowns are skipped). */
function frameworkBoxesFromEdges(edges: TakeEdge[], cap = 4): RelatedBox[] {
  const keys = uniqueInOrder(edges.map((e) => e.framework).filter((k): k is string => !!k));
  const out: RelatedBox[] = [];
  for (const k of keys) {
    const f = fw(k);
    if (!f.slug || !BROWSABLE_SLUGS.has(f.slug)) continue;
    out.push({
      kind: "Framework",
      title: `${f.label} — Strong Misreadings`,
      excerpt: f.short,
      href: strongMisreadingsUrl(f.slug),
    });
    if (out.length >= cap) break;
  }
  return out;
}

type TheoristRow = { id: string; slug: string | null; name: string; blurb: string | null };

/** Theorists behind the given takes → /theorist/{slug}. Matched by theorist_id
 *  and only linked when the theorists row has a slug (resolvable page). */
async function theoristBoxesFromEdges(edges: TakeEdge[], cap = 4): Promise<RelatedBox[]> {
  const ids = uniqueInOrder(edges.map((e) => e.theorist_id).filter((t): t is string => !!t)).slice(0, 8);
  if (ids.length === 0) return [];
  const { data } = await db().from("theorists").select("id, slug, name, blurb").in("id", ids);
  const byId = new Map(((data ?? []) as TheoristRow[]).map((r) => [r.id, r]));
  const out: RelatedBox[] = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (!t || !t.slug) continue;
    out.push({ kind: "Theorist", title: t.name, excerpt: excerptOf(t.blurb), href: theoristUrl(t.slug) });
    if (out.length >= cap) break;
  }
  return out;
}

/** Tradition teaser → /tradition hub (activates once meta_takes.tradition is populated). */
function traditionBox(tradition: string | null | undefined, aboutTitle: string): RelatedBox[] {
  if (!tradition) return [];
  return [{
    kind: "Tradition",
    title: `The ${tradition} tradition`,
    excerpt: `${aboutTitle} leans on ${tradition} — explore the critical traditions Metatake's readings draw from.`,
    href: TRADITION_HUB,
  }];
}

/* ── source: director hub + genres (the film's surroundings) ────────────── */

function directorHubBox(name: string, slug: string): RelatedBox {
  return {
    kind: "Director",
    title: `${name} — the director hub`,
    excerpt: `${name} on Metatake: every film, with its figures, readings and questions gathered on one page.`,
    href: directorUrl(slug),
  };
}

// Same derivation as lib/sitemap-data.ts slugifyGenre / app/genre links
// (genre slugs come from films.genres labels; there is no genres table).
export function slugifyGenre(g: string): string {
  return g.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function genreBoxes(genres: string[] | null | undefined, cap = 2): RelatedBox[] {
  const out: RelatedBox[] = [];
  const seen = new Set<string>();
  for (const g of genres ?? []) {
    const slug = slugifyGenre(g);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      kind: "Genre",
      title: `${g} films`,
      excerpt: `The ${g.toLowerCase()} films on Metatake — every title in the genre, with the readings and questions each one carries.`,
      href: genreUrl(slug),
    });
    if (out.length >= cap) break;
  }
  return out;
}

/** Director + genre facts for a film (one indexed row lookup). */
async function filmMeta(filmId: string): Promise<{ director: string | null; directorSlug: string | null; genres: string[] }> {
  const { data } = await db()
    .from("films")
    .select("director, director_slug, genres")
    .eq("id", filmId)
    .maybeSingle();
  const r = (data ?? null) as { director: string | null; director_slug: string | null; genres: string[] | null } | null;
  return { director: r?.director ?? null, directorSlug: r?.director_slug ?? null, genres: r?.genres ?? [] };
}

/* ── source: cousins of a meta take (2-hop: its figures → their other takes) ── */

export async function cousinsOfMetaTake(
  metaTakeId: string, memberFigureIds?: string[], cap = 12,
): Promise<RelatedBox[]> {
  let figureIds = memberFigureIds;
  if (!figureIds) figureIds = uniqueInOrder((await citedFigures(metaTakeId)).map((r) => r.figure.id));
  figureIds = figureIds.slice(0, 20);
  if (figureIds.length === 0) return [];
  const { data } = await db()
    .from("takes")
    .select("id, confidence, created_at, trope_id, meta_take_id")
    .in("figure_id", figureIds)
    .eq("status", "published")
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(120);
  const edges = ((data ?? []) as TakeEdge[]).sort(relCmp);
  return metaTakesByIds(rankedTargets(edges, metaTakeId).slice(0, cap));
}

/* ── source: film Q&A ───────────────────────────────────────────────────── */

type QuestionRow = {
  id: string; slug: string; title: string; display_title: string | null;
  title_spoiler: boolean | null; safe_hook: string | null; body: string | null;
  spoiler_level: string | null; published_at: string | null;
};

/** Spoiler rules mirrored from existing pages:
 *  - /whereto: show display_title instead of title when title_spoiler;
 *  - /film/[slug]/q: "major" answers surface the spoiler-free safe_hook, never
 *    the body. Spoilery titles get the same guard (empty beats a leak). */
function questionBox(q: QuestionRow, filmSlug: string, filmTitle?: string): RelatedBox {
  const title = q.title_spoiler && q.display_title ? q.display_title : q.title;
  const spoilery = q.spoiler_level === "major" || q.title_spoiler === true;
  return {
    kind: "Q&A",
    title: filmTitle ? `${title} — ${filmTitle}` : title,
    excerpt: excerptOf(spoilery ? q.safe_hook ?? "" : q.body ?? q.safe_hook ?? ""),
    href: questionUrl(filmSlug, q.slug),
  };
}

export async function filmQuestions(
  filmId: string, filmSlug: string, excludeQuestionId?: string, cap = 12,
): Promise<RelatedBox[]> {
  let q = db()
    .from("questions")
    .select("id, slug, title, display_title, title_spoiler, safe_hook, body, spoiler_level, published_at")
    .eq("film_id", filmId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(cap);
  if (excludeQuestionId) q = q.neq("id", excludeQuestionId);
  const { data } = await q;
  return ((data ?? []) as QuestionRow[]).map((r) => questionBox(r, filmSlug));
}

/** Q&A drawn from a set of films (used on trope pages: the films whose scenes
 *  carry the trope). Film title is appended for cross-film context. */
export async function questionsForFilms(
  films: { id: string; slug: string; title: string }[], cap = 12,
): Promise<RelatedBox[]> {
  const byId = new Map(films.map((f) => [f.id, f]));
  const ids = [...byId.keys()].slice(0, 10);
  if (ids.length === 0) return [];
  const { data } = await db()
    .from("questions")
    .select("id, slug, film_id, title, display_title, title_spoiler, safe_hook, body, spoiler_level, published_at")
    .in("film_id", ids)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(cap);
  const out: RelatedBox[] = [];
  for (const r of (data ?? []) as (QuestionRow & { film_id: string })[]) {
    const f = byId.get(r.film_id);
    if (f) out.push(questionBox(r, f.slug, f.title));
  }
  return out;
}

/* ── static single-box teasers (fixed formula, varies with the film title) ── */

export function wheretoBox(filmSlug: string, filmTitle: string, year: number | null): RelatedBox {
  return {
    kind: "Where to watch",
    title: `Where to watch ${filmTitle}${year ? ` (${year})` : ""}`,
    excerpt: `Every legal way to watch ${filmTitle} — streaming, rent and buy by country, plus free archives, disc editions and subtitle links.`,
    href: whereToUrl(filmSlug),
  };
}

export function moviesLikeBox(filmSlug: string, filmTitle: string): RelatedBox {
  return {
    kind: "Similar films",
    title: `Movies like ${filmTitle}`,
    excerpt: `If ${filmTitle} stayed with you, start here — films that share its preoccupations, matched by the readings they earn on Metatake.`,
    href: moviesLikeUrl(filmSlug),
  };
}

/* ── section assembler ──────────────────────────────────────────────────── */

type SectionDef = { heading: string; variant: "cards" | "rows" | "posters"; boxes: RelatedBox[]; cap: number };

/** Builds themed sections in priority order with a GLOBAL seen-set: the
 *  current page (excludeHrefs) never appears, and no href repeats across
 *  sections. Empty sections are dropped. Fully deterministic. */
function sectionize(defs: SectionDef[], excludeHrefs: string[]): RelatedSection[] {
  const seen = new Set(excludeHrefs);
  const out: RelatedSection[] = [];
  for (const d of defs) {
    const picked: RelatedBox[] = [];
    for (const b of d.boxes) {
      if (picked.length >= d.cap) break;
      if (!b.href || seen.has(b.href)) continue;
      seen.add(b.href);
      picked.push(b);
    }
    if (picked.length > 0) out.push({ heading: d.heading, variant: d.variant, boxes: picked });
  }
  return out;
}

/* ── per-page recipes (priority: direct citations → siblings → film-level →
      director posters → frameworks/theorists/tradition → genres → utilities) ── */

export async function relatedForFigure(args: {
  filmId: string; figureId: string; figureSlug: string; figureLabel: string;
  filmSlug: string; filmTitle: string; year: number | null;
}): Promise<RelatedSection[]> {
  // Wave 1 — independent fetches (edges feed tropes + frameworks + theorists).
  const [figEdges, siblings, filmEdges, meta] = await Promise.all([
    figureTakeEdges(args.figureId),
    siblingFigures(args.filmId, args.filmSlug, args.filmTitle, args.figureId),
    filmTakeEdges(args.filmId),
    filmMeta(args.filmId),
  ]);
  // Wave 2 — lookups derived from wave 1.
  const [citing, filmFeeds, theorists] = await Promise.all([
    metaTakesByIds(orderedTargets(figEdges).slice(0, 12)),
    metaTakesByIds(rankedTargets(filmEdges).slice(0, 12)),
    theoristBoxesFromEdges(figEdges),
  ]);
  const frameworks = frameworkBoxesFromEdges(figEdges);
  const yearPart = args.year ? ` (${args.year})` : "";
  return sectionize(
    [
      { heading: `Readings that cite ${args.figureLabel}`, variant: "cards", boxes: citing, cap: 6 },
      { heading: `More figures from ${args.filmTitle}${yearPart}`, variant: "cards", boxes: siblings, cap: 6 },
      { heading: `The tropes ${args.filmTitle} feeds`, variant: "cards", boxes: filmFeeds, cap: 6 },
      { heading: `The frameworks and theorists reading ${args.figureLabel}`, variant: "cards", boxes: [...frameworks, ...theorists], cap: 6 },
      {
        heading: `Around ${args.filmTitle}: director & genres`, variant: "rows", cap: 3,
        boxes: [
          ...(meta.director && meta.directorSlug ? [directorHubBox(meta.director, meta.directorSlug)] : []),
          ...genreBoxes(meta.genres),
        ],
      },
    ],
    [figureUrl(args.filmSlug, args.figureSlug)],
  );
}

export async function relatedForMetaTake(args: {
  metaTakeId: string; kind: "reading" | "figure_type"; slug: string;
}): Promise<RelatedSection[]> {
  // Wave 1 — the meta take's own row (title + tradition) and its cited scenes.
  const [{ data: mtRow }, cited] = await Promise.all([
    db().from("meta_takes").select("title, tradition").eq("id", args.metaTakeId).maybeSingle(),
    citedFigures(args.metaTakeId),
  ]);
  const mt = (mtRow ?? null) as { title: string; tradition: string | null } | null;
  const title = mt?.title ?? "this pattern";
  const figureBoxes = citedFigureBoxes(cited, 12);
  const filmBoxes = memberFilmBoxes(cited, 6);
  const memberFigureIds = uniqueInOrder(cited.map((r) => r.figure.id));
  const memberFilms = uniqueInOrder(cited.map((r) => r.figure.film.id)).map((id) => {
    const film = cited.find((r) => r.figure.film.id === id)!.figure.film;
    return { id: film.id, slug: film.slug, title: film.title };
  });
  // Wave 2 — 2-hop lookups derived from wave 1.
  const [cousins, questions, theorists] = await Promise.all([
    cousinsOfMetaTake(args.metaTakeId, memberFigureIds),
    questionsForFilms(memberFilms),
    theoristBoxesFromEdges(cited),
  ]);
  const frameworks = frameworkBoxesFromEdges(cited);
  const noun = args.kind === "figure_type" ? "trope" : "reading";
  return sectionize(
    [
      { heading: `Scenes that carry this ${noun}`, variant: "cards", boxes: figureBoxes, cap: 6 },
      { heading: `The films of ${title}`, variant: "posters", boxes: filmBoxes, cap: 5 },
      { heading: "Neighboring readings", variant: "cards", boxes: cousins, cap: 6 },
      { heading: "Questions from these films", variant: "rows", boxes: questions, cap: 6 },
      {
        heading: `The frameworks and theorists behind ${title}`, variant: "cards", cap: 6,
        boxes: [...frameworks, ...theorists, ...traditionBox(mt?.tradition, title)],
      },
    ],
    // Exclude both URL forms of this meta take — /trope/* and /take/* — so a
    // cousin edge can never link the page to itself under the other route.
    [tropeUrl(args.slug), takeUrl(args.slug)],
  );
}

/* ── Tier-2 catalog film page (no figures/readings — the modules ARE the page's
      funnel into worked content). Sources follow the same SEO rules as above:
      deterministic ordering, visible (Tier-1) films favoured, global dedupe. ── */

type T2FilmRow = {
  id: string; slug: string; title: string; year: number | null;
  poster_path: string | null; director: string | null; director_slug: string | null;
  overview: string | null; visible: boolean | null; genres?: string[] | null;
};

/** Overview excerpts on Tier-2 modules are capped tighter (~200) than the
 *  default so the poster grids stay scannable. */
function t2FilmBox(f: T2FilmRow): RelatedBox {
  return { ...filmBox(f), excerpt: excerptOf(f.overview, 200) };
}

/** The director's OTHER films across BOTH tiers — visible (Tier-1) first, then
 *  other catalog records — matched by director name (Tier-2 rows often lack
 *  director_slug), falling back to slug. Also surfaces the director-hub slug
 *  carried by any sibling row, so a Tier-2 page whose own director_slug is
 *  null can still link the hub. */
async function directorFilmsAllTiers(args: {
  director: string | null; directorSlug: string | null; excludeFilmId: string; cap?: number;
}): Promise<{ boxes: RelatedBox[]; hubSlug: string | null }> {
  if (!args.director && !args.directorSlug) return { boxes: [], hubSlug: args.directorSlug ?? null };
  let q = db()
    .from("films")
    .select("id, slug, title, year, poster_path, director, director_slug, overview, visible")
    .neq("id", args.excludeFilmId)
    .order("visible", { ascending: false })
    .order("year", { ascending: true, nullsFirst: false })
    .order("slug", { ascending: true })
    .limit(args.cap ?? 6);
  q = args.director ? q.eq("director", args.director) : q.eq("director_slug", args.directorSlug as string);
  const { data } = await q;
  const rows = (data ?? []) as T2FilmRow[];
  const hubSlug = args.directorSlug ?? rows.find((r) => r.director_slug)?.director_slug ?? null;
  return { boxes: rows.map(t2FilmBox), hubSlug };
}

/** Tier-1 films sharing this film's lineage membership (canon/award/festival/
 *  movement/national lists from film_lineage — the same source the page's
 *  Lineage section renders). Ranked by shared-list count DESC → year ASC →
 *  slug ASC. */
async function lineageTraditionFilms(listSlugs: string[], excludeFilmId: string, cap = 6): Promise<RelatedBox[]> {
  const slugs = uniqueInOrder(listSlugs.filter(Boolean)).slice(0, 8);
  if (slugs.length === 0) return [];
  const { data } = await db()
    .from("film_lineage")
    .select("list:lineage_lists!inner(slug), film:films!inner(id, slug, title, year, poster_path, director, overview, visible)")
    .in("list.slug", slugs)
    .eq("film.visible", true)
    .neq("film_id", excludeFilmId)
    .limit(120);
  const rows = ((data ?? []) as unknown as { list: { slug: string }; film: T2FilmRow }[]).filter((r) => r.film);
  const byId = new Map<string, { film: T2FilmRow; n: number }>();
  for (const r of rows) {
    const cur = byId.get(r.film.id);
    if (cur) cur.n += 1;
    else byId.set(r.film.id, { film: r.film, n: 1 });
  }
  return [...byId.values()]
    .sort((a, b) => (b.n - a.n)
      || ((a.film.year ?? 9999) - (b.film.year ?? 9999))
      || (a.film.slug < b.film.slug ? -1 : a.film.slug > b.film.slug ? 1 : 0))
    .slice(0, cap)
    .map((x) => t2FilmBox(x.film));
}

/** Top Tier-1 films sharing ≥2 of this film's genres, ranked by shared-genre
 *  count DESC → year DESC → slug ASC (pool bounded deterministically). */
async function sharedGenreFilms(genres: string[] | null | undefined, excludeFilmId: string, cap = 6): Promise<RelatedBox[]> {
  const gs = uniqueInOrder((genres ?? []).filter(Boolean));
  if (gs.length < 2) return [];
  const { data } = await db()
    .from("films")
    .select("id, slug, title, year, poster_path, director, director_slug, overview, visible, genres")
    .overlaps("genres", gs)
    .eq("visible", true)
    .neq("id", excludeFilmId)
    .order("year", { ascending: false, nullsFirst: false })
    .order("slug", { ascending: true })
    .limit(120);
  const set = new Set(gs);
  return ((data ?? []) as T2FilmRow[])
    .map((f) => ({ f, n: (f.genres ?? []).filter((g) => set.has(g)).length }))
    .filter((x) => x.n >= 2)
    .sort((a, b) => (b.n - a.n)
      || ((b.f.year ?? -1) - (a.f.year ?? -1))
      || (a.f.slug < b.f.slug ? -1 : a.f.slug > b.f.slug ? 1 : 0))
    .slice(0, cap)
    .map((x) => t2FilmBox(x.f));
}

export async function relatedForTier2Film(args: {
  filmId: string; filmSlug: string; filmTitle: string; year: number | null;
  director: string | null; directorSlug: string | null;
  genres: string[] | null; lineageListSlugs: string[];
}): Promise<{ sections: RelatedSection[]; directorHubSlug: string | null }> {
  const [dir, tradition, genreFilms] = await Promise.all([
    directorFilmsAllTiers({ director: args.director, directorSlug: args.directorSlug, excludeFilmId: args.filmId }),
    lineageTraditionFilms(args.lineageListSlugs, args.filmId),
    sharedGenreFilms(args.genres, args.filmId),
  ]);
  const sections = sectionize(
    [
      ...(args.director
        ? [{ heading: `More from ${args.director} on Metatake`, variant: "posters" as const, boxes: dir.boxes, cap: 6 }]
        : []),
      { heading: "Read closely in the same tradition", variant: "posters", boxes: tradition, cap: 6 },
      { heading: "In the same genres", variant: "posters", boxes: genreFilms, cap: 6 },
      {
        heading: `Around ${args.filmTitle}: director & genres`, variant: "rows", cap: 3,
        boxes: [
          ...(args.director && dir.hubSlug ? [directorHubBox(args.director, dir.hubSlug)] : []),
          ...genreBoxes(args.genres),
        ],
      },
      {
        heading: `Watch ${args.filmTitle}`, variant: "rows", cap: 1,
        boxes: [wheretoBox(args.filmSlug, args.filmTitle, args.year)],
      },
    ],
    [filmUrl(args.filmSlug)],
  );
  return { sections, directorHubSlug: dir.hubSlug };
}

export async function relatedForQuestion(args: {
  filmId: string; filmSlug: string; filmTitle: string; year: number | null;
  questionId: string; questionSlug: string;
}): Promise<RelatedSection[]> {
  // Wave 1 — independent fetches.
  const [figures, questions, filmEdges, meta] = await Promise.all([
    siblingFigures(args.filmId, args.filmSlug, args.filmTitle),
    filmQuestions(args.filmId, args.filmSlug, args.questionId),
    filmTakeEdges(args.filmId),
    filmMeta(args.filmId),
  ]);
  // Wave 2 — lookups derived from wave 1.
  const [readings, theorists] = await Promise.all([
    metaTakesByIds(rankedTargets(filmEdges).slice(0, 12)),
    theoristBoxesFromEdges(filmEdges),
  ]);
  const frameworks = frameworkBoxesFromEdges(filmEdges);
  return sectionize(
    [
      { heading: "The scenes behind this question", variant: "cards", boxes: figures, cap: 6 },
      { heading: `More questions about ${args.filmTitle}`, variant: "rows", boxes: questions, cap: 3 },
      { heading: `How Metatake reads ${args.filmTitle}`, variant: "cards", boxes: readings, cap: 6 },
      { heading: `The frameworks and theorists reading ${args.filmTitle}`, variant: "cards", boxes: [...frameworks, ...theorists], cap: 5 },
      {
        heading: `Around ${args.filmTitle}: director & genres`, variant: "rows", cap: 3,
        boxes: [
          ...(meta.director && meta.directorSlug ? [directorHubBox(meta.director, meta.directorSlug)] : []),
          ...genreBoxes(meta.genres),
        ],
      },
    ],
    [questionUrl(args.filmSlug, args.questionSlug)],
  );
}
