# ASK v2 — retrieval / generation logic (W2 · W3 · W4)

Additive, behind a separate route. The live **v1** route
(`app/api/ask/route.ts`) is the production default and is **untouched**. v2 lives
at **`app/api/ask/v2/route.ts`** and returns the **same JSON shape**
(`{ answer, citations, readings, meta }`), so the frontend can switch by URL only.

## Pipeline

```
POST /api/ask/v2  { q }
  → analyzeQuery(q)            (W2) intent + lang + English ftsQuery + expansions
  → embed(q)                   text-embedding-3-small, 1536  (vector axis = ORIGINAL q)
  → ask_retrieve(p_k = 60)     RRF fusion  (FTS axis = English-normalized ftsQuery)
  → rerank(...)                (W3) vendor adapter if keyed, else FallbackReranker
  → diversify(..., {intent})   (W3) intent-driven per-film cap + figure/floor/backfill
  → assemble numbered context
  → generate (ASK_MODEL)       (W4) SYS_V2 grounding prompt; USED: line stripped
```

Unchanged from v1 and **not** touched here: embedding model/dimension, every
vector index, and the `ask_retrieve` RPC (stays 1536).

## Files

| File | Role |
|---|---|
| `queryUnderstanding.ts` | `analyzeQuery(q)` → `{ intent, lang, ftsQuery, expansions }`. One cheap `gpt-4o-mini` JSON-mode call with a deterministic heuristic fallback. |
| `rerank.ts` | `Reranker` interface; `CohereReranker` / `VoyageReranker` (key-gated) + `FallbackReranker` (no key). `rerank()` picks the provider via `RERANK_PROVIDER`. Returns rows with `rerankScore`. |
| `diversify.ts` | Intent-driven diversity: broad → `MAX_PER_FILM = 2`; specific-film → relax to ~5 (depth). Always one take per figure; relevance floor; backfill if too few. |
| `prompt.ts` | `SYS_V2` grounding system prompt + an inert quotation-rules placeholder block for future external sources (W8). |

## How to enable / upgrade

- **Use it:** call `POST /api/ask/v2` with `{ "q": "..." }` (same payload as v1).
- **Upgrade reranker:** set `RERANK_PROVIDER=cohere` (or `voyage`) **and** the
  matching key. Without a key it transparently degrades to the fallback.
- **Upgrade model:** set `ASK_MODEL` to a frontier model.

## Environment variables

| Var | Required? | Default | Effect |
|---|---|---|---|
| `OPENAI_API_KEY` | **Required** | — | Embeddings + generation + query-analysis call. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Required** | — | `ask_retrieve` RPC. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Required** | — | `ask_retrieve` RPC. |
| `ASK_MODEL` | Optional | `gpt-4o-mini` | Answer-generation model (also used by v1). |
| `RERANK_PROVIDER` | Optional | `fallback` | `fallback` \| `cohere` \| `voyage`. |
| `COHERE_API_KEY` | Optional | — | Activates `CohereReranker` (needed when `RERANK_PROVIDER=cohere`). |
| `COHERE_RERANK_MODEL` | Optional | `rerank-english-v3.0` | Cohere model override. |
| `VOYAGE_API_KEY` | Optional | — | Activates `VoyageReranker` (needed when `RERANK_PROVIDER=voyage`). |
| `VOYAGE_RERANK_MODEL` | Optional | `rerank-2` | Voyage model override. |

If a vendor is selected but its key is missing — or the vendor call fails — the
reranker degrades to `FallbackReranker` so the route never breaks.

## Deferred (user decisions — see plan §7)

- **Vendor reranker choice** (Cohere vs Voyage vs self-hosted). Fallback works today.
- **Generation model A/B** (`gpt-4o-mini` → frontier) — decide via the W1 eval harness.
