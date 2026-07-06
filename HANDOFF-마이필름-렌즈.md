# HANDOFF — My Films 렌즈 (전 사이트 개인화 오버레이)

작성: 2026-07-06 · 상태: v1 라이브 + 로그인 E2E 완료(702편 계정, 갤럭시 "320 films · yours only" 확인) · v1.1 mine-first 정렬 추가

## 개요

로그인 사용자의 "본 영화(user_movies.seen)" 세트로 사이트 전체를 다시 보는 3단 렌즈.
- **off** — 퍼블릭 사이트 그대로
- **highlight** — 본 영화에 액센트(빨강) 테두리: 모든 포스터/썸네일/갤럭시 점/지도 핀, 인라인 텍스트 링크엔 ✓
- **only** — 사이트가 내 영화로 재중심화: 안 본 카드 고스트(불투명도 .06), 갤럭시·아틀라스 핀 필터링, 그래프는 흐림

토글 위치: 전 페이지 나브 우측 **◎ My films**. 소개 페이지 **/my-films**, 홈 히어로 아래 리본.

## 핵심 원칙 (불변식)

1. **서버 HTML은 절대 개인화하지 않는다.** 렌즈는 100% 클라이언트 오버레이. ISR/edge 캐시·SEO 불변. 서버 컴포넌트에서 렌즈 분기 금지.
2. **DOM 엔진 규약**: `components/LensProvider.tsx`가 `a[href^="/film/"]`와 `[data-lens-film="{slug}"]`를 스캔해 `mtl-card|mtl-inline` × `mtl-seen|mtl-unseen` 클래스를 부여, CSS는 `html[data-mtlens=...]`로 게이트(globals.css 말미 "My Films lens" 블록). **새 표면은 앵커에 포스터 `<img>`만 넣으면 자동 커버**; 캔버스/그래프류만 `data-lens-film` 옵트인(예: EntityGraph 필름 노드).
3. **user_movies 로드는 `.range()` 페이징 유지** (UserFilmsProvider). PostgREST 1000행 캡 — 단일 select로 되돌리면 대량 임포트 유저의 렌즈가 잘림.
4. **이름 충돌 주의**: 기존 "Lenses" 나브 그룹·홈 "Explore by lens"(비평 렌즈: 트롭/아키타입)와 별개. 이 기능의 대외 명칭은 **My Films**, 내부 접두어는 `mtl-`/`mfl-`.
5. 렌즈 유효 조건: `uid && seenSlugs.size > 0 && ready`. 아니면 강제 off(초기 로드 중 깜빡임 방지).

## 파일 지도

| 파일 | 역할 |
|---|---|
| `components/LensProvider.tsx` | 모드 상태(localStorage `mt-lens-mode`) + DOM 엔진(MutationObserver 120ms 디바운스) + `useLens()` |
| `components/UserFilmsProvider.tsx` | seen 세트 원천. `seenSlugs: ReadonlySet<string>` 노출, 페이징 로드 |
| `components/LensToggle.tsx` | 나브 토글+드롭다운(로그인/미로그인/0편 상태 분기) — `home2/Nav.tsx`에 삽입 |
| `components/LensCta.tsx` | /my-films의 상태 인지형 모드 스위치 |
| `components/LensDirectorCoverage.tsx` | 감독 페이지 "You've seen X of N" (`app/director/[slug]/page.tsx` 필모 섹션) |
| `components/home2/MyFilmsRibbon.tsx` | 홈 리본 (HomeV2 §2b) |
| `app/my-films/page.tsx` | 소개/랜딩(정적 프리렌더) |
| `components/GalaxyMap.tsx` | films 모드: highlight=액센트 링/보더, only=points 필터(라벨·패널·클러스터 자동 재계산) |
| `components/FilmMap.tsx` | globalish(아틀라스·감독맵·world scope)에서만: only=소스 필터(클러스터 카운트 정확), highlight=unseen 핀 페이드(`lensOpacityExpr`, 스타일 스왑 후에도 ref로 재적용) |
| `components/EntityGraph.tsx` | 필름 노드 `data-lens-film` 옵트인(2줄) |
| CSS | `app/globals.css` 말미(엔진 클래스·/my-films·커버리지), `app/home2.css` 말미(토글·리본) |

## v1.1 — mine-first 정렬 (2026-07-06)

렌즈 활성 시 **본 영화가 리스트 앞으로 밴드 정렬**되고, 각 표면의 기존 정렬은 밴드 안에서 유지된다.

- **전역 엔진**: flex/grid 컨테이너에서 CSS `order:-1`로 seen 아이템을 앞으로(DOM 이동 없음 → React 안전). 가드: 자식 ≥4, 영화카드 커버리지 ≥70%, seen·unseen 혼재 시에만. 컨테이너에 `data-mtl-ordered` 마킹, off 전환 시 sweep. 자체 정렬을 가진 패널은 `data-mtl-no-order`로 옵트아웃(FilmMap 패널이 사용).
- **딥링크 분류 확장**: `FILM_HREF`가 `/film/x/figure/y` 등 하위 경로도 영화 x 귀속으로 매칭 — 스트롱 미스리딩 카드가 렌즈·정렬 대상이 됨.
- **갤럭시 패널**: sortedVisible에 seen-first 밴드(하이라이트 모드), 헤더에 "· yours first" 표시.
- **FilmMap 패널**: groups에 seen-first 밴드(하이라이트 모드; only는 이미 필터라 무의미), focus 영화는 여전히 최상단.
- **블록 리스트 옵트인**: 행 스택 컨테이너를 `display:flex;flex-direction:column`으로 바꾸면(시각 동일) 행 단위 정렬이 활성화됨 — `.smb-list`(스트롱 미스리딩 유형 페이지), `.df-conn`(film 상세 connected/counterpoints)에 적용. **범용 옵트인 클래스 `.mtl-rows`** 도입: 트롭 `ol.tp-mlist`, 장르 `ul#genre-list`, 아틀라스 국가(십년대 셸 내부 래퍼)·도시(films 래퍼)에 적용. 헤딩(h2/h3)이 행들과 같은 컨테이너에 있으면 행만 감싸는 래퍼를 새로 두어야 헤딩 위로 행이 떠오르지 않음.
- **행 단위 카드 마킹**: 포스터가 앵커 밖에 있는 행(장르 li, 계보 .lh-film)은 행 요소에 `data-lens-film={slug}`를 달아 카드로 승격 — 보더(내부 img)·고스트(.15)·정렬 모두 적용됨. 엔진은 data-lens-film 요소도 정렬 대상에 포함(그래프 노드는 부모가 flex/grid가 아니라 자연 배제).
- **LensQuickBar**(components/LensQuickBar.tsx): 리스트 페이지 상단 인라인 3단 스위처(All/Highlight mine/Only mine + seen 카운트; 비로그인/0편은 /my-films 링크 한 줄). 삽입된 곳: atlas 국가·도시, genre, movements(MovementHubClient), catalog, trope, lineage, movies-like, strong-misreadings/[fw], film 인덱스(기본+all 뷰), u/[username]. 새 리스트 페이지엔 h1 아래 `<LensQuickBar />` 한 줄.
- **counterpoint 특례**: seen 영화 페이지의 counterpoint 행은 자기 영화 figure 링크 때문에 전부 seen 판정 → 가드(전원 seen이면 스킵)로 무해하게 no-op. unseen 영화 페이지에선 정상 정렬.
- **한계**: 페이지네이션/무한스크롤 표면은 로드된 범위 안에서만 정렬(서버 쿼리는 건드리지 않음 — 캐시 원칙). 블록형(비 flex/grid) 리스트는 옵트인 전까지 엔진 정렬 미적용.

## v1.3 — 엔드리스 피드의 데이터 레벨 렌즈 (2026-07-06)

스트롱 미스리딩 피드(ReadingFeed)는 페이지네이션이라 클라 정렬로는 로드된 창만 처리됨 → **only 모드일 때 피드의 데이터 소스 자체를 교체**:

- DB: `readings_mine(p_user, p_fw, p_sort, p_trope, p_decade, p_limit, p_offset)` — `readings_by_framework` 미러 + user_movies seen 조인. **anon/authenticated 실행권 REVOKE, service_role만** (p_user 스푸핑으로 타 유저 시청기록이 새는 것 방지). 마이그레이션명 readings_mine_lens.
- API: `app/api/lens/readings/route.ts` — 세션 검증(ssr getUser) → admin 클라이언트로 RPC 호출, `Cache-Control: private, no-store`.
- ReadingFeed: `mine = lens.mode==="only" && seenCount>0`일 때 buildUrl이 `/api/lens/readings`로 스위치(검색 q 있으면 전역 유지), only 모드로 첫 진입 시 SSR 시드 무시하고 refetch, 카운트 문구 "N readings from films you've seen". 정렬·연대 파셋 파라미터 동일하게 통과.
- 패턴 일반화: 다른 엔드리스 표면(InfiniteScrollFeed 등)도 같은 3단(미러 RPC + authed 라우트 + 소스 스위치)으로 확장 가능. **원칙 유지: 캐시되는 서버 HTML은 불변, 개인화는 로그인 전용 동적 API로만.**

## v1.4 — 엔티티 인덱스의 "내 것" 뷰 + TakeScore 스왑 (2026-07-06)

트롭/콘셉트/이론가/전통/감독 인덱스는 행이 집계 카운트만 실어 클라 계산 불가 → **only 모드에서 리스트 자체를 per-user 랭킹으로 교체**:

- DB: `tropes_mine · concepts_mine · theorists_mine · traditions_mine · directors_mine (p_user,p_limit,p_offset)` — 각 인덱스 RPC 미러 + user_movies seen 조인, "내 영화 몇 편에 닿는가(n)" 내림차순. `cinecodex_ranked_mine`은 TakeScore 전 파라미터 미러. **전부 service_role 전용**(마이그레이션 lens_entity_mine_rpcs).
- 콘셉트 경로: takes.concept(text) → concept_map(raw_l) → sm_concepts — sm_concepts 자체엔 영화 링크 없음.
- API: `/api/lens/entities?kind=` (5종 스위치), `/api/lens/takescore` (필터 패스스루) — 세션 검증+admin.
- UI: `components/MineEntityIndex.tsx` — only 모드에서만 fetch·렌더(.th-grid 재사용). 퍼블릭 리스트는 `.mtl-swap-out`으로 감싸면 CSS(`html[data-mtlens="only"] .mtl-swap-out{display:none}`)가 숨김. 적용: /tropes(IndexPattern 전체 스왑) /idea /theorist /tradition /director(DirectorsIndex 스왑) + /takescore(CodexExplorer가 fetchPage에서 소스 스위치, 서버 풀랭킹 섹션도 스왑아웃).
- 퀵바 추가: 위 6곳 + /trending(오버레이만으로 충분) + /catalog(허브).
- **미적용·이유**: /catalog 허브의 mine 노드 랭킹(축별 top_nodes 미러 필요 — 후속), /credits(TMDB id 공간 + 자체 SEEN localStorage 시스템 — 렌즈 slug와 브리지 필요, /api/credits/links 활용 가능), /latest(이종 그리드 <70%), film 질문 피드 /api/feed(커서 기반 — 3단 패턴 후속 후보).

## v1.5 — /film only-mode 연속 리스트 + 미디어 행 디자인 (2026-07-06)

- `films_mine(p_user)` 추가(최신순, poster_path 포함), `directors_mine`에 profile_path(img) 추가 — 둘 다 service_role 전용(마이그레이션 lens_films_mine_and_director_faces).
- /film 기본·전체 뷰 모두 only 모드에서 FilmsIndex/idx-grp를 `.mtl-swap-out`으로 숨기고 MineEntityIndex(kind=films, imgShape=poster)로 교체 — A–Z 고스트 공백 없이 내 702편이 최신순 연속 나열.
- MineEntityIndex `imgShape` 도입: "poster"(영화 28×42 썸네일+연도), "round"(감독 34px 원형 얼굴+N of yours). 한 줄 고정(ellipsis), 반응형 2–3단(minmax 300px auto-fill), 모바일 1단. 이미지 없는 kind는 기존 th-grid 유지.

- 포스터/백드롭 카드(img 포함 앵커): highlight=이미지 안쪽 2px 액센트 아웃라인, only=고스트+클릭 차단
- img 없는 블록 앵커(bg-image 카드·리딩 블록): highlight=무표시(오탐 방지), only=고스트
- 인라인 텍스트 링크(display:inline*): highlight/only=✓ 첨자, only에서 흐림(.45) — 산문 흐름 보존, 제거 금지
- 갤럭시(캔버스): only=점 제거(내 갤럭시), 사이드 패널 ✓·"yours only" 표기. directors 모드는 미적용
- 그래프(EntityGraph): only=흐림(.15)만 — 노드 제거는 그래프 구조 왜곡이라 금지
- 지리 지도(FilmMap): 단일 영화 자기 지도(scope=film)에는 미적용
- 아이콘 앵커("↗" 등 텍스트 3자 미만): 무표시(✓ 노이즈 방지)

## 남은 것 / 다음 단계

1. **프로덕션 로그인 E2E** — 로컬은 auth 쿠키가 없어 시뮬레이션으로 CSS·엔진 검증 완료. 배포 후 실제 계정으로 3모드 확인 필요.
2. (v2 후보) ask/RAG retrieval을 seen 세트로 제한("내가 본 영화 중에서 답해줘") — 동적 API라 캐시 문제 없음
3. (v2 후보) random/surprise "내 영화 중에서" 파라미터
4. (v2 후보) only 모드에서 안 본 영화 상세 진입 시 스포일러 가림막
5. (v2 후보) bg-image 카드(home2 Newly/DirectorsBlock 등) highlight 표시 — 현재는 only 고스트만
6. (알려진 소소함) /film 인덱스 Featured 뷰는 포스터가 앵커 밖이라 보더 미적용(인라인 ✓는 적용됨)

## 검증 기록 (2026-07-06)

- 스코프 tsc 클린(선재 에러 2건 제외: GalaxyMap roundRect narrowing, lib/nativeName.ts — 둘 다 렌즈 무관, `ignoreBuildErrors`로 빌드 영향 없음)
- `next build` exit 0, /my-films 프리렌더 확인
- 로컬 실사(next start): /my-films·토글 드롭다운·홈 리본·갤럭시 렌더 OK, 콘솔 에러 0
- 감독 페이지에서 엔진 시뮬레이션: highlight 보더·only 고스트 스크린샷 확인
