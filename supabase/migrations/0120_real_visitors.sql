-- 0120: Real visitors — the dashboard number with bots and the owner taken out.
--
-- Every visitor count on /admin/metrics has been counting three populations as
-- one. Measured 2026-08-03 over the previous 24 hours: 46 real visitors, 47
-- automated clients, 2 owner hashes. The headline "95 visitors" was half
-- machine. The day before, a five-VM Google Cloud sweep put 688 events into
-- 08-02 and made it look like the best traffic day of the month; its real
-- audience read 44 pages between 44 people. A number that climbs when nobody
-- visits cannot be steered by, and it was read as recovery.
--
-- CLASSIFIER — two behavioural signals, no user-agent strings. A scraper picks
-- its own UA; it does not pick its session shape.
--
--   1. Per /24: sessions tracking distinct paths one-for-one. A reader keeps a
--      session across pages; a headless browser starts fresh every fetch.
--      Measured over 7 days the separation is total — bots 2.30-3.60 events
--      per session, humans 6.00-17.69, nothing between — so the cut sits at
--      4.5. This catches whole farms at once: 153.3.233.0/24 minted 20 distinct
--      visitor hashes off 34 sessions, which the per-visitor rule cannot see.
--   2. Per visitor, for the ~46% of hashes with no IP row: at least 3 sessions
--      and sessions >= distinct paths. The same shape where the prefix is not
--      known.
--
-- OWNER — 180.70.243.0/24 (KT), plus KR with >= 8 pageviews in a day for the
-- stretch before mt_visitor_ip covered the hash. There is no Korean audience
-- yet and the median visitor reads 1.3 pages, so an 8-pageview Korean day is
-- the owner testing. The panel prints both counts it removed, so a wrong
-- exclusion shows up instead of quietly shrinking the number.
--
-- LIMIT, and it is not a small one: a bot that loads exactly one page and
-- leaves looks exactly like a one-page human. This returns an UPPER bound.

-- The join below maps visitor -> prefix; mt_visitor_ip is keyed (day, visitor).
create index if not exists mt_visitor_ip_visitor_idx
  on public.mt_visitor_ip (visitor);

create or replace function public.mt_real_visitors_json(p_days int default 14)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with vip as (
  -- One prefix per visitor hash. Hashes rotate daily so this is normally 1:1
  -- already, but distinct on keeps a stray second row from duplicating events.
  select distinct on (visitor) visitor, prefix
  from mt_visitor_ip
  where first_ts >= now() - ((greatest(p_days, 1) + 2) || ' days')::interval
  order by visitor, first_ts
),
base as (
  select e.visitor,
         (e.ts at time zone 'Asia/Seoul')::date as d,
         v.prefix as pfx,
         e.country as ctry,
         e.type, e.session, e.path
  from mt_events e
  left join vip v on v.visitor = e.visitor
  where e.ts >= (date_trunc('day', now() at time zone 'Asia/Seoul')
                 - ((greatest(p_days, 1) - 1) || ' days')::interval)
                at time zone 'Asia/Seoul'
),
pref as (
  select pfx,
         count(distinct session) as s,
         count(distinct path)    as p,
         count(*)::numeric / greatest(count(distinct session), 1) as eps
  from base
  where pfx is not null
  group by pfx
),
bot_pref as (
  select pfx from pref where eps < 4.5 and s >= 3 and s >= p * 0.8
),
per as (
  select d, visitor,
         max(pfx)  as pfx,
         max(ctry) as ctry,
         count(*) filter (where type = 'pageview') as pv,
         count(*) filter (where type = 'click')    as clk,
         count(distinct session) as sess,
         count(distinct path)    as paths
  from base
  group by d, visitor
),
cls as (
  select *,
         case
           when ctry = 'KR' and (pfx = '180.70.243.0/24' or pv >= 8) then 'owner'
           when pfx in (select pfx from bot_pref)                    then 'bot'
           when sess >= 3 and sess >= paths                          then 'bot'
           else 'human'
         end as klass
  from per
),
daily as (
  select d,
         count(*) filter (where klass = 'human')          as visitors,
         coalesce(sum(pv)  filter (where klass = 'human'), 0) as pageviews,
         coalesce(sum(clk) filter (where klass = 'human'), 0) as clicks,
         count(*) filter (where klass = 'bot')            as bots,
         coalesce(sum(pv) filter (where klass = 'bot'), 0)    as bot_pageviews,
         count(*) filter (where klass = 'owner')          as owner_hashes,
         coalesce(sum(pv) filter (where klass = 'owner'), 0)  as owner_pageviews,
         count(*)                                         as raw_visitors
  from cls
  group by d
)
select jsonb_build_object(
  'days', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'day',            to_char(d, 'MM-DD'),
      'visitors',       visitors,
      'pageviews',      pageviews,
      'clicks',         clicks,
      'pv_per_visitor',
        case when visitors > 0 then round(pageviews::numeric / visitors, 2) else null end,
      'clicks_per_visitor',
        case when visitors > 0 then round(clicks::numeric / visitors, 2) else null end,
      'bots',           bots,
      'bot_pageviews',  bot_pageviews,
      'owner_hashes',   owner_hashes,
      'owner_pageviews', owner_pageviews,
      'raw_visitors',   raw_visitors
    ) order by d desc), '[]'::jsonb)
    from daily
  ),
  -- Today is partial, so the average that means anything excludes it.
  'avg', (
    select case when count(*) = 0 then null else jsonb_build_object(
      'days',               count(*),
      'visitors_per_day',   round(avg(visitors), 1),
      'pv_per_visitor',
        round(sum(pageviews)::numeric / greatest(sum(visitors), 1), 2),
      'clicks_per_visitor',
        round(sum(clicks)::numeric / greatest(sum(visitors), 1), 2)
    ) end
    from daily
    where d < (now() at time zone 'Asia/Seoul')::date
  )
);
$$;

comment on function public.mt_real_visitors_json(int) is
  'Daily visitor counts with automated clients and the owner removed. '
  'Behavioural classifier (session shape, not user-agent) — see 0120 header. '
  'Returns an upper bound: a one-page bot is indistinguishable from a one-page human.';

-- Dashboard reads this with the service-role admin client only (0058 pattern).
revoke execute on function public.mt_real_visitors_json(int) from anon, authenticated, public;
