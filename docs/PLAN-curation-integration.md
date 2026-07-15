# PLAN — Curation registry integration (editorial brain → live site + personalization)

**Source:** `curation-handover/HANDOVER.md` (2026-06-18) — the FilmCurio curation/atlas system.
**This doc:** how that system connects to the live Metatake project, the concerns, and the
sequenced plan — especially for personalized recommendation and its tie to lineage.
**Status:** Phase 1 (connect) started 2026-07-01. Bridge + monitor live.

> **↳ 코멘트층 (2026-07-11, SHIPPED):** 이 브레인의 6차원 등급을 편지체 코멘트로 표면화한 **to.W 층**은 별도 정본 `HANDOFF-투두블유-큐레이션코멘트.md`(루트)에서 관리. verdict 규칙 v2 대수술·저점정전 명명회피·optional 겸손문구·영화/감독 표면 포함. DB쪽 규칙 정본은 `curation.rule` 테이블.

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
  > **[UPDATE 2026-07-14] SUPERSEDED as the indexability SSOT.** 실제 색인 가능성의 단일 근원은 이제
  > `lib/seo.ts filmIndexBar`(마이그 0097 `film_index_signals_json`)다. Tier-2 카탈로그 **1,105편**이
  > `visible=false`인 채 **색인 가능**해졌으므로 (새 `not_visible_but_indexable` 클래스) — `curation_drift()`가
  > 모델링하지 않는 상태다. `curation.should_index`/`curation_drift`는 `filmIndexBar`와 **재조정(reconcile)** 필요
  > (또는 "derives from should_index" 주장 회수). → 정본: `HANDOFF-SEO-스타터가이드-작업지시서.md §2`.

## 4. Concerns (must respect)

1. **Two sources of truth.** "What is live" lived in both `films.visible` and
   `curation.should_index` with no link. → bridged now (§6); keep curation as the policy source.
2. **Thin-content SEO.** The 1,626 parked (D) must stay noindex. When the app starts surfacing
   catalog breadth, indexability MUST derive from `should_index`, not from mere existence.
   *(→ [2026-07-14] 재조정 필요: 실제 SSOT는 `lib/seo.ts filmIndexBar` — §3 Drift check 노트 참조.)*
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
  *(→ [2026-07-14] 실측 방향 변경: 색인 SSOT는 `lib/seo.ts filmIndexBar`로 이미 출시됨 — should_index는 이와 재조정할 것. §3 노트 참조.)*

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
