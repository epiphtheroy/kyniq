import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

/**
 * Lineage read layer — shared data helpers (awards / canons / national honours
 * / auteur lines). The vocabulary lives in lineage_lists (+ per-film rows in
 * film_lineage; every row carries a source, 300 lists carry a Wikidata QID in
 * external_ref). This module surfaces the provenance the schema already has —
 * the lineage_sources table is EMPTY (never populated), so display names for
 * source codes live in LINEAGE_SOURCES below.
 */

// Publication gates (mirrored by the pages' 404/robots bars and the sitemap).
export const LINEAGE_LIST_MIN = 3; // members a list needs for its page to be advertised/indexable
export const FILM_HONORS_MIN = 3; // lineage rows a film needs for /film/x/honors to exist

export type LineageListMeta = {
  slug: string;
  label: string;
  facet: string;
  description: string | null;
  country: string | null;
  tier: string | null;
  film_count: number;
  source: string | null;
  external_ref: { wikidata?: string; url?: string } | null;
};

// Shape of rpc lineage_list_films (per member film).
export type LineageFilmRow = {
  film_slug: string; film_title: string; film_year: number | null;
  poster_path: string | null; visible: boolean; analyzed: boolean;
  result: string | null; rank: number | null; edition_year: number | null;
  rep_type: string | null;
};

// Shape of rpc film_lineage_for (per honour on one film) — matches LinRow in
// components/FilmLineageSection.tsx.
export type FilmLineageRow = {
  facet: string; list_slug: string; list_label: string; parent_label: string | null;
  result: string | null; rank: number | null; edition_year: number | null;
  rank_max: number | null; rep_type: string | null; country?: string | null;
};

/**
 * lineage_lists.source codes → public display names. Names only where the
 * organisation is unambiguous; URLs only where stable and certain. Codes not
 * listed fall back to the raw code (never invent).
 */
const LINEAGE_SOURCES: Record<string, { name: string; url?: string }> = {
  // No url for wikidata/wikipedia on purpose: a bare wikidata.org link (no
  // QID) is a broken citation — the QID link comes from external_ref via
  // wikidataUrl(), and when a list has no QID the name renders as plain text
  // (site_content/SEO_LINEAGE_SPEC.md §4a).
  wikidata: { name: "Wikidata" },
  wikipedia: { name: "Wikipedia" },
  bfi: { name: "BFI (Sight & Sound)", url: "https://www.bfi.org.uk" },
  tspdt: { name: "They Shoot Pictures, Don't They?", url: "https://www.theyshootpictures.com" },
  afi: { name: "American Film Institute", url: "https://www.afi.com" },
  "kinema-junpo": { name: "Kinema Junpo" },
  caiman: { name: "Caimán Cuadernos de Cine" },
  bbc: { name: "BBC Culture" },
  time: { name: "TIME" },
  nyt: { name: "The New York Times" },
  guardian: { name: "The Guardian" },
  cahiers: { name: "Cahiers du Cinéma" },
  mubi: { name: "MUBI" },
  indiewire: { name: "IndieWire" },
  wga: { name: "Writers Guild of America" },
  "golden-horse": { name: "Golden Horse Awards" },
  tiff: { name: "Toronto International Film Festival" },
  dfi: { name: "Danish Film Institute" },
  "venice-days": { name: "Venice Days" },
  kinematheksverbund: { name: "Kinematheksverbund" },
  "polish-critics": { name: "Polish film critics' poll" },
  "au-critics": { name: "Australian film critics' poll" },
  rfca: { name: "Russian Guild of Film Critics" },
  "museo-del-cine": { name: "Museo del Cine, Buenos Aires" },
  abraccine: { name: "Abraccine (Brazilian film critics)" },
  editorial: { name: "Metatake Editorial" },
};

export function lineageSource(code: string | null | undefined): { name: string; url?: string } | null {
  if (!code) return null;
  return LINEAGE_SOURCES[code] ?? { name: code };
}

export function wikidataUrl(ref: LineageListMeta["external_ref"]): string | null {
  const qid = ref?.wikidata;
  return qid && /^Q\d+$/.test(qid) ? `https://www.wikidata.org/wiki/${qid}` : null;
}

/**
 * True published sizes for lists whose length is DEFINITIONAL (in the name /
 * fixed by the publisher) — used for the honest "N of M matched" note when
 * our membership rows fall short. Only add entries whose size is a public
 * fact; lineage_lists.film_count is NOT reliable for this.
 */
export const KNOWN_TRUE_SIZE: Record<string, number> = {
  "tspdt-1000": 1000,
  "1001-movies": 1001,
};

/** Unambiguous, machine-readable honour text for Movie.award — full body +
 * category + year, e.g. "Academy Awards — Best Picture (2025)". */
export function honorText(l: FilmLineageRow): string {
  const body = l.parent_label && l.parent_label !== l.list_label ? `${l.parent_label} — ` : "";
  const year = l.edition_year ? ` (${l.edition_year})` : "";
  return `${body}${l.list_label}${year}`;
}

export const FACET_LABEL: Record<string, string> = {
  award: "Award", canon: "Canon / list", national: "National canon",
  festival: "Festival", section: "Festival section", auteur: "Auteur line",
  movement: "Movement", style: "Style",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function loadLineageListMeta(slugs: string[]): Promise<Map<string, LineageListMeta>> {
  if (!slugs.length) return new Map();
  const out = new Map<string, LineageListMeta>();
  for (let i = 0; i < slugs.length; i += 100) {
    const { data } = await db()
      .from("lineage_lists")
      .select("slug, label, facet, description, country, tier, film_count, source, external_ref")
      .in("slug", slugs.slice(i, i + 100));
    for (const r of (data ?? []) as LineageListMeta[]) out.set(r.slug, r);
  }
  return out;
}

export type LineageMeta = { updated: string; memberships: number; lists: number };

/** Dataset-level facts for footers/JSON-LD — the TRUE last-ingest date, not
 * the render date (same honesty rule as the Atlas layer). */
export function cachedLineageMeta(): Promise<LineageMeta> {
  return unstable_cache(
    async () => {
      const supabase = db();
      const [{ data: last }, { count: memberships }, { count: lists }] = await Promise.all([
        supabase.from("film_lineage").select("created_at").order("created_at", { ascending: false }).limit(1),
        supabase.from("film_lineage").select("*", { count: "exact", head: true }),
        supabase.from("lineage_lists").select("*", { count: "exact", head: true }).eq("status", "active"),
      ]);
      const ts = (last?.[0] as { created_at: string } | undefined)?.created_at ?? "";
      return { updated: ts.slice(0, 10), memberships: memberships ?? 0, lists: lists ?? 0 };
    },
    ["lineage-meta"],
    { revalidate: 86400 },
  )();
}

// Supabase's API caps every response at 1,000 rows, so bulk reads page.
const PAGE = 1000;
async function fetchAll<T>(run: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await run(from, from + PAGE - 1);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export type LineageEligibility = {
  /** active lists with ≥LINEAGE_LIST_MIN member films, slug asc */
  lists: { slug: string; n: number }[];
  /** films (ANY visibility — honours stand on their own) with ≥FILM_HONORS_MIN rows, slug asc */
  films: { slug: string; n: number }[];
};

/** Membership tallies for the sitemap + link gates. lineage_lists.film_count
 * is the list's OFFICIAL size (e.g. 100 for a top-100), not our coverage —
 * always gate on real film_lineage rows. */
export async function loadLineageEligibility(): Promise<LineageEligibility> {
  const supabase = db();
  const rows = await fetchAll<{ film_id: string; list_id: string }>((from, to) =>
    supabase.from("film_lineage").select("film_id, list_id").order("id").range(from, to)
  );
  const lists = await fetchAll<{ id: string; slug: string; status: string }>((from, to) =>
    supabase.from("lineage_lists").select("id, slug, status").order("slug").range(from, to)
  );
  const films = await fetchAll<{ id: string; slug: string }>((from, to) =>
    supabase.from("films").select("id, slug").order("slug").range(from, to)
  );
  const perList = new Map<string, number>();
  const perFilm = new Map<string, number>();
  for (const r of rows) {
    perList.set(r.list_id, (perList.get(r.list_id) ?? 0) + 1);
    perFilm.set(r.film_id, (perFilm.get(r.film_id) ?? 0) + 1);
  }
  const slugByFilm = new Map(films.map((f) => [f.id, f.slug]));
  return {
    lists: lists
      .filter((l) => l.status === "active" && (perList.get(l.id) ?? 0) >= LINEAGE_LIST_MIN)
      .map((l) => ({ slug: l.slug, n: perList.get(l.id)! }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
    films: [...perFilm.entries()]
      .filter(([id, n]) => n >= FILM_HONORS_MIN && slugByFilm.has(id))
      .map(([id, n]) => ({ slug: slugByFilm.get(id)!, n }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

/* Per-instance memo, checked BEFORE the Data Cache.
 *
 * unstable_cache does NOT read its cache when it runs inside another
 * unstable_cache callback — the inner function simply executes. This helper is
 * called from exactly there: components/read/ReadPlates.tsx caches per slug
 * (`["read-plates-3", slug]`, ~38,000 URLs) and asks for lineage eligibility
 * inside that callback. A crawler never walks the same slug twice, so it misses
 * every per-slug entry, and each miss re-ran loadLineageEligibility in full —
 * film_lineage (10,545 rows) + lineage_lists + films (7,158 rows) paged a
 * thousand at a time, about twenty round trips for one footer link.
 *
 * Observed 2026-08-06 in the Supabase API log as the same ~19-request table
 * sweep repeating every 55 seconds against a one-hour revalidate that should
 * have produced one an hour. lib/locations.ts already carries this memo for the
 * same reason; lineage was simply missed.
 */
const ELIGIBILITY_TTL_MS = 60 * 60 * 1000;
let eligibilityMemo: { at: number; value: Promise<LineageEligibility> } | null = null;

/** Eligibility through the Data Cache — pages use it for link gates. */
export function cachedLineageEligibility(): Promise<LineageEligibility> {
  const now = Date.now();
  if (eligibilityMemo && now - eligibilityMemo.at < ELIGIBILITY_TTL_MS) return eligibilityMemo.value;
  const value = unstable_cache(loadLineageEligibility, ["lineage-eligibility"], { revalidate: 3600 })()
    .catch((e) => {
      eligibilityMemo = null; // never hold a failure for an hour
      throw e;
    });
  eligibilityMemo = { at: now, value };
  return value;
}
