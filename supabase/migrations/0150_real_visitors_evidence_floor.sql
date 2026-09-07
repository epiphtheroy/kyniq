-- 0150: real-visitors panel — add an evidence floor next to the upper bound.
--
-- The 0120 classifier catches session farms (many sessions per visitor hash),
-- but the 2026-08-31 headless fleet inverted the shape: one fresh visitor hash
-- per request, one pageview each. Those pass every per-visitor rule and the
-- panel read 591 "real" visitors on a ~30-human day.
--
-- The floor counts only visitors with evidence a fleet does not produce:
--   * >= 2 pageviews in a day (a fleet hash never returns), or
--   * a hand-made interaction (tab click, map drag/click, graph/galaxy drag,
--     outbound) — *_shown impressions fire on load and map:zoom fires on the
--     wheel, so both are spoofed by headless scrolling and stay excluded, or
--   * dwell >= 10s. Measured 08-29..31: the fleet spoofs scroll depth
--     (scroll>=50%: 71/day vs 10-16 baseline) but not dwell
--     (dwell>=10s: 27 on the fleet day vs 28-45 baseline).
-- Real one-page readers who bounce fast still land below the floor, so the
-- truth stays between `evidenced` and `visitors`.

create or replace function public.mt_real_visitors_json(p_days integer default 14)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
with vip as (
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
         e.type, e.session, e.path,
         (e.type = 'click' and (
            e.props->>'name' like 'tab:%' or
            e.props->>'name' like 'graph:%' or
            e.props->>'name' like 'galaxy:%' or
            e.props->>'name' in ('map:drag', 'map:click', 'outbound')
         )) as hard,
         case when e.type = 'leave' and e.props->>'dwell_ms' ~ '^[0-9]+'
              then floor((e.props->>'dwell_ms')::numeric) end as dwell_ms
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
         count(*) filter (where hard)              as hard,
         max(dwell_ms)                             as dwell_ms,
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
         count(*) filter (where klass = 'human'
                          and (pv >= 2 or hard >= 1 or dwell_ms >= 10000)) as evidenced,
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
      'evidenced',      evidenced,
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
  'avg', (
    select case when count(*) = 0 then null else jsonb_build_object(
      'days',               count(*),
      'visitors_per_day',   round(avg(visitors), 1),
      'evidenced_per_day',  round(avg(evidenced), 1),
      'pv_per_visitor',
        round(sum(pageviews)::numeric / greatest(sum(visitors), 1), 2),
      'clicks_per_visitor',
        round(sum(clicks)::numeric / greatest(sum(visitors), 1), 2)
    ) end
    from daily
    where d < (now() at time zone 'Asia/Seoul')::date
  )
);
$function$;
