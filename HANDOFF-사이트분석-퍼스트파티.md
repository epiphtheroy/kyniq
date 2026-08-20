# HANDOFF — 사이트 분석(퍼스트파티 애널리틱스) 정본

> 2026-07-10 구축. Vercel Analytics(24h 단위, 페이지/유입만)의 한계를 넘기 위해
> **자체 수집 파이프라인 + /admin/metrics 대시보드 + GSC 커넥터**를 심었다.
> 추가 비용 $0 (기존 Supabase/Vercel 위). 이 문서가 이 시스템의 정본이다.

## 0. 전체 그림

```
브라우저 (components/Metrics.tsx 비콘)
   │  pageview · leave(dwell+scroll) · click(data-mt/outbound) · vital(1/3 샘플)
   ▼
/api/metrics (app/api/metrics/route.ts)          /api/search (확정검색 로깅, after())
   │  봇 UA 필터 · 레이트리밋 · 방문자 해시 · Vercel 지오헤더
   ▼
Supabase public.mt_events  ←  mt_gsc_daily (worker/gsc-pull.py, Search Console API)
   │
   ▼  RPC 3종 (jsonb 단일행 → PostgREST 1000행 캡 회피)
/admin/metrics (관리자 전용 대시보드)
```

## 1. 수집 — components/Metrics.tsx (루트 layout에 장착)

> **+ 상호작용 계측(2026-07-10 오후 추가):** `components/mtTrack.ts`의 `mtEvent(name)` —
> (페이지,이름)당 1회만 전송(참여율 측정, 제스처 스팸 방지). 심어진 곳:
> **FilmTabBar**(`data-mt="tab:<id>"` — film/director/theorist/concept/trope 전 탭 표면, 매 클릭 카운트)
> · **FilmMap**(아틀라스: map:drag/zoom/click) · **EntityGraph**(커넥션 맵: graph:node/drag/pan)
> · **GalaxyMap**(/map: galaxy:drag/node). 전부 대시보드 Clicks 패널 + 주간 UI 다이제스트(감지기 14)로 집계.

- **pageview**: 로드 + App Router 내비게이션마다. 첫 로드만 document.referrer, UTM 파라미터.
- **leave**: 페이지 이탈 시 sendBeacon으로 dwell_ms + 최대 scroll_pct. 라우트 전환 시에도 이전 페이지 leave 발사 → 모든 페이지뷰에 체류/스크롤이 붙는다.
- **click**: `data-mt="이름"` 달린 요소 클릭(전 사이트 어디든 속성만 붙이면 집계됨) + 외부링크(outbound).
- **vital**: LCP/CLS/INP/TTFB, 세션 1/3 샘플링.
- **프라이버시**: 쿠키 없음. 방문자 id는 서버에서 `sha256(날짜|ip|ua|salt)` — 매일 회전, 개인 추적 불가(Plausible 모델, 동의 배너 불필요). 세션 id는 sessionStorage뿐.
- **제외**: localStorage `mt_optout=1` (대시보드 우상단 토글) · localhost.

## 2. 수집기 — app/api/metrics/route.ts

- 봇 UA 정규식 차단(어차피 대부분 봇은 JS 비콘 자체를 안 쏨) · IP당 120/분 레이트리밋(/api/search 패턴 복제).
- 지오: Vercel `x-vercel-ip-country/-region/-city` 무료 헤더.
- salt는 `METRICS_SALT` env(없으면 service key 앞 16자 폴백 — 지금은 폴백으로 동작, env 추가는 선택).
- 항상 204 반환(비콘이 페이지에 에러를 새지 않게).

## 3. 저장 — 마이그레이션 0058 (프로덕션 적용 완료)

- `mt_events(ts, type, path, referrer, ref_domain, utm_*, visitor, session, country, region, city, device, browser, lang, screen_w, props)` — 인덱스 4개.
- `mt_gsc_daily(day, page, query, clicks, impressions, ctr, position)` PK(day,page,query).
- **둘 다 RLS on + 정책 0개 = service-role 전용.** RPC도 anon/authenticated에서 execute revoke.
- RPC: `mt_overview_json(from,to,tz,bucket)` · `mt_page_json(path,…)` · `mt_live_json()` — 전부 jsonb 단일행.

## 4. 대시보드 — /admin/metrics (관리자 사이드바 "📈 Analytics")

- 게이트: 미들웨어 /admin/* + `getAdminUser()` (profiles.role='admin').
- 범위 24h/7d/28d/90d + **시간별/일별 토글**(시간 버킷은 7d까지, KST). 상단 라이브 스트립(5분/30분 활성).
- **한줄 리포트(최상단)**: 규칙 기반 감지기 13종(마이그 0060 `mt_generate_insights()`, LLM 0)이 한국어 한 줄씩 생성 → `mt_insights`(unique key 중복 방지; 일회성 키 vs ISO주 키). 30분마다 Vercel cron(`/api/metrics/insights`, vercel.json `*/30`)+대시보드 로드 시 30분 경과면 즉석 재생성(20분 가드). 감지기: GSC 새 검색어·순위 ±3 변동·톱10 진입·노출≥15 클릭0 기회·첫 클릭·주간 요약 / 트래픽 급증(시간대 3×)·새 유입처·새 국가·사이트검색 무결과·오래 읽는 페이지·얕은 인기 페이지·LCP p75>4s.
- **GSC 패널**: `mt_gsc_overview_json(28)` — 7일 노출/클릭/평균순위(전주 Δ), 노출·클릭 시계열, 검색어 순위표, 노출 페이지(드릴다운 링크), 이번 주 새 검색어.
- KPI: 방문자·페이지뷰·세션·페이지/세션·바운스·평균 체류·평균 스크롤.
- 시계열(페이지뷰+방문자, 호버 크로스헤어) · Top pages(체류·스크롤 병기) · 유입 도메인 · 진입/이탈 페이지 · 국가 · 기기/브라우저 · **사이트 내 검색어** · 클릭(data-mt) · 세션 흐름(페이지→페이지) · vitals p75.
- **페이지 행 클릭 = 드릴다운**: 그 페이지의 시계열·유입·전/다음 페이지·**GSC 쿼리**(클릭·노출·평균 순위) 한 화면.

## 4.5 📱 앱 패널 — mt_app_activity_json (마이그 0144, 2026-08-20)

- **왜**: 네이티브 앱은 웹 비콘도 Vercel Analytics 스크립트도 없다 → 실방문자·Pageviews 어디에도 안 잡히고, Vercel 로그의 함수 호출로만 보인다("호출은 많은데 페이지뷰는 적다" 착시의 정체 중 하나). 유일한 흔적 = `/api/v1/app/*` 전 라우트가 쓰는 `api_calls` 레저(0100, guardAndLog).
- **패널**(실방문자 박스 바로 아래, 초록 테두리): 14일 일별 요청(iOS/Android)·활성 네트워크(/24)·신규 네트워크(설치 추정)·ASC 다운로드 + 화면별 분해(Tonight 덱·영화 상세·Navigator…) + 푸시 등록 기기.
- **정직성**: BFF 대부분이 CDN 캐시(film 1h·tonight 15m·director 5m·countries/services 24h)라 **캐시 미스만 기록된 하한선**. `app_navigator`·`app_handoff`는 no-store라 정확. 기기 판별=fetch UA(iOS `Metatake/빌드 CFNetwork`·Android `okhttp`), 브라우저·curl 프로브 제외. "신규 네트워크"는 90일 지평의 첫 등장 /24 — 설치의 근사일 뿐.
- **다운로드 실수치** = `worker/asc-sales-pull.mjs`(오너 실행, node) → `mt_app_downloads`. ASC .p8 키는 로컬 전용(리포·Vercel 미탑재). 최초 1회 `ASC_VENDOR_NUMBER`(ASC → Payments and Financial Reports의 Vendor #)를 .env.local에. 안드로이드 다운로드는 Play Console에 API가 없어 미수집(수동 확인).
- **탭(클릭) 계측은 아직 없음**: 네이티브 탭을 보려면 앱에 비콘을 넣고 OTA를 내보내야 한다(후속 후보 — /api/metrics에 `platform:'app'` 수용 + 앱 mtEvent 쌍둥이).

## 5. GSC 커넥터 — worker/gsc-pull.py (✅ 가동 중 2026-07-10)

- 서비스계정 `metatake@epiph-test-bot.iam.gserviceaccount.com` = GSC siteFullUser, 키는 `worker/gsc-sa.json`(gitignore).
- 90일 백필 완료(첫 데이터는 2026-07-01부터 — 사이트가 검색노출 초기 단계라 51행/63노출).
- **일일 자동 갱신: `worker/gsc-daily-watch.sh`** (nohup 루프, pid=`worker/.gsc-watch.pid`, 로그=`worker/gsc-pull.log`). 하루 1회 3일 창 재적재(GSC ~2일 지연 커버, upsert 멱등). 재부팅 후엔 `nohup worker/gsc-daily-watch.sh >> worker/gsc-pull.log 2>&1 &`로 재기동.
- pip 의존성 없음(JWT 서명은 openssl 서브프로세스). 프로퍼티 기본 `sc-domain:metatake.net`, 다르면 `GSC_PROPERTY` env 또는 `--property`.
- ⚠️ GSC page×query 차원은 프라이버시 필터로 희귀 쿼리를 누락시킴 — 일별 합계(클릭 등)가 GSC UI 총계보다 약간 적은 건 정상.

## 6. Clarity (선택, ⏳ 원우 계정 생성 대기)

- 세션 녹화·히트맵·분노클릭 = "사용자가 실제 어떻게 쓰는지" 영상. 완전 무료·무제한.
- clarity.microsoft.com 계정 생성 → 프로젝트 ID를 Vercel env `NEXT_PUBLIC_CLARITY_ID`에 → 재배포. 스니펫은 layout.tsx에 조건부로 이미 심어져 있음.

## 7. 불변식 · 함정

- **비콘은 절대 렌더를 막지 않는다**: sendBeacon/keepalive, 수집기는 무조건 204.
- **서버 HTML 개인화 금지 불변식과 무관**(전부 클라이언트 수집).
- 대시보드 쿼리는 반드시 **jsonb 단일행 RPC**로(1000행 캡).
- `/api/search` 로깅은 semantic(확정) 쿼리만 — lex(타이프어헤드 부분입력)는 잡음이라 제외. CDN 캐시(s-maxage=300) 때문에 동일 쿼리 반복은 과소집계(리포트 용도로는 무해).
- vital은 1/3 샘플 — 절대량 비교 금지, p75만 신뢰.
- mt_events는 무한 성장 — 월 수백만 행 규모가 되면 일별 롤업 테이블 + 원본 90일 보존 도입(§8).
- 워처가 app/components를 자동 커밋하므로 이 영역 수정은 저장 즉시 배포됨.

## 9. Bot Sentinel — 자율 봇 감지·차단·해제 (SHIPPED·검증 2026-07-11)

이 비콘의 **보안 확장**. 토큰 없이 우리 인프라만으로 완결되는 자동 루프. 정본은 이 섹션 + auto-memory `vercel-waf-bot-block`.

- **왜 여기 붙었나**: 위장 헤드리스 봇(정상 Chrome UA로 위장, JS 실행)은 이 비콘에 잡히지만 mt_events는 프라이버시상 IP가 없음. 차단 키(프리픽스)를 비콘 수집 시점에 확보해야 해서 이 시스템의 확장으로 구현.
- **감지**: `app/api/metrics/route.ts`가 pageview마다 IP의 /24(v6 /48) 프리픽스를 `mt_visitor_ip`에 upsert(3일 보관). 헬퍼 `lib/ip-prefix.ts`(ingest·middleware 공유, 값 반드시 일치).
- **탐지기** `mt_detect_bots()`(마이그 `worker/0078_bot_sentinel.sql`): 인사이트 30분 크론(`app/api/metrics/insights`)에 편승. A)프리픽스별 24h 원샷·리퍼러없음·딥페이지 ≥6방문·≥5경로, B)동일지문(country,screen_w,browser) ≥15 → 기여 /24 차단. 신규 차단은 `mt_insights`에 🛡️ 라인 emit(→/admin/metrics).
- **차단 실행**: `middleware.ts`가 블록리스트(`bot_blocks`, 엔드포인트 `/api/bots/blocklist` 60s 캐시) 읽어 403. GOOD_BOT 정규식(googlebot·bingbot·Claude-SearchBot·Amzn-SearchBot·Perplexity 등) 먼저 예외 → BAD_UA 정규식(GPTBot·MJ12bot·Ahrefs 등) 403 → 프리픽스 403. **전부 fail-open**(오류=통과).
- **자동 해제**: auto 블록 24h TTL, 조용해지면 만료. 재범 strike로 3d→7d→30d. `source='manual'`은 영구.
- **Vercel WAF 병행**: 대시보드에 커스텀 규칙 2개(Alibaba AS45102 Deny + 스크레이퍼/AI훈련 UA Deny)도 라이브. robots.ts는 훈련봇 disallow.
- **⚠️ 절대 규칙**:
  - `middleware.ts`·`app/api/metrics/route.ts` 편집 전 이 섹션 필독 — **모르고 봇 게이트/프리픽스 수집 제거 금지.**
  - **`middleware.ts`는 크롤러 관찰 훅도 공유**(2026-07-12): 봇 차단 판정 *이후* 식별가능 크롤러를 `/api/bots/observe`로 fire-and-forget 수집(역방문 핸드셰이크용). 정본 `HANDOFF-크롤러-핸드셰이크-리퍼러.md` — **middleware 편집 시 그 문서도 필독**(순서 뒤집으면 403할 봇을 관찰함).
  - middleware.ts는 **루트 파일**이라 자동배포 워처가 스테이징 안 함 → 수동 커밋 필요.
  - OVH·Amazon ASN **통째 차단 금지**: Claude-SearchBot·Amzn-SearchBot 인용봇(트래픽 유입)이 그 인프라라 오폭. 나쁜 봇은 UA로만.
  - Vercel **Bot Protection Off 유지**: 켜면 우리 GET 워밍·크론 등 서버측 자동화가 챌린지됨.

## 8. 다음 단계(대기)

- [x] GSC 서비스계정 + 90일 백필 + 일일 워처 (§5, 2026-07-10 완료)
- [x] Bot Sentinel 자율 봇 차단 (§9, 2026-07-11 완료)
- [ ] 원우(선택): Clarity 계정 (§6)
- [ ] 원우(선택): Vercel env `METRICS_SALT` 임의 문자열 추가
- [ ] 데이터가 쌓이면: 핵심 CTA에 `data-mt` 속성 부착(Save/Seen/Watchlist/Follow/TV 재생 등), 주간 자동 리포트, 일별 롤업, "노출 많고 클릭 없는 페이지"(GSC×행동) 자동 리스트
- [ ] Vercel Analytics는 당분간 병행(무해) — 자체 수치와 교차 검증 후 제거 판단
