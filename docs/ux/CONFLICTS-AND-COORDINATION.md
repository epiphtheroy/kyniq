# UX 직관화 패스 — 교차 조율·충돌 해소 (consolidated `[⚠ COORD]`)

> 10개 페이지 병렬 UX 패스에서 각 에이전트가 올린 `[⚠ COORD]`를 클러스터로 통합. **페이지-로컬 개선은 이미 적용됨**(각 `docs/ux/<page>.md`). 여기 있는 것은 *공유 셸·어휘·백엔드*에 닿아 **일괄 결정**이 필요한 항목이다. 작성 2026-06-26. 출처: `docs/ux/{command-center,collection,watchlist,asset-desk,analysis,onboard-rate,library,write,pair,profile}.md`.

각 클러스터: 영향 페이지 · 증거 · **제안 결정** · 분류(🎨 디자인-now / 🔧 백엔드-defer) · 우선순위.

---

## C1 — 공유 별점 + 인라인 액션 컴포넌트 ★최우선 (7개 페이지 반복)
**영향:** command-center · collection · watchlist · onboard-rate · library · asset-desk · write
**증거:** 각 페이지가 인라인 별점·담기·봤어요·관심없음·공개토글을 *page-local mock*(toast+DOM 상태)로 따로 구현 → 표기·동작·피드백이 미세하게 다름.
**제안 결정:**
- 🎨 **공유 별점 컴포넌트 1종** — 0.5–5 half-star, hover preview, 키보드/a11y, 옆에 "0.5–5" 스케일 단서, "평점⟹봤어요" 자동. 전 페이지 동일 클래스(`.starwrap`).
- 🎨 **공유 인라인 액션 바** — 담기 / 봤어요 / 관심없음 / 공개토글: 동일 아이콘·위치·피드백(toast·✓·fade).
- 🔧 **RPC**: `rate_film(0.5–5)`→가치뱃지·NAV 재계산 · `mark_watched` · `dismiss_candidate`(부정 신호) · `add_watchlist` · `set_visibility`. optimistic UI.
**우선순위: 1.**

## C2 — 추천 "오늘의 한 편" 명칭 통일
**영향:** command-center · watchlist · asset-desk · analysis
**증거:** 같은 *Δindex 최상위 1편*을 "오늘 할 일/오늘의 한 편"(현황) · "오늘의 한 편"(워치) · "오늘의 최대 알파"(운용)로 제각각.
**제안:** 🎨 정본 1종 — **「오늘의 한 편」** + 부제 `최대 Δ · → NAV +N`. 전 추천 표면 동일.
**우선순위: 2 (저비용·고효과).**

## C3 — 블라인드/공백 의미색 분리 (색 충돌)
**영향:** command-center · analysis · watchlist
**증거:** 블라인드(미답)가 conquer(완파)와 같은 `--red` 사용 → 빨강이 "정복"이자 "안 가봄" = 의미 충돌.
**제안:** 🎨 블라인드 = *gap의 절대형* → **6이유 정본의 `gap`(amber)** 계열로 통일, conquer red에서 분리. `--blind` 토큰(amber) 신설. **MASTER-INDEX/00-INDEX §4 동기화 필요.**
**우선순위: 2.**

## C4 — 용어집(glossary) 공유 툴팁
**영향:** 전 페이지
**증거:** rel/cov/WWI/NAV/aw/정전가/정복도/블라인드 약어가 페이지마다. analysis가 `.gloss`(점선 밑줄+hover 정의) 도입.
**제안:** 🎨 공유 `.gloss` 컴포넌트 + 정본 용어 사전 1개. 첫 등장 시 hover 정의.
**우선순위: 3.**

## C5 — 가용성 3-상태 표기 표준
**영향:** watchlist · command-center · collection
**증거:** watchlist가 가능(solid green) / 미확인(hollow ring) / 만료(pill D-N) 도입 — "정보 없음 ≠ 안 됨" 명료화.
**제안:** 🎨 이 3-상태를 6+가용 정본에 표준 추가.
**우선순위: 3.**

## C6 — 담기 동작 의미 통일
**영향:** watchlist · collection · command-center · asset-desk
**증거:** inspector "담기"=collection으로 *페이지 이동* vs 인라인 "담기"=*제자리 마킹*. 두 경로 결과 불일치.
**제안:** 🎨+🔧 **담기 = 워치리스트에 추가(제자리 마킹 + toast, 이동 없음)**. "보유로 이동"은 봤어요로 분리. 정본 동사 확정.
**우선순위: 2.**

## C7 — 공개/비공개(visibility) 모델 통일
**영향:** collection · library · write · profile
**증거:** 항목별/섹션별 공개 토글이 전부 front-only(`pubState`). profile은 `portfolio_public` 섹션 화이트리스트.
**제안:** 🎨 공개 토글 pill 1종(공개 중/비공개 + eye). 🔧 통합 모델 — item-level(`user_movies.visibility`·서재 항목) + profile section-level(`portfolio_public` 화이트리스트). `set_visibility` RPC. **화이트리스트 투영은 RPC/뷰 레벨 강제**(프런트 가림은 보조) — Phase 4 §5 `public_profile_projection`과 연결.
**우선순위: 2 (프라이버시).**

## C8 — 완파 상태 3-state 표준
**영향:** profile · command-center · analysis
**증거:** profile이 정복/근접/잠금 도입.
**제안:** 🎨 완파 어휘 정본 — 잠금(<50%) / 진행(50–74) / 근접(75–99) / 완파(100). **Phase 4 `fire_lineage_milestones`(50/75/100)와 일치.**
**우선순위: 3.**

## C9 — "형성 중" 라벨·임계·색 통일
**영향:** pair · onboard · command-center
**증거:** `taste_forming`(loved<8) vs 포트폴리오 `forming`(watched<8). pair가 red→골드 중립으로 정정(오독 방지).
**제안:** 🎨 골드 중립색 + "형성 중 (N편)". 두 forming 구분은 로직 문서대로(Phase 2 `taste_forming`). **red 금지.**
**우선순위: 3.**

## C10 — 가면무도회 보라 토큰화
**영향:** pair (전용) **제안:** 🎨 하드코드 보라(`#9B8CF0`…) → `--masque` 토큰. **우선순위: 4.**

## C11 — write 인스펙터 반응형 예외
**영향:** write (공유 미디어쿼리 원인)
**증거:** `@media(max-width:1280px)`가 인스펙터(첨부 레일)를 강제 접음 → write의 핵심 "엮기"(영화/figure/트로프 첨부) 불가.
**제안:** 🎨 write만 인스펙터 유지(페이지 예외 클래스) 또는 인라인 첨부 폴백. **우선순위: 2 (기능 차단).**

## C12 — 형상(`--figure`) 색 토큰 확인
**영향:** library **제안:** 🎨 `--figure`(#86b9ec) 단독 사용이 6타입 색 정본과 충돌 없는지 확인·정의. **우선순위: 4.**

---

## 해소 순서 제안

**A. 즉시 — 디자인-only 일괄 하모나이즈 (공유 토큰/컴포넌트 1패스, 병렬 충돌 제거):**
C2(명칭) · C3(블라인드색) · C4(용어집) · C5(가용성 3상태) · C9(형성중 색) · C10(masque) · C11(write 반응형) · C12(figure색) + C1·C7의 *비주얼 표준*(별점·인라인 액션·공개 토글 마크업 통일). → 셸 토큰/공유 컴포넌트에 반영 후 전 페이지 클래스 교체.

**B. 다음 로직 단계 — 백엔드 전제(이미 Phase 0–4 슬롯 존재):**
C1(rate/watched/dismiss/add RPC) · C6(담기 의미) · C7(visibility 모델·화이트리스트 강제) · C8(완파 마일스톤). → UX 발견을 `phase2-taste.md`(평점·담기·취향 반응) / `phase4-delight.md`(완파·공개 투영) / `phase0-invariants.md`(visibility·watched)에 **요구사항으로 역반영**.

**권장:** A를 공유 하모나이즈 1패스로 지금 적용(디자인 우선 원칙) → B는 로직 문서에 반영해 다음 백엔드 단계로.

---

*병렬 패스의 미덕: 10개 시선이 같은 마찰을 독립적으로 짚으면, 반복되는 것이 진짜 공유 문제다. 위 12개 중 C1·C3·C6·C7이 4개 이상 페이지에서 동시에 나온 = 최우선 공유 결정.*
