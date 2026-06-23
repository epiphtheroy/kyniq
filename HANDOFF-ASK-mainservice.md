# HANDOFF — Metatake "ASK"를 메인 서비스로 (다른 AI 인수인계 문서)

> 이 문서 하나로 다른 AI가 프로젝트를 **이어받아 실제 웹사이트에 반영**할 수 있도록 작성됨.
> 작성 2026-06-19. 작성자(이전 세션 AI) + wonwoo의 설계 대화 기반.
> 더 깊은 설계는 같은 폴더의 `ASK-mainservice-작업계획.md`(마스터 플랜), `매거진-리서치-에이전트-브리프.md` 참조.
>
> **다음 AI가 해야 할 최종 목표: 아래에 정리된 설계·코드를 실제 라이브 사이트(`/ask`)에 안전하게 반영(통합·배포)하는 것.** §9가 그 실행 가이드다.

---

## 1. 프로젝트가 무엇인가 (한 문단)

Metatake는 영화 비평 큐레이션 서비스다. **ASK**는 그 핵심 기능으로, 사용자가 자연어로 영화/개념 질문을 하면 → Metatake가 보유한 **클로즈리딩(close-reading) 코퍼스에서 검색** → **근거·인용이 달린 비평적 답변**을 돌려준다. 자체 LLM 학습은 없다. 외부 모델(OpenAI 임베딩 + 생성 LLM) + 우리 코퍼스 검색(RAG)으로 동작한다. wonwoo는 이 ASK를 **전면 메인 서비스**로 끌어올리려 하며, 이 프로젝트는 그 품질을 "구조적으로" 끌어올리는 작업이다.

## 2. wonwoo가 원하는 것 (의도)

- ASK를 플래그십 품질의 메인 서비스로. "검색되어 나온, 검증 가능한 답"이라는 점이 차별점(해자)이다.
- 답변 본문에 **출처 매체의 실제 문구가 (전문 아닌) 적절한 인용으로** 녹아들기를 원함 — 단 합법적으로.
- 우리 검색 결과 자체를 사용자에게 보여주고 싶어함(투명성).
- 사전 등록한 **비평 매거진 + 학술 자료**에서만 보강(열린 웹 검색은 거부).
- 외국어(특히 한국어) 질문도 잘 처리.

## 3. 같이 내린 전략적 결정 (대화 요약)

| 질문 | 결정 |
|---|---|
| 우리 검색결과를 보여줄까? | **예.** 해자 강화, 거의 공짜. → W5로 구현됨. |
| 인터넷(열린 웹) 검색 허용? | **답변 소스로는 금지**(해자 희석·환각). 엔티티/사실확인 스캐폴딩으로만. |
| 사전 등록 매체/학술만 열기? | **예.** 학술=OpenAlex/Crossref/S2 API, 매거진=사전등록 allowlist. |
| 더 비싼/고차원 모델? | 임베딩(검색)과 생성을 분리. **최대 레버는 리랭커**(모델 차원 아님). 생성모델·3-large는 eval로 결정. |
| 출력 참조 제한(영화 수 캡) 제거? | 제거가 아니라 **질의 의도에 따라 동적**(넓은 개념=캡 유지, 특정 작품=캡 완화). |
| 매거진 기사 크롤·임베딩 합법? | 회색지대. 한국엔 TDM 면책 없음. **전문 저장 위험, 임베딩+짧은 스니펫+링크아웃이 방어선.** 변호사 게이트 필요. |
| 답변에 기사 문구 인용? | **가능**(저작권법 제28조 비평 인용). 단 짧게·출처표기·주종관계·기계적 가드레일 필수. |

## 4. 제1원칙 & 품질 모델 (모든 결정의 기준)

- **해자 = 검증 가능한 큐레이션 코퍼스에 그라운딩된 답변.** 모든 변경은 "그라운딩 약속을 강화하는가 희석하는가"로 판단.
- **품질 = 검색(retrieval) × 재랭킹(rerank) × 생성(generation), 이를 평가(eval)가 묶음.** 레버 크기: 검색·코퍼스 > 리랭커 > 질의이해 > 생성모델 > 임베딩차원.
- **그라운딩 무결성**: 외부(학술/매거진) 결과는 코퍼스 인용 스트림·생성 프롬프트에 **절대 섞지 않는다.** 별도 라벨·링크아웃.

## 5. 현재 시스템 (코드 ground truth)

**스택**: Next.js(App Router) + Supabase(Postgres+pgvector, 프로젝트 ref `jvgarcqrtsmgfimdcwgo` = "kyniq") + Vercel 배포. 배포는 repo 루트의 `deploy-*.command` 스크립트 패턴 사용.

**기존 ASK v1 파이프라인** (`app/api/ask/route.ts`, 프로덕션 현행):
1. 질문 → `embed(q)`: `api.openai.com/v1/embeddings`, `text-embedding-3-small`, **1536차원**, 직접 fetch. (in-memory 캐시 1h, 레이트리밋 12/min/IP)
2. → `ask_retrieve` RPC: 벡터 60 + FTS 60을 **RRF(k=60)** 융합, p_k=40, `status='published'` 필터, FTS는 `'english'` 고정.
3. → `diversify()`: 형상당 1개, 영화당 ≤2, 14개 유지.
4. → `gpt-4o-mini`(`ASK_MODEL` env) 그라운딩 프롬프트 → `[n]` 인용 + `USED:` 라인.
5. `app/ask/page.tsx`가 `[n]`을 실제 figure/take 링크로 렌더, Sources 목록 표시.

**DB 현재 상태 (2026-06-19, 임포트 진행 중 — 중요)**:

| 테이블 | total | embedded | missing | 인덱스 |
|---|---|---|---|---|
| takes | 46,503 | 23,804 | **22,699 (49%)** | `IVFFlat(lists=100, probes=10)` ⚠️ |
| figures | 14,194 | 4,559 | 9,635 | HNSW |
| meta_takes | 5,413 | 4,142 | 1,271 | HNSW |

- 다른 AI 에이전트가 **신규 영화 ~1500편을 임포트 중**(삽입 거의 완료, 임베딩이 절반 정도 뒤처짐). `ask_retrieve` 시그니처는 `(p_qvec text, p_q text, p_k int)` — qvec을 `"[...]"` 문자열로 받아 내부에서 `::vector(1536)` 캐스트.
- ⚠️ 검색 주 대상 takes만 IVFFlat(나머지는 HNSW) → W6에서 HNSW로 교체 예정.
- 임베딩 워커: `worker/mt-embed.py`(오프라인, `bulk_set_embeddings` RPC, 동일 모델).

## 6. 3-레인 모델 & 절대 규칙 (반드시 준수)

작업은 충돌하지 않는 3레인으로 분리된다.

- **레인 A (로직, 진행 가능)** — 검색된 행 위에서 도는 것. 임베딩/인덱스와 무관. → 이번 세션에 W1~W5+W7 빌드 완료.
- **레인 B (벡터, 동결 🔒)** — 임베딩 모델·차원·인덱스·커버리지. **임포트+임베딩 완료 + DB 스냅샷 전엔 절대 손대지 말 것.** (지금 바꾸면 1536/신차원 혼재로 검색 붕괴.)
- **레인 C (외부 소스, 법률 게이트 🔶)** — 학술(완료) + 매거진 인제스트/인용(변호사 사인오프 게이트).

**🚨 절대 규칙**
1. 임포트 진행 중엔 벡터 레이어(임베딩 모델/차원/인덱스/ask_retrieve 차원) 무접촉.
2. eval(W1)이 모든 품질 변경의 회귀 게이트. 측정 없이 머지·배포 금지.
3. 외부 결과(학술/매거진)는 코퍼스 인용·생성 프롬프트와 비혼합.
4. 매거진 **기사 본문 크롤·저장은 법률 게이트 전까지 금지**(메타데이터·연락처 수집은 OK).
5. 배포 전 `npm run build`(전체 타입체크) 필수 — 아래 §8 한계 참조.

## 7. 지금까지 개발된 것 (이번 세션 산출 — 전부 추가·플래그·프로덕션 무변경)

> 모든 신규 코드는 기존 v1 `/api/ask`·`/ask` 동작을 바꾸지 않음. 새 동작은 별도 라우트/플래그 뒤에 있어 **기본 OFF**.

### W1 — 평가 하니스 (`eval/`)
- `eval/gold-set.json` — 76문항(broad-concept 28 / specific-film 18 / multilingual 18, 한↔영 페어 포함 / out-of-corpus 12).
- `eval/run.mjs` — recall@k 프록시·다양성·거절정확도·지연·인용형식 채점. `node eval/run.mjs --retrieval-only`.
- `eval/README.md` — 실행법 + **베이스라인은 임포트 안정 후 확정** 경고.

### W2+W3+W4 — 로직 v2 (`lib/ask/` + `app/api/ask/v2/route.ts`)
- `queryUnderstanding.ts` — 언어감지·의도분류·FTS용 영어정규화.
- `rerank.ts` — 리랭커 어댑터(Cohere/Voyage, key-gated) + **무키 폴백**. `RERANK_PROVIDER`로 선택.
- `diversify.ts` — 의도 기반 동적 캡(넓은개념=2, 특정작품=5).
- `prompt.ts` — `SYS_V2` 그라운딩 프롬프트 + 인용규칙 플레이스홀더(W8 대비).
- `app/api/ask/v2/route.ts` — v1과 **동일한 응답 형태** `{answer,citations,readings,meta}`. 파이프라인: 질의이해→embed→ask_retrieve(p_k=60)→rerank→diversify v2→생성(`ASK_MODEL`).
- env: `ASK_MODEL`(기본 gpt-4o-mini), `RERANK_PROVIDER`(기본 fallback), `COHERE_API_KEY`/`VOYAGE_API_KEY`. `lib/ask/README.md` 참조.

### W5 — 검색결과 1급 노출 UI
- `components/AskReadings.tsx` — "Answer / Readings" 토글 + 읽기 카드. (공유 `Cite`/`REG` 타입의 단일 출처)
- `app/ask/page.tsx` — 토글 통합. **Answer 모드는 기존 렌더 그대로 보존.** ⚠️ 현재 이 페이지는 **여전히 v1 `/api/ask`를 호출**한다(아래 §9에서 v2로 전환 필요).
- `app/globals.css` — `ak-mode*`/`ak-reads*`/`ak-card*` 클래스 추가.

### W7 — 학술 보강 (`lib/sources/` — 레인 C 중 무게이트)
- `lib/sources/academic.ts` — `findFurtherReading(q)`: OpenAlex(주)+Crossref(보조)+S2(opt). 정규화·dedup·상위 5개.
- `components/FurtherReading.tsx` — "Further reading — beyond the corpus" 별도 라벨 섹션(teal/dashed, 코퍼스 출처와 시각 구분).
- v2 라우트에 `ACADEMIC_FURTHER_READING` 플래그 시 `further_reading` **별도 필드**로만 부착(생성 프롬프트·citations 비주입 — 검증됨).
- env: `ACADEMIC_FURTHER_READING`, `ACADEMIC_MAILTO`, `S2_API_KEY`. `lib/sources/README.md` 참조.

### ⚠️ 정리 필요(무해)
이전 에이전트가 타입체크용 임시 파일을 남겼고 이 환경 권한으로 못 지움: 개발기에서 `rm tsconfig.askcheck.json tsconfig.askv2.json`.

## 8. 검증 상태 & 한계

- 검증됨: v1 라우트 바이트 무변경, 신규 `lib/ask/*`·`lib/sources/*`·v2 라우트 파스 OK, Answer 모드 보존, v2 응답형태 동일, 학술 데이터 그라운딩 비혼합(생성 호출이 findFurtherReading보다 먼저).
- **한계**: 빌드 샌드박스가 외부망·TypeScript 표준 라이브러리 접근에 제약이 있어 **전체 `tsc`/`next build`·라이브 API 호출을 못 돌렸음.** → 다음 AI/개발기에서 `npm run build`와 eval 실라이브 실행으로 최종 확인 필요.

## 9. 매거진 리서치 봇 결과 (`data/sources/`)

별도 위임한 리서치 봇이 잘 돌아 산출물이 쌓였고, 워크스페이스에 보존함:
- `data/sources/magazine-allowlist.csv` — **매체 150곳** (24열 스키마: sitemap_url·render_mode·robots_ai_stance·crawl_delay·ingest_recommendation·trust_tier 등 크롤봇 입력 필드 포함).
- `data/sources/magazine-contacts.csv` — **연락처 288건** (제휴/라이선싱/마케팅/에디토리얼 이메일 + 인물·직함·출처).

**집계**:
- 언어: en 65, es 16, de 14, it 14, fr 12, + nl/ja/ko/ru/pt/pl/cs/hu/no/da/tr/sv/ca 등 → **다국어 풍부**.
- trust_tier: 1급 33, 2급 79, 3급 38.
- ingest_recommendation: permission-needed 115, RSS-incremental 17, avoid 17, API 1.
- robots_ai_stance: allows 83, unknown 45, disallows 14, partial 8.
- **연락처**: 실제 이메일 확보 143/288건, **이메일 1건 이상 확보 매체 78/150**. contact_type: editorial 148, general 88, partnerships 16, licensing 14, marketing 12, press 7 등.

**연락처 수집 목적(중요)**: wonwoo가 향후 **제휴/사용허락(이용허락) 요청 이메일**을 보내기 위함. 즉 이 contacts DB는 아웃리치용 자산이다. (인제스트 자체는 §10 법률 게이트 후.)

## 10. 남은 작업 & 게이트 (다음 AI/wonwoo가 풀 것)

### W6 — 벡터레인 (게이트: 임포트+임베딩 완료 + DB 스냅샷)
- [wonwoo] 임포트 완료 확인 → 임베딩 모델 결정(3-small 유지 vs 3-large 전환) → DB 스냅샷 → `python3 worker/mt-embed.py`로 커버리지 100%.
- [AI/Supabase] 그 후: takes를 **HNSW로 교체**, `ask_retrieve` **다축(figures+meta_takes 합류)** 업그레이드, ef_search/m 튜닝, W1 전후 비교. (3-large면 컬럼 차원·캐스트·쿼리경로 일괄 변경.)

### W8b+ — 매거진 인제스트 + 인용 엔진 (게이트: 한국 IP 변호사 사인오프)
- [wonwoo] 변호사에게: 수집·임베딩·짧은스니펫 저장의 적법성, **답변 내 인용 허용 임계치(출처당 길이·전체 비율)**, robots/옵트아웃 외 의무, 해외 매체 관할, 제휴 계약 조항. → 임계치 숫자가 가드레일 파라미터가 됨.
- [AI] 게이트 후: 인제스트 파이프라인(robots 준수·RSS 증분·임베딩+짧은스니펫·dedup) + 인용 엔진(길이 리미터·n-gram 중첩 가드·인용 결속·라벨 분리 렌더).

### 결정 대기 (이제 W1로 측정 가능)
생성모델 A/B(gpt-4o-mini → 프런티어) · 리랭커 벤더(Cohere/Voyage/self) · 임베딩 3-large 여부.

## 11. ▶ 다음 AI의 실제 웹사이트 반영 가이드 (핵심 실행)

목표: 위 설계·코드를 **라이브 `/ask`에 안전하게 반영·배포**. 순서:

1. **빌드 검증.** 개발기에서 `npm run build`(전체 타입체크) 통과 확인, `rm tsconfig.askcheck.json tsconfig.askv2.json`. 신규 파일 타입오류 있으면 수정(프로덕션 v1엔 영향 없음).
2. **W1 베이스라인.** 임포트 안정 후 `node eval/run.mjs --retrieval-only`로 v1 측정 → v2(`/api/ask/v2`) 측정 → v2가 동등 이상인지 확인. **여기서 통과해야 다음으로.**
3. **v2 점진 전환.** `app/ask/page.tsx`의 `fetch("/api/ask")`를 `/api/ask/v2`로 전환. 권장: 환경변수/쿼리파라미터 기반 카나리 토글로 일부 트래픽부터, v1을 폴백으로 유지.
4. **env 설정(Vercel).** 결정에 따라 `ASK_MODEL`, `RERANK_PROVIDER`(+ 벤더 키), `ACADEMIC_FURTHER_READING`+`ACADEMIC_MAILTO`. 학술 보강 켜면 `FurtherReading` 컴포넌트를 결과 화면에 연결(현재 v1엔 `further_reading` 필드 없음 → v2 전환과 함께).
5. **배포.** repo의 `deploy-*.command` 패턴을 따라 배포(예: `deploy-ask*.command` 참고). v1을 깨지 않는 추가 배포로.
6. **매거진 레지스트리(메타데이터만).** `data/sources/*.csv`를 Supabase 테이블(outlets/contacts)로 적재 + admin 뷰. **이때 기사 본문은 절대 크롤·저장하지 말 것**(법률 게이트 W8 전까지). 연락처는 제휴 아웃리치용으로 보관.

**다음 AI 가드레일(재확인)**: v2는 build+eval 통과 전 프로덕션 기본값으로 켜지 말 것 · 임포트 중 벡터레이어 무접촉 · 매거진 기사 본문 인제스트는 변호사 사인오프 전 금지 · 외부 결과는 코퍼스 인용/프롬프트와 비혼합.

## 12. 파일 인덱스

- `ASK-mainservice-작업계획.md` — 마스터 플랜(워크스트림 W1~W8, 의존성·리스크·결정·파일소유권).
- `매거진-리서치-에이전트-브리프.md` + `magazine-allowlist-template.csv` + `magazine-contacts-template.csv` — 리서치 위임 사양(완료됨).
- `data/sources/magazine-allowlist.csv` (150) · `data/sources/magazine-contacts.csv` (288) — 봇 산출물.
- `eval/` — W1 평가 하니스. `lib/ask/` — W2-4 로직 v2 + README. `app/api/ask/v2/route.ts` — v2 라우트.
- `components/AskReadings.tsx`(W5) · `components/FurtherReading.tsx`(W7) · `lib/sources/`(W7).
- 기존: `app/api/ask/route.ts`(v1) · `app/ask/page.tsx` · `lib/providers/openai.ts` · `worker/mt-embed.py` · `supabase/migrations/0013_metatake.sql`(스키마).
- 작업 DB: Supabase `kyniq` (ref `jvgarcqrtsmgfimdcwgo`).
