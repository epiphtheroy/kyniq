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
- 범위 24h/7d/28d/90d (24h는 시간 단위 버킷, KST). 상단 라이브 스트립(5분/30분 활성).
- KPI: 방문자·페이지뷰·세션·페이지/세션·바운스·평균 체류·평균 스크롤.
- 시계열(페이지뷰+방문자, 호버 크로스헤어) · Top pages(체류·스크롤 병기) · 유입 도메인 · 진입/이탈 페이지 · 국가 · 기기/브라우저 · **사이트 내 검색어** · 클릭(data-mt) · 세션 흐름(페이지→페이지) · vitals p75.
- **페이지 행 클릭 = 드릴다운**: 그 페이지의 시계열·유입·전/다음 페이지·**GSC 쿼리**(클릭·노출·평균 순위) 한 화면.

## 5. GSC 커넥터 — worker/gsc-pull.py (⏳ 원우 셋업 대기)

원우가 할 일(1회, ~10분):
1. console.cloud.google.com → 프로젝트에서 **Search Console API 활성화**
2. 서비스 계정 생성 → JSON 키 다운로드 → `worker/gsc-sa.json`으로 저장(.gitignore 등록됨)
3. GSC(search.google.com/search-console) → 설정 → 사용자·권한 → 그 서비스계정 이메일 추가
4. `python3 worker/gsc-pull.py` (드라이런) → `python3 worker/gsc-pull.py --persist --days 90` (백필)
5. 이후 일일 1회 `--persist` (hourly 워처 루프에 한 줄 추가하면 됨; GSC는 ~2일 지연이라 기본 3일 창)

- pip 의존성 없음(JWT 서명은 openssl 서브프로세스). 프로퍼티 기본 `sc-domain:metatake.net`, 다르면 `GSC_PROPERTY` env 또는 `--property`.

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

## 8. 다음 단계(대기)

- [ ] 원우: GSC 서비스계정 (§5) → 대시보드 GSC 패널 활성화
- [ ] 원우(선택): Clarity 계정 (§6)
- [ ] 원우(선택): Vercel env `METRICS_SALT` 임의 문자열 추가
- [ ] 데이터가 쌓이면: 핵심 CTA에 `data-mt` 속성 부착(Save/Seen/Watchlist/Follow/TV 재생 등), 주간 자동 리포트, 일별 롤업, "노출 많고 클릭 없는 페이지"(GSC×행동) 자동 리스트
- [ ] Vercel Analytics는 당분간 병행(무해) — 자체 수치와 교차 검증 후 제거 판단
