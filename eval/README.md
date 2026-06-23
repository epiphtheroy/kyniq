# Metatake ASK — Evaluation Harness (W1)

The measurement gate for the ASK feature (grounded RAG over Metatake's film close-readings).
**Every quality change in lanes W2–W8 must pass through this harness** — no merge without an eval delta.

This directory is **additive and read-only against the DB**: the harness only calls the
`ask_retrieve` RPC and never writes. It does not touch `worker/`, `data/`, `supabase/migrations/`,
or any app code.

---

## ⚠️ Read this first: baselines are PROVISIONAL

The corpus is **currently moving** — a separate agent is importing ~1500 new films and
embedding the 8,293 takes (32%) that are not yet embedded. While that is in flight:

- Search `recall` shifts as new evidence lands, so **absolute scores are not comparable run-to-run.**
- The `IVFFlat` index on `takes` gives degraded recall on new/full data during import.
- **Do NOT freeze a comparison baseline until the import + embedding stabilizes and a DB snapshot is taken**
  (Gate 1 in the master plan). Until then, treat numbers as directional smoke signals only.
- `expected.films` / `expected.themes` in `gold-set.json` are **approximate relevance hints**, not a
  strict labeled relevance set. They power a coarse "hit proxy," not `nDCG`. Refine them after Gate 1.

---

## Files

| File | What it is |
|---|---|
| `gold-set.json` | 76 questions, balanced across 4 types (see below). Hand-authored, grounded in a read-only sample of the live corpus. |
| `run.mjs` | Node ESM harness. Loads `.env.local`, embeds each question, calls `ask_retrieve`, ports the live `diversify()` rerank-lite, computes metrics, prints a scorecard, writes `report.json`. |
| `report.json` | Last run's full per-question results + aggregates (git-ignored noise — regenerated each run). |

## Gold set composition (`gold-set.json`)

76 items, schema `{ id, question, lang, type, expected: { films?, themes? }, should_refuse, notes }`:

| type | n | purpose |
|---|---|---|
| `broad-concept` | 28 | "How does cinema portray X?" — tests recall across many films on a theme. |
| `specific-film` | 18 | "What does the ending of X mean?" — tests that the right film dominates. |
| `multilingual` | 18 | Korean↔English **same-intent pairs** (+ a French and Spanish probe) — tests cross-lingual retrieval. The live pipeline's FTS axis is `'english'`-only, so the vector axis carries non-English queries; this set surfaces that gap (the W2 lane fixes it). |
| `out-of-corpus` | 12 | Questions the system **should refuse** (TV, games, music, off-domain, or films likely absent from the arthouse-leaning corpus). `should_refuse: true`. |

`expected` values were grounded against a read-only sample of `kyniq` — e.g. surveillance →
*The Lives of Others* (confirmed present), grief → *Amour / Manchester by the Sea / Three Colors: Blue*,
color red → *Three Colors: Red / Raise the Red Lantern*, mirrors → *Black Swan / Mulholland Drive / Perfect Blue*.

---

## How to run

From the repo root (needs `.env.local` with `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`):

```bash
# Smoke test — 5 questions, retrieval only, no generation cost (recommended first run)
node eval/run.mjs --limit 5 --retrieval-only

# Full gold set, retrieval only (still no LLM generation cost)
node eval/run.mjs --retrieval-only

# Full gold set WITH generation scoring (calls gpt-4o-mini per question — costs tokens)
node eval/run.mjs

# Slice by type
node eval/run.mjs --type out-of-corpus --retrieval-only
node eval/run.mjs --type multilingual --retrieval-only
```

### Flags

| flag | default | meaning |
|---|---|---|
| `--limit N` | (all) | cap to first N items (after `--type` filter). Keep small for live runs. |
| `--retrieval-only` | off | skip the generation model call → no LLM cost. Use for smoke tests. |
| `--type <t>` | (all) | filter to one type. |
| `--gold <path>` | `eval/gold-set.json` | gold set path. |
| `--k <int>` | `40` | `ask_retrieve` candidate width (`CANDIDATES` in `route.ts`). |
| `--keep <int>` | `14` | `diversify()` KEEP target (matches `route.ts`). |
| `--out <path>` | `eval/report.json` | report output path. |
| `--concurrency <int>` | `3` | parallel questions. |

> The harness reaches the DB via the Supabase **REST** `/rest/v1/rpc/ask_retrieve` endpoint with the
> anon key (no `@supabase/supabase-js` import needed in ESM). It mirrors `app/api/ask/route.ts` exactly:
> same embed model (`text-embedding-3-small`), same `p_qvec` string format `"[...]"`, same `p_k`,
> same `diversify()` (one take per figure, ≤2 per film, keep 14, backfill if sparse), and — when
> generation is enabled — the same system prompt and `gpt-4o-mini` / temp 0.2 / 750 max-tokens contract.

---

## Metric definitions

These are W1's **provisional** proxies. They are intentionally coarse and cheap; the W2/W3/W4 lanes
will upgrade them (true `nDCG`, LLM-judge faithfulness) once the corpus is frozen.

| metric | definition |
|---|---|
| **retrieval hit@K (hit proxy)** | For a non-refusal question: did **any** `expected.films` or `expected.themes` string appear (case-insensitive, NFKC-normalized substring) in the top-K `film_title` / `rationale` / `meta_title`? Boolean per question; `hit@K` is the rate over questions that have `expected` hints. A stand-in for `recall@k` until a labeled judgment set exists. |
| **film diversity (avgFilms)** | Number of distinct films among the kept top-K. Guards against one film dominating the evidence (the `diversify()` per-film cap should keep this high). |
| **refusal correctness** | For `out-of-corpus` questions: the pipeline is correct when retrieval returns **empty** (`route.ts` then emits its canned "nothing in the corpus" refusal) OR, when generation is on, the model's answer explicitly says the corpus doesn't cover it. Reported as a rate over refusable questions. |
| **latency (p50 / p95 ms)** | Wall-clock per question: embed + `ask_retrieve` (+ generation if enabled). |
| **citation basics** (generation only) | Count of `[n]` markers, distinct citations, presence of the final `USED:` line, and **out-of-range citations** (markers pointing past the kept evidence count — a proxy for mis-attribution / citation-accuracy failures; target 0). |

The harness also records, per question: candidate count, kept count, matched films/themes, and the
top-5 retrieved film titles, all in `report.json`.

### What this harness does NOT yet measure (deferred to W2–W4, post-freeze)

- True graded relevance (`nDCG`) — needs a labeled judgment set, not the current hint proxy.
- LLM-judge **faithfulness** (every claim traceable to its cited reading) and **groundedness**
  (zero out-of-corpus facts). The current generation scoring checks citation *form*, not semantic
  correctness of attribution.
- Per-query **cost** in USD (token counts are captured; pricing is left to the caller).

---

## Notes & assumptions

- **DB is read-only.** The harness only invokes `ask_retrieve` and never mutates anything.
- The harness is a faithful re-implementation of the live `route.ts` retrieval path. If `route.ts`
  changes its `diversify()`, `CANDIDATES`, `KEEP`, or system prompt, mirror the change here so the
  eval keeps measuring production behavior.
- `report.json` is overwritten each run. Commit a copy under a dated name if you want to keep a snapshot.
- Generation scoring uses the OpenAI `chat/completions` endpoint directly (same model/params as
  `route.ts` via its `openaiAdapter`), so token usage is comparable but the cost calc lives upstream.
