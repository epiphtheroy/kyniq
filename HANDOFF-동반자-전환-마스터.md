# HANDOFF — 동반자 전환 마스터 (홈·메뉴·온보딩·마이룸·앱 대개편)

> **정체성 결정(2026-07-24, `HANDOFF-사업전략-생존과성장.md` §6.5)의 실행 기획 정본.**
> B(시네필의 시청 사이클 동반자)를 척추로, A(출판)를 배경 복리로. 이 문서는 그 전환의 **큰 기획**이다 —
> 승인되면 페이즈별 **세부 수정 지침**(별도 작업지시서)으로 내려간다.
>
> 상태: **기획 v1 (2026-07-24) — 오너 결정 D1~D6 대기.** 작성 근거 = 현행 Nav/홈/온보딩 실사(§1).

---

## §0. 전환의 한 문장

> 사이트의 얼굴을 "AI가 쓴 영화 백과"에서 **"오늘 밤 뭘 볼지, 방금 본 게 뭐였는지, 내가 어디까지 왔는지를
> 답해주는 도구"**로 바꾼다. 콘텐츠 2만 페이지는 삭제하지 않는다 — **도구의 데이터베이스로 재정의**된다.

**철칙 (색인 전환 원칙, 사업전략 D2):** 이 개편은 **URL을 바꾸지 않는다.** 네비 라벨·그룹·홈 구성·카피만 바뀐다.
리네임은 표시 라벨 층위이며 경로 이동·리다이렉트·noindex 변경 없음. → 구글 관점에서 요동 0.

---

## §1. 현행 실사 (2026-07-24, 코드 기준)

**네비 (components/home2/Nav.tsx, 6그룹):**

| 그룹 | 설명문(현행) | 항목 | 진단 |
|---|---|---|---|
| Watch | "re-seen through the framework" | Films·Directors·Latest·Trending | 카탈로그. 설명문이 A-언어 |
| Wander | **"How the latest AI scores, maps…"** | TV·TakeScore·What to Watch·Lineage·Locations·Movements·Connections·Where to watch·Credits **(9개)** | 🔴 **판단 도구 3종이 잡동사니에 매몰.** 설명문=AI 쇼케이스 |
| Read | **"What the AI is writing now"** | Now·Daily·Updates·Curious·Newsletter | 설명문이 슬롭 인상의 원천 |
| Theory | "ideas and thinkers" | Concepts·Theorists·Traditions·Strong Misreadings·Methodology | A-자산 |
| Patterns | "What recurs across cinema" | Tropes·Archetypes | A-자산(발견) |
| You | "Your shelf, your taste" | My Room·Import·(Settings/Sign in) | 🔴 **꼴찌 그룹.** B-정체성이면 척추인데 부속 취급 |

**홈 (app/page.tsx → HomeV2):** 로테이션 번들·Exhibits·ReadingsDesk — **잡지 1면형.** "오늘 뭘 볼까"의 답이 above-the-fold에 없음.

**앱:** 사이트 전체에 앱스토어/TestFlight 링크 **0건.** 앱(판단 내비게이터, TestFlight 빌드9)이 웹에서 완전 비가시.

**온보딩:** /signup은 계정 생성만. "가입하면 뭐가 좋아지나"의 가치 제안·첫 실행 흐름(임포트→마이룸) 부재.

**진단 요약:** 자산은 B인데 **얼굴이 A**다. 판단 도구는 숨고, AI가 전면이고, You는 꼴찌고, 앱은 없다.

---

## §2. 정보구조(IA) 원리 — 시청 사이클 3국면

모든 표면을 사용자의 시간축 3국면으로 재편성한다. **이것이 메뉴·홈·온보딩 전부의 단일 조직 원리다.**

| 국면 | 사용자 질문 | 표면 |
|---|---|---|
| **① Decide (보기 전)** | "오늘 뭘 보지? 이거 볼 가치 있나?" | What to Watch·TakeScore·Where to Watch·Surprise·Invitation(why-watch) |
| **② Understand (본 후)** | "방금 뭘 본 거지? 더 깊이" | 필름/감독 페이지·리딩·meaning·Locations·Tropes·Theory |
| **③ Journey (평생)** | "나는 어떤 관객인가? 다음은?" | My Room·Import·Odyssey/Journey/Board·**앱** |

뉴스층(Now/Daily)과 About/Methodology는 지원 표면. **A-자산(리딩·패턴·이론)은 전부 ②의 깊이로 존속** —
전면(포지셔닝)에서 내려올 뿐 사라지지 않는다.

---

## §3. 메뉴 개편안

### 3.1 그룹 구조 (6그룹 유지, 재편성+승격)

| # | 신그룹(안) | 흡수 | 설명문 방향(사용자 가치 언어로 전면 교체) |
|---|---|---|---|
| 1 | **Tonight** (Decide) | What to Watch·TakeScore·Where to Watch·Trending·Latest·Surprise | "Find your next film — scored for cinephiles." |
| 2 | **Films** (카탈로그) | Films·Directors | "Every film and director, in depth." |
| 3 | **Go Deeper** (Understand) | Locations·Tropes·Archetypes·Lineage·Movements·Connections·Concepts·Theorists·Traditions·Strong Misreadings·Credits | "After you watch — what it meant, where it was shot, what it echoes." |
| 4 | **My Cinema** (Journey) ⭐**2번째 위치로 승격 후보** | My Room·Import·**Get the app**·(Settings/계정) | "Your watching life — mapped, scored, remembered." |
| 5 | **News** | Now Playing·The Daily·Updates·Newsletter·Curious | "What's happening in film, hourly." |
| 6 | **About** (또는 풋터로) | About·Methodology·TV | — |

원칙:
- **판단 도구 3종은 반드시 1그룹(첫 번째)에.** Wander 잡동사니 해체.
- **My Cinema는 최소 2~3번째 위치** — "You 꼴찌"의 반대. 로그인 시 이 그룹이 개인화 진입점.
- **설명문에서 "AI" 주어 제거** — AI 저작 공개는 콘텐츠 페이지의 크레딧(기존 정책 유지)이 담당,
  네비는 사용자 가치 문장으로. (숨기는 게 아니라 자리를 옮기는 것.)
- Theory·Misreadings 등 A-자산 메뉴는 유지하되 Go Deeper 하위로 — **강등이 아니라 문맥 재배치.**

### 3.2 함정
- 라벨은 전부 `tr(locale, …)` 경유 — **신규 라벨은 ko 사전(lib/i18n/dict/ko.ts) 동시 추가** 필수.
- 용어 헌장(1명사=1실체) 준수 — "Tonight" 등 신그룹명이 기존 실체명과 충돌하지 않는지 확인.
- Nav.tsx = 계정 UI 정본 · 서버 HTML 비개인화 유지(계정은 클라 하이드레이션) — 기존 패턴 그대로.

---

## §4. 홈 개편안 — "잡지 1면"에서 "도구의 현관"으로

### 4.1 새 섹션 순서 (위→아래 = 3국면 순)

1. **🎯 Decision Hero (신규, above the fold):** "What should I watch tonight?" —
   국가/구독 인지 What-to-Watch 상위 픽(TakeScore 랭킹) 3~5편 + [모든 조건으로 찾기 → /what-to-watch] +
   [Surprise me]. 데이터는 기존 wtw 스크리너 RPC(v11) 재사용 — 신규 백엔드 불필요.
   로그인 시 클라 하이드레이션으로 개인화 스트립(내 서비스·이어보기) — **서버 HTML 개인화 금지 불변식 준수.**
2. **🔍 Just watched? (신규, 얇게):** 검색 바 + "방금 본 영화를 이해하기" — 필름 페이지(리딩·meaning·locations)로 유도.
3. **🗺 My Cinema 티저 + 앱 카드 (신규):** 마이룸 스크린샷/샘플 계기판 + "당신의 시청 이력을 지도로" +
   Import CTA + **Get the app** 카드.
4. **기존 자산 로테이션 (축소 유지):** Exhibits·발견(패턴)·로케이션 픽 — 배경 복리 A-자산의 진열.
5. **뉴스 스트립:** Now Playing/Daily (기존).

### 4.2 함정
- 캐시 규율 유지: **캐시키 시간시드 금지**(스탬피드), 홈 RPC 타임아웃 상수, LazyMount 청크 분리 — 홈 v8 §14 계약 승계.
- Decision Hero의 국가 감지는 엣지캐시와 충돌 주의 — v1은 **비개인화 글로벌 픽 + 클라 하이드레이션 보강**으로.

### 4.3 디자인 헌장 (2026-07-24 평가 확정)

**진단:** 현행 홈 = 이질적 시각 문법의 모듈 **19개**(신문데스크·지도·그래프·타일·레일…) = "만물 박람회."
①인지 부하(스크롤마다 새 문법 학습) ②"AI 대량생산 과시"로 읽혀 **슬롭 인상을 디자인이 증폭.**

**원리:** 문제는 요소 개수가 아니라 **문법 개수.** 장식 vs 정보를 구분 —
**포스터는 장식이 아니라 데이터다**(시네필은 포스터를 제목보다 빨리 스캔; Letterboxd 증명).

> **공식: 정보 밀도는 높게(포스터·점수), 장식 밀도는 낮게, 시각 문법은 2~3개로 통일.**

- 반복 패턴 3개로 전 홈 조판: ①포스터 레일+TS 칩 ②리스트 행 ③단일 피처.
- **TakeScore 칩 = 사이트 전체 단일 반복 요소**(지표 신뢰 디자인의 핵심 — Metacritic이 건조한 이유).
- 도구는 답 속도로 신뢰를 번다(JustWatch·Letterboxd) — 성능 자산(TTFB 0.06~0.2s) 유지.
- **B의 디자인 언어 시드 = /room의 계기판·OS 미학**(이미 사이트 안에 있음 — 퍼블릭 표면을 마이룸과 닮게).

**투 스피드 시스템:** 도구 층(홈·Tonight·마이룸·앱)=구조적·포스터 밀도·즉답 /
읽기 층(필름 페이지·에세이·로케이션·Poetics)=**현행 편집적 풍부함 유지**(읽기는 분위기가 보상).
공통 토큰(타이포·칩·간격)으로 통일. 홈은 19모듈 → **6~7섹션**으로 응축(§4.1 순서).

---

## §5. 온보딩 개편안 — "계정 만들기"에서 "포트폴리오 개설"로

1. **가치 제안 교체:** /signup 카피 = "Create your cinema portfolio" — 가입하면 얻는 것 3줄
   (①시청 이력 지도 ②취향 기반 tonight 픽 ③커버리지·블라인드스팟).
2. **첫 실행 흐름(핵심):** 가입 직후 → **Import(/me/import, 이미 라이브)** 권유 → 임포트 완료 →
   마이룸 첫 화면에서 "당신의 지도" 즉시 가시화 → tonight 픽 1개 제시. **활성화 = 가입→임포트→7일내 재방문.**
3. **비로그인 마이룸 미리보기(D4 결정):** /room을 샘플 데이터 데모 모드로 보여줄지 —
   전환율에 크게 유리하나 구현 비용 있음.

---

## §6. 앱 소개 배선 (현재 0 → 표준 세트)

1. **`/app` 랜딩 페이지 신설:** 판단 내비게이터 소개 — 스크린샷·3국면 가치·다운로드 버튼.
   (TestFlight 단계 카피 → App Store 출시 시 교체. 안드로이드는 출시 후 추가.)
2. **배선:** 네비 My Cinema 그룹에 "Get the app" · 홈 §4.1-3 카드 · 풋터 링크 · /room 상단 배너(모바일 UA일 때).
3. 앱 딥링크/스토어 URL은 `HANDOFF-모바일앱-프리워치.md` §−1 출시 실록 기준.

---

## §7. 뉴스레터 = 재방문 장치

- 주간 **"판단 다이제스트"**: 이번 주 볼만한 것(TakeScore 픽 3) + 깊이 읽기 1편 + 마이룸 훅.
- 기존 /blog/subscribe·Updates 자산 위에 리듬만 확립. 발신 규칙은 CRM 발송 금지원칙과 무관(구독자 옵트인).

---

## §8. 측정 (북극성 교체)

| 지표 | 정의 | 도구 |
|---|---|---|
| ⭐ 주간 재방문자 | 주 2회+ 방문 고유 방문자 | mt_events |
| 활성화율 | 가입→임포트→7일내 재방문 % | mt_events+DB |
| Decision Hero 관여 | 히어로 클릭→/what-to-watch·필름 도달 | mt_events |
| 앱 전환 | /app 방문→스토어 클릭 | mt_events |
| (관찰만) GSC | 노출·클릭·rest_google/day | GSC·기존 룰(8/5) |

---

## §9. 페이즈 (각 페이즈 승인 시 세부 수정 지침 별도 발행)

| 페이즈 | 내용 | 규모 | 선행 |
|---|---|---|---|
| **P0** | 이 기획 확정 — 오너 결정 D1~D6 | 대화 | — |
| **P1** | 네비 개편 (§3) — 그룹·라벨·설명문·ko사전 | 소 | P0 |
| **P2** | 홈 개편 (§4) — Decision Hero + 섹션 재배열 | 중 | P0 (P1과 병행 가능) |
| **P3** | 온보딩 (§5) — signup 카피 + 첫 실행 흐름 | 중 | P1 |
| **P4** | 앱 소개 (§6) — /app + 배선 | 소 | P0 |
| **P5** | 뉴스레터 리듬 (§7) + 측정 대시보드 (§8) | 소 | P2 |

배포 규율: app/components/lib=워처→staging, 루트 파일=수동 커밋, 릴리즈=오너 22시 release.command (배포체계 P0 준수).

---

## §10. 오너 결정 D1~D6 (P0 게이트)

- [ ] **D1. 신그룹명:** Tonight / Films / Go Deeper / My Cinema / News / About 안 승인 or 대안 (한국어 병기 여부 포함)
- [ ] **D2. My Cinema 위치:** 2번째로 승격 vs 현행 끝 유지
- [ ] **D3. Decision Hero 채택:** §4.1-1 안 승인 (홈 최상단이 바뀌는 가장 큰 시각 변화)
- [ ] **D4. 비로그인 마이룸 미리보기:** 샘플 데모 모드 만들지 (P3 범위 결정)
- [ ] **D5. /app 랜딩 카피 수위:** TestFlight 단계에서 공개 톤 (베타 명시 vs 대기명단)
- [ ] **D6. About/TV 처리:** 네비 6그룹 유지 vs About을 풋터로 내려 5그룹화

---

## §12. 실행 로그 (AS-BUILT)

### 2026-07-24 밤샘 실행 — P1~P4 구현 완료 (오너 승인: D1~D6 전부 추천안 + "애플/구글급 기능주의")

**P1 네비 (Nav.tsx + dict/ko.ts):** 6그룹→5그룹 재편 완료 — Tonight(href=/what-to-watch)·My
Cinema(2번째, 계정항목+Get the app)·Films·Go Deeper(12항목: 구 Wander 해체+Theory+Patterns+Methodology
흡수)·News(+Metatake TV). About/Methodology→풋터 존속(기존 링크 확인). 설명문 5종 전부 사용자가치
언어로 교체("the AI" 주어 제거 — 크레딧 정책은 콘텐츠 페이지 유지). ko 사전: 신규 라벨·설명문·"Get the
app" 추가, 구 그룹키 6종 제거(전 코드베이스 grep으로 미사용 확인).

**P2 홈 (HomeV2 v9):** 19모듈 → **8섹션**: DecisionHero(신규 — "What should I watch tonight?" h1 +
top-TS 포스터 스트립[기존 scrp-* CSS·cinecodex_ranked 재사용, /film/slug 딥링크] + CTA 3종) →
MyFilmsRibbon → JustWatched(신규 — /search GET 폼, no-JS 동작) → MyCinemaTeaser(신규 — 룸+앱 2카드,
스크린샷 위조 없음) → SurpriseStage(#surprise 앵커, 유일한 편집 로테이션으로 존속) → HomeLocations(웨지)
→ NowPlaying → ExploreLinks(신규 — 떨군 모듈들의 내부링크 경로를 평문 링크로 보존, 링크 자산 무손실).
떨군 모듈 16종은 파일 보존(재조립 가능). app/page.tsx: exhibits/readings 로더 제거(홈 DB 호출 2개 절감),
홈 메타 title "The Cinephile's Companion"으로 교체. CSS는 home2.css에 문법 3종만 추가(v9 블록).

**P3 온보딩 (signup/page.tsx):** 헤드라인 "Create your cinema portfolio"+혜택 3줄. 가입 완료 착지를
/me/import로: 이메일=emailRedirectTo, Google=redirectTo 둘 다 `?next=/me/import` (Supabase 허용목록
미등재 시 기존 홈 착지로 우아한 폴백 — 검증메일 화면 문구도 동기화).

**P4 앱 (app/app/page.tsx 신설):** /app 랜딩 — About 관례(SiteNav+shell). D5 정직 톤: TestFlight 폐쇄
베타 명시·**공개 스토어 링크 없음을 명시**(저장소에 실제 URL 부재 확인, 위조 금지)·알림=뉴스레터 CTA·
브라우저 대안(/room·/me/import) 안내. 배선: 네비(My Cinema)+홈(MyCinemaTeaser)+풋터 완료.

**⚠️ 미커밋 항목:** lib/sitemap-data.ts의 `/app` 코어 엔트리 1줄 — 이 파일에 **미릴리즈 오디세이 사이트맵
변경이 선재**해 분리 커밋 불가(무단 동반 커밋 방지). 작업트리에 남김; 오디세이 릴리즈 시 함께 나감.

**P5 (미착수):** 뉴스레터 리듬(오너 운영 결정 필요)·측정 대시보드 — 후속 세션.

## §11. 개정 로그

- **2026-07-24 v1** — 최초 기획. 현행 실사(네비 6그룹·홈V2·앱 배선 0건·온보딩 부재) 기반.
  3국면 IA 원리 + 메뉴/홈/온보딩/앱/뉴스레터 개편안 + 페이즈 P0~P5 + 오너 결정 D1~D6.
- **2026-07-24 v2** — P0 게이트 통과(오너: D1~D6 전부 추천안 승인 + 디자인 기준 "애플/구글급 기능주의"
  추가). §4.3 디자인 헌장 반영. 밤샘 실행 P1~P4 완료 — §12 실행 로그 참조.
