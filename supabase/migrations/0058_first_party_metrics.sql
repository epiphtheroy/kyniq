-- 0058_first_party_metrics.sql — first-party analytics (2026-07-10)
-- (remote history: applied as first_party_metrics + first_party_metrics_alias_fix —
--  jsonb_agg aliases must NOT equal an inner column name, or to_jsonb(alias)
--  resolves the COLUMN and serializes bare strings instead of row objects)
--
-- Raw event stream collected by app/api/metrics (client beacon in
-- components/Metrics.tsx), read by /admin/metrics via the *_json RPCs below.
-- mt_gsc_daily is filled by worker/gsc-pull.py (Search Console API).
--
-- Both tables are RLS-enabled with NO policies: service-role access only.
-- RPCs are revoked from anon/authenticated — the dashboard calls them with
-- the admin client, so nothing here is reachable from the public API.

-- ── event stream ────────────────────────────────────────────────────────
create table if not exists public.mt_events (
  id           bigint generated always as identity primary key,
  ts           timestamptz not null default now(),
  type         text not null check (type in ('pageview','leave','click','vital','search')),
  path         text not null,
  referrer     text,
  ref_domain   text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  visitor      text,   -- sha256(day|ip|ua|salt) — rotates daily, no PII stored
  session      text,   -- per-tab random id (sessionStorage), links a visit's pageviews
  country      text,   -- from Vercel geo headers
  region       text,
  city         text,
  device       text,   -- mobile | tablet | desktop
  browser      text,
  lang         text,
  screen_w     int,
  props        jsonb   -- leave: {dwell_ms, scroll_pct} · click: {name, href} · vital: {name, value} · search: {q, hits, mode}
);

create index if not exists mt_events_ts_idx      on public.mt_events (ts desc);
create index if not exists mt_events_path_ts_idx on public.mt_events (path, ts desc);
create index if not exists mt_events_type_ts_idx on public.mt_events (type, ts desc);
create index if not exists mt_events_sess_ts_idx on public.mt_events (session, ts);

alter table public.mt_events enable row level security;

-- ── Google Search Console daily pull ────────────────────────────────────
create table if not exists public.mt_gsc_daily (
  day         date not null,
  page        text not null,   -- full URL as GSC reports it
  query       text not null,
  clicks      int not null default 0,
  impressions int not null default 0,
  ctr         double precision,
  position    double precision,
  primary key (day, page, query)
);
create index if not exists mt_gsc_daily_page_idx on public.mt_gsc_daily (page, day desc);
alter table public.mt_gsc_daily enable row level security;

-- ── dashboard: overview (one call = whole front page) ───────────────────
create or replace function public.mt_overview_json(
  p_from   timestamptz,
  p_to     timestamptz,
  p_tz     text default 'Asia/Seoul',
  p_bucket text default 'day'
) returns jsonb
language sql stable
set search_path = public
as $$
with ev as (
  select * from mt_events where ts >= p_from and ts < p_to
),
pv as (select * from ev where type = 'pageview'),
lv as (select * from ev where type = 'leave'),
sess as (
  select session, count(*) as n
  from pv where session is not null group by session
),
series as (
  select to_char(date_trunc(p_bucket, ts at time zone p_tz),
                 case when p_bucket = 'hour' then 'MM-DD HH24:00' else 'YYYY-MM-DD' end) as b,
         min(date_trunc(p_bucket, ts at time zone p_tz)) as bt,
         count(*) as pv, count(distinct visitor) as vis
  from pv group by 1
),
page_dwell as (
  select path,
         round(avg((props->>'dwell_ms')::numeric) / 1000, 1) as dwell_s,
         round(avg((props->>'scroll_pct')::numeric)) as scroll_pct
  from lv where props ? 'dwell_ms' group by path
),
top_pages as (
  select p.path, count(*) as pv, count(distinct p.visitor) as vis
  from pv p group by p.path order by pv desc limit 25
),
refs as (
  select ref_domain as d, count(*) as n
  from pv where coalesce(ref_domain, '') <> '' group by 1 order by n desc limit 20
),
countries as (
  select country as c, count(distinct visitor) as n
  from pv where country is not null group by 1 order by n desc limit 20
),
devices as (
  select device as d, count(distinct visitor) as n
  from pv where device is not null group by 1 order by n desc
),
browsers as (
  select browser as b, count(distinct visitor) as n
  from pv where browser is not null group by 1 order by n desc limit 8
),
entries as (
  select path, count(*) as n from (
    select distinct on (session) session, path
    from pv where session is not null order by session, ts
  ) x group by path order by n desc limit 15
),
exits as (
  select path, count(*) as n from (
    select distinct on (session) session, path
    from pv where session is not null order by session, ts desc
  ) x group by path order by n desc limit 15
),
clicks as (
  select props->>'name' as name, count(*) as n
  from ev where type = 'click' group by 1 order by n desc limit 20
),
searches as (
  select lower(props->>'q') as q, count(*) as n
  from ev where type = 'search' and coalesce(props->>'q', '') <> ''
  group by 1 order by n desc limit 25
),
vitals as (
  select props->>'name' as name,
         round((percentile_cont(0.75) within group (order by (props->>'value')::numeric))::numeric, 2) as p75,
         count(*) as n
  from ev where type = 'vital' group by 1
),
transitions as (
  select prev as f, path as t, count(*) as n from (
    select session, path, ts,
           lag(path) over (partition by session order by ts) as prev
    from pv where session is not null
  ) x where prev is not null and prev <> path
  group by 1, 2 order by n desc limit 20
),
totals as (
  select
    (select count(*) from pv)                                   as pageviews,
    (select count(distinct visitor) from pv)                    as visitors,
    (select count(*) from sess)                                 as sessions,
    (select round(avg(n), 1) from sess)                         as pv_per_session,
    (select case when count(*) = 0 then null
            else round(100.0 * count(*) filter (where n = 1) / count(*)) end
     from sess)                                                 as bounce_pct,
    (select round(avg((props->>'dwell_ms')::numeric) / 1000, 1)
     from lv where props ? 'dwell_ms')                          as avg_dwell_s,
    (select round(avg((props->>'scroll_pct')::numeric))
     from lv where props ? 'scroll_pct')                        as avg_scroll_pct
)
select jsonb_build_object(
  'totals',      (select to_jsonb(t) from totals t),
  'series',      (select coalesce(jsonb_agg(jsonb_build_object('b', s.b, 'pv', s.pv, 'vis', s.vis) order by s.bt), '[]'::jsonb) from series s),
  'top_pages',   (select coalesce(jsonb_agg(jsonb_build_object('path', tp.path, 'pv', tp.pv, 'vis', tp.vis, 'dwell_s', pd.dwell_s, 'scroll_pct', pd.scroll_pct) order by tp.pv desc), '[]'::jsonb)
                  from top_pages tp left join page_dwell pd using (path)),
  'referrers',   (select coalesce(jsonb_agg(to_jsonb(rr) order by rr.n desc), '[]'::jsonb) from refs rr),
  'countries',   (select coalesce(jsonb_agg(to_jsonb(cc) order by cc.n desc), '[]'::jsonb) from countries cc),
  'devices',     (select coalesce(jsonb_agg(to_jsonb(dd) order by dd.n desc), '[]'::jsonb) from devices dd),
  'browsers',    (select coalesce(jsonb_agg(to_jsonb(bb) order by bb.n desc), '[]'::jsonb) from browsers bb),
  'entries',     (select coalesce(jsonb_agg(to_jsonb(ee) order by ee.n desc), '[]'::jsonb) from entries ee),
  'exits',       (select coalesce(jsonb_agg(to_jsonb(xx) order by xx.n desc), '[]'::jsonb) from exits xx),
  'clicks',      (select coalesce(jsonb_agg(to_jsonb(kk) order by kk.n desc), '[]'::jsonb) from clicks kk),
  'searches',    (select coalesce(jsonb_agg(to_jsonb(ss) order by ss.n desc), '[]'::jsonb) from searches ss),
  'vitals',      (select coalesce(jsonb_agg(to_jsonb(vv)), '[]'::jsonb) from vitals vv),
  'transitions', (select coalesce(jsonb_agg(to_jsonb(tt) order by tt.n desc), '[]'::jsonb) from transitions tt)
);
$$;

-- ── dashboard: single-page drilldown (behaviour + GSC side by side) ─────
create or replace function public.mt_page_json(
  p_path   text,
  p_from   timestamptz,
  p_to     timestamptz,
  p_tz     text default 'Asia/Seoul',
  p_bucket text default 'day'
) returns jsonb
language sql stable
set search_path = public
as $$
with pv as (
  select * from mt_events
  where type = 'pageview' and path = p_path and ts >= p_from and ts < p_to
),
lv as (
  select * from mt_events
  where type = 'leave' and path = p_path and ts >= p_from and ts < p_to
),
series as (
  select to_char(date_trunc(p_bucket, ts at time zone p_tz),
                 case when p_bucket = 'hour' then 'MM-DD HH24:00' else 'YYYY-MM-DD' end) as b,
         min(date_trunc(p_bucket, ts at time zone p_tz)) as bt,
         count(*) as pv, count(distinct visitor) as vis
  from pv group by 1
),
refs as (
  select ref_domain as d, count(*) as n
  from pv where coalesce(ref_domain, '') <> '' group by 1 order by n desc limit 15
),
countries as (
  select country as c, count(distinct visitor) as n
  from pv where country is not null group by 1 order by n desc limit 12
),
sess_pv as (
  select session, path, ts from mt_events
  where type = 'pageview' and ts >= p_from and ts < p_to
    and session in (select distinct session from pv where session is not null)
),
hops as (
  select session, path, ts,
         lag(path)  over (partition by session order by ts) as prev,
         lead(path) over (partition by session order by ts) as next
  from sess_pv
),
prevs as (
  select prev as path, count(*) as n from hops
  where path = p_path and prev is not null and prev <> p_path
  group by 1 order by n desc limit 12
),
nexts as (
  select next as path, count(*) as n from hops
  where path = p_path and next is not null and next <> p_path
  group by 1 order by n desc limit 12
),
gsc as (
  select day, sum(clicks) as clicks, sum(impressions) as impressions
  from mt_gsc_daily
  where page = 'https://metatake.net' || p_path
    and day >= (p_from at time zone p_tz)::date
  group by day order by day
),
gsc_q as (
  select query, sum(clicks) as clicks, sum(impressions) as impressions,
         round(avg(position)::numeric, 1) as position
  from mt_gsc_daily
  where page = 'https://metatake.net' || p_path
    and day >= (p_from at time zone p_tz)::date
  group by query order by sum(clicks) desc, sum(impressions) desc limit 20
),
totals as (
  select
    (select count(*) from pv)                as pageviews,
    (select count(distinct visitor) from pv) as visitors,
    (select round(avg((props->>'dwell_ms')::numeric) / 1000, 1) from lv where props ? 'dwell_ms') as avg_dwell_s,
    (select round(avg((props->>'scroll_pct')::numeric)) from lv where props ? 'scroll_pct')       as avg_scroll_pct
)
select jsonb_build_object(
  'totals',    (select to_jsonb(t) from totals t),
  'series',    (select coalesce(jsonb_agg(jsonb_build_object('b', s.b, 'pv', s.pv, 'vis', s.vis) order by s.bt), '[]'::jsonb) from series s),
  'referrers', (select coalesce(jsonb_agg(to_jsonb(rr) order by rr.n desc), '[]'::jsonb) from refs rr),
  'countries', (select coalesce(jsonb_agg(to_jsonb(cc) order by cc.n desc), '[]'::jsonb) from countries cc),
  'prevs',     (select coalesce(jsonb_agg(to_jsonb(pp) order by pp.n desc), '[]'::jsonb) from prevs pp),
  'nexts',     (select coalesce(jsonb_agg(to_jsonb(nn) order by nn.n desc), '[]'::jsonb) from nexts nn),
  'gsc',       (select coalesce(jsonb_agg(to_jsonb(gg) order by gg.day), '[]'::jsonb) from gsc gg),
  'gsc_queries', (select coalesce(jsonb_agg(to_jsonb(qq)), '[]'::jsonb) from gsc_q qq)
);
$$;

-- ── dashboard: live strip (last 30 minutes) ─────────────────────────────
create or replace function public.mt_live_json()
returns jsonb
language sql stable
set search_path = public
as $$
with recent as (
  select * from mt_events
  where ts > now() - interval '30 minutes' and type = 'pageview'
)
select jsonb_build_object(
  'active_5m',  (select count(distinct visitor) from recent where ts > now() - interval '5 minutes'),
  'active_30m', (select count(distinct visitor) from recent),
  'paths', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.n desc), '[]'::jsonb) from (
      select path, count(*) as n from recent group by path order by n desc limit 12
    ) x
  )
);
$$;

-- service-role only: keep the RPCs off the public API surface
revoke execute on function public.mt_overview_json(timestamptz, timestamptz, text, text) from anon, authenticated, public;
revoke execute on function public.mt_page_json(text, timestamptz, timestamptz, text, text) from anon, authenticated, public;
revoke execute on function public.mt_live_json() from anon, authenticated, public;
