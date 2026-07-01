# PLAN — Curation registry integration (editorial brain → live site + personalization)

**Source:** `curation-handover/HANDOVER.md` (2026-06-18) — the FilmCurio curation/atlas system.
**This doc:** how that system connects to the live Metatake project, the concerns, and the
sequenced plan — especially for personalized recommendation and its tie to lineage.
**Status:** Phase 1 (connect) started 2026-07-01. Bridge + monitor live.

---

## 1. What the curation system is (in one line)

An **editorial brain** that governs the catalog: for every film it decides *whether it enters,
in what order it's analyzed, whether it's indexed, and how it's shelved* (by country / region /
movement) — using an **authority × demand** model layered on top of lineage.

It is NOT a separate content system. It is the **policy/scoring layer on top of lineage**:
- `authority_flag` is derived from lineage facets (canon / auteur).
- country/region hubs are lineage `national` lists surfaced as navigation.
So the rule is: **lineage = data, curation = policy.** Never duplicate; curation references lineage.

## 2. Metatake's four brains (how this fits)

1. **Content** — figure → take → strong-misreading → trope (the readings).
2. **Relational** — lineage (auteur / movement / national / canon) + `film_scores` + `film_affinities`.
3. **Geographic** — the Atlas (setting + filmed layers) + origin country.
4. **Editorial (curation)** — authority×demand quadrant, hubs, `should_index`, recommended_action.

## 3. Ground truth (verified 2026-07-01)

- `public.films` = **6,701** rows; **1,935 visible** (analyzed & un-held). ~4,766 are shadow-
  imported and hidden.
- `curation.film` = 6,701, **1:1 matched to public.films on tmdb_id** (0 unmatched, 0 dupes).
- Classification: analyzed 1,957 (A 819 · B 178 · C 680 · D 280); queued 3,118 (A 813 · B 1,179 ·
  C 1,126); parked 1,626 (D).
- Lineage: `film_lineage` 10,561, `lineage_lists` 399 (auteur 160 · movement 67 · national 47 ·
  canon 18 · festival/section 18 · style 15 · award 56), `film_scores` 5,985.
- Recommender `film_affinities` already blends concept overlap (`shared_meta_take_ids`) + lineage
  overlap (`shared_list_ids`) + `lineage_score`. The personalization skeleton exists.
- **Drift check** (`curation_drift()`): `visible_but_not_indexable = 0` (no leakage);
  `indexable_but_hidden = 22` (analyzed-but-held thin films — intentional). The two systems are
  ~99.7% consistent.

## 4. Concerns (must respect)

1. **Two sources of truth.** "What is live" lived in both `films.visible` and
   `curation.should_index` with no link. → bridged now (§6); keep curation as the policy source.
2. **Thin-content SEO.** The 1,626 parked (D) must stay noindex. When the app starts surfacing
   catalog breadth, indexability MUST derive from `should_index`, not from mere existence.
3. **Origin-country accuracy** (HANDOVER §5.6): "on a list ≠ made there" (e.g. Gran Torino→Japan).
   Only auteur+national signals are trusted. `public.films` has no country column yet; country
   hubs must not go live until the **Phase 0 TMDB finalizer** runs (operator step, §7).
4. **Rule staleness.** curation `demand` uses old `total_score`. Now that real demand exists
   (views, `user_saves`/`user_movies`), the demand signal should be refreshed.

## 5. The payoff — five recommendation axes for /me

Connecting curation gives the personalization page five independent axes:
concept/misreading similarity · lineage similarity · geographic (filmed + origin country) ·
**editorial authority (curation)** · personal taste (saves/seen).

Curation's role in recs is **filter + ranking prior, not similarity**:
> gate by authority (only worthwhile films) → rank by demand (accessible first) →
> diversify by country/movement (not all Hollywood).

Result = a **critic's recommendation**, not collaborative filtering — the brand's identity.
Example: *"Because you saved In the Mood for Love, follow the Wong Kar-wai lineage, and keep
opening the 'image-as-longing' misreading → 3 Hong Kong New Wave deep cuts (authority-gated),
2 films sharing that misreading, 1 movement-wildcard."*

## 6. Phased plan

**Phase 1 — Connect (in progress).**
- [x] `public.film_curation` view — one-way read bridge (films ⋈ curation on tmdb_id). No
  duplication; `visible` unchanged. Exposes quadrant, authority/demand flags, score_tier,
  primary_facet, bucket, recommended_action, should_index, country_code, origin_confidence, scores.
- [x] `curation_drift()` RPC — monitors visible↔should_index drift + country readiness.
- [x] **Phase 0 finalizer** — DONE (2026-07-01): 6,627 origins resolved via TMDB, `rebuild_country_hubs()` ran → country hubs 22 → **40 live**. Movements national hubs now accurate + indexed (thin <8-film hubs kept noindex).
- [ ] Decide + wire: new-film indexability derives from `should_index` (keep the 22 held as-is).

**Phase 2 — Surface (World Cinema Atlas + editorial shelves).**
- Country / region hubs from `lineage national` + `curation.hub` — the second navigation axis
  (orthogonal to concept/misreading). Read via new security-definer RPCs over `film_curation`.
- Editorial voice on film cards: a "Deep cut" badge for high-authority / low-demand (quadrant B).

**Phase 3 — Hybrid personalization recommender (the payoff).**
- Build a taste profile from `user_saves`/`user_movies` across {misreading, lineage, country,
  movement}. Extend `film_affinities` → a personalized rank blending concept + lineage + geo,
  gated by authority, ranked by demand, diversified by country/movement.
- Surface on `/me` as "Your next films" with critic-style reasons.

**Phase 4 — Supply.** Analyze quadrant-A queued (813) in waves via figure-enrich — the raw
material that feeds every axis. Keep the authority gate; don't let catalog size outrun density.

## 7. Operator step (needed for Phase 1 country accuracy)

Run `curation-handover/02-phase0/phase0_origin_backfill.py` once on the dev machine
(reads `MetaTake/.env.local` `TMDB_READ_TOKEN`; set `SUPABASE_DB_URL`). ~6.7k TMDB calls, ~4 min.
Effect: finalizes origin country for the ~4,092 unresolved, corrects residual contamination
(e.g. Gran Torino), and auto-calls `rebuild_country_hubs()` so Taiwan/Netherlands/Czech/Greece/
Portugal/Turkey etc. cross the 12-film floor to live. After it runs, re-extract
`01-curation-db/curation_hub.csv` and re-check `curation_drift()`.

## 8. Rollback

- Bridge: `drop view public.film_curation; drop function public.curation_drift();`
- Whole registry (nuclear): `drop schema curation cascade;` (does not touch site content).
