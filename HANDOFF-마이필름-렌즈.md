# HANDOFF — My Films 렌즈 (전 사이트 개인화 오버레이)

작성: 2026-07-06 · 상태: 구현 완료, 로컬 검증 완료, 프로덕션 로그인 E2E 대기

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

## 엔티티별 렌즈 규칙 (기획 결정)

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
