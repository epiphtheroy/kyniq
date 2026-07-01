# Strong Misreading 태그 ↔ Theory 레이어 결합 — 설계서

작성일: 2026-06-26
목적: Strong Misreading(이하 SM, DB의 `takes`)에 붙은 **theorist·concept 태그**가 사이트의 **theory 레이어**(theorists / theory_canon / theory_families / /concept)와 끊겨 있는 문제를, 어떻게 결합할지 정의한다. 본 문서는 *설계*만 다룬다(구현·마이그레이션은 승인 후).

---

## 0. 요약 (TL;DR)

- SM 태그는 지금 **전부 free-text**다. `takes.theorist_id = 0건`, `raw_concept = 0건` → 어떤 엔티티에도 안 묶여 있다. 읽기에서 "Nietzsche"나 "ressentiment"를 눌러도 갈 곳이 없다.
- 우리에겐 이미 **theory 레이어 자산**이 있다: `theorists`(1,196), `theory_canon`(2,586), `theory_families`(1,394), `/concept` 허브. **새로 만들 게 아니라 SM 태그를 여기에 꽂는 작업**이다.
- 권장 결합 순서: **① 이론가(theorist) → ② 개념/전통(concept↔canon) → ③ UI/페이지**. real_person은 이론이 아니므로 별도 취급.

---

## 1. 현황 진단 (DB 실측, 2026-06-26)

| 항목 | 값 |
|---|---|
| 게시 takes | 26,975 |
| `theorist_name` 보유 | 12,348 (고유 **898**) |
| `theorist_id` 연결 | **0** ← 끊김 |
| `concept` 보유 | 15,830 (고유 **10,859**) |
| `raw_concept` 보유 | **0** (구 ScholarHeader 매칭 훅이 비어 있음) |
| `real_person` 보유 | 3,623 (고유 2,530) |
| 개념 재사용도 | ≥3회 632종 · ≥10회 **113종** (나머지는 롱테일) |

상위 이론가(빈도): Freud 1,682 · Lacan 730 · Kant 524 · Marx 414 · Foucault 396 · Levinas 356 · Agamben 248 · Arendt 225 · Sartre 223 · Debord 189 · Benjamin 178 · Bourdieu 178 · Bergson 175 · Kierkegaard 173 · Baudrillard 169.

→ 소수 거장이 매우 높은 빈도. 이론가 결합의 ROI가 크다.

## 2. 보유 자산 (이미 있는 theory 레이어)

- `theorists` (1,196) — `id, slug, name, blurb, created_at`. **페이지 라우트는 없음**(`/theorist` 부재).
- `theory_canon` (2,586) — `id, part, major_category, sub_category, title, theorist, embedding`. 정전 항목 + 임베딩 보유.
- `theory_families` (1,394) — 이론 계열.
- `/concept` + `/concept/[slug]` — `concept_readings` RPC 기반. 개념 → **트로프** 목록(현재는 takes.concept free-text와 별개 레이어). 크럼: "Archetype › Theory".
- SM의 **framework**(14개)는 이미 결합된 레이어(/strong-misreadings/[fw] 페이지 + 칩 링크).

## 3. 갭 (무엇이 끊겼나)

1. **theorist_name** → `theorists` 미연결(id=0), `/theorist` 페이지 없음. 254/898만 이름 정확 일치(나머지는 변형/미존재).
2. **concept** → `/concept`(트로프 기반)·`theory_canon` 어디와도 미연결. 10,859종 free-text.
3. **takes ↔ theory_canon** 매칭 없음(전통/계보 표시 불가). 임베딩은 양쪽 다 있어 매칭은 가능.
4. **real_person**(2,530) — 이론이 아니라 "존재적 평행"(예: G. H. Hardy). theory 결합 대상 아님 → 별도.

## 4. 결합 모델 (엔티티 · 스키마)

### 4.1 이론가 (theorist) — Phase 1

- `takes.theorist_id`(이미 존재, 비어 있음)를 **백필**: `theorist_name` → `theorists.id`.
  - (a) 정확/소문자 일치(254 즉시) → (b) 별칭 사전(예: "Freud"→"Sigmund Freud") → (c) 임베딩/트라이그램 근접 매칭(임계값 게이트) → (d) 끝내 없으면 **신규 theorist 행 생성**(slug + name; blurb는 비우거나 후속 생성).
- 결과: 모든 SM이 이론가 엔티티로 연결. "이 이론가로 읽은 영화 전부"가 질의 가능.
- 신규 theorist 정책: name 정규화(아스키 접힘, 중복 slug 방지). 별칭 테이블 `theorist_aliases(alias, theorist_id)` 신설 권장(재실행·신규 take에도 재사용).

### 4.2 개념 / 전통 (concept) — Phase 2

개념 10,859종은 그대로 엔티티화하기엔 너무 흩어져 있다. 두 길:

- **(권장) 전통 매칭**: 각 take의 `concept`(또는 take 본문 임베딩)을 `theory_canon`의 임베딩과 매칭해 **가장 가까운 정전 1~2개**를 attach. → 읽기마다 "이 독해가 기대는 전통(tradition)" 한 줄(예: *정신분석 · 거울단계 — Lacan*). 매핑 테이블 `take_canon(take_id, canon_id, score)`.
- **(보완) 개념 허브**: ≥N회 등장하는 코어 개념(≥10회 113종, ≥3회 632종)만 슬러그화해 `/concept`로 승격 + 동의어 병합(임베딩 클러스터링). 롱테일은 전통 매칭으로만 흡수.
- 둘은 배타가 아님: 코어는 허브, 전체는 canon 전통 attach.

### 4.3 real_person (평행) — 별도

- theory 아님. 후속으로 "존재적 평행" 미니 인물 카드(생몰·한 줄) 정도. 이번 결합 범위 밖(문서에 명시만).

## 5. 매칭 규칙 & 임계값 (초안)

- **이론가 정확 매칭**: `lower(trim(name))` 동일. (254 확정)
- **이론가 별칭**: 수기 사전(상위 50명 우선) + 성(姓)만 표기된 경우 보강.
- **이론가 임베딩 폴백**: 후보가 임계값 미만이면 매칭 보류 → 신규 생성. (오매칭 방지: 같은 성 다른 인물 주의 — 예: 여러 "Bergson" 없음, 그러나 "James" 류 주의)
- **concept→canon**: cosine ≥ τ(예: 0.82) 1순위만 attach, τ 미만은 미부착(거짓 전통 방지). τ는 DRY 표본으로 보정.
- 모든 단계 **DRY 우선** → 표본 검수 게이트 → 적용.

## 6. 페이지 / 라우트 (UI)

- **/theorist** (목록) + **/theorist/[slug]** (이론가 1인): blurb + 그 이론가로 읽은 SM 전체(영화 교차) + 관련 정전(theory_canon.theorist 매칭) + 관련 이론가(임베딩).
- **take/figure 카드의 이론가 칩 → /theorist/[slug] 링크화** (현재 plain text).
- **읽기(figure/take)에 "전통" 한 줄**: take_canon 최상위 → 해당 정전/계열로 링크(구 ScholarHeader 자리 부활).
- **/concept(Theory) 허브 확장**: 코어 개념 + 이론가 + 정전을 한 화면에서 진입하는 "Theory" 홈으로 격상(현재는 개념→트로프만).
- 내비: "Archetype" 옆/아래에 "Theory" 진입(이미 /concept 크럼에 'Theory' 명칭 사용 중).

## 7. 단계별 실행 계획

**Phase 1 — 이론가 결합 (권장 선행)**
1. 마이그레이션: `theorist_aliases` + (필요시) `theorists`에 인덱스, `takes.theorist_id` FK 확인.
2. 워커 `theory-link-theorists.py` (DRY→apply): name→id 백필 + 신규 생성 + 별칭 적재.
3. 라우트 `/theorist`, `/theorist/[slug]` + RPC(`theorist_readings`).
4. 칩 링크화 + 검증.

**Phase 2 — 개념/전통 결합**
5. 임베딩: take.concept(또는 take) ↔ theory_canon 매칭 워커(DRY→apply) → `take_canon`.
6. (옵션) 코어 개념 허브 승격 + 동의어 병합.
7. 읽기 "전통" 줄 + /concept 허브 확장.

**Phase 3 — 마감**
8. real_person 미니 카드(선택), 사이트맵/SEO, 내비 정리.

## 8. 비용 · 쿼터 · 리스크 · 검수

- **비용**: 임베딩(이론가/개념/정전)은 Voyage/OpenAI 임베딩 소량(수만 건) — 저렴, 일회성. LLM 별칭/검수는 선택.
- **리스크**: ① 이론가 오매칭(동명이인) → 임계값+수기 별칭으로 방지. ② 거짓 전통 attach → τ 보수적. ③ 신규 theorist 난립 → 정규화+중복 slug 차단. ④ 개념 과합치 → 코어만 병합, 롱테일 보존.
- **검수 게이트**: 각 워커 DRY 표본(상위 빈도 50 + 무작위 30) 사람이 확인 후 apply. 가산적(기존 데이터 파괴 없음, takes 원본 free-text 유지).

## 9. 열린 결정사항 (승인 필요)

1. `/theorist`를 신설할지(권장) vs 기존 `/concept(Theory)` 안에 흡수할지.
2. 개념은 **전통 매칭만**으로 충분한지 vs **코어 개념 허브**까지 만들지.
3. 신규 theorist 자동 생성 허용 범위(전부 vs 빈도 N회 이상만 생성, 나머지는 free-text 유지).
4. real_person을 이번 범위에 포함할지(기본: 제외).
