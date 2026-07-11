# HANDOFF — 방법론 독스 허브 ("The Method Docs") 작업지시서

> **지위**: 이 문서가 방법론 독스 프로젝트의 **단일 정본 작업지시서**다. 다른 AI(구현자)가 이 문서만 받아도 끝까지 임무를 수행할 수 있도록 구조·레이아웃·콘텐츠 인벤토리·공개 수위·페이지 연동·불변식·실행 페이즈를 전부 담는다.
> 작성: 2026-07-12 (기획 에이전트, Explore 4방향 전수 조사 기반). 편집책임: Wonwoo Yoon.
> 샘플 문서(표준 템플릿): `site_content/METHODOLOGY_DOCS_SAMPLE_CONNECTIONS.md` — **모든 문서는 이 샘플의 형식·보이스·공개 수위를 따른다.**
> 등재: `docs/00-INDEX.md` § Design plans.

---

## 0. 구현자 시작 절차 (여기서부터)

1. 이 문서를 끝까지 읽는다.
2. `docs/00-INDEX.md` → `docs/RENAME-atlas-locations-map-network.md`(용어 리네임 필독) → 샘플 문서 순으로 읽는다.
3. 현재 페이즈(§10)의 문서들에 대해, §7 인벤토리에 적힌 **소스 파일을 실제로 읽고** 초안을 쓴다. 소스에 없는 방법론을 지어내지 않는다(불변식 I-4).
4. 라이브 수치는 Supabase MCP **읽기 전용**으로 실측 확인한다(`methodology_stats_json` 등).
5. 구현 후 §11 검증 체크리스트를 통과시킨다.

**절대 하지 말 것(요약 — 상세는 §8·§9):**
- `/methodology` 루트 페이지와 6개 앵커(`#connections` `#rankings` `#locations` `#index` `#now` `#corrections`) 파괴 금지 — 40+ 페이지가 딥링크.
- §8 공개 금지 목록(키·프롬프트·내부명·비용·개별 감독 등급 등) 노출 금지.
- "Cinecodex"(공개명 TakeScore), "FilmCurio", "Atlas"(→Locations), Supabase ref 문자열 사용 금지.
- 성장하는 수치를 하드코딩 박제 금지(RPC 라이브 렌더 또는 "compiled {월 연도}" 스탬프).
- 신규 CSS와 그것을 쓰는 page를 **한 커밋**으로(자동배포 워처 레이스).

---

## 1. 왜 만드는가 (기획 의도)

구성 논리를 공개하는 것이 정보 신뢰(E-E-A-T)의 원천이다. 사람들은 "이 숫자·이 연결·이 선정이 어떻게 나왔나"를 물을 권리가 있고, 우리는 얼버무리는 대신 실제 방법을 답한다 — 현행 `/methodology` 한 페이지가 이미 그 답이지만, 층이 12개를 넘으며 한 페이지의 한계에 도달했다.

**공개 수위 원칙 (S&P/미슐랭 모델)**: "무엇이 들어가고, 어떻게 정규화하고, 무엇을 일부러 배제하는가"는 상세히 공개한다. 프롬프트 원문·원천 데이터·정밀 튜닝 상수는 소유한다. 방법을 자세히 공개해도 그대로 재현하기는 어렵다(코퍼스·검증 루프·편집 판단이 해자) — 그러므로 기본값은 **후한 투명성**이고, §8 목록만 예외다.

**목표 형태**: platform.claude.com/docs 류의 독스 사이트 — 상단 카테고리 바 + 좌측 네비게이션 트리 + 아티클. 챕터별로 문서가 늘어나는 구조.

---

## 2. URL·라우팅 결정 (확정)

| 항목 | 결정 | 근거 |
|---|---|---|
| 허브 | **`/methodology` 유지** | 40+ 인바운드 링크·Nav Theory 드롭다운 등재·브랜드 앵커. `/docs` 신설 기각(API 문서로 오인, 링크 이전 비용). |
| 개별 문서 | **`/methodology/[slug]`** | `app/methodology/`엔 `page.tsx` 하나뿐 — 충돌 없음(프론트 조사 실측). |
| 앵커 6종 | 허브에 **원문 섹션 유지** + 각 섹션 끝에 "Read the full method →" 딥링크 추가 | 링크 파괴 0. 앵커를 리다이렉트로 대체하지 않는다(단순·안전). |
| 구 URL | 없음(신설이므로 리다이렉트 불요) | — |

---

## 3. 정보 구조 (IA) — 상단 카테고리 × 좌측 네비 트리

상단 카테고리 8개(수평 스트립, 모바일 가로 스크롤), 카테고리당 좌측 네비에 1~7문서. **총 37문서**(허브=Overview 포함). 슬러그는 아래가 정본.

```
Start here                    The Films                     The Readings
├─ overview (허브 자체)        ├─ film-selection             ├─ figures
├─ how-a-page-is-made         ├─ tiers                      ├─ frameworks
└─ what-ai-does               ├─ why-a-film-is-in-the-index ├─ strong-misreadings
                              └─ corpus-growth              ├─ tropes
                                                            └─ essays

The Scores                    The Connections               The Record
├─ takescore                  ├─ embedding-map              ├─ locations
├─ takescore-dimensions       ├─ kinship          ★샘플     ├─ reception
├─ what-takescore-ignores     ├─ counterpoints              ├─ credits
├─ reliability                ├─ rankings                   ├─ where-to-watch
├─ lineage                    ├─ network-graph              ├─ where-to-start
├─ lineage-selection          ├─ search                     └─ sources-and-identity
└─ lineage-standing           └─ sentences

The Live Desk                 Trust
└─ now-playing                ├─ editorial-responsibility
                              ├─ corrections
                              ├─ independence
                              └─ ai-disclosure
```

사용자가 명시한 5주제와의 대응: 영화 선정이유=`film-selection`(+`tiers`·`why-a-film-is-in-the-index`), 메타테이크 선정방법=`figures`(+`frameworks`), where to 방법론=`where-to-watch`+`where-to-start`, credit 산출=`credits`, network 계산식=`kinship`+`counterpoints`+`rankings`(+`embedding-map`).

**네비 규칙**: 좌측 네비는 현재 카테고리의 문서 목록(위 순서 고정) + 상단에 카테고리명. 상단 스트립은 8카테고리 전부(현재 카테고리 활성 표시). 허브(Overview)는 8카테고리 카드 그리드 + 전 문서 링크 목록을 겸한다. 문서 하단에 prev/next 페이저(카테고리 내 순서).

---

## 4. 디자인·레이아웃 스펙

**대원칙**: 기존 신문 아이덴티티 그대로 — 라이트 온리(다크모드 없음), PT Serif(display/body) + Inter(ui), 액센트 `#E3120B`, 기존 타이포 관용구(`.shell` `.disp` `.seclbl`+`.tick` `.rule` `.body.reading` `.standfirst` `.ui.muted`) 재사용. 새 시각 언어를 발명하지 않는다.

**셸 구조** (선례 조합 — 프론트 조사 실측):
- 좌측 스티키 사이드바: `app/lineage/for-w-heo/page.tsx`의 패턴(`grid-template-columns: 240px minmax(0,1fr)`, `position:sticky; top:66px`, ≤900px에서 1컬럼 접힘).
- 상단 카테고리 스트립: `app/curious/layout.tsx`의 `.cur-strip` 패턴(수평 스크롤 링크 스트립). 탭은 반드시 실제 `<Link>`(SEO 크롤 가능 — TheoryExplorer `.thx-tabs` 관례).
- 아티클 본문: `.shell` 관용구, 내부 measure 64ch/744px.
- 상단 사이트 Nav: **`SiteNav` 명시 렌더**(현재 /methodology엔 Nav가 없음 — 이번에 추가. 루트 레이아웃에 Nav가 없으므로 섹션 레이아웃이 직접 렌더해야 함).

**신규 파일(전부 워처 자동배포 범위 안):**
```
app/methodology/layout.tsx           # SiteNav + 상단 카테고리 스트립 + 2컬럼 grid + methodology.css import
app/methodology/methodology.css      # .mdocs-* 클래스 (⚠️ 사용 page와 한 커밋)
app/methodology/[slug]/page.tsx      # 문서 렌더러
components/docs/DocsSidebar.tsx      # 좌측 트리(현 카테고리 문서 목록, active 표시)
components/docs/DocsTopTabs.tsx      # 상단 카테고리 스트립
components/docs/DocsPager.tsx        # prev/next
lib/docs/registry.ts                 # IA 정본: 카테고리·문서 메타(slug/title/desc/sources/updated)
lib/docs/md.ts                       # 결정론 마크다운 블록 렌더러 (아래)
lib/docs/content/<slug>.ts           # 문서 본문(마크다운 템플릿 리터럴) — 문서당 1파일
```

**콘텐츠 저장 방식 (확정)**: MDX 파이프라인이 저장소에 전무하고(패키지 미설치), 유일한 장문 렌더 선례는 DB `essays.body_md` + `lib/desks.ts`의 정규식 인라인 변환기다. 독스는 **버전관리되는 코드 자산**이어야 하므로 DB가 아닌 저장소에 둔다 → **`lib/docs/content/*.ts`에 마크다운 문자열로 저장**(워처 자동커밋 범위, import 문제 없음, 라이브러리 추가 0).
`lib/docs/md.ts`는 블록 레벨 지원을 추가한 소형 결정론 렌더러: `##`→`.seclbl`+`.tick`+`<h2 id=…>`, `###`→h3, 문단, `-`/`1.` 리스트, `>` 인용(연속 3줄 "**숫자** / 라벨 / 설명" 패턴은 스탯 타일로), 표, `---`→`.rule`, 인라인은 `lib/desks.ts`의 `mdInline` 재사용. 이스케이프 먼저, 변환 나중(XSS). 외부 라이브러리 도입 금지.

**문서 페이지 구성(위→아래)**: 브레드크럼(Methodology → 카테고리 → 문서) → H1(`.disp` 30px) → standfirst → (해당 시) In-numbers 스탯 타일 → 본문 섹션들 → "What we decided, and why"(권장) → "Limits"(권장) → corrections 각주(고정) → Related docs 2~4개 → prev/next 페이저 → "Updated {월 연도}".

**ISR/캐시**: `generateStaticParams(){return []}` + `unstable_cache(["mdocs-load1", slug], {revalidate:3600})`. 페이로드 구조 변경 시 `mdocs-load2`로 범프(저장소 관례 `film-load7` 선례). 라이브 수치를 쓰는 문서(overview 등)는 RPC 호출 포함.

**SEO**: `generateMetadata` — title `${doc.title} — Methodology · Metatake`, `alternates.canonical: "/methodology/"+slug`, `pageRobots(true)`. JSON-LD = `Article` + `BreadcrumbList`(3단), author/editor = Person(Wonwoo Yoon) 관례(`app/film/[slug]/[desk]/page.tsx` 215~245줄 인라인 패턴 복제). 허브에 `ItemList`(전 문서) 추가.

---

## 5. 사이트맵·발견성

1. **사이트맵**: 신규 자식 `methodology.xml` — 3파일 절차(프론트 조사 실측): ① `lib/sitemap-data.ts`에 `methodologyEntries()`(registry에서 허브+전 문서 열거), ② `app/sitemaps/methodology.xml/route.ts` 신설(core 패턴 복제), ③ `app/sitemap.xml/route.ts`의 `SECTIONS` 배열에 `"methodology"` 추가. **주의: 현재 `/methodology` 자체가 사이트맵 미등록 상태** — 이번에 편입.
2. **IndexNow**: 런칭 후 수동 `node scripts/indexnow-ping.mjs <신규 URL들>`.
3. **`app/llms.txt`**: 방법론 독스 목록 추가(AI 인용 목적에 최적의 콘텐츠).
4. **Nav**: `components/home2/Nav.tsx` Theory 드롭다운의 Methodology 항목은 허브를 가리키므로 무변경.
5. **i18n(보류 웨이브)**: 추후 `/methodology/[slug]/ko` + `alternates.languages`(ko self-canonical) + `content_i18n(entity_type='doc')` 편입. P0~P4에서는 구조만 막지 않으면 됨(라우트 세그먼트 여지).

---

## 6. 문서 작성 스타일 가이드

- **언어**: 영어(사이트 보이스). **골드 스탠다드 = `site_content/METHODOLOGY_LINEAGE_SECTION.md`** — 1인칭 복수, 담백, 정직("checkable, not mysterious"), 마케팅어 0, 한계를 먼저 실토.
- **분량**: 문서당 600~1,400단어.
- **필수 요소**: standfirst 1~2문장 / 방법 서술 / corrections 연결(모든 층이 같은 수정 루프 아래) / Updated 스탬프. **권장**: In-numbers 타일, "What we decided, and why"(비자명한 결정과 이유 — 독스의 차별 자산), "Limits"(정직성).
- **수치 2종 구분**: (a) 성장 수치(readings 수 등) = RPC 라이브 또는 "counts are read live" 문구, (b) 방법 상수(decay 0.6 등) = 본문 명기 가능(§8 티어 판정 후).
- **모든 주장 추적 가능**: 각 문서의 §7 소스 파일에서 근거를 찾을 수 없는 방법 서술은 쓰지 않는다. 소스 간 상충 시 §7의 "정본" 표시가 우선.

---

## 7. 콘텐츠 인벤토리 (문서별 작업 카드)

> 형식 — **slug · 제목(영문)**: 다뤄야 할 내용 / 소스(정본 우선) / 라이브 수치 / 공개 수위·함정.
> 공통 소스(모든 문서): `app/methodology/page.tsx`(현행 공개 산문 = 공개 수위의 기준선), `docs/00-INDEX.md`.

### A. Start here
- **overview · "Methodology"** (허브): 현행 페이지 전문 이식 + 앵커 6종 보존 + 카테고리 카드 그리드 + 각 섹션에 딥링크 추가. 소스: `app/methodology/page.tsx`. 수치: `methodology_stats_json` RPC + `cachedLineageMeta()`. 함정: 앵커 id 6종 절대 보존.
- **how-a-page-is-made · "How a page is made"**: 6단계 파이프라인(breakdown→drafting→anchoring→human review→publication→audit) 상술, 데스크별 검증(콘텐츠/사실 체크 vs 기계 체크 2단 게이트, 재작성 ≤2회 후 kill, "what passed = what you read"). 소스: `app/methodology/page.tsx` 파이프라인 섹션, `RUNBOOK-EngineRoom.md`, `app/engine-room/page.tsx`, `docs/RUNBOOK-new-film-ingestion.md`. 공개: 게이트 존재·kill 규칙·검증일 표기 OK / 금지: 프롬프트 원문·모델 라우팅·비용.
- **what-ai-does · "What AI does and doesn't do"**: "AI drafts and connects; a human judges" 상술 + 임베딩의 역할 + 에디터 단독 결정권. 소스: `app/methodology/page.tsx`, `app/about/page.tsx`, `app/editor/page.tsx`.

### B. The Films (영화 선정이유)
- **film-selection · "How films are chosen"**: 3-필터(① reach 도달성 — Criterion·MUBI·TSPDT·S&S·영화제 중 1곳 이상 큐레이션됨, ② density 비평 밀도 — 학술·비평 문헌 존재, ③ graph cohesion — 기존 코퍼스와 연결) / 유명도가 아니라 권위로 게이트하고 수요는 우선순위만 결정(점수 컷이 마야 데렌·아커만·바르다를 버리는 실수를 하지 않기 위해) / 비서구·비영어권 의도적 포함. 소스: `curation-handover/HANDOVER.md`(정본), `docs/PLAN-curation-integration.md`, `docs/PLAN-tier2-almanac.md`. 공개: 3-필터·authority-gate 원칙·사분면 **개념** OK / 금지: 구체 임계(total_score 32, imdb_votes 25k, authority_weight 0.85), 개별 영화의 내부 라벨(quadrant·should_index), curator_rating·manual_override.
- **tiers · "Close readings and catalog records"**: Tier-1(정밀 독해, visible, ~1,935) vs Tier-2(카탈로그 레코드, ~5,000) / 자동 승격(approved figures ≥3 → 트리거로 편입, 수동 0) / thin-content를 색인하지 않는 정직성. 소스: `docs/PLAN-tier2-almanac.md`, `docs/STATE.md`. 수치: films/visible 카운트는 라이브. 함정: "노출 안 된 영화도 카탈로그엔 있다"를 결핍이 아닌 설계로 서술.
- **why-a-film-is-in-the-index · "Why a film is in the index (to.W)"**: 편지체(To W.H./W. Yoon), 6차원(authority·recognition·entry_path·national·movement·verdict), verdict 5종 사다리(essential=비평 정전 리스트만, award는 essential 자격 없음 / start here / deep cut / popular-not-canon / optional도 숨기지 않음), 저점 정전작 canon 명명 회피 규칙, 규칙 조립(LLM 0, same filings in → same sentence out), TakeScore와 분리(둘은 불일치할 수 있고 페이지는 그걸 허용). 소스: `HANDOFF-투두블유-큐레이션코멘트.md`(정본), `app/methodology/page.tsx` `#index`. 금지: manual_override 케이스(Fahrenheit 9/11), TS<20 영화 명단 지목, auteur 승격 로스터.
- **corpus-growth · "How the corpus grows"**: 계보 완전 열거가 카탈로그 팽창의 원인(리스트는 TMDB 기준 완전 열거 — 로컬 보유 여부는 게이트가 아님 → 앵커 레코드 생성) / 신규 영화 인입 개요(제목→TMDb 정체성→figures→readings→연결 재계산) / 월간 계보 자동 갱신(신규 수상 추가, 기존 행 수정 금지). 소스: `handoff/00_INTERFACE_CONTRACT.md` §5, `docs/RUNBOOK-new-film-ingestion.md`, `SITE_LEDGER.md` §7.

### C. The Readings (메타테이크 선정방법)
- **figures · "What we read: figures"**: figure 정의(오브젝트·제스처·색·침묵·장소·형식 — 분석의 최소 단위, 영화당 6~8개) / 선정 필터 = 빈도가 아니라 **strikingness + semiotic loading**(Thompson: "the mother is not a motif; the cruel stepmother is") — 의미와 활성화된 기대가 코드로 묶일 때만 / gem filter가 후보 대부분을 버림. 소스: `docs/CONCEPT-tropes-and-strong-misreadings.md`(정본), `docs/00-INDEX.md`. 수치: figures 라이브(~18k).
- **frameworks · "The fourteen frameworks"**: 14개 전부 명단·5패밀리(interpretation: Subtext·Ontology·Semiotics·Enigma / form: Production·Location·Context·Reception / mind: Psychoanalysis·Ethics·Politics / parallel: Counterpart·Parallel / title: Title) + 각 1~2문장 설명 + figure당 서로 다른 3개 프레임워크로 작성되는 규칙 + INVITATION(스포일러-프리 리드, reading 아님). 소스: `lib/frameworks.ts`(single source of truth — 명칭·설명 여기서 그대로), `docs/CONCEPT-tropes-and-strong-misreadings.md`.
- **strong-misreadings · "What a strong misreading is"**: 매니페스토(Bloom의 strong misreading 차용 — 정답 복원이 아니라 영화가 지탱할 수 있는 대담한 독해) / "readings stay open" / misreadings 아티클 페이지는 코퍼스 문장의 LLM-0 재조립임(새 생성 0). 소스: `docs/CONCEPT-tropes-and-strong-misreadings.md`, `app/film/[slug]/misreadings/page.tsx`(조립 로직).
- **tropes · "Tropes and the maturity arc"**: trope = 여러 영화에서 재발하며 코드화된 해석 패턴 / 성숙 호 Noble(1)→Fresh(2–3)→Emerging(4–8)→Established(9–25)→Cliché(>25) = recurrence+cohesion / 클러스터링은 임베딩이 후보 제안, 최종 판정·명명(≤8단어)은 critic 단계 / maturity 배지는 순수 멤버 카운트 티어. 소스: `docs/CONCEPT-tropes-and-strong-misreadings.md`, `docs/PLAN-trope-reformation.md`. 수치: tropes 라이브(~4.7k).
- **essays · "The desks"**: 8데스크 명단(Apocrypha·Decoder·Debates·Contested·Reception·Juxtaposition·Field Test·Accursed Share) / Assignment Desk가 영화가 지탱하는 에세이만 커미셔닝(할당량 없음, 0~3코너) / 독립 verifier의 공격→재작성≤2→kill(약 1/5이 첫 검증 실패) / 통과 후 산문 무편집 / 명판에 엔진명·검증일. 소스: `RUNBOOK-EngineRoom.md`, `app/engine-room/page.tsx`, `lib/desks.ts`. 금지: 프롬프트·모델 배정·비용.

### D. The Scores
- **takescore · "TakeScore: the three axes"**: 인기 지표가 아니라 시네필의 지속 가치 측정 / V(획득가치)·C(진입비용 — 비용이지 결함 아님)·R(위험) / **TS = round(V − λ·R)**, λ=위험회피 다이얼(기본 1.0) / S 효율 지수 / 채점 철칙 중 공개분: 난이도는 비용이지 미덕 아님(hard-but-empty=저V·고C), 야망≠성취, 외부 지표 무시, 영화 간 상대비교 없이 독립 채점. 소스: `docs/PLAN-cinecodex-integration.md`, `score/Cinecodex_HANDOFF.md` §10, `app/takescore/about`(현행 공개면). 함정: **"Cinecodex" 명칭 절대 금지**(공개명 TakeScore/TS만).
- **takescore-dimensions · "The thirteen dimensions"**: VALUE 5(COG·AFF·FORM·MORAL·DUR)/COST 4(ITX·FR·ETX·CTX)/RISK 4(BANK·INSINCERE·COWARD·POLAR) 각 1~2문장 + 밴드 구조(0/25/50/75/100 행동 기술 앵커) + 축 공식 공개 수위: V=5평균, C=4평균, R=가중(주 3항+분열성) 수준(정확 계수 0.6/0.4는 소유). 소스: `score/Cinecodex_HANDOFF.md`, `score/cinecodex_schema.sql` 주석, `/takescore/{dim}` 랜딩 13종. 금지: 프롬프트 전문·reference anchor 영화명과 gold 수치.
- **what-takescore-ignores · "What TakeScore ignores"**: never-blend — IMDb/RT/Metascore는 **나란히 표시하되 절대 입력 아님**(다른 구성개념·이중계산·판별타당도), 정전가도 입력이 아니라 검증 기준(순환성 회피) / "괴리가 곧 상품"(고TS·저IMDb=숨은 보석) / OECD 합성지표 논거 인용 가능. 소스: `score/Cinecodex_Conclusions_Display_and_Reliability.md`(정본), `docs/WORKORDER-cinecodex-scoring.md`.
- **reliability · "Reliability and confidence"**: 상용 LLM은 비트 결정론 불가 → "결정론" 주장 대신 **측정된 신뢰도** 공개(동일모델 반복 ICC≈0.99, 패널 합치 α≈0.96 수준의 서술 OK) / 플래그→N=3 재채점→감사 패널→드리프트 게이트(컨트롤셋, 초과 시 파이프라인 정지)의 존재 / confidence 3티어(High/Moderate/Limited)와 "grounded in N critical takes" — 코퍼스 근거 있는 영화만 High. 소스: `score/Cinecodex_RUNBOOK.md`, `Cinecodex_Conclusions_Display_and_Reliability.md`, `docs/PLAN-me-takescore.md`(confidence 공식 — 구성요소명 공개 OK, 계수 0.62/0.20/0.18 소유). 금지: 플래그 임계 수치, 드리프트 tolerance 수치, 비용.
- **lineage · "The lineage record"**: 기존 `METHODOLOGY_LINEAGE_SECTION.md` §1 산문을 사실상 그대로 이식(완전 열거·TMDb 해소·"N of M"·hidden 보류·검증 게이트). 소스: `site_content/METHODOLOGY_LINEAGE_SECTION.md`(완성 원고), `SITE_LEDGER.md`. 수치: `cachedLineageMeta()`.
- **lineage-selection · "How a list earns its place"**: 3-bar(권위 검증가능 / 완전성·검증가능성 / 커버리지 가치 — 비서구 정전 의도 포함) + 의도적 제외(팬투표·블랙박스 집계·후보 슬레이트·저변별 대형 컬렉션, 단 투명 메타폴 TSPDT는 포함). 소스: `METHODOLOGY_LINEAGE_SECTION.md` §"How a lineage earns its place", `SITE_LEDGER.md` §1b, `handoff/03_registry_spec.md`.
- **lineage-standing · "Weights and decay"**: **이미 공개된 수치 그대로 사용** — T1 .90–1.00/T2 .70–.88/T3 .50–.68/T4 .30–.45, win×1.0·nomination×0.45·listing×0.45·selection×0.30, 랭크 커브 1.0→~0.5, 감독 신호 0.92→0.40(개별 감독 매핑은 절대 비공개), 기하 감쇠 ~0.6/step / Prestige·Discovery·Similarity 3분리(사조·스타일은 총점 제외 — 범주오류) / components 분해 노출("never a black box"). 소스: `METHODOLOGY_LINEAGE_SECTION.md`(공개 수위 기준), `handoff/07_scoring_model.md`(배경). 금지: 정규화 상수 C(2.42)·γ(0.15)·감독 댐핑 0.6·selectivity 산식, **개별 감독의 G-등급**(평판 리스크 — 가장 명시적 금지).

### E. The Connections (network 계산식)
- **embedding-map · "The embedding map"**: 현행 섹션 상술 — 모든 reading·figure·trope가 의미공간의 점, 연결은 태그가 아니라 거리 / 무엇이 임베딩되는가(readings·tropes·영화 취향 벡터·감독·이론 정전·분류 노드 — 7축, 종류 명명 OK) / 콘텐츠 기반 지도, 성장형. 소스: `app/methodology/page.tsx`, `HANDOFF-검색엔진-통합.md`. 금지: 모델명·차원수(현행 산문도 미공개 — 이 추상화 수준 유지)·임계값.
- **kinship · "Kinship" ★샘플 완성** — `site_content/METHODOLOGY_DOCS_SAMPLE_CONNECTIONS.md` 참조. 두 신호 융합(공유 트롭, 희귀할수록 가중 + 취향 코사인), 필름당 상위 ~두 다스, 근거(공유 트롭) 항상 표시, kin 지수 0~100(코사인+공유 트롭 가중+공유물의 희귀도 결합 — 성분명 공개, 계수 40/25/35 소유), 결정론·재계산. 소스: `docs/PLAN-connections-overhaul.md`, `HANDOFF-연결엔진-커넥션.md`, `HANDOFF-임베딩판타지아-문장층.md`(kin), `sentence-engine/MASS-PRODUCTION.md`.
- **counterpoints · "Counterpoints"**: 같은 트롭·반대 독해 — 트롭별 독해 벡터가 가장 멀 때(“분기율 N%” = 의미 거리) / 유사도 엔진은 닮은꼴만 찾고 우리는 논쟁을 찾는다 / 양쪽 take를 나란히 표시해 검증 가능. 소스: `docs/PLAN-connections-overhaul.md`(sim≤0.45·(1−sim)·idf — 임계·산식은 소유, "가장 먼 쌍" 서술까지 공개), `app/methodology/page.tsx`.
- **rankings · "The numbers on ranked lists"**: 현행 `#rankings` 산문 이식·상술 — match %=코사인, #1은 가장 유명이 아니라 가장 순수하게 그 트롭에 관한 독해, kin %, Confidence(분류 확신), Coherence(뭉침), maturity=멤버 카운트 티어, 전부 렌더 시점 재계산·손튜닝 0·동결 0. 소스: `app/methodology/page.tsx` `#rankings`(사용자 대면 약속문 — **% 로직 변경 시 이 문서도 동시 수정**), `HANDOFF-트로프피겨아키타입-순위표면.md`. 금지: 내부 임베딩 축 진단(표면축/의미축), RPC 시그니처.
- **network-graph · "Reading the Network graph"**: /network의 4뷰(Films 에고·Directors·Grouped·Galaxy), 엣지 종류 의미(watch-next 화살표/친족 — 굵기=kin/counterpoint), Galaxy는 의미공간의 2D 투영 + 클러스터 라벨은 데이터에서 명명 / 라벨은 "Connections". 소스: `components/NetworkExplorer.tsx`, `components/EntityGraph.tsx`, `docs/PLAN-connections-overhaul.md`. 금지: t-SNE seed·하이퍼파라미터.
- **search · "How search works"**: 텍스트+의미 이중 엔진 융합(RRF 개념 명명 OK), 12종 엔티티, 교차언어(한국어 질의→영어 비평문), 원제 별칭. 소스: `HANDOFF-검색엔진-통합.md`. 금지: 임계값 3종·모델 ID·레이트리밋.
- **sentences · "The sentence layer"**: 46만+ 문장이 전부 SQL 조립(LLM 0·random 0), 13패턴 주제 8종(Kinships·Readings·Twin Lenses·Tropes & Frames·The Record·Filmography·Locations·Questions), 모든 값이 실데이터 FK, **브랜드 계약 그대로 인용**("a data fantasia by Wonwoo Yoon" + Not-AI 디스클레이머 — 제거 금지). 소스: `HANDOFF-임베딩판타지아-문장층.md`(정본), `sentence-engine/MASS-PRODUCTION.md`. 금지: salience 공식·SQL 템플릿.

### F. The Record
- **locations · "Locations: setting and filmed"**: 두 지리 절대 분리(setting=이야기의 장소/filmed=촬영지, 지도가 어느 쪽인지 말해줌) / 2패스 수집+융합 / precision 라벨(exact→approx, 자신 없으면 핀 없음 — accuracy over coverage) / confidence(filmed: 독립 2소스=verified) / 재구성 서술 원칙(축어·이미지 복제 0). 소스: `docs/PLAN-geographic-atlas.md`, `docs/WORKORDER-geo-extractor.md`·`geo-filmed-layer.md`(⚠️ 이 두 문서엔 인프라 키 지침 노출 — 발췌 인용 금지), `app/methodology/page.tsx` `#locations`. 수치: locations 라이브.
- **reception · "Reception and the afterlife"**: 4개 dated 소스(비평 헤드라인·개봉 이벤트·Wikidata 수상·계보 에디션) / 저작권 안전 사다리 — 본문 절대 미수집, 발행사가 스스로 공개한 필드(헤드라인·dek·초록)만, verdict는 ≤10-15단어 축어이며 원문 부분문자열 검증, 매체당 인용 1개, 모든 항목이 출처로 아웃링크, robots 존중 / 학술은 OpenAlex/Crossref. 소스: `magazine research agent/인수인계-HANDOVER.md`(정본), `HANDOFF-감독읽는층-리셉션-SEO.md`, `app/film/[slug]/reception/page.tsx`. 금지: API 키, AI 크롤러 차단 매체 리스트, 제휴 연락처.
- **credits · "Credits and collaborations"** (credit 산출 방법): 데이터는 TMDB(전 화면 고지) + Wikidata(수상) / 품질 랭킹은 popularity가 아니라 **베이지안 가중 평점 WR=(v·R+m·C)/(v+m)** — 표수가 적은 작품이 평균으로 수축(공식 형태는 교과서 표준이라 공개, m 클램프·버킷 임계는 소유) / 역할 매핑은 부서 게이트 정확 매칭 / troupe(≥2편)·reunion(5년+ 재결합) 개념 / 수상 없으면 "등록된 수상 정보 없음" 정직 표기 / 언어화는 결정론 규칙(자기완결 문장·전원 실명·평가어 0·부재="미상"). 소스: `credit DB/인수인계_영화크레딧탐색.md`, `app/credits/credits-logic.ts`(WR·troupe 정본), `credits-verbalization-spec.md`, 예시 `andrea-arnold-credits-verbalized.md`. 금지: TMDB 토큰, 상업 라이선스 미체결 상태.
- **where-to-watch · "Where to watch: sources and freshness"**: 가용성 매트릭스=TMDB/JustWatch(국가×flatrate/ads/free/rent/buy) + MetaTake 검증층(합법 무료 아카이브·MUBI 국가별·Criterion 디스크·rotation 경보) / 전 문장 저장 데이터 조립(LLM 0) / 신선도 스탬프 "Availability via TMDB/JustWatch, updated {date}" / 시청국 선택. 소스: `app/whereto/[slug]/page.tsx`(buildReport), `HANDOFF-테이크스코어-스크리너.md`(provider 인덱스), `lib/access_enrichment.json`(구조만).
- **where-to-start · "Where to start, who's next"**: 감독 입문·다음 감독 추천은 **큐레이션이지 알고리즘이 아님** — 픽마다 사람이 쓴 구체적 이유("a similarity score가 아니라 the exact reason"), 양방향 참조("Pointed to from"), 적격 게이트(픽 ≥3인 감독만 색인) — 오히려 셀링 포인트로 서술. 소스: `HANDOFF-감독읽는층-리셉션-SEO.md`, `app/director/[slug]/start/page.tsx`·`next/page.tsx`.
- **sources-and-identity · "Sources and identity"**: TMDb 정체성이 사이트의 척추(모든 층이 같은 영화를 가리킴, 확신 없으면 hold) / 무엇이 외부(TMDB 미디어·메타, OMDb 지표, Wikidata 수상, 비평 링크)이고 무엇이 원본(readings·figures·tropes·연결·TakeScore·to.W·계보 구조·핀)인가 / attribution 정책(스틸·포스터 TMDB 명기). 소스: `lib/tmdb.ts`(개념), `app/methodology/page.tsx` Sources 섹션, 리딩엔진 조사 토픽 7.

### G. The Live Desk
- **now-playing · "The live desk"**: 현행 `#now` 산문 이식+상술 — 스파이크 감지(공개 신호원 수준: 검색 트렌드+아울렛 RSS)→코퍼스 임베딩 매칭(보유 영화로 resolve 안 되면 레터 없음)→**retrieval, not remembered**(인용 전부 DB 라이브)→기계 게이트(소스 ≥2·링크 실검증 등 존재 명시)→에디터 사실 검토 / 분당 타임스탬프(작성·발행) / verdict words(랭크는 top-1000만) / wound-no-one 원칙 / 조용한 날도 다이제스트 결번 없음. 소스: `HANDOFF-now-플레잉.md`(공개 관련부만), `app/methodology/page.tsx` `#now`. 금지: 감지 임계·일일 캡 로직·프롬프트·비용·배포 채널 전략.

### H. Trust
- **editorial-responsibility · "Editorial responsibility"**: 에디터 신원(Wonwoo Yoon, 필명 공개 방침 — Ph.D. 경영학, 드러커 시리즈 "lead author", 교수 직함 금지)·sign-off("if a reading is live, a human has taken responsibility")·JSON-LD author/editor 관례. 소스: `app/editor/page.tsx`, `app/about/page.tsx`.
- **corrections · "Corrections"**: 현행 섹션 이식 — facts get corrected, readings stay open / 이메일 절차 / 전 층이 같은 루프. 소스: `app/methodology/page.tsx` `#corrections`.
- **independence · "Independence"**: "No reading is sponsored, and no one can pay to place, remove, or change one" / 외부 지표와의 분리(never-blend 요약 링크) / 광고·협찬 부재. 소스: `app/about/page.tsx`.
- **ai-disclosure · "AI disclosure"**: 무엇이 AI 초안(readings·essays)이고 무엇이 규칙 조립(to.W·문장층·misreadings 아티클·where-to)이며 무엇이 사람 큐레이션(where-to-start)인지 층별 표 — 사이트 전체에서 유일하게 이걸 한 눈에 주는 문서. 소스: 전 층 조사 종합(본 HANDOFF §7 각 카드의 LLM-0/AI 표기).

---

## 8. 공개 수위 헌장 (3티어)

**티어 1 — 공개(자산)**: 개념 모델(film→figure→take, 14 프레임워크 명단, V/C/R, 3-bar, 3-필터, never-blend, setting/filmed 분리, 저작권 사다리, retrieval-not-memory), **이미 공개된 수치**(T1–T4 밴드, result 배수 ×1.0/.45/.45/.30, 랭크 커브 1.0→0.5, 감독 밴드 0.92→0.40, 감쇠 ~0.6/step, verdict 5종, TS=V−λR), 라이브 카운트(RPC), 에디터 실명·서명, 출처 정책, 한계 실토.

**티어 2 — 요약 공개(성분은 명명, 계수는 소유)**: kin 지수 성분(코사인+트롭+희귀도, 계수 40/25/35 비공개), 융합(두 신호 RRF, 가중 비공개), counterpoint("의미가 가장 먼 쌍", 임계 0.45 비공개), R 축("주 위험 3항 + 분열성 가중", 0.6/0.4 비공개), confidence(근거 깊이+주목도+표본, 계수 비공개), WR(공식 형태 공개, m 클램프·버킷 임계 비공개), 시맨틱 검색(이중 엔진·교차언어 공개, 임계 3종·모델 ID 비공개).

**티어 3 — 절대 금지**: API 키·토큰·시크릿 일체(`ANTHROPIC_API_KEY`·`TMDB_READ_TOKEN`·`OMDB_API_KEY`·`SUPABASE_SERVICE_ROLE_KEY`·Brave·Bluesky·`REVALIDATION_SECRET`), Supabase 프로젝트 ref·"kyniq", **프롬프트 원문 전부**(+SHA, reference anchor 영화·gold 수치, 520 anchor bank), **비용·예산 일체**, 모델 ID·라우팅(임베딩 모델명·차원 포함 — 현행 산문 추상화 유지), **내부명 "Cinecodex"·"FilmCurio"·"AVAULT"**, **개별 감독 G-등급 매핑**, manual_override 케이스·curator_rating, 구체 게이팅 임계(total_score 32·imdb_votes 25k·aw 0.85·TS<20·플래그/드리프트 수치·시맨틱 floor·베타 임계), retired takes(46,503)·미채점 274편 등 내부 상태, 스테이징 테이블·재건 RPC·워커 경로·RPC 시그니처, 리걸 방어 세부(보호 DB 블록리스트·quarantine 로직 상세·AI 크롤러 차단 매체 리스트), TMDB 상업 라이선스 미체결 상태, t-SNE seed·하이퍼파라미터.

**판정 절차**: 새 상수를 공개하고 싶으면 — 이미 `/methodology`·`/takescore/about`에 공개된 것인가? 아니오면 티어 2로 낮추고, 원우가 명시 승인할 때만 티어 1 승격.

---

## 9. 불변식 (I-1 ~ I-12)

- **I-1** `/methodology` 루트 + 앵커 6종(`#connections` `#rankings` `#locations` `#index` `#now` `#corrections`) 영구 보존. `Provenance.tsx`·`home2/Nav.tsx`가 공유 진입점.
- **I-2** §8 헌장 위반 0. 커밋 전 금지어 grep: `Cinecodex|FilmCurio|AVAULT|jvgarcqrtsmgfimdcwgo|kyniq|text-embedding|SERVICE_ROLE|sk-|API_KEY` (lib/docs·app/methodology 대상).
- **I-3** 성장 수치 하드코딩 금지 — RPC 라이브 렌더 또는 "compiled {월 연도}"/"counts are read live" 스탬프.
- **I-4** 모든 방법 서술은 §7 소스에서 추적 가능해야 함. 소스에 없으면 쓰지 않는다(추측·미화 금지).
- **I-5** 용어: TakeScore™(엔진 내부명 금지), Locations(구 Atlas), 라우트 /network·라벨 "Connections", 1명사=1실체(용어 헌장).
- **I-6** 신규 CSS + 사용 page 한 커밋(워처 파일별 커밋 레이스). 루트·site_content 파일은 수동 커밋임을 기억.
- **I-7** 검증은 `tsc` + **프로덕션 빌드**(turbopack dev의 globals.css @import 오탐) + 라이브 확인은 캐시버스터 쿼리로.
- **I-8** 최종 콘텐츠는 `lib/docs/`(워처 범위)에만. site_content·루트 md는 기획 산출물 보관용.
- **I-9** JSON-LD Article+BreadcrumbList, author/editor=Person(Wonwoo Yoon), rationale류 내부 텍스트 JSON-LD 미포함 관례 유지.
- **I-10** 모든 문서 하단에 corrections 연결(같은 수정 루프) + Updated 스탬프.
- **I-11** `#rankings`·`#connections`가 약속한 정의와 실제 % 로직은 동기 — 로직 변경 시 문서 동시 수정.
- **I-12** 문장층 브랜드 계약(설계자 명기 + Not-AI 디스클레이머) 인용 시 원문 그대로 — 제거·완화 금지.

---

## 10. 실행 페이즈

- **P0 — 셸 + 이식 (1세션)**: layout·css·registry·md렌더러·[slug] 렌더러·사이드바/탭/페이저 구현 → 허브를 레이아웃에 편입(앵커 보존 검증) → 샘플(`kinship`)을 `lib/docs/content/kinship.ts`로 이식해 첫 문서 라이브. 완료 기준: §11 전 항목 + 앵커 6종 라이브 확인.
- **P1 — 사용자 명명 코어 10문서**: `film-selection` `tiers` `why-a-film-is-in-the-index` `figures` `frameworks` `credits` `where-to-watch` `where-to-start` `counterpoints` `rankings`.
- **P2 — Scores 7 + Trust 4**: takescore 계열 4 + lineage 계열 3(기존 원고 이식 위주) + Trust 4.
- **P3 — 잔여 12**: Start here 2, corpus-growth, strong-misreadings·tropes·essays, embedding-map·network-graph·search·sentences, locations·reception·sources-and-identity, now-playing.
- **P4 — 연동 스윕 + 발견성**: §12 연동 맵 시공, sitemap 3파일, llms.txt, IndexNow 핑, 허브 카드 그리드 완성.
- **P5 — /ko 웨이브 (보류)**: i18n 마스터 핸드오프 절차로 별도 세션.

각 페이즈 종료 시 이 문서 하단 "결정 로그"에 1줄 기록 + `docs/00-INDEX.md` 상태 갱신.

---

## 11. 검증 체크리스트 (페이즈 공통)

1. `tsc` 무오류 · 프로덕션 빌드 성공(dev-only 오탐 무시 조건은 I-7).
2. 앵커 6종: 라이브 `/methodology#<anchor>` 각각 스크롤 착지 확인(캐시버스터).
3. 금지어 grep(I-2) 0건.
4. 신규 문서: 메타(title/canonical/robots)·JSON-LD 파스·브레드크럼·페이저·모바일(사이드바 접힘) 확인.
5. 본문 수치 전수: 소스 문서 또는 라이브 RPC와 대조(불일치는 라이브가 정답).
6. 링크: 문서 내 내부 링크 전부 200(React 주석 노드가 텍스트를 쪼개므로 라이브 grep 검증은 DOM 기준 — `live-html-grep-and-cache-traps` 함정).

---

## 12. 페이지 연동 맵 (방법론이 각 표면에 들어가는 방식)

**노출 3수위(표준)**:
- **(a) 모듈 각주** — 숫자/랭킹 바로 아래 한 줄, `.ui muted 12px`: "How this number is made →". 숫자가 있는 곳엔 반드시 각주.
- **(b) 페이지 푸터 "How we work"** — 감독 서브페이지 현행 관례 유지, 대상 문서로 딥링크 승격.
- **(c) 인라인 본문 링크** — 산문 서술 중 자연 언급(현행 방식).

| 표면 | 현재 | 조치(P4) | 대상 문서 |
|---|---|---|---|
| trope/catalog/figure의 % 배지 | `#rankings` (9곳) | 유지(앵커 불변) + 신규 배지엔 `/methodology/rankings` | rankings |
| film 페이지 connections·movies-like | `#connections` (3곳) | 유지 + 카드 각주(a) 추가 | kinship·counterpoints |
| TakeScore 표면(/takescore·film TS 모듈) | `/takescore/about` | about은 유지, "Full methodology →" 상호 링크 | takescore 계열 4 |
| to.W 카드(TowCard) | `#index` | 카드 하단 각주(a) → why-a-film-is-in-the-index | why-a-film-is-in-the-index |
| whereto/[slug] 푸터 | `/methodology` | (b) → where-to-watch | where-to-watch |
| director start/next 푸터 | `/methodology` | (b) → where-to-start | where-to-start |
| credits 익스플로러·인물 페이지 | 없음 | WR 정렬 셀렉터 옆 각주(a) "Ranked by weighted rating, not popularity →" | credits |
| reception 페이지 푸터 | `/methodology` | (b) → reception | reception |
| locations 표면 4곳 | `#locations` | 유지 + (b) 딥링크 | locations |
| lineage 표면(film/lineage·/lineage) | `/methodology` | (b) → lineage·lineage-standing; % 옆 각주(a) | lineage 계열 3 |
| /now·wire 푸터 | `#now` | 유지 + (b) → now-playing | now-playing |
| 문장층 모듈(판타지아 킥커) | Not-AI 디스클레이머 | 디스클레이머 문구에 → sentences 링크(계약 문구 자체는 불변) | sentences |
| /search 푸터 | 없음 | (a) "How search works →" | search |
| misreadings 아티클 바이라인 | `/editor` | 바이라인 옆 (a) → strong-misreadings | strong-misreadings |
| Provenance.tsx (전역 공유) | `/methodology` | **무변경**(허브 진입 유지) | overview |
| Nav Theory 드롭다운 | `/methodology` | 무변경 | overview |
| Footer(전역) | 확인 필요 | Methodology 링크 없으면 추가 검토(원우 컨펌) | overview |
| /about·/editor·/engine-room·/contact | `/methodology` | 무변경(허브가 개요 역할) | overview |

원칙: **기존 링크는 깨지 않고 유지**, 새 딥링크는 추가로만. 앵커→딥링크 대체는 하지 않는다.

---

## 13. 결정 로그

- 2026-07-12 — 기획 확정: 허브 유지+`/methodology/[slug]`, 콘텐츠는 `lib/docs/content/*.ts` 마크다운-in-TS, 커스텀 결정론 렌더러(라이브러리 0), 8카테고리 37문서, 공개 수위 3티어 헌장, 샘플 1편(kinship) 완성. (본 문서 + 샘플 작성. 구현은 미착수.)
- 2026-07-12 — **P0~P4 구현 완료(SHIPPED, 배포 대기)**. 셸: `app/methodology/layout.tsx`·`methodology.css`·`[slug]/page.tsx`, `lib/docs/{registry,md,content/*}.ts`, `components/docs/{DocsSidebar,DocsTopTabs,DocsPager}.tsx`. 허브 `page.tsx`에 카드그리드 + 앵커 6종 보존한 채 딥링크 6개 추가. 문서 37편 전부 저술(kinship=수작업, 나머지 36편=워크플로 author→adversarial verify 70 에이전트, 0 에러). 사이트맵 `methodology.xml` 자식 3파일 배선, `llms.txt` 레지스트리 연동 재작성. **검증**: 전 파일 tsc 클린, 렌더러 유닛테스트(kinship 14/14) + 전 36문서 컴파일+렌더 스모크테스트 통과(avg 878단어·타일26·표17·토큰누출0·`<script>`0·표/인용 균형), 금지어 grep 0, escaped-backtick 버그 1건(credits.ts) 발견·수정. 함정 기록: **워크플로 author 에이전트가 닫는 백틱을 `\`;`로 과잉이스케이프 → 문자수 스캔(==2)은 통과하나 template literal 미종료(TS1160). 향후 content 저술 검증은 반드시 실제 tsc 컴파일로(문자수 아님).** 미배포: `.autodeploy-off`로 워처 정지 상태 — 원우 배포 판단 대기. P5(/ko)는 별도 세션.
