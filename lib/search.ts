/**
 * lib/search.ts — the unified hybrid search engine (Phase 1+2 of the search overhaul).
 *
 * One entry point (`runSearch`) fans out three legs in parallel and fuses them:
 *   1. lexical  — search_all RPC (trigram/prefix over every entity type, Tier-2 included)
 *   2. semantic — OpenAI text-embedding-3-small query vector → search_semantic RPC
 *                 (pgvector over 27k published take rationales, tropes, film taste
 *                 vectors, director embeddings, theory canon, archetypes).
 *                 Times out gracefully → lexical-only.
 *   3. local    — in-memory match over Atlas cities/countries (lib/atlas_cities.json)
 *                 and the genre vocabulary; zero DB cost.
 * Fusion is reciprocal-rank (RRF, k=60) keyed by kind:slug, same as ask_retrieve.
 *
 * Used by BOTH the /search page (SSR) and /api/search (typeahead/palette),
 * so every search surface sees identical results.
 */
import { createClient } from "@supabase/supabase-js";
import { nodeHref } from "@/lib/catalog";
import { slugifyGenre } from "@/lib/related";
import type { SearchHit, SearchKind } from "@/lib/search-shared";
import atlas from "@/lib/atlas_cities.json";

export type { SearchHit, SearchKind } from "@/lib/search-shared";
export { KIND_LABEL, tmdbUrl } from "@/lib/search-shared";

export interface SearchResult {
  q: string;
  /** true when the meaning (embedding) leg contributed */
  semantic: boolean;
  hits: SearchHit[];
  took: number;
}

const EMBED_MODEL = "text-embedding-3-small";
const RRF_K = 60;

interface RpcRow {
  kind: string; slug: string; film_slug: string | null; title: string; sub: string;
  poster: string | null; year: number | null; score: number; is_catalog: boolean;
}

export function hrefOf(kind: SearchKind, slug: string, filmSlug?: string | null): string {
  switch (kind) {
    case "film": return `/film/${slug}`;
    case "director": return `/director/${slug}`;
    case "trope": return `/trope/${slug}`;
    case "reading":
    case "figure": return `/film/${filmSlug}/figure/${slug}`;
    case "essay": return `/film/${filmSlug}/${slug}`; // slug carries the desk key (decoder, debates…)
    case "now": return `/now/${slug}`;
    case "theorist": return `/theorist/${slug}`;
    case "idea": return `/concept/${slug}`;
    case "tradition": return `/tradition/${slug}`;
    case "lineage": return `/lineage/${slug}`;
    case "movement": return `/movements/${slug}`;
    case "archetype": return nodeHref(filmSlug ?? "", slug); // film_slug carries the taxonomy kind
    case "country": return `/atlas/${slug}`;
    case "city": return `/atlas/${filmSlug}/${slug}`; // film_slug carries the country slug
    case "genre": return `/genre/${slug}`;
    case "tv": return `/tv/${slug}`;
    case "tv_list": return `/tv/list/${slug}`;
  }
}

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// 1200ms cap: p95 for a short query embed from hnd1 is ~300ms; a slow OpenAI
// call must degrade to lexical-only rather than hold the whole page hostage.
async function embedQuery(q: string, timeoutMs = 1200): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: q }),
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const d = await r.json();
    return (d?.data?.[0]?.embedding as number[]) ?? null;
  } catch {
    return null; // timeout / network — degrade to lexical-only
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------- local leg */

interface AtlasCity {
  slug: string; name: string; country: string; countrySlug: string;
  terms?: string[]; films?: number; pins?: number; scale?: string;
}
const CITIES: AtlasCity[] = (atlas as { cities: AtlasCity[] }).cities ?? [];
const COUNTRIES: { slug: string; name: string; films: number }[] = (() => {
  const m = new Map<string, { slug: string; name: string; films: number }>();
  for (const c of CITIES) {
    const cur = m.get(c.countrySlug) ?? { slug: c.countrySlug, name: c.country, films: 0 };
    cur.films += c.films ?? 0;
    m.set(c.countrySlug, cur);
  }
  return [...m.values()];
})();
const GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama",
  "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance",
  "Science Fiction", "Thriller", "TV Movie", "War", "Western",
];

function textScore(hay: string, needle: string): number {
  const h = hay.toLowerCase();
  if (h === needle) return 1;
  if (h.startsWith(needle)) return 0.9;
  if (h.includes(needle)) return 0.7;
  return 0;
}

function localHits(q: string): RpcRow[] {
  const n = q.trim().toLowerCase();
  if (n.length < 2) return [];
  const out: RpcRow[] = [];
  for (const c of CITIES) {
    const s = Math.max(textScore(c.name, n), ...(c.terms ?? []).map((t) => 0.95 * textScore(t, n)));
    if (s > 0.6) {
      out.push({
        kind: "city", slug: c.slug, film_slug: c.countrySlug, title: c.name,
        sub: `${c.country} · ${c.films ?? 0} films shot here`, poster: null, year: null,
        score: s, is_catalog: false,
      });
    }
  }
  for (const c of COUNTRIES) {
    const s = textScore(c.name, n);
    if (s > 0.6) {
      out.push({
        kind: "country", slug: c.slug, film_slug: null, title: c.name,
        sub: `Atlas · ${c.films} filming locations`, poster: null, year: null,
        score: s, is_catalog: false,
      });
    }
  }
  for (const g of GENRES) {
    const s = textScore(g, n);
    if (s > 0.6) {
      out.push({
        kind: "genre", slug: slugifyGenre(g), film_slug: null, title: g,
        sub: "genre", poster: null, year: null, score: s, is_catalog: false,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

/* ------------------------------------------------------------------ fusion */

const keyOf = (r: RpcRow) => `${r.kind}:${r.slug}:${r.film_slug ?? ""}`;

function fuse(lex: RpcRow[], sem: RpcRow[], limit: number): SearchHit[] {
  const acc = new Map<string, { row: RpcRow; rrf: number; inLex: boolean; inSem: boolean; sem?: number }>();
  lex.forEach((row, i) => {
    const k = keyOf(row);
    const cur = acc.get(k) ?? { row, rrf: 0, inLex: false, inSem: false };
    // Navigational bonus: an exact/prefix title match must beat items that
    // merely appear in both legs (pure RRF ranks a double-appearance ~0.031
    // above an exact match's single 1/61 ≈ 0.016 — wrong for "parasite").
    const nav = row.score >= 0.95 ? 0.06 : row.score >= 0.8 ? 0.03 : row.score >= 0.7 ? 0.015 : 0;
    cur.rrf += 1 / (RRF_K + i + 1) + nav;
    cur.inLex = true;
    acc.set(k, cur);
  });
  sem.forEach((row, i) => {
    const k = keyOf(row);
    const cur = acc.get(k) ?? { row, rrf: 0, inLex: false, inSem: false };
    cur.rrf += 1 / (RRF_K + i + 1);
    cur.inSem = true;
    cur.sem = row.score; // raw cosine similarity — surfaced as a trust signal ("≈ 72%")
    // prefer the lexical row's fields (it has exact sub/poster too) but keep either
    acc.set(k, cur);
  });
  return [...acc.values()]
    .sort((a, b) => b.rrf - a.rrf || b.row.score - a.row.score)
    .slice(0, limit)
    .map(({ row, rrf, inLex, inSem, sem: semScore }) => ({
      kind: row.kind as SearchKind,
      slug: row.slug,
      film_slug: row.film_slug,
      title: row.title,
      sub: row.sub,
      poster: row.poster,
      year: row.year,
      score: rrf,
      is_catalog: row.is_catalog === true,
      match: inLex && inSem ? "both" : inSem ? "meaning" : "text",
      sem: semScore,
      href: hrefOf(row.kind as SearchKind, row.slug, row.film_slug),
    }));
}

/* ------------------------------------------------------------------- cache */

const cache = new Map<string, { data: SearchResult; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;
const CACHE_MAX = 500;

/* -------------------------------------------------------------------- main */

export interface SearchOptions {
  limit?: number;
  /** skip the embedding leg (typeahead keystrokes want lexical speed) */
  semantic?: boolean;
  /** restrict to these kinds after fusion */
  kinds?: SearchKind[];
}

// Adaptive semantic floors (measured 2026-07-06 against EMBED_MODEL above):
// English concept queries land at cosine ~0.55+, cross-lingual (Korean)
// concept queries at ~0.28-0.30, noise at ≤0.31. A third, permissive floor
// (0.15) lives in search_semantic itself (supabase/migrations/0040). If the
// embedding model ever changes, re-measure all three.
const SEM_FLOOR_STRICT = 0.35;   // when real lexical results exist
const SEM_FLOOR_FALLBACK = 0.27; // no lexical results — semantic is the only path
const FUSE_MAX = 120; // fused pool size cached per query; callers slice below

export async function runSearch(rawQ: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const q = rawQ.trim().replace(/\s+/g, " ").slice(0, 200);
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), FUSE_MAX);
  const wantSemantic = opts.semantic !== false;
  const t0 = Date.now();

  if (q.length < 2) return { q, semantic: false, hits: [], took: 0 };

  // Cache the FULL fused pool keyed by query alone, so the nav typeahead
  // (limit 9), the palette (10), and the /search page (60) all share one
  // embedding + RPC round for the same query; kinds/limit shaping is per-call.
  const cacheKey = `${q.toLowerCase()}|${wantSemantic ? 1 : 0}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return shape(hit.data, limit, opts.kinds);
  }

  const sb = db();
  const [lexRes, essRes, semRes] = await Promise.all([
    sb.rpc("search_all", { p_q: q, p_limit: 80 }),
    // Desk essays by title OR the theorist/concept they discuss (search_essays,
    // migration 0054) — a separate lexical RPC so search_all stays untouched.
    sb.rpc("search_essays", { p_q: q, p_limit: 20 }),
    wantSemantic
      ? embedQuery(q).then((vec) =>
          vec ? sb.rpc("search_semantic", { p_qvec: `[${vec.join(",")}]`, p_limit: 40 }) : null,
        )
      : Promise.resolve(null),
  ]);

  // Gate the semantic floor on search_all rows only — essays and local city/genre
  // matches must not count as "lexical results", or a query like "몸의 공포" that
  // happens to graze one would lose its cross-lingual fallback.
  const lexRpc: RpcRow[] = (lexRes.data as RpcRow[]) ?? [];
  const essRpc: RpcRow[] = (essRes.data as RpcRow[]) ?? [];
  const lex: RpcRow[] = [...lexRpc, ...essRpc, ...localHits(q)].sort((a, b) => b.score - a.score);
  const semRaw: RpcRow[] = ((semRes?.data as RpcRow[]) ?? []);
  const sem: RpcRow[] = semRaw.filter(
    (r) => r.score >= (lexRpc.length >= 3 ? SEM_FLOOR_STRICT : SEM_FLOOR_FALLBACK),
  );

  const result: SearchResult = {
    q,
    semantic: sem.length > 0,
    hits: fuse(lex, sem, FUSE_MAX),
    took: Date.now() - t0,
  };

  if (!cache.has(cacheKey) && cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, { data: result, ts: Date.now() });
  return shape(result, limit, opts.kinds);
}

/** kinds filter FIRST, then limit — so a kinds-restricted caller (e.g. the map)
 *  still gets its full quota even when other kinds dominate the fused top. */
function shape(r: SearchResult, limit: number, kinds?: SearchKind[]): SearchResult {
  const set = kinds && kinds.length ? new Set(kinds) : null;
  const hits = (set ? r.hits.filter((h) => set.has(h.kind)) : r.hits).slice(0, limit);
  return { ...r, hits };
}
