# HANDOFF-발견피드.md — "Discoveries" 신생 영화 사이트 발견 피드 (정본 v2)

> **상태: ✅ P0 스캐너 + P1 페이지 구축·라이브검증 (2026-07-18, 커밋 88e5201 브랜치 `feat/discovery-feed`)** — 우선순위 = **백그라운드**. 크론 미설치(발행 수동)로 비활성 출하. AS-BUILT는 §13. Tier-2 noindex 신호회수·다국어 웨이브2(ja/es)가 여전히 상위.
> 원안 `discovery feed/metatake_discovery_feed_plan.md`(v1)는 실측 검증으로 여러 가정이 반증되어 이 문서로 **대체**됨. v1은 이력 보존용.

---

## 0. 한 줄 요약 + 프로젝트 지위

새로 태어나는 영화 사이트를 **자동 스캐너**(사람 개입 0)로 모아 두었다가, 사람이 주 15분 가볍게 걸러 **부정기 다이제스트**로 소개하는 프로젝트. 상시 서버 0대, 월 현금비용 $0~5, 주간 의무 없음.

**이것은 트래픽 레버가 아니다.** 신생 도메인의 백링크는 권위≈0이라 SEO 가치가 미미하다. 진짜 가치 = 포지셔닝·관계 자산("신뢰받는 발견 큐레이터") + AI봇맞이하기 프로젝트의 '언드 미디어' 축 + metatake 유사도메인 브랜드 감시(부수효과). 시계는 1~2년.

**왜 백그라운드인가 (2026-07-18 실측):** 최근 28일 총 331 세션(구글 90, 다이렉트 209 — 오너 방문 포함 추정). 트래픽 병목은 백링크가 아니라 **구글 색인**(발행 ~27k 페이지 대비 검색 세션 극소). 트래픽이 목표인 시간은 Tier-2 신호회수·웨이브2에 쓴다.

---

## 1. 목표 / 비목표

**목표**
- 양질의 신생 영화 사이트를 남보다 먼저 발견하고, 진짜 에디토리얼 코멘트와 함께 소개한다.
- 소개받은 사이트가 자연스럽게 metatake를 인지(GSC 백링크 리포트·리퍼러)하고, 자발적 반응(역링크·역방문·답장)이 쌓이게 한다.
- v1의 핵심 정신 유지: **요청이 아니라 선물. 양이 아니라 질.**

**비목표 (금지)**
- 주간 발행 약속·쿼터 (부정기 발행, §3 D3)
- 트래픽 KPI로 이 프로젝트를 평가하는 것 (§9)
- 실시간 수집 인프라: certstream 자체호스팅, CZDS .com/.net zone diff (§2 근거로 폐기)
- 대량 아웃리치·자동 발송 (§8)

---

## 2. 실측 근거 (2026-07-18 검증 3갈래 — 재논쟁 금지)

향후 세션이 v1 가정으로 회귀하지 않도록 기록한다.

**① NRD 실험 (WhoisDS 2026-07-16자 70,000 도메인에 v1 필터 적용)**
| 항목 | 실측 |
|---|---|
| 키워드 매치 | 312건 (0.45%) |
| 구성 | 해적판·스트리밍 ~20% (lordfilm 미러 클러스터 단독 43개) · 가짜 부분문자열 ~21% (medicine→cine 19건, framework→frame 11건, freelance→reel 8건) · 영화 무관 사업체 ~22% · 진짜 영화문화 ~25-30% |
| 비평·저널·영화제·아카이브로 좁히면 | 하루 ~30건 (10%) — 단, 신생 도메인 대부분은 **탄생 시점에 빈 페이지** |
| `cinephile` | 0건 (고정밀 키워드는 NRD에 안 나타남) |
| `.film/.movie/.cinema` 신규등록 | **0건** — v1의 "전용 TLD 전수 수집" 레인은 빈 파이프 |
| v1 해적판 컷(watch/free/hd…) | 이중 고장: 20건 중 13건 오탐(freelance의 free), lordfilm 43개는 0건 검출 |

**② 인프라 현실 (2026)**
- certstream 공개 서버 = 원래 "데모"·수일 다운 이력·비권장. RFC6962 로그 자체가 static-CT-API로 이행 중 → 실시간 CT 테일링은 유지보수 부채.
- CZDS = 그랜트 만료·재신청 대상, Verisign(.com) 승인 까다로움, .com zone 비압축 ~15-25GB/일 — diff는 무료 NRD 피드와 중복 노동.
- crt.sh = 일배치로만 가능 (60req/분, 정시~:10 회피, 최근 24h 창 한정 쿼리 — 무제한 `%film%`은 타임아웃).
- NRD 무료 피드(WhoisDS) = gTLD 중심 ~70k/일. **ccTLD(.kr/.de/.fr)는 사각지대** — 한국 사이트는 이 파이프라인으로 기대 금지 (P2 crt.sh 레인 전까지).
- Webmention 수신층 = IndieWeb 소수. WordPress pingback = 사실상 사망(비활성화·Akismet 흡수).

**③ 트래픽 실측 (mt_events, 28일)** — 총 331 세션: google 90 · direct 209 · bing 8 · duckduckgo 6 · facebook 6 · 기타 ~12.

실험 산출물: 세션 scratchpad `measure.py`/`matched.txt` (재현 가능, WhoisDS URL 패턴 = base64("YYYY-MM-DD.zip")).

---

## 3. 확정 결정 D1~D6 (2026-07-18 오너)

| # | 결정 |
|---|---|
| D1 | 소화 위치 = **`/discoveries` 단일 페이지** (다이제스트 스레드). 개별 항목 페이지 생성 금지 |
| D2 | 링크 정책 = **2티어** (§5): Featured=dofollow 소수, 관측 로그(토글)=nofollow. "검토한 도메인 전부 토글로 백링크" 오너 제안을 **legit 게이트 조건부 채택** |
| D3 | 발행 = **부정기** (Featured 3개 이상 모이면 1편). 주기 공개 약속 금지 |
| D4 | 수집 = **일일 배치** (WhoisDS 무료 + 교정 사전 v2 + 브랜드 블록리스트). certstream·CZDS 금지 |
| D5 | 사람 검토 상한 = Haiku 고득점 **일 5~10건**만 큐에 (주 35~70건, 중복 제외 시 보통 그 이하 → 주 ~15분) |
| D6 | 명명 = **"Discoveries / 발견"**. "Radar/레이더"(키워드 레이더·admin nav와 충돌)·"News"(updates 규약) 금지 |

---

## 4. 사이트 소화 위치 (D1 스펙)

**라우트: `/discoveries`** — 단일 페이지, 다이제스트 포스트 역순 스레드 (updates 패턴).

페이지 구성 (위→아래):
1. 고정 인트로 2~3문장 — 이 코너가 무엇인지, 어떻게 찾는지 한 줄, 옵트아웃 안내 링크.
2. 다이제스트 포스트들 (최신 위). 각 포스트:
   - `id: "YYYY-MM-DD-slug"` 영구 앵커 (updates 규약 승계 — 절대 변경 금지)
   - 산문 리드 3~8문장 (**링크 리스트가 아니라 산문이 본문** — thin-content 지문 회피, GSC 전투 재발 방지)
   - **Featured 카드 2~5개**: 사이트명 + `<a href>`(dofollow) + 에디토리얼 코멘트 1~2문장 + 태그
   - **`<details>` "이번 관측 로그 (n곳)"** = 그 기간 legit 판정 도메인 리스트 (nofollow, 도메인명 + 3단어 이내 분류). 접힌 콘텐츠도 구글이 색인하므로 SEO상 불이익 없음
3. 페이지 하단 각주: 방법론 요약 + "등재는 추천이 아니라 관측 기록" 명시 + 옵트아웃 mailto.

**구현 (전부 기존 자산 복사 — 신규 발명 0):**
| 부품 | 재사용 원본 |
|---|---|
| 포스트 저장 | `lib/discoveries/posts.ts` 정적 배열 — `lib/updates/posts.ts` 패턴 (append-only, 맨 위 prepend) |
| 렌더 | UpdatesThread 변형 또는 단순 자체 컴포넌트 (스파인·필터바 불요, 더 단순하게) |
| RSS | `app/discoveries/feed.xml/route.ts` — `app/updates/feed.xml/route.ts` 복사 |
| 진입점 | Footer 1곳 (P1). Nav 편입은 반응 검증 후 |
| sitemap | `lib/sitemap-data.ts`에 `discoveryEntries()` + `app/sitemaps/discoveries.xml/route.ts` + `app/sitemap.xml/route.ts` SECTIONS 1줄 (단일 URL) |

색인 정책: `/discoveries`는 index 허용 (산문 본문). 개별 항목 페이지·페이지네이션 URL 생성 금지.

---

## 5. 링크 정책 (D2 — "토글로 전부 백링크" + "Haiku 출력이 곧 토글 내용")

오너 정제 (2026-07-18): 관측 로그 토글은 **사람 검토 없이 Haiku 분류 결과가 그대로 내용이 된다.** 사람 노동은 Featured(소개글)에만 남고 토글은 완전 자동 — "자동으로 손쉽게"에 부합.

| 티어 | 게이트 | rel | 규모 |
|---|---|---|---|
| **Featured** | 사람이 "소개할 가치" 판단 + 에디토리얼 코멘트 작성 | **dofollow** | 편당 2~5 |
| **관측 로그 (토글)** | **분류기 자동 게이트** (사람 검토 불요, §5-1) | **nofollow** | 편당 자동, 월 상한 60 |

### 5-1. 자동 토글 게이트 (사람 대신 분류기가 legit을 판정)
포함 조건 (AND):
- `category ∈ {criticism, journal, news, festival, venue, archive, podcast, education, database}` (소개 가치 있는 **읽기·큐레이션·기관** 카테고리만)
- `score ≥ 45` (컷 값은 P0 백필 실측으로 확정 — §5-2)
- `fetch_status == "ok"` 且 `name_only == false` (빈 페이지·파킹 제외)

**하드 제외 (점수 무관, 절대):** `category ∈ {piracy, parked, business, other, prod-co, promo, filmmaker}` 또는 해적판/junk 토큰/브랜드 클러스터 매치 또는 성인·도박 신호. prod-co·filmmaker·promo는 스팸은 아니지만 "발견 소개감"이 아니라 자동 토글에서 제외(오너가 Feature로 끌어올릴 수는 있음).

### 5-2. P0 실측으로 확정할 것
백필 결과에서 위 게이트를 통과한 도메인 리스트를 눈으로 검수해 **오탐(해적판·성인·무관이 legit 카테고리로 잘못 분류)이 0에 수렴하는 score 컷**을 정한다. 오탐이 1건이라도 새면 컷을 올리거나 카테고리를 좁힌다. 이 자동화의 신뢰는 "토글에 절대 쓰레기가 안 들어간다"에 달려 있다.

**설계 근거:**
- **nofollow 링크도 GSC·Ahrefs 백링크 리포트에 표시된다** → "우리가 당신을 봤다"는 선물 신호는 토글 리스트로도 충분히 전달된다. 오너 제안의 목적(찾아 들어오게 하기)은 nofollow로 달성됨.
- **dofollow 전면 개방은 금지.** 후보 풀의 ~20%가 해적판인 상황에서 검증 얕은 신생 도메인에 dofollow를 대량 발신하는 것은 구글 링크스팸 정책의 교과서적 패턴("링크 목적의 파트너 페이지")이고, 색인 회복 전투 중인 사이트가 감수할 리스크가 아니다. 사고 1건(해적판 dofollow)이면 큐레이터 포지션도 죽는다.
- **자동 토글의 방어선 = 분류기 게이트.** "사람이 legit 확인"을 "분류기가 legit 확인"으로 대체하되, 하드 제외 + score 컷 + nofollow 3중으로 쓰레기 유입을 막는다. 사람이 사후에 언제든 제거 가능(옵트아웃 포함).
- 옵트아웃 요청 = 다음 커밋에서 즉시 제거. 리스트 등재가 추천이 아니라 관측 기록임을 각주에 명시(§4).

---

## 6. 수집 파이프라인 (D4·D5 스펙)

**위치: `discovery/` 신규 최상위 디렉토리** — `hourly/poller/` 레이아웃 복제(스크립트+config.json+state/+cron.log), 단 **`hourly/` 자체는 수정 금지** (Now Playing 전용·오너 플래그). 실행은 샌드박스 밖 Mac 크론(샌드박스는 네트워크 불가 — hourly/poller/README.md 패턴), python3 stdlib only, 크레딧은 `.env.local`.

```
[일 1회 크론 09:30 KST]
WhoisDS 전일 리스트 다운로드 (~70k)
  → 사전 v2 필터 (~150건)
  → 브랜드 블록리스트 컷
  → 홈페이지 1회 fetch (title/desc/lang)
  → Haiku 분류 0~100
  → 상위 5~10건만 state/review-queue.md에 append
```

**필터 v2 (v1 사전 폐기 — §2 실측 반증):**
- 통과: 도메인 라벨에 `film|films|cinema|movie|kino` 부분문자열. `cine`은 **앞쪽 토큰 경계만** (`^cine`·`[-_]cine`. ⚠️`cine$`는 금지 — medicine이 `cine$`에 매치된다. 접미 cine은 포기)
- 폐기: `reel`·`screen`·`frame` 단독 부분문자열 (오탐의 주범 — 매치의 47%가 이 셋+cine 전용, 거의 전부 비영화)
- 유지: `cinephile` (0건이지만 무해·고정밀)
- 블록리스트: 브랜드 클러스터 `lordfilm`·`filmyzilla`·`moviesflix`·`flixer` + **토큰 단위** `hd|watch|stream|download|online|free|iptv|apk|123` (토큰 단위 필수 — freelance→free 함정)
- metatake 유사도메인 매치 = 리뷰 큐가 아니라 **브랜드 경고 로그**로 분리

**fetch 예의:** UA = `Mozilla/5.0 (compatible; MetatakeBot/1.0; +https://metatake.net/bot)` — `lib/bots/identify.ts:14`의 정본 UA 그대로 (MetatakeBot UA 통일 관례: 변종 이름 만들지 않는다). robots.txt 존중, 타임아웃 3s, 도메인당 웨이브당 1회.

**분류 모델:** Haiku 4.5 (도메인명+title+desc → 영화문화 확률 + 카테고리[criticism/journal/festival/venue/archive/prod-co/other]). 비용 ~$1~3/월. (hourly의 "Opus 사용" 오너 지침은 뉴스 집필용 — 이건 저부가 분류라 Haiku가 적정. 오너 이견 시 Opus로 상향.)

**저장:** P0~P1은 파일만 (`state/seen.json`, `state/candidates.jsonl`, `state/review-queue.md`) — **DB 쓰기 없음** (2026-07-17 DB 포화 인시던트 규칙: 불요 churn 금지). Supabase 테이블+admin 큐는 P2.

**재방문:** P0~P1은 수동 — coming-soon 유망주는 review-queue.md에 워치리스트 표기 후 사람이 다시 열어봄. +7/+30/+90 자동 웨이브는 P2 (웨이브당 1회·최대 4회 예의 유지).

**킬스위치:** `touch discovery/HOLD` (hourly 관례 승계).

---

## 7. 검토 플로우 (주 ~15분)

주 1회 review-queue.md 훑고 3분류:
- **FEATURE** — 소개감. 에디토리얼 코멘트 1~2문장 초안까지 그 자리에서.
- **LIST** — legit이지만 소개까진 아님 → 다음 다이제스트의 관측 로그(토글)행.
- **REJECT** — 해적판·파킹·무관.

다이제스트 발행 = FEATURE 3개 이상 쌓였을 때 `lib/discoveries/posts.ts`에 1편 작성 (부정기, D3).

---

## 8. 통지

- **주채널 = 자연 발생.** GSC·Ahrefs 백링크 리포트(nofollow 포함 표시됨) + 진짜 독자 클릭 리퍼러. 별도 작업 0.
- **개인 메일 (Featured 중 특별한 소수만):** **신규 메일 경로 금지 — 기존 CRM 경유.** drafts-only·suppression 체크·`system_send_enabled=false` 기본·physical_address 요건·발신자=Wonwoo Yoon(가공 페르소나 금지)·2026-07-13 아웃리치 발송분과 중복 제거 — 전부 승계. 템플릿은 v1 §7 유지 ("소개했으니 알려드린다" — 링크 요청 아님).
- **Webmention 발신 = P2.** 수신층이 소수라 기대치 낮게, 비용도 낮으니 P2에서 얹는다. pingback은 구현하지 않는다(사망 채널).

---

## 9. 측정 (신규 계측 0)

- **반응 감지 = `mt_events.ref_domain` SELECT.** `components/Metrics.tsx`가 세션 첫 pageview에 리퍼러를 적재하고 `app/api/metrics/route.ts`가 ref_domain을 정규화(봇 필터 포함) — 이미 라이브. 소개한 도메인이 리퍼러로 등장 = 상호 반응. GSC 외부링크 리포트가 보조.
- **KPI = 반응률** (소개 건수 대비 역링크·역방문·답장). 발행 편수·유입 세션수는 KPI 아님(보조지표). ROI 판정 시점 = P1 발행 시작 후 6개월.

---

## 10. 보안·윤리

- 후보의 ~20%는 해적판·잠재 악성. **P0~P1은 텍스트 fetch만** (스크린샷·헤드리스 렌더 없음). 스크린샷은 P2에서 격리 환경(전용 컨테이너/프로필)으로만.
- **후보 도메인을 본인 일상 브라우저로 직접 열지 않는다** — 확인 필요 시 격리 프로필.
- robots.txt 존중·정직한 UA·rate-limit·fetch 최소화 (§6). 옵트아웃 즉시 (§5). 리퍼러 조작·자동 클릭 없음 (v1 §5 승계).

---

## 11. 단계

| 단계 | 내용 | 조건 |
|---|---|---|
| **P0 관찰** | `discovery/` 스캐너+크론+리뷰 파일. **발행 없음.** 산출 = "양질 후보가 실제로 주 몇 건 나오나" | 오너 착수 지시. 구축 1~2일 + 관찰 4주 |
| **P1 첫 발행** | `/discoveries` 페이지+RSS+Footer+sitemap (§4). 손으로 다이제스트 1편 | P0 관찰 결과 FEATURE급이 실재할 때 |
| **P2 심화** | admin 큐(`app/admin/review` 패턴+`AdminUI.tsx`)·Supabase 테이블·webmention·재방문 자동 웨이브·crt.sh ccTLD 레인·격리 스크린샷 | P1 반응(§9)이 정당화할 때만 |

---

## 12. 금지·함정 요약

- `hourly/` 수정 금지 (별도 프로젝트 자산). middleware·루트 파일은 자동배포 워처 범위 밖 = 수동 커밋.
- certstream 자체호스팅·CZDS zone diff·실시간 수집 금지 (§2).
- 주기 공개 약속 금지 · "Radar"/"News" 명명 금지 · 산문 편수 발표 금지 (updates 규약).
- 미검토 도메인 공개 게재 금지 · dofollow 전면 개방 금지 (§5).
- 신규 메일 발송 경로 금지 (CRM 경유·캡 상향 금지) (§8).
- P1까지 DB 신규 쓰기 금지 (§6).
- ccTLD(.kr 등)는 사각지대 — 한국 신생 사이트가 안 잡히는 건 버그가 아님 (P2 전까지).
- 개별 항목 페이지·얇은 리스트 단독 페이지 금지 (§4 — GSC thin-content 전투 재발 방지).

---

## 13. AS-BUILT (2026-07-18, 커밋 88e5201 · 브랜치 feat/discovery-feed)

**무엇이 지어졌나 (15파일):**
- `discovery/scan.py` (+`config.json`) — WhoisDS 무료 NRD 일배치 → 사전 v2 → 홈 fetch → Haiku 분류 → `state/review-queue.md`. 실시간 동기 호출(스레드 12, Batch API 아님). stdlib only, 크레딧은 `.env.local`.
- `discovery/build_digest.py` — legit 게이트(§5-1) 적용해 `lib/discoveries/digests.ts` 블록 초안 생성.
- `lib/discoveries/digests.ts` — 정적 다이제스트 배열(타입+첫 편). `app/discoveries/page.tsx`·`feed.xml/route.ts`·`discoveries.css` — 페이지+RSS. `lib/sitemap-data.ts`·`components/Footer.tsx` — 사이트맵/진입점.

**실측 (7일 백필 2026-07-10~16):** WhoisDS 49만 도메인 → 사전 v2 통과 835 → Haiku 분류 835. 카테고리 분포: parked 461·piracy 187·business 93·prod-co 20·기타. **자동 토글 게이트(legit 카테고리+score≥45+ok+not name-only) 통과 = 23곳**, 눈검수 결과 해적판·성인·무관 유출 **0**. 첫 편 = 이 23곳(nofollow 관측 로그)+사실 인트로. Featured(dofollow)는 **비어 있음** — 오너가 큐에서 승격+코멘트 작성.

**비용 실측:** 835건 분류 = **$0.62** (입력 357,548 tok·출력 53,048 tok, Haiku 4.5 $1/$5 per M). 일 환산 ~$0.09 → **월 ~$2.7**.

**라이브검증:** `next dev --webpack -p 3011`로 `/discoveries` 200·23행 전부 `rel="nofollow"`·RSS 정상·사이트맵 core에 등재·tsc 신규 0에러. (⚠️ Turbopack dev는 globals.css @import로 전 페이지 500 — 알려진 함정, 프로덕션 빌드 무관. **dev 미리보기는 `--webpack` 필수.**)

**비활성 출하:** 크론 미설치·발행 수동·브랜치 미머지. **오너 개시 3단계:** ① 크론 설치(`discovery/README.md`) ② 주간 `state/review-queue.md` 검수+Featured 승격 ③ `feat/discovery-feed` 머지→배포 시 `/discoveries` 라이브.

**필터 v2 실전 교정 이력:** 스모크에서 `efulfilmentservice.com`(fulfilment→film) 오탐 발견 → `config.json` `exclude_substrings`에 `fulfilment` 추가로 차단. 향후 유사 오탐은 같은 자리에 추가.

---

## 14. 🚨 안전성 검증 (2026-07-18, Opus 23사이트 실방문) — "자동 발행은 안전하지 않다"

**무슨 일이 있었나:** 첫 편 23곳을 실제로 열어 검증(Opus 에이전트 23개 병렬 방문)한 결과, **Haiku 게이트가 통과시킨 8곳이 발행하면 안 되는 것**이었다. 내가 앞서 "오탐 유출 0"이라 한 판단은 **거짓이었다** — 도메인명+홈 HTML만으로는 극장으로 위장한 사이트를 못 가른다.

| 도메인 | Haiku 판정 | 실제 | 위험도 |
|---|---|---|---|
| `odeonkino.pro` | venue 75 | **피싱** — 노르웨이 ODEON(.no) 리버스프록시 클론, `/inject/payment-widget.js`가 결제 버튼 훅킹 | 치명(브랜드 사망) |
| `plazmakino.ru` | venue 65 | **해적판** — "회원제 사설극장"으로 위장, 임베드 플레이어(HD/4K/Резерв) | 치명 |
| `usafilmnews.com` | news 72 | 존재하지 않는 영화 기사 AI 팜(브랜드≠도메인) | 심각 |
| `cineavis.fr` | database 72 | TMDB 래핑+AI 가짜 리뷰 콘텐츠팜 | 심각 |
| `thatfilmydude.net` | criticism | 여배우 글래머/thirst 클릭베이트 | 창피 |
| `cinemaidirector.com` | education 62 | R$47 AI프롬프트 판매 퍼널 | 창피 |
| `moviepress.kr` | news 72 | 기사 로드 실패·카운터 0 깨진 껍데기 | 창피 |
| `nettetalerkinoopenair.com` | venue 62 | TLS 만료·시 공기업으로 리다이렉트 | 창피 |

**적중률 실측: 23곳 중 진짜 양질 8 (35%)·thin이지만 clean 6·empty 1·발행불가 8 (35%).** 8 양질(kurdiskfilmfestival.dk·juedischefilmtage.hamburg·cinematepito.com·docafilmfestival.com·newfilmmakersny.com·gujaratifilmreview.in·themoviemen.nl·infernomovies.blog)만 digests.ts 첫 편으로 발행.

**교훈 (설계 번복):**
1. **"Haiku 출력=자동 토글 발행"은 안전하지 않다.** nofollow는 SEO만 안 줄 뿐 사용자는 여전히 피싱/해적판 페이지에 도착한다. **발행 전 사람(또는 Opus 심층검증)이 각 사이트를 실제로 열어보는 단계는 필수·생략 불가.** "제로 노동" 마케팅 금지. 원안 v1의 "인간 큐레이션=스팸/큐레이션 분기점" 주장이 옳았다.
2. **스캐너 하드닝 반영(커밋에 포함):** 피싱(canonical/og 호스트 불일치·`/inject/`·payment 훅) → `suspect:lookalike` 하드제외·해적판(임베드 플레이어+화질토글 2개↑) → `suspect:piracy` 하드제외·분류 프롬프트를 회의적 검증자로 전면 교체(quality+would_embarrass 출력)·게이트를 **품질 decent↑ & would_embarrass=false & legit 카테고리**로. 위험 후보는 `state/rejected.log`로 분리.
3. **여전히 못 잡는 것:** 잘 만든 피싱 클론·"존재하지 않는 영화" 팜은 싸구려 분류기의 한계 밖. 그래서 1번(사람 눈)이 진짜 방어선. 주간 큐는 **트리아지**일 뿐 발행 승인이 아니다.

**성공 판정(전략):** 8곳은 쿠르드·유대 영화제, 멕시코시티 바리오 시네마, 구자라트 장문 비평 등 **진짜로 신뢰할 만한 글로벌 다양성** — 컨셉은 검증됨. 단 가치가 비대칭·취약(피싱 링크 1건 유출=큐레이터 신뢰 사망). **결론: ship-with-tweaks** — 하드닝 + 사람 눈 필수 + 품질 하한(decent↑)을 지키면 월 $2.7·1~2년 포지셔닝 플레이로 유효. 트래픽 레버는 여전히 아님.
