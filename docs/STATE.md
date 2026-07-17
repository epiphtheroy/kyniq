# STATE — Metatake (living snapshot)

**Last verified:** 2026-07-17 (mobile-app banner added; counts unchanged from 07-15 SEO consolidation re-measure). Prior full snapshot 2026-07-02. This is the single "where are we" file; update it in place each session. Replaces `docs/STATE-2026-06-17.md` (history only).

> **Big shift 2026-07-16~17 — 모바일 앱 "Pre-Watch Companion" (iOS+Android 시제품 완성)** (정본: 루트 `HANDOFF-모바일앱-프리워치.md` **v3.1** — §15 AS-BUILT·§16 데이터 연동 지도·§13 불변식 14조; 브랜치 `claude/cinephile-mobile-app-dphwc2`, PR #7): 프리워치 결정 루프(볼까→뭘→어디서→나중에)를 담은 **Expo 앱을 양 플랫폼 동시 완성**. **사이트 쪽 신설**: 모바일 BFF 7라우트 `/api/v1/app/{film,director,tonight,services,handoff,account-delete,tmdb-search}`(화면당 1응답, guardAndLog → api_calls에 `app_*`로 계측)·`/api/lens/marquee` Bearer 폴백(가산적)·푸시 크론 `/api/push/availability-cron`(vercel.json 매일 09:00Z, watchlist×fpi 국가별 diff)·**마이그 0106**(`push_tokens`·`user_prefs`·`push_sent`, own-row RLS — **0105는 다국어 프로젝션이 선점, 갭 의도**)·`.well-known` AASA/assetlinks(지문 플레이스홀더). **데이터 원칙**: 앱 전용 데이터 0 — 찜/Seen은 `user_movies` **단일 원장**(웹 렌즈와 즉시 동기, 앱은 행 삭제 안 함), 콘텐츠·랭킹·가용성 전부 기존 RPC 소비(cinecodex_ranked v11 인자면·takescore_for_slugs·film_availability·film_geo·film_lineage_for·search_all). **디자인(§3)**: 시스템 v2 "Lava"(벤치마크 Airbnb 2025 + iOS 26 Liquid Glass) — 웜 중립 + **그라데이션 CTA 하나**(#FF385C→#D70466)·동심 라운드(8/14/24/999)·블러 탭바·스프링·시트 오버 포토·브랜드 아이콘(TakeScore 링+세리프 M). **지도(§5.5)**: 데이터 계약 하나(`mobile/src/lib/pins.ts`) + 렌더러 4개 — 웹=MapLibre JS / Expo Go iOS=Apple 지도 / **Expo Go Android=WebView MapLibre**(Google 키 회피) / dev·스토어=MapLibre 네이티브. 검증: expo-doctor 18/18 · tsc 0 · **iOS·Android·웹 3번들** · 브라우저 E2E 에러 0 · Android 지도 실측(800핀·핀탭 브리지). 
> ⚠️ **함정 3개(불변식)**: ① **Expo SDK 54 고정** — Expo Go 상한(양 스토어 SDK 54 클라이언트)이라 올리면 폰 검토 경로가 죽는다(§13-13·§15.2b) ② **앱 디자인 토큰은 웹과 분리** — 웹 DESIGN-SYSTEM 이식 금지·역방향도 금지, 공유는 PT Serif 실 하나(§13-14) ③ **읽기 표면 라우트 개명 시 앱 웹뷰 경로 3파일 동기**(§16.5 — 유일한 수동 결합점). 폰 실행=`cd mobile && ./start-local.sh`(IP 자동정렬+QR). 남은 오너 몫: Apple $99·Play $25·eas init·FCM/APNs·assetlinks SHA256·Supabase provider/OTP 템플릿·TestFlight/Play 게이트(§9).

> **Big shift 2026-07-14~15 — SEO 통합 게이트 + Tier-2 메인 실속화** (정본: 루트 `HANDOFF-SEO-스타터가이드-작업지시서.md` §2 + `HANDOFF-Tier2-메인통합.md`; 게이트 코드 SSOT = `lib/seo.ts filmIndexBar` · `lib/filmGate.ts` · `lib/directorGate.ts`; 마이그 0097 `film_index_signals_json`): 구글 SEO 스타터가이드 전면 감사 결과 P1~P4 전량 SHIPPED. **(1) 통합 색인 게이트** — 얇은 서브페이지 3종(takescore/reception/lineage)이 thin 게이트를 우회해 ~6,800p 노출하던 scaled-content 누수를 닫고, **Tier-2 카탈로그 영화 1,105편을 실속 신호 기준으로 색인 승격**(게이트 = reception≥3 OR lineage≥3 OR wd_honors≥3 AND provider≥1 AND NOT tmdb-스텁; **`hold`은 게이트 입력 아님** — 팩토리 스텁 플래그). **색인 영화 메인 1,959→~3,064.** 서브페이지 불변식(= `filmMainIndexable && ownBar`)·사이트맵 미러(코호트 `INDEX_COHORT_FILMS_T2=300`). **⚠️ `visible`은 이제 색인 경계가 아님**(figures≥3 자동 트리거일 뿐; 승격 Tier-2는 visible=false·색인 가능). "honors are facts"(계보 서브 무게이트) 결정은 **번복**됨. **(2) TakeScore 정리** — 음수 점수 `displayTs()` 0클램프(표시·스키마만; 랭킹/API는 raw)·"flagged/n=1/unverified" 문구 전삭·Review author Person→**Organization "Metatake"**. **(3) 구조화 데이터** — figure/catalog/trope **FAQPage 제거**·/q QAPage→Article·이중브랜드 제목 ~40개·genre 고유 설명·alt 스윕 ~35컴포넌트. **(4) Tier-2 메인 실속화(commit 5e8f507)** — 승격 영화 메인이 수상/개봉연혁/학술(academic) 다이제스트+StillHero 렌더, 감독 허브가 카탈로그 TakeScore+press/수상/가용성/촬영지 다이제스트 렌더. **감독 허브 robots 게이트 신설**(`directorIndexBar`, 858→**678 색인/180 noindex**). 캐시키 bump: film-load8·director-load6·director-press-digest-1·read-plates-3. 잔여 백로그·롤아웃 pace는 `HANDOFF-Tier2-메인통합.md §6` + `BACKLOG.md`. ⚠️GSC 커넥터(`mt_gsc_daily`)는 07-10에서 정체 — 재가동 필요.

> **Big shift 2026-07-13 (오후) — AI 배포/개방 접근 표면** (정본: 루트 `HANDOFF-AI배포표면.md`): 오너의 "6항 발상 전환"(안 지은 유료 자산을 배포 채널로) 전부 구현·라이브. **무인증 REST API `/api/v1`**(films·films/{slug}·takescore·locations·openapi.json — GPT Action·임베드·확장의 공통 backbone, `lib/apiGuard`+`lib/apiv1`, LLM 0) + `/api` 개발자 랜딩; **오픈 촬영지 데이터셋**(마이그 0096 `api_locations_json`/`_export` → 17,341위치·1,917편·130국·좌표100%, `worker/export-locations-dataset.py`+HF카드+Zenodo메타 — ⚠️팩의 "좌표0" 불변식 의도적 반전, 좌표는 API/데이터셋 전용채널로만, 라이선스 CC BY vs NC 오너 미결); **네이버/다음 검색축**(GOOD_BOT Yeti/Daum·robots `/api/`·NAVER_SITE_VERIFICATION 훅); **임베드 TakeScore 위젯**(`/api/v1/embed.js` do-follow 스크립트+`/embed/takescore/{slug}` iframe+`/embed` 빌더); **Chrome MV3 확장**(`extension/` — Letterboxd/IMDb/TMDB/RT/Wiki 배지, JSON-LD CDATA 스트립, 라이브검증); MCP 발견(공식 레지스트리→PulseMCP/GitHub 자동). 오너 액션(계정)만 남음=데이터셋 업로드·네이버등록·GPT게시·크롬스토어·런칭포스트(전부 패키지 완비). 마이그 0096 — 다음 free 0097.

> **Big shift 2026-07-13 (오전) — MCP 서버 + AI 가시성 층** (정본: 루트 `HANDOFF-MCP-서버.md`; 등록 실무: `docs/MCP-DIRECTORY-SUBMISSION.md`): 공개 **MCP 서버 `/api/mcp`** 라이브 — AI 비서(claude.ai 실사용 검증, UA `Claude-User`)가 대화 중 툴 4개(search_films·get_film_criticism·get_takescore·find_connected_films = `lib/pack.ts` 렌더러 재사용, LLM 0)로 팩 전체를 당겨감. **공식 MCP Registry 등록**(`net.metatake/mcp` active — PulseMCP·GitHub 자동 수집). 같은 날: `/api/pack` 무료 복사 백엔드의 실구멍(인메모리 리밋=서버리스 무력) 봉쇄 — **3층 수확방어**(미들웨어 BAD_UA+bot_blocks 게이트 · 마이그 0091 `pack_note_hit` 3-신호[rate·volume·persist]→bot_blocks 자동차단 · fmt=json 로그인 게이트), Anthropic 이그레스 160.79.104.0/21 면제; **3겹 저작표시**(팩 citeLine 기계지향 지시문 · MCP instructions · 사이트 푸터 CC BY-NC 스탬프 — claude.ai가 실제로 "출처: Metatake" 붙이는 것 실증); **측정**(0093 `mcp_calls` 전량 원장 · 0092 `mt_ai_referrals_json` + /admin/metrics "AI 유입" 패널 = 채널② 가설 90일 판정); film 페이지 **"Metatake in Your AI" 버튼 2곳**(히어로 틸 필+탭레일, MCP 문외한용 모달·현재 영화로 개인화된 프롬프트). 마이그 0091~0094(0094=unaccent 검색) — **다음 free 0095**. 남은 오너 몫: Anthropic 디렉터리 제출(Team 조직 Owner 전용 — 11단계 답변 완비)·Smithery 1분.

> **Big shifts since 2026-06-24:** (1) the entire **`/room`** dark "operating-system" terminal shipped (personal cinema-asset OS — 12 routes); (2) **Cinecodex → TakeScore** value/cost/risk index is live sitewide (`/takescore`, poster TS badges, `/me` portfolio); (3) **정전가(Standing) + taste-vector personalization** shipped (`/me`, `/room`); (4) **Geographic Atlas** filled out (`film_locations` 9,731 located · `geo_cache` 3,951 — was ~empty); (5) **Lineage(계보)**, **Movements**, **Theory/Theorist/Tradition**, **Concept(/idea)** browse axes all shipped. Several items STATE previously listed as "pending" (personalization portfolio, lineage, atlas) are now **live**.

> **Big shift 2026-07-04~05 — the connection engine** (operational SSOT: root `HANDOFF-연결엔진-커넥션.md`; full diagnosis→execution log: `docs/PLAN-connections-overhaul.md`): the film-film connection layer was found **silently dead** (old `takes.meta_take_id`-based `film_affinities` builder → 0 rows → `/movies-like` ×1,935 all noindex, film-page Connected empty, /map 'like' edges absent) and was rebuilt end-to-end. Now live: **`film_affinities` 46k** (RRF fusion of trope TF-IDF + `film_taste_vector` cosine, evidence columns cos/tfidf/shared-tropes), `/movies-like` as **ranked evidence articles** (byline·dateModified·ItemList LD), film-page **top-5 Connected** (posters, #ranks, taste-match %) + **Counterpoints** section (`entity_edges` 11k "same trope, opposite readings" + diverge %), **`concept_map`** canonicalisation (concept joins 40%→62%, 6 RPCs rerouted), **/map Galaxy** (films 1,941 + directors 873 t-SNE starfields; poster/face nodes, drift, viewport panel, info card; `director_profile` photos 850/870), `/methodology` live stat tiles (`methodology_stats_json`), `film_next` tmdb backfill (internal resolution 58→79%) + `film_next_demand` ingest-priority view. **TS poster-overlay badges retired sitewide** (TakeScoreBadges deleted). Post-ingest refresh: RUNBOOK §4.3.

> **Big shift 2026-07-07 — figure 질문 title 레이어** (색인: `HANDOFF-SEO-마스터.md` §1 표·§3b-9; 파이프라인 정본: `Outputs/figure_seo/RUNBOOK.md`): figure 18,168页의 `<title>`이 전량 질문형으로 — **렌더 타임 규칙만으로, LLM·DB 무사용/$0** (`lib/figureSeo.ts`: 깨끗한 라벨 57% 완전 질문형 + 지저분한 43% 대시-suffix "what does it mean?"). 부수 수정: 끝마침표 title 깨짐 1,333页·영화명 중복 2,353页. **불변식(원우 확정): H1·상호참조·JSON-LD headline은 label(엔티티) 불변 — 질문은 title·리드 H2·film 페이지 앵커에만.** LLM 폴리싱 2단계는 순수 선택으로 격하(SEO 마스터 §5-7; 0035 마이그레이션 파일 커밋·미적용). 같은 주간 별도 트랙: 백링크 아웃리치 실행(`OUTREACH-실행현황-2026-07-04.md` — Gmail 초안 18건·LibGuides 22곳 검증·매체 티어 리스트).

> **Big shift 2026-07-06 — Tier-2 개방** (정본: `docs/PLAN-tier2-almanac.md`, SEO 색인: `HANDOFF-SEO-마스터.md` §3b-8): Tier-2 5,041편이 이용자 표면 전체에 열림 — 페이지는 **Editor's digest**가 리드(DB 결정론 조합: 정전·평점·인바운드 추천 인용·지리·시청권역·Prestige/Discovery 칩; 바이라인 Wonwoo Yoon + 실데이터 갱신일 + WebPage LD; About 격하; film-load5) + Atlas 미니맵. 사이트 검색은 Tier-2 포함(is_catalog, "catalog" 칩) — 같은 날 통합 엔진 `search_all`로 대체(정본 `HANDOFF-검색엔진-통합.md`; `search_site` v2는 그 징검다리), `/film?view=all` Full catalogue, credits 인물 페이지 Tier-2 링크, Atlas 핀 17,307→**25,029**(표시만, 자격 게이트 불변), director_slug 22→1,022, **stub slug 274편 전량 개명**(slug_aliases +548, /film resolveAlias 배선), /whereto robots 게이트 명시. **색인 정책 변화 없음**(Tier-2 전원 noindex; 선별 개방은 7/16 리뷰 = Track B, 엔진 웨이브 = Track C 대기). — **⚠️ 이 "전원 noindex"는 2026-07-14 통합 게이트로 번복됨**(Track B 실행: 1,105편 승격, 위 07-14~15 배너 참조).

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
| World Cinema Atlas | **Movements** (`/movements`) — origin/tradition axis (≠ geographic Locations) |
| Atlas / `/atlas` · `/film/atlas` · `/room/atlas` | **Locations** / `/locations` · `/film/locations` · `/room/locations` (renamed 2026-07-11; old paths 308→new). Word "atlas" retired sitewide. `lib/atlas_cities.json` + `atlas_*_json` RPCs keep their names (DB/data layer, unchanged). |
| Map / `/map` · `MapExplorer` · `EntityMap` | **Network** / `/network` · `NetworkExplorer` · `EntityNetwork` (renamed 2026-07-11; `/map` 308→`/network`, query-preserving). Visible label stays **"Connections"**. `/api/map` endpoint + `mapApi`/`mapFull` beat keys + `zone:"map"` KEPT (DB-emitted, unchanged). |

> ⚠️ Easily-confused pairs: **frameworks** (14 strong-misreading angles) vs **frames** (community-Q&A). **Movements** (`/movements`, national cinemas + waves) vs **Locations** (`/locations`, geographic filming map; formerly `/atlas`) vs **Network** (`/network`, node connection graph, labelled "Connections"; formerly `/map`). `meta_takes` is **polymorphic** via `kind` (trope hubs + legacy reading hubs).

---

## 2. Live counts (films/directors re-measured 2026-07-15; rest 2026-07-02, live DB `jvgarcqrtsmgfimdcwgo`)

| Entity | Count | Note |
|---|---|---|
| **films** | **6,978** total · **1,959 visible** · **~3,064 indexable mains** | ⚠️ **`visible` ≠ indexable now.** `visible` = auto-computed thinness flag (figures≥3 DB trigger), 1,959 Tier-1. **Indexability = `lib/seo.ts filmIndexBar`** (07-14 consolidation): 1,959 Tier-1 + **1,105 promoted Tier-2** (visible=false but strong-signal) = ~3,064 indexable mains. The other ~3,892 Tier-2 stay noindex. → 정본: HANDOFF-SEO-스타터가이드 §2. |
| figures | **18,168** | all approved |
| takes | 73,478 total · **26,975 published** | rest retired/candidate |
| meta_takes (hubs) | 11,974 rows | published hubs are **tropes** (`kind=figure_type`, ~4.7k); `kind=reading` = legacy unpublished, not surfaced |
| figure_type_members | 19,186 | figure ↔ trope |
| figure_taxonomy | 42,958 | figure ↔ Catalog archetype (`taxonomy_nodes` 2,928) |
| figure_tags / trope_tags | 39,749 / 35,508 | trope-tag output |
| film_affinities | 38,800 | "films like" |
| **directors** | **862** hubs (858 with ≥1 visible film) | ⚠️ **hub robots gate live 2026-07-15** (`lib/directorGate.ts directorIndexBar`): 858 → **678 indexed / 180 noindex** (bare single-film, no editorial layer, records<6). → HANDOFF-Tier2-메인통합 §4 D6. director_embedding 873, portrait/facts 208, picks 1,019, next 1,011 |
| **Cinecodex (`cinecodex.scores`)** | **6,704** | TakeScore live. ⚠️ 음수 U는 표시·스키마에서 `displayTs()` 0클램프(랭킹/API는 raw) — 07-14 SEO 정리. |
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
| **film_sentences** | **466,974 · 13 patterns · 6,713 films (96%)** | **Embedding Fantasia 문장층 (2026-07-11)** — LLM-0 SQL 조립 문장, 전 값 엔티티 FK. + `film_kinship` 27,593(kin 지수, 죽은 affinity score 대체) + `sentence_node_stats`/`sentence_concept_stats`. 정본: 루트 `HANDOFF-임베딩판타지아-문장층.md` |
| magazines / magazine_passages | 137 / 40 | RAG sources |
| _bak_* tables | (several) | cleanup backups from boldtake/trope/consolidation — safe to archive |

---

## 3. Site map (routes → data)

### Discovery / home
- `/` home v7 (`components/home2/HomeV2.tsx`; **Surprise me** hero ← `surprise_home()` via `/api/surprise/home`; mid-page HomeMap; NewsletterCard + editions), `/latest`, `/trending`, `/random/*` (`surprise()`/`surprise_set()`), `/manifesto`, `/home2-app`.
- **The Map (node graph):** `/map` (`MapExplorer`, 3 modes) + embedded `EntityMap` on entity pages. RPCs `map_overview`/`map_ego`/`map_film_*`/`map_director_*`; route `/api/map`. (Map in-map search now goes through the **unified `/api/search`**; the old `/api/map/search` route + `map_search` RPC are retired — see `HANDOFF-검색엔진-통합.md`.)

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
- **`/search` — unified hybrid search (2026-07-06, 정본 `HANDOFF-검색엔진-통합.md`):** all surfaces (page, nav typeahead, global ⌘K palette, home hero, map) go through `lib/search.ts` → **`/api/search`** = lexical `search_all` (12 entity kinds, Tier-2 incl.) + semantic `search_semantic` (pgvector 6-leg, query embedded text-embedding-3-small) fused via RRF + local atlas/genre. Retires `search_site`/`map_search`/`readings_suggest` fragmentation. `/ask`,`/ask/new`,`/chat`,`/rag` → `/api/ask`,`/api/ask/v2`,`/api/rag` (`ask_retrieve`,`magazine_retrieve`).
- **Account:** `/me` (personalization dashboard — pins + `user_movies` + TakeScore portfolio; 상단 📥 가져오기 버튼), **`/me/import`** (관람기록 통합 임포트 위저드 — Letterboxd ZIP/IMDb CSV/엑셀/왓챠/텍스트 붙여넣기 자동감지 → TMDB 매칭 검수 → 무손실 저장; `docs/HANDOFF-IMPORT.md`), `/u/[username]` (public portfolio, `public_portfolio(_meta)`), `/settings`,`/login`,`/signup`,`/reset`,`/auth/*`.
- **Static:** `/about`,`/methodology`,`/credits`,`/contact`,`/privacy`,`/terms`,`/guidelines`,`/blog[/slug]`,`/blog/subscribe`. **Admin:** `/admin/*`,`/editor`. **Legacy mounted:** `/meta-takes`,`/take/[slug]`,`/frames`,`/frame/[slug]`,`/movies-like/[slug]`.
- **API (new):** **`/api/search`** (unified search — see above),`/api/geo`,`/api/map`,`/api/surprise(/home|/set)`,`/api/tmdb-search`,`/api/track`,**`/api/import/parse|match|commit`** (임포트 파이프라인, SSR 세션 필수·쓰기는 service role),`/api/films/search`,`/api/films/backfill`,`/api/readings(/featured|/suggest)`,`/api/account/delete`,`/api/revalidate`,`/api/feed`,`/api/credits`. Plus `/llms.txt`, IndexNow.

---

## 4. Data model (core)

- **films** (`id uuid` PK, `slug`/`tmdb_id` unique, year, director(+slug), genres[], poster/backdrop, tmdb_extra, **visible**, **is_analyzed**, **hold**). Now spans the full **6,978-film Cinecodex universe**; **1,959 visible** (figures≥3 trigger), **~3,064 indexable mains** (visible ≠ indexable — see §2 + `lib/seo.ts filmIndexBar`). Parent of figures + all per-film extras.
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
- **Embeddings** (1536-d) on figures/takes/meta_takes/directors/canon/magazine_passages/taxonomy/theory_canon/film_taste_vector. **Search: unified hybrid** — pg_trgm GIN (`search_all`) + pgvector cosine (`search_semantic`, takes on partial HNSW `idx_takes_pub_emb_hnsw`). See `HANDOFF-검색엔진-통합.md`.

> ⚠️ **Schema-in-VCS gap (widened):** `supabase/migrations/` was frozen at **0001–0026** for a long stretch. Everything in between — the entire Cinecodex/TakeScore layer, all ~20 `me_*` room RPCs, `map_*`, `movements_*`, `sm_concept_*`, `theorist_*`, lineage/geo RPCs, `films.visible` expansion — was applied **directly to the live DB** and is **not** version-controlled. **240+ functions live; only `is_admin`/`handle_new_user` are in `.sql`.** See BACKLOG "schema capture" — highest structural-risk item. **(Bucking the trend: the 2026-07-06 search RPCs `search_all`/`search_semantic`/`film_search` v2 ARE committed — migrations `0040_search_v3.sql` + `0041_search_v3_fixes.sql`. New DB work should follow this.)**

---

## 5. Shipped vs pending

**Shipped & live (as of 2026-07-02):**
- Critical layer: Strong-Misreadings (14 frameworks) · Tropes (re-formed) · Catalog/Archetype · Theory/Theorist/Tradition/Concept(`/idea`).
- Film page full tab set; Reception (8,884); Watch-next (17,095)+Recommended-by; Films-like; **Where-to-watch dedicated page**; Gallery.
- **TakeScore/Cinecodex** — all 6,704 films scored; `/takescore`; sitewide TS badges; confidence (Pass 2). (음수 U는 표시·스키마 0클램프, 랭킹/API raw — 07-14.)
- **정전가 + taste-vector personalization** — `/me` portfolio, taste neighbors, NAV, WWI λ recommender.
- **`/room` OS** — 12 routes (command center/collection/watchlist/desk/analysis/atlas/auteurs/rate/library/write/pair/eval-card).
- **Geographic Atlas** — `/atlas`, film/director Atlas tabs, filmed+setting layers (9,731 pins).
- **Lineage(계보)** — `/lineage`. **Movements** — `/movements`.
- Discovery: The Map (`/map` + embedded) · Home v7 Surprise-me · Newsletter/editions · sticky nav. Watchlists P1+2 (lazy TMDB import, Tier-2). Ask/RAG · search · blog · mobile-first · IndexNow.
- **관람기록 통합 임포트 `/me/import` (2026-07-03)** — 파일(Letterboxd ZIP·IMDb CSV·XLSX·왓챠)/텍스트 붙여넣기 자동감지 → 규칙 파서(+Gemini 폴백) → TMDB 매칭 검수 위저드 → `user_watch_log`(무손실)+`user_movies`(집계) 저장. 파서 셀프테스트 `scripts/import-selftest.ts` 26/26. 상세: `docs/HANDOFF-IMPORT.md`(진행상황 포함) + `docs/IMPORT-watch-history-design.md`(설계).
- **트로프·피겨·아키타입 순위 표면 (2026-07-05~06)** — /trope 멤버 라이브 랭킹(신규 RPC `trope_members_ranked`)+% match+리스티클 타이틀+ItemList/FAQ JSON-LD, 피겨 가시 질문 H2+nearest figures, /catalog 순번·confidence %·날짜/EEAT(이중브랜드 수정), 필름 Tropes 독해제목 라인, /methodology#rankings. 전부 렌더 파생(베이크 없음). 정본: `HANDOFF-트로프피겨아키타입-순위표면.md`.
- **Embedding Fantasia · SQL 문장층 (2026-07-11)** — `film_sentences` 466,974행(13패턴, LLM-0 SQL 조립, 전 값 엔티티 FK) + kin 지수(`film_kinship`) → 표면 전 전개: film `df-know` 모듈+탭(주제 8종 필 네비) · director/theorist/trope/figure/lineage/genre 판타지아 섹션 · 홈+/room SentenceTicker · film df-map+/map 4뷰 SentenceLexicon 회전 레일(클릭=엔티티 리센터) · /map like 엣지 kin 굵기 · N_question 훅 12,419(티커). 브랜드 계약: 설계자 명기+Not-AI 디스클레이머 제거 금지. 마이그 0061~0069. **정본: 루트 `HANDOFF-임베딩판타지아-문장층.md`.**

**Pending (see BACKLOG + `docs/ux/ROOM-LOGIC-AUDIT.md`):**
- **/room reinforcement — P0+P1 DONE (2026-07-03):** `me_coverage`⑦/`me_blindspots`④ shipped+wired; write-actions (담기/봤어요/관심없음/서재 공개토글·즐겨찾기/노트 save_take+sanitize) all real mutations; conquer/gap WWI reasons real-tagged; ticker/system card de-hardcoded (`me_system_status`); `nav_snapshots`+`me_nav_history` asset curve live; `/u/me` 302 fixed; **pair 실구현** (`pair_matches` default-deny + `me_today_pair`/`me_pair_reveal`/`me_pair_history`, 부분노출 RPC 강제); `/api/geo` param whitelist+rate-limit; Atlas continent map DB화 (`country_continents` 156국 + `me_geo_coverage` v2) + dot dedup; 기존 room RPC 18종 스냅샷 역커밋. Migrations `0027–0033`. **Remaining:** cinecodex DDL 역커밋, P3 (per-sub rationale·미니맵·self-host 타일), 정식 엔진 W0–W4 (docs/logic).
- **Schema capture** — reverse-commit the ~200 out-of-band RPCs + DDL into migrations (structural risk).
- **/me/import 마감 확인** — 남은 것은 로그인된 브라우저에서 위저드 클릭스루(§7 A~F)와 커밋 후 DB 무손실 검증뿐 (서버사이드는 전부 검증 완료). ⚠️ 테스트 계정 세션 자동 생성은 권한 분류기가 거부 — 사용자가 직접 로그인 필요. `docs/HANDOFF-IMPORT.md` ⭐섹션 참고.
- Watchlists Phase 3 (promotion); Catalog Concepts→Theory absorption; per-page SEO head-copy; figure aliases; tradition-match automation; `refresh_director_embeddings()` + auto director-gen trigger; new-trope gardening; legacy-doc archival; `_bak_*` table cleanup.
