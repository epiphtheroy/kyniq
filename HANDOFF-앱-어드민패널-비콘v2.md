# HANDOFF — 앱 어드민 패널 `/admin/app` · 앱 비콘 v2 · 어드민 18초 로딩 수리 (2026-09-10)

> 다음 세션(사람이든 AI든)이 이 문서만 읽고 이어받을 수 있게 쓴 기록. 코드·주석·커밋은 영어, 오너 대화는 한국어([[language-preference]]).
> 상위 정본: `HANDOFF-사이트분석-퍼스트파티.md` §10(요약본). 이 문서가 상세본.

## 0. 한눈에 — 2026-09-10 저녁 기준 상태

| 항목 | 상태 | 증거 |
|---|---|---|
| 마이그 **0151** (`mt_app_panel_json` 신설 + `mt_weekly_return_json` 수리) | ✅ 프로덕션 DB 적용 | `apply_migration` success · `explain analyze` 두 RPC 합계 325ms |
| 웹 `/admin/app` 페이지 + 사이드바 📱 App | ✅ 프로덕션 라이브 | 커밋 `c77074e6` → staging CI 초록 → 오너 `git push origin origin/staging:main` → Vercel `dpl_AwP2iBx…` READY, metatake.net 별칭 |
| 앱 비콘 v2 (세션·첫 실행·탭 이름 40여 종) | ✅ OTA 발행 | EAS 업데이트 그룹 `cabafd15-0d03-404a-bcb8-5b4f0d41b557`, 브랜치 production, runtime **1.0.2**, iOS `01a088f2-292b-779a…` / Android `01a088f2-292b-78ab…` |
| 다운로드 워처 `worker/app-stores-daily-watch.sh` | ✅ 가동 중 | pid `worker/.app-stores-watch.pid`(=67742), 로그 `worker/app-stores-pull.log`, `restart-watchers.command` 등록 |
| Play 설치 수집 (`PLAY_REPORTS_BUCKET`) | ✅ 설정·1회 적재 / ⚠️ 구글 내보내기 정지 관찰 | `.env.local` `PLAY_REPORTS_BUCKET=pubsite_prod_7800875077131594981`, 8월 12건 적재, 9월 파일 미생성(§7) |
| 오너 확인 대기 | ⏳ | 다음날 `/admin/app`에서 "첫 실행"·"세션 평균"이 "OTA 후 집계"→숫자로 바뀌는지 |

## 1. 오너 요청과 답

요청(원문 요지): ① 앱 접속자수·다운로드수를 iOS/Android별 **하루 단위**로 어드민에서 보고 싶다 ② 앱 안의 클릭 같은 활동을 **면밀히** 보고 싶으니 기획해서 넣어라 ③ 어드민 로딩이 느린데 **서버 과부하**를 주는 건 아닌가.

답: ① `/admin/app` 일별 표 ② 비콘 v2 + 활동 상세·퍼널 ③ 과부하가 아니라 **RPC 하나의 결함**(§2). 고쳤다.

## 2. 어드민 느림 — 진단·수리 (다른 곳에서도 재발 가능한 SQL 함정)

- **측정**: `pg_stat_statements`에서 `mean_exec_time desc`. `mt_weekly_return_json(8)` = **125회 · 평균 18,624ms · 최대 235,495ms · 누적 2,328초**. 같은 페이지의 다른 RPC 9개는 3~200ms. mt_events는 42,421행·24MB뿐.
- **원인**: 0149의 `cls` CTE에 있던
  `when exists (select 1 from bot_pref b where b.wk = per.wk and b.pfx = per.pfx)`.
  `bot_pref`는 한 번만 참조되는 CTE라 Postgres가 **인라인**하고, 바깥 행을 참조하는 상관 EXISTS는 해시로 못 바꿔 **`per` 행마다 (wk,pfx) 집계 전체를 재실행**(SubPlan). 원본은 `execute_sql` 60초 타임아웃으로 EXPLAIN조차 못 끝냈다.
- **수리(0151)**: `vip`·`base`·`bot_pref`를 `as materialized`, EXISTS → `left join bot_pref b on (b.wk, b.pfx)`, `wvmap`은 base에 접은 `wv` 컬럼에서 `distinct`. 결과 JSON 동일(8주 행), **326ms**.
- **답의 프레임**: "상시 과부하"는 아니다(오너 혼자 가끔 여는 페이지). 하지만 열 때마다 **DB CPU 18초를 점유해 프로덕션 쿼리와 경쟁**했다(Medium 인스턴스). 지금은 페이지 전체 1초 안쪽.
- **규칙**: 단일 참조 CTE를 상관 서브쿼리 안에서 쓰지 말 것. 비상관 `in (select …)`는 괜찮다(0120/0150이 그래서 94ms). 메모리 [[admin-weekly-rpc-correlated-exists-18s]].

## 3. 만든 것 — 파일 맵 (커밋 `c77074e6`, 20파일)

**SQL** — `supabase/migrations/0151_app_panel_daily_and_weekly_return_fix.sql` (헤더 주석에 전체 사유)
- `mt_weekly_return_json(p_weeks)` 재정의 (§2)
- `mt_app_panel_json(p_days default 30)` 신설 — 단일 jsonb, service-role 전용(`revoke execute … from anon, authenticated, public`).

**웹**
- `app/admin/app/page.tsx` — 새 페이지. `force-dynamic`, `getAdminUser()` 없으면 404, `?d=14|30|90`. RPC 실패 시 "0151 적용되면 나타납니다" 문구로 fail-soft.
- `app/admin/layout.tsx` — `NAV_ITEMS`에 `{ href: "/admin/app", label: "App", icon: "📱" }` (Analytics 바로 아래).
- `app/admin/metrics/page.tsx` — 기존 📱 앱 박스는 유지, 제목 옆에 `/admin/app` 링크 한 줄만 추가. (`mt_app_activity_json` 0145는 그대로 호출됨.)

**모바일** (전부 `trackTap(...)` 추가뿐, 로직 무변경 — 예외는 beacon.ts)
- `mobile/src/lib/beacon.ts` — **v2**: 세션 수명주기, `first_launch`, `trackAction()` export 추가. §4.
- `mobile/app/_layout.tsx` — 무변경(`startBeacon()`·`useSegments` 화면 추적 그대로).
- 계측 추가 파일: `app/(tabs)/index.tsx`(홈 필터·새로고침) · `app/(tabs)/search.tsx`(검색어·결과 열기·장르/연대) · `app/(tabs)/navigator.tsx`(목적지) · `app/navigator/drive.tsx`(선호·봤어·건너뛰기·공유) · `app/film/[slug].tsx`(감독·점수·지도·유사작·초대문·별점수정·공유) · `app/onboarding.tsx`(단계 useEffect·완료·닫기) · `src/components/SignInPanel.tsx`(auth:*) · `app/(tabs)/my.tsx`(설정·푸시·면/정렬·로그아웃·삭제프롬프트) · `app/connect.tsx`(connect:*) · `app/director/[slug].tsx` · `app/list/[slug].tsx`.
- 이미 있던 계측(0145): `state/films.tsx`(판단 5종+undo) · `SaveListBtn` · `lib/review.ts` · `app/read.tsx`(`reader:open`).

**워커·운영**
- `worker/play-installs-pull.mjs` — 신규. Play Cloud Storage 내보내기 → `mt_app_downloads`(android). `--probe`(버킷 목록) / `--months N`.
- `worker/app-stores-daily-watch.sh` — 신규. 하루 1회 `asc-sales-pull.mjs --days 3` + (버킷 설정 시) `play-installs-pull.mjs --months 2`. nohup 루프.
- `restart-watchers.command` — `app-stores-daily` 등록 + 낡은 `Documents/MetaTake` 경로를 `Developer/MetaTake`로(오너 로컬 수정과 동일 내용).
- `.env.local`(gitignore) — `PLAY_REPORTS_BUCKET=pubsite_prod_7800875077131594981` 추가(09-10).

**문서·메모리**
- `HANDOFF-사이트분석-퍼스트파티.md` §10, `docs/00-INDEX.md` 등록, 이 문서.
- 메모리: `first-party-analytics.md`(앱 섹션 갱신), `admin-weekly-rpc-correlated-exists-18s.md`(신규), `mobile-release-bypasses-ci-and-ota-trap.md`(`eas update` 차단·OTA 발행 기록).

## 4. 데이터 모델 · 이벤트 사전

**저장**: `mt_app_events`(0145) — `ts, type('screen'|'tap'|'action'), name, arg, visitor, session, platform, app_v, country/region/city, props`. 수집기 `app/api/metrics/app/route.ts`는 이름을 검증하지 않으므로 **새 이벤트 이름은 웹 배포 없이 OTA만으로 추가 가능**. 40건/배치·기기당 30배치/분 상한.

**identity**: `visitor` = 폰에서 매일 새로 만드는 랜덤 ID(날짜 넘어 연결 불가, IP 미저장) → **일 단위 unique만 정확, 주간 unique·리텐션은 구조상 불가**. `session` = 런치당 랜덤, 30분 이상 백그라운드 후 복귀 시 새 ID.

**action (앱이 스스로)**
- `first_launch` props `{app_v}` — 설치당 1회. 판정: `mt_beacon_installed` 키 없음 → 키 기록 → `mt.review.v1`(review.ts)의 `first`가 오늘보다 앞이면 **기존 설치자로 간주하고 미발송**(OTA 순간 전원이 신규로 잡히는 것 방지). 결과적으로 **OTA 이후 새로 설치한 기기만** 센다.
- `session:start` props `{cold: bool}` — 앱 시작(cold=true) 또는 30분 갭 후 복귀(cold=false).
- `session:end` props `{dur_s, screens}` — **백그라운드/inactive 전환 때마다** 그때까지의 누적 길이. 강제종료 대비. 서버는 세션당 `max(dur_s)`(`sess_all` CTE).

**tap 이름** (라벨 사전 = `app/admin/app/page.tsx`의 `TAP_LABELS`)
- 판단: `watchlist:add|remove`, `seen`, `rate`(props.rating), `pass`, `pass:restore`, `judgment:undo`, `list:save|unsave`, `list:add_all`
- 홈: `home:filter`(arg `sort|era|origin|services:on/off|taste:on/off|hideSeen:on/off|preset:<k>`), `home:refresh`
- 탐색: `search:query`(arg 검색어, props.n 결과수 — 디바운스 확정마다 1건, 자모 단독은 제외), `search:open`(arg slug, props.from/kind), `search:browse`(arg `genre:<g>|decade:<label>`)
- 내비: `navigator:open`(arg key, props.kind dir|lineage), `navigator:resume`, `navigator:pref`(fewest|fastest|notolls), `navigator:seen`, `navigator:skip`
- 영화: `film:director`, `film:score`, `film:map`, `film:maps_outbound`, `film:kindred`(props.from), `film:invitation`(more|less), `film:rating_edit`, `share`(arg film|director|navigator)
- 온보딩: `onboarding:step`(arg welcome|account|edition|taste|language|uiLanguage — `useEffect([step])`이라 진입마다 1건), `onboarding:finish`, `onboarding:close`
- 인증: `auth:apple|google|password|signup|otp`(성공 시), `auth:signout`
- 설정·마이: `settings:open`, `settings:push`(on|off), `my:face`, `my:sort`, `account:delete_prompt`
- 커넥트: `connect:import|sync|start|disconnect|export|collect`(arg connector id)
- 기타: `director:film`, `reader:open`(arg 웹 경로 — `/whereto`·`/takescore`·`/tv`·`/omni`·`/film`·`/about`로 분류), `review:ask`, `review:listing`

**`mt_app_panel_json` JSON 모양** (페이지의 `AppPanel` 인터페이스가 정본)
`days[]`(day, devices, ios, android, sessions, ios_sessions, android_sessions, screens, taps, ios_first, android_first, avg_session_s|null, ios_dl|null, android_dl|null, ios_calls, android_calls) · `screens_top[]`/`taps_top[]`(name, n, devices, ios, android) · `films_top[]`(slug, title, n, devices) · `searches_top[]` · `reader_top[]`(path 첫 세그먼트) · `versions[]`(7일) · `countries[]` · `hours[]`(0~23 KST) · `session_len[]`(5구간, 7일) · `funnels{onboarding, judgment, navigator, search, auth}`(기기수) · `totals{…}`.
**null 규약**: `ios_dl/android_dl` null = 그날 리포트 미수집(페이지는 `–`), 0 = 리포트상 0. `avg_session_s` null = 세션 종료 보고 없음.

**다운로드**: `mt_app_downloads(day, platform, kind download|redownload|update, units)`(0144). iOS = `worker/asc-sales-pull.mjs`(ASC SALES/SUMMARY, PT 날짜, 2일 지난 404는 0으로 기록). Android = Play CSV의 "Daily User Installs"→download, "Daily Device Upgrades"→update, 기기−사용자 차이→redownload.

## 5. 배포 이력 (시간순, 09-10)

1. 워크트리 `.claude/worktrees/app-panel`(origin/staging 기준, node_modules 심링크)에서 작업 → 웹 tsc 래칫 **20 유지**, 모바일 `tsc` 0 오류, `scripts/check-platform.mjs` 통과 → 커밋 `c77074e6` → `push HEAD:staging`.
2. GitHub Actions: CI(웹) success 1m12s · Mobile success 2m04s. Vercel staging `dpl_A21x6b5…` READY.
3. 마이그 0151 — Supabase MCP `apply_migration` 성공(에이전트 권한 통과). 적용 전 RPC 본문을 리터럴(30일)로 실행해 JSON 모양 검증.
4. 오너 체크아웃(`feat/discovery-feed`)을 `git merge --ff-only origin/staging`로 `c77074e6`에 맞춤(오너의 미커밋 `restart-watchers.command` 경로 수정은 커밋에 포함된 동일 내용이라 `checkout --`로 정리). 워크트리 삭제.
5. `node worker/asc-sales-pull.mjs --days 3` 실행 확인(09-08: 다운로드 1·업데이트 5) → `nohup worker/app-stores-daily-watch.sh` 가동.
6. `eas update`는 **자동모드 분류기 차단** → 오너가 `!`로 실행 → 그룹 `cabafd15…` 발행(runtime 1.0.2, 양 플랫폼).
7. `PLAY_REPORTS_BUCKET` 설정 → `--probe` 200(권한 이미 있음) → `--months 2`: 8월 7일치·12 설치 적재, 9월 파일 없음.
8. 오너 `git push origin origin/staging:main` → Vercel 프로덕션 `dpl_AwP2iBx…` READY(1m32s) → 스모크: `/` 200, `/film/in-the-mood-for-love-2000` 200, `/admin/app`·`/admin/metrics` 307→login.

## 6. 검증 방법 (이어받는 세션이 그대로 쓸 것)

```sql
-- 어드민이 다시 느려졌나? (범인은 항상 여기서 먼저 나온다)
select left(query,80) q, calls, round(mean_exec_time) mean_ms, round(max_exec_time) max_ms
from pg_stat_statements where query ilike '%mt\_%json%' order by mean_exec_time desc limit 10;

-- 두 RPC 실측 시간 (기대: 0.3~0.5초)
explain (analyze, format text) select mt_weekly_return_json(8), mt_app_panel_json(30);

-- OTA 도달 여부: first_launch / session:end가 쌓이기 시작했나
select name, platform, app_v, count(*), min(ts) from mt_app_events
where type='action' and ts > now() - interval '2 days' group by 1,2,3 order by 4 desc;

-- 오늘 헤드라인 숫자
select mt_app_panel_json(14)->'totals';
```
- 페이지: 로그인 후 `https://metatake.net/admin/app`. 14/30/90 토글. `/admin/metrics`가 1초 안쪽으로 뜨면 §2 수리가 살아 있는 것.
- 워처: `pgrep -fl app-stores-daily-watch`, `tail worker/app-stores-pull.log`. 재부팅 후엔 `restart-watchers.command` 더블클릭.
- Play 버킷: `node worker/play-installs-pull.mjs --probe` → 9월 파일(`installs_net.metatake.app_202609_overview.csv`)이 보이면 `--months 2`.

## 7. 알려진 한계 · 주의

- **접속자 = 일 단위 기기수.** ID가 매일 회전하므로 7일 합산은 같은 사람을 최대 7번 센다. 페이지에 명시했다. 주간 unique·리텐션이 필요하면 프라이버시 설계(0145 헤더)를 바꿔야 하며 오너 결정 사항.
- **첫 실행은 OTA 이후 신규 설치만.** 이전 설치자 수는 스토어 다운로드로만 보인다.
- **Play 내보내기가 08-26 이후 멈춰 있다.** 8월 파일이 08-21까지만이고 9월 파일이 없다(9/1 프로덕션 출시 후 활성 Android 17대인데도). 구글 측 지연/정지. 워처가 매일 재시도. 며칠 뒤에도 없으면 오너가 Play 콘솔 → 보고서 다운로드 → 통계에서 9월 파일 존재 확인. 스크립트의 힌트 문구는 `pubsite_prod_rev_…`라 썼지만 실제 버킷명은 `pubsite_prod_<id>`(rev 없음) — 힌트만 틀렸고 동작엔 무관.
- **iOS 다운로드는 하루 지연**(Apple이 다음날 아침 PT 리포트). 워처가 3일 창으로 재덮음.
- **회색 "요청" 열은 BFF 캐시미스 하한**(0144) — 접속과 비례하지 않는다. 판단 근거로 쓰지 말 것.
- **분류기 경계(실측)**: `eas update`·`eas submit`·프로덕션 main 푸시는 에이전트 차단 → 오너 `!`. `apply_migration`·`eas build`·`asc-sales-pull`(p8 읽기 포함)·nohup 워처 기동은 통과했다.
- **워크트리 심링크**: `node_modules`·`mobile/node_modules`를 심링크했으면 `git add -A` 금지(명시 add만). 이번엔 명시 add로 처리.
- 개발 빌드(`__DEV__`)·오너 옵트아웃(`mt_beacon_optout`) 기기는 수집 제외. 웹뷰 안 페이지는 웹 비콘에도 잡힌다(중복 아님, 별도 테이블).
- `search:query`는 디바운스 확정마다 발송되어 "tok", "tokyo", "tokyo s" 같은 접두 잡음이 섞인다. 상위 목록은 그대로 읽되 정확한 의도는 `search:open`을 보라.

## 8. 다음 단계 후보 (오너 지시 전엔 착수 금지)

- 앱 전용 한줄 리포트(웹 `mt_generate_insights` 방식): "오늘 iOS 첫 실행 3, Android 0", "세션 중앙값 하락" 등.
- 영화별 퍼널(열람→판단→웹 리더) 상위/하위 — `films_top`에 판단 기기수 열 추가하면 됨.
- `mt_app_activity_json`(0144/0145) 은퇴: `/admin/metrics` 앱 박스를 `mt_app_panel_json(14)` 요약으로 교체하면 RPC 하나 줄어듦.
- `push_tokens`는 여전히 0행 — 푸시 등록 기기 KPI는 푸시 자격증명 설정 후에만 의미.
- mt_app_events 롤업은 수십만 행 전까지 불필요(현재 ~1,000행).
- Play 내보내기가 계속 비면: 대안은 Play Console 통계 CSV 수동 다운로드 → 같은 파서로 적재(`parseOverview`는 파일 경로 입력을 받도록 5줄만 손보면 됨).

## 9. 관련 문서 · 메모리

- `HANDOFF-사이트분석-퍼스트파티.md` §10 (요약) · §Bot Sentinel (수집기 편집 전 필독)
- `supabase/migrations/0144_app_activity_panel.sql` · `0145_app_beacon.sql` · `0151_…sql` (헤더 주석이 설계 사유)
- `mobile/store/HANDOFF-ASC-SUBMISSION.md` (서비스계정·ASC 키·`asc-release.mjs`)
- 메모리: `first-party-analytics`, `admin-weekly-rpc-correlated-exists-18s`, `mobile-release-bypasses-ci-and-ota-trap`, `play-console-account-live`, `branch-discovery-feed-behind-main`, `staging-verify-lean-for-small-ui`
