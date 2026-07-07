# HANDOFF — My Room v3 Redesign (FINAL SPEC / 단일 정본)

> **상태:** 확정 스펙 (2026-07-07). 3개 경쟁 설계("terminal" / "journeys" / "depth") + 3인 심사 합의의 최종 합성본.
> **합의 승자 = "terminal" (The Terminal 컨셉, 심사 2/3).** 이 문서가 구현의 단일 진실이다. 설계 원문·심사문은 참조하지 말 것 — 충돌 시 이 문서가 이긴다.
>
> **불변식 (모든 화면 공통, 위반 = 리뷰 리젝):**
> 1. **Never-blend** — 내 ★ / Cinecodex V·C·R·U / 외부지표(IMDb·RT·Meta) / Standing(정전가)은 절대 한 숫자로 섞지 않는다. 시각적으로도 그룹 분리.
> 2. **No fake numbers** — 데이터 없으면 숫자 대신 정직한 문장. 이유 칩은 서버가 준 것만 렌더.
> 3. **NAV 단조성** — "NAV never falls. Watching adds; low ratings never subtract." (이 문구 그대로, Performance 푸터에 상시.)
> 4. `--risk` ≠ `--red` (Letdown/Risk 칩은 `--risk`).
> 5. **공개 페이지 개인화 누출 금지** — /room 밖(서버 HTML)에 개인 데이터가 새지 않는다 (My Films 렌즈 불변식 유지).
> 6. **1000-row cap** — 모든 대형 리스트 RPC는 `.range()` 청크 루프 또는 jsonb 단일행 래퍼. 미적용 화면은 출시 금지 (launch gate).
> 7. **Redirect는 page-stub `redirect()`만** — next.config/middleware 금지 (auto-deploy watcher는 app/components/lib만 스테이징).

---

## 1. 개요 / 컨셉

**My Room = The Terminal: 당신의 영화 인생을 위한 Bloomberg.**

모든 화면은 단일 목적의 *instrument*(계기)다 — Desk, Screener, Slate, Ledger, Holdings, Performance… 각 화면은 딱 하나의 일을 최대 깊이로 한다. 금융 은유(film=asset, watchlist=pipeline, NAV, coverage)는 이미 제품의 DNA이므로 v3는 그것을 숨기지 않고 전면화한다: **전체 영어화**, 대시보드 압축 대신 계기 분리, 모든 숫자는 클릭하면 설명되고, 어떤 숫자도 지어내지 않는다.

**심사 합의에 따른 백본 + 이식(graft) 결정:**

| 결정 | 출처 | 근거 |
|---|---|---|
| 백본 = terminal의 3그룹 계기 분리(Screener/Pipeline 분할, Ledger=평점 기록부, Performance/Coverage 독립) | terminal | 심사 1·2 승자. 발견(discovery)과 커밋(commitment)의 분리가 유일하게 현 UI의 실제 혼동을 고침 |
| **Pipeline → "Slate"로 개명** | depth 이식 (심사 1·2 권고) | 금융 전문용어 밀도 완화. "producer's slate"는 시네필 네이티브, "watchlist"를 찾는 사용자도 도달 가능 |
| **Counterpart → "Masquerade"로 개명, 레일에 유지** | journeys 이식 (심사 3인 전원) | 공개 기능 Counterpoints와의 어근 충돌 제거. 기능 자체의 카피(가면무도회)가 최고의 이름 |
| **Lens 화면 신설** (depth의 Prism+Reading Room을 하나로, 이름은 legible하게) | depth 이식 (심사 0·1·2 전원) | 0042 lens 계열 + readings_mine의 유일한 전체 화면. "본 만큼 열리는 비평" = 최고의 복리 리텐션 아이디어 |
| `<FormingCard need/have>` 공용 컴포넌트 | journeys 이식 (심사 3인 전원) | 14개 계기의 콜드스타트를 한 컴포넌트·한 목소리로. Wave 1 필수 |
| Desk에 "Open jobs" 타일 행 (me_pair_state 티저 포함) | journeys 이식 (심사 1·2) | 신설 계기들로 들어가는 문. 홈에서 안전한 데일리 소셜 훅 |
| 이유 칩 = 하이퍼링크 (gap→Coverage, conquer→Coverage, frontier→Screener 필터 등) | journeys 이식 (심사 0·1) | 분류 체계가 스스로를 가르침. 제로 코스트 온보딩 |
| 단일 Toast provider + Undo 슬롯 | journeys 이식 (심사 1·2) | 중복 토스트 3벌 제거 + dismiss 즉시 복구 |
| `lib/room/loadCollection.ts` 공용 페이지드 로더 | depth 이식 (심사 2) | ".range 루프 재사용"의 강제 가능한 형태 |
| Holdings 테이블: 컬럼 토글 localStorage + 페이지 오프셋 URL query | depth 이식 (심사 1·2) | 뒤로가기 안전한 테이블 |
| 4-wave 출시 시퀀스 | depth 이식 (심사 1·2) | 각 wave 독립 배포 가능, 신규 RPC 무의존 |
| **/me/import는 URL 유지** (터미널의 /room/import 이전안 폐기) | journeys/depth 이식 (심사 2) | 라이트 스킨 위저드를 다크 셸로 재이식하는 건 비용 대비 무가치. 백링크 href만 /room으로 수정 |
| Atlas 블라인드 대륙 → country_continents 국가 목록 + 공개 national lineage 딥링크 | depth 이식 (심사 1) | 신규 RPC 없이 gap→door |
| TakeScore Explorer = Lens 내부의 v2 모듈 (축소판) | depth 이식 (심사 2) | 시스템 최심 쿼리에 UI를. 단 13-필터 풀패널이 아닌 λ+연도 슬라이더부터 |
| 앱바 NAV 칩 = 30일 마이크로 스파크라인 + 클릭 시 인스펙터 | terminal 유지 (심사 0 지지) | 복리 숫자를 모든 화면의 크롬에 |
| SessionStore (낙관적 상태 라우트 간 공유 + λ별 결과 캐시) | terminal 유지 (심사 0·2 지지) | 부활 버그 수정 + WWI 재스캔 방지 |
| Screener "Passed on this session" 스트립 + Restore | terminal 유지 (심사 0 지지) | RPC 없이 세션 수준 후회 처리 |
| Find / Aligned / Letdown 판정 칩 어휘 (+12/−9 gloss) | terminal 유지 (심사 0 지지) | 평가 습관의 정체성 보상 |
| Performance에 tier 돌파 milestone log (nav_history 클라 계산) | terminal 유지 (심사 0 지지) | 복리의 의례화 |
| /room/film/[slug] 화면 타이틀 = "Appraisal" | depth 이식 (심사 1) | 필름 카드에도 계기 이름을 |

**심사가 지적한 리스크의 해소 (전부 본문에 반영):**
- **Lens API 경로 오기술** (terminal 원안): 실제 표면은 `/api/lens/entities?kind=tropes|concepts|theorists|traditions|directors` + `/api/lens/readings` + `/api/lens/takescore`. per-entity 라우트(`/api/lens/theorists` 등)는 존재하지 않음. `*_mine` RPC는 service-role + `p_user` — **클라이언트 호출 가능한 변형을 절대 만들지 말 것**, 세션 검증 라우트 경유, `Cache-Control: private, no-store` 유지. → §3.12
- **Coverage "Fill this gap" 모호성**: WWI 행에는 lineage id가 없어 정밀 매칭 불가 → 정직한 no-candidate 폴백(`/lineage/[slug]` 링크)으로 출시, `me_lineage_candidates`(§8-R4)를 우선 RPC로 승격.
- **Shelf 포스터 임시안 폐기**: Holdings 페이로드 조인은 Shelf 페이지에 풀 컬렉션 페치를 강요 + 본 영화만 커버 → **`me_library` v2 마이그레이션(§8-R3)으로 직행**. 마이그레이션 전엔 포스터 없이 칩 카드로 출시 (정직).
- **Undo-dismiss 시맨틱**: 세션 내 Restore = `me_set_watchlist(slug,true)` 후 즉시 `me_set_watchlist(slug,false)` (dismissed는 서버에서 해제되고 keep 상태는 원복). 이 2-call 시퀀스를 `useRoomActions.doRestore`로 캡슐화하고 주석으로 문서화. 히스토리 전체 복구는 §8-R1 `me_dismissed` 이후.
- **me_pair_state 부작용 미검증**: Desk 티저 출시 전 해당 RPC가 daily match write를 트리거하지 않음을 마이그레이션 SQL에서 확인. 확인 불가 시 티저는 숫자 없는 링크 타일로 강등.
- **Readings 코퍼스 밀도** (memory: reading 허브 0출판, trope_readings 호출 금지): Lens의 Readings 탭은 `/api/lens/readings`만 사용(trope_readings 절대 금지), 출시 전 본인 계정 + 표본 계정으로 median readings-per-user 확인. 얇으면 탭은 유지하되 빈 상태 카피가 전면 (정직한 빈 방 > 없는 방).
- **콜드스타트 안무**: 14개 계기 = 14개 잠긴 문 리스크 → FormingCard가 Wave 1에 선행. 모든 게이트는 해금 숫자를 명시하고 Ledger/Import로 링크.
- **Ledger 이름 모호성** (심사 0): NAV 칩/스파크라인은 **항상 Performance로만** 링크. Ledger로 링크 금지.

---

## 2. Final English Menu Taxonomy

레일 3그룹, 14항목. 전 항목 영어 1~2단어, 부제 불요. Tabler 아이콘 (`ti ti-*`).

### SESSION — the daily loop
| # | Name | Icon | Route | Job |
|---|---|---|---|---|
| 1 | **Desk** | `ti-sun` | `/room` | 3초 데일리 루프: log → tonight's pick → NAV 한 줄 + open jobs |
| 2 | **Screener** | `ti-target-arrow` | `/room/screener` | 추천 엔진의 조종석: λ 다이얼, 이유 필터, 점수 분해. 순수 발견 |
| 3 | **Slate** | `ti-stack-2` | `/room/slate` | 진짜 워치리스트(kept films): aging, 전환, release |
| 4 | **Ledger** | `ti-star` | `/room/ledger` | 평점 기록부: 히트맵, 히스토그램, 전체 히스토리, 인라인 재평가 |
| 5 | **Masquerade** | `ti-masks-theater` | `/room/masquerade` | 하루 한 명의 가면 쓴 취향 상대. 데일리 리추얼 |

### PORTFOLIO — what you hold
| # | Name | Icon | Route | Job |
|---|---|---|---|---|
| 6 | **Holdings** | `ti-list-details` | `/room/holdings` | 본 영화 전부를 포지션으로: 20컬럼 풀 테이블, Find/Letdown, contrarian |
| 7 | **Performance** | `ti-chart-line` | `/room/performance` | NAV 곡선, tier 사다리, 시장 대비 알파, NAV movers |
| 8 | **Coverage** | `ti-chart-arcs` | `/room/coverage` | 계보 정복 지도 + blind spots (me_blindspots 데뷔) |
| 9 | **Auteurs** | `ti-crown` | `/room/auteurs` | 감독별 oeuvre 완성도 + 다음 정복 후보 (액션 장착) |
| 10 | **Atlas** | `ti-map-2` | `/room/atlas` | 개인 세계지도: filmed/setting 레이어, 블라인드 대륙 |

### RESEARCH — who you are
| # | Name | Icon | Route | Job |
|---|---|---|---|---|
| 11 | **Signature** | `ti-fingerprint` | `/room/signature` | 취향 벡터 해독: 앵커, 피겨, 리스크 평면, kindred |
| 12 | **Lens** | `ti-telescope` | `/room/lens` | 이론 렌즈로 굴절된 내 컬렉션: tropes/concepts/theorists/traditions + 내 영화의 published readings |
| 13 | **Shelf** | `ti-books` | `/room/shelf` | 핀 아카이브: 영화·트로프·미스리딩·피겨 |
| 14 | **Takes** | `ti-feather` | `/room/takes` | 내 해석 쓰기·관리 — 최강의 취향 신호 |

레일 밖: `/room/film/[slug]` = **Appraisal** (필름 평가 카드, 인스펙터에서 진입), `/u/me` (아바타), `/me/import` (레일 푸터 `ti-download` "Import" 링크 + 빈 상태들).

**Naming rationale (요약):**
- **Desk** — 트레이딩 데스크. 기존 `/room/desk` 선례. "앉으면 세션 시작."
- **Screener** — 금융의 보편적 필터링 발견 도구 명칭이자 영화 단어(screening). `me_recommend_wwi`가 하는 일 그 자체.
- **Slate** — producer's slate / clapper slate. "what's on the slate tonight"는 시네필 관용구. Screener(후보)와 Slate(커밋)의 분리가 이 IA의 핵심 수술.
- **Ledger** — 기입(entries)의 장부. 평점 = entries. 심사 1: "a ledger holds entries — correct semantics."
- **Masquerade** — 기능 자체 카피(가면무도회)의 직역. Counterpoints 충돌 제거. 레일에 보임(스피크이지 금지 — 심사 0).
- **Holdings / Performance / Coverage** — 포트폴리오 앱의 표준 3분할. Coverage는 엔진 자신의 용어(`me_coverage`)와 수렴.
- **Auteurs / Atlas** — 시네필 네이티브 + 공개 사이트 어휘(`/atlas`)와 운율.
- **Signature** — 기존 내부 용어(취향 시그니처)의 영어.
- **Lens** — depth의 "Prism"은 레일에서 해독 불가(심사 0·1·2 공통 지적) → 공개 사이트의 lens 계열 API·개념과 일치하는 legible한 이름으로 확정.
- **Shelf** — 공개 nav "Your Shelf"의 계승. /me 통합이 "선반이 방으로 이사"로 읽힘.
- **Takes** — 브랜드 엔티티("Not reviews. Not ratings. Readings."). 활동이 아닌 산출물의 이름.

---

## 3. Per-Menu Build Spec

**전 화면 공통 규약 (한 번만 기술):**
- `lib/room/format.ts`가 `num()`, `IMG` 베이스, `tierOf()`, `REASON_MAP`, `FACET_LABEL` 단일 소스 (기존 ×4~8 중복 제거).
- 이유 칩 정본 번역 + **딥링크**: `safe`→**Safe asset**(링크 없음) · `reading`→**Your lens**(→`/room/signature`) · `canon`→**Canon standing**(→`/room/performance`) · `gap`→**Fills a gap**(→`/room/coverage`) · `frontier`→**Safe frontier**(→`/room/screener?reason=frontier`) · `conquer`→**Conquest**(→`/room/coverage`). 가용 dot 라벨: **Streaming now**.
- 대형 리스트 RPC는 전부 `loadCollection.ts` 또는 `.range()` 페이징.
- 모든 라우트에 `loading.tsx` 스켈레톤 (`.mod` 고스트) — 신규 라우트는 같은 PR에서.
- 모든 빈 상태는 `<FormingCard>` 또는 영어 정직 카피 + 해금 숫자 + Ledger/Import 링크.
- 모든 mutation은 `useRoomActions` (낙관적, SessionStore 기록), 리스트 행은 포커스 가능한 실제 요소, 인스펙터는 `useInspector` 계약 유지.

### 3.1 Desk — `/room`

**Job:** 3초 계약을 진짜 3초로. 데스크톱 1 스크린 높이, 스크롤 없음.

레이아웃 (단일 중앙 컬럼 `.v2wrap`, 5 밴드):
1. **Log bar** — `QuickRate`. Placeholder: "Search the film you just watched — one star-tap logs it." 아래 세션 라인: `me_rate_stats`의 `session_new`/`forming`/`loved_target` 렌더 — "3 ratings today · 2 more loved films to unlock Masquerade".
2. **Tonight hero** — `me_recommend_wwi(p_lambda:1.0, p_limit:24)`. 회전 커서는 `localStorage("mt_tonight")`에 날짜 키로 영속(새로고침 리셋 버그 수정). 표시: 포스터·타이틀/연도/감독·이유 칩 ≤2·**Fit**(wwi)·`delta≥2`일 때 **+N NAV** 칩·provider dot. 액션: **Keep · Seen · Another**. 클릭 → `RecInsp`.
3. **Session tape** — 가로 1밴드: 최근 관람 포스터 스트립(`me_recent_ratings(12)`, ★ + loved(≥4.5) 플레임 + hover 시 날짜 — 페치되고 안 쓰이던 필드 렌더).
4. **NAV line** — `me_portfolio_nav` 한 줄 + `me_nav_history(90)` 90일 스파크라인 (인라인 SVG). 클릭 → Performance-summary 인스펙터 (조성 + 단조성 문구). 링크는 **Performance로만**.
5. **Open jobs** 행 *(journeys 이식)* — 4개 원라인 링크 타일: ① nearest conquest (`me_coverage(5,300)` remaining asc 1위: "3 films from finishing Cannes Palme → Coverage") ② top blind spot (`me_blindspots(1)`: "Italian Neorealism: untouched → Coverage") ③ Masquerade 티저 (`me_pair_state` — **출시 전 write 부작용 없음 확인**, 실패 시 숫자 없는 링크로 강등: "A masked partner may be waiting → Masquerade") ④ "Full screener →". 타일 = 링크, 뒤에 모듈 없음.

**RPCs:** `me_rate_stats`, `me_recommend_wwi(1.0,24)`, `me_recent_ratings(12)`, `me_portfolio_nav`, `me_nav_history(90)`, `me_pair_state`(검증 후). `me_coverage`/`me_blindspots`는 타일용 최소 파라미터.
**Empty:** `<FormingCard need={3} have={n} unit="films rated ★3.5+">` — "No log yet — tap a star above to open your position. Recommendations unlock at 3 films rated ★3.5+." + "…or import your Letterboxd history →" (`/me/import`).
**Responsive:** 밴드 세로 스택, Open jobs 타일 2×2.

### 3.2 Screener — `/room/screener`

**Job:** 추천 엔진을 진짜 screener로. 순수 발견 — kept 필름은 이 화면에서 완전 제거(→ Slate).

레이아웃: control bar → results table → (inspector).
1. **Control bar:** 텍스트 검색 · **λ risk-appetite 세그먼트** `Cautious 1.4 / Balanced 1.0 / Bold 0.6` (클라 재호출 `me_recommend_wwi(p_lambda, p_limit:60)`; 0029에서 존재, UI 최초) · 이유 칩 멀티 토글 (6 정본 코드; 데이터에 있는 칩만 렌더) · **Streaming now** 토글 (`avail.state==='on'`) · **Hide high risk** 토글 (R≥26).
2. **Results table** — `FilmRow` 확장 변형: 기본 = 숫자 1개(Fit; 행당 숫자 예산 유지). 행별 `›` expander → 구성 바 4개: `u_util / t_taste / s_standing / conf` 라벨드 미니바 + `+N NAV` delta. WWI = confidence × (0.45·utility + 0.35·taste + 0.20·standing)를 실수치로 보여줌 (페이로드에 이미 있고 버려지던 5개 서브스코어).
3. **Sort:** Fit(서버 순서, 기본 — trust-the-server) · NAV impact(delta desc) · Taste(sim) · Standing. 클라 정렬, "re-sorted client-side" 라벨.
4. **Passed on 푸터 스트립** — "You've passed on N films this session · review" → 세션 내 dismiss 목록 + **Restore** (`useRoomActions.doRestore` = `me_set_watchlist(slug,true)` → `me_set_watchlist(slug,false)`; dismissed 해제, keep 원복). 히스토리 전체는 §8-R1 이후.

**λ 캐시:** SessionStore에 λ별 결과 캐시 (세그먼트 3개 이산값, 클릭당 풀 벡터 스캔 방지).
**RPC:** `me_recommend_wwi`만.
**Empty:** "The screener needs a sample of your taste — rate 3 films ★3.5+ and candidates appear with reasons." (FormingCard).
**첫 릴리스 배너:** "Looking for your kept films? They moved to Slate →".
**Responsive:** expander 바는 640px 이하에서 2×2 그리드.

### 3.3 Slate — `/room/slate` (신설 화면, 기존 RPC)

**Job:** 진짜 워치리스트 — `me_watchlist_scored`의 /room 데뷔. 커밋의 decay를 다루는 유일한 화면.

1. **Header stats:** count · oldest age · streaming-now count(§8-R6 전에는 미표기).
2. **Deal-flow table** — `me_watchlist_scored()` `.range()` 페이징: 포스터 · 타이틀 · **V/C/R 마이크로바**(반환되나 미렌더였음) · added 날짜 · **Age badge** (클라: `Fresh <30d / Aging 30–90d / Stale >90d` amber).
3. **Sort:** Added(기본) · Utility(V−R) · Age. Filter: 텍스트, stale-only.
4. **Row actions** (hover `.fact`): **Seen**(`me_mark_seen`) · **Rate**(`Stars`→`rate_film`) · **Release**(`me_set_watchlist(p_on:false)`).
5. **Streaming rollup rail** (≥1180px 우측, 이하 하단): §8-R6(`me_watchlist_avail`) 전에는 정직 플레이스홀더 "Availability not yet wired to the slate (≠ unavailable)." 코어 화면은 이것 없이 동작.

**Empty:** "Your slate is empty — Keep films from the Screener and they queue here."

### 3.4 Ledger — `/room/ledger`

**Job:** 완전한 기록부. 40행 티저가 아님.

1. **Log bar** — 동일 `QuickRate` (Desk와 동일 mutation 계약).
2. **Ledger stats row** — `me_rate_stats`: rated / loved / today / **forming meter** ("Loved 5 of 8 — 3 more unlock Masquerade") — FormingCard 인라인 변형.
3. **Activity heatmap** — GitHub식 연간 그리드, `loadCollection()`의 `added_at`으로 클라 계산. 셀 클릭 → 그 주로 리스트 필터. 연도 스위처.
4. **Entries** — 전체 히스토리: `me_collection` `added_at desc`, 50/page, 행 = 포스터 · 타이틀 · **인라인 `Stars`**(즉시 재평가, 인스펙터 불요) · 날짜 · loved 플레임. 필터: 텍스트, ★범위, loved-only, 연도.
5. **Rating histogram** 사이드 패널 — 0.5–5 분포 + 평균 (클라 계산) + 정직 각주 "Your ratings never touch NAV."
6. **Similar-texture strip** — ★4+ 재평가 후 `me_taste_neighbors(4)` 등장, 각 행에 **Keep**.

**Empty:** "No entries yet — find a film above and tap a star. Rating implies seen."
**Responsive:** 히스토그램 패널은 900px 이하에서 리스트 아래로.

### 3.5 Holdings — `/room/holdings`

**Job:** 본 영화 전부를 포지션으로. `me_collection` 20컬럼의 유일한 완전 표면.

1. **Toolbar:** 검색 · sort (**Recent / My ★ / Standing / Contrarian**) · `facets[]` 칩(canon/award/national/auteur — 페치되고 안 보이던 필드) · decade select(클라, `year`) · **Finds only** 토글.
2. **Positions table** (50/page): 포스터 · 타이틀/연도/감독 · **Standing**(prestige, mono) · **My ★**(인라인 `Stars`) · **Verdict chip** — 클라: `rating×20 − prestige` → ≥+12 **Find**(teal) / ≤−9 **Letdown**(`--risk`) / else **Aligned**(muted). 임계값은 `.gloss` 툴팁으로 공식 공개.
3. **Contrarian sort** = `|rating×20 − v|` desc — "your boldest calls vs the codex."
4. **Row → `RecInsp`**: 행 데이터의 `imdb/rt/meta/votes/conf/tier/discovery`로 `CinecodexCard` 트립틱 완전 채움 (추가 RPC 없음).
5. **Position summary strip:** count · rated · finds · letdowns · avg ★ (mono 한 줄).
6. *(depth 이식)* **컬럼셋 토글 칩은 localStorage 영속, 페이지 오프셋은 URL query** (`?p=3`) — 뒤로가기 안전.

**RPC:** `loadCollection()` (`.range()` 청크).
**Empty:** "No holdings — mark films Seen and they appear as positions." + Import 링크.

### 3.6 Performance — `/room/performance` (신설 화면, 기존 RPC)

**Job:** "내 포트폴리오는 어떤가" — 죽은 /room/desk + legacy-/me 전용 기능의 부활.

1. **NAV hero** — 큰 mono NAV + tier 배지 + **asset curve**: `me_nav_history(p_days:365)` 풀 라인 차트(인라인 SVG), 90d/1y/All 토글. 곡선 아래 `me_portfolio_nav` 조성 바(lines touched, essentials, avg standing, n_watched/n_scored). 푸터에 covenant 문구 그대로: **"NAV never falls. Watching adds; low ratings never subtract."**
2. **Tier ladder** — FORMING → BUILDING(45) → ESTABLISHED(70) → APEX(90) 트랙 + 내 위치 + "N NAV points to ESTABLISHED". 공식 `100·(1−0.5^(S/1.4))`은 `.gloss`로 공개. (tier 사다리의 유일한 정본 렌더 — 중복 제거.)
3. **Alpha** — `me_takescore_summary()` (legacy-/me 전용이었음): `value_gap` 헤드라인 ("Your alpha: you rate +6.2 above the market" / 음수면 "You run colder than the market") · median TakeScore · **Best position**(best.ts) · **Riskiest holding**(riskiest.r) — 각각 클릭 → 필름 인스펙터.
4. **NAV movers** — `me_recommend_wwi(1.0,40)`에서 `delta` desc 상위 6: "Watching these moves your NAV most" — 각 행 Keep/Seen (읽기+행동).
5. **Milestone log** *(terminal 유지)* — nav_history에서 클라 파생: tier 라인 돌파 날짜들.

**Empty:** FormingCard — "NAV forms at 8 seen films — you're at N. Every film only adds."

### 3.7 Coverage — `/room/coverage` (신설 화면; analysis/home에서 분리)

**Job:** 계보 정복 계기 + `me_blindspots`의 데뷔 (출하된 적 없는 최고 정교 엔진).

1. **Facet tabs:** All · Canon · Award · Festival · National · Section (`me_coverage`가 이미 반환하는 `facet` 필드).
2. **Coverage board** — `me_coverage(p_min_total:5, p_limit:300)` 상태별 그룹: **Near (75–99%)** 최상단 → In progress → Done(접힘) → Locked. 행: label · authority dot · progress track · "N to finish" mono.
3. **Blind spots 모듈** — `me_blindspots(p_limit:12, p_min_total:10, p_max_pct:0.55)` *(journeys가 인용한 정확 시그니처)*: `opportunity = authority × gap × taste-productivity` 랭킹. 행: label · facet · `0/N` · **gap_reason 배지 UNTOUCHED / SHALLOW** · opportunity 바 + `.gloss` 공식 분해("taste fit 0.82"; **cold-start 시 0.70 중립값임을 명시**).
4. **Lineage inspector** (행 클릭): coverage 상세 + **Fill this gap** — WWI 페이로드에서 `reasons`에 `gap`/`conquer` 포함 행을 표시하되, **lineage 단위 정밀 매칭은 불가능함을 전제**: 매칭 없으면 정직하게 "No ranked candidate for this lineage yet — browse it publicly →" (`/lineage/[slug]`). 정밀 버전은 §8-R4 `me_lineage_candidates` 이후.

**Empty:** "Coverage begins with your first seen film in any lineage."

### 3.8 Auteurs — `/room/auteurs` (유지, 업그레이드)

1. Sort에 **"Closest to complete"** 추가 (remaining asc — 코드 코멘트가 자인한 누락 정렬).
2. 상태 영문화: Locked(<50) / In progress / Near / **Complete**.
3. **Conquest desk 행에 액션**: `ConquerInsp`에 `useRoomActions` — 모든 unseen-essential에 **Keep / Seen / Rate** (최대 읽기/쓰기 비대칭 수정).
4. 정직한 분모 공개: "% of this director's films in our catalog" `.gloss`.
5. `me_auteur_conquest(p_limit:80)` + "Show all" (단일 json, cap-safe).
6. 평균 별점은 공용 `Stars` read-only (유니코드 문자열 빌더 제거).

**Empty:** "Mark films Seen and directors appear with completion bars."

### 3.9 Atlas — `/room/atlas` (유지, 진짜 지도로)

1. **Land**: 저폴리 세계 외곽선을 인라인 SVG path로 (`lib/room/world_paths.ts`, ~30–60KB 정적 자산; 외부 타일·MapLibre 금지 — memory의 hidden-tab rAF 함정. **기존 lat/lng→x,y equirectangular 상수와 투영 일치 검증 필수.** 이 라우트에서만 import — 번들 격리).
2. **Layer toggles:** `Filmed` / `Setting` 칩 + 레전드에 레이어별 카운트.
3. **국기 전면화**: 45개 하드코딩 맵 제거 → ISO2 → regional-indicator 이모지 계산 (`String.fromCodePoint(0x1F1E6 + …)`).
4. **Blind continent 카드에 동사** *(depth 이식)*: 각 블라인드 대륙 인스펙터가 `country_continents`에서 그 대륙의 국가를 나열 + 공개 national lineage(`/lineage/*`)와 Coverage(national facet) 딥링크. "We can't recommend by geography yet — here is the territory." (지오 후보 RPC는 §8-R7 optional.)
5. Cluster/Country 인스펙터, KPI 스트립: 유지, 영어화.

**RPC:** `me_geo_coverage` (단일 json, 불변). **Empty:** "No located films yet — your map begins with your first seen film that has location data."

### 3.10 Signature — `/room/signature` (`/room/analysis` 대체)

**Job:** 독자로서의 당신 — 취향 정체성만. (자산 분석 → Performance, coverage → Coverage. 9밴드 스크롤 사망. 각 사실은 정확히 1회.)

1. **Signature hero** — 앵커 헤드라인 + 생성 문장("In one line: you keep returning to X.") + 앵커 칩(`me_taste_signature(8)`) + forming meter (분모 = `loved_target` 8 — 가짜 `/50` 링 삭제).
2. **Risk plane** — V×R 산점도, **`loadCollection()`으로 교체 — 현재 라이브 1000-cap 절단 버그(analysis/page.tsx:15) 수정**. 라벨은 hover/선택 시만(오버플롯 수정), 사분면 셰이딩·공식 각주 유지, dot → `FilmInsp`.
3. **Figure cloud** — `me_figure_cloud(28)`, `/trope/*` 링크.
4. **Theory teaser** — Lens로의 문 1줄: 상위 theorist/tradition 1개씩 + "Your full theory profile → Lens" (풀 화면은 3.12; 여기선 중복 모듈 금지).
5. **Kindred films** — `me_taste_neighbors(8)` sim 바 + **Keep/Seen 액션** (dead-end 수정).
6. **Framework fingerprint** — `portfolio_breakdown().framework` 바: 14 Strong Misreadings 중 내 영화가 끌어당기는 것.

**Empty:** FormingCard — "A signature forms from loved films (★4.5+) — you have N of 8."

### 3.11 Lens — `/room/lens` (신설; depth의 Prism+Reading Room 합본, 심사 전원 이식 지시)

**Job:** 이론 스파인으로 굴절된 내 컬렉션 + 내가 본 영화에 대한 published 비평. "본 만큼 열리는 콘텐츠" — 숫자 진행이 아닌 콘텐츠 복리.

**데이터 계약 (심사 2의 경로 교정 반영, 위반 금지):**
- 엔티티 프로필: `fetch('/api/lens/entities?kind=tropes|concepts|theorists|traditions|directors')` — 세션 검증 라우트. `*_mine` RPC는 service-role + `p_user`; **클라이언트 콜러블 변형 신설 금지**. `Cache-Control: private, no-store` 유지.
- Readings: `fetch('/api/lens/readings')` → `readings_mine(p_fw, p_sort, p_trope, p_decade, p_limit:24, p_offset)` — 내부 페이지네이션, cap-safe. **`trope_readings` 호출 절대 금지** (memory 불변식).
- TakeScore: `fetch('/api/lens/takescore')` → `cinecodex_ranked_mine`.
- 이 화면은 /room 유일의 **client-fetch-first**: 셸 즉시 렌더 + 패널별 스켈레톤.

레이아웃: 탭 6개.
1–5. **Tropes / Concepts / Theorists / Traditions / Directors** — 랭킹 테이블: entity · my-film count · count 바 · 공개 페이지 링크(`/trope/*`, `/idea/*`, `/theorist/*`, `/tradition/*`, `/director/*`). 행 → 인스펙터(정의 + 그 엔티티의 내 상위 영화).
6. **Readings** — 필터 바(framework 칩 — `lib/frameworks.ts` 정본 14색 · trope 검색 · decade · sort) · 카드(포스터 + take 타이틀 + framework 칩 + strength) → 공개 take 페이지 링크. `p_offset` load-more. **출시 게이트: 표본 계정 median readings-per-user 검증. 얇아도 탭 유지, 빈 카피 전면.**
7. *(v2 모듈, 이번 빌드 범위 밖 — 자리만)* **TakeScore Explorer**: `cinecodex_ranked_mine` λ 슬라이더 + 연도 범위만의 축소판. 13-서브스코어 듀얼레인지 풀패널 금지 (심사 2).

**Empty (탭별):** "No published entities cross your films yet — every film you log can bring its theory here." / Readings: "No published readings on your films yet."
**소유권 노트 (심사 0):** 이 화면은 공개 lens API에 결합 — `app/api/lens/**` 변경 시 Lens 화면 회귀 테스트 필수. 이 문장을 화면 파일 헤더 주석으로 박을 것.

### 3.12 Shelf — `/room/shelf` (`/room/library` 대체)

1. **Posters** — §8-R3 `me_library` v2(poster_path + 페이징) **직행** (터미널의 Holdings-조인 임시안 폐기 — 심사 2). 마이그레이션 전 출시 시 포스터 없는 칩 카드 (정직).
2. **카드 링크아웃**: 모든 카드에 "View page →" (`/film/`, `/trope/`, `/take/`) + "Details"(인스펙터).
3. **영구 빈 타입 2종(director/lineage) 숨김** — hero/KPI/필터에서 제거. 카피: "Directors & lineages: coming."
4. **Sort** (Newest/Oldest/Type/A–Z) + `.range()` 페이징.
5. **Unpin** — §8-R5 `me_unpin` 이후 활성; 그 전엔 인스펙터에 disabled + "Unpinning ships soon." (like-핀은 `me_toggle_fav`로 즉시 가능.)
6. Public/private + favorite 토글 유지, "Public shelf" 모듈 → `/u/me` 링크.

**Empty:** "Your shelf holds anything — films, tropes, misreadings, figures. Pin from any page."

### 3.13 Takes — `/room/takes` (`/room/write` 대체)

1. **진짜 드래프트 안전**: draft 키별 debounced localStorage 영속 + dirty 시 `beforeunload` 가드. 서버 저장 불변(`save_take` 명시적 Save draft / Publish). 필 상태 정직화: *Saved to server / Draft on this device / Unsaved*.
2. **에디터 교체**: `document.execCommand` → `Selection`/`Range` 기반 최소 커맨드 레이어. **기존 5개 op(bold/italic/h2/quote/link)로 엄격 한정** + paste-as-plain-text. 서버측 `sanitize_user_html`이 안전망. (전체 리디자인 중 최고 위험 프론트 작업 — 범위 확장 금지.)
3. **List rail:** `status` 칩(Draft/Published) · **upvotes**(페치되고 미렌더였음) · 날짜. 상수 ×1.5 태그는 행에서 제거(제로 정보), attach 레일에 1회 설명 유지. 에디터 푸터에 word count.
4. **Stats header:** published/drafts/Σupvotes — 당장은 페이징된 `me_authored_takes` 클라 집계, §8-R8 `me_takes_stats` 이후 교체.
5. **Attach rail** — ≥1180px 우측 상시 컬럼(이하 인스펙터): film attach + framework 픽커. trope/figure attach는 "coming" 명시.
6. **Delete:** §8-R9 `delete_take` 전에는 "Archive"(unpublish → draft, `save_take(p_publish:false)`).

**RPC:** `me_authored_takes`(`.range()`), `save_take`, `film_search`.
**Empty:** "No takes yet. Write your first reading — your own words are the strongest taste signal (×1.5)."

### 3.14 Masquerade — `/room/masquerade` (`/room/pair` 대체)

1. **싱글 카드 레이아웃**: 두 가면 + sync% + 교집합이 above-fold 전부. 3중복 규칙 카피 → 인스펙터 "How this works" 카드 1개(`setDefault`). 베일 칩은 카드 푸터로.
2. **Reveal 상태기계 → 라벨드 프라이머리 버튼 1개**: "Remove your mask" / "Waiting for them (you're unmasked)" / "Both unmasked — view profile" / "Mutual, but their profile is private" / "No partner today (odd one out)". 액션 가능할 때만 red primary.
3. **Sync trend:** `me_pair_history(p_days:30)` 미니 라인.
4. 카운트다운은 memoized 단일 컴포넌트(1초 전체 트리 리렌더 제거). "Let it pass" 가짜 버튼 삭제.
5. Forming 게이트: FormingCard — "Masquerade opens at 8 loved films — you have N." + Ledger 링크.

**RPCs:** `me_today_pair`, `me_pair_reveal`, `me_pair_history(30)`, `me_taste_signature(6)`.
**Empty (파트너 없음):** 점선 가면 1개 + 한 줄 — 널 값에 풀 스캐폴딩 금지.

### 3.15 Appraisal — `/room/film/[slug]` (유지 + 개인 레이어)

EvalCard 구조 유지, 전면 영어화, 화면 타이틀 "Appraisal". 신규 리전 1개: 히어로 위 **My position 바** — 내 ★(인라인 `Stars`) · Keep/Seen 버튼 · Standing 대비 verdict 칩. 바스켓 행·비교 칩은 링크화.

---

## 4. Shell Spec

**App bar:**
- 로고 → `/room` · **breadcrumb 삭제**(제로 정보) · ⌘K 트리거("Search films & pages") · **NAV chip**: 점수 + tier(**null이면 "Forming"** — 구 "형성 중") + 30일 마이크로 스파크라인(`me_nav_history(30)` layout에서 1회 페치), **클릭 → Performance-summary 인스펙터** (Ledger 링크 금지) · Summary 버튼 → **"Brief"** 텍스트 라벨(≥1180px, 이하 아이콘) · Refresh · 아바타 → `/u/me`.

**Rail:**
- §2의 3그룹. 그룹 라벨 9px 대문자: `SESSION / PORTFOLIO / RESEARCH`.
- 항목은 **실제 `<Link>`** (middle-click·prefetch·a11y 복구).
- 카운트 배지: Slate(watchlist), Holdings(seen) — layout의 `portfolio_breakdown`에서.
- 접힘 동작 불변(localStorage `mt_rail`, <900px 자동). 푸터: "Your cinematic asset operating system · Metatake" + `ti-download` **Import** 링크(`/me/import`).
- **`lib/room/nav.ts`가 단일 소스** — 레일·CmdK 동일 배열 import (PAGES 드리프트 사망).

**CmdK:**
- Placeholder: "Search films & pages". 섹션: **FILMS / PAGES / RECENT**(localStorage). 화살표 키 선택, film_search 300ms 디바운스. PAGES는 `nav.ts`에서 생성.

**Inspector:**
- 계약 불변(select/setDefault/slide-over/<900px bottom-sheet). 헤더 닫기 "Close (ESC)", 기본 타이틀 "Details · Why", Brief 타이틀 "Page brief".
- 공용 프리미티브 신설: `components/room/insp/` — `ICard`, `KV`, `CRow`, `SelHead`, `ActBar` (~20× 중복 마크업 제거). **데이터는 props로** 받아 워크스페이스 상태에서 리렌더 (stale ReactNode 스냅샷 문제의 규칙화된 해법).
- 1-depth **back stack** (Masquerade의 backlink 핵 일반화).

**SessionStore** (`components/room/SessionStore.tsx`, room layout에 마운트):
- `kept/gone/reRated` 낙관적 상태 — 라우트 간 생존(부활 버그 수정). `useRoomActions`가 기록.
- λ별 Screener 결과 캐시 (`{lambda → rows}`).
- Desk↔Screener↔Performance의 `me_recommend_wwi` 페이지별 중복 페치는 서버 util + React `cache()` (요청당 1회).

**Toast:** RoomShell에 단일 provider (`components/room/Toast.tsx`) — 중복 3벌 제거, **Undo 액션 슬롯** (dismiss 토스트가 사용).

**Loading/Error:** 전 라우트 `loading.tsx`; RPC 실패는 `?? []` 침묵 대신 공용 에러 카드 "Couldn't load — retry."

**Language:** 전 문자열 영어, `components/room/strings.ts`에 집중 (향후 i18n = 파일 스왑). mono 데이터 라벨(NAV, WWI, V/C/R, APEX)은 불변. 톤: terminal-terse + honest.

**Mobile:** 기존 패턴 유지 — 레일 자동 접힘 <900px, 인스펙터 bottom sheet, 테이블은 900/640 지점에서 컬럼 접힘, Takes attach 컬럼은 <1180px에서 인스펙터로.

---

## 5. Complete English String Table (shared components)

> 원칙: 의미 번역(transliteration 금지), 정직성 문구는 약속으로 취급. mono 라벨 유지. 아래는 공용 컴포넌트의 실제 그렙 결과 기반 — 페이지별 문자열은 각 화면 스펙의 카피를 따르고 전부 `strings.ts` 경유.

### RoomShell.tsx / layout.tsx / nav
| Old (KO) | New (EN) |
|---|---|
| 오늘 (그룹) | SESSION |
| 자산 (그룹) | PORTFOLIO |
| 기록실 (그룹) | RESEARCH |
| 오늘 · 홈 | Desk |
| 볼 영화 · 추천 | Screener *(kept 리스트 문맥은 Slate)* |
| 기록 · 평가 | Ledger |
| 보유 영화 | Holdings |
| 감독 정복 | Auteurs |
| 지리 Atlas | Atlas |
| 자산 분석 | Signature *(자산 모듈은 Performance)* |
| 서재 | Shelf |
| 노트 · 글쓰기 | Takes |
| 동행 | Masquerade |
| 공개 프로필 | Public profile |
| 새로고침 | Refresh |
| 닫기 (ESC) | Close (ESC) |
| 이 페이지 요약 | Page brief *(버튼 라벨: Brief)* |
| 운영 메뉴 (aria) | Room navigation |
| 영화적 자산 운영 시스템 · Metatake | Your cinematic asset operating system · Metatake |
| 형성 중 (NAV null tier — layout.tsx:15, HomeWorkspace) | Forming |

### CmdK.tsx
| Old | New |
|---|---|
| 영화 · 페이지 검색 | Search films & pages |
| 영화 (섹션) | FILMS |
| 페이지 (섹션) | PAGES |
| (신설) | RECENT |
| (페이지 이름들) | `nav.ts`의 새 영어 이름 자동 사용 |

### QuickRate.tsx
| Old | New |
|---|---|
| 방금 본 영화 검색 — 별을 누르면 기록 끝 | Search the film you just watched — one star-tap logs it. |
| 검색 중… | Searching… |
| 결과 없음 | No results |

### useRoomActions.tsx (토스트)
| Old | New |
|---|---|
| 「{title}」 볼 영화에 담김 | "{title}" added to your slate |
| 「{title}」 관람 기록됨 | "{title}" logged as seen |
| 「{title}」 다시 추천하지 않습니다 | "{title}" won't be recommended again · **Undo** |
| 「{title}」 ★{n} — 관람 기록됨 | "{title}" ★{n} — logged as seen |
| 저장 실패 — {msg} | Couldn't save — {msg} |
| 기록 실패 — {msg} | Couldn't log — {msg} |
| 평가 실패 — {msg} | Couldn't rate — {msg} |

### FilmRow.tsx
| Old | New |
|---|---|
| 담기 | Keep |
| 담김 | Kept |
| 봤어요 | Seen |
| 관심없음 | Not interested |
| 지금 가능 | Streaming now |
| 실망 위험 (배지) | Risk {n} |
| 적합도 | Fit |

### RecInsp.tsx (이유 칩 — REASON_MAP 정본, 딥링크 §3 공통 규약)
| Code | Old chip | New chip | Old fragment | New sentence fragment |
|---|---|---|---|---|
| safe | 안전자산 | Safe asset | 실망 위험이 낮은/낮고 | low letdown risk |
| reading | 취향 적중 | Your lens | 당신의 취향에 가까운/가깝고 | close to how you read |
| canon | 정전 위상 | Canon standing | 영화사적 위상이 높은/높고 | high standing in film history |
| gap | 공백 충족 | Fills a gap | 아직 안 밟은 계보를 여는/열고 | opens a lineage you haven't entered |
| frontier | 안전한 모험 | Safe frontier | 낯설지만 하방이 받쳐진/받쳐져 있고 | unfamiliar but with a floor under it |
| conquer | 도장깨기 | Conquest | 계보 완파를 진척시키는/진척시키고 | advances a lineage campaign |

| Old | New |
|---|---|
| 왜 이 영화 | Why this film |
| …작품입니다 (생성 문장 어미) | 문장 템플릿: "A film that {fragments}." |
| 이 후보의 추천 이유 데이터가 아직 없습니다 — 아래 펀더멘털을 직접 확인하세요 | No reason data for this candidate yet — check the fundamentals below. |
| 바로 하기 | Act now |
| 평점 | My rating |

### CinecodexCard.tsx
| Old | New |
|---|---|
| 발굴 | Find |
| 실망 | Letdown |
| 합치 | Aligned |
| 영화 순가치 U | U Net value |
| 측정된 신뢰도 | Measured confidence |
| 정전가 | Standing |
| 발견 | Discovery |

### EvalCard.tsx (Appraisal)
| Old | New |
|---|---|
| V 획득가치 | V Earned value |
| C 진입비용 | C Entry cost |
| R 위험도 | R Risk |
| U 영화 순가치 | U Net value |
| 정전가 | Standing |
| 시장가 | Market price |
| 획득가치(돌려주는 것)에 기여 | Contributes to earned value (what it gives back) |
| 진입 비용 — 난이도이지 가치 아님 | Entry cost — difficulty, not value |
| 실망 위험 신호 — 낮을수록 안전 | Letdown-risk signal — lower is safer |
| 비용이지 가치 아님 | a cost, not a value |
| 위험이지 불신뢰 아님 | a risk, not distrust |
| (★★★ 절대 안 섞음) | (★ never blended) |
| 나란히 · 세 개의 기둥 | Side by side · three pillars |
| 우리 · Cinecodex | Ours · Cinecodex |
| 외부 지표 / 대중·평단 | External signals / audience & critics |
| 정전 · Standing / 등재 · 수상 / 티어 | Canon · Standing / listings · awards / tier |
| 신뢰도 · 재현성 카드 / 비결정성 정직 공개 | Confidence & reproducibility / non-determinism, disclosed honestly |
| 신뢰도 tier | Confidence tier |
| 미측정 (N=1) | Unmeasured (N=1) |
| 근거 코퍼스 | Evidence corpus |
| 기준 바스켓 · U 순위 | Reference basket · U rank |
| 주의 | Caution |
| 준비 필요 | Preparation needed |
| L단계: 기본기/견실한 장인정신/사려 깊은 작품/성취된 작품/뚜렷한 비전/지속된 성취/주요작/촉발된 사색/초월적/정전의 정점 | Fundamentals / Solid craft / Considered work / Achieved work / Distinct vision / Sustained achievement / Major work / Provoked thought / Transcendent / Apex of the canon |
| 강도: 미약/준수/견실/강력/탁월 | Faint / Fair / Solid / Strong / Exceptional |
| 진입: 진입 쉬움/중급/까다로움/상급/전문 지식 | Easy entry / Intermediate / Demanding / Advanced / Expert |
| 위험: 없음/낮음/일부/높음/심각 | None / Low / Some / High / Severe |
| 저/중/고 | Low / Mid / High |
| 높은 가치 · 낮은 위험 — 안전한 걸작. | High value · low risk — a safe masterpiece. |
| 높은 가치 · 높은 위험 — 야심적이나 분열적. | High value · high risk — ambitious but divisive. |
| 견고하나 절정은 아님 — 안정적 선택. | Solid but not peak — a stable choice. |
| 가치·위험 모두 중간 — 신중히 접근. | Mid value, mid risk — approach with care. |
| 세계정전/국가정전/주목 | World canon / National canon / Notable |
| 정전가 미산정. | Standing not yet computed. |
| 13 sub-scores: COG 인지적 자극 / AFF 정서적 강도 / FORM 형식적 성취 / MORAL 도덕적 진지성 / DUR 지속적 잔상 / ITX 상호텍스트성 / FR 형식적 급진성 / ETX 외부텍스트성 / CTX 감독 오에브르 / BANK 지적 파산 / INSINCERE 미적 불성실 / COWARD 예술적 비겁 / POLAR 분열성 | COG Cognitive charge / AFF Affective intensity / FORM Formal achievement / MORAL Moral seriousness / DUR Lasting residue / ITX Intertextuality / FR Formal radicality / ETX Extratextual demand / CTX Directorial oeuvre / BANK Intellectual bankruptcy / INSINCERE Aesthetic insincerity / COWARD Artistic cowardice / POLAR Divisiveness |

### InspectorContext.tsx
| Old | New |
|---|---|
| 상세 · 왜 | Details · Why |
| 이 페이지 요약 | Page brief |

### 공통 신규 문자열 (strings.ts)
| Key | EN |
|---|---|
| forming.card | "{feature} unlocks at {need} {unit} — you have {have}." |
| nav.covenant | NAV never falls. Watching adds; low ratings never subtract. |
| avail.unknown | Availability unknown (≠ unavailable) |
| error.load | Couldn't load — retry |
| age.fresh / aging / stale | Fresh / Aging / Stale {n}d |
| verdict.find / aligned / letdown | Find / Aligned / Letdown |

---

## 6. Route Migration Map

메커니즘: **page-stub `redirect()`** (`/room/desk` 선례 — 파일 내 주석으로 watcher-scope 제약 문서화돼 있음). next.config/middleware 절대 금지. 전부 noindex — 북마크 호환 목적.

| Old | New | Stub 작성 |
|---|---|---|
| `/room` | `/room` (Desk) | — (유지) |
| `/room/watchlist` | `/room/screener` | `app/room/watchlist/page.tsx` = `redirect("/room/screener")` |
| `/room/rate` | `/room/ledger` | `app/room/rate/page.tsx` = `redirect("/room/ledger")` |
| `/room/collection` | `/room/holdings` | `app/room/collection/page.tsx` = `redirect("/room/holdings")` |
| `/room/analysis` | `/room/signature` | `app/room/analysis/page.tsx` = `redirect("/room/signature")` |
| `/room/library` | `/room/shelf` | `app/room/library/page.tsx` = `redirect("/room/shelf")` |
| `/room/write` | `/room/takes` | `app/room/write/page.tsx` = `redirect("/room/takes")` |
| `/room/pair` | `/room/masquerade` | `app/room/pair/page.tsx` = `redirect("/room/masquerade")` |
| `/room/desk` | `/room` | 기존 stub 유지 (목적지 불변) |
| `/room/auteurs`, `/room/atlas`, `/room/film/[slug]` | 불변 | — |
| **신설** | `/room/slate`, `/room/performance`, `/room/coverage`, `/room/lens` | 새 라우트 |
| `/me` | `/room` | `app/me/page.tsx` = `redirect("/room")` |
| `/me/import` | **URL 유지** | 리다이렉트 없음. "← My Room" 백링크 href를 `/room`으로 수정 + 레일 푸터/빈 상태에서 링크 |

**/me 해소:** /me는 페이지로서 사망, /room이 유일한 프라이빗 표면. 공개 nav "You → Your Shelf" → **"My Room" → `/room`**. /me 전용 모듈 흡수: Saved/Following/Liked → Shelf · My takes → Takes · `me_takescore_summary` → Performance · watchlist-by-TakeScore → Slate. `me_watched_scored`/`get_my_pins`는 콜러 0 확인 후 은퇴. **같은 PR에서 내부 `/me` 링크 전수 grep** (공개 nav, import 백링크, docs).

CSS 아일랜드는 라우트와 함께 개명(`analysis.css`→`signature.css` 등); room.css의 dead v1 클래스(`.rrow .xhead .xrow .inspector .activity .ticker`) 같은 패스에서 purge.

---

## 7. File Plan & Ownership

> **규칙: 파일 1개 = 소유자 1명.** 공유 잎(shared leaves)은 전부 Agent S 소유 — 다른 에이전트는 절대 수정하지 않고 import만 한다. 다른 에이전트가 공유 파일에 필요한 게 있으면 스펙(이 문서)에 이미 있다 — 없으면 작업 중단 후 보고.

### Agent S — Shell & Shared (선행 wave, 단독)
**생성:**
- `lib/room/nav.ts` — NAV 배열 단일 소스 (name/icon/route/group)
- `lib/room/format.ts` — num, IMG, tierOf, REASON_MAP, FACET_LABEL
- `lib/room/loadCollection.ts` — me_collection `.range()` 청크 공용 로더
- `components/room/strings.ts` — §5 전체 문자열
- `components/room/SessionStore.tsx` — 낙관 상태 + λ 캐시 context
- `components/room/Toast.tsx` — 단일 토스트 host + Undo 슬롯
- `components/room/FormingCard.tsx` — `<FormingCard need have unit feature cta>`
- `components/room/insp/ICard.tsx`, `insp/KV.tsx`, `insp/CRow.tsx`, `insp/SelHead.tsx`, `insp/ActBar.tsx`
**재작성/수정:**
- `app/room/layout.tsx` (EN tier "Forming", `me_nav_history(30)` 페치, SessionStore+Toast provider 마운트)
- `app/room/room.css` (dead 클래스 purge, 신규 공용 클래스)
- `components/room/RoomShell.tsx` (새 레일, `<Link>`, NAV 칩 스파크라인, Brief)
- `components/room/CmdK.tsx` (nav.ts 소스, RECENT, 디바운스)
- `components/room/InspectorContext.tsx` (back stack, EN)
- `components/room/useRoomActions.tsx` (EN 토스트, doRestore, SessionStore 기록, Toast 사용)
- `components/room/QuickRate.tsx` (EN)
- `components/room/Stars.tsx` (필요 시 read-only variant)
- `components/room/FilmRow.tsx` (EN, expander variant, 칩 딥링크)
- `components/room/RecInsp.tsx` (EN, Score anatomy 카드, insp 프리미티브 사용)
- `components/room/CinecodexCard.tsx` (EN)
- `app/me/page.tsx` (redirect stub) + `/me/import` 백링크 href 수정 + 공개 nav 라벨 (해당 파일이 app/room 밖이면 수동 커밋 유의)

### Agent A — Desk
- 재작성: `app/room/page.tsx` · 생성: `app/room/loading.tsx`
- 생성: `components/room/DeskWorkspace.tsx` / 삭제: `components/room/HomeWorkspace.tsx`

### Agent B — Screener + Slate
- 생성: `app/room/screener/page.tsx`, `screener/loading.tsx`, `screener/screener.css`
- 생성: `app/room/slate/page.tsx`, `slate/loading.tsx`, `slate/slate.css`
- 생성: `components/room/ScreenerWorkspace.tsx`, `components/room/SlateWorkspace.tsx`
- 재작성(stub): `app/room/watchlist/page.tsx` / 삭제: `components/room/WatchlistWorkspace.tsx`

### Agent C — Ledger + Holdings
- 생성: `app/room/ledger/page.tsx`, `ledger/loading.tsx`, `ledger/ledger.css` (기존 rate.css 개명·이관)
- 생성: `app/room/holdings/page.tsx`, `holdings/loading.tsx`, `holdings/holdings.css`
- 생성: `components/room/LedgerWorkspace.tsx`, `components/room/HoldingsWorkspace.tsx`
- 재작성(stub): `app/room/rate/page.tsx`, `app/room/collection/page.tsx` / 삭제: `components/room/RateWorkspace.tsx`, `components/room/CollectionWorkspace.tsx`, `app/room/rate/rate.css`

### Agent D — Performance + Coverage
- 생성: `app/room/performance/page.tsx`, `performance/loading.tsx`, `performance/performance.css`
- 생성: `app/room/coverage/page.tsx`, `coverage/loading.tsx`, `coverage/coverage.css`
- 생성: `components/room/PerformanceWorkspace.tsx`, `components/room/CoverageWorkspace.tsx`
- 삭제: `app/room/desk/desk.css` (stub만 남김; `app/room/desk/page.tsx`의 redirect는 유지)

### Agent E — Auteurs + Atlas
- 수정: `app/room/auteurs/page.tsx`, `auteurs/auteurs.css` · 재작성: `components/room/AuteursWorkspace.tsx` · 생성: `auteurs/loading.tsx`
- 수정: `app/room/atlas/page.tsx`, `atlas/atlas.css` · 재작성: `components/room/AtlasWorkspace.tsx` · 생성: `atlas/loading.tsx`, `lib/room/world_paths.ts` (~30–60KB, 이 라우트에서만 import)

### Agent F — Signature + Lens
- 생성: `app/room/signature/page.tsx`, `signature/loading.tsx`, `signature/signature.css` (analysis.css 이관)
- 생성: `app/room/lens/page.tsx`, `lens/loading.tsx`, `lens/lens.css`
- 생성: `components/room/SignatureWorkspace.tsx`, `components/room/LensWorkspace.tsx` (헤더 주석: lens API 결합 경고)
- 재작성(stub): `app/room/analysis/page.tsx` / 삭제: `components/room/AnalysisWorkspace.tsx`, `app/room/analysis/analysis.css`

### Agent G — Shelf + Takes
- 생성: `app/room/shelf/page.tsx`, `shelf/loading.tsx`, `shelf/shelf.css` (library.css 이관)
- 생성: `app/room/takes/page.tsx`, `takes/loading.tsx`, `takes/takes.css` (write.css 이관)
- 생성: `components/room/ShelfWorkspace.tsx`, `components/room/TakesWorkspace.tsx`, `components/room/TakeEditor.tsx` (Selection/Range 커맨드 레이어 격리)
- 재작성(stub): `app/room/library/page.tsx`, `app/room/write/page.tsx` / 삭제: `components/room/LibraryWorkspace.tsx`, `components/room/WriteWorkspace.tsx`

### Agent H — Masquerade + Appraisal
- 생성: `app/room/masquerade/page.tsx`, `masquerade/loading.tsx`, `masquerade/masquerade.css` (pair.css 이관)
- 생성: `components/room/MasqueradeWorkspace.tsx` / 재작성(stub): `app/room/pair/page.tsx` / 삭제: `components/room/PairWorkspace.tsx`
- 재작성: `components/room/EvalCard.tsx` (§5 영어화 + My position 바), `components/room/FilmContentHub.tsx` (EN), `app/room/film/[slug]/page.tsx` (타이틀 Appraisal) · 생성: `app/room/film/[slug]/loading.tsx`

> **주의:** EvalCard/FilmContentHub는 공유 성격이지만 소비자가 Appraisal뿐이므로 Agent H 소유. RecInsp/CinecodexCard/FilmRow는 다수 소비 → Agent S 소유.

**출시 시퀀스 (depth 이식, 각 wave 독립 배포):**
Wave 1 = Agent S (셸+EN+공용+리다이렉트 스텁 전부+FormingCard) → Wave 2 = A·B·C (데일리 루프) → Wave 3 = D·E (estate 분석) → Wave 4 = F·G·H (research·salon). 어떤 wave도 §8 RPC에 의존하지 않는다.

**집계:** 생성 ~46 파일 / 재작성 ~22 파일 / 삭제 ~11 파일.

---

## 8. NEW-RPC Appendix (심사 지지분만; 전부 optional — 코어 설계는 무의존 출시)

전부 `security definer`, `auth.uid()` 스코프, uid 파라미터 금지 (기존 불변식). R1–R5 = 심사 명시 지지(우선), R6–R9 = 조건부.

**R1. `me_dismissed(p_limit int=50, p_offset int=0)`** — "관심없음"의 열람 (현재 영구 비가시 제외).
```sql
select f.slug,f.title,f.year,f.poster_path from user_movies um
join films f on f.id=um.film_id
where um.user_id=auth.uid() and um.dismissed
order by um.added_at desc limit p_limit offset p_offset;
```
소비: Screener "Passed on" 히스토리 드로어. 폴백: 세션 내 목록만 (SessionStore).

**R2. `me_undismiss(p_slug text)`** — dismissed만 깨끗하게 해제 (side-channel 2-call 시퀀스 대체).
```sql
update user_movies um set dismissed=false from films f
where f.id=um.film_id and um.user_id=auth.uid() and f.slug=p_slug;
```
소비: 토스트 Undo + Restore. 폴백: `doRestore` 2-call 시퀀스 (§1 정의).

**R3. `me_library` v2** — 필름 브랜치에 `f.poster_path` 추가 + `p_limit/p_offset` (또는 jsonb_agg 래퍼 — `geo_overview_json` 선례). **반환 타입 변경 = drop-and-recreate 필요 (0028 선례).** 소비: Shelf 포스터+페이징. 폴백: 포스터 없는 칩 카드 + `.range()`.

**R4. `me_lineage_candidates(p_list_id bigint, p_limit int=8)`** — 한 계보의 미관람 멤버, prestige desc (WWI 멤버십 프로브 재사용). 소비: Coverage 인스펙터 "Fill this gap" 정밀판. 폴백: 정직한 no-candidate + `/lineage/[slug]` 링크 (§3.7).

**R5-a. `me_unpin(p_entity_type text, p_slug text)`** *(write)* — `delete from user_pins where user_id=auth.uid() and …`. 소비: Shelf Unpin. 폴백: disabled 버튼 + "Unpinning ships soon."
**R5-b. `delete_take(p_take_id uuid)`** *(write)* — `delete from takes where id=p_take_id and author_id=auth.uid() and source='human' returning id`. 소비: Takes Delete. 폴백: Archive(unpublish).
> 심사 1: "renamed 화면을 파괴 동사 없이 출시하면 두 계기가 눈에 띄게 불구" — R5 쌍은 Wave 4 전 강력 권장.

**R6. `me_watchlist_scored` + avail** — WWI RPC가 만드는 `film_watch_providers` KR-flatrate json을 동일하게 부착. 소비: Slate streaming rollup. 폴백: 정직 플레이스홀더 (§3.3).

**R7. `me_geo_gap_candidates(p_continent text, p_limit int=8)`** — 블라인드 대륙의 `film_locations` 보유 미관람 visible 필름, prestige desc. 소비: Atlas 블라인드 카드. 폴백: country_continents 목록 + lineage 딥링크 (§3.9).

**R8. `me_takes_stats()`** — `select count(*) filter (where status='published'), count(*) filter (where status='draft'), coalesce(sum(upvotes),0) from takes where author_id=auth.uid() and source='human';` 소비: Takes 헤더. 폴백: 페이징 클라 집계.

**R9. (사전 검증, RPC 아님)** `me_pair_state`가 daily-match write를 트리거하지 않음을 마이그레이션 SQL로 확인 — Desk 티저의 게이트.

---

## 9. Acceptance Checklist (전 wave 공통 launch gate)

- [ ] **Zero Korean strings** — `grep -rE '[가-힣]' app/room components/room` = 0 히트 (주석 제외 여부는 리뷰어 재량, 사용자 표면 문자열은 무조건 0).
- [ ] **모든 구 라우트 redirect** — /room/watchlist·rate·collection·analysis·library·write·pair·desk + /me → 새 목적지로 page-stub `redirect()`. next.config/middleware 변경 없음.
- [ ] `npx tsc -p tsconfig.check.json` (또는 프로젝트 표준 typecheck) 통과.
- [ ] **`.range()` 페이징** — me_collection(loadCollection 경유), me_watchlist_scored, me_library, me_authored_takes의 모든 소비처. >1000편 임포트 계정으로 실측 테스트.
- [ ] **공개 페이지 개인화 누출 0** — /room 밖 서버 HTML에 개인 데이터 없음; lens API 응답 `Cache-Control: private, no-store` 유지; 클라이언트 콜러블 `*_mine` 변형 신설 없음.
- [ ] 신규/개명 전 라우트에 `loading.tsx` 존재.
- [ ] 모든 빈 상태가 해금 숫자를 명시 (FormingCard) — Screener 3 rated ★3.5+ / NAV 8 seen / Masquerade·Signature 8 loved / blindspot taste-fit 3 vectors.
- [ ] Never-blend 컬럼 그룹 (Holdings·Appraisal), `--risk` ≠ `--red`, NAV covenant 문구 존재 (Performance 푸터), no-fake-numbers (Slate avail 플레이스홀더, Coverage no-candidate, 이유 칩은 서버 데이터만).
- [ ] NAV 칩/스파크라인은 Performance로만 링크 (Ledger 금지).
- [ ] 레일 항목 = 실제 `<Link>`; CmdK PAGES = `nav.ts` 단일 소스.
- [ ] 토스트 provider 단일 (중복 구현 0), dismiss 토스트에 Undo 동작.
- [ ] SessionStore: Desk에서 Keep → Screener 이동 시 해당 필름 미부활; λ 토글 재클릭 시 RPC 재호출 없음(캐시 히트).
- [ ] Atlas world_paths는 atlas 라우트 번들에만 포함 (다른 라우트 번들 크기 불변).
- [ ] Takes: 새로고침/탭 닫기 시 dirty 드래프트 유실 없음 (localStorage + beforeunload).
- [ ] mono 데이터 라벨 (NAV, WWI, V/C/R, U, APEX/ESTABLISHED/BUILDING/FORMING) 원형 유지.
- [ ] 내부 `/me` 링크 전수 수정 (공개 nav 라벨 "My Room", import 백링크 href=/room).
- [ ] 배포 후 라이브 감사는 캐시버스터 필수 (memory: ISR 캐시 함정) — 코드 먼저 확인.
