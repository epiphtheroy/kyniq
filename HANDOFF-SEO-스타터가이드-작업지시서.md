# HANDOFF — SEO 스타터가이드 감사 반영 작업지시서 (정본)

> **작성 2026-07-14** · Google SEO Starter Guide 전면 감사(코드 4에이전트 + 라이브 실측 + DB 실측) 결과의 실행 지시서.
> **수행자: 다른 AI.** 이 문서 하나로 전 작업을 빠짐없이 수행할 수 있도록 모든 수정 지점을 파일:라인으로 지정했다.
> 라인 번호는 2026-07-14 main(251e8b8) 기준 실측 — 착수 시점에 파일이 변했을 수 있으니 **각 항목은 현재 코드 인용(current)과 대조 후** 수정하라.

---

## §0. 배경·오너 결정 (2026-07-14 확정 — 재논의 금지)

감사 결론: 기술 SEO(사이트맵·canonical·크롤 앵커·리다이렉트·robots)는 상위 수준. 문제는 한 갈래 —
**얇은 콘텐츠 게이트가 메인 영화 페이지는 막는데, 서브페이지 3종(takescore/reception/lineage)이 게이트를 우회해
사이트가 스스로 숨긴 얇은 영화 ~6,800페이지를 색인 노출**(scaled-content abuse 패턴) + 그 위의 자체 별점 Review 스키마.

**오너 결정 3개:**

1. **[통합·Consolidate]** 얇은 영화를 일괄 noindex(Down)도, 그대로 색인(Up)도 아닌 **제3의 길**:
   흩어진 신호(TakeScore·리셉션·계보·가용성)를 메인 페이지로 모아 실속 페이지로 만들고,
   **실측 복합 게이트를 통과하는 영화의 메인을 색인** + "메인이 noindex면 서브페이지도 noindex" 불변식 + 사이트맵 미러.
2. **[클램프-0]** "flagged / n=1 / unverified / single-pass" 류 자기부정 문구 **전부 제거**(방법론적 "estimate/judgment" 프레이밍은 유지).
   음수 TakeScore는 **표시·스키마에서만 0으로 클램프**(랭킹/정렬/히스토그램은 raw 유지), **0일 때만** 산식 설명 1줄 노출.
3. **[조직 저작]** Review 스키마 저자를 **`Organization "Metatake"`로 통일**(Person "Wonwoo Yoon" 리뷰어 제거).
   책임 구조는 방법론에 이미 공개된 그대로("Metatake Editorial이 초안, 윤원우가 검수·책임 — The AI proposes; the editor disposes"):
   기존 `editor: Person "Wonwoo Yoon"(Founder & Editor, /editor)` 노드 유지. **새 직함 발명 금지.**

**DB 실측(2026-07-14, kyniq 프로덕션):** films 6,978 = (visible,is_analyzed) 사분면 (T,T) 1,959 / (F,F) 4,997 / (F,T) 22 / (T,F) 0.
현재 색인 메인 1,958. cinecodex 채점 6,704(전부 panel='sonnet-n1', n_samples=1), u<0 349편(얇은쪽 216), flagged 4,292(64% — 품질판정 아님).
**`films.visible`은 편집적 숨김이 아니라 figures≥3 트리거가 자동 계산하는 thinness 플래그**(`docs/REMEMBER-thin-content-gate.md:19-23`,
트리거 `trg_films_refresh_visible`). **⚠️ `hold`은 은닉 플래그가 아님** — 팩토리 "스텁 인제스트·미승격" 상태로 Tier-2 4,723/4,997에 걸림(§2.1 정정). 진짜 미해결 스텁만 `slug LIKE 'tmdb-%'`(현재 Tier-2에 0건). 편집적 은닉(22편)은 is_analyzed=true.

---

## §1. 작업 규칙·함정 (전 항목 공통 — 위반 시 장애)

| # | 규칙 | 근거 |
|---|---|---|
| R1 | **랭킹·정렬·필터·히스토그램은 raw u 유지.** 클램프는 표시/스키마 전용. `cinecodex_ranked` ORDER BY·rank·`cinecodex_histogram`·ScoreBrush 도메인 [-20,90]·`p_ts_min/max`·director 정렬(`app/director/[slug]/takescore/page.tsx:75-78`)·`lib/takescore-bulk.ts`·`/api/v1/*`·`/api/mcp` 페이로드 **불변** | 오너 결정 2 |
| R2 | **마이그레이션은 additive-only, 다음 번호 0097** (0096 2개 존재 — 충돌 함정). 프로덕션 적용은 **오너가 `apply-sql.py 절대경로` 직접 실행**. **배포 순서: 마이그 먼저 → 코드 머지** | 저장소 불변식 |
| R3 | **minimal 페이로드 shape 변경 시 캐시키 bump**: `"film-load7"`→`"film-load8"`(`app/film/[slug]/page.tsx:441`, 이력 주석 :437-440에 v8 줄 추가). (`film-chrome` bump은 scored_at 드롭으로 불필요) | ISR 캐시 트랩 |
| R4 | 자동배포 워처는 app/components/lib만 스테이징. 이번 작업은 전부 그 안(수동커밋 대상 없음). 단 **헬퍼+소비자는 같은 커밋**(중간상태 배포 방지), 새 CSS+페이지도 같은 커밋 | 워처 레이스 |
| R5 | 배포 직후 라이브 검증은 **캐시버스터 필수**(`?v=임의값`) — 구 ISR 캐시가 오진 유발 | live-audit 트랩 |
| R6 | `/methodology` 앵커 6종(#rankings 포함) 절대 보존. `pageRobots()`(`lib/seo.ts:17-20`)가 유일 robots 메커니즘 — 손으로 robots 객체 만들지 말 것 | 저장소 불변식 |
| R7 | PostgREST 1000행 캡: 벌크는 `fetchAll` 페이징 또는 jsonb_agg 단일행 RPC. `film_affinities`(~15만행)는 fetchAll 금지 → RPC로만 | 저장소 불변식 |
| R8 | 사이트맵 함수는 degrade-don't-crash(`lib/sitemap-data.ts:60-65`) 유지 — 신규 RPC 호출은 try/catch로 감싸 실패 시 기존 로스터로 폴백 | 설계 검증 |
| R9 | 완료 보고는 §6 체크리스트를 채워서. 항목 스킵 시 사유 명기 | 오너 요구 |

**권장 커밋 순서:** ① P2(TakeScore 표면, 마이그 무관 부분) → ② P3·P4(독립 항목들) → ③ 마이그 0097 오너 실행 → ④ P1(게이트·통합·사이트맵) + D3 datePublished.

---

## §2. P1 — CRITICAL: 통합 게이트 (얇은 영화 1,105편 승격 + 서브페이지 불변식)

**의도:** ①메인이 진짜 non-thin이 되고 ②새는 서브페이지(scaled-content 노출 ~6,786페이지)가 닫히고 ③"게이트 vs 우회"모순이 통합으로 풀리고 ④저명작(English Patient·13th)이 색인된다.

### 2.1 확정 게이트 (실측 근거 — 변경 금지)

```
Tier-1 (is_analyzed=true): 현행 유지 = 승인 figures ≥ 3 && visible !== false
Tier-2 (is_analyzed=false): [강신호 any] AND [베이스라인] AND [하드 제외 아님]
  강신호 any:  film_reception rows ≥ 3  OR  film_lineage rows ≥ 3  OR  film_wd_honors rows ≥ 3
  베이스라인:  film_provider_index rows ≥ 1
  하드 제외:   slug LIKE 'tmdb-%'  → 무조건 noindex   (미해결 스텁 가드; 현재 0건, 방어용)
```

> **⚠️ 정정(2026-07-14 프로덕션 검증): `hold`은 게이트 입력이 아니다.** `hold=true`는 팩토리의
> "스텁 인제스트됨·미승격" 플래그로 Tier-2 4,997편 중 **4,723편**(코호트 전체)에 걸려 있음 — 개별 은닉이 아님.
> 이걸 하드 제외하면 전 코호트가 탈락(21편만 생존). 실측: hold 제외 없이 강신호+가용성 = **정확히 1,105편**.
> 앱은 `films.hold`을 어디서도 읽지 않으므로(설계검증) robots 게이트는 순수 additive. 진짜 은닉 22편은
> is_analyzed=true라 애초에 Tier-2 후보풀 밖. 마이그 payload는 hold을 관측용으로 반환하되 **게이트는 무시**.

- 실측 결과(프로덕션 검증됨): Tier-2 **1,105편 통과**(색인 메인 1,959→~3,064). `the-english-patient-1996`(lineage 9, wd 30, hold=true) PASS · `13th-2016`(reception 5, hold=true) PASS · TMDB 셸(현재 0건)·신호빈약 영화 탈락.
- **순진한 K-of-N 금지**: score 94.5%·lineage≥1 94.2%·avail 80.7%로 준보편, kindred는 얇은 영화에서 구조적으로 0(affinity 원장이 분석작만 커버) → K=3이면 셸 3,753편 유입, K=4면 20편으로 붕괴. 실측이 이 형태를 강제했다.
- (F,T) 22편은 is_analyzed=true라 Tier-1 규칙(figures≥3)에 남아 계속 noindex — 부활 안 됨.
- `flagged`·`n_samples`는 게이트에 사용 금지(64% flagged, 전부 n=1 — 변별력 없음, 오너가 라벨 자체를 부정).

### 2.2 마이그레이션 0097 (owner-run, additive-only) — 파일 `supabase/migrations/0097_film_index_signals.sql`

1. **`public.film_index_signals_json()`** — SECURITY DEFINER, jsonb_agg 단일행 반환(전례 `geo_overview_json`):
   영화별 `{slug, visible, is_analyzed, hold, n_reception, n_lineage, n_wd_honors, n_affinities, n_providers, has_scores}`.
   - `n_affinities` 포함 이유: moviesLikeEntries 미러(§2.5)가 이것 없이는 불가능(R7).
   - `film_locations`는 anon RLS 0정책이라 게이트 신호로 쓰지 않는다(페이지·사이트맵 게이트 불일치 방지 — 설계 리스크 §4).
2. ~~`cinecodex_for`에 `scored_at` 추가~~ → **드롭(2026-07-14 결정)**. 핫 RPC(전 필름페이지 사용) 수정 위험을 피하려 0097은 신규 함수 1개만. 결과: 필름페이지 Review는 `datePublished` **생략**(스키마상 유효 — datePublished 없는 Review OK). takescore 페이지 Review는 자체 데이터로 datePublished 이미 보유. → CinecodexPanel Codex 타입/`film-chrome` 캐시키 **변경 불필요**.

### 2.3 게이트 헬퍼 (신규 코드)

| 위치 | 내용 |
|---|---|
| `lib/seo.ts` (pageRobots 아래) | **순수 함수** `filmIndexBar(s: FilmIndexSignals): boolean` — §2.1 로직 그대로. DB-free. 임계값은 export 상수로(코호트 릴리스 규율 `lib/seo.ts:30-42`가 관리 가능하게) |
| `lib/filmGate.ts` (신규) | ① `filmIndexSignalsRoster()` — RPC 호출을 `unstable_cache` 키 `["film-index-signals-1"]`(revalidate ~3600)로 감싼 벌크 로스터(사이트맵용). try/catch 폴백(R8). ② `filmMainIndexable(slug): Promise<boolean>` — 슬러그 단건, `unstable_cache` 키 `["film-gate1", slug]`(revalidate 300, tag \`film:${slug}\`). **서브페이지들이 이걸 호출하므로 각 서브페이지 페이로드/캐시키는 안 바뀐다** |

### 2.4 메인 페이지 (`app/film/[slug]/page.tsx`)

| # | 위치 | 수정 | 의도 |
|---|---|---|---|
| a | :174-176 films select | **변경 불필요** — `hold`은 게이트 입력 아님(§2.1 정정). 가시 게이트는 `slug`(이미 select됨)+RPC 신호 카운트로만 판정. films select 손대지 말 것 | hold 무관 |
| b | :552-572 minimal 메타데이터 분기 | `robots: pageRobots(false)` → `robots: pageRobots(filmIndexBar(signalsFrom(data, codex)))`. generateMetadata(:548)는 현재 load()만 호출 — `loadChrome(slug)`도 await(캐시돼 ~무료) | **핵심 스위치.** 얇은 분기 하드코딩 noindex 해제 |
| c | :575 `meetsBar` (Tier-1) | `filmIndexBar` 경유로 통일(결과 동일, 진실의 원천 1개) | 게이트 이원화 방지 |
| d | minimal 로더(:178-235) | full 분기 미러로 **film_reception rows**(:246-248과 동일 select) + **film_affinities top-5 + films 조인**(:240, :385-398 미러 — 관련작 `.eq("visible", true)` 유지) 추가. 반환 shape 변경 → **R3 bump film-load8** | 리셉션·킨드레드를 메인에 |
| e | minimal 렌더(:637-968) | **✅ 구현: ③ CinecodexPanel(:883)에 `subscores` prop 추가**(비용 0). **⏸ 지연분은 별도 정본으로 승격 → `HANDOFF-Tier2-메인통합.md`**(2026-07-15, 필름 C1~C5+감독 D1~D6 — 실측: 킨드레드는 affinities=0이라 불가, 대신 wd_honors·release_events·scholarship·스틸 패리티가 진짜 통합 대상). 근거: HEAD의 Tier-2 메인은 이미 TakeScore+to.W 편지+Lineage+RecommendedBy+Sentences+Credits+Availability+Stills+TV를 렌더해 **이미 non-thin**(원래 "얇은 링크허브"는 구 배포판). reception/kindred는 (a)`film-load7` 캐시키 전역 bump=churn 유발, (b)핫 1751줄 파일 인라인JSX 리팩터, (c)그 콘텐츠는 이제 **색인되는 서브페이지**(/reception·/movies-like)에 이미 존재. → 게이트+서브불변식으로 리스크 없이 목표 달성, reception/kindred 메인 통합은 후속. | Tier-2 메인 non-thin 확인·subscores로 13차원 완비 |
| f | :725-727 주석, :818 카피 | "Robots stay noindex…" 주석 갱신. `df-catnote` "deep analysis … is still pending" → 게이트 통과 페이지용 자신감 있는 문구로(예: "Catalog record — score, reception and honors below; the close reading is on its way.") | 페이지 스스로 얇다고 광고하지 않기 |

⚠️ 킨드레드는 얇은 영화에서 당분간 빈 섹션(affinity 원장 미구축 — 컴포넌트가 null 렌더하므로 무해). 원장 Tier-2 확장은 이 지시서 범위 밖(후속 로드맵).

### 2.5 서브페이지 불변식 — `서브 색인 ⇔ filmMainIndexable(slug) && 자체 기준`

| 라우트 | 현재 (검증됨) | 수정 |
|---|---|---|
| `app/takescore/film/[slug]/page.tsx` :110-134 | **robots 자체가 없음**(전 6,701 색인 — 최대 누수) | 반환 객체에 `robots: pageRobots(await filmMainIndexable(slug))` 추가 |
| `app/film/[slug]/reception/page.tsx` :229 | `pageRobots(items>=3)` — visible 미검사 | `pageRobots(mainBar && items>=3)` |
| `app/film/lineage/[slug]/page.tsx` :202 (+:33-34 주석) | `pageRobots(lineage>=3)`, "의도적으로 visible 무시" | `pageRobots(mainBar && lineage>=3)` + 주석 갱신. **구 결정("honors are facts") 공식 번복 — §7 결정로그 참조** |
| `app/film/[slug]/credits/page.tsx` :122 | `visible!==false && crew>=2` | `mainBar && crew>=2` |
| `app/film/locations/[slug]/page.tsx` :66,260 | visible=false면 404 | :66의 visible 검사 → mainBar (404 의미 유지) |
| `app/movies-like/[slug]/page.tsx` :95,101 | `film.visible && recs>=3` | `mainBar && recs>=3` |
| `app/film/[slug]/misreadings/page.tsx` :49,147 | visible 404 + `n>=5` | 404조건 mainBar + `pageRobots(mainBar && n>=5)` |
| `app/film/[slug]/figure/[figureSlug]/page.tsx` :216 | `takes>=3 && visible!==false` | `takes>=3 && mainBar` |
| `app/film/[slug]/q/[question-slug]/page.tsx` :35-55 | **robots 없음** | `robots: pageRobots(await filmMainIndexable(slug))` |
| `app/film/[slug]/[desk]/page.tsx` :80,195 + `/ko/page.tsx` :66,163 | visible 404 | 404조건 mainBar (desk-essay-6 키 bump 불필요 — 외부 헬퍼 사용 시) |
| `app/whereto/[slug]/page.tsx` :179 | `pageRobots(visible!==false)` | `pageRobots(mainBar)` |
| `app/film/[slug]/gallery/page.tsx` :62-64 | 항상 index:false,follow:false + canonical→film | **변경 없음**(이미 불변식 충족) |
| `app/tv/[slug]/page.tsx` :79-89 | robots 없음(색인) | **변경 없음 — 불변식 면제**(§7 결정로그: 유일한 진짜 watch page, 방송 영상 자체가 고유 콘텐츠, GSC 영상 수정의 중심) |

### 2.6 사이트맵 미러 (`lib/sitemap-data.ts`) — 전부 §2.3 벌크 로스터 경유

| 함수 | 현재 | 수정 |
|---|---|---|
| `filmEntries` :575-589 | `.eq("visible", true)`, 캡 없음 | visible=true 유지 + **게이트 통과 Tier-2를 신규 코호트 `INDEX_COHORT_FILMS_T2`로 추가**(lib/seo.ts 상수, 초기 300, oldest-first append-only, :30-42 릴리스 로그 규율 준수 — 1,105편 일괄 광고 금지) |
| `sitemapTakescoreFilms` :925-944 | cinecodex_ranked 전 채점작, 무캡·무필터 | :937 push 전에 게이트 로스터(Set)로 필터 + 코호트 캡 부여 |
| `filmReceptionEntries` :538-572 (+주석 :534-537) | 비가시 카탈로그 영화 허용 명시 | id/slug 집합을 게이트 로스터와 교집합(자체 기준 유지) + 주석 갱신 |
| `honorsEntries` :912-916 | 적격 목록 "ANY visibility" → slice(0,500) | slice **전에** 로스터 필터(캡 유지) |
| `moviesLikeEntries` :592-598 | visible 전체 — **페이지 bar와 모순(기지 결함)** | 로스터에서 `mainBar && n_affinities>=3`인 슬러그만 (RPC의 n_affinities 사용 — R7) |
| 기타(:494-511 misreadings, :518-532 credits, :171-232 essays/ko, :685-699 qa, :658-682 figures, :859-865 locations) | visible 기반 | "visible=색인" 가정을 로스터로 교체(게이트와 visible이 갈라진 순간부터 필요) |

### 2.7 릴리스·검증 시퀀스

1. 마이그 0097 오너 실행 → 2. 코드 머지 → 3. **robots는 통과 1,105편 전체 즉시 적용**(내부링크 통한 자연 발견), **사이트맵은 코호트 300부터**(주간 상향, 릴리스 로그 기록) → 4. §6 검증.
   GSC에서 "제출된 URL noindex" 경고 소멸 + takescore/reception noindex 전환 물결(수천 URL)은 **예상된 정상 현상** — 오너에게 사전 고지할 것.

---

## §3. P2 — HIGH: TakeScore 표면 (문구·클램프·스키마·중복제거)

### 3.1 (a) 자기부정 문구 제거 — "estimate/judgment" 프레이밍은 유지

| ID | 위치 | 수정 | 의도 |
|---|---|---|---|
| A1 | `lib/takescore_prose.ts:189-203` (confidenceSentence) | n_samples/flagged 분기 블록 전체 삭제, :187-188 "Confidence N — tier" 문장만 유지. 시그니처 단순화 시 유일 호출부 `app/takescore/film/[slug]/page.tsx:161` 갱신 | "n=1·unverified·flagged" 자기부정 제거 |
| A2 | `app/takescore/film/[slug]/page.tsx:346` | n_samples KV행 삭제 | 〃 |
| A3 | 〃 :347 | sd_v KV행 삭제(폴백 문자열이 "unmeasured (n=1)") | 〃 |
| A4 | 〃 :350 | flagged KV행 삭제 | 〃 |
| A5 | 〃 :353-356 | `, n=${rel.n_samples}` 토큰만 제거 — "AI-estimated (rubric …) — a judgment, not a fact." 유지 | 정직성 유지+자기부정 제거 |
| A6 | 〃 :335 | "Non-determinism, disclosed honestly" → "Measured against the fixed TakeScore rubric" | 점수를 불안정하다고 광고하지 않기 |
| A7 | `components/CinecodexPanel.tsx:236` | "— a single-pass model judgment" → "no written-criticism corpus yet on this film" | 〃 |
| A8 | 〃 :356-357 | n=·±sd 토큰 제거("judgment, not fact" 유지) | 〃 |
| A9 | `lib/pack.ts:113` | "⚠ low-confidence (single-panel) score" 삼항 삭제 (데이터 필드 `low_confidence` 자체는 유지 — `lib/apiv1.ts:43` 기계 데이터) | Download-for-AI 팩·MCP에도 동일 원칙 |
| A10 | `components/CodexExplorer.tsx` | **파일 삭제**(미마운트 dead code 확인됨 — /codex·/score는 308 스텁). 삭제로 alt 항목 IDX-4·클램프도 무의미화 | dead code에 남은 동일 문구 소탕 |
| A11 | `components/room/EvalCard.tsx:324-325, :246, :318-321` | **기본 판정: 제거**(프레이밍 오류는 비공개 /room에서도 오류). :324-325 문단 2개, :246 flagchip, :318-321 KV 삭제 | 일관성 (되돌리기 쉬움 — §7) |
| — | `lib/docs/content/reliability.ts:27` | **유지**("flagged and rescored … take the median" — 방법론 설명은 긍정 서술) | 오너 carve-out |

### 3.2 (b) 0 클램프 — 중앙 헬퍼 + 전 렌더 사이트 스윕 (R1 절대 준수)

**B0** `lib/cinecodex_dims.ts`에 추가(서버·클라 양쪽에서 이미 임포트되는 모듈):
```ts
/** Public display value of a TakeScore: raw U can be negative (216 films); the site
 *  floors it at 0 for display and schema. NEVER use for sorting/ranking/percentiles/histograms. */
export const displayTs = (u: number): number => Math.max(0, Math.round(u));
```
**B1** `lib/takescore_prose.ts:39` — `const U = Math.max(0, Math.round(u))` (verdict 프로즈 전 표면 일괄 해결).

**스윕(각각 `Math.round(*.u)` → `displayTs(...)`; current는 원 조사 인용 — 대조 후 수정):**

| ID | 위치 | 표면 |
|---|---|---|
| B2/B3 | `app/takescore/film/[slug]/page.tsx:114, :157` | 메타 title/OG · h1/ShareDock/Review ratingValue/산식 |
| B4/B5 | 〃 :244(도넛 val), :427(랭크 사다리) | 도넛 중앙 숫자·이웃 20행 (순서는 RPC — 불변) |
| B6 | `components/CinecodexPanel.tsx:273` | 필름 메인 큰 숫자 (:279 sharpe는 별도 지표 — 불변) |
| B7 | `app/film/[slug]/page.tsx:626` | 히어로 배지 — **`_cx.v - _cx.r` 인라인 계산** → `displayTs(_cx.v - _cx.r)` (:627 v/c/r 서브라인은 raw) |
| B8/B9/B10 | 〃 :737, :1022, :1218 | Tier-2/Tier-1 탭 배지·공유 hook |
| B11 | `components/screener/FilmCardPanel.tsx:109` | Screener+왓투와치 커튼 카드 |
| B12-14 | `components/screener/ScreenerExplorer.tsx:456, :468, :552` | 그리드행·커튼·검색히트 (**:422 ScoreBrush [-20,90]·:209/220 필터 불변 — R1**) |
| B15 | `components/marquee/MarqueeExplorer.tsx:404` | 왓투와치 칩 (rpcSort 'u' raw) |
| B16-19 | `components/home2/` ScreenerPromo:32,38 · FilmCard:46,48 · TodayExhibits:28 · EssentialTen:44,45,65 | 홈 칩 전체 |
| B20 | `app/search/page.tsx:84` | 검색 카드 조립부 (랭크 텍스트 불변) |
| B21/B22 | `app/movies-like/[slug]/page.tsx:141, :252` | Q&A 프로즈·추천 칩 |
| B23 | `components/read/TakeScoreBoxes.tsx:16` | 감독 허브 필모(:751)+감독/takescore 박스 일괄 |
| B24-26 | `app/director/[slug]/takescore/page.tsx:115-116, :130, :161-164` | 메타·프로즈·max/min/mean (**:75-78 정렬 raw — R1**; shape 비교 :127-129 raw) |
| B27 | `app/embed/takescore/[slug]/route.ts:32` | 임베드 배지 HTML |
| B28 | `app/api/v1/embed.js/route.ts:46` | 위젯 JS 문자열(임포트 불가 — `Math.max(0,Math.round())` 인라인). **API 자체는 raw 유지** |
| B29 | `app/takescore/film/[slug]/opengraph-image.tsx:18` | OG 이미지 숫자(페이지 h1과 동일해야) |
| B30 | `components/EmbedBuilder.tsx:59` | /embed 빌더 결과 |
| B31 | `components/room/*` (AuteursWorkspace:114,173,362 · PerformanceWorkspace:73,233,411 · EvalCard:254,287,375) | **기본 판정: raw 유지**(비공개 오너 계기판 — 음수가 정보값. §7) |
| B32 | `lib/pack.ts:112` | **클램프**(팩 텍스트는 사용자 노출 표시 표면; §7) |

### 3.3 (c) 클램프-0 설명 (오너: "0일 때만 설명")

| ID | 위치 | 수정 |
|---|---|---|
| C1 | `app/takescore/film/[slug]/page.tsx:253-255` 산식 문단 뒤 | `{card.u < 0 ? <p className="tsf-formula">The formula floors at zero for display: Value {v} minus weighted Risk lands below zero here, and the published score shows the floor. <Link href="/methodology#rankings">How rankings and scores work →</Link></p> : null}` — **게이트는 raw `card.u < 0`**(진짜 0점 영화 오발동 방지) |
| C2 | `components/CinecodexPanel.tsx:279` 행 뒤 (.ccx-gnet 내부) | 동일 취지 1줄 + `<a href="/methodology#rankings">Why →</a>` (서버 컴포넌트 — 기존 :324,369 관용구처럼 plain `<a>`) |

### 3.4 (d) Review 스키마 — 조직 저작 통일 + 완전화

| ID | 위치 | 수정 | 의도 |
|---|---|---|---|
| D1 | `app/takescore/film/[slug]/page.tsx:194` | `author: {"@type":"Person","name":"Wonwoo Yoon",…}` → `author: {"@type":"Organization","name":"Metatake","url":SITE}` (가시 바이라인 :447 "By Wonwoo Yoon, Editor"는 유지) | "1인이 6,700편 리뷰" 스키마 제거 — 오너 결정 3 |
| D2 | 〃 :177-198 | B3 후 `ts`는 항상 ≥0 → `ts >= 0` 게이트는 사실상 항상 참(216편이 ratingValue 0으로 Review 발행 — **가시 h1과 동일값이라 정합**). :177-180 낡은 주석("339 films … ship no Review")을 표시-플로어 설명으로 재작성 | 스키마=가시값 대응 규칙 |
| D3 | `app/film/[slug]/page.tsx:1109-1123` | ① `ratingValue: displayTs(subscores.takescore)` + 게이트 `codex && subscores`로 완화 ② `reviewBody: verdictShort(...)` 추가(§3.5 E1 — **페이지 가시 문장과 동일 텍스트**) ③ ~~datePublished~~ **생략**(§2.2-2 드롭 결정 — datePublished 없는 Review도 유효) ④ :1110-1115 낡은 주석 재작성 | 필름 페이지 Review 완전화(현재 author는 이미 Organization — 유지) |

### 3.5 (e) 크로스페이지 바이트 중복 제거

| ID | 위치 | 수정 |
|---|---|---|
| E1 | `lib/takescore_prose.ts:38-71` | `export function verdictShort(v,c,r,u,title?)` 신설 — quadrant 문장(:41-55)만 반환. `verdictSentence`가 이를 첫 문장으로 호출하게 리팩터(드리프트 불가 구조) |
| E2 | `components/CinecodexPanel.tsx:281` (+임포트 :9) | `verdictSentence(...)` → `verdictShort(...)` — 필름 메인은 요약, 전체 평결은 /takescore 전용 (FilmCardPanel:113 커튼은 full 유지 — 클라 온디맨드 패널, 크롤 중복 아님) |
| E3 | `components/screener/ScreenerExplorer.tsx:50` (+호출 :454,:545) | 취약한 `split(". ")[0]` 삭제 → verdictShort 임포트 (마침표 포함 여부 등 출력 차이는 무해) |
| E4 | `components/read/TowCard.tsx:39-66` | `variant?: "full"|"short"` + `slug?` prop — short는 kicker+rationale 첫 문장+`/takescore/film/${slug}#towc-h` 링크("Read the full letter…"), 서명행 유지, rec_date·towc-note 생략 |
| E5 | `app/film/[slug]/page.tsx:882, :1292` | 양 분기 `variant="short" slug={…}` 배선. `app/takescore/film/[slug]/page.tsx:260`은 full 유지 |

---

## §4. P3 — MEDIUM

### 4.1 이중 브랜드 제목 (루트 템플릿 `%s · Metatake`가 이중 브랜딩 — 라이브 검증됨)

**의도 공통:** SERP 제목이 "About — Metatake · Metatake"처럼 렌더 — 구글이 자주 재작성하고 제목 폭 낭비·엉성해 보임. **수정 패턴 2종:** ①브랜드가 본문에 불필요 → 접미 브랜드 삭제(템플릿이 붙임) ②브랜드가 제품명의 일부 → `title: { absolute: "…" }`.

| 파일:라인 | 현재 | 패턴 |
|---|---|---|
| `app/about/page.tsx:9` | "About — Metatake" | ① `"About"` |
| `app/contact/page.tsx:5` | "Contact — Metatake" | ① |
| `app/privacy/page.tsx:4` | "Privacy Policy — Metatake" | ① |
| `app/terms/page.tsx:4` | "Terms of Service — Metatake" | ① |
| `app/methodology/page.tsx:11` | "Methodology — Metatake" | ① |
| `app/guidelines/page.tsx:4` | "Community Guidelines — Metatake" | ① |
| `app/embed/page.tsx:8` | "Embed a TakeScore Badge — Metatake" | ① |
| `app/privacy/extension/page.tsx:7` | "…Metatake TakeScore Browser Extension" | ② absolute |
| `app/mcp/page.tsx:7` | "Metatake MCP — …" | ② |
| `app/api/page.tsx:7` | "Metatake API — …" | ② |
| `app/data/page.tsx:7` | "Metatake Data — …" | ② |
| `app/bot/page.tsx:7` | "MetatakeBot — Our Crawler" | ② |
| `app/manifesto/page.tsx:12` | "How Metatake reads — …" | ② |
| `app/my-films/page.tsx:10` | "My Films — see Metatake through…" | ② |
| `app/latest/page.tsx:10` | "Latest — what's newest across Metatake" | ② |
| `app/blog/page.tsx:19` | "Between Film and the World — Metatake's daily" | ② |
| `app/strong-misreadings/page.tsx:11` | "…the 14 ways Metatake reads a film" | ② |
| `app/locations/page.tsx:13` | 접미 `· Metatake` baked | 접미 삭제 or ② |
| `app/where-to-watch/page.tsx:12` | 〃 | 〃 |
| `app/editor/page.tsx:7` | "Wonwoo Yoon — Founder & Editor · Metatake" | 접미 삭제 (E-E-A-T 저자 페이지) |
| `app/search/page.tsx:309` | 양 분기 "… Metatake Search" | ② (양 분기) |
| `app/movements/[slug]/page.tsx:75` | 템플릿 리터럴 끝 `· Metatake` | 접미 삭제 — **색인 허브 전 클래스** |
| `app/tv/layout.tsx:4` · `app/tv/page.tsx:20` · `app/tv/lists/page.tsx:18` · `app/tv/fullscreen/page.tsx:9` | METATAKE TV 계열 | ② |
| 폴백들: `app/theorist/[slug]:155` · `concept/[slug]:204` · `tradition/[slug]:57` · `trope/[slug]:124` · `catalog/[seg]:22` · `catalog/[seg]/[slug]:110` · `blog/[slug]:38`("metatake" 소문자도 수정) · `strong-misreadings/[fw]:26` · `tv/[slug]:72` · `tv/list/[slug]:43` | "X — Metatake" 폴백 | ① + **`robots:{index:false}` 추가**(unknown-slug 브랜치) |
| noindex 코스메틱: `me/import:11` · `room/layout:10` · `room/film/[slug]:8` · `admin/layout:6` · `u/[username]:57` · `home2-app:14` | 〃 | ① (탭 제목 청결) |
| `app/takescore/film/[slug]/page.tsx:118` | `\| Metatake` 구분자 | `· Metatake`로 통일(전 사이트 규약) |
| `app/page.tsx:18` | "Metatake — a critical map of cinema" vs og "A Critical Map…" | 대소문자 통일(og와 일치) |
| `app/methodology/[slug]/page.tsx:38` · `app/poetics/[slug]/page.tsx:42` | twitter title이 og와 불일치 | og와 동일 문자열로 |

### 4.2 Genre 페이지 (라이브 검증: 전 장르가 루트 기본 설명 공유 + 소문자 제목)

| 위치 | 수정 | 의도 |
|---|---|---|
| `app/genre/page.tsx:7` | description 추가(실데이터: 장르 수·코퍼스 규모) | 홈페이지 스니펫이 /genre에 중복 노출 중 |
| `app/genre/[slug]/page.tsx:41` | ① Title-Case(예: "Drama Films — the canon, ranked") ② 페이지 본문이 이미 fetch하는 실데이터(편수·대표작 2-3)로 **장르별 고유 description** ③ 다른 허브들처럼 CollectionPage/ItemList JSON-LD | 가이드: "설명은 페이지마다 고유하게" — ~18페이지 전 클래스 결함 |

### 4.3 canonical 누락 + 메타데이터 0 페이지

| 위치 | 수정 |
|---|---|
| `app/frames/page.tsx:14` · `app/trending/page.tsx:25` · `app/blog/subscribe/page.tsx:5` | `alternates: { canonical: "/…" }` 추가 |
| `app/strong-misreadings/[fw]/page.tsx:24` ('all' 분기) | absolute 제목 + **description 추가**(현재 루트 기본 상속) |
| `app/lineage/page.tsx:47` | `keywords:[…]` 삭제(구글 2009년부터 무시 — 사이트 유일 사용처) |
| `app/login` · `signup` · `reset` · `settings` · `chat` · `ask-ai`(+new) | 클라 페이지라 메타데이터 0 — 홈 기본 title/desc 상속하며 색인 가능. **형제 layout.tsx로 `title` + `robots:{index:false,follow:true}`**(ask-ai는 robots.txt에서 이미 Disallow — 메타도 정합) |
| `app/tv/layout.tsx:7` | layout 레벨 `canonical:"/tv"`가 자식(tv/full)에 누수 — **canonical을 app/tv/page.tsx로 이동**, tv/full엔 noindex 메타 추가 |
| `app/whereto/[slug]/page.tsx:165` · `app/movements/[slug]/page.tsx:74` | "Not found" 폴백에 `robots:{index:false,follow:false}` 추가 |

### 4.4 이미지 alt 스윕 (라이브 실측: 홈 284/284·/takescore 59/59·왓투와치 40/40 빈 alt)

**의도:** 가이드 "좋은 alt는 상당히 중요" — 포스터·인물·스틸을 구글 이미지 검색 적격으로. **패턴:** 포스터 `` `${title}${year ? ` (${year})` : ""} poster` `` · 배경스틸 `— still` · 얼굴 `portrait`. **규칙: 데이터에 없는 장면 설명 발명 금지**(스틸은 TMDB file_path 문자열뿐 — 검증됨).

**FIX (파일:라인 → 사용할 필드):**

| 위치 | alt 재료 |
|---|---|
| `components/home2/FilmCard.tsx:28` | f.title, f.year — **홈 Picked/Canon/Rhyme 그리드 전체 커버(최대 레버리지)** |
| `components/home2/EssentialTen.tsx:33, :60` | :33 f.title+f.year · :60 f.title만(Top10Item에 year 없음 — 발명 금지) |
| `components/home2/Newly.tsx:32` | f.title, f.year — still |
| `components/home2/SurpriseStage.tsx:96` | card.film_title, card.film_year — still (홈 히어로) |
| `components/home2/ScreenerPromo.tsx:36` | f.title, f.year |
| `components/home2/AuteursRow.tsx:28` · `DirectorsBlock.tsx:36, :115` | p.name/d.name/dir.name portrait |
| `components/home2/ConceptsRail.tsx:28` | `${c.name} — illustrative film still`(원천 영화명 페이로드에 없음) |
| `components/home2/ReadingsDesk.tsx:35` | **lead.film**(lead.title은 리딩 헤드라인 — 오용 금지), lead.year |
| `components/home2/NewsletterCard.tsx:48` · `BlogGraph.tsx:62, :79` | film_title 옵셔널 — 없으면 "" 폴백 |
| `components/home2/LensRail.tsx:17` | f.title, f.year |
| `components/screener/ScreenerExplorer.tsx:440` | f.title, f.year — /takescore 그리드(빈 alt 59의 본체) |
| `components/screener/FilmCardPanel.tsx:84` | title(:76 계산됨), card?.year — 링크 접근성명도 함께 해결 |
| `components/marquee/MarqueeExplorer.tsx:397` | f.title, f.year — 왓투와치 40의 본체 |
| `components/marquee/AccessBadges.tsx:63` | `tier==="rent" ? r.name : ""`(rent만 로고가 유일 식별자) |
| `components/indexes/FilmsIndex.tsx:57` · `DirectorsIndex.tsx:58` · `IndexExplorer.tsx:150` | A–Z 인덱스(it.title/it.year·it.name·h.title+imgShape) |
| `components/read/DirectorPlates.tsx:116` | **현재 alt={director}가 오기술**(이미지는 films[0] 포스터) → `films[0].title (year) poster` 폴백 director |
| `components/curious/ui.tsx:90, :126` | film.title, film.year — still (DirectorPlates 그리드+전 /curious 인덱스 공유) |
| `components/StillHero.tsx:56` | `` `${label} — ${n+1} of ${imgs.length}` ``(label prop은 호출부가 항상 전달 — GSC 영상 스윕으로 전면 배포된 히어로, 전부 빈 alt) |
| `app/director/[slug]/page.tsx:744, :887, :1050` | 필모 포스터·Who's Next 인물·Where-to-Start 픽(nameless link도 해결) |
| `components/curious/DirectorsIndexClient.tsx:49` | d.name portrait |
| `components/TrendingSections.tsx:25, :62, :85` | c.f/c.y · t.f/t.y · f.t/f.y — still |
| `components/LatestMagazine.tsx:55, :68, :106` | c.f/c.y · f.title/f.y · dd.name |
| `components/ReadingsExplorer.tsx:108` · `DeskExplorer.tsx:103` | r/d.film_title, film_year — still |
| `components/InfiniteScrollFeed.tsx:210, :246` | item.film.title/year — still |
| `components/ReadingFeed.tsx:188, :251` | r.film, r.year — still |
| `components/MovementHubClient.tsx:19` | f.title, f.year |
| `components/TVChannel.tsx:57` · `MetatakeTV.tsx:260` · `TVProgramPlayer.tsx:155` | card.film_title/film_year · film.title/year |
| `components/RandomWall.tsx:58` | it.title (type==="film" 분기) |
| `app/film/[slug]/misreadings/page.tsx:247` 등 `${title} still` 계열 | 유지(연도만 추가 가능 — 장면 메타데이터 부재 검증됨) |

**KEEP-EMPTY (수정 금지 — 사유 명기됨):** SurpriseStage:170,281(같은 `<a>` 안 가시 텍스트 중복) · ScreenerExplorer:313(핀탭 버튼),:541(오토컴플리트) · ServicesPicker:98(필터칩) · director page:703,711(aria-hidden 콜라주) · MovementsIndexClient:27 · LineageTabsClient:19(제목이 페이로드에 없음+aria-hidden) · GalleryViewer:95(메인 피드가 이미 full alt) · TheoristDirectory:83 · ConceptDirectory:84(aria-hidden 일관 마크업) · ReadingLedger:43(prop 배관 없이는 재료 없음) · FilmTVHero.tsx·home2/Hero.tsx(미마운트 dead — 수정 대신 삭제 후보).

---

## §5. P4 — LOW

| ID | 위치 | 수정 | 의도 |
|---|---|---|---|
| L1 | `app/film/[slug]/figure/[figureSlug]/page.tsx:271-287, :294` | FAQPage JSON-LD 삭제(leadQuestion은 title/H2에 계속 사용 — 바인딩 유지). Article 노드(:242-252) 유지 | FAQ 리치결과는 2023-08부터 정부/의료 전용 — 상방 0, 대량 합성 Q&A는 스팸 냄새 |
| L2 | `app/catalog/[seg]/[slug]/page.tsx:232-240` | @graph 내 FAQPage 스프레드 삭제(DefinedTerm/CollectionPage/Breadcrumb/ItemList 유지) | 〃 |
| L3 | `app/trope/[slug]/page.tsx:225-239, :315` | faqLd 상수+스프레드 삭제(가시 QuickAnswers 유지). **`lib/seo.ts:90,95` 문서주석의 FAQPage 언급도 같은 커밋에 갱신** | 〃 |
| L4 | `app/film/[slug]/q/[question-slug]/page.tsx:164-196` | QAPage → **Article**(headline=질문, about Movie 유지, author Org + editor Person — read-layer 규약). isAI 바인딩은 가시 바이라인에도 쓰임 — 삭제 전 확인 | QAPage는 커뮤니티 포럼 의미 — 단일 편집 답변과 유형 불일치 |
| L5 | `app/blog/[slug]/page.tsx:61` | author Organization **유지** + `editor: Person "Wonwoo Yoon"(@id …/editor#person)` 추가. (검증: /blog는 조립형 데스크 — 바이라인 "The Metatake desk" — /now의 Person 저자 복사는 오귀속) | 저자 노드 일관성: 집필=/now Person · 조립=Org+editor |
| L6 | `app/now/[slug]/page.tsx:77` | `dateModified: p.updated_at` null 직렬화 가드(`...(p.updated_at ? {…} : {})`) + `...(p.image_path ? { image:[tmdbImg(p.image_path)] } : {})` 추가(tmdbImg :11 임포트됨). openGraph images도 권장 | image 없는 NewsArticle은 Top Stories 자격 상실·null dateModified는 무효 스키마 |
| L7 | `app/me/page.tsx:9` | `redirect` → `permanentRedirect`(308) | 영구 은퇴 경로는 신호 이전 |
| L8 | `components/read/ReadPlates.tsx:184-185` | 갤러리 플레이트 삭제(+:35 doc의 exclude 유니언, :9 미사용 임포트 정리) | 하드 noindex,nofollow 스텁으로 링크 equity 누수 — 컴포넌트 자체 계약(:29-31) 위반 |
| L9 | `app/tv/[slug]/page.tsx:129-131, :151` | `f?.clip` 없으면 **VideoObject 스크립트 자체를 미발행**(`{f?.clip ? <script…/> : null}`) — embedUrl=자기 URL 폴백이 GSC "not on a watch page" 패턴의 마지막 잔존 | 방금 끝낸 GSC 영상 수정의 재유입 차단 |
| L10 | 스트레이 파일 7개 삭제: `components/indexes/IndexExplorer 2.tsx` · `app/search/omni 2.css` · `app/now/page 2.tsx` · `app/api/page 2.tsx` · `app/api/v1/openapi 2.json` · `app/film/[slug]/reception/page 2.tsx` · `app/film/[slug]/figure/[figureSlug]/.fuse_hidden0000002f00000004` | `git rm`(파일명에 공백 — 따옴표 필수). 미임포트/비라우팅 검증됨 | tsc가 컴파일하는 dead copy — 감사·grep 오염, reception `page 2.tsx`는 자체 robots 로직 보유(드리프트 위험) |
| L11 | `app/film/[slug]/[desk]/page.tsx:187-192` · `…/ko/page.tsx:157-160` | 양쪽 languages 맵에 `"x-default": <EN url>` 추가(양측 동일 세트 — 아니면 클러스터 무시됨) | hreflang 완전화 |
| L12 | KO lang 속성 | **NO-OP 검증됨** — `ko/page.tsx:183`이 이미 `lang="ko"` 래퍼. 작업 불필요 | 기록용 |
| L13 | `lib/sitemap-data.ts` + `app/sitemap.xml/route.ts:10-52` | `traditionEntries()` 신설(`theory_schools_index` RPC, films>0 미러 — movementEntries :239-248 모델) + `app/sitemaps/traditions.xml/route.ts` + SECTIONS 등록 | /tradition/[slug]는 색인 가능·허브 연결인데 사이트맵 0 — GSC 보고 불가 |
| L14 | `lib/sitemap-data.ts:250-261` | dead `tvProgramEntries` 삭제(비디오 변형 `tvProgramVideoEntries`만 배선됨 — 검증) | 이중 광고 회귀 방지 |
| L15 | `lib/related.ts:587, :588-590, :599-602`(relatedForFigure) | figure 푸터 이중스택 해소: ReadPlates가 이미 커버하는 'Watch {film}'·'Questions' 섹션 삭제, 'More from {director}' 삭제 또는 캡 3(~57→~44링크, 중복 0). relatedForFigure는 figure 페이지 전용(grep 검증) — 파급 없음 | 링크 스터핑 완화 — 목적지당 1모듈 1링크 |
| L16 | `lib/related.ts:796-818`(relatedForQuestion) — :812-815 'Watch' 삭제·:799 질문 캡 3·:801-803 감독 삭제 | 〃 (~51→~35링크). q 페이지 전용 — 파급 없음 | 〃 |

---

## §6. 검증 체크리스트 (작업자가 채워서 보고)

**빌드/정적:**
- [ ] `tsc` 클린 + 프로덕션 빌드 통과 (⚠️ node는 `~/.local/node/bin`, 클린 `.next`)
- [ ] `displayTs` 소비처에서 정렬·필터·히스토그램에 쓰인 곳 0건 재-grep (R1)
- [ ] 삭제 파일 7개 + CodexExplorer + FilmTVHero/Hero 처리 후 미사용 임포트 0

**배포 후 라이브(캐시버스터 필수 — R5):**
- [ ] `curl -A Googlebot 'https://metatake.net/film/the-english-patient-1996?v=N'` → robots 메타 **없음**(색인) + 리셉션/킨드레드/TakeScore 섹션 렌더
- [ ] 통과 못한 TMDB 셸 1편 → 여전히 `noindex`
- [ ] `takescore/film/{얇은-미통과-슬러그}` → `noindex` / `takescore/film/2001-a-space-odyssey-1968` → 색인 + Review author=Organization + ratingValue=가시 h1과 동일
- [ ] u<0 영화(예: DB에서 1편 추출) → 표시 0 + C1 설명문 + Review ratingValue 0
- [ ] `/about` 등 §4.1 표본 5개 → `<title>`에 "Metatake" 1회만
- [ ] `/genre/drama` → Title-Case 제목 + 고유 description
- [ ] 홈 `<img>` 빈 alt 급감(284→소수 keep-empty만), `/takescore`·`/what-to-watch` 동일
- [ ] figure 페이지 소스에 FAQPage 0건 · q 페이지 QAPage→Article
- [ ] `sitemap.xml`에 traditions.xml 등장 · movies-like.xml 엔트리 수 급감(≈affinity≥3 영화 수)
- [ ] `/me` → 308

**GSC(오너 고지 사항):**
- [ ] "제출된 URL이 noindex" (movies-like) 경고 소멸 추세
- [ ] takescore/reception 구 URL noindex 전환 물결 = **예상된 정상**
- [ ] 신규 색인 요청: /film Tier-2 승격 코호트 · traditions

---

## §7. 결정 로그 + 기본 판정(오너 승인 전제·되돌리기 쉬움)

| 결정 | 내용 |
|---|---|
| 게이트 형태 | 실측상 K-of-N 퇴화 → **강신호 any + 가용성 베이스라인**(§2.1). **⚠️ hold 하드제외는 오류였음(전 코호트 탈락→21편)** — 프로덕션 재검증으로 정정, hold 무시가 정답(=1,105편). 볼륨 조정 필요시 대안 실측치: +u≥0 조건 1,129 / wd 프롱 제거 366 |
| `/film/lineage`·reception 사이트맵의 "honors are facts" 구 결정 | **공식 번복**(2026-07-14 오너 통합 결정에 흡수) — 게이트 통과 영화는 유지, 미통과는 noindex |
| `/tv/[slug]` | 불변식 **면제**(유일한 진짜 watch page — 방송 자체가 고유 콘텐츠, GSC 영상 수정의 축) |
| A11 (room 문구) | **제거**(잘못된 프레이밍은 비공개에서도 오류) |
| B31 (room 숫자) | **raw 유지**(오너 계기판 — 음수가 정보값) |
| B32 (pack 점수) | **클램프**(사용자 노출 표시 표면 — API raw는 유지) |
| blog 저자 | Organization 유지 + editor Person 추가(조립형 검증됨 — Person 승격은 오너만 결정) |
| CodexExplorer.tsx | 삭제(dead code 검증) |
| 신규 Tier-2 사이트맵 릴리스 | 코호트 300 시작, 주간 상향, `lib/seo.ts` 릴리스 로그 규율(:30-42) 준수 — 1,105 일괄 광고 금지 |

**부속 데이터:** 게이트 실측 SQL 결과·185항목 원본 JSON은 세션 산출물(워크플로 wf_ac8b2232) — 수치 재검증 필요시 §2.1 쿼리를 kyniq에 재실행.
