# STATE — Metatake (living snapshot)

**Last verified:** 2026-07-02 (DB counts + route tree + function inventory re-snapshotted live). This is the single "where are we" file; update it in place each session. Prior: 2026-06-24. Replaces `docs/STATE-2026-06-17.md` (history only).

> **Big shifts since 2026-06-24:** (1) the entire **`/room`** dark "operating-system" terminal shipped (personal cinema-asset OS — 12 routes); (2) **Cinecodex → TakeScore** value/cost/risk index is live sitewide (`/takescore`, poster TS badges, `/me` portfolio); (3) **정전가(Standing) + taste-vector personalization** shipped (`/me`, `/room`); (4) **Geographic Atlas** filled out (`film_locations` 9,731 located · `geo_cache` 3,951 — was ~empty); (5) **Lineage(계보)**, **Movements**, **Theory/Theorist/Tradition**, **Concept(/idea)** browse axes all shipped. Several items STATE previously listed as "pending" (personalization portfolio, lineage, atlas) are now **live**.

> **Big shift 2026-07-04~05 — the connection engine** (operational SSOT: root `HANDOFF-연결엔진-커넥션.md`; full diagnosis→execution log: `docs/PLAN-connections-overhaul.md`): the film-film connection layer was found **silently dead** (old `takes.meta_take_id`-based `film_affinities` builder → 0 rows → `/movies-like` ×1,935 all noindex, film-page Connected empty, /map 'like' edges absent) and was rebuilt end-to-end. Now live: **`film_affinities` 46k** (RRF fusion of trope TF-IDF + `film_taste_vector` cosine, evidence columns cos/tfidf/shared-tropes), `/movies-like` as **ranked evidence articles** (byline·dateModified·ItemList LD), film-page **top-5 Connected** (posters, #ranks, taste-match %) + **Counterpoints** section (`entity_edges` 11k "same trope, opposite readings" + diverge %), **`concept_map`** canonicalisation (concept joins 40%→62%, 6 RPCs rerouted), **/map Galaxy** (films 1,941 + directors 873 t-SNE starfields; poster/face nodes, drift, viewport panel, info card; `director_profile` photos 850/870), `/methodology` live stat tiles (`methodology_stats_json`), `film_next` tmdb backfill (internal resolution 58→79%) + `film_next_demand` ingest-priority view. **TS poster-overlay badges retired sitewide** (TakeScoreBadges deleted). Post-ingest refresh: RUNBOOK §4.3.

> **Big shift 2026-07-04 — the SEO layer** (full record: `docs/HANDOFF-SEO-마스터.md`): GSC went live and the entire search-facing architecture was built in one day — sitemap split into an index + **18 per-section children** (~13k URLs, section-level dashboards/rollback), www→apex 308, `slug_aliases` permanence ledger, IndexNow, sameAs profiles; **Tier-2** (5,040 hidden films) got TMDB backfill + noindex funnel template + "not yet read closely" collection sections; **related-boxes module system** on figure/trope/take/Q&A; portal hubs standardized (CollectionPage/ItemList schema); head-term landings (Film Tropes / Film Archetypes); theorists.xml (358, Wikidata QID 299) + catalog.xml Phase A (504); **CineCodex surfaced**: 13 dimension landing pages (/takescore/{dim}, essays + 8-anchor ruler + Top-25) + film-page dimension link lattice + Movie.review schema. First GSC signal: impressions 14→46, first 2 clicks, "movie tropes" cluster at positions 44–63.

---

## 1. The model (current, canonical)

`film → figure → take`. Each **take** carries:
- a **framework** = one of **14 "Strong Misreadings"** (SSOT: `lib/frameworks.ts`; stored in `takes.framework`), and
- a link to a **trope** hub (`meta_takes.kind='figure_type'`, via `figure_type_members`).

Figures are also classified into the **Catalog / Archetype** taxonomy (`taxonomy_nodes` + `figure_taxonomy`, 5 sections: objects, characters, locations, themes, theory).

**Two objective quality axes sit beside the critical layer (never blended into it):**
- **Cinecodex / TakeScore (TS)** — intrinsic **Value / Cost / Risk → U / S** (+13 sub-scores) in the **isolated `cinecodex` schema**, keyed to `public.films.id`. Surfaced on `/takescore` and the `/room` eval card (the sitewide **poster-overlay TS badges were retired 2026-07-05**; TakeScoreBadges component deleted). External metrics (`film_ratings`) are shown side-by-side, never merged. (S11 "never-blend".)
- **정전가 (Standing) + Discovery** — `film_scores` (prestige/discovery), the "market price" axis for portfolio/NAV.

**Retired layer:** the old "meta-take / reading hub / register" model is gone. `meta_takes.kind='reading'` hubs survive only as *unpublished candidates* — do not surface them. Every published hub today is a trope.

### Terminology (old → new)
| Old | New |
|---|---|
| meta-take / reading hub | retired → **Trope** hub + **Strong-Misreading** framework |
| register (10) | **framework** (14 Strong Misreadings) |
| "Frames" (Q&A) | *separate system* — community Q&A taxonomy, not frameworks |
| "films like" / 인근값 | `film_affinities` |
| Codex / `/codex` · `/score` | **TakeScore** / `/takescore` (current canonical; `/codex`,`/score` earlier names) |
| World Cinema Atlas | **Movements** (`/movements`) — origin/tradition axis (≠ geographic Atlas) |

> ⚠️ Easily-confused pairs: **frameworks** (14 strong-misreading angles) vs **frames** (community-Q&A). **Movements** (`/movements`, national cinemas + waves) vs **Atlas** (`/atlas`, geographic filming map) vs **Map** (`/map`, node connection graph). `meta_takes` is **polymorphic** via `kind` (trope hubs + legacy reading hubs).

---

## 2. Live counts (2026-07-02, live DB `jvgarcqrtsmgfimdcwgo`)

| Entity | Count | Note |
|---|---|---|
| **films** | **6,701** total · **1,935 visible** | visible=Tier-1 editorial pages. The other ~4,766 rows exist for **Cinecodex/TakeScore scoring + Tier-2 imports**, not full pages. (Was 1,957 total on 06-24 — table expanded to the full scored universe.) |
| figures | **18,168** | all approved |
| takes | 73,478 total · **26,975 published** | rest retired/candidate |
| meta_takes (hubs) | 11,974 rows | published hubs are **tropes** (`kind=figure_type`, ~4.7k); `kind=reading` = legacy unpublished, not surfaced |
| figure_type_members | 19,186 | figure ↔ trope |
| figure_taxonomy | 42,958 | figure ↔ Catalog archetype (`taxonomy_nodes` 2,928) |
| figure_tags / trope_tags | 39,749 / 35,508 | trope-tag output |
| film_affinities | 38,800 | "films like" |
| **directors** | **862** | (was 754) · director_embedding 873, portrait/facts 208, picks 1,019, next 1,011 |
| **Cinecodex (`cinecodex.scores`)** | **6,701** | + `cinecodex_confidence` 6,701 · `scoring_runs` 6,535. TakeScore live for all. |
| **film_scores (정전가)** | **5,977** | prestige/discovery — portfolio "market price" |
| **film_taste_vector** | **1,941** | per-film taste embedding (personalization) |
| **user_movies** | **26** | watched/watchlist + rating (personalization live; small user base) |
| film_reception | 8,884 | Reception tab (critics) |
| film_next | 17,095 | Watch-next (+ reverse Recommended-by) |
| film_asset | 1,957 | Why-watch lenses |
| film_ratings / film_watch_providers | 6,665 / 6,700 | external ratings + where-to-watch |
| **film_locations** | **9,731** (all located) · **2,613 films** | Geographic Atlas — `geo_cache` **3,951** (was ~0) |
| **film_lineage / lineage_lists / lineage_editions** | 10,551 / 398 / 4,735 | 계보 layer (canon/awards/festivals) — **shipped** |
| theory_canon / theorists / theory_families / canon_theorist | 2,587 / 1,840 / 1,394 / 981 | theory + tradition browse |
| sm_concepts | 1,227 | Strong-Misreading concept intros (`/idea`, `/concept`) |
| magazines / magazine_passages | 137 / 40 | RAG sources |
| _bak_* tables | (several) | cleanup backups from boldtake/trope/consolidation — safe to archive |

---

## 3. Site map (routes → data)

### Discovery / home
- `/` home v7 (`components/home2/HomeV2.tsx`; **Surprise me** hero ← `surprise_home()` via `/api/surprise/home`; mid-page HomeMap; NewsletterCard + editions), `/latest`, `/trending`, `/random/*` (`surprise()`/`surprise_set()`), `/manifesto`, `/home2-app`.
- **The Map (node graph):** `/map` (`MapExplorer`, 3 modes) + embedded `EntityMap` on entity pages. RPCs `map_overview`/`map_ego`/`map_film_*`/`map_director_*`/`map_search`; routes `/api/map`,`/api/map/search`.

### Film & people
- **Film:** `/film` (index), `/film/[slug]` (hub tabs: Invitation, Figures/Takes, Tropes, Archetype, Reception, Why-watch, Watch-next/Recommended-by, Films-like, Atlas, Information — via `film_catalog`,`film_reception`,`film_asset`,`film_next(_reverse)`,`film_affinities`,`film_geo`), `/film/[slug]/figure/[figureSlug]`, `/film/[slug]/q/[q-slug]`, **`/film/[slug]/watch`** (dedicated where-to-watch v3), **`/film/[slug]/gallery`**, `/genre[/slug]`.
- **Where-to-watch:** `/where-to-watch`, `/whereto/[slug]`.
- **Director:** `/director` (`directors_catalogue/_featured`), `/director/[slug]` (portrait/picks/facts/next + `director_geo`).

### Critical layer
- **Strong Misreadings:** `/strong-misreadings` (`frameworks_overview`), `/strong-misreadings/[fw]` (`readings_by_framework`,`framework_facets`,`readings_semantic`).
- **Tropes:** `/tropes` (`tropes_catalogue/_featured`), `/trope/[slug]` (`trope_related`,`trope_readings`).
- **Catalog/Archetype:** `/catalog`, `/catalog/[seg]`, `/catalog/[seg]/[slug]` (`catalog_*`).
- **Concept/theory:** `/concept`,`/concept/[slug]`, **`/idea`,`/idea/[slug]`** (v7 concept detail, `concept_detail`/`sm_concept_*`), **`/theorist`,`/theorist/[slug]`** (`theorist_index/_readings`), **`/tradition`,`/tradition/[slug]`** (`take_traditions`).

### Objective axes (NEW since 06-24)
- **TakeScore (Cinecodex):** **`/takescore`**,`/takescore/about` (13-dim range table + λ dial; `cinecodex_ranked`,`takescore_for_slugs`) — canonical. Earlier names **`/score`**,`/score/about`,**`/codex`**,`/codex/about` also mounted. Sitewide **TS poster badges** (`components/TakeScoreBadges.tsx`; skips `.room-root`).
- **Geographic Atlas:** **`/atlas`** (`geo_overview`) + film/director Atlas tabs (`FilmMap` MapLibre ← `/api/geo` → `film_geo`/`director_geo`/`geo_overview`).
- **Lineage (계보):** **`/lineage`**,`/lineage/[slug]` (`lineage_index`,`lineage_list_films`,`lineage_add_watchlist`).
- **Movements:** **`/movements`**,`/movements/[slug]` (`movements_index`,`movement_detail`,`film_movements`) — national cinemas + waves.

### `/room` — personal cinema-asset OS (dark terminal, login-required) — **NEW, MAJOR**
Shared shell (`RoomShell`: appbar·ticker·rail·inspector·activity) under `app/room/layout.tsx` (auth guard, `.room-root` scoped CSS). Routes + backing RPCs:
- `/room` command center (`me_portfolio_nav`,`portfolio_breakdown`,`me_recommend_wwi`,`me_taste_neighbors`,`me_collection`)
- `/room/collection` (`me_collection`) · `/room/watchlist` (`me_recommend_wwi`) · `/room/desk` (`me_watched_scored`,`me_takescore_summary`) · `/room/analysis` (`me_taste_signature`,`me_figure_cloud`,…)
- `/room/atlas` (`me_geo_coverage`) · `/room/auteurs` (`me_auteur_conquest`)
- `/room/rate` (`rate_film`,`me_rate_stats`,`me_recent_ratings`) · `/room/library` (`me_library`) · `/room/write` (`me_authored_takes`) · `/room/pair` (`me_pair_state`)
- `/room/film/[slug]` full eval card (`cinecodex_card`) + `film_room_context`
> **Audit:** section-by-section logic/privacy audit + reinforcement roadmap in **`docs/ux/ROOM-LOGIC-AUDIT.md`** (P0–P3). Key open items: `me_coverage`/`me_blindspots` RPCs don't exist yet (⑦④ derived from `portfolio_breakdown.canon`); write actions (담기/봤어요/서재토글/노트) are local-only except `rate_film`; pair = stub; ticker partly hardcoded.

### Search / Ask / account / static
- `/search` (`search_site`), `/ask`,`/ask/new`,`/chat`,`/rag` → `/api/ask`,`/api/ask/v2`,`/api/rag` (`ask_retrieve`,`magazine_retrieve`).
- **Account:** `/me` (personalization dashboard — pins + `user_movies` + TakeScore portfolio; 상단 📥 가져오기 버튼), **`/me/import`** (관람기록 통합 임포트 위저드 — Letterboxd ZIP/IMDb CSV/엑셀/왓챠/텍스트 붙여넣기 자동감지 → TMDB 매칭 검수 → 무손실 저장; `docs/HANDOFF-IMPORT.md`), `/u/[username]` (public portfolio, `public_portfolio(_meta)`), `/settings`,`/login`,`/signup`,`/reset`,`/auth/*`.
- **Static:** `/about`,`/methodology`,`/credits`,`/contact`,`/privacy`,`/terms`,`/guidelines`,`/blog[/slug]`,`/blog/subscribe`. **Admin:** `/admin/*`,`/editor`. **Legacy mounted:** `/meta-takes`,`/take/[slug]`,`/frames`,`/frame/[slug]`,`/movies-like/[slug]`.
- **API (new):** `/api/geo`,`/api/map(/search)`,`/api/surprise(/home|/set)`,`/api/tmdb-search`,`/api/track`,**`/api/import/parse|match|commit`** (임포트 파이프라인, SSR 세션 필수·쓰기는 service role),`/api/films/search`,`/api/films/backfill`,`/api/readings(/featured|/suggest)`,`/api/account/delete`,`/api/revalidate`,`/api/feed`,`/api/credits`. Plus `/llms.txt`, IndexNow.

---

## 4. Data model (core)

- **films** (`id uuid` PK, `slug`/`tmdb_id` unique, year, director(+slug), genres[], poster/backdrop, tmdb_extra, **visible**, **is_analyzed**). Now spans the full **6,701-film Cinecodex universe**; only **1,935 visible** (Tier-1 editorial). Parent of figures + all per-film extras.
- **figures** (`id`, film_id, kind∈character/object/location/trope/form, label, slug, description, embedding) → parent of takes; linked to trope hubs (`figure_type_members`) + catalog (`figure_taxonomy`).
- **takes** (`id`, figure_id, meta_take_id, **framework**, register, rationale, theorist, embedding, status) — HNSW index.
- **meta_takes** (`id`, slug, title/laconic/thesis/essay, embedding, **kind** [figure_type=trope | reading=legacy], status, merged_into) + `figure_type_members`, `meta_take_rankings`, `meta_take_edges`, `slug_history`.
- **Objective axes:** `cinecodex.scores`/`cinecodex_confidence` (V/C/R/U/S + 13 subs, isolated schema, DEFINER RPCs `cinecodex_*`); `film_scores` (정전가 prestige/discovery); `film_taste_vector` (personal taste embedding).
- **Personalization:** `user_movies` (watched/watchlist/rating — 영화당 1행 "현재 상태"), `user_pins` (follow/like), `profiles` (+ `portfolio_public`); ~20 `me_*` DEFINER RPCs scoped by `auth.uid()`. **Import (2026-07-03):** `user_watch_log` (관람 1회=1행, 재관람 포함 무손실 로그, `raw` jsonb에 원본 보존) + `user_import_jobs` (임포트 1회=1행, stats 누적) — 둘 다 RLS 본인 select만, 쓰기는 API의 service role 경유 (마이그레이션 `watch_history_import`).
- **Geo:** `film_locations` (lat/lng/layer filmed|setting/precision), `geo_cache`, `geo_progress`/`geo_filmed_progress`. RPCs `film_geo`/`director_geo`/`geo_overview`/`me_geo_coverage`. (RLS on `film_locations`/`geo_cache` = enabled, **0 policies** → DEFINER-RPC-only access.)
- **Lineage/Movements:** `lineage_lists`/`film_lineage`/`lineage_editions`/`lineage_sources`; movements via `film_movements`/`movements_index`.
- **Theory:** `theory_canon`/`theorists`/`theory_families`/`canon_theorist`/`sm_concepts`.
- **Per-film extras:** `film_features`,`film_reception`,`film_next`,`film_asset`,`film_affinities`,`film_ratings`,`film_watch_providers`.
- **RAG/Q&A:** `magazines`/`magazine_passages`; `questions`/`canonical_answers`/`contributions`/`votes`/`flags`; `frames`/`question_frames`.
- **Embeddings** (1536-d) on figures/takes/meta_takes/directors/canon/magazine_passages. Search: pg_trgm GIN + `search_site`.

> ⚠️ **Schema-in-VCS gap (widened):** `supabase/migrations/` is frozen at **0001–0026**. Everything since — the entire Cinecodex/TakeScore layer, all ~20 `me_*` room RPCs, `map_*`, `movements_*`, `sm_concept_*`, `theorist_*`, lineage/geo RPCs, `films.visible` expansion — was applied **directly to the live DB** and is **not** version-controlled. **240+ functions live; only `is_admin`/`handle_new_user` are in `.sql`.** See BACKLOG "schema capture" — highest structural-risk item.

---

## 5. Shipped vs pending

**Shipped & live (as of 2026-07-02):**
- Critical layer: Strong-Misreadings (14 frameworks) · Tropes (re-formed) · Catalog/Archetype · Theory/Theorist/Tradition/Concept(`/idea`).
- Film page full tab set; Reception (8,884); Watch-next (17,095)+Recommended-by; Films-like; **Where-to-watch dedicated page**; Gallery.
- **TakeScore/Cinecodex** — all 6,701 films scored; `/takescore`; sitewide TS badges; confidence (Pass 2).
- **정전가 + taste-vector personalization** — `/me` portfolio, taste neighbors, NAV, WWI λ recommender.
- **`/room` OS** — 12 routes (command center/collection/watchlist/desk/analysis/atlas/auteurs/rate/library/write/pair/eval-card).
- **Geographic Atlas** — `/atlas`, film/director Atlas tabs, filmed+setting layers (9,731 pins).
- **Lineage(계보)** — `/lineage`. **Movements** — `/movements`.
- Discovery: The Map (`/map` + embedded) · Home v7 Surprise-me · Newsletter/editions · sticky nav. Watchlists P1+2 (lazy TMDB import, Tier-2). Ask/RAG · search · blog · mobile-first · IndexNow.
- **관람기록 통합 임포트 `/me/import` (2026-07-03)** — 파일(Letterboxd ZIP·IMDb CSV·XLSX·왓챠)/텍스트 붙여넣기 자동감지 → 규칙 파서(+Gemini 폴백) → TMDB 매칭 검수 위저드 → `user_watch_log`(무손실)+`user_movies`(집계) 저장. 파서 셀프테스트 `scripts/import-selftest.ts` 26/26. 상세: `docs/HANDOFF-IMPORT.md`(진행상황 포함) + `docs/IMPORT-watch-history-design.md`(설계).
- **트로프·피겨·아키타입 순위 표면 (2026-07-05~06)** — /trope 멤버 라이브 랭킹(신규 RPC `trope_members_ranked`)+% match+리스티클 타이틀+ItemList/FAQ JSON-LD, 피겨 가시 질문 H2+nearest figures, /catalog 순번·confidence %·날짜/EEAT(이중브랜드 수정), 필름 Tropes 독해제목 라인, /methodology#rankings. 전부 렌더 파생(베이크 없음). 정본: `HANDOFF-트로프피겨아키타입-순위표면.md`.

**Pending (see BACKLOG + `docs/ux/ROOM-LOGIC-AUDIT.md`):**
- **/room reinforcement — P0+P1 DONE (2026-07-03):** `me_coverage`⑦/`me_blindspots`④ shipped+wired; write-actions (담기/봤어요/관심없음/서재 공개토글·즐겨찾기/노트 save_take+sanitize) all real mutations; conquer/gap WWI reasons real-tagged; ticker/system card de-hardcoded (`me_system_status`); `nav_snapshots`+`me_nav_history` asset curve live; `/u/me` 302 fixed; **pair 실구현** (`pair_matches` default-deny + `me_today_pair`/`me_pair_reveal`/`me_pair_history`, 부분노출 RPC 강제); `/api/geo` param whitelist+rate-limit; Atlas continent map DB화 (`country_continents` 156국 + `me_geo_coverage` v2) + dot dedup; 기존 room RPC 18종 스냅샷 역커밋. Migrations `0027–0033`. **Remaining:** cinecodex DDL 역커밋, P3 (per-sub rationale·미니맵·self-host 타일), 정식 엔진 W0–W4 (docs/logic).
- **Schema capture** — reverse-commit the ~200 out-of-band RPCs + DDL into migrations (structural risk).
- **/me/import 마감 확인** — 남은 것은 로그인된 브라우저에서 위저드 클릭스루(§7 A~F)와 커밋 후 DB 무손실 검증뿐 (서버사이드는 전부 검증 완료). ⚠️ 테스트 계정 세션 자동 생성은 권한 분류기가 거부 — 사용자가 직접 로그인 필요. `docs/HANDOFF-IMPORT.md` ⭐섹션 참고.
- Watchlists Phase 3 (promotion); Catalog Concepts→Theory absorption; per-page SEO head-copy; figure aliases; tradition-match automation; `refresh_director_embeddings()` + auto director-gen trigger; new-trope gardening; legacy-doc archival; `_bak_*` table cleanup.
