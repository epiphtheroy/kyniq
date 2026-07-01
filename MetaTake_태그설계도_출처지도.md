# MetaTake — 영화 계보 태그 설계도 & 출처 지도

> 목적: 사용자가 본 영화·별점을 기반으로 "별자리(constellation)" 로직으로 영화를 추천하기 위한 **내부 태그 기준**을 정의하고, 동시에 사용자가 전체 목록을 열람할 수 있는 **공개 DB/웹사이트**의 토대를 만든다. 모든 출처는 명시(credit)한다.
>
> 작성일: 2026-06-24

---

## 0. 설계 원칙

1. **직접 모으지 않는다, 합친다.** 정전 리스트·영화제 수상·사조는 이미 정리되어 있다. 핵심은 수집이 아니라 *공통 ID로 합치고 그 위에 태그를 거는 것*.
2. **모든 것은 ID에 고정한다.** 영화/인물을 자체 ID + 외부 ID(Wikidata QID, TMDb, IMDb)에 묶어 출처가 달라도 중복 없이 병합한다. → 이 한 가지가 설계의 성패를 가른다.
3. **태그는 "축(facet)"이다.** 정전·수상·영화제·사조·작가·국가는 각각 별자리를 그리는 좌표축. 태그마다 *권위 가중치*와 *희소도*를 부여해 추천에 그대로 쓴다.
4. **공개 가능한 토대와 신호용 출처를 분리한다.** 공개 DB의 뼈대는 라이선스가 자유로운 Wikidata(CC0). 저작권 있는 랭킹(TSPDT 등)은 *내부 신호·시드*로 쓰고 출처를 밝히되 전체 랭킹 재배포는 신중히.

---

## 1. 데이터 모델 개요

여섯 개의 엔티티로 충분하다.

```
   ┌──────────┐        ┌──────────────┐        ┌─────────┐
   │  person  │◀──────▶│     film     │◀──────▶│   tag   │
   │ (감독 등) │ 제작진  │  (작품)       │ film_tag│ (태그)   │
   └──────────┘        └──────────────┘   ▲    └────┬────┘
                                          │         │ parent_tag (계층)
                                       (다대다)      ▼
                                          │     ┌─────────┐
                                          └─────│ source  │  (출처)
                                                └─────────┘
```

- `film` ↔ `tag` 는 **다대다**이며, 그 연결 자체(`film_tag`)가 별자리의 직물(fabric)이다.
- `film_tag` 한 줄에 *순위/수상종류/연도 + 출처 + 신뢰도*를 담는다.
- `tag`는 계층(부모 태그)을 가진다. 예) `칸 영화제 > 황금종려상 > 2019`.

---

## 2. 테이블별 스키마

### 2.1 `film` (작품)

| 필드 | 타입 | 설명 |
|---|---|---|
| `film_id` | PK | 내부 고유 ID |
| `wikidata_qid` | str | 병합의 기준 앵커 (예: Q47703) |
| `tmdb_id` | int | TMDb 영화 ID |
| `imdb_id` | str | tt 형식 (예: tt0118799) |
| `title_original` | str | 원어 제목 |
| `title_en` | str | 영문 제목 |
| `title_ko` | str | 한국어 제목 |
| `year` | int | 개봉/제작년도 |
| `runtime` | int | 상영시간(분) |
| `country` | str[] | 제작국 (ISO 코드) |
| `language` | str[] | 언어 |
| `director_ids` | FK[] | 감독(person) |
| `decade` | str | 파생: 1990s 등 (era 축) |

### 2.2 `person` (인물)

| 필드 | 타입 | 설명 |
|---|---|---|
| `person_id` | PK | 내부 ID |
| `wikidata_qid` | str | 앵커 |
| `tmdb_id` | int | TMDb 인물 ID |
| `name` / `name_ko` | str | 이름 |
| `roles` | str[] | director / writer / dop … |
| `country` | str | 국적 |

### 2.3 `tag` (태그 — 별자리의 좌표축)

| 필드 | 타입 | 설명 |
|---|---|---|
| `tag_id` | PK | 예: `award.cannes.palme_dor` |
| `facet` | enum | 아래 §3의 분류 (canon/award/festival/movement/auteur/national/genre/era) |
| `label` / `label_ko` | str | 표시명 |
| `parent_tag_id` | FK | 계층 (없으면 null) |
| `source_id` | FK | 이 태그의 권위 출처 |
| `authority_weight` | float | 권위·선별성 (0~1). 황금종려상↑, 일반 셀렉션↓ |
| `selectivity` | float | 파생: 이 태그를 가진 영화 비율의 역수(IDF). 희소할수록↑ |
| `description` | str | 정의 |

### 2.4 `film_tag` (연결 — 가장 중요한 테이블)

| 필드 | 타입 | 설명 |
|---|---|---|
| `film_id` | FK | |
| `tag_id` | FK | |
| `value` | str/int | 랭킹 내 순위, 수상 세부(대상/감독상/심사위원상), 수상 연도 등 |
| `confidence` | float | 매칭 신뢰도 (자동 병합 시 낮춤) |
| `source_id` | FK | 이 연결의 근거 출처 |

### 2.5 `source` (출처)

| 필드 | 타입 | 설명 |
|---|---|---|
| `source_id` | PK | |
| `name` | str | TSPDT, Wikidata, TMDb … |
| `url` | str | |
| `type` | enum | aggregator / structured_db / api / official_archive / community |
| `license` | str | CC0 / 비상업 / 독점 등 |
| `access` | str | 엑셀 다운로드 / SPARQL / REST API … |
| `cadence` | str | 갱신 주기 (연 1회, 10년, 상시 등) |
| `credit_string` | str | 사이트에 표기할 문구 |

---

## 3. 태그 분류 체계 (Facets)

각 facet이 별자리의 한 좌표축이다. `tag_id`는 `facet.그룹.항목` 규칙으로 짓는다.

### 3.1 `canon` — 정전 리스트
- `canon.tspdt.1000`, `canon.tspdt.starting` (26,551편)
- `canon.sightsound.2022_critics`, `canon.sightsound.2022_directors`
- `canon.1001_movies`, `canon.afi.100`, `canon.criterion.collection`
- `value` = 리스트 내 순위. → 상위권일수록 강한 신호.

### 3.2 `award` — 수상
- `award.cannes.palme_dor`, `award.cannes.grand_prix`, `award.cannes.best_director`
- `award.venice.golden_lion`, `award.berlin.golden_bear`
- `award.oscar.best_picture`, `award.oscar.best_intl_feature`
- 수상/후보를 `value`(won/nominated)로 구분. 후보도 약한 신호로 보존.

### 3.3 `festival_selection` — 영화제 진출 (수상 아니어도 신호)
- `festival.cannes.competition`, `festival.venice.competition`
- `festival.sundance`, `festival.tiff`, `festival.busan`, `festival.rotterdam`, `festival.locarno`
- "세계 시네필이 들어봤을" 영화제로 범위 한정(아래 권장 목록).

### 3.4 `movement` — 사조
- `movement.french_new_wave`, `movement.italian_neorealism`, `movement.new_german_cinema`
- `movement.asian_new_wave` (하위: `.hk_second_wave`, `.taiwan_new_cinema`, `.korean_new_wave`, `.iranian_new_wave`)
- `movement.new_hollywood`, `movement.dogme95`
- 사조는 연도·국가로 자동 1차 분류 후 *수작업 보정*이 필요(가장 주관적인 축).

### 3.5 `auteur` — 작가/필모그래피
- `auteur.<person_id>` (감독을 태그로 승격). 같은 감독 영화가 한 별자리에 묶임.
- 사실상 `film.director_ids`에서 파생 가능하지만, 추천 그래프에서 *명시적 간선*으로 쓰면 편리.

### 3.6 `national` — 국가별 정전 / 올해의 영화
- `national.kr.year_best.<연도>`, `national.fr.cesar.best_film`, `national.jp.kinema_junpo`

### 3.7 보조 축: `genre`, `era`
- TMDb 장르/키워드, 10년 단위 시대. 정밀 추천의 미세 좌표.

---

## 4. "별자리" 추천 로직과 스키마의 연결

스키마는 추천 로직이 **그대로 계산할 수 있도록** 설계했다.

**(1) 영화 = 가중 태그 벡터.**
각 영화는 자신이 가진 태그들의 희소 벡터로 표현된다. 태그 i의 가중치는
`w_i = authority_weight_i × selectivity_i` (권위 × 희소도).
→ 흔한 태그(예: "드라마 장르")는 약하게, 희소·권위 태그(예: "황금종려상")는 강하게 작용. (TF-IDF의 IDF와 동일한 직관.)

**(2) 영화 간 유사도 = 공유 태그 기반.**
가중 코사인 또는 가중 자카드. *값 있는* 태그는 거리도 고려(예: 같은 정전에서 가까운 순위면 더 가깝게).

**(3) 사용자 프로필 = 별점 가중 태그 합.**
사용자가 높게 준 영화들의 태그 벡터를 별점으로 가중 합산 → 사용자의 "별자리 지문". 여기에 가까운 미관람작을 추천.

**(4) 설명가능성(별자리의 강점).**
추천 근거를 태그로 그대로 제시 가능: "당신이 좋아한 〈화양연화〉와 같은 *아시아 뉴웨이브 + 칸 + 왕가위* 별자리에 속함." → 공개 DB의 UX와 직결.

> 설계 함의: 그래서 `authority_weight`와 `selectivity`를 태그 테이블에 1급 필드로 두었다. `selectivity`는 데이터 적재 후 자동 계산(전체 영화 수 ÷ 태그 보유 영화 수의 로그).

---

## 5. 출처 지도 (Source Map)

### 5.1 한눈에 보기

| 출처 | 무엇을 주는가 | 접근 | 라이선스 | 갱신 | 공개DB 사용 |
|---|---|---|---|---|---|
| **Wikidata** | 감독·수상·영화제·제작국·사조 관계, 외부 ID 크로스워크 | SPARQL (무료) | **CC0 (완전 자유)** | 상시 | ✅ 뼈대로 적합 |
| **TMDb** | 메타데이터, 포스터, 키워드/장르, ID 허브 | REST API (무료/비상업) | 비상업 무료, 상업은 별도 계약 + 출처표기 | 상시 | ⚠️ 상업 시 계약 필요 |
| **TSPDT** | 1000대 영화 + 26,551편 시작목록(집계 랭킹) | 엑셀 다운로드 | 독점(편집저작물) | 연 1회 | ⚠️ 신호/시드용·전체랭킹 재배포 주의 |
| **Sight & Sound (BFI)** | 비평가/감독 투표 정전 Top 100/250/1000 | 웹 게시 | BFI 저작 | 10년 주기 | ⚠️ 출처표기·발췌 |
| **iCheckMovies** | 수백 개 정전/영화제 리스트 + 태그 구조(참고 설계 모델) | 웹 | 독점 | 상시 | 참고용(벌크 X) |
| **IMDb datasets** | 기본 메타·평점 | TSV 다운로드 | **개인·비상업 한정** | 일간 | ❌ 공개·상업 DB엔 부적합 |
| **영화제 공식 아카이브** | 칸·베니스·베를린·아카데미 수상 원본 | 웹/문서 | 각자 | 연 1회 | 교차검증용 |
| **Letterboxd** | 커뮤니티 큐레이션 리스트 | API(승인제) | 데이터분석·LLM·개인프로젝트 **승인 안 함** | 상시 | ❌ 벌크 불가 |

### 5.2 출처별 메모

- **Wikidata** — 공개 DB의 *뼈대*로 삼아라. 라이선스가 CC0라 상업·공개에 제약이 없고, 수상·영화제·감독·국가가 이미 관계로 들어 있다. SPARQL로 "칸 황금종려상 전 수상작 + 감독 + 제작국"을 한 번에 뽑을 수 있다.
- **TMDb** — ID 허브 + 포스터/메타데이터 표시용. 무료지만 *공개 서비스가 상업적*이면 별도 계약이 필요하고, "This product uses the TMDB API but is not endorsed or certified by TMDB." 표기가 요구된다.
- **TSPDT** — 가장 강력한 *시드*이자 권위 신호. 단, 1000대/시작목록 자체가 그들의 편집저작물이므로 내부 가중치·시드로 쓰고 출처를 밝히되, *전체 랭킹을 그대로 공개 재게시*하려면 사전 문의를 권한다.
- **IMDb / Letterboxd** — 공개·상업 DB의 데이터 소스로는 피하라(라이선스 제약). 개인 검증·아이디어 참고까지만.

### 5.3 권장 영화제 범위 (시네필 인지도 기준, 1차)
칸 · 베니스 · 베를린(3대) → 선댄스 · 토론토(TIFF) · 로카르노 · 로테르담 · 칸 비평가주간/감독주간 · 부산 · 카를로비바리 · 산세바스티안 · 텔루라이드. *처음에 이 목록을 못 박아 범위 폭주를 막는다.*

---

## 6. ID 해소(병합) 전략

병합 실패 = 중복 영화. 다음 순서로 앵커를 잡는다.

1. **Wikidata QID를 마스터 키로 삼는다.** Wikidata 항목은 IMDb ID(P345), TMDb 영화 ID(P4947) 등을 이미 보관 → 한 항목에서 세 ID를 동시에 회수.
2. **부족분은 TMDb로 보강.** TMDb `external_ids` 엔드포인트가 IMDb ID 등을 반환.
3. **외부 ID가 없는 리스트(TSPDT 엑셀 등)는** `제목(원어/영문) + 연도 + 감독` 3중 키로 퍼지 매칭 → `confidence`를 낮춰 기록하고 사람이 검수.
4. 매칭 충돌은 `film_tag.confidence`로 표시하고 검수 큐로 보낸다.

---

## 7. 공개 DB를 위한 라이선스 정리 (요약)

- **안전한 공개 스택:** Wikidata(CC0) = 데이터 뼈대 + TMDb(출처표기, 상업 시 계약) = 표시용 메타/이미지.
- **신호로만, 재배포는 신중:** TSPDT·Sight & Sound·각 영화제 랭킹 → 내부 가중치/시드로 사용, 화면엔 "출처: …" 명시. 전체 랭킹 복제 게시는 권리 확인.
- **공개 DB에서 배제:** IMDb 데이터셋(비상업 한정), Letterboxd 스크래핑(약관 위반).
- 모든 출처는 사이트에 *명시*한다는 방침이 라이선스 측면에서도 유리하다.

---

## 8. 단계별 구축 로드맵

1. **스키마 확정** — 본 문서의 테이블/태그 ID 규칙 동결.
2. **뼈대 적재** — Wikidata SPARQL로 영화·감독·수상·영화제·제작국 + 외부 ID 일괄 수집 → DB(Postgres/SQLite).
3. **시드 병합** — TSPDT 엑셀 / Sight & Sound를 `canon.*` 태그로 병합(퍼지 매칭 + 검수).
4. **사조 보정** — `movement.*` 자동 1차 분류 후 수작업 검수.
5. **가중치 계산** — `selectivity` 자동 산출, `authority_weight` 수작업 튜닝.
6. **추천 프로토타입** — 가중 태그 벡터 + 유사도로 "별자리" PoC.
7. **공개 DB/웹** — Wikidata+TMDb 기반 열람 UI, 출처 표기.

---

## 부록 A. 예시 레코드 — 〈화양연화〉

스키마가 실제로 어떻게 채워지는지 보여주는 한 편.

**film**
```
title_ko: 화양연화 / title_en: In the Mood for Love / year: 2000
country: [HK] / director_ids: [왕가위] / decade: 2000s
wikidata_qid: Q208101  (예시) / tmdb_id, imdb_id 연결
```

**film_tag (별자리 좌표들)**
| tag_id | value | 의미 |
|---|---|---|
| `auteur.wong_kar_wai` | — | 왕가위 필모 |
| `movement.asian_new_wave.hk_second_wave` | — | 홍콩 뉴웨이브 |
| `award.cannes.best_actor` | 2000 (량차오웨이) | 칸 남우주연 |
| `festival.cannes.competition` | 2000 | 칸 경쟁부문 |
| `canon.sightsound.2022_critics` | (상위권) | 2022 정전 |
| `canon.tspdt.1000` | (순위) | TSPDT 1000 |

→ 추천 시: 이 영화를 좋아한 사용자에게 *왕가위 다른 작품 / 홍콩·대만 뉴웨이브 / 칸 경쟁부문 + Sight&Sound 정전* 별자리의 미관람작을 권하고, 그 근거를 위 태그로 그대로 설명한다.

---

*모든 출처(Wikidata, TMDb, TSPDT, BFI Sight & Sound, iCheckMovies, 각 영화제, IMDb)는 서비스 내에 명시한다.*
