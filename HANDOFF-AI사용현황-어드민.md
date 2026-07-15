# HANDOFF — AI 사용현황 어드민 "The Meter" (/admin/usage) 기획·작업지시서 (정본)

> **작성 2026-07-15 (기획 완료 · 구현 대기 — 다른 AI 수행 예정).** MCP(`/api/mcp`)·REST(`/api/v1`)·팩·임베드·AI 크롤러·AI 유입을 한 페이지에서 추적하는 경영자용 어드민.
> 프로덕션 DB 실측(2026-07-15) + 코드 조사(파일:라인)로 근거함. 라인 번호는 착수 시 내용 대조 후 사용.
> ⚠️ **마이그레이션 번호: 착수 직전 `supabase/migrations/` 재확인** — 조사 시점 다음 프리 번호 **0100**(0097·0098·0099는 타 세션이 선점; 과거 중복 사례 0085×2·0087×2·0096×2 있음).

---

## §0. 목적과 의도 (수행자는 이 절 기준으로 모든 판단)

**목적:** 오너(경영자)가 "우리 데이터가 AI 생태계에서 얼마나·무엇이·누구에게 소비되고, 그것이 사람 방문으로 돌아오는가"를 한 화면에서 판단하게 한다.

**의도 — 이 페이지가 답해야 할 경영자 질문 5개:**
| # | 질문 | 답하는 데이터 |
|---|---|---|
| Q1 | 얼마나 쓰이나? (진짜 사용 vs 소음) | mcp_calls(tools/call만) + **신규 api_calls** |
| Q2 | 무엇이 불리나? (어떤 영화/주제) | mcp_calls.arg + api_calls.arg → **콘텐츠 수요 신호** |
| Q3 | 누가 부르나? (Claude/GPT/크롤러/디렉터리) | ua 분류 + mt_crawler_visits |
| Q4 | 사람이 돌아오나? (ROI — "채널② 가설 90일 판정") | mt_ai_referrals_json (mt_events) |
| Q5 | 방어는 작동하나? (수확·차단) | pack_hits_daily + bot_blocks |

**설계 원칙 3개 (실측이 강제):**
1. **소음/신호 분리가 제1 원칙.** 실측: mcp_calls 1,824행 중 **98.6%가 `_initialize`/`_tools_list` 핸드셰이크**, 그중 66%가 헬스체커 1개(SentinelOracle). 실제 tool 호출은 25건(전부 07-12 오너 테스트). naive 대시보드는 "하루 780콜"이라는 허영 지표를 보여준다. → 전 패널이 3계층 분류를 강제: **①실사용**(tools/call) **②디렉터리 발견**(핸드셰이크 = "몇 개 레지스트리/클라이언트에 우리가 잡히는가" — 그 자체로 유의미한 유통 지표) **③헬스체커 소음**(제외 토글).
2. **측정의 정직성.** `/api/v1` 응답은 CDN `s-maxage=86400`(검색 3600) → 라우트 로깅은 **캐시 미스만** 센다(≈ 하루 distinct 슬러그 수). 임베드는 사실상 per-load 측정 불가. 대시보드는 이 의미론을 **화면에 명시**한다("distinct fetches (cache-miss)"). 숨기면 오너가 트래픽으로 오독한다.
3. **측정→행동 연결.** Q2의 수요 신호는 구경거리가 아니라 **콘텐츠 파이프라인 입력**이다: AI가 자주 찾는 미분석/미승격 영화 = Tier-2 승격·팩토리 큐 우선순위(film_next_demand 패턴의 AI판). top-slug 행마다 해당 영화의 tier/색인 상태를 병기하고 "팩토리 큐 후보" 표시.

**현재 데이터 현실(기대 관리):** MCP 실사용 0/일·팩 다운로드 1건·AI 유입 pageview 0. 이 페이지는 지금 "성장 대시보드"가 아니라 **"계기판 먼저 달기"**다 — 데이터가 오기 전에 계기가 있어야 오는 순간을 안다. 빈 패널은 "0 (아직 없음 — 계측 중)"으로 정직하게.

---

## §1. 실측 인벤토리 (2026-07-15 — 무엇이 있고 무엇이 깜깜한가)

### 있는 것 (읽기만 하면 됨)
| 소스 | 스키마/형태 | 현재 볼륨 | 비고 |
|---|---|---|---|
| `mcp_calls`(0093) | id, ts, tool, arg, prefix(/24), ua, ok, ms · RLS 0정책=service_role | 1,824행·~780/일 | 인서트는 `app/api/mcp/route.ts:287/300/347` — **완비, 손대지 말 것** |
| `mt_ai_referrals_json(p_from,p_to)`(0092) | **RPC only**(테이블 아님) — mt_events를 ref_domain으로 ChatGPT/Perplexity/Claude 등 분류 | AI유입 pageview **0** | service_role 전용 — 서버에서 admin 클라이언트로 호출 |
| `pack_downloads`(0086) | user_id, film_id, slug, sections[], fmt, created_at | 1행 | RPC pack_download_claim이 기록 |
| `pack_hits_daily`(0091) | prefix, day, hits (3일 보존) | 4행 | 수확 방어 카운터 — **prefix만, 슬러그 차원 없음** |
| `mt_events` | type 5종(leave/vital/pageview/click/search)+props | 6,313행 | 클릭에 pack_download_open(7)·mcp_guide_open(5). **copy_for_ai 비콘은 코드에 이미 존재**(`components/CopyForAI.tsx:48`) — 아직 0건일 뿐 |
| `mt_crawler_visits`(0081) | ua+prefix별 **hits 카운터 업서트**(시계열 없음) | 68행·누적 5,817히트 | AI봇: ChatGPT-User 157·OAI-SearchBot 67·PerplexityBot 20·Claude-User 8. ⚠️**bot_name 파싱 불량**(ChatGPT-User→"bot"·Claude-User→null) — **raw ua로 재분류할 것** |
| `bot_blocks`(0078) | 차단 원장 | 0행 | |

### 깜깜한 것 (신규 수집 필요 — §3)
1. **`/api/v1` REST 호출 전무** — api_calls류 테이블 없음, `lib/apiGuard.ts`·`lib/apiv1.ts`에 인서트 0. **최고 가치 신규 수집.**
2. **embed.js 로드** — 라우트 정적+s-maxage 86400, 로깅 없음. per-load 측정 불가(§0-2).
3. **크롤러 일일 시계열** — visits는 누적 카운터뿐. 추이 차트는 롤업 필요.

---

## §2. IA·화면 기획 — 단일 페이지 `/admin/usage` "The Meter"

**의도적 결정: 서브디렉토리 없이 단일 페이지로 시작.** 현 데이터 규모(실사용 25콜·다운로드 1)에서 다중 페이지는 빈 방 여러 개다. 분리 기준을 명시해 둔다: **실사용(tools/call+api_calls)이 >200/일 지속되면** MCP/API를 각자 페이지로 분리. 그때까지 한 화면 8패널.

**나브**: `app/admin/layout.tsx:10-23` NAV_ITEMS에 `{ href: "/admin/usage", label: "AI Usage", icon: "🔌" }` 1줄. (전례: /admin/crawlers는 나브 미등록인데, 이 페이지의 E패널이 크롤러를 요약하므로 **crawlers도 이참에 나브 등록 권장** — 오너 콜.)

**URL 상태**: metrics 페이지 관용구 그대로 — `?d=7|14|since-launch`(기본 **since-launch**: 데이터가 07-12 시작이라 30일 창은 무의미), `?noise=1`(헬스체커 포함 토글). `<Link>` 칩, 클라 JS 없음.

### 패널 구성 (위→아래)

**A. 헤드라인 KPI 6개** (Kpi 타일)
`실사용 콜(오늘/기간)` · `디렉터리 발견`(distinct 핸드셰이크 클라이언트 — "우리가 잡히는 표면 수") · `AI 크롤 히트`(웹 소비) · `AI 유입 방문`(mt_ai_referrals — 현 0) · `팩 다운로드` · `수요 슬러그 수`(distinct arg)

**B. 사용 추이** (MetricsChart 재사용 — `components/admin/MetricsChart.tsx` export됨, `{b,pv,vis}` 시리즈)
실사용 콜(pv) vs distinct 클라이언트 prefix(vis), 일 버킷. 핸드셰이크는 기본 제외(`?noise=1`로 포함).

**C. 무엇이 불리나 — 수요 보드** (BarList)
mcp_calls.arg + api_calls.arg 통합 top 20. **각 행에 [tier/색인 상태] 뱃지 + 영화면 /film 링크.** 미보유·미분석 슬러그는 "🏭 팩토리 큐 후보" 표시(§0-3 — 측정→행동). 검색어(비슬러그 arg)는 별도 소그룹.

**D. 누가 부르나 — 클라이언트 보드** (BarList ×2)
ua를 **패밀리로 분류하는 단일 분류기**(lib에 순수함수 `classifyAiClient(ua)` — 대시보드·롤업 공용): `assistant`(Claude-User/ChatGPT-User/…), `registry-crawler`(mcpgw/PRSM/verifymcp/…), `health-checker`(SentinelOracle/mcp-drift-monitor), `sdk`(node/undici/python-httpx), `browser`, `other`. Anthropic 신뢰 이그레스(160.79.104.0/21)는 별도 플래그 표시.

**E. AI 웹 크롤러** (mt_crawler_visits — **raw ua 기반 재분류**, bot_name 신뢰 금지)
ChatGPT-User·OAI-SearchBot·PerplexityBot·Claude-User/SearchBot·DuckAssistBot별 누적 히트+last_seen. 시계열은 P2 롤업 후 추가.

**F. 돌아오는 사람 — AI 유입 ROI** (mt_ai_referrals_json 그대로 — metrics 페이지에 이미 패널 있음 → **여기선 요약+링크**, 중복 구현 금지)
"공급(우리→AI) n건 vs 수요(AI→우리 방문) 0건 — 채널② 가설 판정 D-{n}"(90일 기준일 명시).

**G. 팩·임베드** — pack_downloads(top 영화·유저 수)·copy_for_ai 클릭·pack_hits_daily(방어 히트). 임베드는 "측정 불가(per-load) — takescore 캐시미스로 근사" 문구 고정.

**H. 계측 상태 스트립(맨 아래, 필수)** — 소스별 last-event ts + 갱신 주기 표:
`mcp_calls 실시간` · `api_calls 실시간(P0 후)` · `크롤러 카운터 실시간(시계열은 30분 롤업)` · `AI유입 실시간` · `인사이트 요약 30분 크론` · `보존: raw 90일→일일 롤업 영구`. **"측정 안 되는 것"도 명시**: embed per-load·API 캐시히트(CDN 뒤)·robots로 차단된 봇.

---

## §3. 신규 수집 P0 — `api_calls` 원장 (이 기획의 유일한 마이그레이션)

**마이그 0100(번호 재확인!)** — `0093_mcp_calls.sql`을 그대로 미러:
```sql
create table public.api_calls (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  endpoint text not null,        -- 'films_search' | 'film' | 'takescore' | 'locations'
  arg text,                      -- slug 또는 검색어 (200자 절단)
  prefix text, ua text,          -- /24 프리픽스·UA(300자 절단) — mcp_calls 규약 동일
  ok boolean not null default true,
  ms integer
);
create index on public.api_calls (ts desc);
create index on public.api_calls (endpoint, ts desc);
alter table public.api_calls enable row level security;  -- 0정책 = service_role 전용(0093 자세)
```

**코드 배선 — 초크포인트 1곳 + 라우트 4줄:**
- `lib/apiGuard.ts`에 `guardAndLog(db, req, endpoint, arg)` 신설: 기존 `callerPrefix`+`harvestBlocked` 수행 후 **try/catch awaited 인서트**(MCP 라우트와 동일 자세 — Vercel에서 미대기 fire-and-forget은 응답 반환 시 킬될 수 있음; 대안은 next/server `after()`).
- 4개 라우트의 `harvestBlocked()` 호출 라인 스왑: `app/api/v1/films/route.ts:34`(q) · `films/[slug]/route.ts:26`(slug) · `takescore/[slug]/route.ts:25`(slug) · `locations/route.ts:38`(film/country).
- ⚠️ **인서트는 trusted-egress 단락(短絡) 바깥에** — `apiGuard.ts:31`이 Anthropic IP를 조기 return하는데, 원장이 그 안에 있으면 **가장 궁금한 Claude 트래픽이 데이터에서 사라진다**(harvestBlocked는 방어용이라 면제가 맞고, 로깅은 전원 기록이 맞음).
- openapi.json·embed.js 라우트는 **로깅 제외**(정적·캐시중심·저가치 — §0-2).
- 실패는 무조건 삼킴(fail-open): **로깅이 API를 죽이면 안 된다.**

**선택 P0b(공짜)**: MCP blocked 콜도 원장에 — `app/api/mcp/route.ts:321-326` blocked 분기에 ok=false 인서트 1개. (현재 차단 콜은 어디에도 안 남음.)

---

## §4. 읽기 경로·집계 — 단일행 jsonb RPC + 30분 크론 라이더

**대시보드 읽기(P1)**: metrics 페이지 패턴 복사(`app/admin/metrics/page.tsx:78-107`) — `getAdminUser()→notFound()` 재검증 + `createAdminClient()` + **단일행 jsonb RPC 1개** `usage_overview_json(p_from, p_to, p_noise boolean)` (PostgREST 1000캡 회피 — mcp_calls는 이미 1,824행). 반환: `{totals, series[], by_tool, by_endpoint, top_args[], by_client_family, crawler_ai[], packs, freshness}`. `statement_timeout '12s'` + `revoke from public/anon/authenticated; grant service_role`(0086 관용구 — Supabase 기본권한 함정).

**롤업(P2)**: `vercel.json` 크론 추가 **불필요** — 기존 30분 인사이트 크론(`app/api/metrics/insights/route.ts`)의 라이더 슬롯(:70-77 템플릿, 각 라이더 독립 try/catch)에 5번째 블록으로 `usage_rollup()` RPC:
1. `usage_daily`(day, source, family, endpoint/tool, calls, distinct_prefixes) 업서트 — mcp_calls+api_calls 접기.
2. **크롤러 시계열**: mt_crawler_visits의 hits 스냅샷을 일자 차분으로 `crawler_daily`에 기록(미들웨어 무변경 — middleware.ts는 수동커밋 대상이라 회피).
3. **GC**: mcp_calls·api_calls raw **90일 보존** 후 삭제(일일 롤업은 영구) — 0091의 기회적 GC 패턴.
4. (선택) 주간 1회 mt_insights에 usage 요약 라인 — 오너가 metrics 페이지에서도 봄.

**갱신 주기(오너 질문에 대한 답):** 페이지=**방문 시 실시간**(force-dynamic, bounded-window RPC) · 롤업·시계열=**30분 크론**(콜드 시 metrics 페이지의 refreshInsightsIfStale와 동일하게 페이지 방문이 트리거 가능) · 원본 보존=**90일**·롤업=영구. 이 표가 H패널에 그대로 뜬다.

---

## §5. 구현 순서·체크리스트 (P0→P2 순서 고정 — 계측이 먼저, 화면이 다음)

| 페이즈 | 내용 | 파일 |
|---|---|---|
| **P0** | 마이그 0100 api_calls(+선택 blocked-MCP 인서트) + guardAndLog + 4라우트 스왑 | supabase/migrations/0100_*.sql · lib/apiGuard.ts · api/v1 4라우트 (+api/mcp 1분기) |
| **P1** | `usage_overview_json` RPC(같은 마이그에) + `/admin/usage` 페이지 + NAV_ITEMS + `classifyAiClient()` + **Kpi/Panel/BarList를 components/admin/으로 추출**(현재 metrics/page.tsx:402-478 module-private — 복사 말고 추출, metrics도 임포트로 전환) | app/admin/usage/page.tsx · app/admin/layout.tsx · components/admin/* · lib/aiClients.ts |
| **P2** | usage_rollup 라이더(usage_daily·crawler_daily·GC 90d) | app/api/metrics/insights/route.ts + 마이그(P0에 동봉 가능) |
| **P3(보류)** | embed Referer 로깅(cache-miss 의미론 수용 시) — 오너 콜 | — |

**검증 체크리스트:**
- [ ] tsc net-new 0 · 마이그는 오너 `apply-sql.py` 실행 후 코드 배포(순서!)
- [ ] `/api/v1/takescore/mulholland-drive-2001` 캐시버스터 호출 → api_calls에 1행(endpoint/arg/ua/prefix/ms)
- [ ] Anthropic 이그레스 시뮬(불가 시 코드 리뷰로): trusted여도 api_calls에 기록됨
- [ ] api_calls 인서트 실패 주입(테이블명 오타 브랜치 테스트) → API 응답은 정상(fail-open)
- [ ] /admin/usage: 비로그인→404·비admin→404 (middleware+getAdminUser 이중 게이트)
- [ ] `?noise=1` 토글: 기본 뷰에서 SentinelOracle 1,200행이 **안 보임**
- [ ] C패널 top-slug에 tier 뱃지·팩토리 후보 표시 렌더
- [ ] H패널 freshness ts가 실제 max(ts)와 일치 · "측정 안 되는 것" 문구 존재
- [ ] 30분 크론 1회 후 usage_daily/crawler_daily 행 생성·기존 4개 라이더 무영향

**함정(요약 — 상세는 조사 결과):** MCP 핫패스에 추가 DB작업 금지(504 이력·maxDuration 15s) · 어드민 읽기는 전부 service_role+단일행 jsonb · CDN 캐시 의미론 화면 명시 · bot_name 대신 raw ua · vercel.json/middleware는 수동커밋(이 기획은 회피함) · `app/api/v1/locations 2`·`takescore 2` 빈 디렉터리는 무해한 Finder 잔재(정리 겸 삭제 가능).

---

## §6. 오너 결정 대기 (구현자는 기본값으로 진행, 여기 기록)

| 결정 | 기본값 |
|---|---|
| raw 원장 보존 기간 | 90일(롤업 영구) |
| arg 전문 기록(검색어 포함) | 기록(200자 절단 — mcp_calls 전례) — PII 아님 |
| /admin/crawlers 나브 등록 | 등록 권장 |
| embed 로깅(P3) | 보류(cache-miss 의미론 수용 여부) |
| 90일 판정 기준일(F패널 D-day) | MCP 런칭 2026-07-12 기점 → 2026-10-10 |
