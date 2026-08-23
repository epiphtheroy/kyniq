-- 0145: App beacon — native taps and screens, measured instead of inferred.
--
-- 0144 gave the app a face on /admin/metrics, but everything it shows is
-- inferred from the BFF ledger: cache-miss floors, /24 networks as device
-- proxies, and no visibility at all into the judgment taps (watchlist / seen /
-- pass / rate) because those go straight from the app to Supabase RPCs without
-- ever touching Vercel. This migration adds the app twin of the web beacon:
-- the app POSTs screen views and taps to /api/metrics/app, which writes here.
--
-- A SEPARATE table on purpose. mt_events feeds mt_overview_json,
-- mt_real_visitors_json, mt_generate_insights and the whole web dashboard —
-- mixing app events in would pollute every web number (and the 0120 bot
-- classifier would read app sessions as farms). Separate surface, separate
-- table, zero changes to the web RPCs.
--
-- Privacy model, same ethos as 0058: the app keeps a random install id that
-- NEVER leaves the device; each event carries hash(install_id | day), so the
-- stored visitor id rotates daily and nothing links a device across days.
-- No IP is stored. Events are dropped in __DEV__ builds.

create table if not exists public.mt_app_events (
  id       bigint generated always as identity primary key,
  ts       timestamptz not null default now(),
  type     text not null check (type in ('screen', 'tap', 'action')),
  name     text not null,   -- screen: route pattern ('/film/[slug]') · tap: action name ('watchlist:add')
  arg      text,            -- screen: concrete path · tap: slug — truncated by the collector
  visitor  text,            -- hash(install_id | day), computed on device, rotates daily
  session  text,            -- per-launch random id
  platform text check (platform in ('ios', 'android')),
  app_v    text,            -- app version at event time (OTA adoption visible here)
  country  text, region text, city text,
  props    jsonb
);
create index if not exists mt_app_events_ts_idx      on public.mt_app_events (ts desc);
create index if not exists mt_app_events_type_ts_idx on public.mt_app_events (type, ts desc);
alter table public.mt_app_events enable row level security;
-- No policies: the collector writes and the dashboard reads via service role.

-- ── mt_app_activity_json v2 — ledger floors + beacon truths in one read ─────
create or replace function public.mt_app_activity_json(p_days int default 14)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with app_ledger as (
  select (ts at time zone 'Asia/Seoul')::date as dd,
         endpoint, prefix,
         case when ua like '%CFNetwork%' then 'ios' else 'android' end as platform
  from api_calls
  where endpoint like 'app\_%' escape '\'
    and (ua like '%CFNetwork%' or ua ~* 'okhttp|dalvik')
),
recent as (
  select * from app_ledger
  where dd >= (now() at time zone 'Asia/Seoul')::date - (greatest(p_days, 1) - 1)
),
day_span as (
  select gd::date as dd
  from generate_series(
    (now() at time zone 'Asia/Seoul')::date - (greatest(p_days, 1) - 1),
    (now() at time zone 'Asia/Seoul')::date,
    interval '1 day') gd
),
daily as (
  select dd,
         count(*)                                     as calls,
         count(*) filter (where platform = 'ios')     as ios,
         count(*) filter (where platform = 'android') as android,
         count(distinct prefix)                       as networks
  from recent
  group by dd
),
debut as (
  select prefix, min(dd) as dd from app_ledger group by prefix
),
fresh as (
  select dd, count(*) as n
  from debut
  where dd >= (now() at time zone 'Asia/Seoul')::date - (greatest(p_days, 1) - 1)
  group by dd
),
dl as (
  select day, sum(units) as units
  from mt_app_downloads
  where kind = 'download'
  group by day
),
beacon as (
  select (ts at time zone 'Asia/Seoul')::date as dd, type, name, visitor
  from mt_app_events
  where ts >= (date_trunc('day', now() at time zone 'Asia/Seoul')
               - (greatest(p_days, 1) - 1 || ' days')::interval) at time zone 'Asia/Seoul'
),
beacon_daily as (
  select dd,
         count(distinct visitor)                            as devices,
         count(*) filter (where type = 'screen')            as screens,
         count(*) filter (where type in ('tap', 'action'))  as taps
  from beacon
  group by dd
)
select jsonb_build_object(
  'days', (
    -- Alias must not collide with an inner column name (0059 trap).
    select coalesce(jsonb_agg(to_jsonb(rr) order by rr.day desc), '[]'::jsonb)
    from (
      select ds.dd                    as day,
             coalesce(da.calls, 0)    as calls,
             coalesce(da.ios, 0)      as ios,
             coalesce(da.android, 0)  as android,
             coalesce(da.networks, 0) as networks,
             coalesce(fr.n, 0)        as new_networks,
             dl.units                 as downloads,   -- null = no ASC row yet
             coalesce(bd.devices, 0)  as devices,
             coalesce(bd.screens, 0)  as screens,
             coalesce(bd.taps, 0)     as taps
      from day_span ds
      left join daily da        on da.dd = ds.dd
      left join fresh fr        on fr.dd = ds.dd
      left join dl              on dl.day = ds.dd
      left join beacon_daily bd on bd.dd = ds.dd
    ) rr
  ),
  'endpoints', (
    select coalesce(jsonb_agg(to_jsonb(ep) order by ep.n desc), '[]'::jsonb)
    from (
      select endpoint, count(*) as n, count(distinct prefix) as networks
      from recent
      group by endpoint
    ) ep
  ),
  'screens_top', (
    select coalesce(jsonb_agg(to_jsonb(sc) order by sc.n desc), '[]'::jsonb)
    from (
      select name, count(*) as n, count(distinct visitor) as devices
      from beacon where type = 'screen'
      group by name order by count(*) desc limit 12
    ) sc
  ),
  'taps_top', (
    select coalesce(jsonb_agg(to_jsonb(tp) order by tp.n desc), '[]'::jsonb)
    from (
      select name, count(*) as n, count(distinct visitor) as devices
      from beacon where type in ('tap', 'action')
      group by name order by count(*) desc limit 12
    ) tp
  ),
  'totals', jsonb_build_object(
    'calls',        (select count(*) from recent),
    'networks',     (select count(distinct prefix) from recent),
    'ios',          (select count(*) from recent where platform = 'ios'),
    'android',      (select count(*) from recent where platform = 'android'),
    'new_networks', (select coalesce(sum(n), 0) from fresh),
    'downloads',    (select coalesce(sum(units), 0) from mt_app_downloads
                     where kind = 'download'),
    'push_devices', (select count(*) from push_tokens),
    'push_seen_7d', (select count(*) from push_tokens
                     where last_seen_at >= now() - interval '7 days'),
    'devices',      (select count(distinct visitor) from beacon),
    'screens',      (select count(*) from beacon where type = 'screen'),
    'taps',         (select count(*) from beacon where type in ('tap', 'action'))
  )
);
$$;

comment on function public.mt_app_activity_json(int) is
  'Mobile-app panel for /admin/metrics. Ledger floors (0144: BFF cache-miss '
  'calls, /24 networks, install proxy, ASC downloads) plus beacon truths '
  '(0145: daily active devices, screen views, taps from mt_app_events).';

revoke execute on function public.mt_app_activity_json(int) from anon, authenticated, public;
