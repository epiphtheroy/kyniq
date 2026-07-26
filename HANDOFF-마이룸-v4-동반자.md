# HANDOFF — 마이룸 v4: 동반자의 방 (라이트·통합·응축)

> **v3(다크 OS 조종석)의 후계 정본.** 정체성 결정(사업전략 §6.5) 이후 마이룸은 파워유저의 별세계가 아니라
> **사이트의 심장**이다 — 따라서 사이트와 같은 언어(페이퍼·잉크·레드·포스터 밀도, 전환마스터 §4.3)를 쓴다.
> v3 문서(HANDOFF-마이룸-v3-redesign.md)는 이력으로 보존. 오너 지시(2026-07-26): 블랙 부담·메뉴 과다·
> 노헤드 재고·지도 가시성·임포트 혼란·앱 연동 설명·wtw 작동·간격 과다 금지·썸네일 확대.

## §1. 설계 결정 (v4)

1. **정체성 = 사이트와 한 몸.** `.room-root` 다크 토큰 → 라이트 페이퍼 토큰 전면 교체(§3 매핑).
   room CSS는 전부 `.room-root` 스코프라 사이트 무영향(정찰 검증).
2. **노헤드 종료.** 전역 SiteNav를 룸 위에 복귀. RoomShell의 fixed-inset 전면 점유 해제(풋터 복원).
3. **좌측 레일(15항목) 제거 → 상단 슬림 룸바.** 주요 문 6개(Screener·Slate·Ledger·Coverage·Locations·
   Takes) + More(나머지 전부). **URL 15개 전부 유지** — 표현만 응축(북마크·색인 무파괴).
   우측 Inspector 슬라이드오버 = **적합 판정, 유지**(온디맨드·콘텐츠 비경쟁).
4. **/room 데스크 = 3질문 3섹션** (스티키 세그먼트 탭 [Tonight · My Map · Records]):
   - **Tonight**: QuickRate 로그바 + Tonight 히어로(me_recommend_wwi, 포스터 전면) + Screener 문 +
     **wtw 브리지**("모든 조건으로 찾기 → /what-to-watch").
   - **My Map**: 정전 커버리지+블라인드스팟(me_coverage/blindspots) + 감독 정복(통합 표시) + 세계지도
     (라이트) + 시그니처 요약 칩 → 각 심화 페이지 문.
   - **Records**: 세션 테이프(최근 평가 포스터 레일) + NAV 스파크라인 + 문 카드(Slate·Ledger·Shelf·Takes).
5. **지도**: SVG 유지(MapLibre 아님 — 프라이버시·경량 자산). 라이트 육지/바다 + 고대비 점 2종.
6. **밀도**: 간격 8~14px대, 포스터·인물 썸네일 확대 사용, 허공 큰 숫자 금지 — 칩·행으로.
7. **임포트/연동**: /me/import 타일·3단계·정직 카피("웹·앱=한 계정 한 기록" — 검증된 사실) + 웹 OAuth
   콜백/allowlist 코드(env 대기, 오너 개통 시 웹·앱 동시 점등). 별도 에이전트 트랙.

## §2. 스코프 규율 (오늘 하지 않는 것)

- 라우트 삭제/이동 없음 · 워크스페이스 15개 내부 로직 재작성 없음(테마+셸+데스크만) ·
  지도 기술 교체 없음 · 폰트 교체 없음 · me_* RPC 변경 없음.

## §3. 라이트 토큰 매핑 (room.css `.room-root{}` + 13개 워크스페이스 CSS 헥스 스윕)

| 토큰/헥스(다크) | v4 라이트 |
|---|---|
| --bg #0A0A0B | #FAF8F3 (웜 페이퍼) |
| --pnl #141416 / #151517 / #1a1a1c | #FFFFFF (카드) |
| #26262c 계열(패널2/보더진한) | #F1EDE4 |
| --ink #ECEAE5 | #141414 |
| ink-soft/faint 계열 | #4A4640 / #8A857C |
| 라인/보더(어두운 계열) | #E4DFD3 |
| --red #E3120B | 유지 |
| --safe #1FB286 | #127B5C |
| --frontier #3E8FE0 | #1F6BB8 |
| --canon #C8922B / #edc873 / #e0bb6e | #8F6A1E |
| --risk | #B3261E |
| #86b9ec / #5fd0b2 등 파스텔 | 동일 계열 진한 톤(라이트 AA 대비) |
| 지도 .at-map | 바다 #F3EFE6 · 육지 #E2DCCB · filmed 점 #E3120B · setting 점 #1F6BB8 |

그림자: 0 1px 3px rgba(20,20,20,.07) 수준의 절제. 글로우/네온 효과 제거.

## §4. AS-BUILT (2026-07-26 구현 완료)

- **셸**: RoomShell v4 — fixed-inset 해제(정상 플로우·풋터 복원), SiteNav 복귀(app/room/layout.tsx),
  레일 제거→룸바(`roombar`: My Room + PRIMARY_DOORS 6 + More 드롭다운(MORE_DOORS 8+Import) + NAV칩·Brief·
  검색·새로고침·프로필). 구조 CSS는 **room-v4.css 별도 파일**(room.css와 동시편집 충돌 회피).
  lib/room/nav.ts: PRIMARY_DOORS/MORE_DOORS 추가 — NAV_GROUPS/NAV_ITEMS는 CmdK용 보존, 라우트 15개 전부 유지.
- **데스크**: 3섹션(#tonight/#mymap/#records) + 스티키 탭. Tonight=로그바+히어로+**wtw 브리지**("Every filter
  → What to Watch") / My Map=정복·블라인드스팟·지도·시그니처·마스커레이드 문 / Records=테이프+NAV라인+
  Slate·Shelf·Takes·**Import** 문. "Open jobs" 밴드 해체·재배치.
- **테마**: 14 CSS 라이트 전환(토큰블록+~180 헥스 스윕, WCAG AA 스크립트 검증, 지도 라이트 팔레트,
  글로우→절제 그림자). + **TSX 인라인 잔재 9곳 수정**(CSS 에이전트 범위 밖 — LocationsWorkspace 링/카운트
  텍스트 #ECEAE5→#141414, EvalCard 링, 지도 점 스트로크→흰 헤일로, Takes/Shelf 레전드). 가면 눈 등
  일러스트 다크는 의도적 유지. ⚠️v3 다크 복원은 git 이력에서.
- **임포트/연동**: 소스 타일 6종+가이드 1줄, 3단계 행, 정직 배너("웹·앱=한 계정 한 기록"=검증 사실 /
  OAuth="준비 중, 열리면 양쪽 동시"), 성공 시 My Room CTA 우선. 웹 OAuth: start allowlist에
  `<origin>/connect-callback` 추가+콜백 페이지 신설(strict-mode 이중마운트 방어) — **env(CONNECT_TOKEN_KEY·
  TRAKT_*·SIMKL_*) 오너 설정 시 웹·앱 동시 점등**, 그 전까지 타일 "Coming soon" fail-soft.
- 검증: tsc 20/20 유지(3회) · 클린 프로덕션 빌드 통과 · 4사전 무관(웹만).

## §5. 개정 로그
- 2026-07-26 v4 최초 — §1 결정 + §4 구현. 테마=에이전트(CSS 14파일), 셸·데스크·TSX잔재=직접, 임포트=병렬 에이전트.
- 2026-07-26 **v4.1 "문이 아니라 미리보기"** (오너 라이브 검수: 4체크포인트 전부 불합격 → 재조판) —
  ①정체성 스트립(708 watched·329 loved·NAV 한 줄) ②Tonight 2단(히어로+Up next 포스터 2×2+풀 설명+wtw 버튼)
  ③My Map 3카드: 커버리지 실제 바+블라인드스팟 / **MiniWorld 실제 세계지도**(LocationsWorkspace와 동일
  투영·경로, 900핀) / 감독 얼굴 4명+% ④Records: Portfolio 카드+칩 행 — **풀폭 라벨→공백→숫자 행 전면 폐기**
  ⑤룸바 중앙정렬·NAV칩 필 ⑥인스펙터 시트에 연속감 링크(TakeScore 풀카드·필름 페이지) ⑦커버리지 페이지에
  감독별 커버리지 스트립(me_auteur_conquest 8명). 마감: 평평한 스파크라인=미표시(직선이 밑줄로 오독),
  히어로 stretch 해제, 룸 티커 페이퍼화(마지막 검은 띠). 데이터: page.tsx에 me_auteur_conquest+me_geo_coverage
  추가(서버 병렬). 라이브 검수=스크린샷 2회(994a053→7d9bd44). ⚠️NAV 히스토리가 평평하면 스파크 전부 숨음(의도).
