/**
 * ASK · W7 — Academic "further reading" augmentation layer.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * GROUNDING-INTEGRITY INVARIANT (read before editing):
 *   The records this module returns are SCAFFOLDING — "further reading" only.
 *   They are NEVER:
 *     • injected into the LLM generation prompt or context, nor
 *     • merged into the grounded `citations` array, nor
 *     • cited with [n] in the answer.
 *   The grounded answer stays 100% corpus-only. Academic items are a SEPARATE,
 *   clearly-labeled, link-out list. See lib/sources/README.md and the master
 *   plan (W7, rule #4: "코퍼스 답변과 외부 결과는 인용 스트림을 절대 섞지 않는다").
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Sources (all free; we prefer no-key endpoints and the "polite pool"):
 *   • OpenAlex  (primary)   — no key, add `mailto` for the polite pool.
 *   • Crossref  (secondary) — no key, add `mailto`.
 *   • Semantic Scholar (s2) — opt-in, only when `S2_API_KEY` is set.
 *
 * Everything is defensive: per-request timeouts, try/catch around each source,
 * optional chaining + fallbacks on every field, and a guaranteed `[]` on any
 * failure. A network or parse error here must never break the ASK route.
 */

/** A normalized academic reference — the only shape that leaves this module. */
export interface AcademicRef {
  title: string;
  authors: string[];
  /** Publication year, or null when the source omits it. */
  year: number | null;
  /** Venue / journal / container title, or null. */
  venue: string | null;
  /** DOI (lowercased, bare — no URL prefix), or null. */
  doi: string | null;
  /** Best link-out URL (open-access PDF preferred, then DOI, then landing). */
  url: string | null;
  /** Short plain-text abstract snippet (~280 chars), or null. */
  abstractSnippet: string | null;
  /** Citation count if the source reports one, else null. */
  citationCount: number | null;
  /** Which API produced this record. */
  source: "openalex" | "crossref" | "s2";
}

export interface FurtherReadingOpts {
  /** Max records to return after dedupe + sort. Default 5. */
  limit?: number;
  /** Per-request network timeout in ms. Default 4000. */
  timeoutMs?: number;
  /**
   * Which sources to consult. Default ["openalex", "crossref"]. "s2" is only
   * actually queried when `S2_API_KEY` is present, regardless of this list.
   */
  sources?: Array<AcademicRef["source"]>;
}

const DEFAULT_LIMIT = 5;
const DEFAULT_TIMEOUT_MS = 4000;
const SNIPPET_MAX = 280;

/** Contact email for the polite pools; falls back to a placeholder. */
function mailto(): string {
  return (process.env.ACADEMIC_MAILTO || "").trim() || "wonwoo@metatake.net";
}

/** A fetch wrapper that always resolves to a parsed JSON object or null. */
async function fetchJson(
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        // A descriptive UA is good etiquette for these public APIs.
        "User-Agent": `Metatake-FurtherReading/1.0 (mailto:${mailto()})`,
        Accept: "application/json",
        ...(headers ?? {}),
      },
    });
    if (!r.ok) return null;
    return (await r.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Trim, collapse whitespace, and clip to a sentence-aware snippet. */
function snippet(text: string | null | undefined, max = SNIPPET_MAX): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  const base = lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, "");
  return `${base.trim()}…`;
}

/** Normalize a DOI to a bare, lowercased form (no scheme/host). */
function normalizeDoi(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const d = raw.trim().toLowerCase();
  if (!d) return null;
  // Strip common URL prefixes.
  const m = d.match(/(10\.\d{4,9}\/\S+)/);
  return m ? m[1].replace(/[).,;]+$/, "") : null;
}

function clampInt(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * OpenAlex — primary. Reconstructs the abstract from `abstract_inverted_index`.
 * Docs shape: results[].{ id, doi, title|display_name, publication_year,
 *   authorships[].author.display_name, primary_location.source.display_name,
 *   cited_by_count, open_access.oa_url, abstract_inverted_index }.
 * ────────────────────────────────────────────────────────────────────────── */

/** Rebuild an abstract from OpenAlex's `{word: [positions]}` inverted index. */
function reconstructAbstract(inv: unknown): string | null {
  if (!inv || typeof inv !== "object") return null;
  const entries = Object.entries(inv as Record<string, unknown>);
  if (entries.length === 0) return null;
  const slots: string[] = [];
  let maxLen = 0;
  for (const [word, positions] of entries) {
    if (!Array.isArray(positions)) continue;
    for (const p of positions) {
      if (typeof p === "number" && p >= 0) {
        slots[p] = word;
        if (p + 1 > maxLen) maxLen = p + 1;
      }
    }
  }
  if (maxLen === 0) return null;
  let out = "";
  for (let i = 0; i < maxLen; i++) out += (slots[i] ?? "") + " ";
  return out.trim() || null;
}

function parseOpenAlexWork(w: unknown): AcademicRef | null {
  if (!w || typeof w !== "object") return null;
  const o = w as Record<string, any>;
  const title = (o.title ?? o.display_name ?? "").toString().trim();
  if (!title) return null;

  const authors: string[] = Array.isArray(o.authorships)
    ? o.authorships
        .map((a: any) => a?.author?.display_name)
        .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0)
        .map((n: string) => n.trim())
    : [];

  const doi = normalizeDoi(o.doi);
  const oaUrl = typeof o.open_access?.oa_url === "string" ? o.open_access.oa_url : null;
  const landing = typeof o.primary_location?.landing_page_url === "string"
    ? o.primary_location.landing_page_url
    : null;
  const url = oaUrl || (doi ? `https://doi.org/${doi}` : null) || landing
    || (typeof o.id === "string" ? o.id : null);

  return {
    title,
    authors,
    year: clampInt(o.publication_year),
    venue:
      (typeof o.primary_location?.source?.display_name === "string"
        ? o.primary_location.source.display_name.trim()
        : null) || null,
    doi,
    url,
    abstractSnippet: snippet(reconstructAbstract(o.abstract_inverted_index)),
    citationCount: clampInt(o.cited_by_count),
    source: "openalex",
  };
}

async function fromOpenAlex(query: string, perPage: number, timeoutMs: number): Promise<AcademicRef[]> {
  const url =
    `https://api.openalex.org/works?search=${encodeURIComponent(query)}` +
    `&per_page=${perPage}&mailto=${encodeURIComponent(mailto())}`;
  const json = await fetchJson(url, timeoutMs);
  const results = (json as any)?.results;
  if (!Array.isArray(results)) return [];
  return results.map(parseOpenAlexWork).filter((r): r is AcademicRef => r !== null);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Crossref — secondary. message.items[].{ DOI, title[], author[].given/family,
 *   container-title[], published.date-parts | created, URL,
 *   is-referenced-by-count, abstract (JATS XML — strip tags). }
 * ────────────────────────────────────────────────────────────────────────── */

/** Strip JATS/HTML tags and decode a few common entities for a clean snippet. */
function stripJats(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const noTags = raw.replace(/<[^>]+>/g, " ");
  const decoded = noTags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  return decoded.trim() || null;
}

function crossrefYear(item: Record<string, any>): number | null {
  const dp =
    item?.published?.["date-parts"] ??
    item?.["published-print"]?.["date-parts"] ??
    item?.["published-online"]?.["date-parts"] ??
    item?.issued?.["date-parts"] ??
    item?.created?.["date-parts"];
  const y = Array.isArray(dp) && Array.isArray(dp[0]) ? dp[0][0] : item?.created?.["date-time"];
  if (typeof y === "number") return clampInt(y);
  if (typeof y === "string") {
    const m = y.match(/\d{4}/);
    return m ? clampInt(Number(m[0])) : null;
  }
  return null;
}

function parseCrossrefItem(item: unknown): AcademicRef | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, any>;
  const title = Array.isArray(o.title) && typeof o.title[0] === "string" ? o.title[0].trim() : "";
  if (!title) return null;

  const authors: string[] = Array.isArray(o.author)
    ? o.author
        .map((a: any) => {
          const given = typeof a?.given === "string" ? a.given.trim() : "";
          const family = typeof a?.family === "string" ? a.family.trim() : "";
          const full = `${given} ${family}`.trim();
          return full || (typeof a?.name === "string" ? a.name.trim() : "");
        })
        .filter((n: string) => n.length > 0)
    : [];

  const doi = normalizeDoi(o.DOI);
  const url = (typeof o.URL === "string" && o.URL) || (doi ? `https://doi.org/${doi}` : null);

  return {
    title,
    authors,
    year: crossrefYear(o),
    venue:
      Array.isArray(o["container-title"]) && typeof o["container-title"][0] === "string"
        ? o["container-title"][0].trim() || null
        : null,
    doi,
    url,
    abstractSnippet: snippet(stripJats(o.abstract)),
    citationCount: clampInt(o["is-referenced-by-count"]),
    source: "crossref",
  };
}

async function fromCrossref(query: string, rows: number, timeoutMs: number): Promise<AcademicRef[]> {
  const url =
    `https://api.crossref.org/works?query=${encodeURIComponent(query)}` +
    `&rows=${rows}&mailto=${encodeURIComponent(mailto())}`;
  const json = await fetchJson(url, timeoutMs);
  const items = (json as any)?.message?.items;
  if (!Array.isArray(items)) return [];
  return items.map(parseCrossrefItem).filter((r): r is AcademicRef => r !== null);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Semantic Scholar — opt-in (S2_API_KEY). data[].{ title, year, authors[].name,
 *   abstract, venue, externalIds.DOI, url, openAccessPdf.url }.
 * Heavier rate limits without a key, so we only query when the key is present.
 * ────────────────────────────────────────────────────────────────────────── */

function parseS2Paper(p: unknown): AcademicRef | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, any>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (!title) return null;

  const authors: string[] = Array.isArray(o.authors)
    ? o.authors
        .map((a: any) => (typeof a?.name === "string" ? a.name.trim() : ""))
        .filter((n: string) => n.length > 0)
    : [];

  const doi = normalizeDoi(o.externalIds?.DOI);
  const url =
    (typeof o.openAccessPdf?.url === "string" && o.openAccessPdf.url) ||
    (doi ? `https://doi.org/${doi}` : null) ||
    (typeof o.url === "string" ? o.url : null);

  return {
    title,
    authors,
    year: clampInt(o.year),
    venue: typeof o.venue === "string" ? o.venue.trim() || null : null,
    doi,
    url,
    abstractSnippet: snippet(o.abstract),
    citationCount: clampInt(o.citationCount),
    source: "s2",
  };
}

async function fromSemanticScholar(query: string, limit: number, timeoutMs: number): Promise<AcademicRef[]> {
  const key = (process.env.S2_API_KEY || "").trim();
  if (!key) return []; // opt-in only.
  const fields = "title,year,authors,abstract,venue,externalIds,url,openAccessPdf,citationCount";
  const url =
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}` +
    `&limit=${limit}&fields=${encodeURIComponent(fields)}`;
  const json = await fetchJson(url, timeoutMs, { "x-api-key": key });
  const data = (json as any)?.data;
  if (!Array.isArray(data)) return [];
  return data.map(parseS2Paper).filter((r): r is AcademicRef => r !== null);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Dedupe, rank, and the public entry point.
 * ────────────────────────────────────────────────────────────────────────── */

/** Normalize a title for fuzzy dedupe (lowercase, strip punctuation/space). */
function titleKey(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

/**
 * Dedupe by DOI first, then by normalized title. Prefer the record that
 * carries more signal (an abstract, then a higher citation count).
 */
function dedupe(refs: AcademicRef[]): AcademicRef[] {
  const byKey = new Map<string, AcademicRef>();
  for (const r of refs) {
    const key = r.doi ? `doi:${r.doi}` : `t:${titleKey(r.title)}`;
    if (!key || key === "t:") continue;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, r);
      continue;
    }
    const prevScore = (prev.abstractSnippet ? 1 : 0) * 1e9 + (prev.citationCount ?? 0);
    const curScore = (r.abstractSnippet ? 1 : 0) * 1e9 + (r.citationCount ?? 0);
    if (curScore > prevScore) byKey.set(key, r);
  }
  return [...byKey.values()];
}

/**
 * Sort heuristic: source order (OpenAlex search is already relevance-sorted) is
 * preserved as a weak tiebreak, but citation count dominates so the most-cited,
 * most-load-bearing references float up. Items with abstracts edge ahead.
 */
function rank(refs: AcademicRef[]): AcademicRef[] {
  return refs
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const ca = a.r.citationCount ?? 0;
      const cb = b.r.citationCount ?? 0;
      if (cb !== ca) return cb - ca;
      const aa = a.r.abstractSnippet ? 1 : 0;
      const ab = b.r.abstractSnippet ? 1 : 0;
      if (ab !== aa) return ab - aa;
      return a.i - b.i; // stable: keep upstream relevance order
    })
    .map((x) => x.r);
}

/**
 * Find scholarly "further reading" for a query. ALWAYS resolves; returns `[]`
 * on any failure. The caller (the ASK route) attaches this to a SEPARATE
 * `further_reading` field and NEVER feeds it into the generation prompt or the
 * grounded `citations` array.
 *
 * @param query Free-text query — pass the English-normalized `analysis.ftsQuery`
 *              (or the raw question as a fallback) from the v2 pipeline.
 */
export async function findFurtherReading(
  query: string,
  opts: FurtherReadingOpts = {},
): Promise<AcademicRef[]> {
  const q = (query ?? "").toString().trim();
  if (q.length < 3) return [];

  const limit = Math.max(1, opts.limit ?? DEFAULT_LIMIT);
  const timeoutMs = Math.max(500, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const wanted = opts.sources ?? ["openalex", "crossref"];

  // Over-fetch a little per source so dedupe/ranking has room to work.
  const perSource = limit + 3;

  const jobs: Array<Promise<AcademicRef[]>> = [];
  if (wanted.includes("openalex")) jobs.push(fromOpenAlex(q, perSource, timeoutMs));
  if (wanted.includes("crossref")) jobs.push(fromCrossref(q, perSource, timeoutMs));
  // S2 is gated by the key inside fromSemanticScholar; include it whenever the
  // caller asked for it (or always offer it — it self-disables without a key).
  if (wanted.includes("s2") || process.env.S2_API_KEY) {
    jobs.push(fromSemanticScholar(q, perSource, timeoutMs));
  }

  // allSettled: one source failing never sinks the others.
  const settled = await Promise.allSettled(jobs);
  const all: AcademicRef[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && Array.isArray(s.value)) all.push(...s.value);
  }

  if (all.length === 0) return [];
  return rank(dedupe(all)).slice(0, limit);
}
