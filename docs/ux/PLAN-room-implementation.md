# /room — 커맨드센터 구현 기획 (실행 정본)

> 목적: `mockup-me-*.html` 10종(다크 "운영시스템 셸")을 **실서비스**로 전환한다.
> 정본 의도: `HTML-DESIGN-HANDOFF.md` · 표시규약: `SHARED-STANDARD.md`(S1–S11) · 로직: `docs/logic/`(9엔진).
> 이 문서는 *어떻게 지을지*(아키텍처·라우팅·CSS·데이터 계약·단계)를 못박는다. 작성 2026-07-01.

## 0. 확정 결정 (사용자 승인)
1. **라우팅** = `metatake.net/room/*` 서브패스(Next App Router route group). 기존 로그인 세션 그대로 SSO. 배포 하나. 도메인 분리 안 함.
2. **구현** = **Next React 포팅**. 목업은 *비주얼 정본*. 공유 셸 컴포넌트 + 전용 스코프 CSS 토큰 레이어 + 서버컴포넌트가 `me_*` RPC로 라이브 데이터.
3. **1차(Phase 1)** = 공유 셸 + 유니버설 인스펙터 + **Watchlist** + **Collection**. (데이터 대부분 이미 준비됨 → Cinecodex 통합의 심장을 가장 빨리 실물로.)

## 1. 대원칙 (어기면 로직 약속 위반 — HANDOFF §6 ★★★)
- **비섞임 나란히**: Cinecodex(V/C/R/U/S) · 외부(imdb/rt/meta) · 정전가(prestige)는 *절대 한 숫자로 합치지 않는다*. 분리 칸.
- **위험색 분리**: 위험 R = `--risk`(#D64518). 완파/정복 `--red`(#E3120B) **재사용 금지**.
- **NAV 단조**: 관람은 NAV를 깎지 않는다(포화·감쇠만).
- **설명가능 인스펙터**: 무엇을 클릭하든 우측 인스펙터가 "그것의 상세 + 왜 이 값"으로 스왑.
- **실 숫자만**: 목업 하드코딩 대신 `cinecodex_for`·`film_scores`·`me_*` 실값. (검증: Parasite V67/R18/U49·S1.0, Vertigo V86/R17/U69 = 라이브 `cinecodex_for`와 일치 확인됨.)
- **콜드스타트**: <8편 사용자는 "형성 중"(`--forming` 골드) + 신뢰도 감쇠.
- **공개 프로필 금지 항목**: 13서브·신뢰도·prompt_sha는 다크 셸 전용.

## 2. 라우트 · 파일 구조
```
app/room/
  layout.tsx            # RoomShell 마운트 + 인증 가드 + room.css import + <div class="room-root">
  room.css              # 전용 다크 토큰 레이어 (globals.css/home2.css와 완전 격리)
  page.tsx              # 현황 Command Center (Phase 2)
  watchlist/page.tsx    # 볼 영화 (Phase 1)
  collection/page.tsx   # 보유 (Phase 1)
  desk/page.tsx         # 운용 Asset Desk (Phase 2)
  analysis/page.tsx     # 분석 (Phase 3)
  rate/page.tsx library/page.tsx write/page.tsx pair/page.tsx  # Phase 3
  film/[slug]/page.tsx  # 평가 카드 풀뷰 (Phase 2, cinecodex 풀분해)
components/room/
  RoomShell.tsx         # appbar+ticker+rail+{main}+inspector+activity, 접이(localStorage)
  Rail.tsx  AppBar.tsx  Ticker.tsx  Activity.tsx
  Inspector.tsx + InspectorContext.tsx   # 인스펙터-스왑 (클라이언트 상태)
  CinecodexCard.tsx     # S11 나란히 카드 (인스펙터/평가카드 공용) ← 기존 CinecodexPanel 로직 재사용
  cards/*  (WwiBreakdown, StandingCard, ValueBadge2Axis, Availability, RiskBadge …)
  CmdK.tsx              # ⌘K 팔레트 (film_search RPC)
lib/room/
  types.ts              # 엔진 출력 타입(공유)
  rpc.ts                # 서버측 supabase 래퍼 (me_* 호출 헬퍼)
```
- 공개 프로필(`profile`)은 **라이트 스킨** — /room 다크 셸 밖(`/u/[username]` 기존 유지). /room 안엔 안 넣는다.

## 3. 공유 셸 아키텍처
- **RoomShell**(client): appbar · ticker · `.shell`(4열: `.rail` `.main`(children) `.inspector` `.activity`). 각 열 접이 = `.collapsed` 토글 + `localStorage`(`mt_rail`/`mt_inspector`/`mt_activity`). `@media(max-width:1280px)` 인스펙터 자동 접힘.
- **InspectorContext**(client): `select(payload)` → 인스펙터 콘텐츠 스왑. 비면 페이지 기본 "분석 요약". 행/카드 클릭 → context.select. 인라인 액션은 `stopPropagation`.
- **main 콘텐츠**만 페이지마다 다름. rail 글로벌 네비 목록·appbar·ticker·activity 프레임은 전 페이지 동일.
- 서버컴포넌트(page.tsx)가 RPC로 데이터 페치 → 직렬화해 client 워크스페이스/행 컴포넌트에 props. 인터랙션(정렬·λ·필터·별점)은 client에서.

## 4. CSS 전략 (전용 레이어 · 완전 격리)
- `app/room/room.css`에 목업 `:root` 토큰 전량 이식하되 **`.room-root` 스코프**로 감싼다(전역 `:root` 오염 금지 — 라이트 본사이트와 충돌 차단).
- 클래스명은 목업 CSS 계약을 **그대로 재사용**(.appbar/.rail/.nv/.rrow/.xrow/.icard/.ccaxes/.sbs …) → 목업 스타일 대량 이식 가능, 회귀 최소.
- 폰트: PT Serif + Inter + mono. Tabler Icons webfont(목업과 동일 CDN) 또는 lucide 대체(결정: 초기엔 Tabler webfont 유지 — 아이콘 일치도↑).
- globals.css/home2.css는 **건드리지 않는다**. `.room-root`가 다크 배경·색·타이포를 자체 완결.

## 5. 데이터 계약 — 엔진 → RPC (있음/만들것)
| 엔진 | 쓰임 | 상태 |
|---|---|---|
| ⑨ Cinecodex | `cinecodex_for(slug)`·`cinecodex_ranked`·`cinecodex_confidence` | ✅ 있음 |
| ② 정전가 | `film_scores`(prestige/discovery)·`portfolio_breakdown`·`film_lineage_for` | ✅ 있음 |
| ⑧ NAV | `me_portfolio_nav`·`nav_counts` | ✅ 있음 |
| ⑤ WWI | `me_recommend_wwi(λ)` | ✅ 있음 (Δindex 필드 추가 필요) |
| ⑥ 취향/유사 | `me_taste_neighbors`·`film_taste_vector` | ✅ 있음 (별자리 me-scoped 추가) |
| 보유/후보 | `me_watchlist_scored`·`me_watched_scored`·`me_takescore_summary` | ✅ 있음 |
| ⑦ 커버리지 매트릭스 | 라인별 %·가중·완파 4상태 | ❌ **신규 `me_coverage()`** |
| ④ 블라인드/공백 | 안 본 권위 계보 + gap 이유 | ❌ **신규 `me_blindspots()`** |
| ⑤ Δindex | 후보별 한계 NAV 기여 | ⚠ `me_recommend_wwi`에 컬럼 추가 |
| 가용성 3상태 | 구독 채널(지역) | ⚠ 기존 watch-provider 데이터 → `me_watchlist_scored`에 조인 |
| Asset Desk 5전략+P&L | 전략별 후보·자산곡선·적중률·regret | ❌ 신규(Phase 2) |
| 라이브 티커 이벤트 | 신규등재·재평가·완파근접 | ❌ 신규 `room_ticker()`(Phase 2, 없으면 정적 폴백) |

**Phase 1이 쓰는 것**(대부분 있음): `me_watchlist_scored`·`me_watched_scored`·`me_takescore_summary`·`cinecodex_for`·`film_scores`·`me_portfolio_nav`. 신규는 collection 2축 뱃지용 정전가 조인 정도 → `me_watchlist_scored`/`me_watched_scored`에 `prestige` 필드 추가(경량).

## 6. Cinecodex 표시 (S11) — 공용 CinecodexCard
- `cinecodex_for` 출력(V/C/R/U/S + 13서브 + conf/tier/votes + ext)을 다크 인스펙터 스킨으로.
- **나란히 3분할** `.sbs`(우리 V/R/U | 외부 imdb/rt/meta | 정전가 prestige). 절대 합산 금지.
- 위험 R = `--risk` 배지(`.riskbadge .lo/.mid/.hi`). 분열성(고 polar)은 흐리지 말고 별도 「분열성」 배지.
- 신뢰도 낮음 = 흐림 + 플래그. 재현성 카드(접이). 미평가 = 흐린 「Cinecodex 미평가」.
- **가치뱃지 2축**(collection): 별점% − 정전가 = 시장합치 / 별점% − V = 분석합치. 두 축 분리(⚡ 시장≠분석).
- 이미 만든 `components/CinecodexPanel.tsx`(라이트) 로직을 다크 `CinecodexCard`로 이식(2×2·신뢰도·13서브 재사용).

## 7. 단계 (Phased)
**Phase 1 — 셸 + 인스펙터 + Watchlist + Collection** (현재)
1. route group + `room.css` 토큰(.room-root 스코프) + 인증 가드.
2. RoomShell(appbar·ticker·rail·inspector·activity·접이) + InspectorContext + CmdK(film_search).
3. Watchlist: 툴바(전략필터·정렬·λ 다이얼·위험필터·검색) + 후보행(rank·6이유칩·WWI·U·위험배지·Δindex·가용성·인라인액션) + 인스펙터(WWI분해 + CinecodexCard + 담기).
4. Collection: 자산테이블(포스터·제목·계보배지·정전가·V·U·별점·2축뱃지) + 인라인별점 + 공개토글 + 인스펙터(정전가분해 + CinecodexCard + 2축뱃지).
5. 필요한 RPC 경량 확장(prestige/gap 필드) + 배포 + 라이브 검증.

**Phase 2 — Command Center + Asset Desk + 평가카드 풀뷰**
- 신규 RPC: `me_coverage`(⑦ 4상태)·`me_blindspots`(④)·`me_recommend_wwi`에 Δindex·5전략 P&L·`room_ticker`.
- Command Center(NAV 히어로 분해·KPI·커버리지 매트릭스·WWI 데스크·별자리) · Asset Desk(5전략·P&L·샤프정렬·λ) · `room/film/[slug]`(풀 Cinecodex 분해).

**Phase 3 — Analysis(μ–σ 평면) + 기록/서재/노트/동행**
- Analysis μ–σ(V×R 산점) · onboard-rate(반쪽별·이웃 fly-in) · library · write · pair(싱크율).
- profile은 기존 라이트 `/u/[username]` 유지(다크 금지 항목 준수).

## 8. 인증 · 접근
- /room/* 전부 로그인 필수(개인 OS). `app/room/layout.tsx`에서 세션 없으면 `/login?next=/room` 리다이렉트. RPC는 이미 `auth.uid()` 스코프 SECURITY DEFINER.

## 9. S1–S11 준수 체크(Phase 1 해당)
S1 「오늘의 한 편」 · S2 blind amber/forming gold · S3 가용성 3상태 · S5 용어집 hover · S6 반쪽별 자동 봤어요 · S7 인라인 액션바 · S8 담기=워치리스트 마킹(이동 없음) · S9 공개토글(collection 행) · **S11 Cinecodex 나란히·위험색·신뢰도·2축**.

## 10. 리스크 · 미결
- 목업 인라인 JS(수백 함수) → React 상태로 재작성(그대로 복붙 불가). 셸/인터랙션은 재구현.
- Tabler webfont vs lucide: 초기 Tabler 유지.
- `--red`/`--risk`/`--conquer` 토큰 분리 전수 확인(오독 방지 ★★★).
- 성능: 서버컴포넌트 페치 + 행 많음 → 가상화는 후순위(초기 수십~백 행).
- 기존 `/me`(라이트)와 /room 관계: /me는 유지, /room은 상위 "운영 셸". 나중에 /me→/room 승격 여부 별도 결정.
```
```
