# Sentence Engine — LLM-free sentence generation (SQL-only)

**What this is.** A self-contained bundle proving that Metatake can generate meaningful, publishable English sentences about any film using **sentence templates + Postgres `format()` only — zero LLM calls**. The project's purpose: make explicit, as sentences, what no one could know without querying our DB — the hidden connections between films — entirely rule-based. Cost ≈ $0, deterministic, and the sentence count grows the moment you add a rule. This is the read-layer / SEO-copy counterpart to the (paid, LLM-based) TakeScore prose.

**Status:** **MASS PRODUCTION SHIPPED (2026-07-11)** — `film_sentences` = **454,555 entity-linked sentences, 12 patterns, 6,713/6,975 films (96%)**, live in prod (migration `0061_sentence_engine.sql`). Plus the **kin index** (`film_kinship`, 27,593 pairs) and fanout stats tables. 원우 decision (2026-07-11): **the original v1 factual template style is canonical**; the v2 WOW rhetorical engine is demoted to reference, but its computations (kin, salience, rarity stats) are persisted as data. Remaining: render surface (원우 direction pending).

---

## ▶ Next agent — start here (30-second orientation)
1. **Read this file**, then **`MASS-PRODUCTION.md`** — the shipped state: tables, counts, correctness gates, ops runbook (timeout/bucket/materialize lessons), refresh procedure. `Template_Sentence_Engine_Parasite_EN.md` holds the A–I sentence templates; `WOW_Engine_v2_EN.md` is reference only (style superseded).
2. **The data is already in prod** (kyniq, `project_id = "jvgarcqrtsmgfimdcwgo"`): query `film_sentences` by `(film_id, salience desc)` — indexed. Pair patterns carry `kin`; every mentioned value has an entity column for linking.
3. **Do NOT** add any LLM step, write sentences by hand, or drop the correctness gates listed in MASS-PRODUCTION.md (published-takes gate, possessive rule, H rated-gate). Regeneration is idempotent (`ON CONFLICT DO NOTHING`).
4. **What's undone**: the render surface (film-page module? SEO copy? feeds?) awaits 원우's direction — do not ship a surface without it. Backlog line: `docs/BACKLOG.md` §C.

## Canonical rules (decided with 원우)
1. **Output language = English.** Sentences and SQL comments are English. (`films.title` is English; a localized-title column would let the same engine emit other languages.)
2. **Title-first (anchoring).** Every sentence begins with the target film's title or its possessive.
3. **Interpretation / connection graph only.** Plain non-interpretive facts are **excluded by decision**: no awards/lists, no rating percentile/rank, no runtime comparison.
4. **No LLM anywhere.** Sentences are 100% Postgres `format()` output, pulled verbatim. No `random()` either — variety is md5-derived and deterministic.
5. **Wow first (v2, 2026-07-10).** The core value is the verifiable surprise ("*this* connects to *that*?"). Surprise is *computed* (node rarity, concept fanout, year gap, genre disjointness, multiplicity), routed (each affinity pair → exactly ONE sentence via its strongest family), scored (`wow` column), and phrased in a 4-beat pitch shape: **anchor → concretize → turn → warrant**.
6. **Paraphrase bank, not one template.** 12 families × 2–6 variants = 42 surface forms; refined register (*kinship, seam, lineage, grammar, echo…*); fixed-suffix punches also paraphrased.

## The 12 wow families (v2)

| Family | The claim | Parasite | Persona |
|---|---|--:|--:|
| P1_exclusive_pair | only two films in the catalog stage this node | 5 | 0 |
| P2_kinship | unexpected companion + shared figure | 6 | 7 |
| P3_time_bridge | same argument ≥25 years apart (direction-aware) | 2 | 7 |
| P4_genre_clash | disjoint genres (drama excluded), same figure | 1 | 3 |
| P5_thesis_element | scene/motif = the film's argument (theorist + intensity) | 6 | 8 |
| P6_lens_unlock | rare lens (≤12 films) opens both films | 3 | 0 |
| P7_select_club | one of only 3–6 films under this lens, members named | 1 | 0 |
| P8_solo_lens | the *only* film in the catalog under this lens | 3 | 7 |
| P9_same_grammar | mid-band lens twins (13–40), year-gap contrast, cap 10 | 10 | 0 |
| P10_wide_conversation | joins an N-film lineage *through its own door* (fanout >40 → 1 sentence) | 1 | 1 |
| P11_double_bond | two shared nodes with one film | 0 | 5 |
| P12_lens_lineage | the lens's earliest catalog holder (≥15 y older) | 3 | 1 |
| **Total** | | **41** | **39** |

Signature outputs: *"Parasite (2019) holds a reading it shares with one film alone — Planet of the Apes (1968)… The two were made 51 years apart."* · *"Persona (1966) holds a lens no other film in the catalog shares: Carl Jung's ‘the persona / mask of the social self’."* · *"Parasite (2019) stands in a line that begins with Casablanca (1943) — Karl Marx's ‘commodity fetishism’."*

## Files
| File | Role |
|---|---|
| **`MASS-PRODUCTION.md`** | **Canonical ops doc (2026-07-11).** Shipped tables + counts, kin formula, correctness gates, server-load runbook, refresh procedure, remaining work. |
| `Template_Sentence_Engine_Parasite_EN.md` | The A–I sentence templates (v1 style = canonical per 원우) + per-film demo. |
| `WOW_Engine_v2_EN.md` | v2 rhetorical engine — **reference only** (style superseded 2026-07-11); its computations live on as `kin`/`salience`/stats. |
| `Template_Sentence_Engine_Parasite_KR.md` | Korean mirror of the v1 doc (reference only). |
| `README.md` | This file — entry point + decision log. |

Origin template (the Korean 9-pattern demo on *Drive My Car* that seeded this work): `../Template_Sentence_Engine_DriveMyCar.md`.

## Data source
Live **kyniq production Supabase** — project `jvgarcqrtsmgfimdcwgo` (ap-northeast-1 / Tokyo). Queried in real time via MCP `execute_sql` (not a snapshot).

### Schema & join reference (what the engine reads)
Only these columns are needed; a fresh agent should not have to reverse-engineer the joins.

| Table | Columns used | Key relationships |
|---|---|---|
| `films` | `id, title, year, genres, director, visible` | the base film (`base` CTE); `genres text[]` drives P4; catalog gate = `visible` |
| `film_affinities` | `film_id, related_film_id, shared_meta_take_ids (uuid[])` | `related_film_id → films.id`. Drives **P1–P4, P11** |
| `meta_takes` | `id, title` | resolved from `shared_meta_take_ids`; `title` = the interpretation node name |
| `figures` | `id, film_id, label` | `film_id → films.id`. `label` = the scene/element being read |
| `takes` | `figure_id, theorist_name, concept, strength, take_title` | `figure_id → figures.id`. Drives **P5–P10, P12** (take↔take self-join on `theorist_name + concept` finds twin films) |

**Wow features computed catalog-wide (two global CTEs, reusable for batch):**
- `node_fanout` — films per meta_take across all of `film_affinities` → P1 exclusivity, rarity suffixes
- `concept_fanout` — films per (theorist, concept) → P6/P7/P8/P9/P10 banding

## How to run
Open `WOW_Engine_v2_EN.md` §6, copy the SQL, change the film id in the `base` CTE, run. Returns `(pattern, wow, sentence)` ordered by wow DESC — take `LIMIT k` for a surface.

## Scaling path (not yet built)
Change `WHERE id='…'` → `WHERE visible` in `base`, add `b.id AS film_id` to each gen branch, and `CREATE TABLE film_sentences AS SELECT DISTINCT film_id, pattern, wow, sentence FROM gen`. ~6,700 films × ~40 ≈ **270k ranked sentences** at $0 LLM cost. The two global fanout CTEs compute once and serve every film.

## Open items / next
- **Persistence**: create `film_sentences` table + batch generation (currently ad-hoc SELECT only).
- **Surface**: decide where these render (SEO copy on `/film/[slug]`? Surprise cards? feed?) — awaiting 원우's direction.
- **Affinity score**: `film_affinities.score` is currently `0.0` (pipeline recompute) — node cardinality/fanout stand in. Revisit when restored.
- **Tuning knobs**: P6 `wr<=8` / P9 `wr<=10` caps, wow-score weights, and the paraphrase banks are all parameters — extend the arrays to widen variety without touching logic.
- **KR SQL corruption note**: an earlier auto-translated KR draft had its typographic quotes normalized to ASCII apostrophes, which breaks `format()` literals — never copy SQL out of a machine-translated doc without checking the quotes.
