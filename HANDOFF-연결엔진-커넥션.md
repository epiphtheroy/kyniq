# HANDOFF — 연결 엔진 (Connections: 친족·counterpoint·개념·갤럭시)

*2026-07-04~05 구축. 이 문서 하나로 콜드스타트 가능해야 한다. 설계 배경·실측 진단·실행 이력은 `docs/PLAN-connections-overhaul.md`(그날의 전 과정 로그), 운영 접점은 `docs/RUNBOOK-new-film-ingestion.md §4.3`.*

## 0. 이게 무엇인가 (3줄)

1. 사이트의 모든 "연결"(movies-like, 영화 페이지 Connected/Counterpoints, /map 엣지, /map Galaxy, 개념 조인)은 **계산된 원장**에서 읽는다 — 손튜닝 없음, 렌더 시점 DB 파생(베이크 금지).
2. 친족(kin) = 트롭 TF-IDF + 취향벡터 cosine의 RRF 융합(`film_affinities`), counterpoint = "같은 트롭, 가장 먼 독해"(`entity_edges`), 개념 = 임베딩 정본화(`concept_map`), 갤럭시 = t-SNE 사전좌표(`film_map_xy`/`director_map_xy`).
3. 페이지에는 **근거 수치**(taste match %, shared tropes, diverge %)와 **인장**(By Metatake Editorial · Edited by Wonwoo Yoon · Updated {원장 날짜})이 함께 나간다 — 전부 파생값.

## 1. 파일맵

| 층 | 위치 |
|---|---|
| SQL 정본 (DB 함수와 반드시 동기) | `supabase/rpc/conn_rebuild.sql` `counterpoints.sql` `map_ego.sql` `map_film_ego.sql` `galaxy.sql` `site-stats.sql` `concept-surfaces.sql` · 색인: `supabase/migrations/0034_connections_overhaul.sql` |
| 빌더 (재실행 가능·멱등) | `worker/mt-recommend.py`(친족) `worker/concept-embed.py`(개념, `--write 0.70`) `worker/galaxy-build.py`(`--directors`,`--labels`) `worker/director-profiles.py`(TMDB 감독 사진) |
| 표면 | `app/movies-like/[slug]/page.tsx` · `app/film/[slug]/page.tsx`(df-connected, df-counterpoints) · `app/concept/**` · `app/methodology/page.tsx`(라이브 수치 타일) · `app/api/map/galaxy/route.ts` · `components/GalaxyMap.tsx` `MapExplorer.tsx` `EntityGraph.tsx` |

## 2. 데이터 객체 (읽기 전 이것만 알면 됨)

- **`film_affinities`** (46k행, visible 필름당 24) — score(RRF)·**cos**(취향 cosine, 전 행 보유)·**tfidf**·shared_meta_take_ids(공유 트롭, 희귀 순)·updated_at(페이지 "Updated" 출처). 재건: `worker/mt-recommend.py` → `conn_rebuild_stage_truncate`→`conn_stage_tfidf_chunk`→`conn_stage_knn_chunk`→`conn_affinities_swap`(원자 교체+cos 백필).
- **`entity_edges` kind='counterpoint'** (11k, 필름당 top-8 양방향) — components={trope_id, sim}. 읽기: `film_counterpoints(slug,n)` RPC. 재건 SQL: `supabase/rpc/counterpoints.sql` 주석 2블록(`conn_film_trope_vec` 먼저).
- **`concept_map`** (raw_l→sm_concepts, exact+embed≥0.70) — 개념 조인 6함수(map_ego·map_overview·surprise_home·sm_concept_readings·concept_detail·home_v2_bundle)가 전부 이걸 경유. 커버리지 40%→62%.
- **갤럭시**: `film_map_xy`(1,941)+`film_map_clusters`(14) / `director_map_xy`(873)+`director_map_clusters`(10) / `director_profile`(사진 850/870, TMDB 검증 749). API `/api/map/galaxy(?mode=directors)` ← `galaxy_json`/`galaxy_directors_json`.
- **`film_next_demand`** 뷰 — 미보유 지목 순위(인제스트 우선순위 큐): `select * from film_next_demand order by demanded_by desc`.
- 스테이징(`conn_stage_*`, `conn_film_trope_vec`): RLS 잠금, 재건 RPC는 service_role 전용.

## 3. 불변식 (어기면 조용히 죽는다 — 과거 실제 사고)

1. **`takes.meta_take_id`로 절대 회귀 금지.** 전부 미출판 허브 지목(트롭 개편 유산). 친족·counterpoint는 `takes.trope_id`/`figure_type_members`만 사용. (이걸 어긴 옛 mt-recommend가 film_affinities를 0행으로 만들었고 movies-like 1,935페이지가 전량 noindex로 죽어 있었다.)
2. **개념 exact 조인(`c.name_l=lower(btrim(t.concept))`) 복원 금지** — concept_map 경유가 정본.
3. **DB 함수 수정 시 supabase/rpc/ 사본 동기** — 여기 나열된 함수들은 레포가 정본이다.
4. **map_ego류에 `order by random()` 재도입 금지** — 결정론(같은 입력=같은 그래프=캐시 가능)이 규약.
5. **galaxy 좌표 재빌드 = 새 판**(t-SNE 전면 이동) — 분기 1회급 이벤트로 취급, 수시 재빌드 금지. seed 42 고정.
6. 페이지 산문·수치는 렌더 파생 — 연결 관련 숫자·문장을 하드코딩하지 말 것(방법론 수치는 `methodology_stats_json`).

## 4. 상황별 절차

- **새 영화 배치 후** → RUNBOOK §4.3 (a: mt-recommend, b: counterpoint 2블록, c: 새 개념이면 concept-embed, d: film_next 백필 1줄).
- **트롭 개편(trope-build --reset 등) 후** → 위 a+b 필수(트롭 id가 전부 바뀜), concept은 무관.
- **연결이 이상해 보일 때** → ISR 캐시 함정 먼저 의심(5분+SWR, 캐시버스터로 확인) → `film_affinities` 행수(≈46k)와 updated_at 확인 → 스테이징 카운트.
- **새 감독 유입** → Stage 16(임베딩) 후 `galaxy-build.py --directors`는 다음 판까지 보류 가능, `director-profiles.py`는 증분 실행(기존 스킵).

## 5. 남은 결정·확장 여지

- reading 허브(5,818건 미출판)는 **재출판 안 함으로 확정**(counterpoint+concept_map이 대체) — 뒤집으려면 콘텐츠 판단부터.
- counterpoint의 감독 버전, Galaxy 검색 연동(map_search→locate), entity_edges로 kin 이관(현재 film_affinities가 kin 정본) 등은 미착수 아이디어.
- TS 포스터 오버레이 배지는 2026-07-05 전면 철거(`TakeScoreBadges` 삭제) — 재도입하려면 새로 만들 것.
