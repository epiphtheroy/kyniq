# HANDOFF-키워드레이더.md — Keyword Radar: 키워드 기반 크리에이터 신작 감시 시스템

> **상태: 기획 완료 2026-07-12 · 구현 대기 (다른 AI/에이전트 수행 예정)**
> **이 문서가 정본.** 키워드 레이더 관련 세션은 반드시 여기서 시작. 구현하면서 결정이 바뀌면 이 문서를 직접 갱신할 것.
>
> **🔒 오너 확정 (2026-07-12, 원우): Phase 0는 무료($0) 소스 전용으로 시작한다. Threads는 제외한다(무료·앱 리뷰 경로 포함 — 앱 리뷰 제출도 하지 않음).** 따라서 §6.2의 X(twitterapi.io)·Threads·Serper와 §6.3의 유료 옵션은 전부 **Phase 1 보류** — 빌더는 Phase 0에서 이들을 구현·결제·신청하지 말 것. 스펙은 나중을 위해 보존한다. Phase 0의 X 커버리지는 없음(무료 경로 부재가 검증됨 — §6.4 Nitter·§17 X 공식 참조), 소셜 신호는 Bluesky·Mastodon·HN·Reddit(보류)으로 대체.
> 조사 근거: 2026-07-12 멀티에이전트 워크플로 — 저장소 정찰 1 + 플랫폼/도메인 웹조사 8 + **핵심 주장 40개 전건 라이브 검증**(공식 문서·가격 페이지·실제 curl/웹소켓 테스트). 가격·쿼터 수치는 §17 검증 대장 참조. 모든 수치는 2026-07-12 기준 — 구현 시점에 §17의 출처 URL로 재확인.

## 요구사항 (원우 지시 요지)

- 관심 키워드를 미리 등록한다. **Phase 0: 100개 → 장기 10,000개 이상.**
- X·인스타그램·페이스북(스레드)·워드프레스·서브스택·유튜브 등에서 그 키워드로 **새 콘텐츠를 올린 크리에이터의 활동**을 감지한다.
- **최근 1시간 / 6시간 내** 올라온 글을 본다.
- 누가(작성자) / 어디에(플랫폼) / 무엇을(URL·내용)을 알아내 **Supabase DB에 쌓고**, **우리 페이지에서 바로 본다**(피드).
- Supabase·Vercel 계정 제공됨. 기존 Mac 워커 인프라 활용 가능.

---

## 0. 한눈에 보기 (TL;DR)

| 항목 | 결정 |
|---|---|
| 이름/경로 | **Keyword Radar** — 코드·DB 접두사 `radar_`, 워커 디렉토리 `radar/`, UI `/admin/radar` |
| 아키텍처 | **이중 엔진**: 엔진 B(벌크 스트림·피드 수집 → 로컬 Aho-Corasick 매칭, $0, 키워드 수 무관) = 백본. 엔진 A(키워드별 검색 API, 비용∝키워드) = 보조 |
| DB | 마이그레이션 **0083** (radar_keywords / radar_sources / radar_items / radar_hits / radar_inbox / radar_runs), RLS 무정책(service-role 전용, 하우스 관례) |
| 워커 | Mac `radar/` — 상주 스트림 소비자 2개(Node 22 내장 WebSocket) + 시간당 폴러(Python stdlib, `hourly/pipeline/common.py` 재사용) + `radar-watch.sh`(nohup 워처, launchd 금지—TCC) |
| Vercel | WebSub 콜백 라우트 1개(`/api/radar/websub`) + `/admin/radar` 피드 페이지(하우스 admin 관례) |
| Phase 0 소스 | **$0 전용(확정)**: Bluesky Jetstream · RSS 피드풀(Substack/WP/Ghost/Medium) · GDELT · YouTube(WebSub+무료검색) · WP.com 검색 · HN · Mastodon(fedi.buzz). ~~Threads~~(오너 확정 제외) · X/Serper/Apify = Phase 1 보류 |
| Phase 0 비용 | **$0/mo (확정)** |
| 10k 스케일 | 엔진 B 그대로 $0 + 유료 어댑터 티어링(hot/warm/cold) → **~$400-900/mo** (§11) |
| LLM | **코어 루프 LLM 0** (매칭은 기계적). 요약/분류는 후속 옵션 |

---

## 1. 목표·범위·수용 기준 (Phase 0)

**목표**: 키워드 100개에 대해, 지원 플랫폼에서 최근 1~6시간 내 새 글을 감지해 `{platform, author, url, title, snippet, published_at}`으로 DB에 적재하고 `/admin/radar`에서 시간창(1h/6h/24h)·플랫폼·키워드로 필터해 본다.

**범위 밖 (Phase 0)**: **유료·계정심사 소스 전부(오너 확정)** — X(twitterapi.io/공식)·**Threads(제외 확정 — 앱 리뷰 제출도 안 함)**·Serper·Apify·Instagram, 공개 페이지(어드민만), 이메일/텔레그램 다이제스트, LLM 요약, 임베드 전면전개(카드 우선, §9), Reddit(오너 ToS 결정 대기).

**수용 기준 — 전부 통과해야 완료**:
1. 마이그 0083 적용 + 키워드 100개 시드 완료 (`select count(*) from radar_keywords` = 100)
2. Jetstream 소비자 상주 가동: Bluesky 포스트가 작성 수 분 내 `radar_items`에 적재됨 (라이브 확인)
3. 피드풀 ≥500 피드 폴링 가동, 조건부 GET(ETag/If-Modified-Since) 동작 로그 확인
4. ≥5개 플랫폼에서 히트 발생 (bluesky + substack/wordpress + news(GDELT) + youtube + hn + mastodon — 전부 무과금으로 달성 가능)
5. 중복 0: 같은 URL 재수집 시 dupe 없음 (`radar_items.url_hash` unique 위반 없이 upsert-ignore)
6. `/admin/radar`에서 `?w=1h`·`?w=6h` 필터, 플랫폼 필터, 키워드 드릴다운 동작
7. fail-soft 검증: 소스 하나 강제 실패시켜도 나머지 계속 수집, 3연속 실패 시 `radar/ledger.md`에 경고 줄
8. `radar/usage.jsonl` 파일·로깅 훅 존재 확인 (Phase 0는 유료 어댑터가 없어 기록 0건이 정상 — Phase 1 대비 배관만)
9. `python3 -m py_compile radar/*.py` 클린 + 프로덕션 빌드(tsc) 통과

---

## 2. 아키텍처: 이중 엔진 원칙

**이 프로젝트의 단 하나의 구조적 진실**: 키워드별로 검색 API를 호출하는 방식(엔진 A)은 비용·쿼터가 키워드 수에 비례해서 10,000개에서 전부 붕괴한다(조사 결과: Brave 시간당 폴링 $36k/mo, SerpApi $11k/mo, 공식 X API는 월 2M 읽기 하드캡). 반대로 **소스를 통째로 받아 로컬에서 매칭**(엔진 B)하면 비용이 키워드 수와 **무관**하다 — 10k 키워드 Aho-Corasick 오토마톤은 수십 MB RAM·빌드 1초 미만이고, 시간당 신규 텍스트 수십 MB 매칭은 CPU 1초 미만.

```
[엔진 B — 벌크 수집: 백본, $0, 키워드 수 무관]
  Bluesky Jetstream(웹소켓 상주) ─┐
  fedi.buzz SSE(상주)             ├─→ 로컬 매처(Aho-Corasick+문맥게이트) ─→ radar_items + radar_hits
  RSS 피드풀(시간당, 조건부 GET)  │         ↑ radar_keywords에서 오토마톤 빌드(10분마다 리프레시)
  YouTube WebSub 푸시(→inbox)     │
  HN 벌크 커서(15분)              ┘

[엔진 A — 키워드별 검색: 보조, 비용∝키워드, hot/warm/cold 티어링]
  GDELT(뉴스, $0) · WP.com 검색($0) · YouTube 무료검색(발견용 100/일)
  (Phase 1 보류: twitterapi.io(X) · Serper.dev(Google) / 제외 확정: Threads)
        └─ 검색 결과는 히트인 동시에 "발견": 새 채널/피드/퍼블리케이션을 엔진 B 풀에 자동 편입
```

**발견 플라이휠**: 엔진 A가 찾은 결과의 출처(유튜브 채널, 서브스택, WP 블로그, 도메인)를 엔진 B의 소스풀(`radar_sources`)에 자동 등록 → 다음부터는 $0으로 실시간 커버. 시간이 갈수록 엔진 A 의존도가 줄어드는 구조. 이것이 100개→10,000개 확장의 핵심 메커니즘이다.

**케이던스 총괄표 (Phase 0)**:

| 소스 | 방식 | 주기 | 신선도 |
|---|---|---|---|
| Bluesky Jetstream | 상주 스트림 | 연속 | 초 단위 |
| Mastodon fedi.buzz | 상주 SSE | 연속 | 초 단위 |
| YouTube WebSub | 푸시(콜백) | 연속 | 분 단위 |
| RSS 피드풀 | 폴링 | 시간당 :05 | ≤1h |
| Medium 브로드 태그 | 폴링 | 15분 | ≤15m (10아이템 창 대응) |
| HN Algolia | 벌크 커서 | 15분 | 분 단위 |
| GDELT 스윕 | 키워드별 | 시간당(10s 간격, ~17분 소요) | 15분 인덱스 |
| WP.com read/search | 키워드별 | 시간당 | 시간 단위 |
| YouTube 무료검색 | 핫 25kw 로테이션 | 6시간 | 인덱스 랙 주의 |
| ~~Threads keyword_search~~ | — | **제외 확정(오너)** | — |
| ~~X twitterapi.io~~ | — | **Phase 1 보류** | — |
| ~~Serper /news+/search~~ | — | **Phase 1 보류** | — |
| WebSub 리스 갱신 | 관리 | 일 1회(5일령 재구독) | — |
| 키워드→오토마톤 리로드 | 관리 | 10분 | — |

---

## 3. 기존 인프라와의 관계 + 재사용 자산

**hourly(Now Playing)와는 형제, 확장 아님.** hourly 폴러는 "세상의 스파이크 → 우리 엔티티 매칭"(탐지형·발행 게이트·7일 휘발 상태)이고, 레이더는 "고정 키워드 워치리스트 → 크리에이터 신작 수집"(추적형·영구 DB·피드 UI)이다. `hourly/poller/poller.py`를 수정하지 말 것. 대신 아래를 재사용:

| 재사용 자산 | 용도 |
|---|---|
| `hourly/pipeline/common.py` | `http()`(재시도+정본 UA), `load_env()`(.env.local), `sb_get/sb_insert/sb_update/sb_rpc`(Supabase REST), `log()`, `_log_usage` 패턴 — **radar에서 `sys.path.insert`로 통째 임포트** |
| `hourly/poller/poller.py`의 `parse_feed()` | 관용 RSS/Atom 파서 (radar/feeds.py로 복사) |
| `hourly/poller/poller.py`의 `norm()`+`CONTEXT_WORDS` | 매처 정규화·문맥 게이트의 원형 (§5) |
| `hourly/poller/entities.json` + `sync_entities.py` | 키워드 시드 소스 (§10) |
| `hourly/poller/config.json`의 fleet 12피드 | 피드풀 초기 시드에 포함 |
| `hourly/TREND-SOURCES.md` | 소스별 검증된 운영 규칙(GDELT 5s·Reddit UA·Google News when: 등) |
| `hourly/now-playing-watch.sh` | 워처 스크립트 원형 (pidfile+HOLD 패턴) |
| `worker/apply-sql.py` | 마이그레이션 적용 (`python3 worker/apply-sql.py radar/0083_keyword_radar.sql` — .env.local의 SUPABASE_ACCESS_TOKEN 사용) |
| `app/admin/crawlers/page.tsx` | 어드민 페이지 최소 패턴(서비스롤 select + 인라인 스타일 테이블) |
| `lib/bots/identify.ts`의 METATAKE_UA | 정본 UA 상수 |

**.env.local 기존 키 활용**: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `YOUTUBE_API_KEY`. **Phase 0 신규 키는 단 하나**: `RADAR_WEBSUB_SECRET`(콜백 검증용 랜덤 문자열). (Phase 1 보류분: `TWITTERAPI_IO_KEY`, `SERPER_KEY`, `APIFY_TOKEN` — 오너 재승인 전 추가 금지.)

---

## 4. DB 스키마 — 마이그레이션 0083 전문

파일: `radar/0083_keyword_radar.sql`. **번호 규칙: `worker/*.sql`과 `supabase/migrations/` 양쪽의 최대값+1 = 0083** (0081이 이미 양쪽 충돌 전례; 적용 직전 재확인). 적용: `python3 worker/apply-sql.py radar/0083_keyword_radar.sql`. RLS: **무정책**(service-role 전용 테이블 하우스 관례 — mt_events 패턴). 어드민 페이지는 `createAdminClient()`로 읽는다.

```sql
-- 0083_keyword_radar.sql — Keyword Radar (HANDOFF-키워드레이더.md)
create table if not exists radar_keywords (
  id            bigint generated always as identity primary key,
  keyword       text not null unique,          -- 표시용 원형 "In the Mood for Love (2000)"
  match_text    text not null,                 -- 매칭용 "in the mood for love" (연도 등 제거)
  norm          text not null,                 -- poller.norm() 방식 정규화 소문자
  kind          text not null default 'custom',-- film|director|theorist|concept|movement|custom
  entity_slug   text,                          -- 사이트 엔티티 역링크(있으면)
  tier          text not null default 'warm',  -- hot|warm|cold : 엔진A 케이던스 티어
  aliases       jsonb not null default '[]'::jsonb,  -- ["화양연화","Fa yeung nin wa"]
  require_context boolean not null default false,    -- 짧은/일반어 제목 → 문맥 게이트 필수
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists radar_sources (
  id            bigint generated always as identity primary key,
  platform      text not null,   -- x|threads|instagram|youtube|substack|wordpress|ghost|medium|bluesky|mastodon|reddit|hn|news|google|tumblr|blog
  kind          text not null,   -- stream|feed|search|websub|webhook
  url           text,            -- 피드 URL / 채널ID / 엔드포인트 (stream류는 null 가능)
  label         text,
  beat          text,            -- film|culture|general : 문맥 게이트 판단용(§5)
  active        boolean not null default true,
  last_ok_at    timestamptz,
  fail_count    int not null default 0,
  etag          text,            -- 조건부 GET 상태
  last_modified text,
  websub_lease_until timestamptz,-- websub 전용
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create unique index if not exists radar_sources_uni on radar_sources(platform, coalesce(url,''));

create table if not exists radar_items (
  id            bigint generated always as identity primary key,
  url           text not null,
  url_hash      text not null unique,          -- sha256(정규화 URL): 쿼리스트링 utm 제거 후
  platform      text not null,
  author        text,
  author_url    text,
  title         text,
  snippet       text,                          -- 공개 표시용 ≤300자 (§9)
  content_text  text,                          -- 내부 매칭용 전문(공개 렌더 금지, §9)
  lang          text,
  published_at  timestamptz,                   -- 원문 발행시각 (없으면 discovered_at로 폴백 표시)
  discovered_at timestamptz not null default now(),
  source_id     bigint references radar_sources(id),
  thumb_url     text,                          -- 프록시/영속화된 자체 경로 (서명 CDN 원본 저장 금지)
  embed_html    text,                          -- oEmbed html 캐시 (클릭-투-로드용, §9)
  meta          jsonb not null default '{}'::jsonb
);
create index if not exists radar_items_pub on radar_items(published_at desc nulls last);
create index if not exists radar_items_plat_pub on radar_items(platform, published_at desc nulls last);
create index if not exists radar_items_disc on radar_items(discovered_at desc);

create table if not exists radar_hits (
  item_id     bigint not null references radar_items(id) on delete cascade,
  keyword_id  bigint not null references radar_keywords(id) on delete cascade,
  matched_on  text not null default 'text',    -- title|text|tag|search(엔진A 쿼리 자체가 키워드)
  primary key (item_id, keyword_id)
);
create index if not exists radar_hits_kw on radar_hits(keyword_id, item_id desc);

-- Vercel 수신함: WebSub/웹훅 페이로드를 원문 그대로 적재, Mac 워커가 다음 사이클에 처리
create table if not exists radar_inbox (
  id          bigint generated always as identity primary key,
  channel     text not null,                   -- websub-youtube|apify|inoreader|...
  payload     jsonb not null,
  received_at timestamptz not null default now(),
  processed   boolean not null default false
);
create index if not exists radar_inbox_unproc on radar_inbox(processed, id) where not processed;

-- 런 장부(헬스+비용)
create table if not exists radar_runs (
  id          bigint generated always as identity primary key,
  engine      text not null,                   -- jetstream|fedibuzz|feedpool|gdelt|wpcom|hn|medium|x|threads|serper|youtube|websub-renew|inbox
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  items_seen  int default 0,
  items_new   int default 0,
  hits        int default 0,
  cost_usd    numeric(10,4) default 0,
  errors      jsonb not null default '[]'::jsonb
);
create index if not exists radar_runs_recent on radar_runs(engine, started_at desc);
```

**설계 노트**:
- 중복 제거는 **DB가 정본**: `url_hash` unique + `Prefer: resolution=ignore-duplicates` upsert. hourly의 seen.json(로컬·7일 휘발) 방식 금지 — 레이더 이력은 영구·페이지 공급용.
- URL 정규화: 소문자 호스트, `utm_*`·`fbclid`·`igsh` 등 트래킹 파라미터 제거, 프래그먼트 제거, 말미 `/` 정리 → sha256. Google News 리다이렉트 토큰(`news.google.com/rss/articles/CBMi...`)은 **리다이렉트를 따라가 실제 URL로 풀어서** 해시.
- `radar_hits`는 다대다: 한 아이템이 여러 키워드에 걸릴 수 있음(예: "Scorsese on Kubrick" 글).
- PostgREST 타임스탬프 필터는 **Z 포맷 필수**(`%Y-%m-%dT%H:%M:%SZ`) — `+00:00`의 `+`가 쿼리스트링에서 공백으로 디코드되어 HTTP 400 (Now Playing에서 실제 장애 전례).
- 1000행 캡: 어드민 페이지·워커 조회 모두 `limit`/`offset` 페이징 또는 기간 필터로 1000행 미만 유지.

---

## 5. 매처 — Aho-Corasick + 문맥 게이트

파일: `radar/matcher.py` — **순수 파이썬 stdlib** Aho-Corasick 구현(~100줄; 하우스 규칙 pip 금지 준수). 처리량 근거: Jetstream ~53포스트/초 × ~300B = 15KB/s, 피드풀 시간당 수십 MB — 순수 파이썬으로도 충분. (만약 병목이 실측되면: 문서화된 일탈로 venv+pyahocorasick 허용, 이 문서에 기록할 것.)

**규칙 — poller.py의 검증된 패턴 계승**:
1. 정규화: `norm(s) = re.sub(r"[^a-z0-9 ]+"," ",s.lower()).strip()` — 키워드와 본문 동일 적용. 오토마톤 패턴은 ` {norm} ` 패딩으로 **단어 경계** 보장.
2. **문맥 게이트**: `require_context=true`인 키워드(제목 12자 미만 또는 단일 토큰 — 예: "Her", "Jaws", "Persona", "Burning", "Stalker")는 본문에 영화 문맥어(`film|movie|director|cinema|review|trailer|criterion|a24|screening|봉준호식 CONTEXT_WORDS 정규식 — poller.py에서 복사+`letterboxd|mubi|criterion` 추가`)가 함께 있거나, 소스의 `beat='film'`(영화 전문 피드/서브레딧/채널)일 때만 히트로 인정. **이 게이트가 없으면 오탐으로 피드가 즉사한다** (hourly 전례: 'cs2 update'→Mirage 1965 오탐).
3. `aliases`도 오토마톤에 등록(한글 별칭 포함 — 예: "화양연화"). 비ASCII는 정규화에서 유실되지 않게 `norm()`을 한글 보존형으로 확장: `re.sub(r"[^\w\s]+"," ",s.lower(), flags=re.UNICODE)`.
4. 오토마톤은 프로세스 기동 시 `radar_keywords(active=true)`에서 빌드, **10분마다 리로드**(상주 프로세스), 폴러는 런마다 빌드.
5. 히트 기록: `matched_on` = `title`(제목 히트) > `text`(본문) > `tag`(태그 매칭) > `search`(엔진 A 쿼리 자체). 엔진 A 결과도 **반드시 본문 재매칭**으로 어느 키워드였는지 어트리뷰션(OR배치 쿼리는 어떤 키워드가 맞았는지 API가 알려주지 않음).

---

## 6. 소스 어댑터 사양

각 어댑터는 `radar/poll_*.py`(또는 `.mjs`) 하나씩. **공통 규칙**: 모든 소스는 옵셔널·fail-soft(3연속 실패 → ledger 경고, 나머지 계속), 런마다 `radar_runs` 기록, 유료는 `radar/usage.jsonl`에 실비 로깅.

**UA 정책 (중요)**: 공손 소스(RSS·GDELT·WP.com·HN·oEmbed)는 정본 `MetatakeBot/1.0 (+https://metatake.net/bot)` 사용. **ToS-회색 경로는 절대 MetatakeBot UA·우리 브랜드를 싣지 않는다** — X/IG/Threads 스크레이핑은 전부 제공자 측(twitterapi.io/Apify)이 자기 인프라에서 수행하게 하고 우리는 그들의 API만 호출. 직접 스크레이핑(InnerTube 등)은 Phase 0에서 배제.

### 6.1 Tier S — $0 백본 (Phase 0 필수)

#### A. Bluesky Jetstream — 앵커 스트림 (라이브 검증: 5초에 279 이벤트, 무인증)
- **엔드포인트**: `wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post` (공개 인스턴스 4개, 무인증·무키). zstd 압축 옵션 시 포스트 전용 ~25.5GB/mo.
- **구현**: `radar/ingest_jetstream.mjs` — **Node 22 내장 WebSocket** 사용(stdlib 파이썬에 웹소켓 없음; node는 `~/.local/node/bin/node`, PATH에 없음 주의). 상주 프로세스: 이벤트 `commit.operation=create` && `collection=app.bsky.feed.post` → `record.text` 매칭 → 히트만 배치 upsert(5초 또는 50건마다). URL 구성: `https://bsky.app/profile/{did}/post/{rkey}`. 작성자 핸들은 지연 해석: `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={did}` (캐시; **searchPosts는 public.에서 403이지만 getProfile은 200 — 검증됨**).
- **재연결**: `time_us` 커서 저장, 재접속 시 커서−5초로 리와인드(갭 방지). 24h 리플레이 창 있어 재시작 안전.
- **키워드 매칭**: Node 쪽에 간단한 소문자 `includes` + 단어경계 정규식 사전 컴파일(10k에서도 OK) 또는 히트 후보만 Python 매처로 재검증. 동음이의 제목은 문맥 게이트 적용.
- **백필/검증용 검색**: `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q={kw}&sort=latest&since={ISO}` — 현재 무인증 200(검증). 단 **비공식 동작**: public.api.bsky.app에서는 이미 403으로 잠김 — 언제든 막힐 수 있으니 앱패스워드 인증 폴백 코드를 함께 구현.
- **비용**: $0. 10k에서도 $0(스트림 크기는 키워드 무관).

#### B. RSS 피드풀 — Substack·WordPress·Ghost·Medium·기존 fleet (라이브 검증: 전 플랫폼 MetatakeBot UA에 200)
- **구현**: `radar/poll_feeds.py` — `radar_sources(kind='feed')` 전체를 시간당 폴링. 조건부 GET(**WP는 If-Modified-Since 304, Ghost는 If-None-Match 304 검증됨**; Medium은 검증자 없음·15KB 전체 재수신; Substack `/feed`는 ~689KB로 비대 + ETag가 CDN 노드 간 드리프트 → **Substack은 RSS 대신 `https://{pub}.substack.com/api/v1/archive?sort=new&limit=12` JSON(~20KB) 사용, 검증됨**). 동시성 16~32, 호스트당 1rps, 실패 무시.
- **초기 시드 (~500피드)**: ① hourly fleet 12개(beat 태그 유지) ② 영화 전문지·비평 블로그 수동 큐레이션(~50: Senses of Cinema, MUBI Notebook, Reverse Shot, Film Comment, davidbordwell.net, …) ③ **Substack 발견 크롤**: `https://substack.com/api/v1/categories`(Culture=id 96) → `/api/v1/category/public/96/all?page=N`(퍼블리케이션 목록+도메인, 무인증 검증됨) + 각 퍼블리케이션 `/recommendations` 그래프 크롤 → 영화/문화 서브스택 ~300 ④ Medium 브로드 태그 20개(`medium.com/feed/tag/{film,movies,cinema,film-criticism,filmmaking,screenwriting,...}` — **15분 주기**: 10아이템 창이라 놓침 방지) ⑤ 엔진 A 발견분 자동 편입.
- **⚠️ Substack 글로벌 검색은 죽었다(검증)**: `substack.com/api/v1/post/search`는 익명 클라이언트에 200+빈배열, 웹 검색은 로그인 장벽. 세션 쿠키 스크레이핑 금지(밴 리스크·무가치) — 풀+로컬매칭으로 동일 결과 달성. 단 **퍼블리케이션 단위 백필**은 가능: `/{pub}/api/v1/archive?sort=new&search={kw}` (검증됨) — 신규 키워드 등록 시 과거분 수집용.
- **자기소개 WP 검색피드**: `{site}/?s={kw}&feed=rss2` (davidbordwell.net 검증) — 신규 키워드 백필 전용, 정기 폴링 금지(robots의 `?s=` disallow 존중).
- **WebSub 오버레이**: 피드가 `rel=hub` 광고하면(wp.com `?pushpress=hub`·Blogger) 구독해 푸시 전환, 해당 피드는 6h 저속 폴로 강등. Medium의 superfeedr 허브는 죽은 것으로 취급(신뢰 금지).
- **비용**: $0. 10k 스케일: 피드 10k~30k개 — Mac 1대가 시간당 폴링에 15~25분, 0.5~1GB/h. 여전히 $0.

#### C. GDELT DOC 2.0 — 뉴스·블로그 웹 백본 (라이브 검증: timespan=6h 신선 기사 반환)
- **엔드포인트**: `https://api.gdeltproject.org/api/v2/doc/doc?query="{kw}"&mode=artlist&format=json&timespan=90m&maxrecords=50&sort=datedesc` — 무키·무료, 15분 인덱스.
- **구현**: `radar/poll_gdelt.py` — 시간당 전 키워드 순차 스윕. **간격 10초**(공식 안내는 5초지만 검증 결과 공유 IP에서 스로틀이 5초를 초과 지속 — 적응형 백오프 필수), 100kw × 10s ≈ 17분/스윕. 스로틀 응답은 **JSON이 아닌 평문 텍스트** — 파싱 예외 처리 필수. 정본 UA 필수. 다중어 키워드는 반드시 따옴표 인용.
- **주의**: `seendate`는 발행시각이 아니라 **크롤 시각** — `published_at`으로 쓰되 `meta.ts_kind='seen'` 표기. author 없음 → `domain`을 author로. `timespan=90m`로 겹침 창을 두고 url_hash로 dedup.
- **비용**: $0. 10k: 키워드별 불가(레이트 초과) → OR배치(쿼리당 10~15개) 또는 15분 원시 업데이트 파일 벌크 인제스트로 전환(§11).

#### D. YouTube — WebSub 채널풀(백본) + 무료 검색(발견)
- **채널 RSS/WebSub (무키·무쿼터)**: 토픽 `https://www.youtube.com/feeds/videos.xml?channel_id={UC...}`, 허브 `https://pubsubhubbub.appspot.com/subscribe` (공식 가이드 2026-06-01 갱신 — 살아있음, 검증). 리스 최대 10일 → **5일령 재구독 데일리 루프**(`radar/websub_renew.py`). 콜백: `/api/radar/websub`(§7). 푸시 누락 대비 **일 1회 채널 RSS 스윕**으로 정합.
- **채널풀 시드**: 첫 주간 무료 검색쿼터(아래)로 검색 결과의 `channelId` 수확 → 영화 에세이·비평·트레일러 채널 ~1,000개 등록. 이후 발견 플라이휠로 성장.
- **공식 검색 (발견용)**: `GET https://www.googleapis.com/youtube/v3/search?q="{kw}"&type=video&order=date&publishedAfter={ISO}` — **2026년 7월 쿼터 체계(검증): search.list는 별도 버킷 100콜/일**(구 "100유닛/콜" 정보는 전부 스테일). 핫 키워드 25개/6h 로테이션으로 운용. **Day 1에 무료 쿼터 확장 감사 신청**(YouTube API Audit and Quota Extension Form — 정당한 퍼블리셔 유스케이스, 수 주 소요). **프로젝트 샤딩으로 쿼터 우회는 명시적 ToS 위반 — 금지.**
- **⚠️ 검증된 함정**: YouTube 검색의 날짜 **정렬**이 2026년 초 고장(yt-dlp가 2026.02.21 릴리스에서 ytsearchdate 제거 — 검증). `order=date`+`publishedAfter` 결과가 불완전할 수 있음 → 빌드 첫 주에 "Last hour 필터 프로브"(같은 키워드를 API와 SerpApi youtube 엔진으로 교차 확인) 1일 실험을 수행하고 결과를 이 문서에 기록.
- **비용**: $0 (쿼터 확장도 무료). 발견 보강 필요 시: SerpApi youtube 엔진(sp=EgIIAQ%3D%3D 최근 1시간 필터 패스스루) — 오너의 SerpApi 계정 활용.

#### E. WordPress.com Reader 검색 — WP 세계 커버+발견 (라이브 검증: 무인증·sort=date·20건 캡)
- **엔드포인트**: `GET https://public-api.wordpress.com/rest/v1.2/read/search?q="{kw}"&sort=date&number=20` — 무인증, 최신순, **number>20은 400**(검증).
- **구현**: `radar/poll_wpcom.py` — 시간당 100 키워드(2,400req/일 ≈ 0.03rps, 안전). 직전 최신 아이템 날짜에서 스톱(after= 파라미터 없음). 히트 사이트의 `/feed`를 피드풀에 자동 편입.
- **커버리지 한계(검증)**: wp.com 공개 사이트 + **유료 Jetpack** 연결 사이트만(Enhanced Distribution은 2024-04 제거) — 무료 Jetpack·독립 WP는 안 보임 → 피드풀·Serper가 보완.
- **비용**: $0.

#### F. Hacker News — Algolia (라이브 검증: 무인증, IP당 10k req/h)
- **엔드포인트**: `https://hn.algolia.com/api/v1/search_by_date?tags=(story,comment)&numericFilters=created_at_i>{cursor}&hitsPerPage=1000` — **벌크 커서 모드**(쿼리 없이 전체 신규 수집: HN 전체가 일 8~12k 아이템이라 15분에 1~2요청이면 전량) → 로컬 매칭.
- **구현**: `radar/poll_hn.py` — 15분 주기, 커서는 `radar_sources.meta`에 저장. 퍼머링크 `news.ycombinator.com/item?id={objectID}`.
- **비용**: $0. 10k에서도 동일(벌크+로컬매칭).

#### G. Mastodon — fedi.buzz SSE (라이브 검증: 무인증, ~5-8 status/s)
- **엔드포인트**: `https://fedi.buzz/api/v1/streaming/public` (SSE `event: update` + Mastodon status JSON).
- **구현**: `radar/ingest_fedibuzz.mjs` — Node fetch 스트리밍 상주. `content`의 HTML 태그 제거 후 매칭. **brid.gy 브리지된 Bluesky 포스트가 섞임 → url_hash dedup이 자연 처리.**
- **리스크**: 기부 운영 단일 서비스(SLA 없음) — 죽으면 self-host(`astro/buzzrelay`) 또는 대형 인스턴스 3~4곳 `/api/v1/timelines/public` since_id 폴링(무인증 300req/5min/IP 검증)으로 폴백. 마스토돈 문화 존중: `noindex`/`discoverable=false` 계정 제외, 전문 재게시 금지(스니펫만).
- **비용**: $0.

### 6.2 Tier A — 🔒 전부 Phase 1 보류 (오너 확정 2026-07-12: Phase 0 무료 전용·Threads 제외)

**빌더 지시: 아래 H·I·J는 Phase 0에서 구현·결제·신청 금지.** 스펙은 Phase 1 재승인 시를 위해 보존. 특히 **I(Threads)는 오너가 명시적으로 제외** — 무료·앱 리뷰 경로 포함 전부 하지 않는다.

#### H. X(트위터) — twitterapi.io (비공식 리셀러; 공식 API는 §17 참조 — pay-per-use만, 100kw에 ~$300/mo)
- **결정 근거**: 공식 X API는 2026-02부터 pay-per-use($0.005/포스트 읽기)가 유일한 셀프서브이고 100kw에 ~$300/mo, 10k는 월 2M 읽기 하드캡으로 불가(검증). twitterapi.io는 동일 데이터 ~$0.00015/트윗(33분의 1), 100kw에 **~$10-20/mo**. ToS-회색(리스크는 제공자 부담)이지만 대체 불가 가격 — **오너 결정 사항 §14-1**.
- **엔드포인트**: `GET https://api.twitterapi.io/twitter/tweet/advanced_search?queryType=Latest&query=...` — 헤더 `X-API-Key`. 선불 크레딧($1=100k credits, $0.10 무료 체험).
- **구현**: `radar/poll_x.py` — 시간당: 키워드 15개씩 따옴표 OR배치(쿼리 <400자 유지) = 7쿼리 + `since_time:{unix}` 워터마크(**`since:..._UTC` 날짜 포맷은 명시적 미지원 — unix만, 검증**) + `-filter:retweets`. 응답 `url/text/createdAt/author.userName` → 스키마 1:1. 로컬 재매칭으로 키워드 어트리뷰션.
- **⚠️ QPS(검증·정정)**: 잔액 기반 티어 — 1k+크레딧 3QPS, 10k+ 10QPS, 50k+ 20QPS ("200QPS"는 낭설). 시간당 7쿼리엔 무관.
- **핫스페어**: socialdata.tools 계정을 **지금** 개설(검색 엔드포인트가 'Limited Access' — 이메일 활성화 선요청, $0.0002/트윗). 리셀러는 예고 없이 죽을 수 있으니 페처를 인터페이스 뒤에 두고 이중화.
- **비용**: ~$10-20/mo. 10k: ~$300-1,000/mo(트윗 볼륨 지배; §11 티어링).

#### I. Threads — 공식 keyword_search (Meta 유일의 진짜 1시간 신선도, $0)
- **엔드포인트(검증)**: `GET https://graph.threads.net/v1.0/keyword_search?q={kw}&search_type=RECENT&since={unix}&fields=id,text,permalink,timestamp,username,media_type&limit=50&access_token=...`
- **쿼터(검증)**: 유저당 24h 롤링 2,200쿼리. **빈 결과 쿼리는 카운트 안 됨** — since=직전폴 워터마크면 롱테일 키워드 대부분 빈 결과 = 무료. 100kw를 90분 주기로 돌리면 실카운트는 한참 아래.
- **선행 조건**: Meta 앱 생성 + `threads_basic`+`threads_keyword_search` 권한 **앱 리뷰**(스크린캐스트+유스케이스; 1~4주). 승인 전엔 자기 계정 포스트만 검색됨. **⛔ 오너 확정(2026-07-12): Threads 제외 — 앱 리뷰 제출 금지. 재론 시에만 이 스펙 사용.**
- **브리지(승인 대기 중)**: Apify `themineworks/threads-scraper`($1.00/1k, resultType=recent, 0결과 무과금) — Apify 프록시에서 실행되어 우리 브랜드 무관. 승인되면 즉시 공식으로 교체.
- **함정**: 민감 키워드는 조용히 빈 배열; 90일마다 재인증(장기 토큰 갱신 루프 필요); 다계정 쿼터 풀링은 ToS-회색 — Phase 0은 단일 계정.
- **비용**: $0 (브리지 기간만 ~$30-90/mo).

#### J. Google 표면(비뉴스 웹: 개인 사이트·포럼 등) — Serper.dev
- **엔드포인트**: `POST https://google.serper.dev/news` 및 `/search`, body `{"q":"\"{kw}\"","tbs":"qdr:h6","num":20}` — tbs=qdr:h(1시간)/qdr:h6 패스스루(검증).
- **구현**: `radar/poll_serper.py` — 6시간 주기 100kw 스윕 = 12k쿼리/mo. 선불 $50=50k크레딧($1/1k, 6개월 유효) → **월 ~$12 소진**. 신규 계정 무료 2,500쿼리로 tbs 동작을 먼저 검증.
- **역할**: GDELT가 못 보는 비뉴스 표면(개인 블로그·포럼·소규모 사이트) + 발견(새 도메인→피드풀). SerpApi(오너 기존 계정, Starter $25=1,000/mo로 축소됨 — 검증)는 QA·스팟체크 용도로 유지.
- **비용**: ~$12/mo. 10k: 티어링으로 ~$250-410/mo(§11).

### 6.3 Tier B — 옵션 (전부 보류; 오너 재승인 후에만)

- **K. Reddit** — 공식 OAuth 무료 티어(100QPM/클라이언트, 검증): 영화 서브레딧 ~50개 `/new`+`/comments` 5분 폴링(~20QPM) + 로컬 매칭. **⚠️ 무료 티어는 비상업 라이선스**(상업 사용은 레딧 승인 필요 — Data API Terms §3 검증) — metatake는 상업 사이트이므로 **오너의 명시적 리스크 결정(§14-3) 전 구현 금지**. UA는 `macos:net.metatake.radar:v1.0 (by /u/{오너계정})` 형식 필수.
- **L. Instagram** — 공식 해시태그 API는 실사용 불가(30 유니크 해시태그/7일 + **username 필드 반환 금지** 검증 — author 스키마 붕괴). 유일 경로: Apify `apify/instagram-scraper`(해시태그 모드 + `onlyPostsNewerThan={ISO}`, $2.30/1k, ownerUsername 포함) — 해시태그화 가능한 키워드 서브셋만, 6h 주기 ~$60-320/mo. **§14-4.**
- **M. 무료 보강 3종**: Google Alerts→RSS(상위 30키워드, 'As-it-happens'+RSS 전달 — 발견용, 지연 비결정적), Tumblr `/tagged` API(태그형 키워드 30~50개, 무료 5k/일), feedle.world(블로그 검색 RSS — 신생 서비스, 발견용).

### 6.4 배제 목록 (검증된 이유와 함께 — 재조사 금지)

| 후보 | 배제 이유 (2026-07-12 검증) |
|---|---|
| Bing Search/News API | **2025-08-11 은퇴, 410 Gone.** 대체품 'Grounding with Bing'은 SERP JSON 미반환 |
| Google Programmable Search | **신규 고객 차단 + 2027-01-01 서비스 종료.** dateRestrict도 일 단위뿐 |
| NewsAPI.org 무료 | 24시간 지연 — 용도 자체가 성립 안 함. 실시간은 $449/mo |
| Facebook | 공식 경로 전무: CrowdTangle 사망(2024-08), Meta Content Library는 **비영리 전용**(상업 부적격 검증), 페이지 RSS 2015년 제거. 스크레이핑은 Meta 최고 소송 리스크 — Phase 0 배제, 필요 시 큐레이션 페이지 벌크(Apify $2/1k)만 |
| TikTok / Pinterest / Discord | Research API 학술 전용 / 자기계정 데이터만 / 전역 검색 API 없음 |
| Nitter | 공개 인스턴스 사실상 전멸, 자체 호스팅은 본인 계정 밴 리스크 |
| RSSHub의 X/IG/Threads 라우트 | X는 토큰 로그인+상시 파손, IG 밴 리스크, Threads "거의 사용 불가"(메인테이너) — 관리 부담이 우리 것이 됨 |
| Brand24/Mention/Talkwalker | 키워드당 $8-66/mo 요금 구조 — 100kw에 $600-2,400/mo, 엔트리 티어는 12h 갱신(요건 미달). 10k는 $80k+/mo |
| Feedly | 개인 API 토큰은 **비상업 전용**(ToS 위반이 됨), 상업은 엔터프라이즈 $1,600+/mo |
| Superfeedr Trackers | 키워드당 $2/mo(100kw=$200) + 2016년부터 유지보수 모드 — 가격·수명 둘 다 탈락 |
| Inoreader Pro | $7.50/mo로 훌륭하지만 모니터링 피드 30개 한계 + API 100req/일 — 자체 피드풀이 이미 상위호환. 웹훅 푸시가 꼭 필요해지면 재고 |

---

## 7. 워커 구성 (Mac + Vercel)

### 7.1 디렉토리 구조

```
radar/
  README.md                # 1행에 정본 포인터 헤더: "> 📍 정본: HANDOFF-키워드레이더.md — 작업 전 먼저 읽으세요."
  0083_keyword_radar.sql
  radar-watch.sh           # 상주 워처 (아래)
  common.py                # sys.path.insert(0,"hourly") 후 pipeline.common 재수출 + radar 전용 헬퍼(url 정규화·url_hash·upsert_items)
  matcher.py               # §5 Aho-Corasick + 문맥 게이트
  seed_keywords.py         # §10 키워드 100개 시드 (entities.json + 큐레이션)
  seed_feeds.py            # §6.1-B 피드풀 시드 (fleet + 큐레이션 + Substack 카테고리 크롤)
  ingest_jetstream.mjs     # 상주 (Node 22 내장 WebSocket)
  ingest_fedibuzz.mjs      # 상주 (Node fetch SSE)
  poll_feeds.py            # 시간당
  poll_gdelt.py            # 시간당
  poll_wpcom.py            # 시간당
  poll_hn.py               # 15분
  # (Phase 1 보류 — Phase 0에서 만들지 않음: poll_x.py / poll_serper.py. Threads는 제외 확정)
  poll_youtube_search.py   # 6시간 (핫 25kw 로테이션, 무료 쿼터)
  websub_renew.py          # 일 1회 (5일령 리스 재구독)
  process_inbox.py         # 매 사이클 (radar_inbox 미처리분 → 파싱·매칭·적재)
  state/                   # 스트림 커서 등 로컬 상태 (Jetstream time_us, HN cursor는 DB에)
  ledger.md                # 사람용 장부 (소스 헬스 경고·일일 요약)
  usage.jsonl              # 유료 API 실비 로그 (_log_usage 패턴)
```

### 7.2 radar-watch.sh — 상주 워처 (launchd/cron 금지: TCC가 ~/Documents 차단, 검증된 하우스 제약)

`hourly/now-playing-watch.sh` 패턴 그대로: pidfile 가드(`radar/.watch.pid`) + `radar/HOLD` 킬스위치 + 이중 기동 무해. 기동은 터미널에서 `nohup radar/radar-watch.sh >> radar/cron.log 2>&1 &` (재부팅 후 수동 재기동 — ledger에 기록).

```bash
#!/bin/bash
# radar-watch.sh — 정본: HANDOFF-키워드레이더.md §7
cd "$(dirname "$0")"
[ -f .watch.pid ] && kill -0 "$(cat .watch.pid)" 2>/dev/null && exit 0
echo $$ > .watch.pid
NODE=~/.local/node/bin/node
ensure() {  # $1=pidfile $2=cmd... : 상주 스트림 소비자 감시·재기동
  if ! { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }; then
    shift1="$1"; shift; nohup "$@" >> cron.log 2>&1 & echo $! > "$shift1"
  fi
}
while true; do
  [ -f HOLD ] && { sleep 60; continue; }
  ensure .jetstream.pid "$NODE" ingest_jetstream.mjs
  ensure .fedibuzz.pid  "$NODE" ingest_fedibuzz.mjs
  M=$(date +%M); H=$(date +%H)
  [ "$M" = "05" ] && { python3 poll_feeds.py; python3 poll_gdelt.py; python3 poll_wpcom.py; }
  case "$M" in 00|15|30|45) python3 poll_hn.py; python3 process_inbox.py;; esac
  [ "$M" = "10" ] && case "$H" in 00|06|12|18) python3 poll_youtube_search.py;; esac
  [ "$M" = "30" ] && [ "$H" = "09" ] && python3 websub_renew.py
  # Phase 1 재승인 시 이 자리에 poll_x.py(시간당)·poll_serper.py(6h) 추가
  sleep 55
done
```
(빌더 주: 위는 골격 — 분기 정확성보다 "poll_*.py는 각자 내부에서 '마지막 실행 시각' 가드를 갖는다"가 원칙. 각 폴러는 시작 시 radar_runs에서 자기 엔진의 최근 started_at을 읽어 주기 미달이면 즉시 종료하게 구현하면 워처 분기는 단순해진다. 또한 모든 폴러에 파일락(`fcntl.flock`)으로 이중 실행 방지.)

### 7.3 Vercel 라우트

- **`app/api/radar/websub/route.ts`**: GET → `hub.challenge` 에코(구독 검증). POST → Atom XML 원문을 `radar_inbox(channel='websub-youtube', payload={xml})`에 service-role insert 후 즉시 200 (파싱은 Mac의 `process_inbox.py`가 수행 — 콜백은 빨라야 함). URL에 `?key={RADAR_WEBSUB_SECRET}` 요구.
- **(옵션) `app/api/radar/apify/route.ts`**: Apify 웹훅 수신 → inbox 적재 (Threads 브리지·IG 켤 때).
- `vercel.json`은 건드리지 않는다(크론 불필요 — 수집은 전부 Mac·푸시). **라우트 파일은 app/ 아래라 워처가 자동 커밋하지만, radar/·vercel.json·마이그레이션·이 문서는 수동 커밋** (하우스 규칙).

---

## 8. 피드 UI — /admin/radar

하우스 admin 관례 그대로 (참조 구현: `app/admin/crawlers/page.tsx`):
- `middleware.ts`의 기존 /admin 게이트(변경 불필요) + 페이지에서 `getAdminUser()` → 없으면 `notFound()`.
- `export const dynamic = "force-dynamic"`, `createAdminClient()`(service-role)로 직접 select. **인라인 React 스타일만**(CSS 파일 금지 — 워처 레이스 원천 회피).
- `app/admin/layout.tsx`의 `NAV_ITEMS`에 `{ href: "/admin/radar", label: "Radar" }` 추가. robots noindex는 레이아웃이 처리.

**URL 상태 (서버 searchParams — useSearchParams 금지, 스크리너 전례)**:
`/admin/radar?w=1h|6h|24h|7d&platform=x|bluesky|...&kw={keyword}&q={텍스트검색}`

**화면 구성**:
1. 상단 요약 스트립: 시간창 내 플랫폼별 건수 배지(클릭=필터), 총 히트/신규 소스 수, 마지막 수집 시각(엔진별 radar_runs 최근 행 — 워처 생존 확인용).
2. 피드 리스트(기본 `w=6h`, `published_at desc`, 100건 페이징): 카드 = 플랫폼 배지 · author(→author_url) · title · snippet · 매칭 키워드 칩들(radar_hits 조인, 클릭=kw 필터) · published_at 상대시각 · 원문 링크(target=_blank rel=noopener). 쿼리는 `radar_items` + `radar_hits`/`radar_keywords` 조인, 기간 필터로 1000행 캡 회피.
3. 키워드 드릴다운(`kw=` 지정 시): 해당 키워드의 최근 히트 타임라인 + 플랫폼 분포.
4. 소스 헬스 탭(`?tab=sources`): radar_sources를 fail_count desc — 3+ 빨강.
5. Phase 1에서 클릭-투-로드 임베드(§9) — Phase 0은 카드만으로 수용 기준 충족.

---

## 9. 표시·임베드·법적 규범

**저장 원칙 (검증된 애그리게이터 표준)**:
- `content_text`(전문)는 **내부 매칭 전용** — 공개 렌더 절대 금지. (Feedly/Inoreader와 동일 관행; EU TDM Art.4는 기계가독 옵트아웃 존중 시 인덱싱 허용 — robots·`noai`·TDMRep(`tdmrep.json`) 신호를 fetch 단계에서 존중.)
- 공개 표시는 **카드 봉투**: 제목(원문 그대로) + author + 플랫폼 + 시각 + **스니펫 ≤300자(문장 경계에서 절단)** + 눈에 띄는 원문 링크. Google News가 2019년 이후 규제 통과한 관행의 미러.
- 삭제 존중: Phase 1에 나이틀리 스위퍼(캐시 임베드 샘플 재요청 → 404 소스는 카드 킬) — 공개 전환 시 필수.
- 썸네일: **서명 CDN URL(cdninstagram·tiktokcdn) 원본 저장 금지**(수 시간~수 일 내 만료 검증) — 인제스트 시 Supabase Storage에 영속화하거나 생략. i.ytimg.com·substackcdn은 안정적이나 next/image remotePatterns 프록시 경유.

**플랫폼별 표시 전략 (전 엔드포인트 2026-07-12 라이브 검증)**:

| 플랫폼 | 전략 | 근거 |
|---|---|---|
| X | 카드 → 클릭 시 oEmbed 임베드 | `publish.x.com/oembed` 무토큰 200, cache_age≈100년 → **embed_html을 인제스트 시 DB 캐시** |
| YouTube | 카드 → 클릭 시 `youtube-nocookie.com/embed/{id}` iframe | 스크립트 불필요·가장 저렴. oEmbed는 메타데이터용 |
| Bluesky | **자체 카드 완전체**(AppView JSON) 또는 `embed.bsky.app/embed/{did}/...` 무스크립트 iframe | 서드파티 JS 0 가능 — 최우수. `!no-unauthenticated` 라벨 존중 |
| Threads | 카드 → 클릭 시 oEmbed | `graph.threads.net/v1.0/oembed` 무토큰 200 검증(보장은 아님 — 앱 토큰 폴백 구현) |
| Instagram | 카드 우선 | oEmbed 토큰 요구가 유동적(교차 검증 상충) + **2025-11부터 Meta oEmbed 전체에서 thumbnail_url·author_name 제거(검증)** — 앱 토큰 폴백 필수, 기대치 낮게 |
| Reddit | 자체 카드(제목+점수+서브레딧) | oEmbed는 **post-ID 기준 해석**(잘못된 slug도 조용히 다른 포스트 반환 — 함정) |
| Mastodon | 자체 카드 | 인스턴스 도메인이 무한 → frame-src 화이트리스트 불가능 |
| Substack/WP/블로그 | 자체 카드 + og:image | **Substack은 oEmbed 없음(검증)**; WP oEmbed는 임의 오리진 iframe이라 CSP-적대적 |

**CSP**: 임베드용 script-src/frame-src 완화는 **/admin/radar(추후 /radar) 라우트에만** next.config headers 매칭으로 한정. X는 platform.x.com **과** platform.twitter.com 둘 다(302 체인 검증), TikTok은 `*.ttwstatic.com`까지. 초기 페인트는 항상 퍼스트파티 카드만(클릭-투-로드) — 기본 CSP 불변+GDPR 제스처 겸용.

---

## 10. Phase 0 샘플 100 키워드

`radar/seed_keywords.py`가 아래 큐레이션 47개(엔티티 검증됨)를 하드코딩 + `hourly/poller/entities.json`에서 53개 보충해 100개 시드.

**큐레이션 47** (kind, require_context 표기):
- 영화 20 — In the Mood for Love (2000) · Mulholland Drive (2001) · Parasite (2019)⚠ · Melancholia (2011)⚠ · Stalker (1979)⚠ · Persona (1966)⚠ · Oldboy (2003)⚠ · Chungking Express (1994) · The Zone of Interest (2023) · Burning (2018)⚠ · Aftersun (2022)⚠ · Portrait of a Lady on Fire (2019) · Come and See (1985)⚠ · Paris, Texas (1984)⚠ · Anatomy of a Fall (2023) · Memories of Murder (2003) · Decision to Leave (2022) · Poor Things (2023)⚠ · La Haine (1995)⚠ · Perfect Days (2023)⚠  (⚠=require_context: 12자 미만·일반어구 — 문맥 게이트 필수. match_text는 연도 괄호 제거형)
- 감독 12 — Hong Sang-soo · Martin Scorsese · Alfred Hitchcock · Akira Kurosawa · Jean-Luc Godard · Ingmar Bergman · Pedro Almodóvar · Werner Herzog · Richard Linklater · Spike Lee⚠ · Stanley Kubrick · Im Kwon-taek
- 이론가 12 — Laura Mulvey · Gilles Deleuze · André Bazin · Siegfried Kracauer · Walter Benjamin · Susan Sontag · Slavoj Žižek · Sergei Eisenstein · David Bordwell · Mark Fisher⚠ · (+ Jacques Rancière · bell hooks)
- 무브먼트/개념 5 — French New Wave · Italian Neorealism · Dogme 95 · auteur theory · male gaze

**보충 53 선정 규칙 (entities.json)**: films에서 `analyzed=true` && `len(norm(title))≥12` && 다단어 우선(고유성) 30편 + directors에서 films 수 상위·2단어 이상 15명 + theorists에서 **2단어 이상·괄호 없음 필터**(복합표기 오염 — 하우스 함정) 8명. 시드 후 `radar/ledger.md`에 100개 목록 기록. 별칭: 한국영화는 한글 제목을 aliases에 추가(예: Parasite→기생충, Oldboy→올드보이, Burning→버닝).

**티어 초기값**: 감독·최근작(2022+)=hot, 고전 영화·이론가=warm, 나머지=cold. 첫 2주 히트율로 재조정(§11의 승격/강등 규칙).

---

## 11. 10,000 키워드 스케일 플랜

(아래 4번의 유료 어댑터 티어링은 전부 **Phase 1 재승인 전제** — 무료 전용 확정 하에서는 1~3번 + GDELT·WP.com 티어링만으로도 10k 확장 자체는 성립한다. 커버리지가 뉴스·블로그·Bluesky·YouTube 중심으로 좁아질 뿐.)

**불변**: 엔진 B는 코드 변경 없이 그대로 — 오토마톤만 커진다(10k 패턴 ≈ 수십 MB RAM, 빌드 <1s). 확장 작업은 4가지뿐:

1. **피드풀 성장**: 500 → 10k~30k 피드 (발견 플라이휠 + Substack 추천 그래프 크롤 + Serper 발견분). Mac 1대 시간당 폴링 15~25분, 대역 0.5~1GB/h — 여전히 $0. 폴러를 asyncio 동시성 32로 리팩터.
2. **YouTube 채널풀 성장**: 1k → 30k~80k 채널 WebSub (리스 갱신 3~8k POST/일 — 워커에 무해). 키워드 검색은 발견 루프로 강등(승인 쿼터 or SerpApi Production $150/mo에서 키워드당 월 1.5회).
3. **GDELT 벌크 전환**: 키워드별 쿼리(레이트 초과) → OR배치(10~15개/쿼리) 또는 **15분 원시 업데이트 파일/Web NGrams 벌크 인제스트 + 로컬 매칭** ($0 유지).
4. **엔진 A 티어링** — 케이던스로 비용 제어: hot 500(1h) / warm 2,000(6h) / cold 7,500(24h) ≈ 27.5k 쿼리/일.
   - X twitterapi.io: OR배치 667쿼리/사이클 — 볼륨 지배 시 ~$300-1,000/mo. 또는 tweet_filter 웹훅 룰(10kw/255자룰 ×1,000룰 — **최대 룰 수 미문서: 지원팀에 선확인**).
   - Serper: 825k/mo ≈ $250-410 ($0.30-0.50/1k 볼륨팩).
   - Threads: $0 유지 — 빈결과 무과금 규칙 덕에 6h 케이던스면 실카운트 4~8k/일 = 토큰 2~4개(다계정은 ToS-회색: 실제 동의 사용자 토큰만, 문서화).
   - **키워드 승격/강등**: 주간 배치 — 히트율 상위 5%→hot, 30일 무히트→cold. `radar_hits` 집계로 기계적 판단(LLM 0).

**10k 예산 요약: ~$400-900/mo** (X 볼륨이 최대 변수). DB 볼륨: 80k 채널+10k 피드+스트림이면 일 50~200k 아이템 — 히트만 저장하므로 실제 radar_items 증가는 일 수천 행 수준. 90일 지난 무히트 아이템 아카이브 정책은 그때 결정.

---

## 12. 비용 총괄표 (2026-07-12 검증 가격)

**Phase 0 = $0/mo 확정 (오너 결정: 무료 전용·Threads 제외).** 아래 유료 행은 Phase 1 재승인 시의 참고 견적.

| 어댑터 | Phase 0 (100kw) | 10k kw (Phase 1 참고) |
|---|---|---|
| Jetstream·fedi.buzz·피드풀·HN·WP.com·YouTube WebSub·GDELT | **$0** | **$0** (벌크 전환) |
| YouTube 검색 보강 (무료 쿼터 확장 감사) | $0 | $0-150 (SerpApi) |
| ~~Threads 공식~~ | **제외 확정** | (재승인 시 $0) |
| ~~X twitterapi.io~~ | **보류** | ~$300-1,000 |
| ~~Serper.dev~~ | **보류** | ~$250-410 |
| ~~Apify (IG 등)~~ | **보류** | 핫티어 전용 |
| Reddit (오너 결정 대기) | 보류 ($0·회색) | $0-207 |
| **합계** | **$0 확정** | **~$400-900 (전부 켤 경우)** |

---

## 13. 빌드 순서 — 그대로 따라하기

**Day 0 — 기반**
1. `radar/` 스캐폴딩 + `radar/0083_keyword_radar.sql` 작성 → 번호 재확인(양 디렉토리 max+1) → `python3 worker/apply-sql.py radar/0083_keyword_radar.sql`
2. `radar/common.py`(hourly common 재수출 + url 정규화/해시/upsert 헬퍼) + `radar/matcher.py` + 유닛 자가테스트(문맥 게이트: "Her" 단독 텍스트=미스, "Her film review"=히트)
3. `radar/seed_keywords.py` 실행 → 100개 확인. `radar/seed_feeds.py` 실행(fleet 12 + 큐레이션 50 + Substack Culture 크롤) → ≥500 피드 확인
4. 오너 액션 요청 발송(§14): YouTube 쿼터 확장 감사 신청(무료)만 — 유료·Threads 관련 요청은 하지 않는다(확정)

**Day 1 — $0 백본 가동**
5. `ingest_jetstream.mjs` (Node 22, 커서 저장/리와인드, 배치 upsert) → 상주 기동 → radar_items 유입 라이브 확인
6. `poll_feeds.py`(조건부 GET·Substack archive JSON 분기) + `poll_gdelt.py`(10s 간격·평문 스로틀 처리) + `poll_hn.py`(벌크 커서)
7. `radar-watch.sh` 가동 (nohup) + `radar/ledger.md` 초기화

**Day 2 — 확장 + UI**
8. `poll_wpcom.py` + Medium 태그 피드(poll_feeds에 15분 클래스) + `ingest_fedibuzz.mjs`
9. `/api/radar/websub` 라우트 + `websub_renew.py` + `process_inbox.py`; YouTube 채널 시드(무료 검색 100/일로 channelId 수확 시작)
10. `/admin/radar` v1 (피드+필터+소스 헬스) + NAV_ITEMS 등록 → 빌드 통과 확인

**Day 3 — 마감 (전부 무료)**
11. 카드 마감(§9 카드 봉투) + YouTube nocookie 클릭-투-로드(무료·스크립트 불필요)
12. **수용 기준 §1 전 항목 체크** → 결과를 이 문서 상단 상태줄에 기록 → docs/00-INDEX.md 등록줄 갱신(SHIPPED) → 수동 커밋(radar/·마이그·문서)

**Phase 1 (오너 재승인 시에만)**: `poll_x.py`(twitterapi.io $0.10 무료 크레딧 드라이런 → 충전) · `poll_serper.py`(무료 2,500으로 tbs 검증 → 팩 구매) · X oEmbed 캐시 훅 · (재론 시) Threads·Apify·Reddit — §6.2/§6.3 스펙 그대로.

**첫 주 운영 실험 (결과를 이 문서에 기록)**: YouTube last-hour 필터 프로브(§6.1-D) · GDELT 스로틀 실측 · Jetstream 재연결 갭 검증 · 문맥 게이트 오탐률 점검(ledger에 일일 오탐 샘플 10개 육안 확인).

---

## 14. 오너(원우) 결정·액션 목록

**결정 완료 (2026-07-12)**: ~~X 데이터 소스~~ → **보류(무료 전용 확정)**. ~~Threads 앱 리뷰~~ → **제외 확정(제출 안 함)**. ~~Apify~~·~~Serper~~ → **보류**. Reddit → **보류 유지**.

**남은 액션**:
1. **YouTube 쿼터 확장 감사 신청** ($0): API Audit & Quota Extension Form — 퍼블리셔 유스케이스로 500/일 요청. Phase 0에서 유일하게 권장되는 신청(완전 무료).
2. (후속) 공개 /radar 페이지 전환 여부 — 전환 시 삭제 스위퍼·스니펫 규범 §9 재점검.
3. (후속, Phase 1 재론 시) X: twitterapi.io(~$10-20/mo, ToS-회색) vs 공식(~$300/mo) / Serper $50 팩 / Threads 재검토 / Reddit 포지션 — §6.2·§6.3 스펙 참조.

---

## 15. 불변식 (위반 금지)

1. **이중 엔진 원칙**: 키워드별 네트워크 호출이 스케일의 병목이 되게 하지 않는다 — 10k 경로는 항상 벌크+로컬매칭.
2. **코어 루프 LLM 0** — 매칭·티어링·dedup 전부 기계적. LLM 도입 시 usage.jsonl 실비 기록 필수.
3. **모든 소스 옵셔널·fail-soft** — 단일 소스가 load-bearing이면 설계 오류. 3연속 실패 → ledger 경고 후 계속.
4. **dedup은 DB 정본** — url_hash unique + upsert-ignore. 로컬 seen 파일로 이력 관리 금지.
5. **UA 이중 정책** — 공손 소스=MetatakeBot 정본 UA + robots 존중. ToS-회색 수집은 제공자 인프라 경유만(우리 UA·IP·브랜드 불개입). 직접 스크레이핑 어댑터 추가 금지.
6. **전문은 내부용** — content_text 공개 렌더 금지. 공개는 카드 봉투(≤300자 스니펫+링크). 임베드는 공식 oEmbed만.
7. **마이그레이션 번호 = max(worker/, supabase/migrations/)+1**, service-role 테이블은 RLS 무정책 관례.
8. **PostgREST 타임스탬프는 Z 포맷**, 1000행 캡 페이징, anon 3s 타임아웃(어드민은 service-role이라 무관하나 공개 RPC 추가 시 statement_timeout).
9. **수동 커밋 목록**: radar/ 전체·마이그레이션·vercel.json·middleware.ts·docs/·이 문서. app/의 라우트·페이지만 워처가 처리.
10. **launchd/cron 금지** — nohup 상주 워처 + pidfile + HOLD. 재부팅 후 수동 재기동을 ledger에 기록.
11. **radar는 hourly의 형제** — hourly/poller/*.py 수정 금지, common.py는 임포트만.
12. **가격·쿼터는 §17 재검증 후 신뢰** — 이 문서의 수치는 2026-07-12 스냅샷.

## 16. 함정 대장 (전건 조사·검증 근거 있음)

- Substack: 글로벌 검색 익명 사용 불가(200+빈배열) — 쿠키 우회 금지. /feed는 689KB·ETag 드리프트 → archive JSON 사용. 유료글은 RSS에 프리뷰만.
- Medium: 태그 피드 10아이템·15분 CDN 캐시·검증자 없음 — 바쁜 태그는 15분 폴 필수. superfeedr 허브 신뢰 금지.
- Bluesky: public.api.bsky.app의 searchPosts만 403(다른 xrpc는 200) — 검색은 api.bsky.app, 단 비공식이므로 인증 폴백 동봉. Jetstream 이벤트는 서명 없음(모니터링 용도로만).
- GDELT: 스로틀 응답이 평문(JSON 파서 깨짐), 공유 IP에선 5초보다 길게 지속 가능 — 10s+백오프. seendate=크롤시각.
- Google News RSS: `when:` 없으면 중앙값 6.6일 스테일. 링크는 리다이렉트 토큰 — 실URL로 풀어서 해시.
- YouTube: 검색 쿼터는 "별도 버킷 100콜/일"(구 블로그 정보 전부 스테일). 프로젝트 샤딩=ToS 위반. 날짜정렬 2026년 초 고장(yt-dlp ytsearchdate 제거) — last-hour 필터 프로브 선행. WebSub 알림에 description 없을 수 있음 → 푸시 후 피드/videos.list 보강. 콜백은 즉시 200(비동기 처리).
- Threads: 민감 키워드 조용한 빈배열, 토큰 90일 재인증, owner 필드 미반환. 앱 리뷰 전엔 자기 포스트만.
- Instagram: 공식 해시태그 API는 username 반환 금지(스키마 붕괴)+30태그/7일. Meta oEmbed는 2025-11부터 thumbnail·author 제거.
- X: twitterapi.io는 `since:..._UTC` 포맷 미지원(unix `since_time:`만), QPS는 잔액 티어(3~20). 섀도밴 트윗은 안 보임. 공식 API 2M 읽기/월 하드캡.
- Reddit: 무인증 .json은 403(검증) — OAuth 필수. 서술형 UA 아니면 10QPM 스로틀. 무료 티어 비상업 조건.
- oEmbed: Reddit oEmbed는 post-ID로 해석(slug 오류 시 조용히 딴 포스트). X 위젯 CSP는 x.com+twitter.com 양쪽. 서명 CDN 썸네일 저장 금지.
- 매칭: 짧은/일반어 제목은 문맥 게이트 없이 켜면 오탐 폭발(hourly 실전례). theorists 엔티티는 복합표기 오염 — 2단어+무괄호 필터.
- 인프라: TCC가 launchd 차단, 워처 이중 기동 레이스, node는 ~/.local/node/bin(PATH 밖), 새 CSS+페이지는 한 커밋(인라인 스타일로 회피), ISR 캐시에 시간 시드 금지.

## 17. 부록 — 검증 사실 대장 (2026-07-12, 라이브 확인)

| 사실 | 값 | 출처 |
|---|---|---|
| X 공식 API | pay-per-use만 신규 가능(2026-02 개시, 06-01 Basic 강제이관), 읽기 $0.005/포스트(24h dedup), **월 2M 읽기 하드캡**, 필터드스트림 1,000룰×1,024자 포함(스트림 과금률 미문서) | docs.x.com/x-api/getting-started/pricing · /fundamentals/post-cap |
| twitterapi.io | $0.15/1k 트윗+콜당 최소 15크레딧, since_time unix 연산자, QPS 잔액 티어 3~20 | twitterapi.io/pricing · docs |
| socialdata.tools | $0.0002/트윗, 120req/min, 검색 엔드포인트 Limited Access(지원팀 활성화) | docs.socialdata.tools |
| Threads keyword_search | 실존(v1.0), search_type=RECENT+since/until unix, limit≤100, **유저당 2,200쿼리/24h·빈결과 미카운트**, threads_keyword_search 앱리뷰 필수 | developers.facebook.com/docs/threads/keyword-search |
| IG 해시태그 API | 30 유니크 태그/7일, recent_media는 24h 내 미디어만, username 필드 요청 불가 | developers.facebook.com IG docs |
| Meta Content Library | 학술·비영리 전용 — 상업 부적격 | transparency.meta.com |
| YouTube 쿼터 | search.list 별도 버킷 100콜/일 + 기타 10,000유닛/일, 유료 티어 없음(감사 확장만), 샤딩 금지 | developers.google.com/youtube/v3/determine_quota_cost |
| YouTube WebSub | pubsubhubbub.appspot.com 생존(가이드 2026-06-01 갱신), 리스 최대 10일 | developers.google.com/youtube/v3/guides/push_notifications |
| yt-dlp | 2026.02.21 ytsearchdate 제거(날짜정렬 고장) | github yt-dlp releases |
| Substack | 글로벌 검색 익명 불가(200+빈배열·로그인 장벽), 카테고리/아카이브 API 무인증 생존, oEmbed 없음 | 라이브 curl 3건 |
| WP.com read/search | 무인증·sort=date·20건 캡(21+는 400), 커버리지=wp.com+유료 Jetpack | 라이브 curl |
| Brave Search API | $5/1k(월 $5 무료크레딧), freshness 최소 pd(24h) — 시간 필터 없음 | brave.com/search/api |
| SerpApi | Free 250 / $25=1,000 / $75=5,000 / $150=15,000 / $275=30,000 per mo; youtube 엔진 sp 패스스루 | serpapi.com/pricing |
| Serper.dev | $50=50k($1/1k)~$0.30/1k, 무료 2,500, 크레딧 6개월, tbs=qdr:h 지원 | serper.dev+교차출처(대시보드 재확인 요) |
| GDELT DOC 2.0 | 생존·무료·timespan=1h/6h·15분 인덱스·비공식 1req/5s(공유IP 초과 지속) | 라이브 쿼리 |
| Google PSE JSON API | 신규 차단, 2027-01-01 종료 | developers.google.com/custom-search |
| Bing Search API | 2025-08-11 은퇴·410 | learn.microsoft.com lifecycle |
| NewsAPI/GNews/NewsData 무료 | 각 24h/12h/12h 지연 | 각 pricing |
| Bluesky Jetstream | 무인증 웹소켓, 실측 ~56이벤트/s, zstd 포스트 전용 ~25.5GB/mo, 24h 리플레이 | 라이브 웹소켓 테스트 |
| Bluesky 검색 | public.api.bsky.app searchPosts=403, api.bsky.app=무인증 200(since·sort=latest, ≤1분 랙) | 라이브 curl |
| HN Algolia | 무인증, 10,000req/h/IP(번들 문자열 검증), search_by_date+created_at_i | 라이브 curl |
| Reddit | 무료 100QPM/클라이언트(10분 평균), 비상업 한정, 무인증 .json 403 | Data API Terms+라이브 curl |
| Mastodon | v4.2+ 스트리밍 무인증 불가, REST 타임라인 무인증 300req/5min, fedi.buzz SSE 생존(~8/s 실측) | 라이브 curl/SSE |
| Inoreader Pro | $7.50/mo(연), 모니터링 피드 30개, API 100req/일/존 | inoreader.com/pricing |
| Superfeedr | 트래커 $2/kw/mo, 유지보수 모드 | superfeedr.com/tracker |
| Brand24 | 3kw $199~25kw $599, 실시간은 Pro($399)+, API +$99 | brand24.com/prices |
| Apify | Starter $29(=크레딧), CU $0.20~0.13, 스케줄 최소 10s, 웹훅 재시도 11회; IG스크레이퍼 $2.30/1k(Starter)·threads $1/1k·FB페이지 $2/1k | apify.com/pricing+스토어 |
| X oEmbed | publish.x.com 무토큰 200, cache_age≈100년, 위젯 302 x.com→twitter.com | 라이브 curl |
| Threads oEmbed | 무토큰 200 검증(문서상 1,000req/h; 계약 보장 아님) | 라이브 curl |
| IG oEmbed | 교차 검증 상충(무토큰 200 vs OAuthException) — 앱 토큰 전제로 설계; 2025-11부터 thumbnail_url·author_name 전면 제거 | 양쪽 라이브 테스트+iframely |
| Bluesky embed | embed.bsky.app/oembed 무인증(cache 86400), /embed/{did}/... 직접 iframe 가능(프레임 차단 헤더 없음) | 라이브 curl |
| EU 스니펫 규범 | DSM Art.15 '개별 단어·매우 짧은 발췌' 면제(수치 정의 없음) — Google News 관행 미러 권장; TDMRep/robots/noai 존중 시 내부 인덱싱 가능(Art.4) | Kluwer·W3C TDMRep |

---

> **문서 유지 지침**: 구현 세션은 이 문서를 읽고 시작하고, 결정 변경·실험 결과(YouTube 프로브·GDELT 실측·오탐률)·가격 변동을 이 문서에 직접 반영한 뒤 종료할 것. docs/00-INDEX.md의 등록줄(상태)도 함께 갱신.
