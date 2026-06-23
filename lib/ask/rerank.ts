/**
 * ASK v2 · W3 — Reranker
 *
 * Re-orders the RRF-fused candidate rows by reading question + document
 * TOGETHER (a cross-encoder's job). This is the single biggest quality lever
 * available in the logic lane.
 *
 * Vendor independence is a HARD requirement: this must work today with NO new
 * key. We expose a `Reranker` interface and three implementations:
 *   - `CohereReranker` — active only if COHERE_API_KEY is set.
 *   - `VoyageReranker` — active only if VOYAGE_API_KEY is set.
 *   - `FallbackReranker` — no key; a transparent blend of the existing RRF
 *     score, lexical overlap (query↔rationale), and a small length/diversity
 *     signal, plus a relevance floor that drops clearly-irrelevant rows.
 *
 * Provider is chosen by `RERANK_PROVIDER` (default "fallback"). If a vendor is
 * selected but its key is missing — or the vendor call fails — we degrade to
 * the fallback so the route never breaks.
 *
 * Every returned row carries a `rerankScore` in [0,1] (or vendor-native scale,
 * normalized) for transparency/inspection.
 */

/** The candidate row shape returned by `ask_retrieve` (kept loose on purpose). */
export interface RerankRow {
  rank: number;
  take_id: string;
  rationale: string;
  register: string | null;
  theorist: string | null;
  film_title: string;
  film_slug: string;
  figure_label: string;
  figure_slug: string;
  meta_title: string | null;
  meta_slug: string | null;
  rrf: number;
  rerankScore?: number;
}

export interface RerankOptions {
  /** Optional query expansions to fold into the lexical-overlap signal. */
  expansions?: string[];
  /** Drop rows whose final score is below this floor. Default 0 (keep all). */
  floor?: number;
  /** Cap the number of rows returned (after sorting). Default: all. */
  topN?: number;
}

export interface Reranker {
  readonly name: string;
  /** Returns true if this reranker can run in the current environment. */
  isAvailable(): boolean;
  /** Re-rank candidates for `query`, returning rows with `rerankScore` set. */
  rerank(
    query: string,
    rows: RerankRow[],
    opts?: RerankOptions
  ): Promise<RerankRow[]>;
}

// ── Lexical helpers (shared by the fallback + floor) ──────────────────

const STOP = new Set([
  "the","a","an","of","and","or","to","in","on","is","are","was","were","be",
  "as","at","by","for","from","how","what","does","do","did","that","this",
  "with","it","its","their","they","film","films","cinema","movie","movies",
]);

function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/** Jaccard-ish overlap of query terms found in the document. 0..1. */
function lexicalOverlap(queryTerms: Set<string>, doc: string): number {
  if (queryTerms.size === 0) return 0;
  const docTerms = new Set(tokens(doc));
  let hit = 0;
  for (const t of queryTerms) if (docTerms.has(t)) hit++;
  return hit / queryTerms.size;
}

/** Min-max normalize a numeric field across rows into [0,1]. */
function normalized(rows: RerankRow[], pick: (r: RerankRow) => number): number[] {
  const vals = rows.map(pick);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min;
  return vals.map((v) => (span > 1e-9 ? (v - min) / span : 0.5));
}

// ── Fallback reranker (no key) ────────────────────────────────────────

export class FallbackReranker implements Reranker {
  readonly name = "fallback";
  isAvailable(): boolean {
    return true;
  }

  async rerank(
    query: string,
    rows: RerankRow[],
    opts: RerankOptions = {}
  ): Promise<RerankRow[]> {
    if (rows.length === 0) return rows;

    const qTerms = new Set([
      ...tokens(query),
      ...(opts.expansions ?? []).flatMap((e) => tokens(e)),
    ]);

    const rrfNorm = normalized(rows, (r) => r.rrf ?? 0);

    // Light length signal: very short rationales carry less evidence; very long
    // ones aren't penalized. Saturates quickly so it only nudges ordering.
    const lenSignal = rows.map((r) => {
      const n = tokens(r.rationale).length;
      return Math.min(1, n / 24); // ~24 content words ≈ "enough"
    });

    const scored = rows.map((r, i) => {
      const overlap = lexicalOverlap(qTerms, r.rationale);
      // Transparent blend. RRF (retrieval consensus) dominates; lexical overlap
      // is the cross-reading signal; length is a small tie-breaker.
      const score =
        0.6 * rrfNorm[i] + 0.32 * overlap + 0.08 * lenSignal[i];
      return { ...r, rerankScore: score };
    });

    scored.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));

    // Relevance floor: drop rows with essentially no query overlap AND weak RRF
    // — these are "clearly irrelevant". The floor compares against the blended
    // score; a conservative default keeps recall high.
    const floor = opts.floor ?? 0.08;
    let kept = scored.filter((r) => (r.rerankScore ?? 0) >= floor);
    // Never starve the model: if the floor is too aggressive, keep the top few.
    if (kept.length < Math.min(8, scored.length)) {
      kept = scored.slice(0, Math.min(8, scored.length));
    }

    return typeof opts.topN === "number" ? kept.slice(0, opts.topN) : kept;
  }
}

// ── Vendor adapters (key-gated; degrade to fallback when absent) ──────

const fallback = new FallbackReranker();

/**
 * Cohere Rerank adapter. Active only when COHERE_API_KEY is present.
 * Endpoint + model are overridable via env for future flexibility.
 */
export class CohereReranker implements Reranker {
  readonly name = "cohere";
  private key = process.env.COHERE_API_KEY;
  private model = process.env.COHERE_RERANK_MODEL || "rerank-english-v3.0";

  isAvailable(): boolean {
    return Boolean(this.key);
  }

  async rerank(
    query: string,
    rows: RerankRow[],
    opts: RerankOptions = {}
  ): Promise<RerankRow[]> {
    if (!this.isAvailable() || rows.length === 0) {
      return fallback.rerank(query, rows, opts);
    }
    try {
      const documents = rows.map((r) => r.rationale ?? "");
      const res = await fetch("https://api.cohere.com/v2/rerank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.key}`,
        },
        body: JSON.stringify({
          model: this.model,
          query,
          documents,
          top_n: opts.topN ?? rows.length,
        }),
      });
      if (!res.ok) throw new Error(`cohere rerank ${res.status}`);
      const data = (await res.json()) as {
        results?: { index: number; relevance_score: number }[];
      };
      const results = data.results ?? [];
      const ranked: RerankRow[] = results.map((m) => ({
        ...rows[m.index],
        rerankScore: m.relevance_score, // Cohere returns 0..1 already
      }));
      const floor = opts.floor ?? 0.05;
      let kept = ranked.filter((r) => (r.rerankScore ?? 0) >= floor);
      if (kept.length < Math.min(8, ranked.length)) {
        kept = ranked.slice(0, Math.min(8, ranked.length));
      }
      return kept;
    } catch {
      return fallback.rerank(query, rows, opts);
    }
  }
}

/**
 * Voyage Rerank adapter. Active only when VOYAGE_API_KEY is present.
 */
export class VoyageReranker implements Reranker {
  readonly name = "voyage";
  private key = process.env.VOYAGE_API_KEY;
  private model = process.env.VOYAGE_RERANK_MODEL || "rerank-2";

  isAvailable(): boolean {
    return Boolean(this.key);
  }

  async rerank(
    query: string,
    rows: RerankRow[],
    opts: RerankOptions = {}
  ): Promise<RerankRow[]> {
    if (!this.isAvailable() || rows.length === 0) {
      return fallback.rerank(query, rows, opts);
    }
    try {
      const documents = rows.map((r) => r.rationale ?? "");
      const res = await fetch("https://api.voyageai.com/v1/rerank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.key}`,
        },
        body: JSON.stringify({
          model: this.model,
          query,
          documents,
          top_k: opts.topN ?? rows.length,
        }),
      });
      if (!res.ok) throw new Error(`voyage rerank ${res.status}`);
      const data = (await res.json()) as {
        data?: { index: number; relevance_score: number }[];
      };
      const results = data.data ?? [];
      const ranked: RerankRow[] = results.map((m) => ({
        ...rows[m.index],
        rerankScore: m.relevance_score, // Voyage returns 0..1
      }));
      const floor = opts.floor ?? 0.05;
      let kept = ranked.filter((r) => (r.rerankScore ?? 0) >= floor);
      if (kept.length < Math.min(8, ranked.length)) {
        kept = ranked.slice(0, Math.min(8, ranked.length));
      }
      return kept;
    } catch {
      return fallback.rerank(query, rows, opts);
    }
  }
}

/**
 * Resolve the active reranker from `RERANK_PROVIDER` (default "fallback").
 * If the requested vendor's key is missing, falls back transparently.
 */
export function getReranker(): Reranker {
  const choice = (process.env.RERANK_PROVIDER || "fallback").toLowerCase();
  if (choice === "cohere") {
    const r = new CohereReranker();
    return r.isAvailable() ? r : fallback;
  }
  if (choice === "voyage") {
    const r = new VoyageReranker();
    return r.isAvailable() ? r : fallback;
  }
  return fallback;
}

/**
 * Convenience entry point: pick the configured reranker and run it.
 * Always resolves (vendor failures degrade to the fallback internally).
 */
export async function rerank(
  query: string,
  rows: RerankRow[],
  opts?: RerankOptions
): Promise<RerankRow[]> {
  return getReranker().rerank(query, rows, opts);
}
