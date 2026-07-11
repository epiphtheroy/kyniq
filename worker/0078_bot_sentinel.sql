-- 0078_bot_sentinel.sql — autonomous bot detection + auto-block loop (2026-07-11)
--
-- Closes the loop the owner asked for: detect scrapers automatically, block
-- them immediately (via middleware), and release them automatically when they
-- go quiet. No Vercel API token needed — enforcement lives in our own edge
-- middleware reading bot_blocks.
--
--   mt_visitor_ip   — per-(day,visitor) → /24 prefix map (3-day retention).
--                     The blocking KEY, which mt_events deliberately omits
--                     (Plausible/no-IP model). Written by /api/metrics ingest.
--   bot_blocks      — the live blocklist middleware enforces. Auto rows carry a
--                     24h TTL; strikes escalate repeat offenders to 30d.
--   mt_detect_bots()      — the 30-min cron detector (piggybacks the existing
--                     /api/metrics/insights cron). Two detectors:
--                       A) per-prefix: ≥6 one-shot, referrer-less, deep-page
--                          hits from one /24 in 24h (≥5 distinct paths).
--                       B) fingerprint cluster: ≥15 suspects sharing exact
--                          (country, screen_w, browser) → block each /24 that
--                          contributed ≥3 (catches ASN-wide IP rotation).
--                     Emits a 🛡️ line into mt_insights for every NEW block so
--                     it surfaces on /admin/metrics.
--   bot_blocklist_json()  — single-jsonb blocklist for the middleware endpoint
--                     (dodges the PostgREST 1000-row cap).
--
-- Safety: only the stealth CLUSTER pattern trips a block (referrer-less bulk
-- hits to long-tail /concept /trope /film … pages — humans reach those via
-- search or internal nav, with referrers + revisits, so they never cluster as
-- "suspect"). Good bots (Googlebot/Bingbot/Claude-SearchBot/…) never touch the
-- JS beacon, so they never appear here; the middleware also allowlists them.

-- ── tables ────────────────────────────────────────────────────────────────
create table if not exists public.mt_visitor_ip (
  day      date        not null,
  visitor  text        not null,
  prefix   text        not null,          -- '47.82.8.0/24' (v4) or 'xxxx:xxxx:xxxx::/48' (v6)
  country  text,
  first_ts timestamptz not null default now(),
  primary key (day, visitor)
);
create index if not exists mt_visitor_ip_day_prefix_idx on public.mt_visitor_ip (day, prefix);
alter table public.mt_visitor_ip enable row level security;

create table if not exists public.bot_blocks (
  id         bigint generated always as identity primary key,
  kind       text not null,               -- 'ip_prefix' | 'ua'
  value      text not null,               -- the CIDR prefix, or a UA token
  reason     text not null,
  confidence text not null default 'high',
  evidence   jsonb,
  source     text not null default 'auto',-- 'auto' | 'manual'
  strikes    int  not null default 1,
  hits       int  not null default 0,     -- suspect visitors observed at last detect
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  expires_at timestamptz not null,
  active     boolean not null default true,
  unique (kind, value)
);
create index if not exists bot_blocks_active_idx on public.bot_blocks (active, kind);
alter table public.bot_blocks enable row level security;

-- speed up the per-visitor lookups the detector does
create index if not exists mt_events_visitor_ts_idx on public.mt_events (visitor, ts desc);

-- ── detector ──────────────────────────────────────────────────────────────
create or replace function public.mt_detect_bots()
returns integer
language plpgsql
set search_path = public
as $fn$
declare
  new_blocks int := 0; n int := 0;
  deep text := '^/(concept|trope|director|film|figure|theorist|lineage|reception|misreadings|tradition|movements)(/|$)';
begin
  -- privacy: keep the ip-prefix map only 3 days
  delete from mt_visitor_ip where day < current_date - 3;

  -- auto-release: expired auto blocks fall off (24h+ with no re-arm)
  update bot_blocks set active = false
   where active and source = 'auto' and expires_at < now();

  -- suspect visitors (last 24h): exactly ONE pageview, referrer-less, to a
  -- long-tail content page — the scraper signature.
  create temporary table _suspect on commit drop as
  select e.visitor,
         min(e.path)        as path,
         max(e.country)     as country,
         max(e.screen_w)    as screen_w,
         max(e.browser)     as browser
  from mt_events e
  where e.type = 'pageview' and e.ts > now() - interval '24 hours'
    and e.referrer is null and e.ref_domain is null
    and e.path ~ deep
  group by e.visitor;

  delete from _suspect s
   where (select count(*) from mt_events e2
           where e2.visitor = s.visitor and e2.type = 'pageview'
             and e2.ts > now() - interval '24 hours') <> 1;

  -- attach the /24 prefix (visitors with no prefix map yet are skipped)
  create temporary table _sp on commit drop as
  select s.*, v.prefix
  from _suspect s
  join mt_visitor_ip v on v.visitor = s.visitor
  where v.prefix is not null;

  -- ── Detector A: per-prefix cluster ───────────────────────────────────────
  with upsert as (
    insert into bot_blocks (kind, value, reason, confidence, evidence, source, expires_at, hits)
    select 'ip_prefix', p.prefix,
           format('Auto: %s one-shot referrer-less deep hits from %s in 24h', p.suspects, p.prefix),
           'high',
           jsonb_build_object('suspects', p.suspects, 'paths', p.paths, 'detector', 'prefix'),
           'auto', now() + interval '24 hours', p.suspects
    from (
      select prefix, count(*) as suspects, count(distinct path) as paths
      from _sp group by prefix
      having count(*) >= 6 and count(distinct path) >= 5
    ) p
    on conflict (kind, value) do update
       set last_seen  = now(),
           active     = true,
           hits       = excluded.hits,
           strikes    = bot_blocks.strikes + 1,
           evidence   = excluded.evidence,
           expires_at = now() + (case
             when bot_blocks.strikes + 1 >= 4 then interval '30 days'
             when bot_blocks.strikes + 1 = 3 then interval '7 days'
             when bot_blocks.strikes + 1 = 2 then interval '3 days'
             else interval '24 hours' end)
    returning value, (xmax = 0) as is_new
  )
  insert into mt_insights (kind, key, line, data)
  select 'bot_blocked', 'botblk:' || u.value || ':' || to_char(now(), 'YYYY-MM-DD'),
         format('🛡️ 봇 자동 차단: %s (24시간 원샷 딥히트 다수) — 자동 감지·차단', u.value),
         jsonb_build_object('prefix', u.value)
  from upsert u where u.is_new
  on conflict (key) do nothing;
  get diagnostics n = row_count; new_blocks := new_blocks + n;

  -- ── Detector B: fingerprint cluster across rotating prefixes ─────────────
  with fp as (
    select country, screen_w, browser, count(*) as suspects
    from _sp where screen_w is not null
    group by country, screen_w, browser
    having count(*) >= 15
  ),
  contrib as (
    select sp.prefix
    from _sp sp
    join fp using (country, screen_w, browser)
    group by sp.prefix
    having count(*) >= 3
  ),
  upsert as (
    insert into bot_blocks (kind, value, reason, confidence, evidence, source, expires_at, hits)
    select 'ip_prefix', c.prefix,
           'Auto: fingerprint-cluster scraper (rotating IPs)', 'high',
           jsonb_build_object('detector', 'fingerprint'),
           'auto', now() + interval '24 hours', 3
    from contrib c
    on conflict (kind, value) do update
       set last_seen  = now(),
           active     = true,
           strikes    = bot_blocks.strikes + 1,
           expires_at = now() + (case
             when bot_blocks.strikes + 1 >= 4 then interval '30 days'
             when bot_blocks.strikes + 1 = 3 then interval '7 days'
             when bot_blocks.strikes + 1 = 2 then interval '3 days'
             else interval '24 hours' end)
    returning value, (xmax = 0) as is_new
  )
  insert into mt_insights (kind, key, line, data)
  select 'bot_blocked', 'botblk:' || u.value || ':' || to_char(now(), 'YYYY-MM-DD'),
         format('🛡️ 봇 자동 차단: %s (동일지문 대량 스크레이핑) — 자동 감지·차단', u.value),
         jsonb_build_object('prefix', u.value)
  from upsert u where u.is_new
  on conflict (key) do nothing;
  get diagnostics n = row_count; new_blocks := new_blocks + n;

  return new_blocks;
end;
$fn$;

-- ── blocklist for the middleware endpoint ───────────────────────────────────
create or replace function public.bot_blocklist_json()
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'prefixes', coalesce((select jsonb_agg(value) from bot_blocks
                          where active and kind = 'ip_prefix' and expires_at > now()), '[]'::jsonb),
    'ua',       coalesce((select jsonb_agg(value) from bot_blocks
                          where active and kind = 'ua' and expires_at > now()), '[]'::jsonb)
  );
$$;

revoke execute on function public.mt_detect_bots()   from anon, authenticated, public;
revoke execute on function public.bot_blocklist_json() from anon, authenticated, public;
