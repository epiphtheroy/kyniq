# 아우터(작가주의 감독) 라인 스펙 · v1

> 국가별 대표 작가주의 감독을 "라인"으로 관리하고, 그 **대표작을 계보 라인에 태운다.**
> 결정 반영: 감독은 `facet=auteur` 라인 + `country` 축으로 국가 라인에 합류 / 대표작은 career-defining·recent 를 **태그로 구분**해 둘 다 포함.

---

## 1. 모델 (3층 + country 축)

- **사람** = `directors`(기존, `tmdb_person_id` UNIQUE). 봉준호라는 *사람*은 여기 1행.
- **라인** = `lineage_lists` `facet=auteur` 1행 = "봉준호 대표작 라인". `country='kr'`, `external_ref`에 person 연결.
- **대표작** = `film_lineage` 간선(해당 auteur 라인 ↔ 영화), `value.rep_type`로 구분.

→ 추천 엔진에서 "공유 감독"이 영화제·정전·사조와 **동일한 `shared_list_ids` 신호**로 흐른다.
→ 공개 "한국 페이지" = `country='kr'` 한 줄로 national 시상식·정전 + 한국 auteur 라인이 함께 노출.

## 2. ID 해소 — 마스터가 처리 (에이전트는 tmdb id 추측 금지)

- **사람**: `name`(로마자) + `wikidata`(QID) + `birth_year` 로 식별 → 마스터가 Wikidata `P4985`(TMDb person id)로 `tmdb_person_id` 해소 → `directors` 매칭/생성.
- **영화**: `film_title` + `film_year`(+`film_wikidata`) → 마스터가 `tmdb_id` 해소 → `films` 매칭/생성(없으면 `visible=false` stub).
- 이유: 에이전트가 tmdb 정수 ID를 지어내면 오염된다. 사람·작품은 QID/이름+연도가 더 안전하게 검증된다.

## 3. 감독 등급 — 5그룹 (G1–G5)

감독은 "급이 다르다" — 리스트의 T1–T4(권위)와 **별개의 5단계 신뢰도 척도**(사용자 제공 prior, `sources/director_grades_source.md`). 점수 낮을수록(1) 보장도 높음.

| group | 의미 | authority_weight | 예 |
|---|---|---|---|
| G1 | 보장 수표(매 작품이 사건) | 0.92 | 봉준호·PTA·하네케·쿠아론·란티모스 |
| G2 | 강력 추천 | 0.82 | 이냐리투·하마구치·페촐트 |
| G3 | 믿고 볼 만함 | 0.70 | 셔젤·시아마·마르텔 |
| G4 | 편차 있음(호불호) | 0.55 | 레픈·돌란·세라 |
| G5 | 모험/신예 | 0.40 | 신진·실험적(필모 얕음) |

- 리스트=`tier`(T1–T4), 감독=`group`(G1–G5). 추천 엔진은 둘 다 `authority_weight`(0–1)로 통일.
- **수정 1 — 데이터로 보정**: 사용자 리스트는 *prior*. 에이전트가 그 감독 대표작의 실제 수상/정전 라인(Palme·S&S·아카데미…)으로 group을 **객관 보정**(주관·지역·최신성 편향 완화). 사용자 명시 허락("데이터 수정 가능").
- **수정 2 — 내부 신호로만**: 살아있는 감독을 *공개 랭킹*으로 노출하면 논쟁·평판 리스크. group은 **추천 가중·영화 선정에만** 쓰고 공개 UI엔 비노출(또는 완곡 표현).

## 4. 산출물 스키마

### `seeds/auteurs.csv`
`slug, name, country, also_country, wikidata, birth_year, group, authority_weight, source, notes`
- `slug`: `auteur-<name-kebab>` (예: `auteur-bong-joon-ho`).
- `country`: 주 국가 iso2. `also_country`: 다국적 감독 보조(세미콜론 구분, 예: `tw;us`).
- `wikidata`: 사람 QID(확신 시). `birth_year`: 동명이인 방지.
- `group`: G1–G5 (§3). `authority_weight`: group 매핑값.
- `notes`: 경계 사례 플래그(예: '상업/작가 경계', '2011 은퇴', '주활동 미국').

### `mappings/film_auteur.csv`
`auteur_slug, film_title, film_year, film_wikidata, rep_type, note`
- `rep_type` ∈ `defining`(경력 정전) | `recent`(2010년 이후) | `both`. → `film_lineage.value = {"rep_type":...}`.

### 대표작 선정 폭 — `group`이 '카운트에 넣을 영화'를 결정
- G1: 주요 정전·수상작 폭넓게(필모 대부분 고신호).
- G2: 대표·수상작 중심.
- G3: 대표작 2–4편.
- G4: 최고작만(편차 커서 체리픽).
- G5: 돌파작/주목작 1–2편(필모 얕음).
- 최종 '카운트' = (높은 group 감독) **OR** (강한 라인 보유작: 수상·정전). 감독 급 × 작품 라인의 결합.

## 5. 범위 & 처리 규칙

- 입력: 제공된 70개국 작가주의 감독 리스트. **국가별 인원 제한 없음.**
- **다국적 감독**: 주 국가 1 + `also_country`. (이안 `tw;us`, 베르호벤 `nl;us`, 조도로프스키 `cl;mx;fr`)
- **표기 표준화**: 로마자 정본 + QID. 기존 `directors` 862행과 `tmdb_person_id`로 중복제거.
- **경계 사례**: 상업/작가(예: 라자몰리), 활동 시점(예: 벨라 타르 2011 은퇴), 주활동국 불일치 → `notes` 플래그, tier로 흡수.
- **대표작 부재**: 다수 대표작이 현 `films`(1,957)에 없음 → stub 생성으로 **카탈로그 확장**.

## 5b. 신진 발굴 — `comparable_to` (감독→감독 유사 간선)

사용자 G5 도시에(`seeds/auteurs_g5.seed.csv`)의 핵심 필드. 각 신진 감독을 *기성 감독*에 연결한다(예: Christos Nikou → Lanthimos, Hlynur Pálmason → Reygadas).

- **활용 = 발굴 경로.** "당신이 좋아한 란티모스 계열의 *신진* — 니코우를 보세요." 데이터 파생 유사도가 놓치는 **큐레이션된 고품질 신호**.
- 모델: `auteur_edges(a, b, relation, source)` — a=신진, b=기성, relation=`comparable`/`heir`. (`meta_take_edges` 패턴과 동형.) 또는 `auteurs.comparable_to` 텍스트 → 마스터가 간선 생성.
- 벤치마크(b)가 우리 active-auteur 셋 밖일 수 있음(Sofia Coppola, Costa-Gavras, James Wan 등) → 참조 감독으로 추가하거나 텍스트 유지.
- G5 신진의 대표작 대부분이 로컬 1,900에 없음 → **정전 완전성 원칙**대로 stub 생성(`in_seed_catalog=false`). 발굴엔 이 영화들이 들어와야 함.

## 6. 에이전트 운영
- 지역별 해소 에이전트(예: 동아시아 / 남·동남아 / 서유럽 / 동유럽·발칸·발트 / 미주 / 중동·아프리카)가 본 스펙대로 `auteurs` + `film_auteur` 행 반환.
- 웹 조사 + DB 읽기 전용. tmdb 정수 ID 추측 금지(이름+연도+QID로). 결과는 CSV 행으로.
- 오케스트레이터가 병합·중복제거·검증 후 `seeds/auteurs.csv`, `mappings/film_auteur.csv` 작성.
