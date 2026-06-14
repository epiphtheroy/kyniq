# FilmCurio / Metatake — Meta Take 아키텍처 (척추 전환 명세)

> FilmCurio 전체 구조를 **meta take 중심**으로 전환하는 설계 명세. 여기서 바로 구축한다.
> 한 줄 정의: **"TV Tropes가 장치(트로프)를 중심으로 픽션 전체를 군중이 엮은 그물이라면,
> FilmCurio는 비평적 해석(meta take)을 중심으로 영화를 AI가 짜고 비평가가 승인한 그물이다."**
> 함께 볼 것: `figure-meaning-plan.md`(기저 메커니즘), `film-features-plan.md`,
> `spoiler-guard-design.md`, `site-ia-plan.md`. 충돌 시 이 문서가 우선.
>
> **브랜딩(확정):** 서비스명은 최종적으로 **Metatake**(도메인 metatake.io 등록 예정).
> 지금은 **FilmCurio UI/도메인 유지**, 아키텍처는 meta take 중심으로 빌드, 추후 일괄
> 리브랜드. → 지금 단계에서 UI 카피를 바꾸지 않되, 엔티티·구조는 Metatake 기준으로 짓는다.

---

## 0. TL;DR

영화 한 편을 **형상(figure)**들로 해체하고, 각 형상에 **take(밝힘=해석)**를 단다. take가
여러 영화의 형상을 끌어모으는 연결 개념으로 격상되면 **meta take**가 되고, **meta take는
고유 페이지를 가진 사이트의 주인공 엔티티**다(TV Tropes의 트로프 페이지에 대응). 구조·
내비게이션은 TV Tropes를 거의 그대로 따른다. 차이 셋: ① **영화 한정**, ② **트로프(닮음/
서술)가 아니라 meta take(의미/밝힘)**, ③ **AI 생성 + 비평가 승인**. 결과물: "장치의 잡학
사전"이 아니라 **"의미의 계보 지도"**. 1,000편을 배치로 원샷 추출하고, 의미를 수렴시키며
짓고, 그 위에서 후작업(수렴·간선·랭킹·에세이)을 돌린다.

---

## 1. 핵심 개념과 격상 규칙

- **형상(figure)** — 작품에 고정된 구체적·관찰 가능한 요소. **유형 5종:
  인물(character) · 사물/상징(object) · 촬영지/공간(location) · 트로프/구조(trope) ·
  형식/기법(form).** (form = 사운드·편집·내러티브 구조·촬영 등 — 실제 데이터에 다수.)
  **영화당 상한 6개**(유형 자유 배분, confidence 상위 6). 설명은 **짧고 목표지향적**(2~4문장)
  + **조밀한 링크**(§6).
- **take(밝힘)** — 한 형상에 다는 해석 하나. 근거(어느 장면/대사) 필수. 하나의 형상에 1~N개.
- **meta take** — take가 **여러 영화의 형상을 끌어모으는 연결 개념으로 격상**된 것.
  **사이트의 주인공 = 고유 페이지 단위.** 그 아래로 **표면은 안 닮았지만 같은 의미를 공유하는
  형상들이 — 닮은꼴이 아니라 식구로 — 모인다.**

**격상 규칙:** take가 **서로 다른 영화 ≥5편**의 형상을 모을 때 meta take로 발행. take는
자유 생성, meta take는 수렴으로 창발. = "수렴시키며 짓는다."

---

## 2. 포지셔닝 — TV Tropes 대비 (확정)

뼈대 동일(위키 그물망). 다른 것 정확히 셋:
1. **영화 한정.** 넓이↓ 깊이↑ — 감독 수직 완주(홍상수 34편), 큐레이션, 정전적 위상.
2. **트로프가 아니라 meta take.** 닮음/서술 → 의미/밝힘. 토끼굴 종착 = "이리스의 자매들".
3. **AI 생성 + 비평가 승인.** take·meta take 모두 AI 초안, 비평가는 승인만. 식별 가능한
   서명·일관 품질·정전적 권위. 원칙: "AI가 쓰고, 발행 후 감수한다."

SEO/GEO: meta take 페이지 = 비평가 서명 붙은 영화-횡단 해석 에세이 = 정보 이득 극대,
scaled thin content의 정반대. 최초 AI-페널티 우려를 이 구조가 가장 강하게 해소.

---

## 3. 사용자 동선

**울림으로 들어와 → 그 형상을 보고 → 그 형상을 밝힌 take들이 meta take 페이지로 격상되어
→ 같은 meta take 아래의 다른 영화 식구를 만난다.** 진입=형상(감정), 종착=meta take(발견).

---

## 4. 내비게이션 모델 — TV Tropes 거의 동일 (확정 6-2)

- **조밀한 인라인 링크**(§6 토큰 시스템) · **양방향 인용**(영화↔meta take) ·
  **laconic 한 줄** · **랜덤 버튼**(Random meta take / Random film) · **브레드크럼** ·
  **인덱스 = TMDB 장르**(확정 6-1) · **Compare/Contrast**(인접 meta take=soft edges) ·
  검색 + 알파벳/장르 인덱스.
- 상단 내비: `Films` · `Directors` · `Meta Takes`(척추) · `Genres` · `About`.

---

## 5. 페이지 타입 (확정 6-3)

### 5.1 영화 페이지 `/film/[slug]` — "Work 페이지"
- 상단: `film_features`(pitch/record/experience) = 프리뷰 존(스포일러 제로) + 경계 배너.
- **이 영화의 형상들** — 유형별 그룹, 각 형상 = 짧은 설명 + 그 아래 **meta take 링크들**.
- **형상 SEO(확정 B):** 형상은 **독립 페이지가 아니라 구조화된 섹션**으로.
  `<section><h2>`/`<h3>` + schema.org + `#figure-[id]` 앵커. 구글의 섹션 랭킹("이 페이지로
  이동")을 노려 thin-content 위험 없이 형상 단위 노출 확보. SEO 본진 = 영화/메타테이크 페이지.
- **하단 추천(확정, 아이디어 1):** "이 영화와 가장 깊이 걸린 영화들" — meta take 매개
  추천(§10b). 각 추천에 **연결한 meta take를 이유로 표기**(토큰 링크). meta take별로 갈라
  보는 패싯 추천 가능. 추천이 곧 토끼굴로 이어짐(설명 가능한 추천).

### 5.2 meta take 페이지 `/take/[slug]` — "Trope 페이지" (주인공)
제목(명사구) + laconic + 비평가 서명 + thesis(2~3문장) + **에세이**(식구를 잇는 비평,
250~400단어, 대표 3~5편) + **Compare/Contrast** + 장르 태그 + 브레드크럼 + 랜덤.
JSON-LD: ItemList(+ CriticReview/Article).

식구(Examples)는 **두 섹션**으로 노출(확정, 아이디어 2):
- **The defining cases — 연관도순.** take↔meta take 임베딩이 가까운 원형적 사례. 이 meta
  take가 *무엇인지* 가르친다.
- **Unexpected kin — 의외도순.** 표면/장르는 멀지만 confidence가 높아 변호 가능한 뜻밖의
  식구. "이 둘을 연결할 줄 몰랐는데"의 발견. 토끼굴 연료.
  (둘 다 `meta_take_rankings`의 relevance/surprise 컬럼으로 물질화, 장르별 폴더 그룹 가능.)

### 5.3 감독 페이지 `/director/[slug]`
필모 + **그 감독을 가로질러 재귀하는 meta take = 감독의 비평적 서명**(밀도 주머니).

### 5.4 장르 인덱스 `/genre/[tmdb-genre]`
장르의 영화들 + 그 장르를 가로지르는 대표 meta take들.

### 5.5 형상
영화 페이지 내 섹션이 기본(§5.1). 독립 페이지로 승격하지 않음(thin 방지).

---

## 6. 링크 전략 + 토큰 시스템 (확정 6-4, D — 가장 중요)

**원칙: 콘텐츠에 `/take/slug`를 절대 하드코딩하지 않는다.** meta take가 병합·분리·개명되어도
문구·링크가 깨지지 않게 한다.

- **관계형 링크(자동 갱신):** 형상↔meta take는 `takes` 테이블에 저장. 화면엔 **조인으로
  칩/링크 렌더** → 개명·병합 시 자동 반영. (영화 페이지의 meta take 칩, meta take 페이지의
  식구 목록 모두 이 방식.)
- **인라인 참조 = 토큰:** 본문(형상 description, meta take essay)의 인라인 참조는
  **`{{take:uuid}}` / `{{film:uuid}}` / `{{figure:uuid}}` 토큰**으로 저장. 렌더 시 현재
  제목+slug로 해소. 병합은 `merged_into` 추적, 개명은 현재 title 사용 → **콘텐츠 불변, 표시만
  갱신.**
- **링크 무결성:** 생성 LLM은 토큰 후보(존재하는 uuid)만 출력하도록, 결정적 linkifier가
  카탈로그 검증 후 토큰화. 존재하지 않는 링크(redlink) 금지.
- **slug 변경:** `slug_history` 테이블 → 301 리다이렉트.
- 형상 설명은 **짧고 목표지향**(장황한 에세이 금지). 언급되는 영화·형상·meta take는 토큰 링크.

핵심 한 줄: **안정된 ID를 저장하고, 표시할 때 해소한다(store IDs, resolve at render).**

---

## 7. 스키마 (migration 0013)

```sql
CREATE TABLE figures (
  id uuid PK, film_id uuid REFERENCES films(id),
  kind text CHECK (kind IN ('character','object','location','trope','form')),
  label text,                -- = seed의 Target Object
  description text,           -- 짧고 목표지향, {{...}} 토큰 포함
  spoiler_level text,         -- none|mild|major (기존 가드 재사용)
  embedding vector(1536),
  status text DEFAULT 'approved',
  source text, generated_by text, self_confidence numeric, claims_sourced bool,
  created_at, updated_at
);
-- 영화당 figures ≤ 6 (워커가 confidence 상위 6만 기록)

-- 이론 패밀리(인덱스) + 이론가(귀속) — seed의 Theory Name / Theorist Name
CREATE TABLE theory_families (id uuid PK, slug text UNIQUE, name text, blurb text);
CREATE TABLE theorists (id uuid PK, slug text UNIQUE, name text, blurb text);
-- meta_takes에 theory_family_id, theorist_id (nullable) 추가, takes에 출처(비발행) 보관

CREATE TABLE meta_takes (
  id uuid PK, slug text UNIQUE,
  title text,                 -- 명사구: "The Disposable Worker"
  laconic text,               -- 한 줄 도발적 요약
  thesis text,                -- 2~3문장 비평적 정의
  essay text,                 -- 식구를 잇는 비평 에세이 ({{...}} 토큰 포함)
  critic_approved_by text,
  status text DEFAULT 'candidate'
        CHECK (status IN ('candidate','approved','published','split','retired')),
  genres text[], embedding vector(1536),
  merged_into uuid REFERENCES meta_takes(id),  -- 무손실 병합
  created_at, updated_at
);
CREATE TABLE meta_take_aliases (alias text PK, meta_take_id uuid REFERENCES meta_takes(id));

CREATE TABLE takes (                       -- 형상 ↔ meta take 간선 (밝힘)
  figure_id uuid REFERENCES figures(id),
  meta_take_id uuid REFERENCES meta_takes(id),
  rationale text, confidence numeric,
  embedding vector(1536),                  -- 밝힘(rationale) 임베딩 (아이디어 2)
  created_at,
  PRIMARY KEY (figure_id, meta_take_id)
);

CREATE TABLE meta_take_rankings (          -- 후작업: 식구 두 랭킹 (아이디어 2)
  meta_take_id uuid, figure_id uuid,
  relevance numeric,                       -- cosine(take, meta_take): 원형성
  surprise numeric,                        -- 표면/장르 거리 × (confidence ≥ θ): 의외성
  rel_rank int, surp_rank int, model text, updated_at,
  PRIMARY KEY (meta_take_id, figure_id)
);

CREATE TABLE film_affinities (             -- meta take 매개 영화 추천 (아이디어 1, 야간 cron)
  film_id uuid REFERENCES films(id),
  related_film_id uuid REFERENCES films(id),
  score numeric,                           -- TF-IDF 가중 공유 meta take 합
  shared_meta_take_ids uuid[],             -- 추천 이유(설명 가능)
  updated_at, PRIMARY KEY (film_id, related_film_id)
);  -- 영화당 상위 ~20만 저장

CREATE TABLE meta_take_edges (             -- Compare/Contrast (soft edges)
  a uuid, b uuid, relation text,           -- compare|contrast|broader|narrower
  similarity numeric, PRIMARY KEY (a, b)
);

CREATE TABLE slug_history (                -- 개명 시 301
  old_slug text PK, entity text, entity_id uuid, changed_at
);

CREATE VIEW meta_take_film_counts AS
  SELECT t.meta_take_id, count(DISTINCT f.film_id) film_count
  FROM takes t JOIN figures f ON f.id = t.figure_id
  GROUP BY t.meta_take_id;
```
RLS: 익명은 published meta take + 연결 takes/figures만. 워커 service role.

---

## 8. 입자 크기 관리 (확정)

- **그레인: meta take = 5~30편.** 발행 게이트 **≥5편**, 분리 트리거 **>30편**.
- **명명(확정 5):** 제목 = **명사로 끝나는 짧은 구문**(TV Tropes식). 환기·도발은 laconic.
- 분리/병합/개명은 후작업 통합 루프가 후보 제시 → **비평가 승인**.

---

## 9. 추출 파이프라인 — 원샷 (확정 A·1)

**Phase 1 — 영화당 1콜 원샷(배치, 강한 모델).** 한 콜에서:
형상 ≤6(label + 짧은 description + spoiler_level + kind) + 각 형상의 take 1~N(rationale +
confidence) + 각 take의 **meta take 제안**(주입된 기존 후보 ~30 중 택1 또는 신규 제안).
- **수렴 장치:** USER 블록에 그 영화 관련 기존 meta take 후보 주입. 신규 제안은 정규화→
  임베딩→cosine(≥0.92 자동 alias / 0.80–0.92 LLM 판정 / <0.80 신규 candidate).
- **콜드스타트 시드:** 기존 `canonical_tags` + 기존 Q&A 답변 aha 채굴 + 30개 비평 렌즈.
- **보이스:** 추출 프롬프트는 비평 보이스(Lane/신형철 스타일러)를 입혀, take가 "밝힘"이
  되도록. 형상 설명은 짧고 목표지향, 모든 take에 근거 강제(환각 차단), 스포일러 가드 적용.
- **운영:** 10~15편 파일럿으로 프롬프트 튜닝 → **전체 1,000편 배치**. 비용 ≈ $10~20.

> **중요:** 이 콜은 meta take를 **확정하지 않고 제안만** 한다. 확정·정규화는 §10 수렴.

---

## 10. meta take 봇 — 생애주기·주기 (확정 C, 다단계 상태기계)

meta take는 추출이 아니라 수렴에서 창발한다. 단일 봇이 아니라 단계별 봇 집합:

1. **빅뱅 수렴(1회, 한꺼번에).** 1,000편 추출 완료 후 전체 take를 **한 번에** 클러스터링 →
   초기 meta take 후보군 일괄 생성. (그레인이 전체 코퍼스 기준으로 보정 + 비평가가 일관된
   세트를 받음. → "한꺼번에"가 초기엔 정답.)
2. **저작 봇.** 후보(≥5편)마다 title(명사구)+laconic+thesis+essay를 **강한 모델 + 비평
   보이스**로 생성. 토큰 링크로 식구 인용.
3. **승인 큐.** 어드민에서 candidate→approved→published. 비평가는 meta take(허브)만 감수.
4. **유지 봇(야간/주간 cron).** 신규 영화 take를 기존 meta take에 매칭 / 분리(>30) 후보 /
   병합(중복) / 재랭킹 / 인접 간선 갱신. drift 감지.
5. **재감사.** 사후 spot-audit + `content_events` 전 단계 기록.

어떤 AI: 추출·저작 모두 강한 모델(토대·보이스). 클러스터링은 로컬 연산. 비용 큰 곳 =
에세이 생성(published meta take ~수백, $30~80).

---

## 10b. 추천 엔진 + 이중 랭킹 (확정, 아이디어 1·2)

**영화 추천(아이디어 1).** meta take 매개, 설명 가능, 토끼굴 연결.
- 영화-영화 친화도 = **공유 meta take의 TF-IDF 가중 합**. 희소한 meta take 공유에 큰 가중
  ("Consoling Fiction" 공유 ≫ "Tragic Hero" 공유) → 위계 있는 추천.
- 야간 cron이 `film_affinities`에 영화당 상위 ~20편 + **공유 meta take ids(추천 이유)** 물질화.
- 영화 페이지 하단 렌더(조인). meta take별 패싯 필터("이 읽기를 공유하는 영화"). 추천 클릭 →
  영화 또는 그 meta take(식구)로 → 루프.

**이중 랭킹(아이디어 2).** meta take마다 식구를 두 순위로:
- **relevance** = cosine(take.embedding, meta_take.embedding). 가까울수록 원형적.
  → "The defining cases"(이해).
- **surprise** = (표면/장르 임베딩 거리) × (confidence ≥ θ 게이트). 멀지만 변호 가능.
  → "Unexpected kin"(발견). LLM 심판으로 변호 가능성 재확인(억지 차단).
- 둘 다 `meta_take_rankings`에 물질화, meta take 페이지 두 섹션으로 노출(§5.2).
- **현황 메모:** 임베딩 인프라(meta_takes/figures embedding)·놀라움 개념은 기존 설계에 있었고,
  본 절에서 **take.embedding + 이중 랭킹(relevance/surprise) 동시 노출**을 추가 확정.

---

## 11. 기존 시스템 처리 (확정 3·1)

- **frame 층 폐기(확정 3).** `/frames`·`/frame/[slug]` 라우트, frame 모듈, `Questions`
  내비 제거. 테이블은 즉시 drop 말고 시드 채굴 후 drop.
- **Q&A 격리(확정 1).** 기존 133 질문+답변 — **별도 폴더/네임스페이스로 분리(폐기하되 비삭제)**.
  답변 aha를 meta take 시드로 채굴. 추후 재사용 여부 결정. (헷갈리면 삭제 가능.)
- **태그 흡수.** `canonical_tags`는 meta take 시드로 채굴 후 정리.
- **`film_features` 유지.** 영화 페이지 프리뷰 존 가구.
- **스포일러 가드 유지·확장.** 형상 description·meta take essay에 동일 등급/마스킹/블러.

---

## 12. 빌드 순서

1. migration 0013(§7) + pgvector + frame deprecate + Q&A 네임스페이스 분리.
2. **`figure-extract` 원샷 워커**(§9) — 10~15편 파일럿 튜닝.
3. **전체 1,000편 배치 추출.**
4. **빅뱅 수렴 + 저작 봇**(§10-1,2) → meta take 후보군 + 에세이.
5. **승인 큐 UI**(어드민) → published.
6. **이중 랭킹 워커**(relevance + surprise) → `meta_take_rankings`. **추천 cron** →
   `film_affinities`. **유지 봇 cron**(§10-4).
7. **UI**: `/take/[slug]`(주인공, 이중 식구 섹션) → 영화 페이지 형상 섹션 + **하단 추천** →
   감독 서명 meta take → `/genre/[…]` → 내비 교체 → **토큰 링크 렌더러**(§6) → 랜덤 버튼.
8. 검증·단계적 색인·배포(기존 `.command` + Vercel ISR).

워커/배포 = 기존 `worker/*.py` + `run-*.command` + `deploy-*.command` 재사용. 전 페이지 ISR
유지.

---

## 13. 확정 결정 기록

- (1) take·meta take 모두 AI 생성, 비평가는 **승인만**.
- (2) 콜드스타트 = **1,000편 전체 배치**(파일럿 선튜닝).
- (3) meta take = 척추, frame = 폐기.
- (4) 그레인 5~30편, >30 분리, ≥5 발행.
- (5) 명명 = 명사구 + laconic.
- (6-1) 카테고리 = TMDB 장르. (6-2) 내비 = TV Tropes 거의 동일. (6-3) 영화·감독 페이지 유지.
  (6-4) 형상 설명 짧고 목표지향 + 조밀 링크.
- (A) 추출 = 영화당 원샷(형상+묘사+take+밝힘+meta take 제안). 강한 모델.
- (B) 형상 = 독립 페이지 아님, 구조화 섹션(섹션 SEO).
- (C) meta take = 다단계 봇(빅뱅 수렴 → 저작 → 승인 → 유지 cron). 초기 후보 일괄 생성.
- (D) 링크 = **토큰 시스템**(store IDs, resolve at render) + slug_history 301.
- (형상 유형) 인물·사물·촬영지·트로프 4종, 영화당 ≤6.
- (Q&A) 별도 폴더 격리(비삭제). (브랜딩) 지금 FilmCurio, 추후 Metatake.io 일괄.
- (에세이) laconic 1줄 + thesis 2~3문장 + 본문 250~400단어(대표 3~5편).
- (승인 큐) **카드 스와이프** UX — 한 화면 1개(제목+laconic+식구 5썸네일+thesis),
  승인/반려/분리요청/개명 4버튼, 전문 펼침. 개당 5~10초.
- (보이스) **형상=사실(건조), take=밝힘(한 문장 비평적 통찰)** 톤 분리. 스타일러 스킬 미사용.
- (아이디어 1) 영화 추천 = `film_affinities`(TF-IDF 가중, 설명 가능, 패싯).
- (아이디어 2) `takes.embedding` + 이중 랭킹(relevance/surprise) 두 섹션 노출.

## 14. 시드/임포트 데이터 + 확정 (전부 결정 완료)

**시드/임포트 데이터 (`data/seed/`):**
- `metatake_films_567.csv` — **1차 배치 = 567편**. TMDB id/감독 포함, sheet2와 100% 일치.
- `metatake_figures_takes_4662.csv` — 영화당 8.2행. **Target Object=형상, Application=take(72단어),
  Theory Concept=meta take 시드, Theory Name=이론 패밀리(인덱스), Theorist Name=귀속.**
- `metatake_ucn_533.csv` — 보편 주제 533개. **meta take 시드 부적합(너무 넓음) → 보류 자산**(추후
  선택적 주제 인덱스 후보).

**확정 (전부):**
1. **567편 직접 임포트** — 형상+take가 이미 있으므로 AI 추출 건너뜀. 567편 너머만 추출 파이프라인.
2. **Application(밝힘) 그대로 임포트**(v1). 품질 다듬기는 발행 후.
3. **출처/DOI: 비발행 + 추후 Crossref 검증.** 지금은 개념·이론가만 내부 시드. 화면 비노출.
   추후 Crossref로 DOI 검증해 통과분만 발행.
4. **인덱스 2축: TMDB 장르 + 이론 패밀리(Theory Name).** UCN 주제는 보류(추후 3축 가능).
5. **형상 유형 5종: 인물·사물·촬영지·트로프 + form/technique.** (figures.kind CHECK 확장.)
6. meta take 시드 = **Theory Concept 수렴본**(임베딩으로 2,559 고아 병합 + >30 분리).

**튜닝(데이터 보고 결정, 코드 아님):** 놀라움 점수 가중치/θ, 에세이 대표 편수, 추천 cron 주기·상한.

---

## 15. 백로그 — 지연 작업 (잊지 말 것, 나중에 병렬 실행 가능)

1. **Application(밝힘) 정리 패스 (take 임포트 전/병렬).** 567편 take 텍스트는 일정한 3단
   템플릿("Scholar X attempts to interpret… According to this interpretation, the Target
   Object is revealed to be…")을 가짐. 가벼운 LLM 정리 배치(작은 모델, ~$5–15, 4,662행)로:
   ① 연구자 고유명사 제거 + "Scholar X attempts…" 틀 제거 → 직접 단언, ② "the Target
   Object" → 구체 목적물 이름(= 형상)으로 치환·주어화, ③ 개념을 술어로 접어넣기, ④ 1인칭
   금지·하우스 보이스·60~90단어. 동시에 목적물→`{{figure}}`, 개념→`{{meta_take}}` 토큰화
   (보이스 정화 + 링크 토큰화 동시). **고유명사는 삭제가 아니라 이동**: 이론가→`theorists`,
   개념→meta take. 10행 파일럿으로 프롬프트 검증 후 배치. (시점: 임포트 전 또는 병렬.)

2. **형상당 take 보강(선택, 후순위).** 임포트분은 형상당 take 1개. 시드 그래프 수렴/밀도
   확인 후, 부족하면 형상당 take 추가 생성으로 토끼굴 밀도↑. **지금 하지 않음**(선 데이터).

3. **임포트 데이터 위생.** 빈 Target Object 행 건너뜀/플래그. 영화당 형상은 **임포트분 그대로
   유지(~8)**, 6-형상 상한은 568편째(신규 추출)부터 적용.

4. **출처 Crossref 검증(추후).** §14-3: 비발행 상태의 per-row 출처/DOI를 Crossref로 검증해
   통과분만 발행.

5. **형상 이미지 전략 (저작권-안전 3층).** Google 이미지·유튜브 썸네일 스크래핑 **금지**
   (DMCA 리스크 = FilmCurio 하드룰 위반 + 적절성 자동판단 불가). 대신:
   - **1차: TMDB 스틸 형상 매칭.** TMDB의 publicity stills(장면 스틸) 세트에 대고
     `Image Search Query`/형상 설명을 이미지-텍스트 유사도로 매칭 → 최적 스틸. 임계 이하 →
     백드롭 → 그것도 약하면 **무이미지**.
   - **2차: 유튜브 공식 임베드**(썸네일 아님). `YouTube Search Keyword`로 공식 클립/예고편
     검색 → 클릭-투-로드 임베드(기존 Curiobot 패턴), 영화 정체성 임계 이하 거부.
   - **3차: 디자인 폴백.** 타이포 카드 + 백드롭 색조 틴트. ~4,600 형상마다 사진 강요 안 함.
   - 규칙: **"틀린/불법 이미지보다 무이미지가 낫다."**
   - `Image Search Query` / `YouTube Search Keyword` 컬럼 = **매처 입력 메타데이터로 저장**
     (버리지 않음).
