# HANDOFF — Metatake "ASK → RAG v2" 전체 인수인계 (완전판)

> 같은 노트북·같은 Cowork의 다른 AI에게. 경로는 이 컴퓨터 실제 경로 그대로 사용.
> 작성 2026-06-20. 이 문서가 최신이며, 이전 `HANDOFF-ASK-mainservice.md`를 **대체**한다(그건 Claude/Voyage·매거진·DB이슈 이전 버전).
>
> **현재 한 줄 상태:** v2 RAG 파이프라인은 `/rag`로 라이브(metatake.net/rag). 생성=Claude Sonnet 4.6, 리랭커=Voyage(키 조건), 학술 보강 ON, 매거진 인용 코드 완성(플래그 OFF). **단 하나의 큰 블로커: 다른 에이전트의 대량 임베딩으로 DB가 포화 → 검색이 20초 타임아웃 + HNSW 인덱스/매거진 인제스트를 아직 못 돌림.** 임베딩이 끝나면 "DB 비는 창구 일괄작업"으로 마무리한다(§9).

---

## 1. 프로젝트가 무엇이고, 우리가 무엇을 의도했나

**Metatake** = 영화 비평 큐레이션 서비스. **ASK** = 핵심 기능: 자연어 질문 → 우리 **클로즈리딩 코퍼스에서 검색** → 근거·인용 달린 비평적 답변(자체 LLM 학습 없음, RAG).

**의도(wonwoo):** ASK를 **전면 메인 서비스**로. v1보다 구조적으로 품질을 끌어올린다. 답변 본문에 출처 매체 문구가 *합법적 인용*으로 녹고, 검색 결과 자체도 보여주고, 외국어도 처리.

**제1원칙(모든 결정의 기준):** 해자 = **검증 가능한 큐레이션 코퍼스에 그라운딩된 답변**. 모든 결정은 "이게 그라운딩 약속을 강화하나 희석하나"로 판단.

**핵심 전략 결정(대화로 합의):**
- 우리 검색결과 노출 = **예**(해자 강화).
- 열린 웹 검색 = **답변 소스로 금지**; 사전 등록 매체·학술만.
- 최대 품질 레버 = **리랭커**(모델 차원 아님).
- 출력 참조 캡 = **질의 의도에 따라 동적**.
- 매거진 크롤·인용 = **미국식 공정이용으로 가능(변호사 확인)**, 단 가드레일 필수(짧은 인용·출처표기·링크아웃·전문 미저장·원문 대체 금지).
- **그라운딩 무결성:** 외부(학술/매거진) 결과는 코퍼스 인용 스트림·생성에 섞지 않는다(또는 섞되 [C#]로 분리 + 기계적 가드).

---

## 2. 인프라 좌표 (실제 값)

- **레포(이 컴퓨터):** `/Users/jerryje/Documents/MetaTake`
- **GitHub:** `git@github.com:epiphtheroy/kyniq.git`, 브랜치 `main`. (push하면 Vercel 자동배포)
- **Vercel:** 프로젝트 **`kyniq-5eox`**, id `prj_3m4uTBHWwYPt3YwxCeo2Yd5lL7RO`, team `team_BvhB8kRecAmpsAw2S92eSLSS`. 도메인 **metatake.net** · www.metatake.net · filmcurio.com. `.vercel/project.json`은 이 프로젝트로 교정됨.
- **Supabase:** 프로젝트명 "kyniq", **ref `jvgarcqrtsmgfimdcwgo`** (region ap-northeast-1). Supabase MCP로 접근(SQL 실행·인덱스 등 제어 가능). pgvector 사용, pg_cron 미설치.
- **현재 HEAD:** `ef7ae0f`(다른 에이전트의 graphs/home/perf 작업). 내 매거진 변경은 **미커밋**(§7-D).
- **배포 방식:** 더블클릭 `deploy-rag.command`(아래 §6). `git add -A` 아님 — **타깃 파일만** 커밋.

---

## 3. 아키텍처 — v1(/ask)과 v2(/rag)

**v1 = 프로덕션 기본**, `/ask` → `app/api/ask/route.ts`. **건드리지 않음.** 흐름: embed(text-embedding-3-small,1536) → `ask_retrieve` RPC(RRF: 벡터60+FTS60) → `diversify`(형상당1,영화당≤2,14개) → gpt-4o-mini 그라운딩 → `[n]` 인용.

**v2 = 새 격리 면**, `/rag` → `app/api/rag/route.ts`. **흐름(번호=워크스트림):**
```
analyzeQuery(W2: 언어감지·의도분류·영어FTS정규화)
 → embed(원질문, 1536)
 → ask_retrieve RPC (p_k=60; 벡터축=원질문, FTS축=영어정규화)
 → rerank(W3: VOYAGE 키있으면 Voyage rerank-2, 없으면 무키 fallback; topN 40)
 → diversify(W2 의도: 넓은개념 캡2 / 특정작품 캡5)
 → 번호 컨텍스트 [n]
 → [W8: MAGAZINE_QUOTES=1이면 magazine_retrieve + [C#] 컨텍스트 + 인용계약 프롬프트]
 → 생성(W4: Claude Sonnet 4.6 = anthropicAdapter; ANTHROPIC_API_KEY 없으면 gpt-4o-mini 자동폴백)
 → USED 라인 제거
 → [W8 가드: quotesAreClean 실패 시 코퍼스-온리로 1회 재생성 + critics 폐기]
 → [W7: ACADEMIC_FURTHER_READING≠"0"이면 OpenAlex/Crossref/S2 → further_reading 별도필드]
 → 반환 { answer, citations, readings, further_reading?, critics?, meta{model,intent,lang,reranker,...} }
```
응답 형태는 v1과 호환(프런트가 URL만 바꿔 전환). `/rag` 페이지엔 **진단 스트립**이 `intent·lang·reranker·model`을 표시 → 각 단계 실작동·키적용 여부 확인용.

**DB 함수 `ask_retrieve(p_qvec text, p_q text, p_k int)`** — 벡터(<=>)60 + FTS(websearch_to_tsquery english)60을 RRF(k=60) 융합, `status='published'`, 내부 `statement_timeout='20s'`. **현재 ~7초**(아래 §8).

---

## 4. 지금까지 한 것 (워크스트림별 상태)

| WS | 내용 | 상태 |
|---|---|---|
| 계획 | 마스터 플랜 + 매거진 리서치 위임 | ✅ 완료 |
| W1 | 평가 하니스 + 골드셋 76문항 | ✅ 코드 완료(개발기서 baseline은 임포트 후) |
| W2 | 질의이해(의도·언어·FTS정규화) | ✅ 라이브 |
| W3 | 리랭커(Voyage + 무키 폴백) | ✅ 라이브(키 조건) |
| W4 | 프롬프트 v2 + **생성모델 Claude Sonnet 4.6** | ✅ 라이브(키 조건) |
| W5 | 검색결과 1급 노출 UI(Answer/Readings 토글) | ✅ 라이브 |
| W7 | 학술 보강(OpenAlex/Crossref/S2) | ✅ 라이브(기본 ON) |
| W8 | 매거진 인용(가드레일·스키마·워커·라우트·UI) | ✅ **코드 완료**(플래그 OFF, 인제스트는 대기) |
| /rag | 격리 면 + 내비 + app/rag/ 단일폴더 통합 | ✅ 라이브 metatake.net/rag |
| 배포 | GitHub·Vercel 연결, deploy/unlock command | ✅ |
| **W6** | **벡터레인(HNSW·커버리지·다축·3-large)** | ⏳ **대기**(DB 포화) — §8·§9 |

---

## 5. 파일 지도 (위치 + 기능) — 핵심 참조

### v2 RAG 기능 (전부 `app/rag/` 한 폴더에 자립)
- `/Users/jerryje/Documents/MetaTake/app/rag/page.tsx` — `/rag` 페이지. `/api/rag` 호출, Answer/Readings 토글, 진단 스트립, FurtherReading·CriticQuotes 렌더.
- `app/rag/layout.tsx` — `./rag.css` 로드(전역 globals.css를 안 건드리려고).
- `app/rag/rag.css` — RAG 전용 스타일(`.ak-mode/.ak-reads/.ak-card/.ak-fr/.ak-cr`). 58줄.
- `app/rag/_components/AskReadings.tsx` — Readings 모드 카드 + 공유 `Cite`/`REG`/`AskMode`/토글.
- `app/rag/_components/FurtherReading.tsx` — 학술 "Further reading" 레일(W7), `AcademicRef` 타입.
- `app/rag/_components/CriticQuotes.tsx` — 매거진 "From the critics" 인용 레일(W8), `Critic` 타입.
- `app/rag/_lib/queryUnderstanding.ts` — `analyzeQuery()`: 언어감지·의도분류·영어FTS질의. (gpt-4o-mini 1콜 + 휴리스틱 폴백; `@/lib/providers/openai` 사용)
- `app/rag/_lib/rerank.ts` — `rerank()`·`getReranker()`·`activeRerankerName()`. Voyage/Cohere 어댑터(키조건) + 무키 `FallbackReranker`. 기본 provider="fallback"(주의: Voyage는 `RERANK_PROVIDER=voyage` 필요).
- `app/rag/_lib/diversify.ts` — 의도 기반 동적 다양성 캡.
- `app/rag/_lib/prompt.ts` — `SYS_V2` 그라운딩 프롬프트.
- `app/rag/_lib/anthropic.ts` — **Claude(Anthropic) 생성 어댑터**. Messages API, 현재 Claude 단가로 비용 계산. `@/lib/providers/types`의 인터페이스 준수.
- `app/rag/_lib/academic.ts` — `findFurtherReading()`: OpenAlex(주)+Crossref(보조)+S2(opt). 정규화·dedup·상위5. mailto 기본 wonwoo@metatake.net.
- `app/rag/_lib/quotation.ts` — **매거진 공정이용 가드레일 엔진(W8)**: `clampQuote`(길이상한)·`quotedFraction`·`verbatimViolations`(통째베끼기 탐지)·`quotesAreClean`·`attribution`·`quotationContract`. **node로 실측 테스트 통과.**
- `app/rag/README.md` — 폴더 자체 설명.
- `/Users/jerryje/Documents/MetaTake/app/api/rag/route.ts` — **v2 API**(Next.js 규칙상 app/api/ 아래). 위 §3 흐름 전부. 플래그: `ASK_MODEL`(기본 claude-sonnet-4-6), `ACADEMIC_FURTHER_READING`(≠"0"이면 ON), `MAGAZINE_QUOTES`(=="1"이면 ON).

### 공유 파일(딱 2곳만 손댐)
- `components/MetatakeNav.tsx` — 내비에 "RAG" 링크 1줄 추가(타입 union에 "rag").
- `app/globals.css` — (구) 48줄 ak- 스타일이 미커밋으로 남아있을 수 있음. 현재 /rag 스타일은 `app/rag/rag.css`로 옮겨졌으니 globals.css 변경은 배포에서 제외됨. (정리하려면 `git checkout -- app/globals.css` 가능)

### 매거진 인프라 (DB/개발기 — Vercel 빌드 대상 아님)
- `/Users/jerryje/Documents/MetaTake/supabase/migrations/0026_magazine_sources.sql` — `magazines` + `magazine_passages`(짧은 스니펫+embedding) 테이블 + `magazine_retrieve(p_qvec,p_q,p_k)` RPC. **아직 DB에 미적용.**
- `/Users/jerryje/Documents/MetaTake/worker/magazine-ingest.py` — 개발기 실행 워커(외부망 필요). `--seed`(매체등록) / `--enable rss`(안전 RSS 활성) / 기본(크롤→짧은스니펫≤60단어→임베딩). 이미 저장 URL 건너뜀(재실행 ~0원). 패턴은 `worker/mt-embed.py`와 동일.
- `/Users/jerryje/Documents/MetaTake/data/sources/magazine-allowlist.csv` — 매체 150곳(크롤봇 입력 필드 포함).
- `/Users/jerryje/Documents/MetaTake/data/sources/magazine-contacts.csv` — 연락처 288건(제휴/이용허락 아웃리치용).

### 평가 (개발 도구, 라이브 아님)
- `/Users/jerryje/Documents/MetaTake/eval/gold-set.json`(76문항) · `run.mjs`(채점기) · `README.md` · `report.json`. 실행: `node eval/run.mjs --retrieval-only`. **baseline은 임포트 안정 후 확정.**

### 배포·도구 (레포 루트)
- `deploy-rag.command` — 더블클릭 배포. stale-lock 자동해제 + typecheck 게이트 + **타깃 add**(`app/rag`, `app/api/rag/route.ts`, `components/MetatakeNav.tsx`) + push. (migration·worker·.command 자신은 add 안 함 → 별도 커밋)
- `unlock-git.command` — 더블클릭으로 고아 git 락만 안전 제거(git 프로세스 없을 때만).

### 기존(참고)
- `app/api/ask/route.ts`(v1, 무변경) · `app/ask/page.tsx`(v1) · `lib/providers/{openai,types,gemini}.ts` · `worker/mt-embed.py`(코퍼스 임베딩) · `supabase/migrations/0013_metatake.sql`(코어 스키마).

---

## 6. 환경변수 (Vercel + 로컬 .env.local) + 보안

> **보안:** 레포는 **공개**. 키는 코드에 절대 넣지 않음 — `.env.local`(gitignore)과 Vercel 환경변수에만. (대화 중 Voyage 키 평문 공유됨 → 작업 후 rotate 권장.)

| 변수 | 용도 | 기본/상태 |
|---|---|---|
| `OPENAI_API_KEY` | 임베딩 + 폴백 생성 | 기존(Vercel·로컬) |
| `ANTHROPIC_API_KEY` | Claude 생성 | Vercel·로컬에 추가됨 |
| `VOYAGE_API_KEY` | Voyage 리랭커 | Vercel·로컬에 추가됨 |
| `ASK_MODEL` | 생성모델 | **코드 기본 `claude-sonnet-4-6`** (env 불필요) |
| `RERANK_PROVIDER` | 리랭커 선택 | **코드 기본 "fallback"** → Voyage 쓰려면 **Vercel에 `voyage` 명시 필요**(로컬엔 설정됨) |
| `ACADEMIC_FURTHER_READING` | 학술 레일 | **기본 ON**(="0"이면 OFF) |
| `ACADEMIC_MAILTO` | 학술 polite pool | 기본 wonwoo@metatake.net |
| `MAGAZINE_QUOTES` | 매거진 인용 | **기본 OFF**(="1"이면 ON) |

→ 확인: `/rag`에서 질문 → 진단 스트립 `model: claude-sonnet-4-6` / `reranker: voyage`면 키 적용됨. `gpt-4o-mini`/`fallback`이면 해당 키/RERANK_PROVIDER가 Vercel에 없음(폴백 중, 안 깨짐).

---

## 7. 절대 규칙 (다음 AI 준수)

A. **v1 무변경:** `app/api/ask/route.ts`·`app/ask/page.tsx` 손대지 말 것. /rag는 별도.
B. **그라운딩 무결성:** 학술(`further_reading`)·매거진(`critics`)은 코퍼스 `citations`/`[n]`과 절대 안 섞임. 매거진은 [C#] 분리 + 가드레일.
C. **플래그 안전:** 새 기능은 추가·플래그 뒤(기본 OFF/보수값). `MAGAZINE_QUOTES` OFF면 /rag 무변경·DB 미접촉.
D. **미커밋 상태:** 매거진 코드(quotation.ts·route 변경·CriticQuotes·page·rag.css)는 **working tree에 미커밋**. 배포하려면 `deploy-rag.command`(타깃 add). migration/worker는 별도 커밋·적용·실행. 다른 에이전트가 main을 전진 중(ef7ae0f)이니 충돌 피하려면 `app/rag`·`worker/magazine-*`·`migrations/0026`만 건드릴 것.
E. **벡터레이어 주의:** 임베딩 모델/차원/인덱스는 임포트 진행 중엔 손대지 말 것(아래 §8). 키 커밋 금지(공개 레포).
F. **배포 전:** 개발기서 `npm run build`(전체 타입체크). 샌드박스는 외부망/전체 tsc 불가라 파스체크만 했음.

---

## 8. 현재 큰 블로커 — DB 포화 → 검색 타임아웃

**증상:** /rag(및 /ask)에서 질문 시 "canceling statement due to statement timeout"(=Postgres 오류).
**원인(확인됨):** 다른 임포트 에이전트가 영화 **~1500편 + 임베딩을 대량으로 DB에 쓰는 중** → takes가 26K→46K로 거의 2배. 기존 `takes`의 **IVFFlat(lists=100) 인덱스가 못 따라가** `ask_retrieve`가 **~7초**(실측 EXPLAIN ANALYZE 6995ms) → 부하 얹히면 20초 내부제한 초과 → 취소. + 이 포화 때문에 인덱스 빌드·일부 admin 쿼리도 연결 타임아웃.
**시도/정리:** HNSW를 CONCURRENTLY로 만들려 했으나 연결 타임아웃 → 무효 인덱스 잔여물 `drop index if exists idx_takes_embedding_hnsw`로 **정리 완료**. pg_cron 미설치라 백그라운드 우회도 불가. **결론: 임베딩 에이전트가 끝나 DB가 조용해질 때까지 대기**.
**참고 인덱스 현황:** `takes`=IVFFlat(lists=100, probes=10) / `figures`·`meta_takes`=HNSW. 임베딩 커버리지는 마지막 확인 시 takes 약 절반(임포트 진행으로 변동).

---

## 9. 앞으로 해야 할 것 (의도 + 순서) — "DB 비는 창구 일괄작업"

**전제:** 임베딩 에이전트가 끝나 DB write 부하가 줄면 시작. (부하 확인: `pg_stat_activity`의 active/long-running 쿼리가 줄었는지 가볍게 조회.)

1. **[AI/Supabase] `takes` HNSW 인덱스 빌드** — 검색 ~7초→수십ms(타임아웃 해결). 임베딩 재생성 아님, **인덱스만**. DB 한가하면 직접 `create index ... using hnsw (embedding vector_cosine_ops)` 1~2분. (한가해야 연결 타임아웃 안 남.) ※ wonwoo가 "3-large 재임베딩은 나중에"라 했으니 **인덱스만, 재임베딩은 보류.**
2. **[AI/Supabase] 마이그레이션 `0026` 적용** — magazines/magazine_passages/magazine_retrieve 생성. + `magazine_passages.embedding`에 HNSW.
3. **[wonwoo, 개발기] 매거진 크롤** — `python3 worker/magazine-ingest.py --seed` → `--enable rss` → `python3 worker/magazine-ingest.py` (~1센트, 외부망 필요).
4. **[wonwoo] Vercel 환경변수** — `MAGAZINE_QUOTES=1`, 그리고 Voyage용 `RERANK_PROVIDER=voyage`(없다면) 확인. → 재배포(`deploy-rag.command` 또는 Vercel Redeploy).
5. **[AI] 검증** — /rag 진단 스트립(model/reranker), 검색 속도, 매거진 인용 표시 + 가드레일, W1 eval로 v1 대비 수치.

이 5개가 **W6(벡터 응급) + W8(매거진) 동시 마무리** = 사실상 전체 완성.

**그 이후 선택(원래 W6 풀버전):** 3-large(3072) 재임베딩 + 다축 검색(figure/meta_take 합류) + 커버리지 100% 백필. 그리고 v2를 `/ask`로 승격할지 결정(현재 /ask=v1).

---

## 10. 빠른 검증 체크리스트
- [ ] 개발기 `npm run build` 통과.
- [ ] 임포트 끝났는지 확인(DB write 부하↓).
- [ ] HNSW 빌드 → `/rag` 질문이 타임아웃 없이 빠르게.
- [ ] 진단 스트립 `claude-sonnet-4-6`/`voyage`.
- [ ] 학술 레일 표시(영화 비평 질의엔 드물 수 있음 — 정상).
- [ ] 0026 적용 + 크롤 + `MAGAZINE_QUOTES=1` → "From the critics" 인용 표시, 출처·링크, 과다인용 시 자동 차단.
- [ ] 정리: `rm tsconfig.askcheck.json tsconfig.askv2.json`(있으면), Voyage 키 rotate.

## 11. 관련 문서
- `ASK-mainservice-작업계획.md` — 마스터 플랜(W1~W8 상세).
- `매거진-리서치-에이전트-브리프.md` + `magazine-allowlist-template.csv` + `magazine-contacts-template.csv` — 리서치 위임(완료).
- `HANDOFF-ASK-mainservice.md` — (구버전, 이 문서로 대체).
