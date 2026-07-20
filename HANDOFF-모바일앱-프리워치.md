# HANDOFF — Metatake 모바일 앱 ("시네필 판단 내비게이터") · 기획·AS-BUILT 정본 **v4.0** (2026-07-17, v3.1 코드 완성 위 판단 내비게이터 개정 — 오너 D1~D5 확정 · **P-A~P-D 구현 완료 · TestFlight 빌드 9 라이브 2026-07-20** — 출시 실록은 §−1)

> **한 문장 정의(v4):** 시네필의 **영화 판단 내비게이터** — 카탈로그의 모든 영화에 나의 판단 상태(볼래·패스·봤어→회고)가 있고, 앱의 일은 **탐색(뭘 볼까) → 판단(볼까 말까) → 계획(언제 어디서 볼까) → 시청 → 회고(잘 골랐나)** 루프에서 그 상태를 전진시키는 것이다. "선택한 국가의 앱으로 변신하는 단일 클라이언트"(§6)와 2층 구조(§2)는 v2 그대로다.
> 관련 정본: `HANDOFF-마이룸-v3-redesign.md`(**v4의 최중요 인접 문서** — 판단 어휘·시효·계기·`me_*` RPC의 원천) · `HANDOFF-왓투와치-스트리밍결정.md`(Marquee 엔진) · `HANDOFF-테이크스코어-스크리너.md`(랭킹·프리셋 칩 선례) · `HANDOFF-마이필름-렌즈.md`(개인화 불변식) · `HANDOFF-AI배포표면.md`(`/api/v1`) · `HANDOFF-KO프로젝션-한국어사이트.md`(다국어 프로젝션 — §6이 의존) · `HANDOFF-계보-SEO-읽는층.md`(Lineage) · `docs/STATE.md`.
> **원칙(불변): 앱은 새 서비스가 아니라 기존 프로덕션 자산의 모바일 표면이다. 콘텐츠·데이터·랭킹의 정본은 전부 웹/DB에 남고, 앱은 읽기+개인화 클라이언트다.**

---

## §−1 출시 실록 (2026-07-19 ~ 07-20) — AS-BUILT · **이 섹션이 최신 상태의 정본**

> 아래 §0~ 이하 기획 본문은 구현 전 기획서 원문이다. 실제 배포 상태·경로·함정은 이 실록이 우선한다. 안드로이드는 별도 정본 **`HANDOFF-안드로이드-출시.md`**.

**타임라인:**

| 시점 | 사건 |
|---|---|
| 07-19 낮 | Apple Developer 승인(Team `AYDX65J9H4`) · A1 웹 배포(앱 BFF+AASA 라이브, main 1e6d1c4) · EAS 프로젝트 연결(5f5d3978) |
| 07-19 저녁 | ASC API 키의 **생성계열 영구 403** 판명(계정은 웹 쓰기 가능 — 10시간 오진). 우회 확립: **웹 콘솔에서 번들ID·인증서(CSR 업로드)·프로파일 수동 생성 → EAS 로컬 서명**(`mobile/credentials/` + `credentials.json`, gitignore) |
| 07-19 밤 | 빌드6 TestFlight ✅(제출은 eas.json에 `ascApiKey*` 명시 필수) → 오너 실기기: 상세 전멸·구글로그인·맵 불능 신고 |
| 07-19~20 | **QA 라운드1**(16 에이전트): FilmMiniMap이 MapLibre v9 API 사용→v11 재작성, PKCE 누락 수정 → 빌드7. **QA 라운드2**(29 에이전트, 버튼 기대동작 전수): 14건 수정(핵심: Sign in 4곳이 온보딩 맨앞으로 감→`step=account` 직행) → 빌드8 |
| 07-20 새벽 | **WAF 자폭 인시던트**: QA 폭주가 홈 IP /24를 30일 차단(사이트 전면 403, 오너 폰 포함). `bot_blocks` id23 비활성화로 해제. 교훈=프로덕션 API 스로틀 |
| 07-20 아침 | **네이티브 맵이 스토어 빌드 즉사 원인**으로 확정(맵탭+상세 미니맵) → **전 표면 WebView 렌더러로 벤치** + 맵 v2(위성 Esri·포스터 썸네일 핀·말풍선 콜아웃) → 빌드9 ✅ + **OTA 파이프라인 개통**(`eas update --channel production`, 빌드6~9 공통 적용) |
| 07-20 오전 | 오너 배치 8종: 🇰🇷 KR 에디션 · 히어로 스와이프 페이저(스틸4+포스터) · 본문 이미지 2장 · invitation 축소 · **to. W.H. Heo 헌정**(웰컴+설정) · TS 하한 칩(복수 기준 필터) · 맵 말풍선 TS배지+영화열기 · Honors 404 게이트. 서버: film BFF `images[]`(TMDB 백드롭 8) + tonight `ts_min/ts_max` — 릴리즈 검증 완료 |
| 07-20 오전 | **외부 테스터 개통**: API 403 → 오너 로그인 브라우저로 Friends 외부그룹+빌드9+테스트정보+wonjah@gmail.com 초대. 빌드9 `WAITING_FOR_REVIEW` |
| 07-20 오전 | **이메일 로그인 완성**: Supabase 템플릿(가입확인+매직링크)을 `{{ .Token }}` 6자리 코드로 교체(Management API — ⚠️UA 없으면 Cloudflare 1010 403) |

**핵심 자산/경로:**
- 서명: `~/Downloads/AuthKey_65Y5238S83.p8`(ASC API 키, Issuer `c8e610f8-b12a-47e9-ade5-b193a2e84d01`) · `~/Downloads/distribution.cer` · 프로파일은 `mobile/credentials/`(git 제외). ascAppId `6792487455`.
- eas.json: `build.production.ios.credentialsSource="local"`(**ios 블록에만** — 전역이면 안드로이드 빌드 파괴), submit에 ascApiKey 3필드 명시.
- 루틴: 코드 수정 → `npx tsc --noEmit` → JS만이면 `eas update --channel production`(재실행 2회 적용) / 네이티브·설정이면 `eas build -p ios --non-interactive --no-wait` → poller가 `eas submit --id <빌드> --non-interactive`.

**남은 것:** ① Apple 로그인 = Supabase Apple provider 활성 + authorized client `net.metatake.app`(공개심사 4.8 요건, TestFlight엔 불필요) ② Connect OAuth 3종 서버 env(`connect-env-template.txt`) ③ /privacy 법무 검토 후 App Store 공개 제출(§15 그대로) ④ 밸류(V)점수 정렬 축 — 랭킹 RPC 마이그레이션 1개 필요(기획만 됨) ⑤ 안드로이드 → `HANDOFF-안드로이드-출시.md`.

---

## §0 v3.1 → v4.0 개정 요약 (오너 확정 2026-07-17)

**계기가 된 실사 2건:**

1. **v3.1 앱은 `user_movies` 원장의 절반만 쓰고 있었다.** 원장에는 `watchlist`·`seen` 외에 이미 `dismissed`(관심없음, 마이그 0028)·`rating`(0.5~5 반 단위)·`note`·`watched_at`이 있다. 즉 "볼래/패스/봤어/회고"의 판단 상태 4/5가 DB에 이미 존재한다.
2. **웹 /room "터미널"에 판단·관리 자산이 전부 있다** — 판정 어휘 Find/Aligned/Letdown, Slate의 커밋 시효(Fresh/Aging/Stale), 개인 추천 엔진 `me_recommend_wwi`(λ 리스크 다이얼·이유칩·점수 분해), 정복 계기(`me_coverage`·`me_auteur_conquest`·`me_blindspots`·`me_geo_coverage`). **v4는 신규 백엔드가 거의 없는 "승격" 기획이다** — 마이그 0건, LLM 비용 0.

**포지셔닝 갱신:** v3.1 "보기 직전 5분의 컨시어지"(정보 제시형)의 구조적 한계 = 앱이 판단 근거를 보여주기만 하고 **판단의 결과를 묻지도 기록하지도 않았다**. 브리프를 읽고 "안 볼래"라고 결심해도 흔적이 없어 같은 영화가 또 나타난다. v4의 정의: **모든 영화에 나의 판단 상태가 있고, 앱의 일은 그 상태를 전진시키는 것.**

**오너 결정 5건 (2026-07-17 확정):**

| # | 결정 | 내용 | 반영 |
|---|---|---|---|
| **D1** | 게이트 투입 | P-A(판단 코어)·P-B(판단 덱)는 **TestFlight 게이트 전** 투입 — 게이트 KPI ③ '세션당 결정율'은 판단 기능 그 자체를 측정하므로 | §9 |
| **D2** | 보류 상태 | Considering(판단 보류)은 **클라 근사 먼저**(마이그 0) — 수요 실측 후에만 0109 승격 | §5.0 |
| **D3** | 패스 강도 | 패스 = **`dismissed` 단일 + Restore 필수** — '지금은 아님' 별도 상태 신설 금지(그건 찜의 시효가 처리) | §5.0 |
| **D4** | 탭 구조 | **4탭 유지** [Tonight · Explore · Map · Shelf] — Map 탭 지위 유지(ASO 차별점), 판단은 탭이 아니라 편재 인터랙션 | §4 |
| **D5** | 푸시 확장 | leaving-soon 푸시는 **후속 분리**(v4 범위 밖) — **가용성 푸시는 arrival만 유지**, TestFlight 리텐션 실측 후 재결정. (P-D의 Stale 재판단 넛지는 가용성 푸시가 아닌 별건으로 v4 범위 내) | §12-8 |

**실사 — 이미 갖고 있는 것 (v4가 싼 이유):**

| 필요한 것 | 이미 있는 자산 | v3.1 사용 여부 |
|---|---|---|
| 판단 상태 원장 | `user_movies`: `watchlist`·`seen`·`dismissed`·`rating`·`note`·`watched_at` (PK `(user_id, film_id)` · **기본 DDL은 live-only, repo에 없음**) | 불리언 2개만 |
| 상태 전이 RPC | `me_set_watchlist`·`me_mark_seen`·`me_dismiss`·**`me_undismiss`**·`rate_film` — 전부 SECURITY DEFINER·`auth.uid()` 스코프·uid 파라미터 없음 (`me_undismiss`는 0045 — authenticated GRANT가 repo에 명시된 유일한 쓰기 RPC) | 미사용(직접 upsert) |
| 회고 어휘 | **Find(발굴) / Aligned(합치) / Letdown(실망)** — /room Holdings verdict 칩(rating×20 − prestige, +12/−9) | 미사용 |
| 찜 시효 | /room Slate: **Fresh(<30일)/Aging(30~90일)/Stale(>90일)** 커밋-부패 모델 | 미사용 |
| 개인 추천+근거 | **`me_recommend_wwi(p_lambda, p_limit)`** — λ 다이얼(Cautious 1.4/Balanced 1.0/Bold 0.6)·이유칩·점수 분해(u_util/t_taste/s_standing/conf)·dismissed 존중 | 미사용 |
| 판단 신호 집약 | `cinecodex_card` 단일 RPC: TS+V/C/R 도넛+13서브+랭크(#n of 6,701)+외부평점 (가용성은 별도 `film_availability` 데코) | 부분 사용 |
| 상황 프리셋 선례 | `lib/takescore_presets.ts` — 출하본 6종(Peak only·Safe bets·Hidden gems·High wire·Fresh century·Rewards rewatching) **순수 파라미터 번들(비용 0)** | 미사용 |
| 시네필 여정 계기 | `me_coverage`(계보 정복)·`me_blindspots`·`me_auteur_conquest`(감독 정복)·`me_geo_coverage`·NAV | 미사용 |
| 취향-계보 교차 | kindred 그래프(`graph_film_neighbors(p_slug,p_limit)`, 0018 — 가중치=`film_affinities.score`·anon grant)·shared_threads는 `film_affinities.shared_meta_take_ids`(컨텍스트팩 경로, 서비스롤 전용)·lineage 86% | lineage 표시만 |

v1~v3.1의 판정(2층 구조·에디션·Lava·SDK 54·접착제 4개)은 전부 유지. 이전 개정 요약은 §14와 git 이력 참조.

---

## §1 포지셔닝 — "두 번째 앱" 전략 + 빈 카테고리 (v4 갱신)

미국 시장의 세 강자와 정면 승부하지 않는다: **Letterboxd**(3,000만 멤버, 본 뒤 소셜 로깅)·**JustWatch**(9만+ 타이틀 가용성·왓치리스트 알림)·**Reelgood**(미국/영국 150+ 서비스). 커버리지와 소셜 그래프에선 이길 수 없고, 이기려는 설계도 아니다.

멘탈모델(v4): **Letterboxd가 "본 뒤의 일기장", JustWatch가 "어디서 보나 색인"이라면, 그 사이 — "보기 전의 판단"을 다루는 앱은 시장에 없다.** 영화 선택에 실패하고 싶지 않은 사람, 시네필이 되고자 하는 사람을 위한 내비게이션이 빈 카테고리다. 대체가 아니라 병용을 노린다.

승부처는 직접 경쟁물이 없는 네 자산이다:

1. **Invitation** — "보기 전에 읽는 스포일러-프리 크리티컬 리드". 이 카테고리는 비어 있다.
2. **TakeScore** — 학술 계보 기반 단일 판정 점수 + 13차원 (RT/Metacritic 집계와 범주가 다름).
3. **Locations** — 17k 촬영지 좌표. "내 주변 촬영지"는 ASO 스크린샷 한 장으로 설명되는 기능.
4. **판단 원장 (v4 신설 자산)** — 볼래·패스·봤어·회고가 전부 남고 전진하는 유일한 앱. 경쟁 앱은 "본 뒤 로깅"(Letterboxd) 또는 "가용성 알림"(JustWatch)뿐, **판단 자체를 1급 데이터로 다루는 앱은 없다.**

획득은 웹 SEO·AI 배포가 데려온 방문자를 앱이 잠그는 구조이며, 앱 자체를 성장 엔진으로 기대하지 않는다(§9 게이트의 근거).

| 표면 | 멘탈모델 | 주 사용 순간 |
|---|---|---|
| 웹 metatake.net | 읽고 탐험하는 크리티컬 아카이브 (SEO·AI 배포) | 책상 앞, 긴 세션 |
| **앱** | **영화 판단 내비게이터** — 국가별 에디션 | 소파·출퇴근, 30초~10분 |
| MCP·`/api/v1`·확장 | AI/서드파티 데이터 채널 | 대화·브라우징 중 |

## §2 제품 구조 — 2층 원칙 (이 문서의 헌법, v4에서도 불변)

> **판별 기준: 개인화·푸시·지도·오프라인이 얹히는 표면만 네이티브. 정적 읽기 표면은 전부 인앱 웹뷰.**
> v4가 승격하는 것은 네이티브 결정층의 **정의**다: "정보 제시"에서 "판단 상태 기계"(§5.0)로. 웹뷰 층은 변경 없음.

### 2.1 섹션 배치표 — Film (v4 개정)

| 섹션 | 층 | 근거·데이터원 |
|---|---|---|
| Hero + **Verdict Strip**(TS 도넛·#랭크·V/C/R·러닝타임·가용성 점) | **네이티브** ← v4 확장 | `cinecodex_card` |
| An Invitation (리드) | **네이티브** | `takes.is_invitation` — 커버리지 §5.4 |
| **For You(이유칩·kindred 교차)** | **네이티브** ← v4 신설 (로그인+데이터 有 시만 · 이유칩=P-B, kindred 교차=P-D) | `me_recommend_wwi`(P-B) · kindred(P-D, BFF 경유 — §7) |
| **What to expect(13차원 사실 칩)** | **네이티브** ← v4 신설 (P-D) | `cinecodex_card` dims·`lib/cinecodex_dims.ts` |
| Where to watch (국가 스코프) | **네이티브** | `film_provider_index` (916k행·139개국) |
| Lineage (계보) | **네이티브** | `film_lineage` 5,973편(86%) |
| Locations 미니맵 | **네이티브** | `api_locations_json` 좌표 |
| 감독 로우 + The Life 프리뷰 | **네이티브** | `director_portrait`·`director_facts` |
| **판단 바 [♥ 볼래 · ✕ 패스 · ✓ 봤어→별점]** (하단 고정) | **네이티브** ← v4 승격 (구 찜·Seen·공유 액션바) | `me_*` RPC 5종(§5.0) — 공유는 우상단 글래스 디스크로 이동 |
| Why watch · Reception · Credits · Gallery · Q&A · Meaning · [desk] 에세이 | 웹뷰 | "Read more on Metatake" 행 목록 |

### 2.2 섹션 배치표 — Director (v4 변경 없음)

| 섹션 | 층 | 근거·데이터원 |
|---|---|---|
| Portrait 헤더 | **네이티브** | `director_portrait` |
| Where to Start | **네이티브** | `/director/[slug]/start` 데이터 |
| The Selection | **네이티브** | `director_picks` |
| **Filmography + 가용성 점(●내 구독/●무료/●대여)** | **네이티브 — 킬러 표면** | films × `film_provider_index` |
| Who's Next | **네이티브** | `director_next` |
| The Life | **네이티브** | `director_facts` 연표 전문 |
| The records(honors) · Connections · Embedding Fantasia · Locations · Credits · Reception · Theory · TakeScore | 웹뷰 | `/director/[slug]/…` 각 서브페이지 |

**웹뷰 계약 3조** (유지): ① 네이티브 헤더(뒤로가기·공유=웹 URL) ② SSO 핸드오프(§7.3) ③ film/director 링크 네이티브 가로채기.

## §3 디자인 시스템 v2 — "Lava" (v3.0 확정 유지)

벤치마크(Airbnb 2025 Lava + iOS 26 Liquid Glass)·토큰 표·화면별 적용·로그인 순서·앱 아이콘 전부 v3.0 그대로 — SSOT는 `mobile/src/theme.ts`, 웹 v4 토큰과 의도적 분리(불변식 §13-14), PT Serif는 작품 제목·Invitation 전용.

| 축 | 규칙 | SSOT |
|---|---|---|
| 컬러 | 따뜻한 중립(#FFFFFF/#F7F7F7/#222222 · 다크 #111111/#1D1D1D) + **Lava 그라데이션 하나**(#FF385C→#E61E4D→#D70466) | `src/theme.ts` |
| 그라데이션 용처 | **CTA와 활성 상태에만** | `GradientBtn` |
| 라운드 | 버튼 8 · 카드 12~14 · 시트/히어로 24 · 알약 999 | `radius` |
| 깊이 | 소프트 앰비언트 섀도, `pal.surface` 그룹 컨테이너 | `shadow` |
| 크롬 | 블러 반투명 탭바 + 히어로 위 글래스 디스크 | `(tabs)/_layout.tsx` |
| 모션 | 스프링 프레스(scale 0.96) · 탭 아이콘 바운스 · 하트 펑 | `Tactile`·`motion` |
| 타이포 | Inter 기본, PT Serif는 작품 제목·Invitation 전용 | `Ui`·`Serif` |

**v4 신규 컴포넌트는 전부 Lava 문법 안에서** (새 디자인 어휘 신설 금지):
- `JudgeBar` — 하단 고정 판단 바. 그라데이션은 **'볼래' 하나에만**(CTA 규칙), 패스·봤어는 중립. 스프링 프레스.
- `ReasonChip` — For You 이유칩. 중립 `Chip` 변형, 그라데이션 금지.
- `VerdictStrip` — 히어로 하단 판단 재료 줄(TS 도넛+랭크+V/C/R 마이크로바+러닝타임+가용성 점). never-blend 시각 분리(§13-18).
- `AgeBadge` — Fresh/Aging/Stale 시효 배지. Stale은 웹 /room과 같이 **`--risk` 계열, 레드 토큰 금지**.
- `StarRow` — 0.5 단위 별점 입력(봤어 직후 인라인).

## §4 네비게이션·동선 (v4 개정 — D4 확정)

### 4.1 정보구조 — 하단 탭 4개 + 스택

```
[Tonight]   판단 덱 — 내 국가·내 서비스 후보를 카드 단위로 판단 처리 (cinecodex_ranked v11 + 상황 프리셋 칩)
[Explore]   구 Search 확장 — 검색(search_all) + 브라우즈(장르·연대·프리셋). TMDB 폴백 유지
[Map]       Locations 전 세계 핀(클러스터) — "Near me" 토글 (D4: 탭 지위 유지, 변경 없음)
[Shelf]     구 My 승격 — 포트폴리오 3구역(큐·회고·여정). 설정(에디션·계정·알림)은 우상단 기어 시트로
 └ 스택 화면: Film 판단 브리프 · Director 카드 · 웹뷰 리더 · 온보딩
```

**판단 편재 원칙 (v4):** 판단은 탭이 아니다 — Tonight 카드·Explore 결과 행·Map 바텀 카드·Film 브리프 어디서든 **같은 판단 바/제스처**가 있다. "판단하러 가야 하는 곳"을 만들면 설계 실패.

### 4.2 온보딩 (첫 실행, 3+1스텝 · 전부 스킵 가능)

```
① 국가 선택 (스토어 국가 자동 감지 → 확인 1탭)   ← 에디션 결정(§6)
② 스트리밍 서비스 선택 (해당 국가 프로바이더 그리드 복수 탭)
③ 계정 (Sign in with Apple / Google / 이메일) — "나중에" 허용, 찜 첫 시도 시 재제안
④ 취향 캘리브레이션 (v4 신설, 선택·로그인 시) — "본 영화가 있으면 표시해 주세요":
   유명작 그리드(TS 상위×투표수 상위)에서 탭 몇 번 → me_mark_seen 배치.
   이 30초가 hide-seen·For You 이유칩·여정 계기를 첫 세션부터 유효하게 만든다.
```

비로그인도 Tonight·Explore·Film·Map 전부 동작(판단 기록·푸시만 계정 필요). **가치 먼저, 계정은 나중에** 원칙 유지 — 비로그인 상태에서 판단 버튼을 누르면 그 시점에 로그인 시트 재제안(누른 판단은 로그인 후 유실 없이 커밋).

### 4.3 핵심 동선 5개 (이 동선이 깨지면 설계 실패)

1. **"저녁 30초"** — 앱 열기 → Tonight 첫 카드(내 구독 최고작) → TS+리드 → `Watch ↗` 딥링크 또는 ♥/✕ 즉결. **3탭 이내.**
2. **"친구가 추천했는데"** — Explore → 제목 입력 → 판단 브리프 → **상태를 남기고 나온다**(볼래/패스/봤어). 검색→판단까지 **10초.**
3. **"출퇴근 트리아지" (v4 신설)** — Tonight 덱에서 스와이프로 분당 다건 판단 → Shelf 큐가 자란다. 세션 undo 스트립 상시.
4. **"일요일 산책"** — Map → Near me → 핀 → 브리프 → 웹뷰 깊이 읽기. (유일하게 긴 세션 허용)
5. **"푸시 재진입"** — "찜한 *Chungking Express*가 Criterion Channel에 들어왔어요" → 브리프 Where to watch 직행.

### 4.4 딥링크 라우팅 (v3.1 유지)

| 웹 URL | 앱 목적지 |
|---|---|
| `/film/[slug]` | Film 판단 브리프 (네이티브) |
| `/director/[slug]` | Director 카드 (네이티브) |
| `/film/[slug]/{reception,credits,…}` · 기타 전부 | 웹뷰 리더 |
| `/what-to-watch` | Tonight 탭 |
| 공유 시트 출력 | **항상 `metatake.net` URL** (불변식 §13-2) |

`public/.well-known/` 2파일은 수동 커밋(기존 규칙).

## §5 화면 상세 설계 (v4 개정)

### 5.0 판단 상태 기계 — v4의 심장 (신설)

```
                 ┌─ To Watch(찜) ── 시효: Fresh(<30d) → Aging(30–90d) → Stale(>90d) ─┐
미판단 ─ 판단 ─┤                                                                    ├─ Seen ─ 회고(별점 → Find/Aligned/Letdown)
                 └─ Pass(안 볼래) ── Restore 상시 가능 ──────────────────────────────┘
```

| 상태 | 원장 | 전이 경로 | 부수효과 (직접 upsert가 우회하던 것) |
|---|---|---|---|
| **To Watch** | `user_movies.watchlist=true` | `me_set_watchlist(p_slug, p_on)` | `dismissed` 자동 해제 |
| **Pass** | `user_movies.dismissed=true` | `me_dismiss(p_slug)` | `watchlist` 해제 · 추천 제외(`me_recommend_wwi`가 이미 존중) |
| **Restore(패스 철회)** | `user_movies.dismissed=false` | `me_undismiss(p_slug)` (0045 R2) | 단독 해제 — 찜을 얹지 않음. /room `useRoomActions`의 정본 경로 그대로 |
| **Seen** | `user_movies.seen=true` | `me_mark_seen(p_slug)` | `watched_at` 기록 · `dismissed` 해제 |
| **회고** | `user_movies.rating` (0.5~5 반 단위) | `rate_film(p_slug, p_rating)` | `seen=true` · NAV 스냅샷(`me_snapshot_nav`는 rate_film 내부 호출 — 별도 grant 불요) |
| **보류(Considering)** | **DB 없음 — D2: 클라 근사** | 로컬 링버퍼(최근 50, "브리프 열림·무결정") | 수요 실측 후 0109 승격 후보 |

- **회고 어휘:** Find(발굴)/Aligned(합치)/Letdown(실망) — /room Holdings와 **동일 공식**(rating×20 − prestige, Find ≥ +12 / Letdown ≤ −9), 클라 계산. ⚠️비교축은 TakeScore가 아니라 **정전 위상(Standing/prestige)**이다(`lib/room/format.ts` verdictOf). "Standing 87인데 내 별점 ★2.5 → Letdown"이 쌓이면 "내 판단 적중률"이라는, 경쟁 앱에 없는 화면이 된다(§5.6-②).
- **D3 확정:** 패스는 `dismissed` 하나. "지금은 아님"은 상태가 아니다 — 그건 그냥 찜이고, 시효(Aging/Stale)가 자연 처리한다(Slate 모델 이식). 모든 패스는 즉시 Restore 가능해야 한다(불변식 §13-15).
- **D2 확정:** Considering은 컬럼 없이 시작. 브리프를 열고 아무 상태도 남기지 않고 닫은 영화를 기기 로컬(AsyncStorage 링버퍼)에 근사 → Shelf 구역②에 "판단 대기"로 노출. 이 더미가 실사용되는 게 확인되면 0109로 승격(그 전까지 기기 간 비동기 한계 명시).

**쓰기 경로 전환 (v3.1 → v4, P-A 최우선 작업):** v3.1은 `user_movies` 직접 upsert였고, 이는 위 표의 부수효과를 전부 우회한다(특히 rate_film의 NAV 스냅샷·me_dismiss의 찜 해제). v4는 `me_*` RPC **5종**(`me_set_watchlist`·`me_mark_seen`·`me_dismiss`·`me_undismiss`·`rate_film`)으로 전환한다 — 전부 SECURITY DEFINER·`auth.uid()` 스코프·**uid 파라미터 없음**(/room 클라이언트가 쓰는 그 경로 그대로). Restore는 `me_undismiss(p_slug)`가 정본이다(0045 R2 — "two-call me_set_watchlist(on)→(off) 시퀀스 대체"로 만들어진 전용 RPC, /room `components/room/useRoomActions.tsx`가 이미 사용). own-row 직접 업데이트 폴백은 불요.

⚠️ **착수 시 검증 (P-A 게이트):**
1. **grant 실측** — `me_set_watchlist`·`me_mark_seen`·`me_dismiss`·`rate_film`(+ §5.6의 계기 RPC들)의 authenticated EXECUTE를 라이브 DB에서 확인. `me_undismiss`만 repo에 GRANT가 명시돼 있고(0045), 나머지는 `user_movies`처럼 live-only — 마이그 트리로 추정 금지.

### 5.1 Film 카드 = 판단 브리프 (앱의 심장, v4 재구조화)

"2~3분 안에 판단이 끝나는 브리프". 원칙: **브리프를 읽었으면 상태를 남기고 나가게 만든다** — 단 강요 금지, 그냥 닫기 항상 가능(그 이탈이 Considering 근사의 입력이다).

```
┌──────────────────────────────┐
│  스틸/포스터 히어로            │  ← StillHero 문법 유지(영상 금지·웹 동일 규칙) · 공유는 우상단 글래스 디스크
│  In the Mood for Love (2000) │
│  ◐ 73 · #n of 6,701          │  ← VerdictStrip: TS 도넛+랭크+V/C/R 마이크로바 (73=§15.2 실측값)
│  V▓▓▓ C▓ R▓ · 98min · ●●○ 🇺🇸 │     +러닝타임(커밋 비용)+가용성 점 — 첫 화면에서 판단 재료 완비
├──────────────────────────────┤
│  AN INVITATION               │  ← 유지. 없으면 §5.4 폴백 체인
├──────────────────────────────┤
│  FOR YOU                     │  ← v4 신설(로그인+데이터 有 시만): me_recommend_wwi 이유칩
│  [취향 신호 강함]             │     + kindred 교차("당신이 본 화양연화와 공유 스레드 4")
│  [본 영화와 같은 계보 2건]     │     서버가 준 칩만 렌더(§13-17) — 없으면 섹션 자체 생략
├──────────────────────────────┤
│  WHAT TO EXPECT              │  ← v4 신설(P-D): 13차원 기반 사실 칩("형식 급진" 등) — 규칙 기반·LLM 0
├──────────────────────────────┤
│  WHERE TO WATCH 🇺🇸 / LINEAGE │  ← v3.1 §5.1 그대로 (JustWatch 표기·계보 칩·미니맵·The Life 프리뷰)
│  / LOCATIONS / THE LIFE      │
├──────────────────────────────┤
│  READ MORE ON METATAKE       │  ← 유지 (웹뷰 행)
├──────────────────────────────┤
│  [♥ 볼래]  [✕ 패스]  [✓ 봤어] │  ← JudgeBar(하단 고정). 봤어 → 인라인 StarRow(0.5 단위)
└──────────────────────────────┘     모든 전이에 즉시 undo 토스트(§13-15)
```

### 5.2 Tonight = 판단 덱 (v4 재정의)

세로 카드 피드(Lava 유지)를 "피드"에서 **트리아지 덱**으로 재정의한다. 카드 = 스틸 + TS 배지 + 한 줄 리드 + 가용성 점(v3.1 유지) + **판단 3버튼 상시**. 좌 스와이프=패스, 우 스와이프=볼래, 탭=브리프. 처리한 카드는 덱에서 제거(/room Screener의 "kept는 Slate로" 모델), 세션 내 **undo 스트립**("Passed on this session" 이식).

**상단 상황 프리셋 칩 1줄 (가로 스크롤)** — 무드 엔진 신설이 아니라 **기존 랭킹 인자의 상황화**다(서버 신설 0·LLM 0). 스크리너 프리셋 레지스트리(`lib/takescore_presets.ts`, 출하본 6종: safe·gems·highwire·century·peak·durable)를 재사용할 수 있는 칩은 재사용하고, 나머지는 앱 정의임을 명시한다:

| 칩 | 정의 | 출처 |
|---|---|---|
| On my services | `p_providers`=내 선택 (기본 켜짐) | **앱 정의** — 프로바이더 필터는 레지스트리 밖(PresetQuery에 providers 필드 없음) |
| Safe bet | 레지스트리 `safe` = dims(bank:0-22, coward:0-30) | 재사용 — 단 dims 필터는 `cinecodex_ranked` 인자 밖(스크리너 경로) → BFF 적용 방식 P-B 확정(§12-9) |
| Hidden gems | 레지스트리 `gems` = `p_max_votes` 40,000 + ts 45-100 | 재사용 |
| Fresh century | 레지스트리 `century` = `p_year_min=2000` | 재사용 |
| 90 in 90 min | ts 85~100 + `films.runtime` ≤95 | **앱 신규** — 스크리너 정본 §4-H에서 조건부 기획 후 미출시. runtime은 RPC 인자에 없음 → BFF/클라 후필터 |
| Bold pick | 소스 스왑: `me_recommend_wwi(λ=0.6)` | **앱 정의** — 로그인 시만 노출 |

- 로그인 시 카드에 **이유칩 1개**(`me_recommend_wwi` reason chips). 비로그인·데이터 부족이면 칩 없음 — 가짜 금지(§13-17).
- hide-seen: 로그인 시 기본 켜짐 제안(기존 클라 ledger 필터 유지).
- 필터(장르·연대)는 v3.1 유지, 프리셋 칩 뒤로.

### 5.3 Explore (구 Search, v4 확장)

- 검색 유지: `search_all` 직행, 무결과 시 데드엔드 금지(TMDB 폴백 → "Not in the Metatake canon yet" → `/omni` 웹뷰) — v3.1 그대로.
- **브라우즈 신설:** 검색창 아래 장르 그리드(18종, `lib/wtw_genres.ts`)·연대·프리셋 칩(§5.2 재사용) → 결과는 Tonight과 같은 카드·판단 문법.
- 검색 결과 행에서도 스와이프 판단 허용(판단 편재 원칙 §4.1).

### 5.4 커버리지 실측과 폴백 체인 (v3.1 표 유지 + v4 2행 추가)

| 신호 | 커버리지 | 앱 규칙 |
|---|---|---|
| TakeScore | 6,978편 = 전 카탈로그 | 항상 표시 |
| 가용성(US) | 4,818편(69%) · 구독/무료 3,944편 | 없으면 "Not streaming in 🇺🇸 now" + 찜 유도(들어오면 푸시) |
| Invitation | visible 1,959편의 100% / 전체의 28% | 폴백 ①: Fantasia 문장 리드(6,716편=96%, LLM-0) → ②: 섹션 생략. ⚠️Fantasia는 EN 전용 — 비-EN 에디션은 ②로 직행 |
| Lineage | 5,973편(86%) | 없으면 섹션 생략 |
| Locations | 좌표 있는 편만 | 없으면 섹션 생략 |
| **For You 이유칩 (v4)** | 로그인 + rating/seen 축적 필요(`me_recommend_wwi`) | 데이터 없으면 섹션 생략 — 온보딩 ④가 이 커버리지를 여는 장치 |
| **kindred (v4)** | shared_threads는 서비스롤 전용 경로(`film_affinities.shared_meta_take_ids`)라 **BFF 노출 필수**(§7) — 편수 실측은 P-A 확인 항목(§12-9) | 없으면 For You에서 계보 교차만 |

노출 게이팅(리뷰 채택 유지): 검색·Tonight은 전 카탈로그 노출, Film 브리프는 섹션별 유무 게이트(빈 섹션은 자리 없이 접기).

### 5.5 Map — 하나의 데이터 계약, 네 개의 렌더러 (v4 변경 없음 — D4)

`src/lib/pins.ts` 단일 핀 로더 + 표면별 렌더러 4개(웹=MapLibre GL JS / Expo Go iOS=Apple 지도 / **Expo Go Android=WebView MapLibre(키 0)** / dev·스토어=MapLibre Native). 상세는 v3.1 §5.5·§15.5 그대로. 공통 UX: "Near me"(위치 권한은 이 탭에서 처음 요청) · 핀 탭 → 바텀 카드 → **판단 브리프**(바텀 카드에도 판단 바).

### 5.6 Shelf (구 My, v4 승격) — 포트폴리오 3구역

/room 14계기를 재구현하는 게 아니다(§2 헌법 — 실질 근거는 §11의 유지보수 세금 상한). **모바일 상황("내 상태가 어떻지" 5분 점검)에 맞는 요약 3구역**만 네이티브로 만들고, 깊이는 /room 웹뷰로 넘긴다.

```
① 지금 볼 수 있는 내 큐    찜 × 내 구독 가용성 교차 — 첫 줄 "찜 34편 중 오늘 밤 볼 수 있는 것 12편".
                           AgeBadge(Fresh/Aging/Stale — Slate 이식). 새로 들어온 항목 상단 고정(푸시의 시각적 쌍둥이).
② 판단 대기 · 회고         Considering 근사 더미(로컬, §5.0-D2) + Stale 찜 재판단 넛지
                           + Seen 원장·별점·Find/Aligned/Letdown 분포("이번 달 발굴 3편")
③ 시네필 여정              계보 정복률(me_coverage: "Sight & Sound 12/100")·감독 정복(me_auteur_conquest)
                           ·블라인드스팟 1개 제안(me_blindspots)·(후속: me_geo_coverage 지도 커버리지)
                           각 항목 탭 → /room 해당 계기 웹뷰(SSO 핸드오프)
설정(에디션 스위처·계정 관리·인앱 계정 삭제·알림)  → 우상단 기어 시트 (Apple 5.1.1(v) 계정 삭제 유지)
```

**데이터 경로:** 전부 `me_*` 계기 RPC의 **앱 JWT 직호출**(`me_watchlist_scored`·`me_rate_stats`·`me_coverage`·`me_auteur_conquest`·`me_blindspots` — auth.uid 스코프, /room 클라이언트와 같은 경로) + `film_availability(p_slugs…)` 데코(앱 anon, 슬러그 ≤60씩). **BFF 신설 불요**(§7). 대량 목록은 `.range()` 페이징(1000행 캡 — 렌즈 정본 규칙 상속).

## §6 다국가 에디션 아키텍처 (v2 확정 그대로 — v4 변경 없음)

> **오너 요구:** 첫 앱은 미국 타깃. 이후 한국·스페인·일본 등 국가별 대응. **국가만 선택하면 그 국가의 앱이 되도록** 처음부터 구조를 짠다.

### 6.1 원리 — 국가(country)와 언어(locale)는 다른 축이다

- **국가** = 가용성·프로바이더·Tonight 랭킹의 스코프. `film_provider_index`가 139개국 보유, 가용성 계열 RPC가 국가 파라미터를 받는다. **국가 축은 DB 변경 0.**
- **언어** = 콘텐츠·UI 문자열의 로케일. 웹 다국어 프로젝션 정본의 `_<loc>` 컬럼과 로케일 레지스트리(`lib/i18n/locales.ts`)를 그대로 읽는다. 앱에 별도 번역 저장소를 만들지 않는다(§13-1).

### 6.2 에디션 레지스트리 — 앱의 유일한 국가 목록

```ts
// app 코드: editions.ts — 웹 LOCALES 레지스트리와 정합 유지
export const EDITIONS = {
  US: { country: "US", locale: "en", live: true  },   // 출시 에디션
  KR: { country: "KR", locale: "ko", live: false },   // 웹 /ko 프로젝션 live 후 개방
  ES: { country: "ES", locale: "es", live: false },
  JP: { country: "JP", locale: "ja", live: false },
} as const;
```

**규칙:** ① 새 국가 = 1항목 + UI 사전 1파일 ② 콘텐츠 로케일은 웹 프로젝션 live 언어만(아니면 en 폴백) ③ 가용성은 항상 에디션 국가로 — 언어와 절대 결합 금지.

### 6.3 UI 문자열 — P0부터 i18n 키 강제 (구현 완료 상태 유지)

하드코딩 금지. `expo-localization` + 사전 파일, 키 집합은 웹 어휘 매트릭스와 공유. **v4 신규 문자열(판단 바·시효 배지·프리셋 칩·회고 어휘)도 전부 i18n 키부터** — Find/Aligned/Letdown의 ko 어휘는 /room 정본(발굴/합치/실망)과 동일하게.

### 6.4 스토어 전략 — 단일 앱, 국가별 SKU 금지 (유지)

에디션 = 런타임 설정. 스토어프론트별 리스팅 현지화로 달성, SKU 분리 금지.

### 6.5 푸시의 국가 의존 (유지)

가용성 diff 워커는 (film × country) 단위, 수신자는 `user_prefs.country_code` 조인. "내 찜이 내 나라 서비스에 들어왔는가"가 알림의 정의다. (D5: leaving-soon은 후속 — §12-8.)

## §7 기술 아키텍처 (v3.1 + v4 증분)

- **Expo(React Native) 단일 코드베이스** — iOS+Android, EAS Build/Submit, OTA(expo-updates). v3.1 그대로.
- **데이터 경로 — 화면 1개 = 집계 엔드포인트 1개 (BFF), 단 개인화는 예외 (v4 명확화):**
  - 익명·집계 표면(Film 브리프 공용부·Tonight·Director) = BFF 유지: `GET /api/v1/app/film|director|tonight|services|tmdb-search` (guardAndLog → The Meter `app_*` 계측).
  - **개인 표면(Shelf·For You·판단 쓰기) = `me_*` RPC 앱 JWT 직호출** — auth.uid 스코프·개인당 소량이라 anon 8s 문제 없음. /room 클라이언트와 같은 족보.
  - ⚠️ **`*_mine`(p_user 인자·service_role 계열)과 `me_*`(auth.uid 스코프)는 다른 족보다.** 전자는 여전히 앱 직호출 금지(§13-4, `/api/lens/*` 경유), 후자가 앱 개인화의 표준 경로.
- **v4 BFF 변경 2건:** ① `app/film` 필드 추가 2단계 — P-A에서 `rank`·`vcr`(VerdictStrip), P-D에서 `dims`·`kindred`(각 단계 **PAYLOAD_V 범프**, §16.5 계약). kindred는 서비스롤 전용 컨텍스트팩 경로(`film_affinities.shared_meta_take_ids`)라 **BFF가 유일한 노출면**이다(0018 `graph_film_neighbors`는 anon이지만 shared_threads가 없음) ② `app/tonight`에 프리셋 파라미터 통과(재사용 칩 3종은 `lib/takescore_presets.ts` 정의를 서버가 재사용, 앱 정의 칩 3종은 §5.2 표가 정본).
- **v4 쓰기 전환:** 찜/Seen/패스/Restore/별점 = `me_set_watchlist`·`me_mark_seen`·`me_dismiss`·`me_undismiss`·`rate_film` 5종 (§5.0). 직접 upsert 경로는 전환 완료 시 제거.
- **§7.3 SSO 핸드오프·인증·지도·푸시·이미지:** v3.1 그대로(SSO = 민트 `POST /api/v1/app/handoff` + `/auth/confirm` 소비, §15.3-2).

## §8 양 플랫폼 — iOS·Android 동시 완성 (v3.0 확정 유지, 변경 없음)

Expo 단일 코드베이스, 플랫폼 분기 4개(지도·탭바 블러·로그인·딥링크)뿐. 상세는 v3.0 §8 그대로 — 패키지 `net.metatake.app`·edge-to-edge·`softwareKeyboardLayoutMode: "pan"`·적응형 아이콘·`eas.json` 양 플랫폼 프로필. v4 신규 화면·컴포넌트는 전부 공용 코드(분기 추가 0 목표).

## §9 구축 순서 — v3.1 완료분 + v4 단계 (D1 확정: P-A·P-B는 게이트 전)

> **상태(2026-07-17): v3.1 P0~P3 + Android 코드 완성·검증(§15). v4 P-A~P-D는 구현 대기.**

| 단계 | 내용 | 산출물 |
|---|---|---|
| ✅ P0~P3 | v3.1 전량(스캐폴드·i18n·에디션·검색·Film·Tonight·Auth·찜/Seen·Map·Director·푸시·딥링크) | §15 AS-BUILT |
| **✳ P-A 판단 코어** | grant 실측(§5.0) → `me_*` 5 RPC 전환(Restore=`me_undismiss`) → JudgeBar+세션 undo → 인라인 별점(StarRow) → VerdictStrip(BFF film에 rank·vcr) → 회고 어휘(Find/Aligned/Letdown) | 판단 상태 기계 가동 — **게이트 전** |
| **✳ P-B 판단 덱** | Tonight 재편(스와이프 트리아지·상황 프리셋 칩·undo 스트립) → **For You 이유칩(덱+브리프, `me_recommend_wwi`)** → Explore 리네임+브라우즈 | 트리아지 동선(§4.3-3) — **게이트 전** |
| **🚧 게이트** | **TestFlight 4주 (외부 테스터 ≥30명)** — KPI 4개: ① D30 리텐션 ≥20% ② 푸시 옵트인 ≥40% ③ **세션당 결정율 ≥25% — v4 정의 확장: Watch 탭아웃 ∪ 찜 ∪ 패스 ∪ 봤어(판단은 전부 결정이다)** ④ 주간 찜 추가 ≥3/활성유저. **v4 보조 지표 4개**: 주간 판단 처리량(상태 전이 수)·찜→Seen 전환율·Stale 찜 비율 추이·회고 Find 비율. 판정일 = 개시 +35일, 미달 시 스토어 출시 보류 | Go/No-Go |
| **P-C Shelf** | 포트폴리오 3구역(§5.6)·설정 기어 이동·온보딩 ④ 취향 캘리브레이션 | 게이트 중 OTA |
| **P-D 확장** | What to expect 칩(§5.1)·**kindred 교차(BFF film에 dims·kindred — PAYLOAD_V 범프)**·Stale 재판단 넛지 푸시(주 1회 상한)·회고 화면 다듬기 | 게이트 중 OTA |
| **P4** | App Store 제출(스크린샷=판단 플로우+지도+가용성 필모 우선·개인정보 라벨·심사 대응) + 웹 스마트 배너 | iOS 출시 |
| P5 잔여 | Play 등록/리스팅(오너 §15.4-4)·KR 에디션 개방(웹 /ko live와 동기 — 이미 live, 오너 결정 대기) | 확장 |

## §10 선행 준비물 — ✅ v3.1분 전 항목 완료 (§15가 현재 상태). v4 선행 = §5.0 검증 2건뿐 (마이그 0)

v3.1의 마이그 0106(`push_tokens`·`user_prefs`·`push_sent`)·웹 4건·오너 몫은 완료/§15.4 그대로. **v4는 DB 마이그 0건** — 0109는 D2의 Considering 승격 조건 충족 시에만 연다.

## §11 비용 (v3.1 유지 + v4 = $0)

초기 ~$125 + 월 $0~44 구조는 v1 그대로. **v4 추가 비용 = $0** — 마이그 0·LLM 0·신규 인프라 0, 전부 기존 RPC·데이터 위의 클라이언트/BFF 작업이다. 진짜 비용이 유지보수 세금(오너 주의력)이라는 판정도 유지 — v4의 신규 네이티브 표면은 실질 1개(Shelf 3구역)이고 나머지는 기존 화면의 재구조화라 세금 상한(§2)을 지킨다.

## §12 리스크·미결 (오너 결정 필요 + 착수 검증)

1. **The Life 배치 해석** — v2 설계 유지(Film 프리뷰 + Director 전문).
2. **Apple 4.2(minimal functionality)** — v4로 **방어가 강해진다**: 판단 상태 기계·트리아지·포트폴리오·회고는 전부 네이티브 가치. 심사 스크린샷을 판단 플로우 중심으로 재구성(§9 P4).
3. **KR 에디션 개방 시점** — 웹 /ko 프로젝션 live 완료(2026-07-17) → 개방은 오너 결정 대기.
4. **수익화** — 무료 전제 유지.
5. **스토어 빌드 지도 엔진** — v3.1 §12-5 그대로(택일: react-native-maps 단일화 vs MapLibre Native 유지+프로덕션 타일 소스 결정). `src/lib/pins.ts` 계약 불변.
6. **`me_*` RPC grant 실측 (P-A 첫 작업)** — `me_set_watchlist`·`me_mark_seen`·`me_dismiss`·`rate_film`·`me_recommend_wwi`·`me_watchlist_scored`·`me_rate_stats`·`me_coverage`·`me_auteur_conquest`·`me_blindspots`의 authenticated EXECUTE 확인(`me_undismiss`만 0045에 GRANT 명시 — 나머지는 live-only). `user_movies`도 live-only DDL — repo로 추정 금지(§5.0).
7. **Restore(un-dismiss) 경로** — ✅**해소(v4.0 검증에서 발견)**: `me_undismiss(p_slug)`(0045 R2, authenticated GRANT repo 명시, /room `useRoomActions` 정본 경로). §5.0에 반영 완료.
8. **D5 leaving-soon 푸시 (후속 분리 확정)** — v4 범위 밖. 재기획 시 한계 명시: TMDB 가용성 데이터엔 종료 예고가 없어 "사전 예고"가 아니라 "사라짐 감지 후 통지"만 가능(fpi diff 역방향).
9. **P-A/P-B 실측 2건** — kindred 편수 커버리지(`film_affinities` shared_threads — BFF 노출 전제) · Safe bet 칩 dims 필터(bank:0-22, coward:0-30)의 BFF 적용 방식(스크리너 dims 경로는 `cinecodex_ranked` 인자 밖).

## §13 불변식 (구축 시 위반 금지 — v1 8조 + v2 4조 + v3.1 2조 + **v4 4조**)

1. **콘텐츠 정본은 웹/DB** — 앱 전용 콘텐츠·점수·번역 저장소 신설 금지.
2. **딥링크·공유는 항상 `metatake.net` URL** — 자체 스킴 단독 금지.
3. **웹에 전면 앱설치 인터스티셜 금지** — 스마트 배너까지만.
4. **`*_mine` RPC 앱 직호출 금지**(0042) — 개인화는 `/api/lens/*` 경유. (`me_*` auth.uid 족보는 별개 — §7)
5. **찜/Seen 원장은 `user_movies` 단일** — 앱 로컬은 캐시일 뿐, 서버 우선.
6. **cinecodex.scores 읽기 전용 · never-blend** (외부 평점과 혼합 금지).
7. **anon 8s timeout 전제** — 무거운 질의는 BFF/API 경유.
8. **TMDB 이미지 로고 표기 + Where-to-watch에 JustWatch 표기.**
9. **정적 읽기 표면의 네이티브 재구현 금지** — §2 판별 기준 밖의 네이티브 섹션 추가는 이 문서 개정 먼저.
10. **국가와 언어 축 결합 금지** — 가용성은 country, 콘텐츠는 locale.
11. **하드코딩 UI 문자열 금지** — i18n 키(§6.3).
12. **웹뷰 진입은 항상 SSO 핸드오프 경유**(§7.3).
13. **프로젝트 SDK ≤ Expo Go의 SDK**(§15.2b) — 올리기 전 `curl -s "https://itunes.apple.com/lookup?id=982107779" | grep -o '"version":"[^"]*"'`.
14. **앱 디자인 토큰은 `mobile/src/theme.ts`가 SSOT** — 웹 v4 토큰 이식 금지·역방향도 금지. 공유는 PT Serif 실 하나.
15. **(v4) 모든 판단은 되돌릴 수 있다** — 패스 포함 전 상태 전이에 즉시 undo/Restore. 확인 다이얼로그 금지(전이가 가볍고 가역이므로 마찰 0이 원칙).
16. **(v4) 판단 상태의 원장도 `user_movies` 단일**(dismissed·rating 포함) — 앱 로컬 저장은 캐시와 Considering 근사(D2)뿐, 서버 우선. (5조의 확장)
17. **(v4) 근거는 서버가 준 것만 렌더** — 이유칩·회고 판정 외의 유사 match %·가짜 개인화 문구 생성 금지. 데이터 없으면 섹션 생략이 정답. (/room "no fake numbers" 상속)
18. **(v4) 내 별점 · TakeScore · 외부평점은 절대 혼합 금지, 시각적으로 그룹 분리.** (6조의 사용자면 확장 — /room never-blend 상속)

## §14 개정 이력

- v1 (2026-07-16, `319fed7`): 최초 기획 — 6축+접착제 4개, 탭 5개, P0~P4.
- v2 (2026-07-16, `681fbce`): 오너 확정 — 2층 구조 헌법화, Lineage·The Life 편입, 에디션 아키텍처, BFF·SSO, KPI 게이트, 불변식 12조.
- v2.1 (2026-07-16, c36c1d4): P0~P3 구현 — §15 AS-BUILT.
- v2.2 (2026-07-16, 70f313a): 완전 시제품 — 지도 3면·Tonight 리드·웹 리더·프리뷰 결함 3건(bf1e2b8).
- v2.3 (2026-07-17): §16 데이터 연동 지도 신설.
- v3.0 (2026-07-17): 디자인 시스템 v2 "Lava" 전면 + Android 패리티.
- v3.1 (2026-07-17): SDK 54 정렬 + 폰 실행 자동화(`start-local.sh`) + 불변식 13·14.
- **v4.0 (2026-07-17): 판단 내비게이터 개정 (오너 D1~D5 확정 · 구현 대기)** — 한 문장 정의 교체(판단 상태를 전진시키는 앱), 판단 상태 기계 §5.0(dismissed·rating 승격·Restore·회고 Find/Aligned/Letdown·쓰기 `me_*` RPC 전환), Film 카드=판단 브리프(§5.1 VerdictStrip·For You·판단 바), Tonight=판단 덱+상황 프리셋 칩(§5.2), Explore 리네임+브라우즈(§5.3), My→Shelf 포트폴리오 3구역(§5.6), 온보딩 ④ 취향 캘리브레이션(§4.2), 개인화 데이터 경로 명확화(§7: `me_*` 직호출 vs `*_mine` 금지 · 쓰기 5 RPC — Restore=`me_undismiss` 0045 발견으로 미결 1건 해소), P-A~P-D 단계+게이트 KPI 확장(§9), 불변식 15~18(§13). 적대 검증 3에이전트(140클레임)로 사실 교정 19건 반영. **§15·§16은 v3.1 기준 AS-BUILT — v4는 아직 코드에 없다.**

---

## §15 AS-BUILT (2026-07-16~17) — **v3.1 기준.** P0~P3 코드 완성·검증 통과 (v4.0 P-A~P-D는 미구현)

### 15.1 무엇이 만들어졌나

**모바일 앱 `mobile/`** — **Expo SDK 54**(RN 0.81.5·React 19.1)·expo-router v6·TypeScript strict·typedRoutes. **54인 이유=Expo Go 상한, 올리기 전 §15.2b·불변식 §13-13 필독.**
- 화면 9개: `(tabs)/` Tonight·Search·Map·My + `film/[slug]`(v3.1 §5.1: 히어로→TS도넛→Invitation→Where to watch→Lineage→Locations→The Life 프리뷰→Read more→액션바)·`director/[slug]`(§2.2: 가용성 점 필모그래피 포함)·`read`(SSO 웹뷰 리더+링크 인터셉트)·`onboarding`(국가→서비스→계정 3스텝)·`+not-found`(미매치 딥링크→리더).
- 파운데이션: `src/theme.ts`(**디자인 시스템 v2 "Lava" SSOT** — §3, 웹 v4와 분리·불변식 §13-14)·`src/editions.ts`(§6.2 레지스트리)·`src/i18n/`(en·ko·es·ja 4사전, 전 화면 t() 강제 — TODO(i18n) 0)·`src/lib/{api,supabase,push}.ts`·`src/state/{prefs,films}.tsx`(user_movies 단일 원장, 옵티미스틱+롤백)·`src/components/{ui,TSDonut,FilmRow}.tsx`.
- app.json: `net.metatake.app`·scheme `metatake`·associatedDomains·Android intentFilters·Sign in with Apple·플러그인(maplibre/notifications/location/apple-auth).

**웹(BFF·인프라)** — `app/api/v1/app/` 7라우트: `film/[slug]`·`director/[slug]`·`tonight`·`services`·`handoff`(POST)·`account-delete`(POST)·`tmdb-search`. 전부 guardAndLog(The Meter 원장에 `app_*` 엔드포인트로 계측)+API_CORS+s-maxage 캐시. `app/api/lens/marquee`에 Bearer 폴백(가산적·쿠키 경로 불변). `app/api/push/availability-cron`(§6.5 diff 워커)+vercel.json 크론(매일 09:00 UTC). `public/.well-known/` AASA+assetlinks(플레이스홀더). next.config에 AASA content-type 헤더. tsconfig exclude+.gitignore에 mobile.

**DB** — 마이그 0106 `push_tokens`·`user_prefs`·`push_sent`(own-row RLS / 원장은 서비스롤 전용) **프로덕션 적용 완료**. ⚠️0105는 다국어 프로젝션이 선점 — 번호 갭은 의도.

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
| **v3.1 재검증(2026-07-17, SDK 54)** | expo-doctor 18/18 · tsc 0 · **iOS·Android·웹 3번들 전부 빌드** · 브라우저 E2E(Lava 디자인 실물: 그라데이션 CTA·플로팅 배지·블러 탭바) 콘솔 에러 0 · **Android WebView 지도 실검증**(800핀 → 실타일+클러스터 398/155/45, 핀 탭 → 브리지 페이로드 `{name:"Charlotte…", film_slug:"roofman-2025"}` 수신) |

### 15.2b ⚠️ SDK는 57이 아니라 **54** — Expo Go가 정하는 상한 (2026-07-17 실측)

스캐폴드(`create-expo-app@latest`)가 SDK 57을 잡았지만 **App Store/Play의 Expo Go는 SDK 54 클라이언트**다(실측: iOS US·JP·GB 전부 `54.0.2`, Android `54.0.8`). Expo Go는 한 번에 **한 SDK만** 지원하므로 SDK 57 프로젝트는 실행을 거부한다.

**결정: 프로젝트를 SDK 54로 내렸다**(expo ~54 · RN 0.81.5 · React 19.1 · expo-router 6 · reanimated 4.1). 폰 실기 검토를 여는 유일한 무비용 경로. 나중에 dev client를 빌드하는 시점에 `npx expo install --fix`로 올리는 것은 정형 작업.

- 다운그레이드 부작용 2건 처리: ① `expo-router` SDK 54는 테마 재export 없음 → `@react-navigation/native` 직접 import ② `android.edgeToEdgeEnabled`는 SDK 54에서 유효 → expo-doctor 18/18.
- ⚠️ SDK 올리기 전 Expo Go 지원 SDK 먼저 확인(§13-13).

### 15.3 계약 대비 구현 편차 (전부 의도적)

1. **푸시 워커 = Vercel 크론 라우트** — 인프라 0. 로직은 §6.5 그대로((film×country) diff, push_sent 원장).
2. **SSO = 기존 `/auth/confirm` 재사용** — 민트(`POST /api/v1/app/handoff`, Bearer)가 `generateLink(magiclink)`의 일회용 token_hash URL 반환.
3. **push_tokens.user_id NOT NULL** — 익명 등록 배제.
4. **이메일 인증 = 6자리 OTP 코드** — 인앱 완결. ⚠️Supabase 이메일 템플릿에 `{{ .Token }}` 노출 필요(오너 TODO).
5. **Tonight 카드 lead=null** — 편당 invitation 40회 페치는 과중. 후속 최적화.
6. **hide-seen = 클라이언트 ledger 필터** — lens Bearer 경로는 준비돼 있음(`api.tonightMine`).
7. **Watch 실행 = `/whereto/[slug]` 리더** — 프로바이더 앱별 신뢰 가능한 딥링크 스킴 부재.
8. **user_movies 행 삭제 안 함** — 불리언만 false로(데이터 무손실). ⚠️v4.0 P-A에서 이 직접 upsert 경로 자체가 `me_*` RPC로 전환된다(§5.0) — 전환 후 이 항목은 Restore 한정으로 재서술할 것.

### 15.4 오너 TODO (앱이 스토어에 가기 위한 계정·콘솔 작업)

> **제출 자료는 준비 완료(2026-07-18)**: 리스팅 킷 = `mobile/store/`(listing-en + listing-ko·REVIEW-NOTES·PRIVACY-LABELS·ASSETS·feature-graphic.html — **등록 스토어프론트 = 미국 + 한국**(오너 결정 2026-07-18): 기본 리스팅 EN, 한국 스토어프론트 현지화 = listing-ko) · 웹 = `/app`(랜딩)·`/privacy`(정책 — **제출 전 오너 법적 검토 필수**) · 인앱 = 웰컴 스텝·워드마크·Google OAuth 코드. 아래는 오너만 할 수 있는 계정·콘솔 작업.

1. **Apple Developer 등록($99/년)** → ① `eas init`(푸시 projectId) ② `eas build --platform ios` ③ `public/.well-known/apple-app-site-association`의 `TEAMID` 교체(수동 커밋).
2. **Supabase Auth 콘솔**: Apple provider 활성화·**Google provider 활성화(코드는 배선 완료 — Google Cloud OAuth 클라이언트 생성 후 client id/secret 입력, Redirect URL 화이트리스트에 `metatake://auth-callback` + 개발용 `exp://<맥 LAN IP>:8081/--/auth-callback` 추가)**·이메일 OTP 템플릿에 `{{ .Token }}` 추가.
3. (선택) Vercel env `CRON_SECRET` — 푸시 크론 보호.
4. **Android 스토어**: Play 등록($25) → `eas build --profile production --platform android`(AAB) → `assetlinks.json` SHA256 교체(수동 커밋). 내부 APK는 계정 없이 `--profile preview` 가능.
5. **푸시 자격증명**: iOS=APNs(EAS 자동) · Android=FCM v1 서비스계정 키. 둘 다 `eas init` 이후.
6. TestFlight/Play 내부 테스트 4주 게이트(§9) — **D1: P-A·P-B 완료 후 개시.**

**⚠️ dev 빌드를 만든 뒤에야 SDK를 올릴 수 있다** — 그 시점에 Expo Go 검토 경로는 끝난다. 순서를 뒤집지 말 것.

### 15.5 실행 방법 — 상세는 `mobile/README.md` (정본)

**폰으로 보기 = 명령 하나:**

```bash
cd mobile && ./start-local.sh     # 데이터 서버 + Metro + QR 페이지(자동으로 열림)
```

| 경로 | 필요한 것 | 볼 수 있는 것 |
|---|---|---|
| **① 맥 브라우저** `npm run dev` + `cd mobile && npx expo start --web` | 없음 | 전부 — 지도 포함·리더는 iframe |
| **② 폰 Expo Go**(iOS·Android) — `./start-local.sh` 후 QR 스캔 | 같은 Wi-Fi | 전부 — iOS 지도=Apple, Android=WebView MapLibre. 푸시·Apple 로그인만 네이티브 빌드 필요 |
| **③ 네이티브 빌드** `eas build --platform all` | Apple $99(iOS) / Play $25는 공개 시 | 전체 |

**데이터 출처:** PR #7 머지 전에는 로컬 `npm run dev`(:3000) 필요(`start-local.sh`가 자동으로 띄움). 머지 후에는 기본값(`https://metatake.net`).

**⚠️ IP 드리프트 함정:** 맥 LAN IP가 바뀌면 Metro 광고 URL·`EXPO_PUBLIC_METATAKE_BASE`·QR 셋이 어긋난다 — `start-local.sh`가 매 실행마다 고정·검증. QR/서버를 손으로 띄우지 말 것.

**⚠️ QR이 안 보이는 이유:** Metro는 QR을 자기 터미널에 그린다 — 백그라운드 실행 시 `scripts/qr.mjs`가 HTML 페이지로 렌더.

### 15.6 브라우저 프리뷰가 잡아낸 실제 결함 3건 (2026-07-16, bf1e2b8)

1. **CORS**: 커스텀 헤더 `x-metatake-app`이 전 GET을 프리플라이트화 → 제거(계측은 user-agent 기반). ⚠️API CORS는 건드리지 않았다.
2. **검색 연도 중복**: `search_all`의 `sub`가 이미 연도 포함 → RPC 자막 단일 출처.
3. **음수 TakeScore 노출**(Green Rain `-11`): 웹 기결정(표시만 0 클램프·랭킹/API raw)을 앱이 위반 → `TSBadge` 0~100 클램프.

**검증 방식:** 스크립트로 실루프(온보딩→Tonight→Film→Search→Director→My), 콘솔 에러 0.

---

## §16 데이터 연동 지도 (SSOT 크로스맵) — 앱과 사이트가 "같이 반영"되는 모든 접점 (v3.1 기준 + v4 예정 표기)

> **이 절이 답하는 질문:** 웹/DB에서 무언가가 바뀌면 앱에 어떻게 반영되는가? 앱이 무언가를 기록하면 웹 어디에 나타나는가?
> 원칙(§0 불변): 앱은 자기 데이터를 갖지 않는다.

### 16.1 읽기(소비) — 콘텐츠·랭킹·가용성

| 데이터 | 앱 접근 경로 | 원천(웹 SSOT) | 갱신 전파 |
|---|---|---|---|
| Tonight 랭킹 | BFF `app/tonight` → `cinecodex_ranked`(**Marquee v11 인자면**) | `HANDOFF-왓투와치-스트리밍결정.md` — "신규 인자 default=이전 동일" 불변식이 앱도 보호 | BFF 캐시 s-maxage 900 |
| TakeScore | `takescore_for_slugs` `[{slug,ts}]` (BFF film/director/tonight) | `HANDOFF-테이크스코어-스크리너.md` — 벌크 TS 표준 계약 | 재채점 → 캐시 만료 시 자동 |
| 가용성·프로바이더 | `film_availability`·`wtw_services` (BFF + Search 데코는 앱 직접 anon) | 왓투와치 정본 · 원천 `film_provider_index`(`fpi_rebuild()`) | fpi_rebuild → 캐시 만료 + 푸시 diff(16.3) |
| Invitation 리드 | BFF film(단건)·tonight(배치 2쿼리, per-film 루프 금지) | takes.is_invitation — 본문=rationale | 발행 즉시(캐시 300s) |
| Fantasia 폴백 리드 | `film_sentences_for` — **EN 전용** | `HANDOFF-임베딩판타지아-문장층.md` + KO프로젝션 결정 | 문장층 재빌드 시 자동 |
| Lineage | `film_lineage_for` (BFF film) | `HANDOFF-계보-SEO-읽는층.md` | 데이터 웨이브 시 자동 |
| 촬영지 핀 | `film_geo`(BFF film — mergePins+발음부호 dedupe) + `/api/v1/locations`(맵 글로벌, 시드 10개국) | 아틀라스 정본 · 오픈 데이터셋 | 지오코딩 갱신 시 자동. ⚠️글로벌 맵은 시드 국가 근사(~2,000/17k핀) |
| 감독 카드 | `directors`·`director_{picks,next,facts,portrait}` (BFF director) | `HANDOFF-감독읽는층-리셉션-SEO.md` | 캐시 300s |
| 검색 | `search_all` 앱 직접(anon) — 자막(sub)=단일 출처 | `HANDOFF-검색엔진-통합.md` | 즉시 |
| **(v4 예정) 판단 신호 확장** | BFF `app/film`에 rank·vcr(P-A)·dims·kindred(P-D) 추가 — 단계별 PAYLOAD_V 범프. 원천 `cinecodex_card`·`film_affinities.shared_meta_take_ids`(서비스롤 — BFF가 유일 노출면) | 스크리너 정본·연결엔진 정본 | P-A·P-D에서 |
| **(v4 예정) 개인 계기** | `me_recommend_wwi`(P-B) · `me_watchlist_scored`·`me_rate_stats`·`me_coverage`·`me_auteur_conquest`·`me_blindspots`(P-C) — **앱 JWT 직호출** | `HANDOFF-마이룸-v3-redesign.md` | P-B·P-C에서 |
| 깊은 읽기(웹뷰/iframe) | 웹 페이지 그대로 | 각 표면 정본 | 즉시(재구현 0) |

### 16.2 쓰기(기록) — 앱이 사이트 데이터에 남기는 것

| 기록 | 경로 | 웹에 나타나는 곳 | 정본 |
|---|---|---|---|
| 찜/Seen | v3.1: `user_movies` 직접 upsert(own-row RLS, `onConflict user_id,film_id`) — **v4.0 P-A에서 `me_set_watchlist`·`me_mark_seen`·`me_dismiss`·`me_undismiss`·`rate_film` 5 RPC로 전환 예정(§5.0 — NAV 스냅샷·dismissed 부수효과 복원)** | 렌즈·/room·Marquee hide-seen — 같은 원장, 즉시 동기. **v4부터 /room Slate·Holdings·Ledger·Screener(dismissed)와도 완전 정합** | `HANDOFF-마이필름-렌즈.md`·`HANDOFF-마이룸-v3-redesign.md` |
| 에디션 선호 | `user_prefs`(country/locale/provider_ids/push_enabled) | 푸시 워커 조인 키 | 마이그 0106 |
| 푸시 토큰 | `push_tokens`(로그인 필수) | 푸시 워커 발송 대상 | 마이그 0106 |
| API 사용 계측 | `guardAndLog` 자동 → `api_calls` 원장(`app_*` 엔드포인트) | /admin/usage "The Meter" | `HANDOFF-AI사용현황-어드민.md` |
| 개인화 읽기 | `/api/lens/marquee` — 쿠키 실패 시 Bearer 폴백 | — | 렌즈 정본 · `*_mine` 직호출 금지 유지 |

### 16.3 크론·워커 — 데이터 흐름의 자동 전파

`/api/push/availability-cron`(vercel.json, 매일 09:00Z): `user_prefs(push_enabled)` × `user_movies(watchlist)` × `film_provider_index(country, sub/free)` − `push_sent` 원장 → Expo push. fpi_rebuild가 돌면 다음 크론에서 신규 진입분 자동 통지. (D5: leaving-soon 역방향 diff는 후속 — §12-8. v4 P-D의 Stale 넛지는 이 크론에 주 1회 상한 규칙으로 추가.)

### 16.4 레지스트리 결합 — 다국가·다국어의 단일화

- 앱 `EDITIONS` ↔ 웹 `lib/i18n/locales.ts` LOCALES 레지스트리: 웹 새 언어 live → 앱은 에디션 1항목 개방. 앱 번역 저장소 없음(§13-1).
- 앱 i18n 사전 키 ↔ 웹 코어 어휘 매트릭스: 웹·앱 용어 분기 차단. **v4: 판단 어휘(Find/Aligned/Letdown 등)는 /room 어휘와 동일 계약.**
- **(v4) 프리셋 레지스트리**: Tonight 상황 칩 중 재사용분 3종(Safe bet·Hidden gems·Fresh century) ↔ 스크리너 `lib/takescore_presets.ts` — 정의 1곳, 서버(BFF)가 재사용. 앱 정의 칩 3종(On my services·90 in 90 min·Bold pick)은 §5.2 표가 정본.

### 16.5 변경 시 체크리스트 — "같이 반영" 보장 절차

| 웹에서 이걸 바꿀 때 | 앱 쪽 필요 조치 |
|---|---|
| RPC에 인자 추가 | 없음 — default=이전 동일 불변식이 지키는 한 |
| RPC 반환/페이로드 형태 변경 | BFF가 흡수. 앱 계약(`mobile/src/types.ts`)까지 바뀌면 **PAYLOAD_V 범프** + `v` 필드로 구클라이언트 판정 |
| 콘텐츠 갱신(리드·계보·가용성·좌표) | 없음 — BFF 캐시 만료로 자동 |
| **읽기 표면 라우트 개명** | ⚠️유일한 수동 결합점: `mobile/app/film/[slug].tsx` readMore·`mobile/app/director/[slug].tsx` readMore·`mobile/app/read.tsx` 인터셉트 정규식 3파일 |
| 사이트 디자인 토큰 변경 | 없음 — 동기하지 말 것(§13-14) |
| user_movies 스키마 변경 | 렌즈 정본·**마이룸 정본**·앱 `src/state/films.tsx` 동시 검토 (원장 공유자 3곳 — v4부터 /room 계기들이 앱 표면과 직결) |
| **(v4) `me_*` RPC 시그니처 변경** | /room과 앱이 같은 족보를 직호출 — **두 클라이언트 동시 검토**(마이룸 정본 §1 create-or-replace 오버로드 함정 포함) |
| **(v4) 스크리너 프리셋 정의 변경** | 재사용 칩 3종(safe·gems·century)은 `lib/takescore_presets.ts`가 단일 정의 — BFF `app/tonight` 통과분 자동 반영, 앱 칩 라벨 i18n 키만 확인. 앱 정의 칩 3종은 무관 |
