# HANDOFF — Metatake 모바일 앱 ("Pre-Watch Companion") · 기획 정본 (2026-07-16, 구축 대기)

> **한 문장 정의:** 시네필이 **영화를 보기 직전에 여는** 앱 — "볼까 말까(TakeScore·Invitation) → 뭘 볼까(What to Watch) → 어디서 볼까(Where to watch·Locations) → 나중에 볼까(찜하기)"의 프리워치 의사결정 루프를 한 화면 흐름으로 묶는다.
> 관련 정본: `HANDOFF-왓투와치-스트리밍결정.md`(Marquee 엔진) · `HANDOFF-테이크스코어-스크리너.md`(랭킹 엔진) · `HANDOFF-마이필름-렌즈.md`(개인화 불변식) · `HANDOFF-AI배포표면.md`(`/api/v1` 무인증 REST) · `docs/HANDOFF-SEO-마스터.md`(SEO 캐논) · `docs/STATE.md`(라이브 카운트).
> **원칙: 앱은 새 서비스가 아니라 기존 프로덕션 자산의 모바일 표면이다. 콘텐츠·데이터·랭킹의 정본은 전부 웹/DB에 남고, 앱은 읽기+개인화 클라이언트다.**

---

## 0. 오너 질문 3개에 대한 판정 (요지)

### 0-a. "이 기능 구성으로 충분한가?" — **축은 충분, 접착제 4개가 빠져 있다**

오너가 제시한 6개 축(TakeScore · What to Watch · Where to watch · 지도(Locations) · Invitation · 찜하기)은 **프리워치 의사결정이라는 단일 질문에 전부 복무**하므로 제품으로서 응집력이 있다. 흩어진 기능 묶음이 아니라 하나의 깔때기다:

```
저녁에 앱을 연다
 → [What to Watch]  내 구독으로 지금 볼 수 있는 최고작 (가용성→영화)
 → [TakeScore]      이 영화가 그 시간값을 하는가 (품질 판정)
 → [Invitation]     스포일러 없이 "왜 이 영화인가" 한 편의 리드 (설득)
 → [Where to watch] 정확히 어느 서비스·어느 방식(구독/무료/대여)인가 (실행)
 → [찜하기]          지금 말고 나중에 (보류 큐)
 → [Locations]      본 뒤/보기 전, 이 영화가 세계 어디에 서 있는가 (지도 = 브라우징 훅)
```

단, 이 6개만으로는 **앱이 성립하지 않는다**. 다음 4개는 기능이 아니라 접착제라 v1에 반드시 포함:

| # | 누락 요소 | 왜 필수인가 | 기존 자산 |
|---|---|---|---|
| 1 | **검색** | 모든 축의 진입점. "이 영화 어때?"가 앱의 첫 제스처 | `search_all` RPC · `/api/v1/films?q=` 이미 라이브 |
| 2 | **계정(로그인)** | 찜하기가 기기 로컬이면 웹 `user_movies`와 단절 — 렌즈·/me·Marquee hide-seen과 같은 원장을 써야 함 | Supabase Auth 그대로 (같은 프로젝트) |
| 3 | **Seen 마킹** | 찜하기의 쌍둥이. seen 없이는 hide-seen·"안 본 것만" 랭킹이 앱에서 죽는다 | `user_movies (seen, watchlist, dismissed)` 이미 존재 |
| 4 | **푸시 알림** | 웹이 못 하고 앱만 하는 유일한 것 = 리텐션 엔진. **"찜한 영화가 내 구독 서비스에 들어왔어요"** 하나면 충분 (`film_provider_index` 279k행 diff로 판정 가능) | `fpi_rebuild()` 주기 실행 + diff 워커 신설 (P3) |

**v1에서 의도적으로 뺄 것:** Ask(LLM 비용·모바일 UX 부적합), Network/Galaxy 그래프(터치로 열화), /room(데스크톱 OS 메타포), 커뮤니티 Q&A, 리딩/트로프 심층 브라우징(웹 딥링크로 위임). — 앱은 "보기 전 5분"이지 "읽는 밤"이 아니다.

### 0-b. "SEO에 불리하지 않은가?" — **불리하지 않다. 조건 3개만 지키면 오히려 유리하다**

- **앱은 색인 대상이 아니므로 웹 SEO에서 아무것도 빼앗지 않는다.** 구글이 순위를 매기는 것은 웹 페이지고, 콘텐츠 정본은 전부 웹에 남는다(위 원칙). 앱 사용자가 늘어 웹 방문 일부가 앱으로 이동해도 그것은 채널 이동이지 순위 신호 손실이 아니다.
- **오히려 얻는 것:** ① App Store·Play Store 페이지 = 고신뢰 도메인의 브랜드 백링크 2개 + "metatake" 브랜드 검색 수요(브랜드 신호는 사이트 전체에 긍정적) ② 앱 공유 시트가 **웹 URL**(`metatake.net/film/...`)을 퍼뜨림 = 자연 백링크·소셜 신호 ③ 개인화가 앱으로 가면 "서버 HTML 개인화 금지"(마이필름 렌즈 불변식 — 캐시·SEO 보호)가 더 지키기 쉬워진다.
- **지킬 조건 3개 (불변식 §7에 재수록):**
  1. **앱 전용 콘텐츠 금지** — 앱에만 있는 글/점수/데이터를 만들면 그 순간부터 웹이 불완전해지고 SEO 자산이 갈라진다. 앱은 항상 웹·DB의 부분집합.
  2. **딥링크는 웹 URL 그대로** — Universal Links(iOS)/App Links(Android)로 `metatake.net/film/[slug]` 등 기존 URL을 앱이 받아서 연다. 별도 앱 URL 체계(`app://...`만 존재) 금지. 공유 버튼도 항상 웹 URL을 내보낸다.
  3. **스마트 앱 배너는 비침투로** — 웹에 전면 앱설치 인터스티셜을 깔면 구글이 페널티(intrusive interstitial). iOS `apple-itunes-app` meta + 얇은 상단 배너까지만.

### 0-c. "비용이 얼마나 드나?" — **자체(오너+AI) 개발 시 초기 현금 ~20만 원대 + 월 0~6만 원. 외주 시 2,000만~6,000만 원.**

DB는 신규 구축이 아니라 **기존 kyniq Supabase 프로젝트에 그대로 연동**(오너 지시)이므로 백엔드 비용 증분이 거의 0이다. 상세는 §5.

---

## 1. 포지셔닝 — 웹과의 역할 분담 (혼동 금지)

| 표면 | 멘탈모델 | 주 사용 순간 | 콘텐츠 깊이 |
|---|---|---|---|
| **웹 metatake.net** | 읽고 탐험하는 크리티컬 아카이브 (SEO·AI 배포 표면) | 책상 앞, 긴 세션 | 전체 (figures·takes·tropes·lineage·room…) |
| **앱 (신규)** | **보기 전에 여는 결정 도구** | 소파, 저녁, 5분 | 프리워치 6축 + 계정·검색·푸시만 |
| MCP·`/api/v1`·확장 | AI/서드파티가 당겨가는 데이터 채널 | 대화·브라우징 중 | 팩 단위 |

앱 안에서 깊은 콘텐츠(figure/take/lineage)로 가려는 제스처는 **인앱 브라우저로 웹을 연다** — 앱에 재구현하지 않는다.

## 2. 화면 구조 (v1 = 탭 5개)

```
[Tonight]  What to Watch 모바일판 — 국가+내 서비스 → TakeScore 랭킹 카드 피드
           (wtw_services·cinecodex_ranked v11 재사용; 저장 뷰 = 앱 온보딩에서 1회 설정)
[Search]   search_all — 결과 행에 TS 뱃지·가용성 점(●구독/●무료/●대여) 즉시 표시
[Film]     (탭 아님·상세 화면) 포스터+TS 도넛 → An Invitation (스포일러-프리 리드)
           → Where to watch (국가별 제공자, film_availability) → 촬영지 미니맵
           → [찜 ♥] [Seen ✓] [공유=웹URL] · "Read more on Metatake" → 웹 딥링크
[Map]      Locations — 전 세계 핀 지도(클러스터링), 핀 탭 → 해당 Film 화면
           (api_locations_json 17,341위치·좌표100% 재사용; "내 주변 촬영지" = 앱만의 보너스)
[My]       찜 목록(= 보류 큐, 가용성 뱃지 갱신 표시) · Seen 원장 · 알림 설정 · 국가/서비스 설정
```

Invitation이 **Film 화면의 리드**라는 것이 이 앱의 차별점이다 — 평점 앱(왓챠피디아·Letterboxd)은 "본 뒤 남기는" 구조지만, 이 앱은 "보기 전에 읽는" 구조. 스포일러-프리가 보증된 유일한 크리티컬 리드(`is_invitation`)를 가진 것은 우리뿐.

## 3. 기술 아키텍처

- **프레임워크: Expo (React Native) 단일 코드베이스** → iOS+Android 동시. 웹 코드(Next.js 컴포넌트)는 못 가져오지만 **로직·RPC·API는 전부 재사용**. (Flutter 대비: 팀이 이미 TS/React — 학습비용 0.)
- **데이터 경로 2개 (마이필름 렌즈 불변식 준수):**
  1. **공개 읽기** — Supabase anon key로 공개 RPC 직호출(`cinecodex_ranked`, `search_all`, `film_availability`, `wtw_services`, `atlas_*_json`…) 또는 기존 `/api/v1`(films·takescore·locations). 신규 백엔드 0.
  2. **개인화** — `*_mine` RPC 8종은 **service_role 전용**(0042) → 앱이 직접 못 부른다. 기존 `/api/lens/*`(marquee·takescore)를 그대로 호출(Supabase JWT를 Authorization 헤더로). 찜/Seen 쓰기는 `user_movies` own-row RLS로 앱에서 직접 upsert 가능.
- **인증:** Supabase Auth (이메일 매직링크 + Apple/Google 소셜 — App Store는 소셜 로그인 제공 시 Sign in with Apple 의무).
- **지도:** MapLibre GL Native + OSM/무료 타일(비용 0) 또는 `react-native-maps`(iOS=Apple지도 무료, Android=Google SDK 모바일 무료). **Google Maps JS API 같은 종량 과금 없음.**
- **이미지:** TMDB CDN 직결(웹과 동일, 무료·약관상 로고 표기만).
- **푸시:** Expo Push(무료) + 신규 워커 1개 — `fpi_rebuild()` 후 `user_movies.watchlist × film_provider_index` diff → "찜한 N편이 넷플릭스에 들어왔어요". 테이블 1개(`push_tokens`) + 마이그 1개면 됨.
- **배포:** EAS Build/Submit. OTA 업데이트(expo-updates)로 JS 수정은 심사 없이 즉시 배포.

## 4. 구축 순서 (P0 → P4)

| 단계 | 내용 | 산출물 |
|---|---|---|
| **P0** | Expo 스캐폴드 + Supabase 연결 + 디자인 토큰(웹 `DESIGN-SYSTEM.md` 이식) + Search 탭 | 검색→Film 화면(포스터+TS+Invitation 읽기) 동작 |
| **P1** | Where to watch 섹션 + Tonight 탭(국가/서비스 온보딩 → 랭킹 피드) | 프리워치 루프 완성 (비로그인) |
| **P2** | Auth + 찜/Seen(`user_movies` 직결) + My 탭 + hide-seen(`/api/lens/*`) | 웹과 같은 원장으로 개인화 동기화 |
| **P3** | Map 탭(MapLibre 클러스터) + 푸시(토큰 테이블·가용성 diff 워커) + Universal/App Links | 리텐션 엔진 가동 |
| **P4** | 스토어 제출(스크린샷·심사 대응·개인정보 라벨) + 웹에 스마트 배너 | 출시 |

P0~P1만으로도 TestFlight 배포 가능한 최소 제품이 나온다 — 엔진이 전부 라이브라서다.

## 5. 비용 (2026-07 기준, DB = 기존 kyniq Supabase 연동 전제)

### 5-a. 고정·인프라 비용 (개발 방식과 무관)

| 항목 | 비용 | 비고 |
|---|---|---|
| Apple Developer Program | **$99/년** | iOS 필수 |
| Google Play 개발자 등록 | **$25 (1회)** | Android 필수 |
| Expo EAS 빌드 | $0~$19/월 | 무료 티어로 시작 가능(빌드 큐 대기), 출시 전후만 유료 켜도 됨 |
| Supabase | **증분 ~$0** | 기존 프로젝트 그대로. 앱 트래픽은 읽기 RPC 위주라 무료/현행 플랜 안에서 흡수, MAU 수만 명 규모 도달 시 Pro $25/월 |
| 지도 타일 | $0 | MapLibre+OSM 또는 네이티브 SDK(모바일 무료) |
| 푸시 | $0 | Expo Push 무료 |
| TMDB 이미지 | $0 | 현행과 동일 |
| **합계** | **초기 ~$125 (약 17만 원) + 월 $0~44** | |

### 5-b. 개발 비용 — 3가지 시나리오

| 시나리오 | 비용 | 기간 | 판단 |
|---|---|---|---|
| **① 오너 + AI(Claude Code) 자체 개발** — 현행 사이트와 같은 방식 | **API 사용료 수만~수십만 원 수준 + 위 고정비** | P0~P4 집중 시 3~6주 | **권장.** 백엔드·데이터·랭킹이 전부 완성돼 있어 앱은 "화면 5개짜리 클라이언트". 이 리포의 개발 방식과 동일 |
| ② 프리랜서 1인 외주 (RN 경력자, 국내) | 1,500만~3,000만 원 | 2~3개월 | 백엔드 완성 상태라 순수 클라이언트 견적. 인수인계·유지보수 의존 발생 |
| ③ 에이전시 외주 | 4,000만~8,000만 원+ | 3~4개월+ | 이 프로젝트엔 과잉 — 에이전시 견적의 절반은 우리가 이미 가진 백엔드/기획 몫 |

핵심: **비용의 결정 변수는 앱이 아니라 백엔드인데, 백엔드가 이미 있다.** 279k행 가용성 인덱스·6,978편 TakeScore·17k 촬영지 좌표·RLS 개인화 원장을 새로 만들면 그것만 수천만 원 규모다. 시나리오 ①이면 총 현금 지출은 사실상 **연 20만 원대 고정비 + AI 사용료**로 수렴한다.

## 6. 리스크·미결 (오너 결정 필요)

1. **스토어 심사 리스크(경미):** Apple 4.2(minimal functionality) 회피를 위해 찜·푸시·지도 등 네이티브 가치가 v1에 포함되어야 함 → 본 기획은 충족. 웹뷰 셸 단독 제출은 금지.
2. **네이밍:** 스토어 앱명 후보 — "Metatake", "Metatake: What to Watch", "Pre-Watch by Metatake". 브랜드 검색(0-b) 관점에선 "Metatake" 단독 권장.
3. **KR/EN:** 콘텐츠(Invitation 등)는 현재 EN 정본 — 앱 크롬(UI)만 한/영 이중화할지 결정.
4. **가격:** v1 무료 전제. 수익화(프리미엄 필터·다국가 VPN 뷰 등)는 트래픽 확인 후 별도 기획.

## 7. 불변식 (구축 시 위반 금지)

1. **콘텐츠 정본은 웹/DB** — 앱 전용 콘텐츠·점수·데이터 신설 금지 (SEO §0-b 조건 1).
2. **딥링크·공유는 항상 `metatake.net` URL** — 자체 스킴 단독 금지 (조건 2).
3. **웹에 전면 앱설치 인터스티셜 금지** — 스마트 배너까지만 (조건 3).
4. **`*_mine` RPC를 앱에서 직호출 금지** — service_role 전용(마이그 0042). 개인화는 `/api/lens/*` 경유.
5. **찜/Seen의 원장은 `user_movies` 단일** — 앱 로컬 저장소를 원장으로 삼지 말 것(오프라인 캐시는 허용, 항상 서버 우선).
6. **cinecodex.scores는 앱에서도 읽기 전용** — never-blend(외부 평점과 병렬 표기, 혼합 금지) 그대로.
7. **anon 8s statement_timeout 전제로 설계** — 무거운 질의는 기존 API 라우트 경유.
8. **TMDB 이미지 사용 시 로고·출처 표기** — 스토어 심사와 TMDB 약관 공통 요건.
