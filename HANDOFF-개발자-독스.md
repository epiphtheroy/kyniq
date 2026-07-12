# HANDOFF — For Developers 독스 ("빌더 노트") 작업지시서

> **지위**: 이 문서가 For Developers 코너의 **단일 정본 작업지시서**다. 다른 AI(구현자·저술자)가 이 문서만 받아도 셸 구현과 기사 저술을 끝까지 수행할 수 있도록 목적·IA·파일 위치·렌더러 확장·기사 인벤토리(문서별 포인트/소스/공개 코드/금지)·톤 헌장·공개 수위·페이즈·검증을 전부 담는다.
> 작성: 2026-07-12. 형제 문서: `HANDOFF-방법론-독스.md`(독자용 방법론 독스 — 셸·레지스트리·렌더러의 선례이자 재사용 대상).
> **표준 샘플(voice 기준)**: `site_content/DEVDOCS_SAMPLE_cache-keys.md` — 모든 기사는 이 샘플의 형식·자기비판적 톤을 따른다.
> 등재: `docs/00-INDEX.md` § Design plans.

---

## 0. 구현자 시작 절차

1. 이 문서 전체 → `HANDOFF-방법론-독스.md` §2~§6(셸 선례) → 샘플 순으로 읽는다.
2. P0(셸)부터 구현한다. 콘텐츠 저술은 §7 인벤토리의 기사 카드 순서(P1 플래그십부터)로.
3. 각 기사는 카드에 적힌 **소스 파일을 실제로 읽고** 쓴다. 소스에 없는 무용담을 지어내지 않는다(불변식 D-3). 수치·결과는 소스/DB에서 실측.
4. 완료 시 §11 검증 체크리스트 통과 후 배포.

**절대 하지 말 것(요약)**: 시크릿·키·Supabase ref 노출 금지(§8) · "Cinecodex" 등 내부명 금지(공개명 TakeScore) · `/methodology` 문서와 모순 금지(D-1) · 콘텐츠 `.md`에는 자유롭게 백틱 사용 가능하나 **TS 파일에 마크다운을 넣지 말 것**(방법론 독스의 백틱 함정 회피가 이 코너의 설계 이유 중 하나) · `next.config.ts`는 루트 파일 = 워처 밖 = **수동 커밋**.

---

## 1. 왜 만드는가 (기획 의도)

Metatake는 특이한 기술 시도가 밀집된 실전 사례다 — 6,700편 LLM 채점과 신뢰도 측정, 46만 행 무LLM 문장 생성, pgvector 하이브리드 검색, 70에이전트 문서 저술, bash 40줄 CI/CD, 봇 센티널. 이 코너는 그 과정에서의 **고민·선택·이용한 서비스·시행착오·결과**를 개발자의 언어로 기록한다.

**목표(우선순위)**: ① 개발자 트래픽 — 각 기사가 개발자가 실제로 검색하는 고민 단위의 질문에 답한다. ② **Wonwoo Yoon의 AI-빌더 브랜딩** — 단, 자랑이 아니라 기록의 축적으로. 신뢰는 자기에게 가혹하고 객관적인 목소리에서 나온다(§6 톤 헌장).

**코너 정체성**: 이름 **"For Developers"**, 부제 *"When a developer loves cinema — engineering notes from building Metatake."* 사이트의 편집 보이스("we", 데스크)와 달리 이 코너는 **1인칭 단수("I")의 개인 엔지니어링 노트**다. 허브 인트로에 한 줄로 관계를 정리한다: *"Metatake speaks as an editorial desk; these notes are one builder's."*

---

## 2. URL·저장 방식 결정 (확정)

| 항목 | 결정 | 근거 |
|---|---|---|
| 라우트 | **`/developers`**(허브) + **`/developers/[slug]`** | `/methodology`와 형제. `app/developers/` 미존재 확인 필요(충돌 시 `/for-developers`). |
| 콘텐츠 저장 | **플레인 `.md` 파일** — `lib/devdocs/content/<slug>.md` | 개발자 글은 코드 펜스(```)와 인라인 코드가 필수. 방법론 독스의 마크다운-in-TS는 백틱이 template literal을 깨는 함정이 실증됨(TS1160 사고). `.md`는 lib/ 아래라 워처 자동커밋 범위이며 GitHub에서도 읽힌다. |
| 로딩 | `lib/devdocs/load.ts`의 `fs.readFile` + `unstable_cache` | Vercel 번들 포함을 위해 `next.config.ts`에 `outputFileTracingIncludes: { "/developers/[slug]": ["./lib/devdocs/content/**/*"] }` **필수**(없으면 프로덕션에서 파일 미포함 → 404). ⚠️ 루트 파일 = 수동 커밋. |
| 렌더러 | `lib/docs/md.ts`를 **확장**(신규 작성 금지) | ``` 펜스 + 인라인 코드 지원 추가(§4). 방법론 본문엔 백틱이 없어 하위호환. |
| 언어 | 영어 단일(ko는 보류) | — |

---

## 3. IA — 카테고리 × 기사 트리

상단 카테고리 스트립 + 좌측 트리(방법론 독스와 동일 셸). **10카테고리 46기사**(§7이 정본). 카테고리 키:

```
start-here        Start here (3)          llm-pipelines   LLM pipelines (7)
embeddings        Embeddings & search (7) data-eng        Data engineering (6)
zero-llm          Zero-LLM systems (4)    delivery        Next.js & delivery (7)
agents            Agents & automation (5) bots-trust      Bots, scraping & trust (4)
solo-ops          Cost & solo ops (2)     postmortems     Postmortems (3... 표기상 별도지만 §7 참조)
```

기사 제목은 **개발자의 고민 단위 질문**으로 짓는다("How do I…", "What happens when…", "X broke — here's why"). 각 기사 하단: "What I'd do differently"(필수) → Related → prev/next → corrections 각주.

---

## 4. 구현 스펙 (파일 위치 정확히)

**신규 파일**:
```
app/developers/layout.tsx            # SiteNav + DevTopTabs + DevSidebar + developers.css import
app/developers/page.tsx              # 허브: 인트로(빌더 노트 선언) + "the stack at a glance" 블록 + 카테고리 카드 + 최신 기사
app/developers/[slug]/page.tsx       # 기사 렌더러 (아래 상세)
app/developers/developers.css        # .devd-* — 방법론 methodology.css를 복제·개명 후 코드블록 스타일 추가
lib/devdocs/registry.ts              # lib/docs/registry.ts와 동일 형식: DEV_CATEGORIES + DEV_DOCS(slug/nav/title/desc/category)
lib/devdocs/load.ts                  # loadDevDoc(slug): fs.readFile(path.join(process.cwd(),"lib/devdocs/content", slug+".md")) → unstable_cache(["devd-load1",slug],{revalidate:3600})
lib/devdocs/content/<slug>.md        # 기사 본문(46개; §7 슬러그 그대로 파일명)
app/sitemaps/devdocs.xml/route.ts    # core 패턴 복제
components/devdocs/DevSidebar.tsx    # components/docs/DocsSidebar.tsx 복제 후 registry·basePath만 교체(공용화 리팩토링 금지 — 방법론 셸 회귀 위험 회피)
components/devdocs/DevTopTabs.tsx    # 〃
components/devdocs/DevPager.tsx      # 〃
```
**수정 파일**:
```
lib/docs/md.ts        # (a) 펜스: /^```(\w*)$/ 열고 ``` 닫음 → <div class="md-codewrap"><pre class="md-code"><code class="lang-{lang}">이스케이프된 원문</code></pre></div>; 펜스 내부는 어떤 변환도 하지 않음(이스케이프만). (b) 인라인 `code` → <code>. 이스케이프 먼저. 기존 출력 불변 확인(방법론 46문서 렌더 스냅샷 비교).
lib/sitemap-data.ts   # devdocsEntries(): 허브 + 본문 파일이 실존하는 slug만
app/sitemap.xml/route.ts  # SECTIONS += "devdocs"
app/llms.txt/route.ts # "## For Developers" 섹션(레지스트리 연동)
next.config.ts        # outputFileTracingIncludes (⚠️ 루트 — 수동 커밋)
components/... footer # 전역 푸터 "Metatake" 칼럼에 "For Developers" 링크 1개(푸터 정의 위치는 app/layout.tsx 인근에서 grep "site-footer"로 확인)
app/methodology/... hub # 허브 하단에 교차 링크 1줄: "Curious how this is engineered? → For Developers"
```
**[slug] 렌더러 요건**: `generateStaticParams(){return []}` · `revalidate 3600` · notFound(미등록/파일없음) · 메타 `${title} — For Developers · Metatake` · canonical `/developers/${slug}` · JSON-LD **TechArticle**(+BreadcrumbList, author/editor Person Wonwoo Yoon url /editor, datePublished/dateModified) · 상단 바이라인 "By Wonwoo Yoon · builder, Metatake · Reviewed {월 연도}" · 하단 corrections 각주 + prev/next.

**코드블록 CSS(developers.css)**: `.md-codewrap{overflow-x:auto;border:1px solid var(--hairline);border-radius:10px;margin:18px 0;background:#0F1117}` `.md-code{padding:14px 16px;font:12.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;color:#E6E8EB;white-space:pre}` — 페이지는 라이트 유지, 코드만 다크(개발자 관례). 하이라이팅 라이브러리 도입 금지(P2 검토 항목).

---

## 5. 발견성·브랜딩 장치

1. 사이트맵 `devdocs.xml` + IndexNow 핑. 2. `llms.txt` 섹션. 3. 전역 푸터 링크. 4. `/methodology` 허브 교차 링크(양방향). 5. TechArticle JSON-LD(브랜딩의 기술적 실체 — author Person이 /editor로 수렴). 6. **P2**: `/developers/feed.xml` RSS(개발자는 구독한다), OG 이미지. 7. 외부 배포(HN/Reddit/dev.to 크로스포스트)는 **오너 수동 판단** — 지시서 범위 밖, 자동화 금지.

---

## 6. 톤 헌장 (기사 전체 공통 — 위반은 리라이트 사유)

1. **1인칭 단수, 자기에게 가혹하게.** 성공보다 실패를 먼저, 실패엔 원인 분석을. "나는 이걸 틀렸다"가 이 코너의 기본 문형이다.
2. **숫자가 없으면 주장하지 않는다.** before/after(2.9s→0.06s, 3s→0.2s, OOM→수 분), 규모(466,974행, 6,701편), 비율(첫 검증 탈락 ~1/5). 수치는 소스에서 실측·검증.
3. **겸손의 형식화**: 매 기사 필수 섹션 "What I'd do differently". 선택엔 반드시 "당시 고려한 대안 + 버린 이유"를 쓴다. 일반화하지 않는다 — "이건 내 조건(1인, 이 규모, 이 예산)에서의 답"임을 명시.
4. 마케팅·과장·자기선전 금지: "revolutionary/blazing/game-changer" 류 0. 브랜딩은 어조가 아니라 **기록의 밀도**로 한다.
5. 서비스·도구 언급은 사실 기반(무엇을 왜 골랐고 무엇에 데였나). 특정 벤더 디스 금지 — 한계는 "내 사용 조건에서"로 한정.
6. 방법론 독스와 역할 분리: 독자용 원칙은 /methodology가 정본. 여기선 **구현·트레이드오프·코드**만. 겹치는 주제는 상호 링크(재서술 금지).

---

## 7. 기사 인벤토리 (46편 — 카드가 저술 지시의 정본)

> 카드 형식 — **slug · 제목**: 다룰 포인트 / 소스(실측 검증된 경로) / 공개할 코드 / 금지·주의.
> 공통 소스: 해당 주제의 HANDOFF·memory. 공통 금지: §8.

### A. start-here (3)
- **why-i-built-this · "Why I built a 7,000-film site mostly with AI agents"**: 동기(영화 사랑+사회과학 훈련), 1인+AI 운영 모델의 요지, 무엇이 됐고 무엇이 안 됐나 3가지씩, 이 노트들의 약속(숫자·실패·재현조건). 소스: `app/about/page.tsx`, `app/editor/page.tsx`, docs/00-INDEX.md. 코드: 없음.
- **the-stack · "The stack, honestly"**: Next.js App Router+Vercel(hnd1)+Supabase(Tokyo, Postgres+pgvector)+Python 워커(Mac 로컬)+bash 워처+Anthropic/OpenAI API. 각 선택의 이유와 "다시 고른다면". 텍스트 아키텍처 다이어그램 1개. 소스: `vercel.json`, `package.json`, `worker/`, `auto-deploy-watch.sh`. 코드: vercel.json 발췌.
- **how-these-notes-work · "How these notes are written (and what I won't tell you)"**: 톤 헌장 공개판 + 공개수위(코드는 열되 키·프롬프트·일부 상수는 소유) + methodology와의 관계. 소스: 본 HANDOFF §6·§8.

### B. llm-pipelines (7)
- **scoring-6701-films · "Scoring 6,701 films with an LLM that can't promise the same answer twice"**: 루브릭 앵커링(BARS 밴드), 하위점수별 median 집계 절칙, temp 0.6·N=1 전수→플래그만 N=3, custom_id 설계(64자·콜론 제약에 데인 것). 소스: `score/Cinecodex_RUNBOOK.md`, `score/Cinecodex_HANDOFF.md`, `score/cinecodex_schema.sql`. 코드: 집계 SQL 개념(스키마 주석 기반). 금지: 프롬프트 전문·앵커 영화 gold값·**"Cinecodex" 명칭(TakeScore로)**.
- **measuring-what-you-cant-promise · "LLM-as-judge: measure reliability, don't claim determinism"**: 상용 API 비트결정론 불가(배치 비불변·라우팅), 그래서 ICC(동일모델 반복 ≈0.99)·크론바흐 α(패널 ≈0.958)를 실측·공개, 컨트롤셋 드리프트 게이트(초과 시 파이프라인 정지). 핫토픽. 소스: `score/Cinecodex_Conclusions_Display_and_Reliability.md`, RUNBOOK. 코드: 드리프트 게이트 의사코드. 금지: tolerance 정확값은 "±밴드 수준"으로.
- **the-fifteen-percent · "Flag-and-rescore: spending money only where the model is unsure"**: 플래그 조건 4종(경계 근접·고분산·패널 불일치·고위험)의 설계 논리, 전수 N=3 대비 비용 구조(개념). 소스: RUNBOOK. 금지: 정확 임계수치.
- **batch-api-in-anger · "Message Batches + prompt caching, in anger"**: 언제 배치/언제 실시간(≲50건 파일럿은 동기 — memory `small-tests-sync-not-batch`), 정체 배치 90분 룰(취소·재제출), cache_control 시스템 블록, 실측 교훈. 소스: memory `engine-wave-ops-lessons`, `film-naming-batch-pipeline`, RUNBOOK. 코드: 배치 제출 페이로드 뼈대. **비용: §8 결정점 D-a.**
- **model-task-fit · "Sonnet writes, Opus audits, Haiku failed my parser"**: 파이프라인 단계별 모델 적합성 실측 — 준수 파서는 작은 모델이 아니라 python(기계 체크)+큰 모델(내용 체크)로 갈라야 했던 이유, "최종 메시지=파일" 강제 등 모델별 버릇. 소스: memory `engine-pipeline-model-quirks`, `RUNBOOK-EngineRoom.md`. 
- **draft-verify-kill · "Quality gates that actually reject: draft → adversarial verify → rewrite ≤2 → kill"**: 검증자를 '공격자'로 프롬프팅하는 설계, 첫 검증 ~1/5 탈락 실측, kill을 감수하는 이유(빈 자리가 나쁜 글보다 낫다), 통과 후 무편집 원칙. 소스: `RUNBOOK-EngineRoom.md`, `app/engine-room/page.tsx`. 금지: 프롬프트 원문.
- **planning-a-30m-char-translation · "Sizing a 29M-character translation before spending a won"**: 웨이브 설계(용어집 먼저), effort 다이얼이 지배적 비용 레버라는 계산, 해시 기반 재번역 큐(source_sha256 리컨실러) 설계. 상태: 설계 완료·미실행임을 정직하게. 소스: `HANDOFF-한국어화-i18n-마스터.md`. **비용: 결정점 D-a.**

### C. embeddings (7)
- **hnsw-that-wouldnt-build · "The HNSW index that OOM'd — and the partial index that didn't"**: 풀테이블 빌드 메모리 초과 → `WHERE status='published'` 부분 인덱스로 수 분 내, 쿼리 술어가 인덱스 술어를 함의해야 타는 함정, 2.9s→130ms. 소스: memory `pgvector-hnsw-build-ops`, `supabase/migrations/0040_search_v3.sql`. 코드: CREATE INDEX 문.
- **one-search-to-rule-them · "RRF: fusing trigram and pgvector into one engine for every search box"**: 표면 5곳 파편화→단일 엔진 통합기, 어휘 12종 UNION + 시맨틱 6레그, RRF 융합, SearchHit 계약(사전계산 href — kind별 slug 의미가 달라서). 소스: `HANDOFF-검색엔진-통합.md`, `lib/search.ts`, `supabase/migrations/0040/0041`. 코드: RRF 융합 함수 발췌. **시맨틱 floor 수치: 결정점 D-b.**
- **korean-query-english-corpus · "Cross-language search for free (and the IME bug that almost killed it)"**: 임베딩 공간의 교차언어 성질, 폴백 floor 설계, 로컬 히트가 폴백을 죽이던 버그, 한글 IME 조합 중 Enter 가드. 소스: 검색 HANDOFF. 코드: IME keydown 가드 스니펫(lib/useSearch.ts).
- **a-film-is-its-readings · "Taste vectors: a film as the mean of its readings"**: 평균 벡터의 효용과 한계, **표면축 사고**(figure 임베딩은 같은 영화끼리 뭉침 → 랭킹엔 take/rationale 임베딩만) — 임베딩 축 선택 실패담. 소스: `HANDOFF-트로프피겨아키타입-순위표면.md`, `worker/mt-embed.py`. 
- **drawing-the-galaxy · "1,941 films as a galaxy: t-SNE, fixed seeds, and 'new edition' rebuilds"**: 좌표 사전계산·seed 고정(결정론), 재빌드=전면 이동이라 분기 이벤트로 취급, KMeans 클러스터 라벨을 데이터에서 명명. 소스: `worker/galaxy-build.py`, `docs/PLAN-connections-overhaul.md`. 금지: seed값·하이퍼파라미터 정확값.
- **films-that-argue · "Counterpoints: mining films that stage the same trope and disagree"**: 트롭별 독해벡터 스테이징, "가장 먼 쌍" 판정과 (1−sim)·idf 랭킹의 설계 논리, 유사도 엔진은 논쟁을 못 찾는다는 관찰. 소스: `docs/PLAN-connections-overhaul.md`. **임계 수치: 결정점 D-b.**
- **embedding-traps · "Three embedding traps I fell into"**: ① 멤버별 상수 유사도(트롭별 cohesion 복사)를 랭킹에 쓰려던 것 ② 축 혼동(표면축/의미축) ③ 모델 교체 시 floor 전면 재측정 필요(코사인 분포 이동). 소스: 순위표면 HANDOFF, 검색 HANDOFF.

### D. data-eng (6)
- **tmdb-identity-spine · "One ID to bind them: entity resolution without guessing"**: 모든 층이 tmdb_id로 수렴, 이름+연도+QID 리졸브(정수 ID 추측 금지 원칙), 앵커 레코드(visible=false) 패턴 — 완전열거가 카탈로그를 팽창시킨 인과. 소스: `handoff/00_INTERFACE_CONTRACT.md`, `lib/tmdb.ts`.
- **the-1000-row-wall · "PostgREST caps every response at 1,000 rows — patterns that survive it"**: 사일런트 절단으로 사이트맵이 조용히 URL을 버리던 사고, fetchAll 페이저, jsonb_agg 단일행 RPC 우회. 소스: memory `postgrest-1000-row-cap`, `lib/sitemap-data.ts`(fetchAll). 코드: fetchAll 전문.
- **rls-plus-rpc · "RLS everywhere, service-role nowhere near the client"**: security-definer RPC를 API 레이어로, anon 3초 timeout을 함수 레벨 `set statement_timeout`으로 우회한 사연, 개인화 RPC는 세션검증 라우트+`private, no-store`. 소스: TV/렌즈 HANDOFF들, `supabase/migrations/0062_sentence_rpcs.sql`.
- **jsonb-scars · "jsonb scars: three Postgres traps in production"**: to_jsonb 별칭=컬럼명 함정, jsonb 빈-게이트는 `jsonb_typeof='null'`, jsonb 스캔 부적합→정규화 인덱스 테이블(film_provider_index) 전환. 소스: memory `first-party-analytics`·`surprise-me-expansion`, `HANDOFF-테이크스코어-스크리너.md`. 코드: 각 함정의 before/after 스니펫.
- **schema-in-vcs-gap · "The migrations my repo doesn't know about (an honest postmortem)"**: 라이브 DB에만 있는 RPC들이 생긴 경위(MCP로 직접 적용), 마이그레이션 번호 충돌 회피, 지금의 절충과 남은 부채. 소스: memory `tier2-almanac-plan` 외, `supabase/migrations/` 목록. 자기비판 강도 높게.
- **free-enrichment-at-scale · "Backfilling 5,000 thin films from free sources"**: OMDb/TMDB/Wikidata 무료 소스 레시피, --shard 병렬, 무료 티어 한도 설계. 소스: `worker/external-data.py`, memory `tier2-free-enrichment`.

### E. zero-llm (4)
- **half-a-million-sentences-no-llm · "466,974 sentences with zero LLM calls"** *(플래그십)*: format()만으로 13패턴, 전 값 FK(환각 구조적 차단), md5(UTC시간) 시드 결정론 회전, 13만행 셀프조인을 unlogged 스크래치+hex 버킷으로, MCP 타임아웃≠롤백 운영 교훈. 소스: `HANDOFF-임베딩판타지아-문장층.md`, `sentence-engine/MASS-PRODUCTION.md`. 코드: 패턴 1개 SQL 전문 + 버킷 분할.
- **prose-from-rules · "Rule-assembled prose: letters and verbalized credits without a model"**: 고정 템플릿(same filings in→same sentence out), 언어화 규칙(전원 실명·평가어 0·부재=unknown), LLM-0이 주는 신뢰·비용·회귀 가능성. 소스: `HANDOFF-투두블유-큐레이션코멘트.md`, `credits-verbalization-spec.md`, `app/credits/credits-logic.ts`.
- **markdown-in-200-lines · "I wrote a 200-line markdown renderer instead of installing MDX"**: 레포에 md 파이프라인 부재→도입 대신 이스케이프-우선 결정론 렌더러, 스탯타일/토글 커스텀 문법, 그리고 **이 결정이 만든 함정**(TS template literal 백틱 사고 → 이 개발자 독스가 .md 파일인 이유). 소스: `lib/docs/md.ts`, 방법론 HANDOFF §13. 코드: 렌더러 핵심 발췌. 자기비판 포인트 명확.
- **when-not-to-use-a-model · "Where I refuse to use an LLM (a decision table)"**: 결정 기준 표 — 결정론 필요/사실 조립/규모×빈도/검증 가능성. 각 층의 실제 배치 근거. 소스: `lib/docs/content/ai-disclosure.ts`(공개 표와 정합 필수 — 모순 금지).

### F. delivery (7)
- **isr-for-300k-pages · "generateStaticParams(){return []}: ISR for hundreds of thousands of pages"**: 빌드타임 0 프리렌더+런타임 채움 패턴, revalidate 관례(3600 표준), 태그 무효화 병행. 소스: memory `isr-caching-pattern`, `app/film/[slug]/[desk]/page.tsx`. 코드: 로더 패턴 전문.
- **the-cache-that-outlived-my-deploy · "Vercel's data cache survives deployment — version your keys"** *(플래그십·샘플 문서)*: 오늘의 실사고 — 새 배포가 라이브인데 본문은 구버전(unstable_cache 키 불변), 정적 페이지 프로브로 원인 분리, 키 범프(`mdocs-render1→2`) 관례(film-load7 계보). 소스: `HANDOFF-방법론-독스.md` §13 v3, `app/methodology/[slug]/page.tsx`. **샘플: `site_content/DEVDOCS_SAMPLE_cache-keys.md`를 그대로 이식.**
- **pin-your-region · "Your DB is in Tokyo. Pin your functions there."**: hnd1 고정 한 줄로 콜드 3s→0.2s, 리전 불일치 탐지법. 소스: memory `vercel-supabase-region`, `vercel.json`. 코드: vercel.json.
- **forty-sitemaps · "40 child sitemaps and release cohorts: SEO for AI-written pages without tripping the spam filter"**: 섹션별 자식(GSC 섹션별 계측), 코호트 캡+oldest-first(append-only) 설계 — scaled content abuse 회피 논리, lastmod은 진짜 이벤트만. 소스: `lib/seo.ts` 주석(릴리스 로그), `lib/sitemap-data.ts`, `app/sitemap.xml/route.ts`.
- **stampedes-i-caused · "The cache stampede I built myself: time-seeded keys"**: 시간 시드를 캐시 키에 넣어 SWR을 무력화한 사고(홈 v8), 고정 키+재생성 시점 시드로 수정, RPC 함수레벨 타임아웃을 서킷브레이커로. 소스: `docs/PLAN-home-v8-rotation.md`. 
- **edge-caching-a-slow-api · "2.9s→0.06s: s-maxage on an API route + lazy-mounting heavy chunks"**: /api/map 엣지 캐시, LazyMount+dynamic import 청크 분리(MapLibre/그래프), 홈 TTFB 실측. 소스: home v8 PLAN.
- **verifying-against-a-cdn · "Live verification when everything is cached"**: 캐시버스터, React 주석 노드가 텍스트를 쪼개 grep을 속이는 함정, 데이터캐시 안 타는 정적 페이지로 배포완료 먼저 판별하는 프로브 순서. 소스: memory `live-html-grep-and-cache-traps`, 방법론 HANDOFF v3.

### G. agents (5)
- **my-cicd-is-a-bash-loop · "My CI/CD is a 40-line bash loop"** *(플래그십)*: 전문 공개 — 디바운스, 경로 한정 스테이징, .autodeploy-off 일시정지 파일, index.lock 강제삭제의 위험(멀티 에이전트 경합 실사고), 그럼에도 살아남은 이유와 한계(파일별 커밋 churn→빌드 폭주). 소스: `auto-deploy-watch.sh`(전문), memory `autodeploy-watcher-race`. 코드: 스크립트 전문.
- **seventy-agents-one-docs-site · "70 agents wrote 35 docs in 8 minutes — what broke was one backtick"**: author→adversarial-verify 파이프라인 오케스트레이션, 스키마 강제 구조화 출력, **백틱 과잉이스케이프 포스트모템**(문자수 스캔 통과·tsc 실패 → "검증은 진짜 컴파일러로"), 그룹 단위 편집이 문서 간 모순을 잡은 이유. 소스: `HANDOFF-방법론-독스.md` §13. 핫토픽.
- **adversarial-verification · "Prompting the refuter: adversarial verification patterns that survived contact"**: 검증자에게 '반박하라' 지시, 다관점 lens 분산, loop-until-dry, 거짓 완료 알림 실사례와 디스크 3중 대조 습관. 소스: memory `verify-task-notifications-on-disk`, engine-room RUNBOOK.
- **stdlib-newsroom · "An hourly newsroom in pure Python stdlib"**: 프레임워크 0 선택 이유, 폴러→엔티티 매칭→결정론 기계 게이트(소스≥2·링크 실검증·2회 실패 kill), 재부팅 생존(watch.sh). 소스: `hourly/README.md`, `hourly/poller/poller.py`, `hourly/now-playing-watch.sh`, `HANDOFF-now-플레잉.md`. 금지: 감지 임계·프롬프트.
- **append-only-automation · "Automation that never edits: additive-only jobs"**: 월간 계보 갱신(기존 행 수정·삭제 금지, 불확실=스테이징), additive-only가 자율 파이프라인 신뢰의 전제라는 주장. 소스: `SITE_LEDGER.md` §7, `HANDOFF-영화공장.md`(원칙만).

### H. bots-trust (4)
- **bot-sentinel · "Detecting scraper fleets from a first-party beacon (/24 prefixes, fail-open)"**: 비콘이 프리픽스 수집→30분 크론 탐지→미들웨어 403, good-bot 우선 예외, **fail-open 설계**(오탐 시 사이트가 죽지 않게), 클라우드 ASN 통째 차단이 인용봇을 오폭하는 문제. 소스: memory `vercel-waf-bot-block`, `middleware.ts`, `worker/0078_bot_sentinel.sql`. 금지: 정확 임계·UA 정규식.
- **a-crawler-that-introduces-itself · "MetatakeBot: self-identification and the visit-back handshake"**: 정본 UA+/bot 페이지, robots 준수 구현(`lib/bots/handshake.ts`의 robotsAllows), 호스트당 30일 1회 답방 설계와 리퍼러 윤리(제3자 봇에 Referer 미전달). 소스: `lib/bots/identify.ts`, `lib/bots/handshake.ts`, `app/bot/page.tsx`. 코드: robots 파서 발췌.
- **citing-without-storing · "Citing 150 outlets without storing one article body"**: 발행사 자체 공개 필드만(헤드라인·dek·초록), verdict=원문 부분문자열 실검증 코드, 매체당 1인용, OpenAlex/Crossref 폴백 체인. 소스: `magazine research agent/인수인계-HANDOVER.md`, `comment_extractor.py`. 코드: 부분문자열 검증 함수. 금지: 차단 매체 리스트·키.
- **cookieless-analytics · "First-party, cookieless analytics straight into Postgres"**: 비콘→API→mt_events, GA 대비 얻은 것/버린 것, RLS 무정책=service-role 전용 설계. 소스: `HANDOFF-사이트분석-퍼스트파티.md`, `components/Metrics.tsx`, `app/api/metrics/route.ts`.

### I. solo-ops (2)
- **one-human-many-agents · "The operating model: one human, many agents, and HANDOFF files as the interface"**: 세션 간 인수인계 문서 체계(00-INDEX·HANDOFF-*·memory), 에이전트에게 일 시키는 문서의 해부(불변식·함정·검증 체크리스트), 이 지시서 자체가 그 산물이라는 재귀. 소스: `docs/00-INDEX.md`, 임의 HANDOFF 2편.
- **what-it-costs · "What it costs to run (in bands)"**: **결정점 D-a 승인 시에만 작성.** 밴드 단위 공개(채점 런 ~$10대, 팩토리 ~$1/편, 번역 견적 ~$2백대…), 비용을 설계 변수로 다루는 법(effort 다이얼·배치·LLM-0·무료 소스 우선). 소스: 각 HANDOFF의 비용 절.

### J. postmortems (3) — F·G에 산재한 것 외 독립 3편
- **the-null-i-cached · "I cached a null and served 404s for an hour"**: unstable_cache가 일시 오류를 캐시(null-포이즌), 에러는 throw로 캐시 밖으로, 무캐시 재확인 절차. 소스: memory `live-audit-isr-cache-trap`·감독읽는층 HANDOFF 함정.
- **the-loop-that-took-down-postgres · "The per-row RPC loop that took the database down"**: 감독 페이지가 영화마다 cinecodex_card 호출→커넥션 고갈, 벌크 캐시(`lib/takescore-bulk.ts`)로 수술, N+1의 서버리스 변종이라는 교훈. 소스: `HANDOFF-감독읽는층-리셉션-SEO.md`, `lib/takescore-bulk.ts`. 코드: before/after.
- **dev-lied-prod-was-fine · "Turbopack broke, webpack didn't: trusting the right build"**: @import 순서가 dev만 500, 검증 기준을 프로덕션 빌드로 옮긴 결정, dev/prod 괴리 일반론. 소스: memory `theory-index-explorer-redesign` 함정, 이론DB HANDOFF.

---

## 8. 공개 수위 (개발자판 헌장)

**티어 1 — 공개(이 코너의 존재 이유)**: 아키텍처·설계 논리·트레이드오프·실패담, **비밀 아닌 코드 전문**(auto-deploy-watch.sh, fetchAll, IME 가드, robots 파서, 렌더러, CREATE INDEX, before/after 스니펫), 성능 실측치, 공개 SQL 마이그레이션 발췌.

**티어 2 — 서술은 하되 정확값 소유**: 튜닝 상수(시맨틱 floor·counterpoint 임계·kin 계수·플래그 임계·seed) — "두 단계 폴백이 있고 교차언어를 위해 낮췄다" 수준까지. 프롬프트는 **구조와 설계 원칙만**(전문 금지).

**티어 3 — 절대 금지**: 키·토큰·시크릿 전부, Supabase 프로젝트 ref·"kyniq", 내부명 "Cinecodex"/"FilmCurio"/"AVAULT", 개별 감독 등급, 편집자 현직, 프롬프트 전문·anchor gold값, 미공개 취약점이 되는 수준의 봇 게이트 세부(UA 정규식·정확 임계), AI-크롤러 차단 매체 리스트. 커밋 전 grep: `jvgarcqrtsmgfimdcwgo|kyniq|SERVICE_ROLE|ANTHROPIC_API|TMDB_READ_TOKEN|OMDB_API|BRAVE_API|REVALIDATION_SECRET|Cinecodex|FilmCurio|AVAULT|sk-[A-Za-z0-9]`.

**오너 결정점(승인 전엔 보수적 기본값)**:
- **D-a 비용 공개**: 밴드 단위(~$10대/~$1/편) 공개 권고 — 개발자 콘텐츠 가치가 큼. 승인 전엔 상대 표현("한 자릿수 달러/천 편")만.
- **D-b 검색 floor·counterpoint 임계 정확값**: 공개해도 모방 위협 낮음(코퍼스가 해자) — 공개 권고. 승인 전엔 티어 2 서술.
- **D-c 모델명 표기**: 방법론 독스는 비공개 유지 중. 개발자 독스에선 "frontier 모델 + 임베딩 모델" 수준의 일반 명칭까지만(정확 모델 ID는 비공개 유지) — 두 코너 간 모순 방지.

---

## 9. 불변식 (D-1 ~ D-8)

- **D-1** `/methodology`와 모순 금지. 같은 사실은 같은 숫자·같은 원칙(수치 위계: 1,935 read / 6,701 scored / 6,975 catalogue). 원칙 서술은 링크로 위임.
- **D-2** §8 헌장 준수 + 커밋 전 금지어 grep 0.
- **D-3** 모든 무용담은 소스 파일·memory·HANDOFF에서 추적 가능. 극화·과장 금지. 수치는 실측.
- **D-4** 콘텐츠는 `.md`만(`lib/devdocs/content/`). TS에 마크다운 재도입 금지. `next.config.ts` 트레이싱 설정 없이는 라이브 404가 남 — P0 검증 항목.
- **D-5** 렌더러 확장은 하위호환 — 방법론 46문서 렌더 출력이 변하지 않음을 스냅샷 비교로 증명.
- **D-6** 캐시 로더 키는 `devd-load1`부터, 본문 변경 배포 시 범프(방법론 v3 교훈).
- **D-7** 매 기사 "What I'd do differently" 필수, corrections 각주 필수, TechArticle JSON-LD 필수.
- **D-8** 코너 보이스는 1인칭 단수. 단 허브 인트로에 데스크 보이스와의 관계 1줄 명시(§1).

---

## 10. 실행 페이즈

- **P0 — 셸**: §4 전 파일 + 렌더러 확장(+스냅샷 회귀 테스트) + next.config 트레이싱 + 샘플 기사(`the-cache-that-outlived-my-deploy`) 라이브. 검증: 로컬 프로덕션 빌드에서 `/developers/the-cache-that-outlived-my-deploy` 200 + 코드블록 렌더 + **Vercel 배포 후에도 200**(트레이싱 검증).
- **P1 — 플래그십 8**: the-stack · scoring-6701-films · measuring-what-you-cant-promise · half-a-million-sentences-no-llm · my-cicd-is-a-bash-loop · seventy-agents-one-docs-site · hnsw-that-wouldnt-build · the-1000-row-wall.
- **P2 — 나머지 카테고리 순서대로**(각 기사 저술→기사별 검증 에이전트: §8 grep+D-1 모순+수치 실측 대조).
- **P3 — 발견성**: 사이트맵·llms.txt·푸터·methodology 교차링크·IndexNow. RSS는 P3b.
- **P4 — 보류**: ko, OG 이미지, 하이라이터, 외부 크로스포스트(오너).

## 11. 검증 체크리스트

1. tsc + 프로덕션 빌드. 2. 렌더러 스냅샷(방법론 46문서 불변). 3. §8 금지어 grep 0. 4. 기사 내 수치 소스 대조. 5. `/developers/*` 라이브 200 + 코드블록 overflow 스크롤 + JSON-LD 파스. 6. Vercel 프로덕션에서 fs 로딩 확인(트레이싱). 7. `/methodology` 앵커·문서 회귀 없음.

## 12. 결정 로그
- 2026-07-12 — 기획 확정(본 문서). 콘텐츠 .md+fs(백틱 함정 회피가 결정 근거), /developers 라우트, 10카테고리 46기사, 1인칭 빌더 보이스, 오너 결정점 3건(D-a/b/c). 구현·저술 미착수 — 다른 에이전트 수행.
