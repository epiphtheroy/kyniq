/**
 * lib/related.ts — "related boxes" module system for thin detail pages
 * (figure / trope / take / Q&A). Each page ends with THEMED SECTIONS of
 * server-rendered boxes (kind badge + title + real excerpt) so readers keep
 * reading without hunting and crawlers see every leaf open onto the graph.
 *
 * SEO rules ENCODED here — do not relax:
 *  - Deterministic selection only. Every query orders by stable keys
 *    (confidence DESC NULLS LAST → created_at ASC → id ASC, or
 *    published_at DESC NULLS LAST → id ASC). No randomness, no per-request
 *    rotation — freshness comes from each page's existing ISR revalidate.
 *  - Selection is relevance-driven per entity (this figure's takes, this
 *    film's questions…), so every page gets a DIFFERENT mix — never a
 *    global "top N" list repeated site-wide.
 *  - The current page's href is always excluded, and boxes are deduped by
 *    href across ALL sections: a box appears in at most one section.
 *  - Excerpts are plain text ≤ EXCERPT_MAX chars, truncated at a word
 *    boundary with an ellipsis.
 *
 * Live-graph note (verified 2026-07-04): published trope membership lives on
 * takes.trope_id (19.5k rows); takes.meta_take_id is currently empty and
 * meta_takes kind='reading' has 0 published rows. Both columns are honoured
 * (trope_id first) so restored readings light up without a code change.
 */
import { createClient } from "@supabase/supabase-js";
import { figureUrl, questionUrl, takeUrl, tropeUrl, moviesLikeUrl, whereToUrl } from "@/lib/urls";

export type RelatedBox = { kind: string; title: string; excerpt: string; href: string };
export type RelatedSection = { heading: string; variant: "cards" | "rows"; boxes: RelatedBox[] };

const EXCERPT_MAX = 220;

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

type TakeEdge = Ranked & { trope_id: string | null; meta_take_id: string | null };

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

/* ── source: readings/tropes citing one figure ──────────────────────────── */

export async function readingsCitingFigure(figureId: string, cap = 12): Promise<RelatedBox[]> {
  const { data } = await db()
    .from("takes")
    .select("id, confidence, created_at, trope_id, meta_take_id")
    .eq("figure_id", figureId)
    .eq("status", "published")
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(40);
  const edges = ((data ?? []) as TakeEdge[]).sort(relCmp);
  return metaTakesByIds(orderedTargets(edges).slice(0, cap));
}

/* ── source: tropes/readings a whole film feeds (2-hop via its figures) ─── */

export async function readingsCitingFilm(filmId: string, cap = 12): Promise<RelatedBox[]> {
  const { data } = await db()
    .from("takes")
    .select("id, confidence, created_at, trope_id, meta_take_id, figure:figures!inner(film_id)")
    .eq("figure.film_id", filmId)
    .eq("status", "published")
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(80);
  const edges = ((data ?? []) as unknown as TakeEdge[]).sort(relCmp);
  return metaTakesByIds(rankedTargets(edges).slice(0, cap));
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

type CitedFigureRow = Ranked & {
  figure: {
    id: string; slug: string | null; label: string; description: string | null; status: string;
    film: { id: string; slug: string; title: string; year: number | null; visible: boolean | null };
  };
};

async function citedFigures(metaTakeId: string): Promise<CitedFigureRow[]> {
  const { data } = await db()
    .from("takes")
    .select("id, confidence, created_at, figure:figures!inner(id, slug, label, description, status, film:films!inner(id, slug, title, year, visible))")
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

type SectionDef = { heading: string; variant: "cards" | "rows"; boxes: RelatedBox[]; cap: number };

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

/* ── per-page recipes ───────────────────────────────────────────────────── */

export async function relatedForFigure(args: {
  filmId: string; figureId: string; figureSlug: string; figureLabel: string;
  filmSlug: string; filmTitle: string; year: number | null;
}): Promise<RelatedSection[]> {
  const [citing, siblings, filmFeeds, questions] = await Promise.all([
    readingsCitingFigure(args.figureId),
    siblingFigures(args.filmId, args.filmSlug, args.filmTitle, args.figureId),
    readingsCitingFilm(args.filmId),
    filmQuestions(args.filmId, args.filmSlug),
  ]);
  const yearPart = args.year ? ` (${args.year})` : "";
  return sectionize(
    [
      { heading: `Readings that cite ${args.figureLabel}`, variant: "cards", boxes: citing, cap: 6 },
      { heading: `More figures from ${args.filmTitle}${yearPart}`, variant: "cards", boxes: siblings, cap: 6 },
      { heading: `The tropes ${args.filmTitle} feeds`, variant: "cards", boxes: filmFeeds, cap: 6 },
      { heading: `Questions about ${args.filmTitle}`, variant: "rows", boxes: questions, cap: 5 },
      {
        heading: `Watch ${args.filmTitle}`, variant: "rows", cap: 2,
        boxes: [wheretoBox(args.filmSlug, args.filmTitle, args.year), moviesLikeBox(args.filmSlug, args.filmTitle)],
      },
    ],
    [figureUrl(args.filmSlug, args.figureSlug)],
  );
}

export async function relatedForMetaTake(args: {
  metaTakeId: string; kind: "reading" | "figure_type"; slug: string;
}): Promise<RelatedSection[]> {
  const cited = await citedFigures(args.metaTakeId);
  const figureBoxes = citedFigureBoxes(cited, 12);
  const memberFigureIds = uniqueInOrder(cited.map((r) => r.figure.id));
  const memberFilms = uniqueInOrder(cited.map((r) => r.figure.film.id)).map((id) => {
    const film = cited.find((r) => r.figure.film.id === id)!.figure.film;
    return { id: film.id, slug: film.slug, title: film.title };
  });
  const [cousins, questions] = await Promise.all([
    cousinsOfMetaTake(args.metaTakeId, memberFigureIds),
    questionsForFilms(memberFilms),
  ]);
  const noun = args.kind === "figure_type" ? "trope" : "reading";
  return sectionize(
    [
      { heading: `Scenes that carry this ${noun}`, variant: "cards", boxes: figureBoxes, cap: 6 },
      { heading: "Neighboring readings", variant: "cards", boxes: cousins, cap: 6 },
      { heading: "Questions from these films", variant: "rows", boxes: questions, cap: 6 },
    ],
    // Exclude both URL forms of this meta take — /trope/* and /take/* — so a
    // cousin edge can never link the page to itself under the other route.
    [tropeUrl(args.slug), takeUrl(args.slug)],
  );
}

export async function relatedForQuestion(args: {
  filmId: string; filmSlug: string; filmTitle: string; year: number | null;
  questionId: string; questionSlug: string;
}): Promise<RelatedSection[]> {
  const [figures, questions, readings] = await Promise.all([
    siblingFigures(args.filmId, args.filmSlug, args.filmTitle),
    filmQuestions(args.filmId, args.filmSlug, args.questionId),
    readingsCitingFilm(args.filmId),
  ]);
  return sectionize(
    [
      { heading: "The scenes behind this question", variant: "cards", boxes: figures, cap: 6 },
      { heading: `More questions about ${args.filmTitle}`, variant: "rows", boxes: questions, cap: 6 },
      { heading: `How Metatake reads ${args.filmTitle}`, variant: "cards", boxes: readings, cap: 6 },
      {
        heading: `Watch ${args.filmTitle}`, variant: "rows", cap: 2,
        boxes: [wheretoBox(args.filmSlug, args.filmTitle, args.year), moviesLikeBox(args.filmSlug, args.filmTitle)],
      },
    ],
    [questionUrl(args.filmSlug, args.questionSlug)],
  );
}
