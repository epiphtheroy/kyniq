-- 0119: GSC daily totals — the numbers the (page, query) grid structurally cannot hold.
--
-- mt_gsc_daily is keyed (day, page, query), filled by worker/gsc-pull.py from the
-- Search Analytics API at the page+query grain. That grain is right for "which
-- queries and pages" but it silently drops every ANONYMIZED query — Google
-- withholds rare/personal query strings, and those rows never come back from a
-- request that asks for the query dimension.
--
-- Measured 2026-08-03: the page dimension reports ~130 impressions over the last
-- 14 days; summing mt_gsc_daily over the same window gives 4. The admin panel was
-- not stale so much as reading a number that can only ever be a floor, and the
-- gap widened enormously after 07-18 because almost everything left is long-tail.
--
-- Fix: keep mt_gsc_daily exactly as it is for the query/page lists, and store the
-- true daily series — which the ["date"] dimension DOES return in full — in its
-- own table. No sentinel rows in mt_gsc_daily: a marker row there would be summed
-- by every existing aggregate and double-count the day.

create table if not exists public.mt_gsc_totals (
  day          date primary key,
  clicks       integer not null default 0,
  impressions  integer not null default 0,
  ctr          double precision,
  position     double precision,
  fetched_at   timestamptz not null default now()
);

comment on table public.mt_gsc_totals is
  'True GSC daily totals (date dimension, includes anonymized queries). '
  'mt_gsc_daily holds the page+query breakdown, which excludes them.';

alter table public.mt_gsc_totals enable row level security;
-- Read path is the service-role admin client only (same posture as 0058).
revoke all on public.mt_gsc_totals from anon, authenticated;

-- Series and 7-day totals now come from mt_gsc_totals when it has data, and fall
-- back to the old mt_gsc_daily sums when it does not, so the panel keeps working
-- on any environment where the new puller has not run yet. The query/page/new-query
-- lists are unchanged — those genuinely need the (page, query) grain.
create or replace function public.mt_gsc_overview_json(p_days int default 28)
returns jsonb
language sql stable
set search_path = public
as $$
with has_totals as (select exists (select 1 from mt_gsc_totals) as ok),
latest as (
  select greatest(
           coalesce((select max(day) from mt_gsc_totals), '1970-01-01'::date),
           coalesce((select max(day) from mt_gsc_daily),  '1970-01-01'::date)
         ) as d
),
cur as (
  select * from mt_gsc_daily where day > (select d from latest) - p_days
),
series as (
  select day, clicks, impressions
    from mt_gsc_totals
   where (select ok from has_totals) and day > (select d from latest) - p_days
  union all
  select day, sum(clicks)::int, sum(impressions)::int
    from cur
   where not (select ok from has_totals)
   group by day
),
t1 as (
  select clicks, impressions, position from mt_gsc_totals
   where (select ok from has_totals) and day > (select d from latest) - 7
  union all
  select clicks, impressions, position from mt_gsc_daily
   where not (select ok from has_totals) and day > (select d from latest) - 7
),
t0 as (
  select clicks, impressions, position from mt_gsc_totals
   where (select ok from has_totals)
     and day > (select d from latest) - 14 and day <= (select d from latest) - 7
  union all
  select clicks, impressions, position from mt_gsc_daily
   where not (select ok from has_totals)
     and day > (select d from latest) - 14 and day <= (select d from latest) - 7
),
totals as (
  select
    (select coalesce(sum(impressions), 0) from t1) as impressions_7d,
    (select coalesce(sum(clicks), 0) from t1)      as clicks_7d,
    (select round((sum(position*impressions)/nullif(sum(impressions),0))::numeric, 1) from t1) as pos_7d,
    (select coalesce(sum(impressions), 0) from t0) as impressions_prev,
    (select coalesce(sum(clicks), 0) from t0)      as clicks_prev,
    (select round((sum(position*impressions)/nullif(sum(impressions),0))::numeric, 1) from t0) as pos_prev,
    (select d from latest)                         as latest_day
),
top_queries as (
  select query, sum(clicks) as clicks, sum(impressions) as impressions,
         round((sum(position*impressions)/nullif(sum(impressions),0))::numeric, 1) as pos
  from cur group by query
  order by sum(clicks) desc, sum(impressions) desc limit 20
),
top_pages as (
  select replace(page, 'https://metatake.net', '') as path,
         sum(clicks) as clicks, sum(impressions) as impressions,
         round((sum(position*impressions)/nullif(sum(impressions),0))::numeric, 1) as pos
  from cur group by page
  order by sum(clicks) desc, sum(impressions) desc limit 15
),
new_queries as (
  select query, replace(min(page), 'https://metatake.net', '') as path,
         sum(impressions) as impressions,
         round((sum(position*impressions)/nullif(sum(impressions),0))::numeric, 1) as pos,
         min(first_day) as first_day
  from (
    select query, page, impressions, position,
           min(day) over (partition by query) as first_day, day
    from mt_gsc_daily
  ) x
  where first_day > (select d from latest) - 7
  group by query
  order by sum(impressions) desc limit 12
)
select jsonb_build_object(
  'totals',      (select to_jsonb(t) from totals t),
  'series',      (select coalesce(jsonb_agg(jsonb_build_object('b', to_char(sr.day, 'MM-DD'), 'pv', sr.impressions, 'vis', sr.clicks) order by sr.day), '[]'::jsonb) from series sr),
  'top_queries', (select coalesce(jsonb_agg(to_jsonb(tq) order by tq.clicks desc, tq.impressions desc), '[]'::jsonb) from top_queries tq),
  'top_pages',   (select coalesce(jsonb_agg(to_jsonb(tp) order by tp.clicks desc, tp.impressions desc), '[]'::jsonb) from top_pages tp),
  'new_queries', (select coalesce(jsonb_agg(to_jsonb(nq) order by nq.impressions desc), '[]'::jsonb) from new_queries nq)
);
$$;

revoke execute on function public.mt_gsc_overview_json(int) from anon, authenticated, public;
