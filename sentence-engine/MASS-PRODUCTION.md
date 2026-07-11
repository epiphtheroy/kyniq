# Mass Production — film_sentences (SHIPPED 2026-07-11)

**454,555 entity-linked sentences across 12 patterns, 6,713/6,975 films (96%), generated in-database at $0 LLM cost.** 원우 decision: the original v1 factual template style is canonical (v2 WOW rhetoric demoted to reference); v2's *computations* survive as data — `kin`, `salience`, fanout stats — per the "버리지 말고 DB화" directive.

## What lives in the DB now (migration `0061_sentence_engine.sql`, applied 2026-07-11)

| Table | Rows | Purpose |
|---|--:|---|
| `film_sentences` | 454,555 | the sentences, every value entity-linked (see columns below) |
| `film_kinship` | 27,593 | **kin index** per affinity pair — deterministic 0–100 (`cos`·40 + `tfidf`·25 + shared-node rarity·35), replaces dead `film_affinities.score`; components stored (`cos, tfidf, shared_count, rarity_sum, year_gap, top_node_id`) |
| `sentence_node_stats` | 4,689 | catalog-wide film count per interpretation node (rarity) |
| `sentence_concept_stats` | 7,801 | film count + earliest holder per (theorist, concept) lens |

All four: RLS on + `public read` policy (anon SELECT). Writes = service-role only.

### film_sentences entity columns (why every sentence can render with live links)
`film_id`, `other_film_id` → films · `meta_take_ids uuid[]` → meta_takes (nodes/tropes) · `figure_id` → figures (has slug) · `take_id` → takes · `theorist_id` → theorists (has slug) · `location_id` → film_locations · `lineage_list_id`/`lineage_edition_id` → lineage · plus text keys `theorist_name`, `concept`, `framework`. Numbers preserved in `nums jsonb` (year_gap, shared_count, node_films, concept_films, strength, metascore, rt, top_pct, trope_films, frame_count, tier, confidence…). Ranking: `salience` (per-film ordering, indexed `(film_id, salience desc)`), `kin` on pair patterns.

## The 12 patterns (final counts)

| Pattern | n | Source | Salience rule |
|---|--:|---|---|
| A_affinity | 27,593 | film_affinities (shared≥1) | = kin |
| B_bridge | 30,441 | per (pair, node) | 100/node_films |
| C_reading | 12,348 | published theorist takes | strength×20 |
| D_award | 10,144 | film_lineage (5,784 films, Tier-2 incl.) | authority_weight + result bonus |
| E_rank | 2,175 | metascore percentile + director rank | percentile |
| F_compare | 18,334 | same-director runtime pairs | 20 flat |
| G_theorist_twin | 130,418 | takes self-join on (theorist, concept) | 100/concept_films |
| H_dense | 22,606 | pairs × ratings (rated films only) | = kin |
| I_lens_twin | 130,552 | element-level lens twins | 100/concept_films + strength×2 |
| **J_location** (new) | 24,546 | film_locations layer='filmed' (4,407 films) | tier: verified 40 / probable 28 / else 20 |
| **L_trope** (new) | 18,659 | published takes → trope_id → meta_takes.film_count | 100/trope_films + 10 |
| **M_frame** (new) | 26,739 | readings count per SM frame per film | min(n×6, 40) |

K_counterpoint was scoped but **no counterpoint table exists in the DB** (memory said 11k shipped, but no `%counter%` table) — revisit if/when it lands.

## Correctness gates baked in (do not drop on regeneration)
1. **`takes.status='published'`** everywhere takes are read — 46,503 retired takes exist and must never leak (theorist takes happen to be 100% published today; the gate is defense).
2. **Possessive rule**: titles ending in *s* get a bare apostrophe (`right(title,1)='s'` → `title||''''`). ⚠️ E_rank initially double-applied it (template had `'s` too) — fixed by passing the full possessive and keeping the template bare.
3. **H_dense gated to rated films** (`metascore IS NOT NULL AND rt_tomatometer IS NOT NULL`) — otherwise format() renders empty header slots.
4. **"top 0%"**: percentile arithmetic yields 0 for the very best film — post-fix to "top 1%".
5. **Figure labels ending in "."** produce `.’` mid-sentence in C/I/L — strip with `replace(sentence,'.’','’')` repeated until clean (labels ending "…" need 2–3 passes).
6. **D_award verbs**: won / was nominated for / is listed in / ranked #N in / else "appears in" (open result vocabulary).
7. Dedupe = unique index `(film_id, pattern, md5(sentence))`; all inserts `ON CONFLICT DO NOTHING` → **idempotent, safe to re-run**.

## Ops runbook (regeneration / new films)
Order: ① `sentence_node_stats` → ② `sentence_concept_stats` → ③ `film_kinship` (upserts) → ④ pattern inserts (idempotent). Sentences whose source rows die are auto-removed via `ON DELETE CASCADE`; text drift (title changes etc.) requires delete-by-pattern + re-insert.

**Server-load lessons (2026-07-11 run):**
- MCP `execute_sql` statement timeout ≈ 1–2 min; a timed-out *response* may still have **committed** (first 4-statement batch did) or **rolled back** (later ones did) — **always verify with a count query after any timeout.**
- Heavy self-joins (G/I ~130k rows each): materialize the membership set once into an unlogged scratch table (`_seng_m`, indexed on (theorist_name, concept)), insert in `film_id::text` hex-range buckets (`<'8'`, `'8'–'c'`, `≥'c'`), drop the scratch table after. Without materialization the same buckets time out.
- Everything else runs as single statements. `ANALYZE film_sentences` after bulk load.

The full fill SQL for all 12 patterns = this session's statements; templates identical to `Template_Sentence_Engine_Parasite_EN.md` (A–I) plus J/L/M below:
- J: `'%s (%s) was filmed at %s.'` (location names are self-sufficient, e.g. "Film i Vast studio, Trollhattan, Sweden" — do NOT append country, it duplicates)
- L: `'%s ‘%s’ carries the trope ‘%s’ — one of %s films in the catalog that stage it.'` (film_count≤1 → "the only film in the catalog that stages it")
- M: `'%s (%s) draws %s readings through the ‘%s’ frame.'` (n=1 → "one reading")

## Site-speed dividends (the reason kin/stats were persisted)
- `film_kinship (film_id, kin desc)` — instant related-films ranking without recomputing RRF; candidates for /movies-like, film-page rails.
- `sentence_node_stats` / `sentence_concept_stats` — rarity numbers precomputed for any surface ("one of 4 films…") with zero aggregate cost.
- `film_sentences (film_id, salience desc)` — one indexed read serves a film page's top-k sentences.

## Remaining
- **Render surfaces (Tier 1) — SHIPPED 2026-07-11 & verified live.** film-page "Did you know" module (`components/FilmSentences.tsx`) + SentenceTicker (home·/room) + map kin edge-weights (/map Films mode) + GraphCaptions. RPCs `film_sentences_for`/`sentences_ticker` (0062), `map_film_ego` kin (0063). Full log + deferred items: `docs/WORKORDER-sentence-surfaces.md`.
- Migrations `0061`/`0062`/`0063` mirrored to `supabase/migrations/` + committed manually (watcher does not stage supabase/).
- Tier 2 deferred: map_film_overview kin, MapExplorer captions (see workorder).
- Wire new-film ingestion to the runbook above (RUNBOOK-new-film-ingestion.md hook).
- Tier 2+ ideas parked: N_question pattern, OG hook lines, Surprise mode, TV lower-thirds, corner animations.
