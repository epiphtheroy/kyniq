# HANDOFF — Metatake 모바일 앱 ("Pre-Watch Companion") · 기획 정본 **v2** (2026-07-16, 구축 대기)

> **한 문장 정의:** 시네필이 **영화를 보기 직전에 여는** 앱 — "볼까 말까(TakeScore·Invitation) → 뭘 볼까(Tonight) → 어디서 볼까(Where to watch) → 나중에 볼까(찜)"의 프리워치 의사결정 루프를, **선택한 국가의 앱**으로 변신하는 단일 클라이언트에 담는다.
> 관련 정본: `HANDOFF-왓투와치-스트리밍결정.md`(Marquee 엔진) · `HANDOFF-테이크스코어-스크리너.md`(랭킹) · `HANDOFF-마이필름-렌즈.md`(개인화 불변식) · `HANDOFF-AI배포표면.md`(`/api/v1`) · **`HANDOFF-KO프로젝션-한국어사이트.md`(다국어 프로젝션 — §6이 이 문서에 의존)** · `HANDOFF-계보-SEO-읽는층.md`(Lineage) · `docs/STATE.md`.
> **원칙(불변): 앱은 새 서비스가 아니라 기존 프로덕션 자산의 모바일 표면이다. 콘텐츠·데이터·랭킹의 정본은 전부 웹/DB에 남고, 앱은 읽기+개인화 클라이언트다.**

---

## §0 v1 → v2 개정 요약 (오너 확정 2026-07-16)

| # | 확정 사항 | 반영 위치 |
|---|---|---|
| 1 | **2층 구조 채택** — 네이티브 결정층 + 인앱 웹뷰 읽기층. 정적 읽기 표면의 네이티브 재구현 금지 | §2 |
| 2 | **네이티브 편입 2건 추가** — Film 화면에 **Lineage**, 감독층에서 **The Life** (Film 화면에 프리뷰 + Director 카드에 전문) | §2·§5 |
| 3 | **다국가 에디션 아키텍처** — 미국 타깃으로 출시하되, 설정에서 **국가만 선택하면 그 국가의 앱**이 되도록 처음부터 설계. 한국·스페인·일본 확장 예정 | §6 |
| 4 | **iOS 우선 출시** — 기획·코드는 양 플랫폼 공용(Expo), 출시만 iOS 먼저. Android는 P5 | §8 |
| 5 | 리뷰 채택 6건 — Tier-2 게이팅/폴백, 인앱 계정 삭제, JustWatch 표기, 검색 무결과 폴백, KPI+판정일, TestFlight 게이트 | §5·§9·§10·§13 |

v1의 판정(§0-a 접착제 4개 = 검색·계정·Seen·푸시 필수 / §0-b SEO 무해 / §0-c 비용)은 전부 유지된다. v1 전문은 git 이력(`319fed7`) 참조.

---

## §1 포지셔닝 — "두 번째 앱" 전략

미국 시장의 세 강자와 정면 승부하지 않는다: **Letterboxd**(3,000만 멤버, 본 뒤 소셜 로깅 + Video Store 유통 진출)·**JustWatch**(9만+ 타이틀 가용성·왓치리스트 알림)·**Reelgood**(미국/영국 150+ 서비스). 커버리지와 소셜 그래프에선 이길 수 없고, 이기려는 설계도 아니다.

승부처는 시장에 직접 경쟁물이 없는 세 자산이다:

1. **Invitation** — "보기 전에 읽는 스포일러-프리 크리티컬 리드". 평점 앱은 판정 없는 집계, Letterboxd 리뷰는 스포일러 태깅일 뿐. 이 카테고리는 비어 있다.
2. **TakeScore** — 학술 계보 기반 단일 판정 점수 (RT/Metacritic 집계와 범주가 다름).
3. **Locations** — 17k 촬영지 좌표. 이걸 가진 영화 앱은 없다. "내 주변 촬영지"는 ASO 스크린샷 한 장으로 설명되는 기능.

멘탈모델: **Letterboxd가 "본 뒤의 일기장"이라면 Metatake는 "보기 직전 5분의 컨시어지"** — 대체가 아니라 병용을 노린다. 획득은 웹 SEO·AI 배포가 데려온 방문자를 앱이 잠그는 구조이며, 앱 자체를 성장 엔진으로 기대하지 않는다(ASO 신규 유입은 보수적으로 잡는다). 이 판단이 §9의 TestFlight 게이트의 근거다.

| 표면 | 멘탈모델 | 주 사용 순간 |
|---|---|---|
| 웹 metatake.net | 읽고 탐험하는 크리티컬 아카이브 (SEO·AI 배포) | 책상 앞, 긴 세션 |
| **앱 (신규)** | **보기 전에 여는 결정 도구** — 국가별 에디션 | 소파, 저녁, 5분 |
| MCP·`/api/v1`·확장 | AI/서드파티 데이터 채널 | 대화·브라우징 중 |

## §2 제품 구조 — 2층 원칙 (이 문서의 헌법)

> **판별 기준: 개인화·푸시·지도·오프라인이 얹히는 표면만 네이티브. 정적 읽기 표면은 전부 인앱 웹뷰.**
> 웹뷰는 재구현이 아니라 기존 웹 페이지를 앱 안에서 여는 것 — 유지보수 비용 0, 웹 개정이 앱에 자동 반영, 패리티 세금 없음.

### 2.1 섹션 배치표 — Film

| 섹션 | 층 | 근거·데이터원 |
|---|---|---|
| Hero (포스터·TS 도넛·연도·러닝타임) | **네이티브** | `cinecodex_card` |
| An Invitation (리드) | **네이티브** | `takes.is_invitation` — 커버리지 §5.4 |
| Where to watch (국가 스코프) | **네이티브** | `film_provider_index` (916k행·139개국) |
| **Lineage (계보)** | **네이티브** ← v2 편입 | `film_lineage` 5,973편(86%) — 전 티어에 걸쳐 커버리지가 넓은 유일한 크리티컬 신호 |
| Locations 미니맵 | **네이티브** | `api_locations_json` 좌표 |
| **감독 로우 + The Life 프리뷰** | **네이티브** ← v2 편입 | `director_portrait`·`director_facts` 2~3항목 → 탭하면 Director 카드 |
| 찜·Seen·공유 액션바 | **네이티브** | `user_movies` own-row RLS |
| Why watch · Reception · Credits · Gallery · Q&A · Meaning(misreadings) · [desk] 에세이 | 웹뷰 | "Read more on Metatake" 행 목록 → 해당 웹 URL |

### 2.2 섹션 배치표 — Director (네이티브 "Director 카드" 1화면)

| 섹션 | 층 | 근거·데이터원 |
|---|---|---|
| Portrait 헤더 | **네이티브** | `director_portrait` |
| Where to Start | **네이티브** | `/director/[slug]/start` 데이터 — 프리워치 본업("뭐부터 볼까") |
| The Selection | **네이티브** | `director_picks` |
| **Filmography + 가용성 점(●내 구독/●무료/●대여)** | **네이티브 — 이 앱의 킬러 표면** | films × `film_provider_index`. 웹은 "서버 HTML 개인화 금지" 불변식 때문에 못 하는 화면. 경쟁 앱에도 없음 |
| Who's Next | **네이티브** | `director_next` |
| **The Life** | **네이티브** ← v2 편입 | `director_facts` 연표 전문 |
| The records(honors) · Connections · Embedding Fantasia · Locations · Credits · Reception · Theory · TakeScore | 웹뷰 | `/director/[slug]/…` 각 서브페이지 |

**웹뷰 계약 3조:** ① 웹뷰 상단엔 네이티브 헤더 유지(뒤로가기·공유 = 웹 URL) ② SSO 핸드오프(§7.3)로 항상 로그인 상태 진입 ③ 웹뷰 안에서 다른 film/director 링크 탭 시 네이티브 화면으로 가로채기(Universal Links 인터셉트) — 사용자가 "웹에 갇혔다"고 느끼지 않게.

## §3 디자인 컨셉 — "포켓 로비카드 (Pocket Lobby Card)"

웹의 에디토리얼 정체성(`DESIGN-SYSTEM.md` v4)을 **그대로 이식**한다. 앱답게 다시 그리지 않는다 — 웹과 앱이 한 몸이라는 감각 자체가 브랜드다.

- **타이포그래피:** 헤드라인 PT Serif · UI 크롬 Inter. 유동 타입 램프(`--fs-*`)를 앱 토큰으로 이식.
- **컬러:** 단일 레드 액센트 + 트로프 틸, 헤어라인 보더, **직각 모서리**(라운드 카드 금지 — 시장 전체가 라운드일 때 직각이 시그니처가 된다), 컬러 스틸.
- **은유:** Tonight 카드 = 극장 로비카드. 포스터-포워드, 텍스트는 신문 크레딧처럼. TakeScore = 도넛 게이지 단일 컴포넌트(웹 시각 문법 동일).
- **모션:** 절제. 카드 전환은 시스템 기본, TS 도넛 채워지는 애니메이션 1개만 허용. 라이트/다크는 시스템 추종이되 웹뷰 테마와 반드시 일치.
- **촉각:** 찜/Seen 토글에만 햅틱. 결정의 순간에만 몸에 신호를 준다.
- 터치 타깃 ≥ 44pt · 스페이싱 4px 스케일(`--sp-*`) 공유.

## §4 네비게이션·동선

### 4.1 정보구조 — 하단 탭 4개 + 스택

```
[Tonight]   내 국가·내 서비스로 지금 볼 수 있는 최고작 피드 (cinecodex_ranked v11)
[Search]    search_all — 결과 행에 TS 뱃지 + 가용성 점 즉시 표시
[Map]       Locations 전 세계 핀(클러스터) — "Near me" 토글
[My]        찜(보류 큐)·Seen 원장·알림·국가/서비스/언어 설정(에디션 스위처)
 └ 스택 화면: Film 카드 · Director 카드 · 웹뷰 리더 · 온보딩
```

Film·Director는 탭이 아니라 어디서든 푸시되는 스택 화면. v1의 탭 5개 표기에서 "Film이 탭"이라는 오해 소지를 제거했다.

### 4.2 온보딩 (첫 실행, 3스텝 · 스킵 가능)

```
① 국가 선택 (스토어 국가 자동 감지 → 확인 1탭)   ← 에디션 결정(§6)
② 스트리밍 서비스 선택 (해당 국가 프로바이더 그리드에서 복수 탭)
③ 계정 (Sign in with Apple / Google / 이메일) — "나중에" 허용, 찜 첫 시도 시 재제안
```

비로그인도 Tonight·Search·Film·Map 전부 동작(찜·Seen·푸시만 계정 필요). 이 순서가 중요하다 — **가치를 먼저, 계정은 나중에.**

### 4.3 핵심 동선 4개 (이 동선이 깨지면 설계 실패)

1. **"저녁 30초"** — 앱 열기 → Tonight 첫 카드(내 구독 최고작) → TS 도넛+Invitation 첫 두 문장 → `Watch on Netflix ↗` 프로바이더 딥링크. **3탭 이내.**
2. **"친구가 추천했는데"** — Search → 제목 입력 → Film 카드 → Invitation 정독 → 찜 or Watch. 검색→판정까지 **10초.**
3. **"일요일 산책"** — Map → Near me → 핀 → Film 카드 → 웹뷰로 깊이 읽기. (유일하게 긴 세션을 허용하는 동선)
4. **"푸시 재진입"** — "찜한 *Chungking Express*가 Criterion Channel에 들어왔어요" → Film 카드의 Where to watch 섹션으로 직행.

### 4.4 딥링크 라우팅 (Universal/App Links)

| 웹 URL | 앱 목적지 |
|---|---|
| `/film/[slug]` | Film 카드 (네이티브) |
| `/director/[slug]` | Director 카드 (네이티브) |
| `/film/[slug]/{reception,credits,…}` · 기타 전부 | 웹뷰 리더 |
| `/what-to-watch` | Tonight 탭 |
| 공유 시트 출력 | **항상 `metatake.net` URL** (불변식 §13-2) |

`public/.well-known/apple-app-site-association` + `assetlinks.json` 필요 — **public/은 워처 비대상, 수동 커밋**(기존 운영 규칙).

## §5 화면 상세 설계

### 5.1 Film 카드 (앱의 심장)

```
┌──────────────────────────────┐
│  스틸/포스터 히어로            │  ← StillHero 문법 (영상 금지 — 웹과 동일 규칙)
│  In the Mood for Love (2000) │
│  ◐ 87  Wong Kar-wai · 98min  │  ← TS 도넛 + 감독 로우(탭→Director 카드)
├──────────────────────────────┤
│  AN INVITATION               │  ← 리드 산문. 없으면 §5.4 폴백 체인
│  "…"                         │
├──────────────────────────────┤
│  WHERE TO WATCH   🇺🇸        │  ← 에디션 국가 스코프. JustWatch 표기(§13-8)
│  ● Criterion (sub) ● Rent…   │
├──────────────────────────────┤
│  LINEAGE                     │  ← v2 네이티브. 이 영화가 선 계보 리스트 칩
│  Sight&Sound 2022 · #5 …     │     탭→해당 lineage 웹뷰 or 리스트 내 다른 영화
├──────────────────────────────┤
│  LOCATIONS  [미니맵 3핀]      │  ← 탭→Map 탭 해당 영화 포커스
├──────────────────────────────┤
│  THE LIFE — Wong Kar-wai     │  ← v2 프리뷰 2~3항목 → Director 카드 The Life
├──────────────────────────────┤
│  READ MORE ON METATAKE       │  ← 웹뷰 행: Why watch·Reception·Credits·…
├──────────────────────────────┤
│  [♥ 찜]  [✓ Seen]  [↗ 공유]  │  ← 하단 고정 액션바
└──────────────────────────────┘
```

### 5.2 Tonight
로비카드 세로 피드. 카드 = 스틸 + TS + 한 줄 인바이트 + 가용성 점. 필터: 장르·연대·"안 본 것만"(로그인 시). 엔진 = `cinecodex_ranked` v11 + `wtw_services`, 국가 파라미터는 에디션에서.

### 5.3 Search
무결과 시 데드엔드 금지: ① TMDB 검색 폴백으로 제목·연도·포스터만 표시 + "Not in the Metatake canon yet" ② 그 행 탭 = 웹 `/omni` 검색 웹뷰. 카탈로그 6,978편 vs JustWatch 9만+ — 기대치 관리가 첫 세션 생존을 좌우한다.

### 5.4 커버리지 실측과 폴백 체인 (2026-07-16 DB 실측)

| 신호 | 커버리지 | 앱 규칙 |
|---|---|---|
| TakeScore | 6,978편 = 전 카탈로그 | 항상 표시 |
| 가용성(US) | 4,818편(69%) · 구독/무료 3,944편 | 없으면 "Not streaming in 🇺🇸 now" + 찜 유도(들어오면 푸시) |
| Invitation | visible 1,959편의 100% / **전체의 28%** | 폴백 ①: Embedding Fantasia 문장 리드(6,716편=96%, LLM-0) → ②: 섹션 생략 |
| Lineage | 5,973편(86%) | 없으면 섹션 생략 |
| Locations | 좌표 있는 편만 | 없으면 섹션 생략 |

**노출 게이팅 결정(리뷰 채택):** 앱 검색·Tonight은 **전 카탈로그**를 노출한다(가용성이 있으므로). Film 카드는 섹션별 유무 게이트 — 빈 섹션은 자리 표시 없이 접는다. Tier-2도 TS+가용성+Fantasia 리드로 카드가 성립함을 실측으로 확인했다.
⚠️ Fantasia 문장은 **EN 전용**(다국어 프로젝션 오너 기결정: 비-EN 로케일에서 숨김) — 비-EN 에디션에서는 폴백 ①이 비활성화되므로 ②로 직행.

### 5.5 Map
MapLibre Native + 클러스터링. "Near me"(위치 권한은 이 탭에서 처음 요청 — 온보딩에서 요구 금지). 핀 탭 → Film 카드.

### 5.6 My
찜 목록(가용성 뱃지 갱신 표시 = 푸시의 시각적 쌍둥이)·Seen 원장·알림 설정·**에디션 스위처(국가/언어)**·계정 관리(**인앱 계정 삭제 포함 — Apple 5.1.1(v) 필수**).

## §6 다국가 에디션 아키텍처 (v2의 핵심 신설)

> **오너 요구:** 첫 앱은 미국 타깃. 이후 한국·스페인·일본 등 국가별 대응. **국가만 선택하면 그 국가의 앱이 되도록** 처음부터 구조를 짠다.

### 6.1 원리 — 국가(country)와 언어(locale)는 다른 축이다

- **국가** = 가용성·프로바이더·Tonight 랭킹의 스코프. 데이터는 이미 준비돼 있다: `film_provider_index`가 **139개국**을 보유하고, 가용성 계열 RPC(`cinecodex_ranked`·`wtw_services`·`film_availability`)가 국가 파라미터를 받는다. **국가 축은 DB 변경 0.**
- **언어** = 콘텐츠·UI 문자열의 로케일. 콘텐츠 번역은 **웹 다국어 프로젝션 정본(`HANDOFF-KO프로젝션-한국어사이트.md`)의 `_<loc>` 컬럼과 로케일 레지스트리(`lib/i18n/locales.ts` — en·ko live, ja/fr/es 예약)를 그대로 읽는다.** 앱에 별도 번역 저장소를 만들지 않는다(불변식 §13-1의 확장).

### 6.2 에디션 레지스트리 — 앱의 유일한 국가 목록

```ts
// app 코드: editions.ts — 웹 LOCALES 레지스트리와 정합 유지
export const EDITIONS = {
  US: { country: "US", locale: "en", live: true  },   // 출시 에디션
  KR: { country: "KR", locale: "ko", live: false },   // 웹 /ko 프로젝션 live 후 개방
  ES: { country: "ES", locale: "es", live: false },   // 웹 es 예약과 동기
  JP: { country: "JP", locale: "ja", live: false },
  // locale이 웹에서 live가 아니면 콘텐츠는 en 폴백 + UI만 현지어 가능
} as const;
```

**규칙:** ① 새 국가 추가 = 이 객체에 1항목 + UI 사전 1파일. 그 외 작업이 필요하면 설계 위반을 의심할 것(웹 §-2.2와 같은 계약) ② 에디션의 콘텐츠 로케일은 웹 프로젝션이 live인 언어만 허용, 아니면 en 폴백 ③ 가용성은 항상 에디션 국가로 — 언어와 절대 결합하지 않는다(스페인어 UI로 미국 가용성을 보는 조합도 유효해야 함).

### 6.3 UI 문자열 — P0부터 i18n 키 강제

하드코딩 문자열 금지. `expo-localization` + 사전 파일(`dict/en.ts`·`dict/ko.ts`…), **키 집합은 웹 어휘 매트릭스(프로젝션 정본 §2.2.1)와 공유** — "Where to watch"를 웹과 앱이 다르게 번역하는 사고를 원천 차단. 출시 시점엔 en 1개면 되지만, 키 체계가 처음부터 있어야 "국가만 선택하면 되는" 구조가 성립한다.

### 6.4 스토어 전략 — 단일 앱, 국가별 SKU 금지

국가별 별도 앱을 올리지 않는다. 이유: ① 앱스토어가 스토어프론트별 현지화 리스팅(스크린샷·설명)을 지원 — "한국 앱스토어의 Metatake"는 리스팅 현지화로 달성 ② SKU 분리는 리뷰·평점·유지보수를 국가 수만큼 복제 ③ 여행자·이민자가 국가를 바꾸는 정당한 사용을 막게 됨. **에디션 = 런타임 설정**이고, 온보딩이 스토어 국가를 감지해 기본값만 맞춘다.

### 6.5 푸시의 국가 의존

가용성 diff 워커는 **(film × country)** 단위로 판정하고, 수신자는 `user_prefs.country_code`(§10.1)로 조인한다. "내 찜이 **내 나라** 서비스에 들어왔는가"가 알림의 정의다.

## §7 기술 아키텍처

- **Expo(React Native) 단일 코드베이스** — iOS+Android. EAS Build/Submit, OTA(expo-updates)로 JS 수정은 심사 없이 배포.
- **데이터 경로 — 화면 1개 = 집계 엔드포인트 1개 (BFF 패턴, v2 확정):**
  - `GET /api/v1/app/film/[slug]?country=&locale=` → Film 카드 전체(TS·invitation·availability·lineage·locations·감독 프리뷰) 1응답
  - `GET /api/v1/app/director/[slug]?country=` → Director 카드(start·picks·filmography+가용성·next·life)
  - `GET /api/v1/app/tonight?country=&providers=` → 피드
  - 검색은 기존 `search_all`/`/api/v1/films?q=` 직행.
  - 이유: ① anon 8s timeout 불변식 아래서 다중 RPC 왕복 제거 ② (slug,country,locale) 단위 `unstable_cache` ③ `guardAndLog` 통과로 **The Meter 원장에 앱 트래픽이 자동 계측**(`source='app'`) ④ 페이로드에 `v` 필드 — 구버전 클라이언트 호환 관리.
- **개인화:** `*_mine` RPC 8종은 service_role 전용(0042) — 앱 직호출 금지, 기존 `/api/lens/*`에 Supabase JWT. 찜/Seen 쓰기는 `user_movies` own-row RLS 직접 upsert.
- **인증:** Supabase Auth — Sign in with Apple(iOS 의무) + Google + 이메일 매직링크. **인앱 계정 삭제 필수(§5.6).**
- **§7.3 SSO 핸드오프 (신설 필수):** 앱 로그인 ≠ 웹뷰 로그인(쿠키 분리). 웹에 `GET /auth/handoff?token=` 라우트 1개 신설 — 앱이 세션에서 발급한 **일회용·60초 만료 토큰**을 웹이 소비해 세션을 심고 목적지로 302. 모든 웹뷰 진입은 이 경로를 통과한다. 이것이 없으면 2층 구조가 "로그아웃된 웹"으로 고장 나 보인다.
- **지도:** MapLibre GL Native + 무료 타일(비용 0). **푸시:** Expo Push(무료) + diff 워커(§6.5). **이미지:** TMDB CDN(로고 표기).

## §8 iOS 우선 — 그리고 "둘 다 기획해야 하나?"에 대한 답

**아니다. 기획·디자인·코드는 이 문서 하나로 양 플랫폼을 커버한다(Expo 공유율 ~95%). 출시 순서만 iOS → Android다.** 단, 나중에 고치면 비싼 3가지만 처음부터 양쪽을 반영한다:

1. **인증 스펙에 Apple+Google 둘 다** — iOS는 Sign in with Apple 의무, Android 사용자는 Google 기대. 지금 둘 다 스펙에 있으므로 추가 결정 불요.
2. **링크 파일 둘 다 선배포** — `apple-app-site-association` + `assetlinks.json`을 함께 커밋(§4.4). Android 출시일에 웹 변경이 없게.
3. **플랫폼 전속 UI 패턴 금지** — 하단 탭·스택·시트만 사용(양 플랫폼 공용 문법). iOS HIG 전용 컴포넌트에 기대지 않는다.

Android 추가 시점의 잔여 작업 = Play 등록($25)·데이터 안전 폼·스토어 리스팅·실기기 QA뿐이다.

## §9 구축 순서 (P0 → P5) — TestFlight 게이트 포함

| 단계 | 내용 | 산출물 |
|---|---|---|
| **P0** | Expo 스캐폴드 + 디자인 토큰 이식 + **i18n 키 체계·에디션 레지스트리(§6)** + Search(+TMDB 폴백) + Film 카드(BFF `app/film`) | 검색→판정 동선(§4.3-2) 동작 |
| **P1** | Tonight(온보딩 ①②) + Where to watch + Lineage·Locations·The Life 프리뷰 섹션 | 프리워치 루프 완성(비로그인) |
| **P2** | Auth(+**계정 삭제**) + 찜/Seen + My 탭 + `/api/lens/*` + **SSO 핸드오프(§7.3)** + 웹뷰 리더 | 웹과 단일 원장 동기화 |
| **P3** | Map 탭 + Director 카드(가용성 필모그래피) + 푸시(user_prefs·diff 워커) + Universal Links | 리텐션 엔진 가동 |
| **🚧 게이트** | **TestFlight 4주 (외부 테스터 ≥30명)** — KPI 4개: ① D30 리텐션 ≥20% ② 푸시 옵트인 ≥40% ③ 세션당 결정율(Watch 탭아웃∪찜) ≥25% ④ 주간 찜 추가 ≥3/활성유저. **판정일 = TestFlight 개시 +35일. 미달 시 스토어 출시 보류, 오너 재검토** | Go/No-Go |
| **P4** | App Store 제출(스크린샷·개인정보 라벨·심사 대응) + 웹 스마트 배너(비침투) | iOS 출시 |
| **P5** | Android: Play 등록·리스팅·QA → 출시. 이후 에디션 개방(웹 /ko live → KR 에디션 등) | 확장 |

## §10 선행 준비물 (앱 코드 밖에서 먼저 필요한 것)

### 10.1 마이그 1개 (스펙만 — 구현 대기)

```sql
-- push_tokens: 기기 원장 (Expo push)
create table push_tokens (
  token text primary key, user_id uuid references auth.users,
  country_code text not null, locale text not null default 'en',
  created_at timestamptz default now(), last_seen_at timestamptz);
-- user_prefs: 에디션·서비스 선택 (푸시 diff 워커의 조인 키; 웹 wtw_saved_views와 별도 — 목적이 다름)
create table user_prefs (
  user_id uuid primary key references auth.users,
  country_code text not null default 'US', locale text not null default 'en',
  provider_ids int[] not null default '{}', push_enabled boolean default false,
  updated_at timestamptz);
-- 둘 다 own-row RLS. 익명 기기는 push_tokens.user_id null 허용(찜 푸시는 로그인 필요하므로 발송 대상 아님).
```

### 10.2 웹 리포 작업 4건
① `/auth/handoff` 라우트(§7.3) ② BFF 3라우트(§7 — guardAndLog 포함) ③ `public/.well-known/` 링크 파일 2개(수동 커밋) ④ Where-to-watch 표시부에 JustWatch 표기 문안(웹·앱 공통 — TMDB watch-providers 약관).

### 10.3 오너 몫
Apple Developer 등록($99/년) · (P5 시) Play $25 · 앱명 최종 확정(권고: **"Metatake"** 단독).

## §11 비용 (v1 유지 + 정직한 추가)

초기 ~$125(약 17만 원) + 월 $0~44 (Apple $99/년 · Play $25 1회 · EAS 무료~$19 · Supabase 증분 ~0 · 지도/푸시/이미지 $0). 외주 대비 논거는 v1 §5와 동일 — 백엔드(가용성 916k행·TS 6,978편·좌표 17k)가 이미 있으므로 앱은 클라이언트다.

**단, 진짜 비용은 현금이 아니라 유지보수 세금이다:** Expo SDK 메이저 업그레이드 연 2~3회, OS·스토어 정책 대응, 심사 재제출. 1인+AI 체제에서 이것은 오너 주의력 예산이며, §2의 2층 구조(네이티브 표면 최소화)가 이 세금의 상한을 정하는 장치다.

## §12 리스크·미결 (오너 결정 필요)

1. **The Life 배치 해석** — v2는 "Film 화면에 프리뷰 + Director 카드에 전문"으로 설계했다. Film 화면에 전문을 원하면 §5.1의 프리뷰 섹션을 확장하면 됨(구조 변경 없음).
2. **Apple 4.2(minimal functionality):** 웹뷰 비중이 높아진 만큼, 심사 빌드에서 네이티브 가치(찜·푸시·지도·가용성 필모그래피)가 첫인상이 되도록 스크린샷·리뷰 노트 구성. 웹뷰는 "Read more" 보조층으로 서술.
3. **KR 에디션 개방 시점** — 웹 /ko 프로젝션 live(PR #9)와 동기. 오너 결정.
4. **수익화** — v1 무료 전제 유지. 트래픽 확인 후 별도 기획.

## §13 불변식 (구축 시 위반 금지 — v1 8조 + v2 4조)

1. **콘텐츠 정본은 웹/DB** — 앱 전용 콘텐츠·점수·번역 저장소 신설 금지.
2. **딥링크·공유는 항상 `metatake.net` URL** — 자체 스킴 단독 금지.
3. **웹에 전면 앱설치 인터스티셜 금지** — 스마트 배너까지만.
4. **`*_mine` RPC 앱 직호출 금지**(0042) — 개인화는 `/api/lens/*` 경유.
5. **찜/Seen 원장은 `user_movies` 단일** — 앱 로컬은 캐시일 뿐, 서버 우선.
6. **cinecodex.scores 읽기 전용 · never-blend** (외부 평점과 혼합 금지).
7. **anon 8s timeout 전제** — 무거운 질의는 BFF/API 경유.
8. **TMDB 이미지 로고 표기 + Where-to-watch에 JustWatch 표기.**
9. **정적 읽기 표면의 네이티브 재구현 금지** — §2 판별 기준 밖의 네이티브 섹션 추가는 이 문서 개정을 먼저.
10. **국가와 언어 축 결합 금지** — 가용성은 country, 콘텐츠는 locale, 조합은 자유(§6.2-③).
11. **하드코딩 UI 문자열 금지** — P0부터 i18n 키(§6.3).
12. **웹뷰 진입은 항상 SSO 핸드오프 경유**(§7.3) — 로그아웃 웹뷰 노출 금지.

## §14 개정 이력

- v1 (2026-07-16, `319fed7`): 최초 기획 — 6축+접착제 4개, 탭 5개, P0~P4.
- **v2 (2026-07-16, `681fbce`): 오너 확정 반영** — 2층 구조 헌법화(§2), Lineage·The Life 네이티브 편입, 다국가 에디션 아키텍처 신설(§6), 디자인 컨셉·동선 상세화(§3~§5), iOS 우선+양플랫폼 준비 3종(§8), TestFlight KPI 게이트(§9), BFF·SSO 핸드오프(§7), 커버리지 실측표(§5.4), 불변식 8→12조.
- **v2.1 (2026-07-16, 이 커밋): P0~P3 구현 완료 — §15 AS-BUILT 추가.**

---

## §15 AS-BUILT (2026-07-16) — P0~P3 코드 완성·검증 통과

### 15.1 무엇이 만들어졌나

**모바일 앱 `mobile/`** — Expo SDK 57(RN 0.86)·expo-router v6·TypeScript strict·typedRoutes.
- 화면 9개: `(tabs)/` Tonight·Search·Map·My + `film/[slug]`(§5.1 그대로: 히어로→TS도넛→Invitation→Where to watch→Lineage→Locations→The Life 프리뷰→Read more→액션바)·`director/[slug]`(§2.2: 가용성 점 필모그래피 포함)·`read`(SSO 웹뷰 리더+링크 인터셉트)·`onboarding`(국가→서비스→계정 3스텝)·`+not-found`(미매치 딥링크→리더).
- 파운데이션: `src/theme.ts`(DESIGN-SYSTEM v4 토큰 이식)·`src/editions.ts`(§6.2 레지스트리)·`src/i18n/`(en·ko·es·ja 4사전, 전 화면 t() 강제 — TODO(i18n) 0)·`src/lib/{api,supabase,push}.ts`·`src/state/{prefs,films}.tsx`(user_movies 단일 원장, 옵티미스틱+롤백)·`src/components/{ui,TSDonut,FilmRow}.tsx`.
- app.json: `net.metatake.app`·scheme `metatake`·associatedDomains·Android intentFilters·Sign in with Apple·플러그인(maplibre/notifications/location/apple-auth).

**웹(BFF·인프라)** — `app/api/v1/app/` 7라우트: `film/[slug]`·`director/[slug]`·`tonight`·`services`·`handoff`(POST)·`account-delete`(POST)·`tmdb-search`. 전부 guardAndLog(The Meter 원장에 `app_*` 엔드포인트로 계측)+API_CORS+s-maxage 캐시. `app/api/lens/marquee`에 Bearer 폴백(가산적·쿠키 경로 불변). `app/api/push/availability-cron`(§6.5 diff 워커)+vercel.json 크론(매일 09:00 UTC). `public/.well-known/` AASA+assetlinks(플레이스홀더). next.config에 AASA content-type 헤더. tsconfig exclude+.gitignore에 mobile.

**DB** — 마이그 0106 `push_tokens`·`user_prefs`·`push_sent`(own-row RLS / 원장은 서비스롤 전용) **프로덕션 적용 완료**. ⚠️0105는 다국어 프로젝션(PR #9)이 선점 — 번호 갭은 의도.

### 15.2 검증 기록 (전부 통과)

| 게이트 | 결과 |
|---|---|
| mobile `tsc --noEmit` | 0 errors (strict) |
| mobile `expo export --platform ios` | 번들 성공 (4.7MB hbc) |
| web `tsc` | 신규·수정 파일 오류 0 (기존 베이스라인 20건은 무관 파일) |
| web `next build` | 통과 (클린 .next) |
| BFF 스모크(실데이터) | ITMFL: TS 73·avail 5·lineage 10·loc 8 핀·the_life 4facts / 왕가위: films 8 전부 ts+tiers / tonight(US, Netflix): 207편 / tmdb-search: Dune Part Three 폴백 |
| Tier-2 폴백(§5.4) | `hamsun-1996`: invitation 없음→Fantasia 문장 리드 "Hamsun won 'Guldbagge…'" ✓ |
| 인증 가드 | handoff·account-delete·lens 비인증 401 ✓ |

### 15.3 계약 대비 구현 편차 (전부 의도적)

1. **푸시 워커 = Vercel 크론 라우트** (§10.1의 python 워커 대신) — 인프라 0·오너 노트북 무의존. 로직은 §6.5 그대로((film×country) diff, push_sent 원장).
2. **SSO = 기존 `/auth/confirm` 재사용** — 전용 `/auth/handoff` 라우트 불필요. 민트(`POST /api/v1/app/handoff`, Bearer)가 `generateLink(magiclink)`의 일회용 token_hash URL을 반환.
3. **push_tokens.user_id NOT NULL** — 익명 등록 배제(문서는 null 허용이었으나 스팸 방지·발송 대상은 어차피 로그인 필요).
4. **이메일 인증 = 6자리 OTP 코드**(매직링크 대신) — 인앱 완결, 리다이렉트 설정 불요. ⚠️Supabase 이메일 템플릿에 `{{ .Token }}` 노출 필요(오너 TODO).
5. **Tonight 카드 lead=null** — 편당 invitation 40회 페치는 과중. 후속 최적화 항목.
6. **hide-seen = 클라이언트 ledger 필터** — lens Bearer 경로는 준비돼 있으나(`api.tonightMine`) v1은 클라 필터로 충분.
7. **Watch 실행 = `/whereto/[slug]` 리더** — 프로바이더 앱별 신뢰 가능한 딥링크 스킴 부재. (참고: `/film/x/watch`는 `/whereto/x`로 308 — 앱은 직행.)
8. **user_movies 행 삭제 안 함** — 앱은 rating을 모르므로 불리언만 false로(웹의 delete-when-empty와 다름·데이터 무손실).

### 15.4 오너 TODO (앱이 스토어에 가기 위한 계정·콘솔 작업)

1. **Apple Developer 등록($99/년)** → ① `eas init`(푸시 projectId) ② `eas build --platform ios` ③ `public/.well-known/apple-app-site-association`의 `TEAMID` 교체(수동 커밋).
2. **Supabase Auth 콘솔**: Apple provider 활성화(Sign in with Apple)·Google provider(선택)·이메일 OTP 템플릿에 `{{ .Token }}` 추가.
3. (선택) Vercel env `CRON_SECRET` — 푸시 크론 엔드포인트 보호.
4. (P5 시) Play 등록($25)·`assetlinks.json` SHA256 교체.
5. TestFlight 4주 게이트(§9) — KPI 4개 미달 시 스토어 출시 보류.

### 15.5 실행 방법

```bash
cd mobile && npm install
npx expo start            # Expo Go: Map 탭 제외 전 화면 동작(maplibre는 dev build 필요)
npx expo run:ios          # 네이티브 dev build (Xcode 필요) — Map 포함 전체
```
