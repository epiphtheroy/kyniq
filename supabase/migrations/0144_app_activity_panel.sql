-- 0144: Mobile app activity + store downloads on /admin/metrics.
--
-- The native app is invisible to every visitor number the owner reads. Vercel
-- Web Analytics counts pages that run its browser script; the first-party
-- beacon (components/Metrics.tsx) runs on web pages only. The app's native
-- screens produce neither — they show up solely as function invocations in the
-- Vercel log, which is exactly the "lots of calls, few pageviews" discrepancy
-- observed on 2026-08-20. What the app DOES leave behind is the api_calls
-- ledger (0100): every BFF route under /api/v1/app/* runs guardAndLog. This
-- migration turns that ledger into an owner-facing activity panel and adds a
-- table for App Store Connect download numbers (filled by an owner-run worker,
-- worker/asc-sales-pull.mjs — the ASC .p8 key never touches the repo or Vercel).
--
-- Honesty notes, printed on the panel too:
--   * Most app BFF responses are CDN-cached (film 1h, tonight 15m, director 5m,
--     countries/services 24h) — a ledger row is written on cache MISS only, so
--     per-endpoint counts are a floor, not a total. app_navigator and
--     app_handoff are no-store and therefore exact.
--   * Real devices are told apart by fetch UA: React Native stamps
--     "Metatake/<build> CFNetwork/... Darwin/..." on iOS and "okhttp/..." on
--     Android. Browsers/curl probing the same endpoints are excluded.
--   * "New networks" is an install PROXY: the first day a /24 ever appears in
--     app traffic. api_calls keeps 90 days, so "ever" means that horizon; one
--     network can hide many devices and one device roams across networks.

-- ── 1. mt_app_downloads — App Store Connect daily sales units ────────────────
-- Written by worker/asc-sales-pull.mjs (owner-run: needs the ASC API .p8 key
-- and the vendor number from ASC → Payments and Financial Reports). Android
-- rows are reserved for a future Play pull; the Play Console has no simple
-- installs API without a GCS export pipeline.
create table if not exists public.mt_app_downloads (
  day        date not null,
  platform   text not null default 'ios' check (platform in ('ios', 'android')),
  kind       text not null default 'download'
             check (kind in ('download', 'redownload', 'update')),
  units      integer not null,
  fetched_at timestamptz not null default now(),
  primary key (day, platform, kind)
);
alter table public.mt_app_downloads enable row level security;
-- No policies on purpose: service-role only (worker writes, dashboard reads).

-- ── 2. mt_app_activity_json — the panel's single jsonb read ─────────────────
create or replace function public.mt_app_activity_json(p_days int default 14)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with app_ledger as (
  -- Every ledgered call to /api/v1/app/* from a real device UA.
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
         count(*)                                        as calls,
         count(*) filter (where platform = 'ios')        as ios,
         count(*) filter (where platform = 'android')    as android,
         count(distinct prefix)                          as networks
  from recent
  group by dd
),
debut as (
  -- Install proxy: first day a /24 ever appears in app traffic (90d horizon).
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
)
select jsonb_build_object(
  'days', (
    -- Alias must not collide with an inner column name (0059 trap).
    select coalesce(jsonb_agg(to_jsonb(rr) order by rr.day desc), '[]'::jsonb)
    from (
      select ds.dd                     as day,
             coalesce(da.calls, 0)     as calls,
             coalesce(da.ios, 0)       as ios,
             coalesce(da.android, 0)   as android,
             coalesce(da.networks, 0)  as networks,
             coalesce(fr.n, 0)         as new_networks,
             dl.units                  as downloads   -- null = no ASC row yet
      from day_span ds
      left join daily da on da.dd = ds.dd
      left join fresh fr on fr.dd = ds.dd
      left join dl       on dl.day = ds.dd
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
                     where last_seen_at >= now() - interval '7 days')
  )
);
$$;

comment on function public.mt_app_activity_json(int) is
  'Mobile-app panel for /admin/metrics: daily BFF calls from real device UAs '
  '(cache-miss floor — navigator/handoff exact), distinct /24 networks, '
  'first-seen networks as an install proxy, ASC download units, push devices.';

-- Dashboard reads this with the service-role admin client only (0058 pattern).
revoke execute on function public.mt_app_activity_json(int) from anon, authenticated, public;
