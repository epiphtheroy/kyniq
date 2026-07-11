# HANDOFF — 크롤러 핸드셰이크 · 리퍼러 노출 정본

**상태: SHIPPED · 프로덕션 end-to-end 검증 완료 (2026-07-12, commit `0bbf485`)**

> **한 줄:** metatake.net의 흔적을 *내가 통제할 수 있는 경로*(내 아웃바운드 링크 + 내 봇)에 정직하게 남기는 3층 시스템. ①스크레이퍼 UA 자기식별 ②아웃바운드 리퍼러 전체경로 노출 ③나를 크롤한 봇을 되받아 방문하는 역방문(visit-back) 핸드셰이크.
>
> **이 층 작업 전 반드시 읽기.** 특히 `middleware.ts`를 만지는 세션은 이 문서 + `HANDOFF-사이트분석-퍼스트파티.md` §9(Bot Sentinel)를 **둘 다** 읽을 것 — 같은 파일을 공유한다.

---

## 0. 전체 그림 · 원리 정정

원우님 요청: "내 봇이 방문하거나 내 링크가 걸리면, 상대 서버 로그에 metatake.net이 찍히게 하고 싶다(구글/얀덱스 유입이 내 로그에 남는 원리처럼)."

**핵심 원리 = HTTP `Referer` 헤더.** 브라우저가 A→B로 이동(클릭)하면 B 서버에 `Referer: A`를 보낸다. 그러나:

- **결정적 정정:** `Referer`는 *실제 클라이언트*(브라우저 클릭, 또는 내가 직접 헤더를 세팅한 내 요청)만 전달한다. **제3자 봇(구글봇·GPTBot 등)이 내 링크를 크롤할 때는 Referer를 전달하지 않는다** → "남의 봇이 내 링크를 타면 상대 서버에 metatake.net이 찍힌다"는 **불성립**. 아무도 그걸 통제 못 한다.
- **통제 가능한 표면은 딱 둘:** ① 내 사이트에서 나가는 아웃바운드 링크(내 방문자의 클릭), ② 내가 돌리는 내 봇의 요청 헤더.
- **금지:** 봇을 임의 서버에 뿌려 로그/애널리틱스에 도메인을 심는 방식 = **리퍼러 스팸(referrer spam)**, 블랙햇. 구현하지 않는다. 실익도 없다(필터링·페널티·블록리스트).

이 문서의 3층은 위 "통제 가능한 표면" 안에서만 작동한다.

---

## 1. 크롤러 자기식별 (내 봇 → 외부)

**정본 User-Agent:** `Mozilla/5.0 (compatible; MetatakeBot/1.0; +https://metatake.net/bot)`

- 전 스크레이퍼가 제각각의 UA(가짜 이메일 `yourdomain.example`·`your-email@example.com`·개인메일 포함)를 쓰던 것을 이 하나로 통일. 일괄 치환 스크립트 로그는 `tmp/unify_ua.py`(잡 임시, 참고용). 편집 파일:
  - `hourly/pipeline/common.py:20` (`UA`) — hourly 서브트리 전체 커버(trends RSS·fleet RSS·wikidata)
  - `hourly/poller/config.json` (`user_agent`) — reddit
  - `magazine research agent/comment_extractor.py:40` (`UA`) — OpenAlex·Crossref·기사 페이지 (`reception-discover.py`가 `ce.UA` 재사용)
  - `worker/wd-honors.py`·`worker/ko-aliases.py`·`worker/wikidata-id.py` (wikidata SPARQL)
  - `worker/director-facts-gen.py:149` (`LINK_UA`) — 이미 근접했던 것을 `/bot`으로
  - `movie-locations-project/history/movie_locations_crawler.py`·`movie_locations_llmsearch.py` (movie-locations.com·Nominatim)
  - `Google map/FilmAtlas/pipeline/build_data.py` (Nominatim)
- **`+URL`이 가리키는 실제 목적지 = `app/bot/page.tsx` (metatake.net/bot).** google.com/bot.html 스타일 안내 페이지 — 무엇을 하는 봇인지·robots.txt 존중·차단법·연락처. 이게 있어야 자기식별이 "익명이 아님"으로 완성된다.
- ⚠️ 스크레이퍼는 원우님 Mac에서 cron/launchd로 돈다 → **다음 실행부터** 새 UA 적용(코드는 커밋됨). TMDB·YouTube·Google·Tavily 등 인증 JSON API 호출은 UA가 로그 노출 가치가 낮아 의도적으로 제외(범위: 사람 운영자가 로그를 보는 실제 웹사이트).

---

## 2. 아웃바운드 리퍼러 노출 (내 사이트 → 외부)

목표: 방문자가 metatake.net에서 외부 링크를 클릭하면 상대 로그에 metatake.net이 **전체 경로**로 남게.

- **정책:** `app/layout.tsx` `metadata.referrer = "no-referrer-when-downgrade"`.
  - 브라우저 기본값(`strict-origin-when-cross-origin`)은 크로스도메인에 **도메인만** 보냄. `no-referrer-when-downgrade`는 HTTPS→HTTPS에 **전체 URL**을 보내고, HTTPS→HTTP 다운그레이드에만 생략(안전 기본). → `<meta name="referrer" content="no-referrer-when-downgrade">`로 렌더.
- **`rel="noreferrer"` 전량 제거:** 이 토큰이 있으면 정책보다 우선해 **아무 리퍼러도 안 보냄**. 사이트 전반 23파일 63토큰 제거(일괄 스크립트 `tmp/strip_noreferrer.py`). 보안용 `noopener`는 보존/자동추가(`target=_blank` 탭내빙 방지). `nofollow`도 보존.
- ⚠️ **함정:** 일괄 정규식이 소스 *주석 속* 리터럴 `rel="noreferrer"`까지 치환한다(실제로 layout.tsx 주석이 한 번 오염됨 → 수정). 주석에 그 리터럴 문자열을 쓰지 말 것.

---

## 3. 역방문(visit-back) 핸드셰이크 (③ 핵심)

"누가 나를 크롤하면 → 내 봇이 그 사이트를 되받아 방문해 metatake.net을 남긴다." 원우님이 "이거 가능하냐"고 물은 부분. **가능한 부분집합:** 크롤러가 UA에 자기 URL을 선언(`+http…` 또는 괄호 안 bare URL)했거나 역DNS가 실도메인인 경우. 클라우드 인프라 IP(AWS/OVH 등, 운영자 사이트 없음)는 제외.

### 3-a. 결정적 제약과 해결
기존 `mt_visitor_ip`에는 **User-Agent가 없다**(IP /24 프리픽스만) + 비콘(`/api/metrics`)은 봇을 정규식으로 걸러낸다 → "누가 나를 크롤했나"의 UA 정보가 어디에도 없었다. 따라서 크롤러 UA+선언URL을 **새로 수집하는 층**을 `middleware.ts`(모든 요청에서 UA+IP를 봄)에 추가했다.

### 3-b. 파이프라인
1. **수집:** `middleware.ts`가 식별가능 크롤러(`isObservableCrawler`: `+http` 선언 or 알려진 봇명) 방문 시, **봇 차단 판정 이후**(=403할 요청은 기록 안 함) `event.waitUntil`로 `/api/bots/observe`에 fire-and-forget POST(`x-mt-observe:1`). 아이솔레이트 단위 Map으로 UA당 10분 디둡 → 볼륨 억제.
2. **기록:** `/api/bots/observe`가 UA를 `parseCrawler`로 분해(봇명·선언URL·선언호스트) → RPC `mt_crawler_observe`가 `mt_crawler_visits` upsert(UA 키, hit 카운터) + 선언호스트마다 `mt_crawler_handshakes` pending 시드.
3. **역방문:** `lib/bots/handshake.ts` `runHandshakes()`가 pending/만료 큐를 읽어 호스트마다: 인프라호스트면 skip → **robots.txt 페치·판정**(disallow면 robots_blocked) → MetatakeBot UA + `Referer: https://metatake.net/bot`로 대상 URL **1회 방문** → 결과 기록(done + http_status). 호스트 간 400ms 딜레이.
4. **실행:** 기존 30분 insights 크론(`app/api/metrics/insights`)에 `runHandshakes(4)`를 얹음(vercel.json 루트파일 수정 회피). 수동: `GET /api/bots/handshake?key=REVALIDATION_SECRET&limit=N`.

### 3-c. 가드레일(리퍼러 스팸과의 구분)
- 크롤러가 **스스로 선언한 URL만** 대상(역DNS 추측·임의 IP 스캔 금지).
- **robots.txt 존중**(disallow면 방문 안 함).
- **호스트당 1회 / 30일**(재시도 쿨다운), 크론당 소수(기본 4), 딜레이.
- 인프라 호스트(amazonaws·cloudfront·googleusercontent·vercel.app 등) 제외.
- → "그 봇이 *나를* 방문했을 때 되받아 인사"하는 정직한 핸드셰이크. 임의 서버에 흔적을 뿌리는 스팸과 다름.

---

## 4. 파일 맵

| 파일 | 역할 | 배포 |
|---|---|---|
| `app/bot/page.tsx` | metatake.net/bot 크롤러 안내 페이지 (UA `+URL` 목적지) | 자동(워처) |
| `app/layout.tsx` | `metadata.referrer` 정책 | 자동 |
| `lib/bots/identify.ts` | `METATAKE_UA`·`parseCrawler`·`isObservableCrawler`·`isVisitableHost` (순수, **edge-safe**) | 자동 |
| `lib/bots/handshake.ts` | `runHandshakes()` — robots 파서 + 역방문 fetch + 기록 (nodejs) | 자동 |
| `app/api/bots/observe/route.ts` | 미들웨어 수집 수신 → `mt_crawler_observe` RPC (nodejs) | 자동 |
| `app/api/bots/handshake/route.ts` | 역방문 수동/크론 트리거 (auth=insights와 동일) | 자동 |
| `app/api/metrics/insights/route.ts` | 30분 크론에 `runHandshakes(4)` 얹음 | 자동 |
| `app/admin/crawlers/page.tsx` | 대시보드 — 관찰 크롤러 + 역방문 현황 | 자동 |
| `middleware.ts` | 크롤러 관찰 훅(`observeCrawler`, `event.waitUntil`) | **수동 커밋**(루트) |
| `worker/0081_crawler_handshake.sql` | 마이그레이션 | **수동 커밋** + DB 적용 완료 |
| 스크레이퍼 10종(§1) | UA 통일 | **수동 커밋**(Mac 실행) |

---

## 5. DB — 마이그레이션 0081 (kyniq / `jvgarcqrtsmgfimdcwgo`, 적용 완료)

- `mt_crawler_visits` — 크롤러 UA당 1행(`ua` unique): `bot_name·declared_url·declared_host·ip_prefix·sample_path·hits·first/last_seen`.
- `mt_crawler_handshakes` — 역방문 대상 호스트당 1행(`host` unique): `target_url·status(pending|done|robots_blocked|skipped|error)·http_status·reason·attempts·last_attempt`.
- RPC `mt_crawler_observe(p_ua,p_bot_name,p_declared_url,p_declared_host,p_ip_prefix,p_path)` — 원자적 hit 증가 upsert + pending 핸드셰이크 시드(security definer).
- 둘 다 **RLS on · 정책 0**(service-role 전용, `mt_events`·`bot_blocks`와 동일 패턴).

---

## 6. 운영 · 관측

- **자동:** insights 30분 크론이 새 크롤러가 잡힐 때마다 역방문 실행.
- **수동 트리거:** `curl "https://metatake.net/api/bots/handshake?key=$REVALIDATION_SECRET&limit=5"`.
- **대시보드:** `/admin/crawlers` (관리자 사이드바) — 누가 크롤하나 + 역방문 상태.
- **DB 확인:** `select * from mt_crawler_visits order by last_seen desc;` / `... mt_crawler_handshakes ...`.

---

## 7. 불변식 · 함정 (편집 전 필독)

- **middleware.ts는 edge 런타임** → `lib/bots/identify`(순수 정규식/URL)만 import. `lib/bots/handshake`·observe route는 **nodejs**(createAdminClient). 섞으면 edge 빌드 깨짐.
- **수집은 봇 차단 판정 이후에만** — 403할 BAD_UA 봇은 관찰하지 않는다(순서 뒤집지 말 것).
- **middleware.ts·worker/*.sql·스크레이퍼(.py)는 자동배포 워처 스코프 밖**(app/components/lib만 자동) → 수동 커밋 + `git push origin main` 필요. 미들웨어를 커밋 안 하면 ③ 수집이 라이브 안 됨(사이트는 정상, 데이터만 안 쌓임 — 안전한 중간 상태).
- **Bot Sentinel과 공존**(`HANDOFF-사이트분석-퍼스트파티.md` §9): 같은 `middleware.ts`·`mt_visitor_ip`·`lib/ip-prefix`·insights 크론을 공유. GOOD_BOT=관찰·역방문 대상, BAD_UA=403(관찰 안 함). **middleware 편집 시 두 문서 모두 필독.**
- observe route는 `x-mt-observe:1` 헤더로 게이트(내부 미들웨어 비콘만 수신).
- `no-referrer-when-downgrade` 정책 + `noreferrer` 제거가 **한 쌍**이어야 전체경로가 나감(둘 중 하나만으론 불완전).
- 일괄 noreferrer 제거 스크립트가 주석 속 리터럴도 친다(§2 함정).

---

## 8. 검증 로그 (2026-07-12 프로덕션)

- `/bot` 라이브 HTTP 200 · 홈 `<meta name="referrer" content="no-referrer-when-downgrade">` 확인 · editor 외부링크 `rel="noopener"`(noreferrer 제거) 확인.
- 마이그 0081 적용 + `mt_crawler_observe` RPC 스모크테스트(같은 UA 2회→hits=2, 핸드셰이크 시드) 통과.
- 파서 단위검증: Googlebot·GPTBot·bingbot·AhrefsBot·Perplexity=`+http` 선언, **CCBot=`+` 없는 괄호 URL 폴백**, MetatakeBot=self 제외(host null), 사람 UA=무시.
- **미들웨어 수집 라이브:** 배포 몇 분 만에 실제 **Applebot(apple.com)·Googlebot(google.com)·Amzn-SearchBot** 자동 포착(UA·선언호스트·실제 IP 프리픽스).
- **역방문 라이브:** `runHandshakes` 실행 → `{"done":2,"visited":["google.com","apple.com"]}`, DB status=done·http_status=200. → MetatakeBot이 google.com/bot.html·apple.com/go/applebot을 실제 방문, robots 존중, 0 에러. **Google·Apple 로그에 metatake.net 남음.**

---

## 9. 다음 단계 (대기)

- [ ] 스크레이퍼 Mac cron 다음 실행에서 새 UA 반영 확인(자연 반영).
- [ ] `/admin/crawlers`에 "지금 역방문 실행" 버튼(현재는 크론/키 트리거).
- [ ] (선택) 역DNS 기반 식별 — 현재는 UA 선언 URL만. 역DNS는 오탐 위험이 커 보류.
- [ ] (선택) robots 파서 강화 — 현재는 최장매칭 Allow/Disallow(우리 UA `metatakebot` 또는 `*` 그룹). 와일드카드 패턴(`*`·`$`) 미지원.
