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
import atlas from "@/lib/atlas_cities.json";

export type SearchKind =
  | "film" | "director" | "trope" | "reading" | "figure" | "theorist"
  | "idea" | "tradition" | "lineage" | "movement" | "archetype"
  | "country" | "city" | "genre";

export interface SearchHit {
  kind: SearchKind;
  slug: string;
  /** figure/reading: parent film slug · archetype: taxonomy kind · city: country slug */
  film_slug: string | null;
  title: string;
  sub: string;
  /** TMDB poster_path / profile_path (relative) — UI prefixes the image host */
  poster: string | null;
  year: number | null;
  score: number;
  is_catalog: boolean;
  match: "text" | "meaning" | "both";
  href: string;
}

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
    case "theorist": return `/theorist/${slug}`;
    case "idea": return `/idea/${slug}`;
    case "tradition": return `/tradition/${slug}`;
    case "lineage": return `/lineage/${slug}`;
    case "movement": return `/movements/${slug}`;
    case "archetype": return nodeHref(filmSlug ?? "", slug); // film_slug carries the taxonomy kind
    case "country": return `/atlas/${slug}`;
    case "city": return `/atlas/${filmSlug}/${slug}`; // film_slug carries the country slug
    case "genre": return `/genre/${slug}`;
  }
}

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function embedQuery(q: string, timeoutMs = 1500): Promise<number[] | null> {
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
const genreSlug = (g: string) => g.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

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
        kind: "genre", slug: genreSlug(g), film_slug: null, title: g,
        sub: "genre", poster: null, year: null, score: s, is_catalog: false,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

/* ------------------------------------------------------------------ fusion */

const keyOf = (r: RpcRow) => `${r.kind}:${r.slug}:${r.film_slug ?? ""}`;

function fuse(lex: RpcRow[], sem: RpcRow[], limit: number): SearchHit[] {
  const acc = new Map<string, { row: RpcRow; rrf: number; inLex: boolean; inSem: boolean }>();
  lex.forEach((row, i) => {
    const k = keyOf(row);
    const cur = acc.get(k) ?? { row, rrf: 0, inLex: false, inSem: false };
    cur.rrf += 1 / (RRF_K + i + 1);
    cur.inLex = true;
    acc.set(k, cur);
  });
  sem.forEach((row, i) => {
    const k = keyOf(row);
    const cur = acc.get(k) ?? { row, rrf: 0, inLex: false, inSem: false };
    cur.rrf += 1 / (RRF_K + i + 1);
    cur.inSem = true;
    // prefer the lexical row's fields (it has exact sub/poster too) but keep either
    acc.set(k, cur);
  });
  return [...acc.values()]
    .sort((a, b) => b.rrf - a.rrf || b.row.score - a.row.score)
    .slice(0, limit)
    .map(({ row, rrf, inLex, inSem }) => ({
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

export async function runSearch(rawQ: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const q = rawQ.trim().replace(/\s+/g, " ").slice(0, 200);
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 120);
  const wantSemantic = opts.semantic !== false;
  const t0 = Date.now();

  if (q.length < 2) return { q, semantic: false, hits: [], took: 0 };

  const cacheKey = `${q.toLowerCase()}|${limit}|${wantSemantic ? 1 : 0}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return filterKinds(hit.data, opts.kinds);
  }

  const sb = db();
  const [lexRes, semRes] = await Promise.all([
    sb.rpc("search_all", { p_q: q, p_limit: 80 }),
    wantSemantic
      ? embedQuery(q).then((vec) =>
          vec ? sb.rpc("search_semantic", { p_qvec: `[${vec.join(",")}]`, p_limit: 40 }) : null,
        )
      : Promise.resolve(null),
  ]);

  const lex: RpcRow[] = [...((lexRes.data as RpcRow[]) ?? []), ...localHits(q)]
    .sort((a, b) => b.score - a.score);
  // Adaptive semantic floor (measured 2026-07-06): English concept queries land
  // at cosine ~0.55+, cross-lingual (Korean) concept queries at ~0.28-0.30, and
  // noise at ≤0.31. With lexical results present, weak semantic rows only add
  // noise — cut at 0.35. With no lexical results they're the only path to an
  // answer — allow down to 0.27 and let the UI label them "closest by meaning".
  const semRaw: RpcRow[] = ((semRes?.data as RpcRow[]) ?? []);
  const sem: RpcRow[] = semRaw.filter((r) => r.score >= (lex.length >= 3 ? 0.35 : 0.27));

  const result: SearchResult = {
    q,
    semantic: sem.length > 0,
    hits: fuse(lex, sem, limit),
    took: Date.now() - t0,
  };

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, { data: result, ts: Date.now() });
  return filterKinds(result, opts.kinds);
}

function filterKinds(r: SearchResult, kinds?: SearchKind[]): SearchResult {
  if (!kinds || kinds.length === 0) return r;
  const set = new Set(kinds);
  return { ...r, hits: r.hits.filter((h) => set.has(h.kind)) };
}
