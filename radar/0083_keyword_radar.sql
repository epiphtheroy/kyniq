-- 0083_keyword_radar.sql — Keyword Radar (정본: HANDOFF-키워드레이더.md §4)
-- 등록 키워드로 X·유튜브·서브스택·WP·Bluesky·Mastodon·HN·뉴스에서 신작 감지 → 적재.
-- RLS: 무정책(service-role 전용 테이블, mt_events 하우스 관례). 어드민은 createAdminClient()로 읽음.
-- 번호: worker/*.sql·supabase/migrations/ 양쪽 max(0082)+1 = 0083.

-- ── 키워드 레지스트리 ────────────────────────────────────────────────
create table if not exists radar_keywords (
  id              bigint generated always as identity primary key,
  keyword         text not null unique,               -- 표시용 원형 "In the Mood for Love (2000)"
  match_text      text not null,                       -- 매칭용 "In the Mood for Love"
  norm            text not null,                       -- 정규화 소문자(유니코드 보존)
  kind            text not null default 'custom',      -- film|director|theorist|concept|movement|custom
  entity_slug     text,                                -- 사이트 엔티티 역링크(있으면)
  tier            text not null default 'warm',        -- hot|warm|cold (엔진A 케이던스; Phase 0 미사용)
  aliases         jsonb not null default '[]'::jsonb,  -- ["화양연화","Fa yeung nin wa"]
  require_context boolean not null default false,      -- 짧은/일반어 제목 → 문맥 게이트 필수
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ── 소스 원장 (피드·스트림·검색 엔드포인트) ──────────────────────────
create table if not exists radar_sources (
  id              bigint generated always as identity primary key,
  platform        text not null,   -- x|threads|instagram|youtube|substack|wordpress|ghost|medium|bluesky|mastodon|reddit|hn|news|google|tumblr|blog
  kind            text not null,   -- stream|feed|search|websub|webhook
  url             text not null default '',  -- 피드 URL/채널ID/엔드포인트; stream류는 센티넬('jetstream' 등)
  label           text,
  beat            text,            -- film|culture|general (문맥 게이트 판단용 §5)
  active          boolean not null default true,
  last_ok_at      timestamptz,
  fail_count      int not null default 0,
  etag            text,            -- 조건부 GET 상태
  last_modified   text,
  websub_lease_until timestamptz,  -- websub 전용
  meta            jsonb not null default '{}'::jsonb,  -- 커서 등(예: {"hn_cursor": 1783797294})
  created_at      timestamptz not null default now()
);
-- plain (platform, url) unique so PostgREST on_conflict=platform,url works
-- (url is NOT NULL default '' — stream singletons carry a sentinel url).
create unique index if not exists radar_sources_uni on radar_sources(platform, url);
create index if not exists radar_sources_active on radar_sources(platform, active) where active;

-- ── 아이템 (수집된 콘텐츠) ───────────────────────────────────────────
create table if not exists radar_items (
  id              bigint generated always as identity primary key,
  url             text not null,
  url_hash        text not null unique,                -- sha256(정규화 URL): 트래킹 파라미터 제거 후
  platform        text not null,
  author          text,
  author_url      text,
  title           text,
  snippet         text,                                -- 공개 표시용 ≤300자 (§9)
  content_text    text,                                -- 내부 매칭용 전문(공개 렌더 금지 §9)
  lang            text,
  published_at    timestamptz,                         -- 원문 발행시각 (없으면 discovered_at 폴백 표시)
  discovered_at   timestamptz not null default now(),
  source_id       bigint references radar_sources(id) on delete set null,
  thumb_url       text,                                -- 프록시/영속화된 자체 경로 (서명 CDN 원본 저장 금지)
  embed_html      text,                                -- oEmbed html 캐시 (Phase 1)
  meta            jsonb not null default '{}'::jsonb
);
create index if not exists radar_items_pub on radar_items(published_at desc nulls last);
create index if not exists radar_items_plat_pub on radar_items(platform, published_at desc nulls last);
create index if not exists radar_items_disc on radar_items(discovered_at desc);

-- ── 히트 (아이템 ↔ 키워드 다대다) ────────────────────────────────────
create table if not exists radar_hits (
  item_id     bigint not null references radar_items(id) on delete cascade,
  keyword_id  bigint not null references radar_keywords(id) on delete cascade,
  matched_on  text not null default 'text',            -- title|text|tag|search
  created_at  timestamptz not null default now(),
  primary key (item_id, keyword_id)
);
create index if not exists radar_hits_kw on radar_hits(keyword_id, item_id desc);

-- ── Vercel 수신함 (WebSub/웹훅 원문 → Mac 워커가 처리) ────────────────
create table if not exists radar_inbox (
  id          bigint generated always as identity primary key,
  channel     text not null,                           -- websub-youtube|apify|...
  payload     jsonb not null,
  received_at timestamptz not null default now(),
  processed   boolean not null default false
);
create index if not exists radar_inbox_unproc on radar_inbox(processed, id) where not processed;

-- ── 런 장부 (헬스 + 비용) ────────────────────────────────────────────
create table if not exists radar_runs (
  id          bigint generated always as identity primary key,
  engine      text not null,                           -- jetstream|fedibuzz|feedpool|gdelt|wpcom|hn|youtube|websub-renew|inbox
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  items_seen  int default 0,
  items_new   int default 0,
  hits        int default 0,
  cost_usd    numeric(10,4) default 0,
  errors      jsonb not null default '[]'::jsonb
);
create index if not exists radar_runs_recent on radar_runs(engine, started_at desc);

-- ── RLS: service-role only (mt_events / mt_crawler_* 패턴) ────────────
-- 이 프로젝트는 신규 테이블에 RLS를 자동 활성화하지만, 명시적으로 켜서
-- 자기문서화 + 프레시 프로젝트에서도 안전하게 한다. 정책 0개 → anon/
-- authenticated 전면 차단, service_role만 우회. 어드민/워커는 service key.
alter table radar_keywords enable row level security;
alter table radar_sources  enable row level security;
alter table radar_items    enable row level security;
alter table radar_hits     enable row level security;
alter table radar_inbox    enable row level security;
alter table radar_runs     enable row level security;
