# TASK C — AGGREGATION SURFACES: how non-film entity pages consume film data

All pages below are Next App Router server components with `generateStaticParams(){return[]}` + `unstable_cache` ISR (film-import consequence: new films appear on these surfaces automatically after cache revalidate — 300s–86400s per page — no rebuild needed, EXCEPT where a static JSON artifact or baked table is involved, flagged below). Master pipeline doc: `docs/RUNBOOK-new-film-ingestion.md` (per-film vs corpus-wide stage split; ⚠️ §5 ordering hazards). Master indexability switch: `lib/seo.ts` `SITE_INDEXABLE=true`; per-page `pageRobots(meetsBar)` → `noindex,follow` when below bar (page still renders).

---

## 1. `/director/[slug]` — hub (`app/director/[slug]/page.tsx`, revalidate 300, cache key `director-load5`, tag `director:<slug>`)

**Reads:**
- `films` where `director_slug=slug AND visible=true` — **the existence gate**: 0 rows → `resolveAlias('/director/<slug>')` (`slug_aliases` ledger) → else 404. ⚠️ DB error **throws** (never cache a poison 404 — `unstable_cache` null-poison trap, deliberate).
- Layer-2 filmography: `films` `visible=false` matched by `director_slug` OR exact `director` name (hidden catalog rows often carry only the name).
- `directors` (name/profile_path/bio/birthday/place_of_birth) — written by `worker/tmdb-fetch.py` (Stage 2).
- Per-director artifact tables: `director_portrait`, `director_facts`, `director_picks`, `director_next` (fwd + reverse `target_slug=slug`).
- RPCs: `director_misreadings(p_slug,p_limit)` = `takes(status='published', is_invitation=false)`→`figures`→`films(director_slug, visible)`; `director_catalog(p_slug)` = `figures→figure_taxonomy(axis in object/location/char_archetype/char_identity/char_complex/theme)→taxonomy_nodes` over visible films; `director_geo(p_slug)` = `film_locations` (lat not null) joined `films(visible)`; `director_curation(p_slug)` = `curation.film_comment`+`curation.film`+`curation.auteur_director` joined on `films.tmdb_id` (returns null when `in_index=0`, fail-soft hides to.W card).
- Reading counts: `takes` joined `figures.film_id in filmIds`, `status='published'`.
- Tropes: `figure_type_members` → `meta_takes(status='published', kind='figure_type')` per figure/film; signature = trope spanning **≥2 films**.
- Record counts: `film_lineage`, `film_wd_honors`, `film_reception` counts over filmIds; news: `now_articles(status='published', anchor_slug|director_slug)` + `now_stream(director_slug)`.
- TakeScore boxes: `cachedRankedScores()` (`lib/takescore-bulk.ts` bulk ranking — ⚠️ do NOT loop `cinecodex_card` per film, it starved Postgres).
- Fantasia: `loadFantasia("director",slug)` (`film_sentences` layer; module hides <2 rows).
- Repertory/credits: TMDB live fetch per `films.tmdb_id` (24h `unstable_cache` `director-repertory`), entity-stitching against **static `lib/crew_index.json`** (⚠️ rebuilt only by `worker/crew-index-build.py` — new film's crew invisible here until rebuild).
- Hero: `EntityTVHero playlist=director-<slug>` (`tv_reel` RPC; falls back to trailer reel from the films' slugs, else hidden — ⚠️ `tv_reel`/`tv_watch` need function-level `set statement_timeout` for anon).

**Section gates (all hide gracefully):** picks/next/facts sections only if rows exist; Records section if `honorsN+receptionN>0 || total>=3 || readingCount>0`; Locations tab if `geoCount>0`; locations-article CTA if `geoFilms>=DIRECTOR_LOCATIONS_MIN_FILMS(2) && geoCells>=DIRECTOR_LOCATIONS_MIN_PINS(6)` (`lib/locations.ts`). Meta description: `director_portrait.body` else deterministic `editorialSummary()` (⚠️ TMDB bio deliberately never displayed — duplicate-text SEO rule).

**Effect of new film:** purely additive for a known director (counts, filmography, trope aggregation, curation standing all live-derived). For a **new director**: hub exists as soon as 1 visible film has `director_slug`, but is "bare" without Stage 15 artifacts (see §15 below).

**Sitemap:** `lib/sitemap-data.ts` `directorEntries()` = unique `director_slug` of visible films; `/life` advertised only at ≥4 facts.

### 1a. Subpages (`app/director/[slug]/{start,next,life,misreadings,takescore,honors,reception,theory,locations}/page.tsx`, all revalidate 3600 except locations 86400)

| page | data | render gate (404) | index gate (`pageRobots`) | sitemap gate |
|---|---|---|---|---|
| `start` | `director_picks` (+films, `director_facts`/`director_next` counts for cross-links) | no visible films → 404 (picks may render from 1) | `picks.length>=3` | `directorGuideSlugs("director_picks")` ≥3 |
| `next` | `director_next` fwd+reverse, target photos from `directors` | no visible films → 404 | `next.length>=3` | `directorGuideSlugs("director_next")` ≥3 |
| `life` | `director_facts` (name_meaning, intro, facts[]) | no facts row → 404 | `facts.length>=4` | `directorEntries()` ≥4 facts |
| `misreadings` | `director_misreadings(p_limit:600)` | no data → 404 | `n>=5` | `directorLayerEligibility().misreadings` ≥5 published non-invitation takes |
| `takescore` | films + `cachedRankedScores()` | — | `cards.length>=3` | `.takescore` = ≥3 visible films |
| `honors` | per-film `film_lineage_for(p_film_id)` RPC loop + `film_wd_honors` + `film_reception` | — | `total>=3` | `.honors` = ≥3 (film_lineage+film_wd_honors rows) |
| `reception` | `film_reception` over filmIds (+honors/lineage counts) | — | `rows.length>=3` | `.reception` ≥3 |
| `theory` | `takes` (theorist_id→`theorists` batch .in 150) | — | `F.n>=5` | `.theory` ≥5 readings |
| `locations` | `director_geo` merged via `mergeCells` | `<2 films OR <6 cells` → **404** (returns null) | same | `cachedLocationsEligibility()` (atlas_eligibility_json RPC — VERIFY exact name) |

`directorLayerEligibility` (`lib/sitemap-data.ts:321`, daily cache `director-layer-eligibility-2`) is the shared eligibility used by sitemaps AND `/curious/directors` — mirrors on-page robots bars.

### 1b. Per-director artifacts & generation trigger (Stage 15/16, `docs/RUNBOOK-new-film-ingestion.md`)
- `director_portrait` + `director_next` ← `worker/director-profile-gen.py` → `director-profile-batch.py` (Anthropic Batch, Opus) → `director-profile-load.py --apply` (fuzzy-matches rec names to directors **with a visible film**; unmatched get TMDB photo, `target_slug=null` "not yet on Metatake"; ⚠️ re-runnable — as corpus grows, re-run links up previously unmatched recs).
- `director_facts` ← `worker/director-facts-gen.py` → `director-facts-load.py --apply` (web-grounded facts, per-fact source URL).
- `director_picks` ← `worker/director-picks-gen.py` → `director-picks-batch.py` → `director-picks-load.py --apply` (⚠️ validates each pick against the director's **visible** filmography; invalid slugs dropped).
- `director_embedding` (Stage 16) = avg of the director's figure embeddings — ⚠️ **no worker script exists**; built via ad-hoc SQL (BACKLOG: `refresh_director_embeddings()` RPC). Skipping it → empty similarity ring on `/network?m=directors` and search v3 director leg (`0040_search_v3.sql` reads `director_embedding`). `worker/galaxy-build.py --directors` → `director_map_xy` (⚠️ full rebuild moves ALL coordinates — quarterly only).
- `director_curation` is an RPC, not an artifact — but it depends on **`curation.film_comment` / `curation.film` rows keyed by `films.tmdb_id`** (to.W pipeline, canonical `HANDOFF-투두블유-큐레이션코멘트.md`, rules in `curation.rule` table). New film without curation rows → simply excluded from standing counts (graceful).
- ⚠️ **None of Stage 15/16 is auto-triggered today** — RUNBOOK explicitly: "run when ingesting films by new auteurs"; without them the director page is bare and home Surprise director cards fall back to misreading mode.
- New-director photo backfill: `worker/director-profiles.py` (RUNBOOK §4.e).

---

## 2. `/lineage/[slug]` (`app/lineage/[slug]/page.tsx`, unstable_cache)
- **Reads:** `lineage_lists` (list meta) + RPC `lineage_list_films(p_slug)` = `film_lineage→lineage_lists→films` (+`lineage_editions`). Returns BOTH visible and hidden films (honours are facts; hidden shown in archive block).
- **Inclusion:** a `film_lineage` row (film_id, list_id) — written by `worker/lineage-ingest.py`/`lineage-resolve.py`. Purely additive per film.
- **Gates:** page renders from 1 member; `pageRobots(films.length >= LINEAGE_LIST_MIN)` (`lib/lineage.ts` `LINEAGE_LIST_MIN=3`); related-lists module mirrors ≥3. Sitemap/index eligibility: `loadLineageEligibility()` counts **real `film_lineage` rows** — ⚠️ **never gate on `lineage_lists.film_count`** (that column = the list's OFFICIAL size, e.g. 100 for a top-100; memory invariant "film_count로 게이트 금지"). NB: the `/lineage` index RPC `lineage_index()` does use `ll.film_count>0` — that's list-level display only.
- `/lineage` index also merges `movements_index()` (national/movements tabs), filtering `film_count>0`.
- `/film/lineage/[slug]` (per-film honours record) gates ≥3 `film_lineage` rows (`FILM_HONORS_MIN` in `lib/lineage.ts`), includes Tier-2.

## 3. `/movements/[slug]` (`app/movements/[slug]/page.tsx`)
- `/movements` index = `permanentRedirect("/lineage")` (kept only for the `MvHub` type export).
- **Reads:** RPC `movement_detail(p_slug)` = `curation.hub` + `curation.film_hub(hub_slug,tmdb_id)` joined `public.films` **on `tmdb_id`**, `f.visible` only; auteurs block = directors with ≥2 visible member films (cap 12). Hidden archive: `movement_hidden_films`.
- **Inclusion:** `curation.film_hub` row for the film's `tmdb_id` + `films.visible=true`. ⚠️ join is on tmdb_id — a new film without `tmdb_id` can never join a movement. `curation.*` rows come from the curation/map handover pipeline (`curation-handover/`, `HANDOFF-맵프로젝트-AI인수인계.md`) — **not auto-triggered by film ingest (VERIFY)**.
- **Gate:** hub row missing → 404. No robots threshold found in page (VERIFY). Additive.

## 4. `/genre/[slug]` (`app/genre/[slug]/page.tsx`, revalidate 600)
- **Reads:** ALL visible `films(title,slug,year,genres)` paged 1000/`.range()` (⚠️ PostgREST 1000-row cap — must page), filtered in JS by `slugifyGenre(g)===slug`; hidden archive via `.overlaps("genres", genreNames)` on `visible=false`.
- **Inclusion:** `films.genres[]` containing a string that slugifies to the route slug — filled by `worker/tmdb-fetch.py` Stage 2. ⚠️ missing genres → film clusters as "Other" and misses every genre page (RUNBOOK "non-negotiable before extract").
- **Gate:** `inGenre.length===0` → 404. No robots bar (always indexable). Purely additive (list is year-desc; QuickAnswers "newest" recomputes live).

## 5. `/trope/[slug]` (`app/trope/[slug]/page.tsx`)
- **Reads:** `meta_takes` where `slug`, `kind='figure_type'`, `status='published'`; RPC `trope_members_ranked(p_slug,200)` (canonical repo copy `supabase/rpc/trope_members_ranked.sql`) = `takes.trope_id=mt.id AND takes.status='published'` → figures → films, ranked live by `cosine(takes.embedding, meta_takes.embedding)`; `trope_related(p_slug,9)`; film backdrops batch.
- **Inclusion:** `takes.trope_id` set — by `worker/trope-tag.py→trope-build.py` (⚠️ `--reset` wipes+re-slugs ALL tropes — corpus-wide fragile, supervised only) or additive `worker/trope-incremental.py` (+RPCs `trope_match_takes`, `trope_set_take_tropeid`, `trope_insert_members`, threshold cosine ≥0.72, `--films <slugs>`). ⚠️ membership is `takes.trope_id`, **NEVER `takes.meta_take_id`** (LEGACY, unpublished hubs).
- **Gates:** 404 path handles `kind='reading'`→308 `/take/`, `merged_into`→308, `slug_aliases`→308, else 404. `pageRobots(true)` always; "ranked" presentation needs `filmCount>=4`. Sitemap: `INDEX_COHORT_TROPES=1500`.
- **New film effect:** **re-ranks live** (new member with higher cosine displaces order — deterministic, cache-safe, intended). `meta_takes.film_count` is baked (updated by trope build/persist) — used for ordering in `concept_detail` tropes shelf; stale until trope stage runs.
- `/tropes` index — same corpus (`meta_takes` kind=figure_type). `/meta-takes` = `redirect("/tropes")` — **LEGACY, retired**.

## 6. `/concept/[slug]` (`app/concept/[slug]/page.tsx`) — two-corpus merge
- **Theory corpus (primary, ex-/idea):** `theory_concepts` (+`concept_aliases`, `theorist_concepts`), RPC `concept_desk_essays(p_slug)` = `essay_entity_links(entity_type in concept/idea)` → `essays(status='verified')`; RPC `concept_canon_readings` = `theory_canon_map→take_canon→takes(published)→figures→films`.
- **Readings corpus (SM):** RPCs `sm_concept_head`, `sm_concept_readings`, `sm_concept_intro`, `concept_readings(p_slug)` (slugified `takes.concept` string match → tropes), `concept_detail(p_slug)` (`sm_concepts`+`concept_map` canonicalization → takes → films/tropes/related).
- **Inclusion for a new film:** (a) a published take whose `takes.concept` string maps through `concept_map`/`sm_concepts` — new raw concept strings require `worker/concept-embed.py` → `--write 0.70` (RUNBOOK §4.3c) to join the canon; (b) an Engine-Room essay with an `essay_entity_links` concept row (⚠️ essay generation currently **frozen** — wave-4 drafts local); (c) take_canon links (Stage 8, ⚠️ tradition/canon match is MANUAL — RUNBOOK gap).
- **Gates:** no head found → 404. Robots variants: theory-concept page `pageRobots(tropes>=3)`; essay-led `pageRobots(desks+canonReadings>=1)`; SM-led `pageRobots(readings+desks>=3)`. Sitemap `conceptEntries()`: SM slugs gated ≥3 readings.
- `/concept/domain/[domain]` = RPC `concept_domain_live(p_part)`; 0-film categories gated behind "Show N not yet on screen" toggle (memory: Literature domain hidden). `/concept` index = RPCs `concept_live_registry`, `sm_concept_index`, `concept_index`, `concept_domain_counts`, `theorist_index`.

## 7. `/theorist/[slug]` (`app/theorist/[slug]/page.tsx`, revalidate 1800, cache `theorist-4`, tag `theorist:<slug>`)
- **Reads:** `theorists` row (maybeSingle — missing → 404); RPC `theorist_readings(p_slug)` = `takes.theorist_id=th.id AND status='published'` → figures → films; `theorist_concepts→theory_concepts`; `essay_entity_links(entity_type='theorist')`; film meta batch.
- **Inclusion:** `takes.theorist_id` — set by the bold-take load (`worker/boldtake-load.py`). ⚠️ `theorists` table has composite-name pollution (22.5% name-match failure — memory `theorists-table-composite-pollution`); a take pointing to a non-canonical theorist row fragments the surface.
- **Gates:** `pageRobots(readings.length>=3)`; sitemap theorists ≥3 readings. Faces: `lib/theorist_portrait.json` (static Wikidata P18 backfill — new theorists need backfill or monogram fallback). Additive; verbalizer stats recompute live.

## 8. `/tradition/[slug]` (`app/tradition/[slug]/page.tsx`)
- **Reads:** RPC `theory_school_detail(p_slug)` (concepts of school via `school_slug(major)`; film counts = union of `essay_entity_links` concept links + `concept_aliases` links + `theory_canon_map→take_canon→takes(published)`); RPC `tv_films_for_concepts` for the hero reel; RPC `canon_concept_slug` — old canon slugs 308 to `/concept/*`.
- **Inclusion:** same three membership paths as concept (essay links or canon-mapped takes). Gates: no school → 404; title enriched at `films>=3`. `/tradition` index (`theory_schools_index` RPC): rows with `films>0` featured; 26 zero-film schools behind toggle (memory: tradition films>0 gate).

## 9. `/catalog/[seg]/[slug]` (`app/catalog/[seg]/[slug]/page.tsx`)
- **Reads:** RPCs `catalog_node_detail(p_kind,p_slug)` (`taxonomy_nodes` + live `figure_taxonomy` count), `catalog_node_members` (`figure_taxonomy(axis=kind)→figures→films`, ordered `confidence desc`), `catalog_node_kindred`, `catalog_node_themes`; `taxonomy_nodes.meta/created_at`.
- **Inclusion:** `figure_taxonomy` rows — Stage 10 `worker/catalog-map-run.py` (objects/locations) + `catalog-map-char.py` (characters), Batch/Sonnet, resumable, per-film-ish.
- **Gates:** node missing → 404; `pageRobots(member_count>=1)`; "ranked" framing at n≥4; maturity ladder n≥2 fresh / ≥4 emerging / ≥9 established / ≥26 cliché. Sitemap `INDEX_COHORT_CATALOG=500` (named-archetype nodes ≥3 member figures). New film: additive, may reorder confidence ranking and bump maturity tier of existing nodes.

## 10. `/frames` + `/frame/[slug]` (`app/frames/page.tsx`, `app/frame/[slug]/page.tsx`)
- **Reads:** `frames(status='approved')`; `frame_instance_counts` (view); frame page: `question_frames(is_primary=true)` → `questions(status='published')` !inner → `films` + `canonical_answers(status='published')`; `frame_rankings(frame_id→question_id,rank,rationale)`.
- **Inclusion:** film needs a **published `questions` row** (film_id) with a primary `question_frames` link. Questions come from the qa-seed pipeline (`worker/qa-seed/`) — per-film, adversarially verified, NOT part of the base ingest chain (VERIFY trigger).
- **Gates:** hub comment says approved + ≥5 instances (enforcement: `frames.status` + RLS; count gate VERIFY); frame page 404 if `instances.length===0`; sitemap `frameEntries()` requires >0 published primary instances. ⚠️ new film's question defaults `rank:999` (sorted last) until `frame_rankings` regenerated — ranking is **baked**, generator UNKNOWN/VERIFY.

## 11. `/credits/[person]` (`app/credits/[person]/page.tsx`, revalidate 86400)
- **Reads:** slug `{kebab-name}-{tmdbId}` (id authoritative); **TMDB live** `person?append_to_response=movie_credits,external_ids` via `TMDB_READ_TOKEN`; `films` by `.in("tmdb_id", …)` batches of 150 (both tiers; `visible=false` = catalog stubs, still linked); director-hub stitching via `films.director=name`.
- **Inclusion:** film joins a person page automatically once its `films.tmdb_id` row exists (TMDB is the credit source). **Render gate:** none beyond TMDB person existing; robots `pageRobots(read>=3)` (≥3 visible catalog films in a key craft: writer/dp/editor/composer/pd — `KEY_CRAFTS`).
- ⚠️ **Static artifact:** `/credits` index explorer, sitemap `creditsEntries()` (`INDEX_COHORT_CREW=1500`) and director-page crew stitching all read `lib/crew_index.json` — new films/people invisible on those until `worker/crew-index-build.py` reruns (person page itself is live).

## 12. `/curious/*`
- `/curious` (`app/curious/page.tsx`): `questions(status='published')` !inner `films.visible=true`; `essays(mode, lang='en', status='verified')` !inner visible film, per desk; SM count = films `visible+is_analyzed`. Fail-soft try/catch → empty blocks.
- `/curious/[desk]` : `essays` same filters paged to 8000; 404 if desk unknown or 0 rows; `pageRobots(n>=10)`. Inclusion = a **verified Engine-Room essay** for the film (⚠️ generation frozen; canonical route `/film/[slug]/[desk]`).
- `/curious/directors` (`app/curious/directors/page.tsx`): roster = union of `director_facts`/`director_picks`/`director_next`/locations-eligible slugs **∩ hub set** (visible-film director_slugs); layer chips from `directorLayerEligibility()`. New director appears only after Stage 15 artifacts exist.
- `/curious/misreadings`: `films(visible, is_analyzed)` ∩ `misreadingsEligibleSlugs()` (`lib/sitemap-data.ts:457`, daily cache) = films with ≥1 published non-invitation take. ⚠️ never link films without takes — their `/film/[slug]/misreadings` 404s.
- `/curious/locations`: `cachedLocationsEligibility()` + films.

## 13. `/strong-misreadings` (+`/[fw]`)
- Index: RPC `frameworks_overview()` = `takes(published, framework<>'INVITATION')` × `figures(status='approved')` × `films(visible)`, grouped per framework. `[fw]`: RPCs `framework_facets`, `readings_by_framework(p_fw,…)` (same base join; unknown fw → `redirect("/strong-misreadings")`).
- **Inclusion:** any published non-INVITATION take on an approved figure of a visible film — automatic at Stage 3. ⚠️ figure must reach `status='approved'`; the `films.visible` trigger flips at ≥3 approved figures (live DB trigger, ⚠️ NOT in version control — RUNBOOK Stage 14 VERIFY item).

## 14. `/meta-takes` — **LEGACY**: 8-line file, `redirect("/tropes")`. The retired meta-take/register/reading-hub model also survives as `takes.meta_take_id` (do not use) and `mt-consolidate` reading-kind hubs (unpublished).

---

## Cross-cutting invariants / hazards for the importer factory
1. **Two-class stage split** (RUNBOOK §0): per-film stages (TMDB, extract, reception, watch-next, asset, geo, catalog-map) are additive/parallel; corpus-wide stages (embed, consolidate, trope-build, rank/recommend, SEO) **can rename/re-link live entities** — importer must use additive paths (`trope-incremental.py`) and leave full re-clusters to a supervised "garden" pass.
2. **Ranked surfaces re-rank live** (trope cosine, catalog confidence, frame rank, takescore ranking, curation standing): adding a film silently reorders existing entity pages — by design, no action needed; but **baked** artifacts do NOT self-update: `lib/crew_index.json`, `lib/atlas_cities.json` roster, `theorist_portrait.json`, `frame_rankings`, `director_embedding`, `director_map_xy`, `meta_takes.film_count`, tv strategic playlists (`tv_list`, `built_at`), `sm_concepts`/`concept_map` (needs `concept-embed.py`).
3. **Join keys a film MUST have:** `director_slug` (director surfaces; generator = `lib/slug.ts` only), `tmdb_id` (credits, movements/curation, film_next backfill), `genres[]`+`overview` (genre pages, clustering), ≥3 approved figures (visibility trigger), published takes (misreadings/theorist/concept/framework/trope membership), `film_lineage`/`film_wd_honors`/`film_reception` rows (records layer), `film_locations` (geo).
4. **Graceful-degradation norm:** every aggregation section is `rows.length>0`-gated and hides; hard 404s only at entity-existence level (director w/o visible film, lineage list missing, frame w/o instances, director/locations below 2-film/6-pin bar, curious desk 0 rows). Thin-but-existing pages use `pageRobots` noindex, not 404.
5. ⚠️ `unstable_cache` null-poison-404 trap: loaders must throw on DB error (pattern in director page) — an importer health check hitting pages during a Supabase blip must not bake 404s; cache-key bump required on payload shape change (`director-load5`, `curious-desk-2` precedents).
6. ⚠️ PostgREST 1000-row cap: any aggregation reading `films`/`takes` wholesale must `.range()`-page (genre page, `fetchAll` in `lib/sitemap-data.ts`) or use jsonb_agg RPC.
7. Sitemap advertisement is a separate gate layer (`lib/sitemap-data.ts` + `lib/seo.ts` cohorts, cohort freeze until 2026-07-16) — a film can render+index-eligible yet unadvertised; raising cohorts is append-only by design.