# MetaTake — 계보(Lineage) 태그 통합 설계도 v2

> 기존 Supabase 스키마(`kyniq` 프로젝트)를 직접 분석하여, **필드 충돌 없이** 계보(정전·수상·영화제·사조·국가) 태그를 기존 추천 구조에 붙이는 설계.
> 작성일: 2026-06-24 · 대상 DB: `jvgarcqrtsmgfimdcwgo` (kyniq)

---

## 1. 기존 스키마 분석 결과 (핵심)

MetaTake는 이미 정교한 3층 구조를 갖고 있습니다. 계보 태그를 어디에 붙일지는 이 구조를 정확히 이해해야 결정됩니다.

**(A) 영화 코어**
- `films` — 1,957편. **`tmdb_id`가 100% 채워진 실질 앵커이자 UNIQUE 키.** `imdb_id`·`wikidata_id`는 거의 비어 있음(각 5/1957). `slug`는 `제목-연도`(예: `2001-a-space-odyssey-1968`). `genres[]`·`keywords[]`는 TMDb 소유. `visible`/`hold`/`in_pipeline`/`pipeline_status`로 노출 단계 관리.
- `directors` — 862행. `slug` UNIQUE, `tmdb_person_id` UNIQUE. 단, `films.director_slug`가 일부 오염(예: Tarkovsky 영화에 엉뚱한 slug). → 작가(auteur) 연결은 신뢰도 보정 필요.

**(B) 영화 내부(diegetic) 분석층 — 계보와 무관**
- `figures` (18,168) — 영화 안의 모티프·인물·요소. `taxonomy_nodes`(2,928, `parent_id` 계층)로 분류, 연결은 `figure_taxonomy`(axis: theme/char_identity/location/object…).
- → **`taxonomy_nodes`는 "영화 안에 무엇이 있는가"의 어휘**입니다. 계보(영화의 외적 이력)와 결이 다릅니다.

**(C) 해석(interpretive)층 + 추천 직물**
- `meta_takes` (11,974, kind=`reading`/`figure_type`) — 비평 이론 렌즈. `meta_take_edges`로 그래프화.
- `film_affinities` (`film_id, related_film_id, score, shared_meta_take_ids[]`) — **이미 "공유 meta_take 기반"의 별자리 추천 직물.** (현재 0행, 계산 대기)
- `film_next` (17,095) — 에디토리얼 "다음에 볼 영화".

**(D) 비어 있는/별개 태그 시스템**
- `canonical_tags`(slug UNIQUE) + `tag_aliases` + `question_tags` — **질문(question)용 태그**. 거의 비어 있음. 영화 계보용이 아님.

### 결론
정전·수상·영화제·사조 같은 **"영화의 외적 계보"를 담는 자리는 현재 어디에도 없습니다.**
`taxonomy_nodes`(내부 분석)·`meta_takes`(해석)·`canonical_tags`(질문)·`films.keywords`(TMDb)는 모두 다른 축이라 재사용하면 의미가 섞입니다. → **전용 계보 레이어를 새로 추가**하되, 기존 명명·패턴을 그대로 따릅니다.

---

## 2. 충돌 회피 원칙 (요청사항 직접 반영)

| 충돌 위험 | 회피 방식 |
|---|---|
| `films.genres` / `films.keywords` (TMDb 소유) | 계보를 절대 여기 넣지 않음. 별도 테이블. |
| `canonical_tags` (질문 태그, slug UNIQUE) | 손대지 않음. 계보는 별도 vocabulary. |
| `taxonomy_nodes` (figure 내부 분석, grain=figure) | 손대지 않음. 계보 grain은 film이라 별도 junction. |
| `meta_takes` (해석 렌즈) | 손대지 않음. 계보는 외적 이력 축. |
| 새 테이블/컬럼 이름 | 기존에 없는 이름만 사용: `lineage_lists`, `film_lineage`, `lineage_list_aliases`, `lineage_sources`. |
| `film_affinities` 변경 | 기존 컬럼 수정 금지. **추가(additive) nullable 컬럼만**: `shared_list_ids`, `lineage_score`. |
| slug/URL 충돌 | `lineage_lists.slug`는 자기 테이블 내 UNIQUE. 공개 라우팅은 `/lists/<slug>`로 `/takes`·`/films`와 분리. |

핵심: **기존 컬럼·값은 하나도 건드리지 않고**, 새 레이어를 평행하게 얹습니다.

---

## 3. 신규 테이블 설계 (기존 컨벤션 그대로)

기존 패턴을 모두 따릅니다: `id uuid`, kebab `slug`, `kind`/`facet` text, 유연 `jsonb`, `embedding`(pgvector, 이미 사용 중) optional, `status`/`merged_into`, `created_at`/`updated_at`, 자유 `source` text.

### 3.1 `lineage_lists` — 계보 어휘(리스트/축)
정전 리스트·수상 카테고리·영화제 섹션·사조·국가 정전을 *하나의 항목 = 하나의 리스트*로 표현. `parent_id`로 계층(영화제 > 부문 > 수상).

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | |
| `facet` | text NOT NULL | `canon` / `award` / `festival` / `movement` / `national` / `era` |
| `slug` | text **UNIQUE** | `tspdt-1000`, `cannes-palme-dor`, `sight-and-sound-2022-critics`, `asian-new-wave` |
| `label` / `label_ko` | text | 표시명 |
| `parent_id` | uuid → lineage_lists | 계층 (없으면 null) |
| `authority_weight` | numeric | 권위·선별성(0~1). 수작업 튜닝. 황금종려상↑, 일반 셀렉션↓ |
| `selectivity` | numeric | 파생(IDF): 희소할수록↑. 적재 후 자동 계산 |
| `film_count` | int | 파생. (meta_takes.film_count와 동일 패턴) |
| `external_ref` | jsonb | `{ "wikidata":"Q47730", "url":"…" }` 영화제/수상 자체의 외부 ID |
| `source` | text | `tspdt` / `wikidata` / `bfi` … (free-text, 기존 패턴) |
| `description` | text | |
| `embedding` | vector | optional, "유사 리스트" 검색용 |
| `status` | text DEFAULT `active` | |
| `merged_into` | uuid | 중복 병합 (기존 패턴) |
| `created_at`/`updated_at` | timestamptz | |

### 3.2 `film_lineage` — 영화 ↔ 리스트 (별자리 직물)
`figure_taxonomy`/`film_features` 패턴을 그대로 따른 junction.

| 필드 | 타입 | 설명 |
|---|---|---|
| `film_id` | uuid → films | |
| `list_id` | uuid → lineage_lists | |
| `facet` | text NOT NULL | 빠른 필터용 비정규화(= lineage_lists.facet) |
| `value` | jsonb | canon: `{"rank":5}` · award: `{"result":"won","year":2019}` · festival: `{"section":"competition","year":2000}` |
| `confidence` | numeric | 자동 병합 시 낮춤(퍼지 매칭) |
| `source` | text | |
| `created_at` | timestamptz | |
| **PK** | (film_id, list_id) | figure_taxonomy 스타일 |

### 3.3 `lineage_list_aliases` — 리스트 별칭 (선택)
`tag_aliases`/`meta_take_aliases`와 동형. 외부 리스트명 표기 흔들림 흡수.
`alias text PK`, `list_id uuid → lineage_lists`, `created_at`.

### 3.4 `lineage_sources` — 출처 메타(공개 크레딧용, 선택)
"다양한 출처는 밝힌다"는 요건을 위한 정규화 테이블. (간단히 가려면 위 `source` text만 써도 됨.)
`id`, `name`, `url`, `type`(aggregator/structured_db/api/official_archive), `license`, `access`, `cadence`, `credit_string`, `created_at`.

### 3.5 `film_affinities` 확장 (additive only)
기존 컬럼 불변, **추가만**:
- `shared_list_ids uuid[]` — 공유 계보 리스트(설명가능 추천 근거)
- `lineage_score numeric` — 계보 기반 유사도 성분

> 분리 선호 시 대안: 별도 `film_lineage_affinities(film_id, related_film_id, score, shared_list_ids[])`를 만들고 쿼리 시 합산. (충돌 0, 단 테이블 1개 추가)

---

## 4. "별자리" 추천에의 연결

기존 `film_affinities`(meta_take 기반)에 **계보 성분을 가산**합니다. 설계가 바로 계산되도록 가중치 필드를 1급으로 두었습니다.

1. **영화 = 가중 리스트 벡터.** 리스트 i의 가중치 `w_i = authority_weight_i × selectivity_i`(권위 × 희소도; TF-IDF의 IDF 직관). 흔한 축(예: "드라마")은 약하게, 희소·권위 축(예: 황금종려상)은 강하게.
2. **계보 유사도** = 공유 리스트 가중 코사인/자카드 → `film_affinities.lineage_score`, 공유 항목은 `shared_list_ids`.
3. **최종 점수** = `α·(meta_take 유사도) + β·(lineage_score)` 블렌딩(α,β 튜닝).
4. **설명가능성** = 추천 근거를 그대로 노출: "당신이 좋아한 〈화양연화〉와 같은 *아시아 뉴웨이브 + 칸 경쟁부문 + Sight & Sound 2022* 계보." → 공개 DB UX·SEO에 직결.
5. **작가(auteur)** 는 리스트로 중복 적재하지 않고 `films.director_slug`/`directors`를 직접 신호로 사용(데이터 중복 방지). 단 director_slug 오염 보정 필요.

---

## 5. ID 앵커 & 적재(ingestion) 전략 — *현실 데이터 기준 수정*

이전 v1은 Wikidata QID를 마스터로 가정했으나, **실제 DB는 `tmdb_id`가 유일하게 100% 채워진 앵커**입니다. 전략을 수정합니다.

1. **`films.tmdb_id`를 마스터 키로.** 모든 외부 계보 데이터를 tmdb_id로 해소해 `film_lineage`에 연결.
2. **Wikidata 적재 시 TMDb ID(P4947)·IMDb ID(P345)를 함께 회수** → `films.tmdb_id`로 매칭하고, 그 과정에서 **비어 있는 `films.wikidata_id`/`films.imdb_id`를 backfill**(기존 빈 컬럼 채우기 = 충돌 없음, 향후 조인 품질↑).
3. **TMDb ID가 없는 소스(TSPDT 엑셀 등)** 는 `제목+연도+감독` 퍼지 매칭 → tmdb_id, `film_lineage.confidence` 낮춰 기록 후 검수.
4. **DB에 없는 정전 영화**(예: TSPDT 1000 중 미보유분)는 `films`에 tmdb_id로 stub 생성하되 `visible=false`/`hold` 또는 `in_pipeline`로 스테이징(기존 노출 플래그 활용).

---

## 6. 라이선스 / 공개 DB (요약)

- **공개 토대:** Wikidata(CC0) = 수상·영화제·제작국·사조 관계. `tmdb_id` 매칭으로 흡수. 표시 메타/포스터는 TMDb(상업 시 별도 계약 + "uses TMDB API…" 표기).
- **신호·시드로만, 전체 재배포 주의:** TSPDT 1000 / Sight & Sound / 영화제 랭킹 → `authority_weight`·시드로 사용, 화면엔 `lineage_sources.credit_string` 명시.
- **공개 DB 배제:** IMDb 데이터셋(비상업 한정), Letterboxd 스크래핑(약관 위반).

---

## 7. 적재 로드맵

1. 마이그레이션 적용(§3 DDL — 동봉 `lineage_schema.sql`).
2. `lineage_lists` 시드: 3대 영화제 부문 + Sight & Sound 2022 + TSPDT 1000 + 주요 사조 + 국가 정전.
3. Wikidata SPARQL로 수상/영화제 → tmdb_id 매칭 → `film_lineage` 적재 + `films` 외부 ID backfill.
4. TSPDT/정전 엑셀 퍼지 매칭 적재(검수 큐).
5. `selectivity`/`film_count` 자동 산출, `authority_weight` 튜닝.
6. `film_affinities.lineage_score`/`shared_list_ids` 계산 → 블렌딩 추천.
7. 공개 `/lists` 브라우즈 UI + 출처 크레딧.

---

## 부록 A. 예시 — 〈화양연화〉(In the Mood for Love)

**lineage_lists (어휘, 일부)**
| slug | facet | label | parent | authority_weight |
|---|---|---|---|---|
| `cannes` | festival | 칸 영화제 | — | — |
| `cannes-competition` | festival | 칸 경쟁부문 | cannes | 0.7 |
| `cannes-best-actor` | award | 칸 남우주연상 | cannes | 0.85 |
| `sight-and-sound-2022-critics` | canon | S&S 2022 비평가 | — | 0.95 |
| `tspdt-1000` | canon | TSPDT 1000 | — | 0.9 |
| `asian-new-wave` | movement | 아시아 뉴웨이브 | — | 0.6 |
| `hk-second-wave` | movement | 홍콩 2세대 뉴웨이브 | asian-new-wave | 0.6 |

**film_lineage (연결)**
| film(tmdb) | list_id(slug) | facet | value |
|---|---|---|---|
| 화양연화 | `cannes-best-actor` | award | `{"result":"won","year":2000}` |
| 화양연화 | `cannes-competition` | festival | `{"year":2000}` |
| 화양연화 | `sight-and-sound-2022-critics` | canon | `{"rank":5}` |
| 화양연화 | `tspdt-1000` | canon | `{"rank":...}` |
| 화양연화 | `hk-second-wave` | movement | `{}` |

→ 추천: 이 영화 애호 사용자에게 *홍콩 뉴웨이브 + 칸 경쟁부문 + S&S 정전* 계보의 미관람작을 권하고, `shared_list_ids`로 근거를 그대로 노출.

---

## 부록 B. 대안 — `taxonomy_nodes` 재사용안 (참고)
테이블 수를 줄이려면 `taxonomy_nodes`에 새 `kind`(`canon`/`award`/`festival`/`movement`)를 추가하고 새 junction `film_taxonomy(film_id,node_id,axis,value,...)`를 두는 방법도 가능합니다. 단 (1) figure 분석 어휘와 영화 계보가 한 테이블에 섞이고 (2) grain(figure vs film)이 달라 쿼리·운영이 복잡해집니다. **공개 "리스트 브라우즈"와 깔끔한 분리를 위해 §3 전용 레이어를 권장합니다.**

---

*모든 외부 출처(Wikidata, TMDb, TSPDT, BFI Sight & Sound, 각 영화제)는 서비스에 명시합니다. 본 설계는 기존 컬럼/값을 일절 변경하지 않으며, 추가 컬럼은 nullable·additive입니다.*
