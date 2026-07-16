# HANDOFF — 영화 세부페이지 실질성 보강 작업지시서 (정본)

> **작성 2026-07-16 · 수행자: 다른 AI · base commit `56759a6` (origin/main)**
> 아래 모든 file:line 앵커는 `56759a6` 기준 실측이다. 커밋과 실행 사이에 줄 번호가 밀리므로, **각 항목 착수 시 반드시 이 문서에 인용된 `current:` 코드 조각을 대상 파일에서 다시 grep해 대조한 뒤** 수정하라. 줄 번호가 아니라 문자열/속성으로 찾아라.
> **선행 문서(정본): `HANDOFF-Tier2-메인통합.md`(C1–C5, ✅ SHIPPED 2026-07-15 commit `5e8f507`) / `HANDOFF-SEO-스타터가이드-작업지시서.md`(✅ SHIPPED 2026-07-15).** 본 지시서는 그 위에 얹히며, Editor's digest가 이미 확립한 "결정론 문장 조립(LLM-0)" 기법을 나머지 섹션 리드로 확장하는 것이 전부다. 색인/robots/사이트맵은 불변.

---

## §0 배경·오너 결정 (확정 — 재논의 금지)

### 0.1 핵심 진단
대표 페이지 `https://metatake.net/film/the-novelist-s-film-2022`(Tier-2)를 포함해 정독 완료작 대부분(Tier-1)에서, **데이터는 이미 로더에 적재돼 있으나 각 섹션의 리드 문구가 전 영화 공통 보일러플레이트**라서 "기계가 찍어낸 페이지" 인상을 준다. 다이제스트("The Metatake record on {title}", `app/film/[slug]/page.tsx:971–1031`)는 이미 영화별 고유 문장을 결정론으로 조립한다 → **그 기법을 나머지 섹션 리드로 확장**하는 것이 본 작업의 핵심이다. 신규 LLM 스테이지 0, 신규 페치 0(#11·#12 예외는 아래 명시), 색인 기계 불변.

### 0.2 공통 원칙 (A/B/C — 전 항목 구속)
- **(A) 답 먼저·링크는 나중.** 링크(더 보기/풀가이드) 섹션은, 클릭해서 얻을 정보의 요약을 그 자리에서 먼저 문장으로 제시한 뒤 링크를 맨 끝에 둔다. (예: #13 where-to-watch, #9 sources.)
- **(B) 보일러플레이트는 페이지당 1회.** 공통 정의/면책/법정문구는 하단 provenance 한 곳으로 모으고, 각 섹션 리드에는 그 영화의 실데이터를 최소 1개 박는다. (예: #5 정의→접기, #7 confidence→methodology, #10 fantasia 면책 1줄, #14 TMDB attribution 2곳.)
- **(C) 자기부정 금지 (07-14 정책 승계).** `pending` / `still` / `no corpus yet` / `no awards recorded` / `No streaming data yet` 류의 첫 화면 문구를 금지한다. **데이터가 없으면 섹션을 렌더하지 않는다(gate on presence). 절대 자기부정 문장으로 렌더하지 않는다.** 이는 공장의 정직성 원칙("37%는 실제 수상 없음 — 못 만드는 한계")과 정합한다: 빈 신호 = 섹션 부재이지 결함이 아니다.

### 0.3 14개 항목 착수 전 상태 분류 (overlap 리서치 근거 — 재작업 방지)
셋 중 하나로 분류된다. **`done`을 다시 만들지 말고, `extend`는 이미 로드된 데이터의 렌더만 바꾸며, `new`만 신규 조립이다.**

| # | 항목 | 상태 | 근거 (다시 만들지 말 것 / 확장 포인트) |
|---|------|------|------|
| 1 | df-catnote "still pending" 삭제 | **new** | `page.tsx:957`에 verbatim 잔존. 07-14 SEO §2.4-f가 교체 지시했으나 미집행. 원칙 C 위반의 구체물. |
| 2 | 히어로 "Follow the credits →"/"Gallery →" 삭제 | **new** | `page.tsx:949–950` 잔존, mTabs Credits(:857)/Gallery(:861)와 중복. Tier-1 히어로엔 없음 → Tier-2 전용. |
| 3 | TMDB 줄거리(df-synopsis) 리드 강등 | **extend** | 답먼저 BLUF dek(`filmLead`, :922–924)는 이미 SHIP됨. 그러나 raw overview가 아직 히어로 밑 리드 `<p>`로 렌더(:867 정의, :962 mount). 리드에서 제거·다이제스트 접이식 강등만. |
| 4 | Tier-2 탭바 2단 구분선/레일 라벨 | **new** | mTabs(:848–862)에 `zone` 없음. Tier-1 탭(:1219+)은 `zone:'free'/'spoiler'` 보유 → FilmTabBar가 선+라벨을 그림. Tier-2 전용. |
| 5 | TakeScore 3문장 정의 → 영화별 한 줄 | **new** | `CinecodexPanel.tsx:256–260` 공통 정의 보일러플레이트. 13차원(`data.sub`)은 로드돼 있으나 최고 Value vs 최고 Risk 한 줄 미조립. |
| 6 | "47 TakeScore"/"three central scores" 제목 미표기 | **extend** | `CinecodexPanel.tsx:306`("Where {title} ranks")·:327·`verdictShort`(:287)는 이미 영화별. 남은 것: gauge 헤더(:267) 일반, Value/Cost/Risk 카드(:288–296)가 label+숫자만 → 완전한 문장. |
| 7 | "sonnet-n1" 모델명 표면 누수 | **new** | `CinecodexPanel.tsx:362` `{data.panel}` 런타임 보간이 내부 패널/모델명 노출. 문자열 리터럴 아님. Confidence절(:364–366)은 정책상 유지. |
| 8 | Lineage 리드 일반문 → 영화별 조립 | **extend** | `FilmLineageSection.tsx:109` 일반문. lin-stats(:112–119)·다이제스트가 이미 영화별 계보 문장 조립 → 섹션 리드만 미조립. |
| 9 | Lineage 출처 각주 → 구조화 "Sources for this record" 박스 | **new** | 현재 인라인 `SourceTag`(:77)+산문 각주(:202). Origin/Awards/Canon 그룹·건수·"Record updated" 박스 없음. `recordUpdated`는 로드됨(Tier-2 loader :265). |
| 10 | Embedding Fantasia 면책 2회 → 1줄 압축 | **new (⚠️정책 충돌)** | `FilmSentences.tsx:97–101`(상단)+`:139`(하단) 이중 면책. `EntityFantasia.tsx:100/141`도 동일 패턴. **컴포넌트 doc-comment(:8–11)가 "keep it" 불변식 선언 → 오너 확인 필요.** |
| 11 | Locations 리드 일반문 → 지명 박기 | **extend** | `page.tsx:1052`(Tier-2)/`:1477`(Tier-1) cmap-intro 인라인 일반문. Tier-2엔 `geoCountries`(국가급) 있음, 시티급 지명은 fantasia `J_location` sentence 재사용(추가 페치 0). |
| 12 | Credits 패널 "몇 번째 협업" 문장 | **done (⚠️신규 RPC 재검토)** | `MakerPanels.tsx:32–35/52–59`가 이미 "the {ordinal} of {shared.length} with {director.name}" 렌더. `lib/film-credits-data.ts`가 TMDB에서 idx/shared/careerFirst 계산(daily-cache `film-credits-page-2`). **DB 신용 그래프 테이블 없음 → 신규 RPC는 리던던트 or 큰 신규 작업. 오너 결정 필요.** |
| 13 | Where to watch → 전지역 지문 리드 + 칩 | **extend** | `AccessSummary.tsx`는 이미 `watch.results`(전 지역)+`watch.countries`를 메모리 보유, 1개국만 렌더. 전지역 리드+지역 칩은 렌더만 변경, 추가 페치 0. |
| 14 | TMDB 문구 과다(가시 17회) → 2곳 유지 | **new** | 유지 2: Footer 법정문구(`Footer.tsx:100`) + #9 Sources "Origin from TMDB"(`FilmLineageSection.tsx:202`). 나머지 반복 삭제. |

> **요약:** 순수 신규 조립은 **#1 #2 #4 #5 #7 #9 #10 #14**. 이미 로드된 데이터의 렌더 확장은 **#3 #6 #8 #11 #13**. 이미 SHIP되어 재작업 금지는 **#12**(신규 RPC는 오너 결정 사항으로만 남김).

### 0.4 웨이브 (위험 낮은 순)
- **W1 문구·정리 (DB 0):** #1 #2 #3 #4 #7 #10 #14.
- **W2 실데이터 리드 주입 (이미 로드된 데이터 결정론 조립, 렌더만 변경):** #5 #6 #8 #9 #11 #13.
- **W3 신규 집계 (오너 결정 후):** #12 (신규 RPC `0105` or TMDB-render-time 유지).

---

## §1 작업 규칙·함정 (R-table)

**승계:** `HANDOFF-SEO-스타터가이드-작업지시서.md` §1의 **R1–R9** 전량 + `HANDOFF-Tier2-메인통합.md` §1의 **R-K1/R-K2** 승계. 아래는 그 위의 신규·재확인 규칙. 이 목록은 코드리뷰 체크리스트를 겸한다.

| R | 규칙 | 근거·함정 |
|---|------|-----------|
| **R-K1(승계)** | 필름 minimal 페이로드 **shape** 변경 시 `film-load8`→`film-load9` 범프 + loader·render·bump을 **한 커밋**에. render-only는 범프 불요. | render 배포가 stale 페이로드를 destructure하면 500. 히스토리 주석 `page.tsx:497–502`. **본 작업 중 shape 변경 후보는 #11(Tier-1 place-labels 추가 시)·#9(Tier-1 recordUpdated 추가 시)뿐.** |
| **R-K2(승계)** | director loader shape 변경은 `director-load6` 범프. D2/D3/D5는 별도 키 `director-press-digest-1`에 격리 — 그 분리 유지. | 본 작업은 director 페이지 미접촉. |
| **R-L (신규)** | **모든 섹션 리드는 결정론 조립(LLM-0).** 신규 생성/작문 텍스트 0. 다이제스트와 동일 기법. | 리드 채우려고 LLM 프로즈 스테이지 추가 금지(품질>물량, 카탈로그 LLM-0 계약 위반). |
| **R-G (신규)** | **색인/robots/사이트맵 불변.** `lib/seo.ts filmIndexBar`·`lib/filmGate.ts filmMainIndexable`·`INDEX_COHORT_FILMS_T2(=300)`·`factory/coupling-map.json` 무변경. `robots` 필드를 다른 경로로 방출 금지, `meetsBar` 미변경, `follow:true` 유지. | pageRobots(`lib/seo.ts:17`)가 유일한 robots 기제. 리드 추가는 render만 바꾼다. #12 RPC(빌드 시)는 gate 신호 아님 → coupling-map 진입 금지. |
| **R-B1 (신규)** | **보일러플레이트 페이지당 1회.** 공통 정의/면책/법정문구는 하단 provenance 1곳. 각 섹션 리드엔 그 영화 실데이터 ≥1. | #5 #7 #10 #14의 축. |
| **R-D (승계·강화)** | **다이제스트 계약:** 메인이 보여주는 것은 ①서브페이지의 부분집합(캡 명시) ②다른 문장 프레임 ③풀레코드 링크. 서브페이지 문장 템플릿("Won the {label} on {date}." 등) 재사용 금지. 숫자 TakeScore만 예외(정전 사실). | 신규 리드(#5 #8 #9 #11 #13)는 `normWords`(`page.tsx:183`)로 다이제스트가 이미 말한 award/place와 단어중복 dedupe 필수. |
| **R-C1 (신규, 원칙C)** | 데이터 부재 = **섹션 부재**. 자기부정 문장 렌더 금지. 리드는 반드시 존재 gate(예: `geoCount>0`, `wdHonors.length>0`, `recSources.length>0`)로 감싼다. | #8(honors=0)·#11(locations=0)·#13("No streaming data yet" fallback, `AccessSummary.tsx:102`)에 직접 적용. |
| **R-S (신규)** | **공유 컴포넌트 수정은 양 티어에 자동 적용.** CinecodexPanel/FilmLineageSection/FilmSentences/AccessSummary/MakerPanels는 Tier-2·Tier-1 양쪽에서 마운트 → 한 번 고치면 둘 다. 인라인(#11 cmap-intro, #12 리드 df-sub, #14 df-src)은 브랜치별로 각각 수정. | §"대상 컴포넌트 공유 매트릭스" 참조. |
| **R-R1 (승계)** | raw-for-ranking / clamp-for-display. `displayTs()`는 표시·schema.org에만 음수 0-clamp. ranking/API/`film_context_pack`은 raw 유지. | #5 #6 #7이 TakeScore 리드/카드 재작성 — 표시는 clamp된 값, **저장/서빙 raw 값은 절대 변경·재랭크 금지.** #12 collab count도 read-only 파생 사실. |
| **R-V (승계)** | 배포 후 검증은 cache-buster 필요(ISR 300s+tag). React 주석 노드가 보간 텍스트를 쪼개므로 **live HTML은 문장 통째가 아니라 단어/속성으로 grep.** | §검증 체크리스트. |
| **R-M (신규)** | 신규 마이그레이션은 additive-only·owner-run·다음 순번 `0105`(on-disk max `0104` 재확인!). `supabase/`는 워처 밖 → 수동 커밋. migrate-before-merge(RPC가 prod에 살기 전 호출 코드 배포 금지 = 500). | #12만 해당, 그마저 오너 결정 시. |

**현재 캐시 키 (범프 판단 기준):**
`film-load8`(`page.tsx:503`, minimal+full 로더, revalidate 300, tag `film:<slug>`) · `film-chrome2`(`:530`, codex+subscores → #5/#6/#7 render-only, **범프 불요**) · `film-sentences-v2`(`:574`, #10 + #11 place-name 소스) · `film-credits-page-2`(`lib/film-credits-data.ts:183`, #12; collab 필드 추가 시에만 `film-credits-page-3`) · `read-plates`류는 이 레포에 없음(참고 seed의 예시는 부적용).

---

## §2 W1 — 문구·정리 (DB 0, 위험 최저)

전부 render/삭제. 캐시 shape 무변경 → 범프 불요.

### 2.1 (#1) df-catnote 삭제 — Tier-2 전용
- **file:line:** `app/film/[slug]/page.tsx:957`
- **current:** `<p className="df-catnote">Catalog record — the deep analysis (figures &amp; readings) is still pending. Track it in your lists; the films most readers add are the ones we analyze next.</p>`
- **변경:** `<p className="df-catnote">…</p>` 한 줄 **삭제**. 대체 문장 넣지 말 것(대체안도 "약속"이라 원칙 C 위반). 상단에 이미 완전한 다이제스트가 조립돼 있음(`hasDigest`, `:805`). Tier-1 등가물 없음.
- **조립 규칙:** 없음(삭제).

### 2.2 (#2) 히어로 중복 링크 삭제 — Tier-2 전용
- **file:line:** `app/film/[slug]/page.tsx:949`, `:950` (df-hactions 내)
- **current(949):** `{f.tmdb_id ? <Link className="df-like" href={\`/credits?f=${f.tmdb_id}\`}>🎞 Follow the credits →</Link> : null}`
- **current(950):** `{f.poster_path ? <Link className="df-like" href={\`/film/${f.slug}/gallery\`}>🖼 Gallery →</Link> : null}`
- **변경:** 두 줄 **삭제**. mTabs의 Credits(:857)/Gallery(:861) 탭과 중복. 히어로 액션은 MovieListActions·EntityActions·DownloadPackModal·McpConnectButton·ShareDock만 유지. Tier-1 히어로(df-hactions :1388–1393)엔 `.df-like` 없음 → **Tier-1 변경 없음.**

### 2.3 (#3) TMDB 줄거리 리드 강등 — Tier-2 전용
- **file:line:** 정의 `page.tsx:867–869`, mount `page.tsx:962`
- **current(867):** `const synopsis = f.overview ? (<p className="df-synopsis">{f.overview}</p>) : null;`
- **current(962):** `{synopsis}` (히어로 `</section>`와 FilmTabBar 사이)
- **변경:** raw TMDB overview를 **리드에서 제거**. 첫 문단은 항상 우리 문장(이미 `filmLead` dek가 히어로에서 선행). 필요 시 다이제스트 접이식(`<details>`)으로 격하. Tier-1은 synopsis 리드 없음(invitation 사용, :1403–1424) → **Tier-1 변경 없음.**
- **조립 규칙:** 없음(강등). 첫 화면 프로즈는 `filmLead`(`lib/lead.ts`, :922–924)가 유지.

### 2.4 (#4) Tier-2 탭바 zone 부여 — Tier-2 전용
- **file:line:** `page.tsx:848–862` (mTabs 배열), 렌더 `:966`
- **current:** mTabs 엔트리들에 `zone` 키 없음. 참조 정본: Tier-1 `tabs`(:1219–1250)는 각 엔트리에 `zone: "free" as const` / `zone: "spoiler" as const` 보유.
- **원인:** FilmTabBar(`FilmTabBar.tsx:208–227`, type :20)는 어떤 탭이 `zone`을 가질 때만 2단 레일 divider+라벨을 그림. Tier-2 mTabs는 unzoned → 무라벨.
- **변경:** mTabs 각 엔트리에 `zone: "free" as const` 부여(Tier-2 전 섹션은 스포일러-free 카탈로그 레코드 데이터 → 전부 `free`, Tier-1 top 레일과 통일). `FilmTab` 타입은 이미 import(:9).
- **조립 규칙:** 없음(구조 통일).

### 2.5 (#7) sonnet-n1 모델명 제거 — 공유(CinecodexPanel, 양 티어)
- **file:line:** `components/CinecodexPanel.tsx:362`
- **current:** `AI-estimated (TakeScore rubric, {data.panel}). A rubric-anchored judgment, not an objective fact; popularity metrics above are for comparison only.`
- **변경:** `, {data.panel}` 보간 **한 토큰 제거** → `AI-estimated (TakeScore rubric).`. `{data.panel}`은 리터럴이 아니라 내부 패널/모델 id의 런타임 값(=소비자 표면 누수). Confidence절(:364–366)은 **07-14 정책상 그대로 유지.** 모델/패널명은 `/methodology`로만.
- **조립 규칙:** 없음(토큰 삭제). /methodology 정합은 §공장·문서 정합.

### 2.6 (#10) Embedding Fantasia 면책 압축 — 공유(FilmSentences + EntityFantasia)
- **⚠️ 정책 충돌 — 오너 확인 선행:** `FilmSentences.tsx` doc-comment(:8–11)와 `EntityFantasia.tsx`(:3–12)가 "The disclaimer below the heading is part of the contract — keep it." 불변식을 선언. #10은 이를 압축 지시. **착수 전 오너에게 확인하고, 승인 시 doc-comment도 동시 수정해 불변식이 조용히 모순되지 않게 하라.**
- **file:line:**
  - 상단 `FilmSentences.tsx:97–101` — current: `<p className="df-sub dfk-disclaimer"><b>Not AI-written.</b> Every line here is assembled by SQL from Metatake's embedding space — one designer's fantasia … every name it drops is a door.</p>`
  - 하단 `FilmSentences.tsx:139` — current: `<div className="df-src">Embedding Fantasia — SQL-assembled from the Metatake database · no AI-written text · unrelated to the original authors' intent.</div>`
  - 형제 `EntityFantasia.tsx:100–104`(상단)/`:141`(하단) — 동일 패턴, **락스텝 수정**(사이트 전역 fantasia voice 일관).
- **변경:** 상단을 1줄로 압축(예: `SQL-assembled, not AI-written · <a href="/methodology">what is this?</a>`), **하단 반복 삭제**, 시적 설명은 `/methodology`로 이전.
- **조립 규칙:** 없음(압축). ⚠️ **정확성:** "SQL-assembled, not AI-written"은 S28 문장 조립(LLM-0)에 대해 참이나, 그 **입력인 위치(S19)는 sonnet 추출**이다 → /methodology는 이를 정확히 서술(위치가 순수 결정론이라고 주장 금지).

### 2.7 (#14) TMDB attribution 정리 — 공유 + 인라인
페이지당 유지 **2곳**: `Footer.tsx:100`(전역 법정문구) + `FilmLineageSection.tsx:202`("Origin from TMDB…", #9 Sources 박스로 흡수). 나머지 **삭제**:

| file:line | current (요약) | 처리 |
|-----------|----------------|------|
| `page.tsx:1090` (Tier-2) | `<div className="df-src">Credits data from TMDB · analysis by Metatake</div>` | 삭제 |
| `page.tsx:1898` (Tier-1) | 동일 | 삭제 |
| `page.tsx:1128` (Tier-2 전용) | `<div className="df-src">Data &amp; images via TMDB. Not endorsed or certified by TMDB.</div>` | 삭제 (Footer :100과 중복) |
| `StillStrip.tsx:71`, `:90` | `… · still via TMDB` (캡션/줌) | 삭제 |
| `AccessEnrichment.tsx:276` | `…JustWatch, via TMDB.` | dedupe/삭제 |
| `MediaGallery.tsx:68, 82, 90–91` | `Still via TMDB` / `Stills via TMDB…` | 단일 footer로 축소 |

- **⚠️ 유지(오해 삭제 금지):** `page.tsx:1758` `not yet on Metatake · TMDB ↗` = Watch-next 미수록작의 기능적 아웃바운드 링크(법정 보일러플레이트 아님). 다이제스트 `:993` "TMDB's ledger dates…" = 사실 attribution. 둘 다 **삭제 대상 아님.** `/whereto` 페이지(WatchPageClient 등)는 별도 페이지 — 동일 "페이지당 1회" 규칙으로 별건 처리.
- **조립 규칙:** 없음(삭제). Provenance 컴포넌트엔 TMDB 문자열 없음(영향 없음).

---

## §3 W2 — 실데이터 리드 주입 (이미 로드된 데이터 결정론 조립, 렌더만 변경)

전부 이미 로드된 페이로드에서 조립 → 신규 페치 0, 캐시 범프 불요(예외 명시). 신규 리드는 R-D(`normWords` dedupe)·R-C1(존재 gate) 준수.

### 3.1 (#5) TakeScore 정의 → 영화별 한 줄 — 공유(CinecodexPanel, 양 티어)
- **file:line:** `components/CinecodexPanel.tsx:256–260`
- **current:** `<p className="df-sub">Our own estimate of the durable value a serious viewer gains from {title}, the cost to unlock it, and the risk it disappoints — not popularity. {subscores ? Scored on the thirteen TakeScore dimensions against a fixed anchor ruler.}</p>`
- **변경:** 3-clause 공통 정의를 **영화별 한 줄**(최고 Value 차원 vs 최고 Risk 차원)로 교체, 정의는 접기/링크로 강등.
- **조립 규칙 (컴포넌트 내 데이터 전부 보유, 신규 prop 불요):** `data.sub`(13차원 전 점수 Record) + VALUE/COST/RISK 라벨 배열(:35–37) + `NAME_KEY`(:41–45) + `dimByKey`/`bandWord`(lib). VALUE 축에서 최고 점수 차원, RISK 축에서 최고 점수 차원을 뽑아 "{title}'s strongest value dimension is {dimLabel} ({bandWord}); its sharpest risk is {riskDimLabel}." 류로. `verdictShort`(:287)가 이미 이 기법의 선례. **표시 값만, raw 재랭크 금지(R-R1).**

### 3.2 (#6) Value/Cost/Risk 카드 = 완전한 문장 — 공유(CinecodexPanel, 양 티어)
- **file:line:** gauge 헤더 `CinecodexPanel.tsx:267` (`<div className="ccx-gk">The three central scores <span>0–100</span></div>`), net 숫자 `:273`, 카드 `:288–296`
- **변경:** (a) `:267` 헤더에 제목 박기 → "How {title} scores" (net "47"이 이 영화 수치로 읽히게). (b) Value/Cost/Risk `ScoreDonut` 셀(:288–296)을 label+숫자만 → **제목+수치+티어프레이즈**의 완전한 문장으로.
- **조립 규칙:** `title` prop(이미 in scope) + `data.v`/`data.c`/`data.r` + `bandWord(...)`(축별 티어 프레이즈). "Where {title} ranks"(:306)·"How {title} scores on the thirteen dimensions"(:327)는 이미 영화별 — 동일 결정론 확장. render-only → `film-chrome2` **범프 불요.**

### 3.3 (#8) Lineage 리드 = 영화별 조립 — 공유(FilmLineageSection, 양 티어)
- **file:line:** `components/FilmLineageSection.tsx:109`
- **current:** `<p className="df-sub">Where {title} comes from and sits in cinema's record — its national cinema and movement, the awards it won, the canons it belongs to, and the auteur line it extends. Sourced per entry.</p>`
- **변경:** national cinema + auteur line + 수상(wins/noms) + canon 건수로 영화별 조립.
- **조립 규칙 (컴포넌트 내 이미 계산됨):** `wins`(:57), `noms`(:58), `canonsN`(:59), `listsN`(:60), `eY0/eY1`(:62–63), `linAuteur`, national-cinema 이름(`movements`/`nations`, :52). lin-stats 블록(:112–119)이 이미 이 수치를 셈 → 그 데이터로 프로즈 리드. **honors=0이면 그 절을 빼고 조립(R-C1).** 다이제스트가 이미 말한 계보 문장과 `normWords` dedupe(R-D).

### 3.4 (#9) Lineage 출처 각주 → "Sources for this record" 박스 — 공유(FilmLineageSection, 양 티어)
- **file:line:** `components/FilmLineageSection.tsx:202` (현재 산문 각주 `df-src`)
- **변경:** 구조화 박스: **Origin / Awards / Canon** 출처별 그룹 + 출처명 + 건수 + **"Record updated {date}"**. #14의 유지 2곳 중 하나(Origin from TMDB).
- **조립 규칙:** 건수·출처명은 컴포넌트 내 `SourceTag`(:29–42)/`lineageSource`/`wikidataUrl`로 조립. **⚠️ recordUpdated 갭:** 이 컴포넌트의 prop이 아님. `page.tsx`에서 로드(minimal loader `mRecordUpdated` :265 / `recordUpdated` :710 / `recordDateFmt` :806)되어 다이제스트 footer(:1029)·Provenance(:1137)에만 쓰임. → **`FilmLineageSection`에 신규 optional prop `recordUpdated` 추가하고 양 콜사이트(:1036 Tier-2, :1498 Tier-1)에서 전달.** 
  - **Tier-2:** `recordUpdated`(minimal payload, :710) 그대로 전달. loader shape 무변경 → **범프 불요.**
  - **Tier-1 asymmetry:** full payload(loader return :489)엔 `recordUpdated` 없음. 선택지 (a) full loader에 추가 → `film-load8`→`film-load9` 범프(R-K1); (b) `film.created_at`(또는 `recsUpdated` :460)를 대신 전달(범프 불요). **기본 판정: (b) `film.created_at` floor 사용으로 범프 회피.** 값은 "구성된 소스 행들의 MAX timestamp, created_at을 floor"(mStamps :258–265)와 동일 의미 — 오늘 날짜 금지.

### 3.5 (#11) Locations 리드 = 지명 박기 — 인라인 (브랜치별)
- **file:line:** Tier-2 `page.tsx:1052`, Tier-1 `page.tsx:1477` (둘 다 인라인 `cmap-intro`, 컴포넌트 아님)
- **current(1052):** `<p className="cmap-intro">The real places {f.title} is set in, was filmed at, or names — geolocated on Metatake's location map.</p>`
- **current(1477):** `<p className="cmap-intro">The real places {film.title} is set in and names — geolocated. Click a pin to read what the place means in the film.</p>`
- **변경:** 상위 2–3 지명 + "and N more" 박기.
- **조립 규칙 (데이터 소스 주의):**
  - **Tier-2:** `geoCountries`(국가급 string[], :710/loader :253) + `geoCount`. 국가급은 있으나 "Hanam" 같은 시티급 없음.
  - **Tier-1:** scope에 geo **COUNT만**(geoCount/geoCells/geoMerged, :489). 핀/지명은 payload 밖(client FilmMap `/api/geo`).
  - **시티급 지명(양 티어 공통 권장):** 이미 로드된 `sentences`(fantasia, `film_sentences_for`, :574/683)의 **`J_location` 패턴 행**이 실제 지명("filmed at Hanam, Gyeonggi Province")을 담음 → **이걸로 top 2–3 + "and N more"(추가 페치 0, 범프 0).** loader에 place-label을 새로 넣는 경로(→ `film-load9` 범프)는 J_location으로 불필요하면 피한다.

### 3.6 (#13) Where to watch = 전지역 지문 리드 + 칩 — 공유(AccessSummary, 양 티어)
- **file:line:** `components/AccessSummary.tsx:45–104`; 마운트 `page.tsx:1101`(Tier-2)/`:1904`(Tier-1)
- **current:** `const o = watch?.results?.[cc]; …` — 선택된 1개국(cc)만 렌더(:45–104), full-guide 링크는 이미 맨 끝(:104). 자기부정 fallback "No streaming data yet for your country"(:102) 잔존.
- **변경 (원칙 A):** 전지역 지문 리드 먼저 → 지역 칩 행 → 풀가이드 링크는 마지막. 예: "Tracked in 8 regions — free on Kanopy (US), streaming in 2, rent in 5, not yet in 3". "No streaming data yet" fallback은 **섹션 부재로 대체(R-C1)** 또는 실데이터로 치환.
- **조립 규칙 (추가 페치 0):** `watch` prop이 이미 `{ results: Record<cc, CountryOffers>; countries: string[] }`(type :15) — **전 지역 offers가 이미 메모리.** `watch.results`/`watch.countries` 순회. library/free/stream/rent/buy 티어링 헬퍼(`isLibraryProv` :31, verdict order :58–86) 지역별 재사용. render-only → 범프 불요. **원장 신선도:** #13은 provider를 headline으로 승격 → S04가 ingest 시에만 페치하므로 인덱스작 provider-refresh(garden-pass) 케이던스 필요(§공장·문서 정합, `HANDOFF-티어2noindex공장.md` N1). fpi(S44)는 gate 전용이라 무관.

---

## §4 W3 — 신규 집계 (#12, 오너 결정 선행)

### 4.1 (#12) Credits "몇 번째 협업" 문장
**⚠️ 착수 전 확정할 오너 결정:** seed는 "유일하게 신규 크로스필름 집계 필요 → additive RPC 1개(마이그 undefined)"라 했으나, **리서치 결과 이 집계는 이미 살아 있다.**

- **이미 SHIP된 부분:** `components/read/MakerPanels.tsx`가 이미 렌더한다 — 감독 패널 "The director of {title}: {N} directing credits since {year} — {title} was the {ordinal} of them."(:32–35), 크래프트 패널 "The {role} of {title} — {careerCount} films {verbed} since {careerFirst}; the {ordinal} of {shared.length} with {director.name}."(:52–59). 데이터는 `lib/film-credits-data.ts`의 `relationWithDirector`(:68–96)가 TMDB `/person/{id}/movie_credits`에서 계산(daily-cache `film-credits-page-2`), **Supabase RPC 아님.** 양 티어 마운트(:1064 Tier-2, :1872 Tier-1) + 독립 `/film/[slug]/credits` 페이지.
- **DB 사실:** Postgres에 cast/crew/credit-graph 테이블 **없음**(S03은 media+directors만 저장). 따라서 신규 RPC는 (a) `film-credits-data.ts`의 기존 Relation payload를 소비하면 **리던던트·0 팩토리 작업**, 또는 (b) TMDB-live에서 이탈하려면 **신규 additive 테이블 + 워커 ingest + 전코퍼스 백필**(= "RPC 1개"보다 훨씬 큼).
- **기본 판정 (오너 승인 전제):** **신규 RPC를 만들지 않는다.** #12의 가시 산출물은 이미 라이브. W3 실작업은 (1) `MakerPanels`가 렌더되지 않는 **fallback rcp-list 경로**(`page.tsx:1068–1088` Tier-2 / `:1876–1896` Tier-1, `creditsPayload===null` 시 링크만)에서 문장이 빠지는지 확인, (2) 인라인 리드 df-sub "One panel per craft…"(`page.tsx:1061` Tier-2 / `:1869` Tier-1 / `credits/page.tsx:291–292`, 3곳)의 문구 일관성, (3) `careerCount/careerFirst/shared/idx`가 얇은 코퍼스에서 과소계수되지 않는지(TMDB-sourced라 Tier-2 코퍼스 credits 커버리지에 **무의존**).

- **오너가 DB-native precompute를 명시적으로 원할 경우에만** 아래를 빌드(그 외 미실행):
  - **migration:** `supabase/migrations/0105_film_collab_counts.sql` (on-disk max `0104` 재확인!). additive-only, owner-run(워처 밖 → 수동 커밋 + Management-API 적용), migrate-before-merge.
  - **RPC signature:** `public.film_collab_counts(p_slug text) returns jsonb` — `language sql stable security definer set search_path to 'public' set statement_timeout to '12s'`. service_role-only grant(`revoke execute … from public, anon, authenticated; grant execute … to service_role;`). 단일-row `jsonb_build_object`(PostgREST 1000행 캡 회피), 빈결과 `case when not exists(...) then null` guard. 템플릿: `0103_film_context_pack_tier2.sql`(:8, empty-guard :86, grants :154–156).
  - **return shape:** `{"film":{"slug","tmdb_id","director_person_id","director_name","year"}, "people":[{"person_id","name","role","craft","nth","total","first_year","this_year"}]}` — `nth=idx+1`, `total=shared.length`, `first_year=shared[0].year`(="since 2015" 절).
  - **선행 테이블(불가피):** `public.film_credit_pairs(director_person_id, person_id, tmdb_id, year, craft)` + `relationWithDirector`를 미러하는 워커. **이건 gate 신호 아님 → `coupling-map.json` 진입 금지.**
  - **cache:** collab 필드를 payload에 추가 시에만 `film-credits-page-2`→`film-credits-page-3` 범프.

---

## §5 대상 컴포넌트 공유 매트릭스

| # | 항목 | Tier-2만 | Tier-1만 | 양 티어 (공유 컴포넌트) | 수정 파일 |
|---|------|:---:|:---:|:---:|-----------|
| 1 | df-catnote 삭제 | ● | | | `page.tsx:957` |
| 2 | 히어로 중복 링크 삭제 | ● | | | `page.tsx:949–950` |
| 3 | synopsis 리드 강등 | ● | | | `page.tsx:867/962` |
| 4 | 탭바 zone | ● | | | `page.tsx:848–862` |
| 5 | TakeScore 한 줄 | | | ● | `CinecodexPanel.tsx:256` |
| 6 | Value/Cost/Risk 문장 | | | ● | `CinecodexPanel.tsx:267/288` |
| 7 | sonnet-n1 제거 | | | ● | `CinecodexPanel.tsx:362` |
| 8 | Lineage 리드 | | | ● | `FilmLineageSection.tsx:109` |
| 9 | Sources 박스 | | | ● (+양 콜사이트 prop) | `FilmLineageSection.tsx:202`, `page.tsx:1036/1498` |
| 10 | Fantasia 면책 압축 | | | ● (+EntityFantasia 락스텝) | `FilmSentences.tsx:97/139`, `EntityFantasia.tsx:100/141` |
| 11 | Locations 지명 | | | 인라인 2곳 (브랜치별) | `page.tsx:1052`(T2), `:1477`(T1) |
| 12 | 협업 문장 | | | ● (이미 SHIP) | `MakerPanels.tsx` / `lib/film-credits-data.ts` |
| 13 | WTW 전지역 리드 | | | ● | `AccessSummary.tsx:45–104` |
| 14 | TMDB 정리 | 인라인 1(:1128) | | ● 공유 다수 + 인라인 2 | `page.tsx:1090/1128/1898`, `StillStrip/AccessEnrichment/MediaGallery` |

> **원칙:** 공유 컴포넌트는 한 번 고치면 양 티어. 인라인(#11 cmap-intro, #12 리드 df-sub, #14 df-src)만 브랜치별 개별 수정. Chrome parity 유지 — Tier-1에 chrome 추가 시 Tier-2 백포트(정보량은 다르되 포맷 동일). Byline은 Tier-2에서 의도적 제외(규칙 조립 카탈로그 레코드에 대한 over-claim 방지) — 유지.

---

## §6 공장·문서 정합 (업데이트 반영)

본 작업은 ~95% 렌더 레이어지만, 리드 입력이 공장 산출 행이라 4개 공장/알마낙 문서와 얽힌다. 아래를 반영하라.

### 6.1 크로스-문서 등록 (지시서 저자 필수 작업)
1. **`docs/00-INDEX.md`** — `## Design plans (status flipped to live where shipped)` 아래, SEO 스타터가이드 행(line 53) **뒤**·감독읽는층 행(line 54) **앞**에 한 줄 추가:
   `- \`HANDOFF-필름페이지-보강-작업지시서.md\` (루트) — **영화 세부페이지 실질성 보강 (기획 완료 2026-07-16, 구현 대기 — 다른 AI 수행 예정)**: 섹션 리드 보일러플레이트를 영화별 실데이터 결정론 조립으로 교체(디지스트 기법 확장). LLM-0, 색인/robots/사이트맵 불변. ⚠️#10 fantasia 면책은 컴포넌트 doc-comment 불변식과 충돌 → 오너 확인. ⚠️#12 협업 집계는 이미 SHIP됨(신규 RPC는 오너 결정). 세션은 여기서 시작.`
   > (본 정본 파일은 루트 `HANDOFF-필름페이지-보강-작업지시서.md`로 배치 완료 — 아래 6.1·6.2 등록/반영도 함께 적용됨.)
2. **`docs/HANDOFF-SEO-마스터.md`** — §3d 끝(line 133)과 `## 4. GSC 판독 로그`(line 135) 사이에 신규 색인 서브섹션 `## 3f. 2026-07-16 작업 이력 (정본: HANDOFF-필름페이지-보강-작업지시서.md)` 삽입(§3c/§3d "여기는 색인" 패턴). §5 대기 중인 결정 tail(line 150) 뒤에 오너 결정 항목(#10 면책 불변식, #12 RPC 여부) 추가. 신규 component/RPC/gate가 실제로 도입될 때만 §1 표(line 48 뒤) 행 추가 — 현재 계획상 render-only라 **표 행 불요**(#12 RPC를 오너가 승인할 때만).

### 6.2 공장 문서 업데이트 (반영 위치·이유)
| 문서 | 위치 | 반영 내용 | 이유 |
|------|------|-----------|------|
| `HANDOFF-티어2공장.md` | §3b 파급표(~:160) | #12 collab-count는 이미 render-time(`film-credits-data.ts`, TMDB), 코퍼스 credits 스테이지 없음 → "additive RPC"는 리던던트(TMDB 유지=0작업) 또는 신규 테이블+스테이지+백필. 오너 결정. | seed의 "유일 신규 집계" 전제가 반만 참 — 리던던트 스테이지 방지. |
| `HANDOFF-티어2공장.md` | §1 품질바(:56), T5/S59(:99–111) | geo/sentences/honors "0 허용" 필드가 이제 **render-critical 리드 입력**(#11/#10/#8). S59 리포트에 "enrichment-lead readiness"(≥1 location/honor/subscore/offer) 지표 추가. 원칙 C는 데이터 부재 시 섹션 gate로 해소. | 부분 커버리지가 degraded 리드를 만드는 인덱스작을 오너가 보게. |
| `HANDOFF-티어2공장.md` | §3 모델표(:145) | #7/#10 → /methodology가 manifest 스테이지 모델 정확 미러(S40 sonnet, S19 sonnet-4-6+Tavily, S28 LLM-0). #10 미묘: "not AI-written"은 S28엔 참이나 위치 입력 S19는 sonnet 추출. | 투명성 페이지가 공장과 불일치 방지. |
| `HANDOFF-티어2공장.md` | 커버리지표(:33), S19(:151–154) | #11은 `film_locations.name`(주소급, S19 정본 geo-extract-search만 생산) 읽음. 금지된 순수-haiku 핀은 name 없어 degraded → re-geocode 후보. | #11은 핀 존재가 아니라 name 품질 의존. |
| `HANDOFF-티어2공장.md` | C1–C5 계약(:38–44), §4 불변식 | enrichment는 R-D 다이제스트 계약을 전 섹션 리드로 확장. "공장은 행만, 문장 조립은 렌더(LLM-0)". 신규 LLM 스테이지·gate 신호 0. coupling-map 무변경. | LLM 프로즈 스테이지 추가/gate SSOT 접촉 두 실패 모드 방지. |
| `HANDOFF-티어2noindex공장.md` | 커버리지(:20), N6(:153–158) | enrich 커버리지(수상 94/37%·촬영지 94/79%)가 #8/#11 리드 도달률의 직접 상한. N6 리포트에 "full enrichment lead set / degraded(missing locations K, honors M)" 라인 추가. | 커버리지 웨이브 = 페이지 품질 메트릭. |
| `HANDOFF-티어2noindex공장.md` | 정직성 원칙(:59–62), :20–21 | 원칙 C(자기부정 금지)는 이 공장의 "못 만드는 한계" 정직성과 정합 — 부재=섹션 생략, "no awards recorded" 렌더 금지. | 두 문서 render 계약 합의. |
| `HANDOFF-티어2noindex공장.md` | N1 fpi(:84, :124–126) | #13은 raw `film_watch_providers`(S04, 전지역, AccessSummary 메모리, 0페치) 읽음, `film_provider_index`(S44 gate) 아님. fpi staleness는 gate 전용. #13이 provider를 headline化 → provider-refresh 케이던스 노트. | "fpi 재빌드로 리드 고침" 오결론 방지. |
| `HANDOFF-티어2공장.md` | T2 S28(:77–85) | #10 fantasia 리드는 S28 의존, 라이브 manifest에서 S28 tier=['full']만(T2 catalog 미SHIP). 신규 Tier-2 카탈로그작은 빈 fantasia 리드 → #10 유지하려면 T2 우선. | 데이터 선존 의존. |
| `docs/PLAN-tier2-almanac.md` | §7(:135–140), §3(:61), 남은 것(:156–157) | [UPDATE 2026-07-16] 블록: 14항목 계획이 Editor's digest 기법을 전 섹션 리드로 확장. "lineage_editions 노출(계보 세션 카드)" 미결 항목 = #9 Sources 박스로 배달. render-only, 색인 불변, LLM 0. | 알마낙 모듈추가 단계를 enrichment가 확장/승계. |
| `FACTORIES.md` | 통합 인덱스 | enrichment를 render-layer follow-on으로 기록, 미결 = #12(TMDB 유지 vs precompute). render가 S40/S19/S06/S04/lineage curation에 hard 의존 → 품질바·커버리지 웨이브가 페이지 품질 게이트. | 공장→렌더 커플링을 최상위 인덱스에 기록. |

---

## §7 검증 체크리스트 (수행자가 채워 보고)

### 7.1 빌드/정적
- [ ] `tsc` 클린(신규 prop `recordUpdated?` 타입 포함).
- [ ] `next build` 성공, Tier-2/Tier-1 두 브랜치 렌더 무오류(minimal payload destructure 500 없음).
- [ ] **R-R1:** 어떤 정렬/랭킹도 `displayTs()` clamp 값을 쓰지 않음(raw만). grep으로 확인.
- [ ] **R-G:** `lib/seo.ts filmIndexBar`/`lib/filmGate.ts filmMainIndexable`/`INDEX_COHORT_FILMS_T2`/`factory/coupling-map.json` diff 0. `robots` 방출 경로 무추가.
- [ ] **R-K1:** loader payload shape 변경 여부 확인 — 변경 시 `film-load8`→`film-load9` 범프가 같은 커밋에 있는지(#9 Tier-1을 (a)로 갔거나 #11을 loader 경로로 갔을 때만).
- [ ] **R-C1:** 새 리드 전부 존재 gate로 감쌈(`geoCount>0`, `wdHonors.length>0`, `recSources.length>0`, `watch.countries.length>0`). 자기부정 문자열 grep 0.
- [ ] **R-D:** 신규 리드가 `normWords`로 다이제스트/서브페이지와 dedupe.

### 7.2 라이브 curl (cache-buster `?t=<epoch>` 필수, R-V — 단어/속성 grep)
**Tier-2 대표: `https://metatake.net/film/the-novelist-s-film-2022`**
- [ ] #1: `df-catnote` / `still pending` 부재.
- [ ] #2: `Follow the credits` / `df-like` 히어로 부재.
- [ ] #3: 히어로 밑 첫 `<p>`가 `df-synopsis`(raw overview) 아님 — 우리 문장 선행.
- [ ] #4: FilmTabBar 2단에 zone rail/divider 존재(`ccx`/rail 라벨 클래스 확인).
- [ ] #5/#6: `df-sub`가 영화명+차원 포함(공통 정의 문장 부재), `How the-novelist` 헤더, Value/Cost/Risk 카드 문장.
- [ ] #7: `data.panel`/내부 모델명(sonnet…) 부재, `TakeScore rubric` 유지.
- [ ] #8: Lineage 리드에 national cinema/auteur/canon 수치 포함.
- [ ] #9: "Sources for this record" + "Record updated" 존재, Origin/Awards/Canon 그룹.
- [ ] #10: fantasia 면책 1회만(하단 반복 부재), `/methodology` 링크.
- [ ] #11: cmap-intro에 실제 지명(예: `Hanam`) + "more".
- [ ] #12: MakerPanels "the {ordinal} of … with" 문장 렌더.
- [ ] #13: "Tracked in N regions" 리드 + 지역 칩, 풀가이드 링크 맨 끝, "No streaming data yet" 부재.
- [ ] #14: 본문 TMDB 반복 삭제 — 페이지 내 "via TMDB"/"from TMDB" 출현 ≤2(Footer 법정 + Sources Origin).

**Tier-1 샘플(정독 완료작 1편, 예: 플래그십 슬러그):**
- [ ] #5/#6/#7/#8/#9/#10/#11/#12/#13/#14 공유 항목이 Tier-1에서도 동일 적용(양 티어 파리티).
- [ ] #9 Tier-1 "Record updated" = `film.created_at` 파생(오늘 날짜 아님).
- [ ] #11 Tier-1 지명 = `J_location` sentence 소스(핀 페치 0).
- [ ] #1/#2/#3/#4가 Tier-1에서 **무영향**(Tier-2 전용).

---

## §8 하지 말 것 (실측 근거)

- 삭제한 자기부정 문구를 다른 "약속" 문구로 대체하지 말 것(#1 대체안도 원칙 C 위반).
- 리드를 채우려 신규 LLM/프로즈 스테이지 추가 금지(R-L).
- 색인 gate SSOT(`filmIndexBar`/`coupling-map.json`/`INDEX_COHORT_*`) 접촉 금지 — 리드는 render만(R-G).
- #12에 신규 RPC/테이블을 오너 승인 없이 만들지 말 것(이미 SHIP됨 — 리던던트).
- #10 면책을 오너 확인 없이 삭제 금지(doc-comment 불변식 충돌).
- kindred/movies-like strip·TV 카드·trailer iframe·TMDB bio·"What critics said" copy 추가 금지(Tier-2 do-not list 승계). 리셉션은 scholarship/papers 어휘만(R-C 승계).
- 서브페이지 문장 템플릿("Won the {label} on {date}." 등) 크로스페이지 재방출 금지(R-D). 숫자 TakeScore만 예외.
- raw TakeScore 값 변경/재랭크 금지(R-R1).

---

## §9 결정 로그 (오너 승인 전제 · 되돌리기 쉬움)

| 결정 | 판정 | 근거 |
|------|------|------|
| #1 df-catnote | **문장 자체 제거**(대체 안 함) | 대체안도 "약속" → 원칙 C. 07-14 §2.4-f 교체 지시 갱신. |
| #2 히어로 링크 | **2줄 삭제** | 탭바 중복. 히어로는 Download/MCP/Share만. |
| #3 synopsis | **리드 강등**, 필요시 접이식 | 첫 문단 항상 우리 문장. |
| #7 sonnet-n1 | **표면 제거**, 모델/패널명은 /methodology만 | 내부 모델명+n1=자기부정 잔재의 소비자 누수. Confidence 문구는 07-14 정책상 유지. |
| #10 fantasia | **1줄 압축·하단 삭제·시적설명 /methodology** — ⚠️ **doc-comment 불변식 충돌, 오너 확인 후 doc-comment 동시 수정** | 페이지당 1회 원칙. |
| #12 RPC | **기본: 신규 RPC 미생성**(이미 render-time SHIP). DB precompute는 오너 명시 요청 시에만 `0105`+신규 테이블+백필 | credit-graph 테이블 부재 → "RPC 1개"가 아니라 테이블+스테이지. |
| #14 TMDB | **페이지당 2곳 유지**(Footer 법정 + #9 Sources Origin), 반복 삭제 | 법적 attribution 1회면 충분. |
| #9 Tier-1 Record updated | **`film.created_at` floor 사용**(범프 회피), Tier-2는 `recordUpdated` 그대로 | R-K1 hot key 보존. |
| #11 지명 소스 | **`J_location` fantasia sentence 재사용**(loader 확장 회피) | 추가 페치 0·범프 0. |
| 색인/robots/사이트맵 | **불변** | seed 공통 원칙. enrichment는 gate 신호 무추가. |

— 끝 —
