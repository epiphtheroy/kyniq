# MetaTake — "NEXT" Recommendation Graph: Design, Costs & Decisions

*Prepared 2026-06-24. Scope: turn the Trust Mediator prompt into a batch pipeline that fills a **NEXT** tab on every film's detail page, and lays the groundwork for a future **"Recommended by"** (inbound) tab.*

---

## 1. The core idea, restated as a graph

Each film, run through the prompt, "fires 9 shots": 3 *cinematic genealogy* + 3 *same director* + 3 *same space-time*. Model it as a **directed graph**:

- **Node** = a film (with a canonical ID).
- **Edge** = "Film A → recommends → Film B", carrying `category`, `reason` (the one-sentence text), `confidence`, and `prompt_version`.
- **NEXT tab** on film A = A's **outbound** edges.
- **"Recommended by" tab** on film B = B's **inbound** edges. This is simply the transpose of the edge table — **no extra model calls, no extra cost**. Build the edge list once with both endpoints resolved to IDs and you get both tabs for free.

With ~2,000 films you get up to ~18,000 outbound edges (fewer where fallbacks return <3). The whole graph is small and cheap to store and query.

---

## 2. The decision that matters most: where do recommended films come from?

The model can recommend *any* film in the world, but your catalog is only ~2,000. That gap forces the central design choice.

**Option A — Free recall (current v4 behavior).** Ask for the best films regardless of catalog. Pro: highest editorial quality and serendipity. Con: a large share of edges point *outside* your app, so the NEXT tab often shows films the user can't click into; internal graph is sparse; higher hallucination on obscure titles.

**Option B — Catalog-grounded (v5).** Inject the 2,000-title catalog into the prompt and tell the model to prefer in-catalog films, allowing at most one out-of-catalog "discovery" pick per category. Pro: maximizes clickable internal links, sharply reduces hallucination (the model selects from a real list rather than recalling from memory), and makes the "Recommended by" tab dense and meaningful. Con: occasionally the *truly* best genealogical match isn't in your catalog and gets demoted to the single discovery slot.

**Recommendation: Option B (hybrid).** Prefer in-catalog, cap external picks at 1 per category, and *still record* the external picks (see §4) — you keep most of the discovery value while keeping users in the app. As §5 shows, with prompt caching this costs about the same as free recall, so the choice is purely about product behavior, not money.

---

## 3. Resolving titles to IDs (the make-or-break step)

The model returns *title + year + director + country*. Before anything is stored, each recommendation must be **resolved to a canonical ID** — otherwise you cannot match it to your catalog, dedupe remakes/same-title films, or build inbound edges.

Recommended approach:
1. Give every catalog film a stable external ID — **TMDb ID** (free API) or IMDb ID. The 2,000 films should already carry one.
2. After generation, resolve each recommended film by querying TMDb with title + year, then confirming director. Match on the ID, not the raw string.
3. `in_catalog = (resolved_id ∈ catalog_ids)`. Internal → link the edge to your film page. External → store as a list-only node (§4).
4. If grounding (Option B), the model already returns `catalog_id` for in-catalog picks, so resolution is only needed for the external ones — cheaper and safer.

A recommendation that can't be resolved to a real film should be **dropped or flagged**, not displayed. This, plus the `confidence` field, is your main defense against the one guaranteed failure mode at scale: confident hallucination of films that don't exist.

---

## 4. Films not in the catalog — your own instinct is right, with one upgrade

You said these can be listed without a link. Agreed — but **still give them a canonical ID and store them as nodes** (`in_catalog: false`), rather than treating them as free text. Two payoffs:

- **The inbound graph collapses correctly.** If 30 different films all recommend the same external title, they should point to *one* external node, not 30 strings. That node's inbound count is real signal.
- **It becomes an acquisition/curation queue.** "External films most recommended by our catalog" is a ranked list of exactly what to license/add next. When you later add one, it **promotes** from external to internal and instantly inherits all its inbound edges — the "Recommended by" tab fills itself.

So: external films are displayed as plain text (no link), but stored as first-class, ID-keyed nodes.

---

## 5. Cost — it is cheap; caching only matters in one scenario

Current list prices (June 2026): **Opus 4.8 $5/$25**, **Sonnet 4.6 $3/$15**, **Haiku 4.5 $1/$5** per million input/output tokens. **Batch API = −50% on both.** **Prompt caching: cache reads = 0.10× input (−90%); writes = 1.25× (5-min) or 2.0× (1-hour). Batch and caching discounts stack.**

Assumptions per film: ~1,800 input tokens (system prompt) + ~800 output tokens (JSON, 9 reasons, English only). 2,000 films → ~3.7M input + ~1.6M output.

**Free-recall (Option A) — full 2,000-film pass:**

| Model | No batch | Batch (−50%) |
|---|---|---|
| Opus 4.8 | ~$58 | ~$29 |
| Sonnet 4.6 | ~$35 | ~$18 |
| Haiku 4.5 | ~$12 | ~$6 |

Here the system prompt is small (~1,800 tokens) and **output dominates the bill**. Caching only discounts input, so it would save a few dollars on a ~$18 job — **not worth the engineering**. Batch's 50% is the real lever. (Note: Haiku's cache minimum is 2,048 tokens, so this prompt wouldn't even qualify.)

**Grounded (Option B) — catalog (~24k tokens) injected into every call:**

| Variant (Sonnet 4.6, batch) | Cost |
|---|---|
| Grounded, **no caching** | ~$90 (you re-bill the 24k catalog 2,000 times) |
| Grounded, **catalog cached** | ~$20 |

This is the one scenario where caching is essential: the large static catalog read at the cache rate turns a ~$90 job into ~$20. **So: if you ground (recommended), cache the catalog + system prompt as one prefix and use a 1-hour TTL so the whole batch lands inside the window.**

**Bottom line:** the recommended setup — **Sonnet 4.6 + Batch + grounded + caching ≈ $20** for the entire graph, and roughly the same as ungrounded. Cost is not a constraint at 2,000 films; spend the attention on accuracy, not on saving dollars. Re-runs (prompt changes, catalog growth) are incremental and even cheaper.

---

## 6. Model choice — driven by accuracy, not price

Because the graph's value collapses if films are wrong, pick the model by hallucination resistance:

- **Free recall →** use **Sonnet 4.6** at minimum (Opus 4.8 if you want the sharpest genealogy judgment for ~$11 more). Haiku will invent too many obscure titles.
- **Grounded →** the model mostly *selects* from a supplied list, so **Haiku 4.5 becomes viable** and Sonnet is comfortably safe. Grounding is what lets you go cheap *and* accurate.

Run at **low temperature** for consistency across the corpus.

---

## 7. Is the prompt itself appropriate?

Yes, with the v5 adjustments. The editorial logic (trust anchor + category-matched reasoning) is sound and the iterated v4 reads well. Three changes make it pipeline-ready (all in `Trust Mediator (EN v5 - batch graph).md`): **mandatory JSON**, **catalog grounding fields** (`in_catalog`, `catalog_id`), and **English-only output** (translate downstream — running Korean in the same call would roughly double output cost; do it on-demand or as a cheap Haiku second pass). The `confidence` field is retained as the downstream hallucination filter. The prompt is **not** over-engineered or too expensive — at ~1,800 tokens it's lean; the only token risk is the optional catalog block, which caching neutralizes.

---

## 8. Open decisions for you

1. **Grounded vs free recall** (§2) — recommend grounded/hybrid. *Your call on product feel.*
2. **External-node policy** (§4) — confirm storing external films as ID-keyed, list-only nodes (recommended) vs raw text.
3. **Canonical ID source** — TMDb (free, rich) vs IMDb. Needed before resolution.
4. **Confidence threshold** — e.g. drop edges `< 0.6`, or show but flag. Tune on a sample.
5. **Translation** — on-demand per view, or pre-translate the stored reasons in a cheap batch? (Cost is tiny either way.)
6. **Graph density** — fire each film once, or 2–3× and union for a richer graph? (Cost is low enough to allow this; needs dedup.)
7. **Versioning & re-runs** — store `prompt_version` on every edge so you can re-generate cleanly when the prompt changes (you've already gone v2→v5) or when the catalog grows.

---

## 9. Suggested build order

1. Add/confirm a canonical ID (TMDb) on all ~2,000 films.
2. Freeze prompt v5; decide grounded vs free recall.
3. Run a **50-film pilot batch**; eyeball reasons, measure hallucination rate and in-catalog hit rate, tune `confidence` threshold.
4. Build the resolver (TMDb match → in_catalog check) and the edge table (with reverse index).
5. Run the full 2,000-film batch; load NEXT (outbound) and "Recommended by" (inbound) from the same edges.
6. Generate the "external films most recommended" report as your acquisition queue.
