# HANDOFF · 한국어화 + 다국어 i18n 마스터

> **정본(定本).** metatake.net 전체의 한국어화 및 향후 다국어 확장 전략·비용·품질·SEO·자동 번역 루프의 단일 진입점.
> docs/00-INDEX.md 에 "Internationalization (i18n)" 섹션으로 등록할 것. 관련 기억: [[terminology-charter]], [[seo-ops-status]], [[sentence-engine-poc]], [[hourly-keyword-chasing-project]], [[metatake-tv-strategy]], [[unified-hybrid-search-live]].
>
> 작성 2026-07-11. 모델 결정: **Opus 4.8 전량** (원우 확정).
>
> ⚠️ **역할 분담(2026-07-16, 갱신 07-17)**: 크롬·템플릿·데이터 투영층(`/{locale}` 셸·UI 사전·TMDB/지명 `_<loc>` 컬럼)은
> **`HANDOFF-다국어프로젝션.md`**(웨이브1=한국어 ✅ SHIPPED 라이브 2026-07-17, 커밋 `7e64d7f`)가 담당한다 —
> 본 문서의 계층 B·C에 해당하며 그것이 **다국어 프로젝션 체계**(로케일 레지스트리, ko·ja·fr·es)의 정본이다.
> 본 문서는 **롱폼 프로즈층(content_i18n + 자율 번역 루프, §6)** 전담으로 남는다(content_i18n의 lang 컬럼은 같은
> 로케일 코드 사용). 두 문서가 다르면 프로젝션 문서가 우선. 같은 필드를 `_<loc>` 컬럼과 content_i18n에 이중 저장
> 하지 말 것. **롱폼 번역(takes·figures·리셉션 본문)은 아직 미착수** — 언어판 라이브(ko) 위에 이 루프를 얹는 것은 별도 예산(~$220/언어) 오너 결정.

---

## 0. 한 문단 요약

metatake.net의 텍스트는 겉보기와 달리 **3계층**으로 갈린다. 진짜 LLM 번역이 필요한 "간판 프로즈"는 약 **2,930만 자(영문)**뿐이고, 나머지 ~9,000만 자는 템플릿 조립물(film_sentences 등)이라 **생성기 국제화**로 토큰 0에 해결되며, 영화 overview·제목은 **TMDB/KOBIS 데이터 조인**으로 무료다. 그래서 Opus 4.8 배치 전량 번역이라도 **1회성 ~$200 + QA** 규모다. SEO는 `/ko/` 서브디렉토리 + hreflang + 자기 canonical + **네이버 서치어드바이저**가 정답. 그리고 **핵심 요구사항**: 앞으로 영어 콘텐츠가 생기면 자동으로 감지해 한국어를 채우는 **자율 번역 루프(§6)**를 인프라의 중심에 둔다. `content_i18n` 사이드 테이블 + `lang` 컬럼 설계라 일본어·프랑스어 확장 시 스키마 변경이 없다.

**최우선 착수: 웨이브 ⓪ = 용어집(카테고리명·이론용어·영화제목 매핑) 확정.** 이것이 전체 번역의 축이며 원우 최종 승인 사항.

---

## 1. 물량 실측 (2026-07-11 프로덕션 DB 집계)

### 계층 A — 진짜 LLM 번역 대상 (총 ~2,930만 자 ≈ 입력 ~7.3M 토큰)

| 테이블 | 필터 | 행수 | 문자량 | 필드 |
|---|---|---:|---:|---|
| takes | status=published | 26,975 | 14,057,496 | take_title, rationale |
| essays | status=verified | 3,267 | 7,100,760 | title, dek, body_md |
| figures | status=approved | 18,168 | 3,410,684 | label, description |
| film_reception | 전체 | 9,245 | 1,907,428 | headline, comment, verdict, dek_lead |
| meta_takes | status=published | 4,710 | 1,415,231 | title, laconic, thesis, essay |
| taxonomy_nodes | 전체 | 2,949 | 775,996 | label, definition |
| theory_concepts | 전체 | 8,346 | 672,317 | concept, one_liner |
| **합계 A** | | **~73,660** | **~29,340,000** | |

> 주의: `meta_takes`는 candidate(4,883)·retired(2,381)도 있으나 **published만** 번역 대상. `essays` draft(11)은 verified 승격 후 루프가 자동 처리.

### 계층 B — 번역하지 않고 "생성기를 국제화" (~9,000만 자 → LLM 토큰 0)

| 테이블 | 행수 | 문자량 | 국제화 방법 |
|---|---:|---:|---|
| film_sentences | 466,974 | 67,910,387 | 13개 패턴 문장 + 슬롯 용어(이론가·컨셉)만 ko판. 용어는 이미 `search_aliases` 한글 6,033행 존재. LLM 0 원칙 유지. |
| tv_segments | 27,583 | 18,344,338 | 시간당 뉴스=휘발성. 과거분 백필 폐기, 파이프라인에 "생성 시 ko 동시 출력" 훅만. |
| tv_playlists | 5,559 | 3,641,118 | 축 미러링 조립물. intro 브리핑만 소량 ko. |
| TakeScore 프로즈 / misreadings 조립 | — | — | 규칙 기반 조립층. 조립 템플릿만 ko화. |

**핵심:** 계층 B는 "번역 프로젝트"가 아니라 "**생성기 i18n**" 이다. film_sentences 6,790만 자를 절대 배치에 넣지 말 것 — 13개 패턴 × 슬롯 사전으로 46만 행이 공짜로 나온다. (정본: `HANDOFF-임베딩판타지아-문장층.md`)

### 계층 C — 이미 번역이 존재 (비용 0)

| 대상 | 소스 | 방법 |
|---|---|---|
| films.overview / tagline (2,080,377자) | TMDB | TMDB API `language=ko-KR` 무료 제공 |
| **영화 제목 (한국 SEO의 핵심)** | TMDB ko-KR + **KOBIS(영화진흥위원회 오픈API)** | 한국 공식 개봉명 조인. "In the Mood for Love"→"화양연화". **번역이 아니라 데이터 매핑 문제.** |

---

## 2. 비용 — Opus 4.8 전량 (원우 확정)

Batch API(50% 할인) 기준. Opus 4.8 배치 단가 = 입력 **$2.5/1M**, 출력 **$12.5/1M**. 한국어 출력 토큰 ≈ 영문 입력의 1.5~2배(한글 토큰 밀도 높음).

| 항목 | 계산 | 비용 |
|---|---|---:|
| 입력 (계층 A) | ~7.3M tok × $2.5 | ~$18 |
| 출력 (한국어) | ~14M tok × $12.5 | ~$175 |
| 시스템 프롬프트(용어집+스타일) | 프롬프트 캐싱 → 무시 가능 | ~$0 |
| **번역 소계** | | **~$190** |
| QA 패스 (Opus 5% 표본 채점 + 재번역) | | +$20–40 |
| 용어집·UI 사전 (§4) | 대화형 | <$10 |
| **총 1회성** | | **~$220–240** |

### ⚠️ 번역 비용 최적화 — 반드시 적용

- **effort = low 또는 medium.** 번역은 깊은 추론이 불필요하다. thinking 토큰은 **출력 토큰으로 과금**되므로, 고effort는 출력비를 부풀린다. 번역은 `output_config: {effort: "low"}`로 충분하며 이것이 비용의 최대 레버다.
- **프롬프트 캐싱:** 용어집+스타일 가이드를 모든 배치 요청의 system에 고정 → prefix 캐싱. (렌더 순서 tools→system→messages, 볼라틸한 원문은 마지막 user 블록에.)
- **배치 운영 함정(기존 경험):** 정체 시 90분 룰로 취소·재제출 / custom_id 64자 제한(긴 슬러그는 해시 코드로) / 파일럿 ≲50건은 배치 말고 동기 병렬.

---

## 3. 품질 — 구글 일괄번역과의 차이

구글 NMT는 문장 단위라 이 사이트의 약점을 정확히 찌른다: 영화비평 레지스터, 이론 용어 일관성, 영화 공식 표기, 문단 간 논조. LLM 배치 번역 + 아래 3층으로 전문 번역가 수준에 근접한다.

1. **용어집 선행(glossary-first)** — 브랜드 용어·이론 용어·제목 매핑을 먼저 확정 후 전 요청 system에 주입. **용어 일관성이 기계번역과의 최대 차별점.**
2. **스타일 가이드 1페이지** — 문체(합쇼체 기본 검토), 직역 금지, 영화 제목은 매핑 테이블 우선, 인용문 원문 병기, 이론 용어는 헌장 준수.
3. **QA 루프** — Opus가 표본을 원문 대조 채점(정확성·용어·자연스러움), 기준 미달만 재번역. 이 QA 층이 구글 **scaled content abuse**(검수 없는 대량 기계번역) 정책 리스크를 실질적으로 제거한다.

---

## 4. 카테고리명·코너명 — "고급 연산" 층 (웨이브 ⓪, 최우선)

Take, Lineage, Tradition, Framework, Canon, Lens, The Screener, Now Playing, Strong Misreadings, Afterlife… **번역이 아니라 브랜드 어휘 설계.** 수백 단어뿐이라 비용은 무의미하고 방식이 중요.

- **원칙 1 — 브랜드 고유명은 영문 유지 + 한국어 설명 병기.** "TakeScore™"를 "테이크점수"로 옮기면 글로벌 인상·상표 일관성이 깨진다. (넷플릭스·Letterboxd가 한국어판에서도 고유명 유지하는 논리.)
- **원칙 2 — 기능적 명칭은 한국어 정식 명칭 신규 제정.** Directors→감독, Reception→평단의 기록 등. **용어 헌장 "1명사=1실체"의 한국어 확장.**
- **프로세스:** 최상위 모델과 대화형으로 후보 3~4안씩 생성 → **원우 최종 승인**. 반나절 세션. 결과가 §3 용어집 최상단에 들어가 전체 번역의 축이 된다.
- **그래서 순서상 가장 먼저.** 이것 없이 배치를 돌리면 용어가 흔들린다.

---

## 5. SEO 아키텍처 — 불이익 없이 + 글로벌 인상

- **URL: `/ko/` 서브디렉토리** (서브도메인 아님). 도메인 권위 통합, Next.js 자연스러움. 루트(영문)=`x-default`.
- **hreflang 쌍**: `generateMetadata`의 `alternates.languages`로 en↔ko 상호 링크. 사이트맵 17분할(lib/sitemap-data.ts)에 ko 자식 사이트맵 추가 + IndexNow.
- **자동 리다이렉트 금지**: IP로 한국 접속자를 /ko로 강제 이동하면 Googlebot(미국 IP)이 ko판을 못 본다. 상단 배너 "한국어로 보기" 제안만. (middleware.ts는 루트라 수동 커밋 — [[autodeploy-watcher-scope]].)
- **자기 canonical**: /ko 페이지는 자기 자신이 canonical. 영문으로 canonicalize하면 ko판이 색인에서 소멸.
- **점진 공개**: 웨이브별 사이트맵 추가. 얇은 중복 오인 방지. ([[live-audit-isr-cache-trap]] 캐시버스터 병행.)
- **메타데이터까지 번역**: title/description/OG(lib/og-template)/JSON-LD `inLanguage`. 빠지면 반쪽 번역으로 보임.
- **네이버 (한국 시장의 진실)**: 한국 검색 점유율 절반 이상이 네이버. 한국 트래픽이 목적이면 **네이버 서치어드바이저 등록 + 네이버 사이트맵 제출** 필수. 구글 SEO보다 큰 레버일 수 있음.

---

## 6. ⭐ 자율 번역 루프 — "영어 쓰면 한국어가 따라온다" (핵심 요구사항)

> 원우 요구: **앞으로 영어 콘텐츠를 작성하면 자동으로 텍스트를 감지해 한국어로 번역되는 자율 루프.** 시간 지연 허용. 이것이 인프라의 중심이며, 일회성 백필(§7 웨이브)도 같은 루프를 처음 한 번 크게 돌리는 것으로 통합된다.

### 6.1 설계 원리 = 번역 메모리(Translation Memory)

원본 테이블은 **건드리지 않는다.** 번역은 사이드 테이블에 저장하고, 소스의 해시로 신규/편집을 감지한다. → 신규 콘텐츠 자동 번역 + 영어 편집 시 자동 재번역 + 미변경분 재번역 안 함(멱등).

### 6.2 스키마

```sql
create table content_i18n (
  entity_type   text not null,   -- 'take' | 'essay' | 'figure' | 'meta_take' | 'reception' | 'taxonomy' | 'concept' ...
  entity_key    text not null,   -- 원본 PK/slug
  field         text not null,   -- 'body_md' | 'rationale' | ...
  lang          text not null,   -- 'ko' | (향후 'ja','fr' — 스키마 변경 0)
  source_sha256 text not null,   -- 번역 시점 영문 원본의 해시 (staleness 감지)
  text          text,            -- 번역문
  model         text,            -- 'claude-opus-4-8'
  status        text not null,   -- 'pending' | 'translating' | 'done' | 'stale'
  translated_at timestamptz,
  reviewed_at   timestamptz,     -- QA 통과 시각 (null=미검수)
  primary key (entity_type, entity_key, field, lang)
);
-- 렌더는 lang으로 조인 + 영문 폴백. unstable_cache 키에 locale 필수 포함(캐시키 bump — [[tier2-free-enrichment]] 계열 함정).
```

### 6.3 레지스트리 (번역 대상 정의)

`i18n_registry`(테이블 또는 워커 상수)로 (entity_type, source_table, key_column, [fields])를 선언. 예:

| entity_type | source_table | key | fields |
|---|---|---|---|
| take | takes | id | take_title, rationale |
| essay | essays | slug | title, dek, body_md |
| figure | figures | slug | label, description |
| meta_take | meta_takes | slug | title, laconic, thesis, essay |
| reception | film_reception | id | headline, comment, verdict, dek_lead |
| taxonomy | taxonomy_nodes | slug | label, definition |
| concept | theory_concepts | concept_slug | one_liner |

> 상태 게이트 준수: takes/meta_takes=published, essays=verified, figures=approved 만 대상.

### 6.4 리컨실러(감지) 쿼리

각 entity_type마다 소스↔content_i18n LEFT JOIN 후 **work item** 선별:
- ko 행이 **없음** (신규), 또는
- `sha256(현재 영문) <> 저장된 source_sha256` (영어가 편집됨 → stale)

이 두 조건이 "자동 감지"의 전부다. 어떤 경로로 콘텐츠가 들어오든(엔진 파이프라인·수기 삽입·hourly/daily) 균일하게 잡힌다.

### 6.5 워커 (크론)

**cron-A (수집·제출), 예: 매 N시간 (시간 지연 허용이므로 여유롭게)**
1. 리컨실러로 work item 수집(런당 상한, 예 2,000필드).
2. 규모 분기: **소량(≲50)이면 동기 병렬 호출**(즉시성), **대량이면 Opus Batch 제출**. ([[small-tests-sync-not-batch]])
3. custom_id = `{entity_type}:{shortkey}:{field}` (64자 제한 → 긴 slug는 해시). system=용어집+스타일(캐시). effort=low.
4. batch_id + custom_id 목록을 `i18n_batches` 추적 테이블에 status='submitted'로 기록.

**cron-B (폴링·수확), 예: 매 시간**
1. `i18n_batches`에서 미완 배치 상태 확인. `processing_status='ended'`면 결과 스트리밍.
2. custom_id → (entity_type, entity_key, field) 역매핑, `content_i18n` upsert: text + source_sha256(제출 시점 해시) + model + status='done'.
3. 영향 페이지 **ISR revalidate + IndexNow ping**. (사이트맵 ko 자식 자동 반영.)
4. 배치 정체 90분 초과 시 취소·재제출.

**cron-C (QA, 선택·저빈도)**
- status='done' & reviewed_at is null 중 5% 표본을 Opus로 원문 대조 채점. 미달은 status='stale'로 되돌려 cron-A가 재처리.

### 6.6 파이프라인 직결(선택 최적화)

hourly/daily 등 신규 생성 지점은 리컨실러가 어차피 잡지만, **즉시성이 필요하면 생성 스텝에 "en 출력 직후 ko 동시 생성" 훅**을 달 수 있다. 증분 비용 건당 1센트 미만. 기본은 리컨실러 단일 메커니즘으로 통일(운영 단순).

### 6.7 마크다운 파일 콘텐츠

루트의 exegesis/handoff 등 .md도 번역 대상이면, 매니페스트에 등록해 동일 `content_i18n`(entity_type='doc', key=파일경로)로 흡수. 커밋 훅보다 리컨실러가 안전.

---

## 7. 웨이브 로드맵

| 웨이브 | 내용 | 산출/의존 |
|---|---|---|
| **⓪ 용어집·인프라** | 카테고리명·이론용어·영화제목 매핑 확정(§4, 원우 승인) + `content_i18n`/레지스트리/리컨실러/`/ko` 라우팅·hreflang·미들웨어 배너 | 전체의 축 |
| ① 상위 트래픽 | GSC 상위 페이지 + 영화 제목 KOBIS 매핑 우선 번역 | 빠른 SEO 효과 |
| ② 간판 프로즈 | essays·meta_takes·reception (Opus 배치, effort low) | 리컨실러 첫 대량 런 |
| ③ 대량층 | takes(2.7만)·figures(1.8만) (Opus 배치) | ~$150 대부분 여기 |
| ④ 템플릿 i18n | film_sentences 13패턴+슬롯 사전, tv_playlists intro (LLM 0) | 정본 문장층 문서 |
| ⑤ 파이프라인·네이버 | 생성 훅(선택) + 네이버 서치어드바이저·사이트맵 + QA 크론 상시화 | 지속 운영 |

각 웨이브 독립 → 언제든 중단·순서 조정 가능. **② 이후는 사실상 §6 자율 루프가 항상 돌면서 알아서 채운다** — 웨이브는 "루프를 처음 크게 돌리는 순서"일 뿐.

---

## 8. 열린 결정 사항 (원우)

1. **문체**: 합쇼체(존댓말) vs 평어체 — §3 스타일 가이드 상단 확정 필요.
2. **브랜드 고유명 정책**: §4 원칙 1(영문 유지+설명) 채택 확인.
3. **네이버 진출 여부**: 한국 트래픽 목표라면 ⑤에서 등록. (구글만이면 스킵.)
4. **리컨실러 주기**: N시간 값(비용 vs 신선도). 지연 허용이므로 초기 6~12h 권장.
