-- 0149 — the north-star number, with the machines taken out and its own limits printed.
--
-- WHY (measured 2026-08-31, gate verdict day)
-- ───────────────────────────────────────────
-- /admin/metrics showed weekly returning visitors W34 48 · W35 41 against a Gate N
-- target of 25, and that number had never met a bot filter. Migration 0120 built the
-- classifier and wired it to `visitor`; mt_weekly_return_json (0111) reads `wv`. The
-- filter was not bypassed — it was never on this path. Applying 0120's own rules to
-- the same weeks removes 2 of 48 (W34) and 15 of 41 (W35).
--
-- 🔑 THREE TIERS, ALL PRINTED. 0120's principle was that a panel must show what it
-- removed so a wrong exclusion is visible instead of quietly shrinking the number.
-- Same here, one tier further:
--
--   returning_raw       what the panel showed until today (no filter)
--   returning           0120 classifier applied — bots and the owner removed
--   returning_engaged   of those, the ones that also emitted a click or a dwell/scroll
--                       event. A fetcher does not run our JS far enough to fire those,
--                       so this is positive evidence of a browser, not an absence of
--                       evidence of a bot. It is the floor; `returning` is the estimate.
--
-- Measured on this data: W31 5/3/3 · W32 17/13/10 · W33 26/21/13 · W34 48/46/26 ·
-- W35 41/26/14.
--
-- ⚠️ WHAT THIS METRIC STILL CANNOT DO — and no filter fixes it.
-- `wv = sha256(ISO week | IP | UA | salt)` (app/api/metrics/route.ts). Identity is the
-- NETWORK, not the person. So:
--   · a reader on cellular whose IP rotates is a NEW wv each time and can never be
--     counted as returning — the metric UNDER-counts real mobile readers;
--   · two people behind one NAT with the same UA are ONE returning visitor;
--   · the hash rotates weekly, so "active in 2 consecutive weeks" — Gate N's literal
--     wording — remains unmeasurable by construction. This function answers the
--     substituted question: "seen on >=2 distinct days inside one ISO week".
-- Read it as a trend line, not a headcount. The bot-proof floor for engaged humans is
-- mt_weekly_auth_active_json below, which counts authenticated write actions.

create or replace function public.mt_weekly_return_json(p_weeks integer default 8)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
with span as (
  select date_trunc('week', now() at time zone 'Asia/Seoul')
         - (greatest(p_weeks, 1) || ' weeks')::interval as t0
),
-- One prefix per visitor hash (0120: hashes rotate daily, so this is normally 1:1).
vip as (
  select distinct on (visitor) visitor, prefix
  from mt_visitor_ip, span
  where first_ts >= span.t0 - interval '2 days'
  order by visitor, first_ts
),
base as (
  select e.visitor,
         (e.ts at time zone 'Asia/Seoul')::date                    as d,
         to_char(e.ts at time zone 'Asia/Seoul', 'IYYY-"W"IW')     as wk,
         v.prefix as pfx, e.country as ctry, e.type, e.session, e.path
  from mt_events e
  left join vip v on v.visitor = e.visitor, span
  where e.ts >= span.t0
),
-- wv lives on pageview rows only, so weekly identity is joined back through
-- (week, day, visitor) — which is exactly the same IP+UA by construction.
wvmap as (
  select e.props ->> 'wv'                                          as wv,
         e.visitor,
         (e.ts at time zone 'Asia/Seoul')::date                    as d,
         to_char(e.ts at time zone 'Asia/Seoul', 'IYYY-"W"IW')     as wk
  from mt_events e, span
  where e.type = 'pageview' and e.props ? 'wv' and e.ts >= span.t0
),
-- 0120 rule 1: per /24, sessions tracking distinct paths one-for-one. Per week, so
-- a prefix that turns into a crawler in week N does not retro-label week N-1.
pref as (
  select wk, pfx,
         count(distinct session)                                   as s,
         count(distinct path)                                      as p,
         count(*)::numeric / greatest(count(distinct session), 1)  as eps
  from base where pfx is not null group by wk, pfx
),
bot_pref as (select wk, pfx from pref where eps < 4.5 and s >= 3 and s >= p * 0.8),
per as (
  select wk, d, visitor,
         max(pfx) as pfx, max(ctry) as ctry,
         count(*) filter (where type = 'pageview')            as pv,
         count(*) filter (where type in ('click', 'leave'))   as engaged,
         count(distinct session)                              as sess,
         count(distinct path)                                 as paths
  from base group by wk, d, visitor
),
cls as (
  select per.*, case
      when ctry = 'KR' and (pfx = '180.70.243.0/24' or pv >= 8)              then 'owner'
      when exists (select 1 from bot_pref b where b.wk = per.wk and b.pfx = per.pfx) then 'bot'
      -- 0120 rule 2, for the ~46% of hashes with no IP row.
      when sess >= 3 and sess >= paths                                       then 'bot'
      else 'human' end as klass
  from per
),
joined as (
  select m.wk, m.wv, m.d, c.klass, c.engaged
  from wvmap m join cls c on c.wk = m.wk and c.d = m.d and c.visitor = m.visitor
),
perwv as (
  select wk, wv,
         count(distinct d)                              as days_raw,
         count(distinct d) filter (where klass='human') as days_human,
         bool_or(klass = 'owner')                       as is_owner,
         coalesce(sum(engaged) filter (where klass='human'), 0) as engaged
  from joined group by wk, wv
),
weekly as (
  select wk,
    count(*) filter (where days_raw   >= 1)                       as visitors_raw,
    count(*) filter (where days_human >= 1 and not is_owner)      as visitors,
    count(*) filter (where days_raw   >= 2)                       as returning_raw,
    count(*) filter (where days_human >= 2 and not is_owner)      as returners,
    count(*) filter (where days_human >= 2 and not is_owner and engaged > 0) as returners_engaged
  from perwv group by wk
)
select coalesce(jsonb_agg(jsonb_build_object(
    'week',              wk,
    'visitors',          visitors,
    'visitors_raw',      visitors_raw,
    -- 'returning' is a reserved word; the JSON key the panel reads is unchanged,
    -- but its VALUE is now the filtered number, not the raw one.
    'returning',         returners,
    'returning_raw',     returning_raw,
    'returning_engaged', returners_engaged,
    'removed',           returning_raw - returners
  ) order by wk), '[]'::jsonb)
from weekly;
$function$;

comment on function public.mt_weekly_return_json(int) is
  'Weekly returning visitors (>=2 distinct days in one ISO week), three tiers: raw, '
  '0120-classifier-clean, and click/dwell-evidenced. Identity is week|IP|UA — it '
  'under-counts rotating-IP readers and merges NAT. Trend line, not headcount.';

-- The bot-proof floor: authenticated write actions. No crawler can forge these.
create or replace function public.mt_weekly_auth_active_json(p_weeks integer default 8)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
with span as (
  select date_trunc('week', now() at time zone 'Asia/Seoul')
         - (greatest(p_weeks, 1) || ' weeks')::interval as t0
),
acts as (
  select user_id, created_at as at from user_saves,     span where created_at >= span.t0
  union all
  select user_id, created_at      from user_watch_log,  span where created_at >= span.t0
  union all
  select user_id, added_at        from user_movies,     span where added_at   >= span.t0
  union all
  select user_id, created_at      from user_pins,       span where created_at >= span.t0
),
w as (
  select user_id,
         to_char(at at time zone 'Asia/Seoul', 'IYYY-"W"IW')            as wk,
         count(distinct (at at time zone 'Asia/Seoul')::date)           as days
  from acts where user_id is not null group by user_id, wk
)
select coalesce(jsonb_agg(jsonb_build_object(
    'week', wk, 'active', active, 'multi_day', multi_day
  ) order by wk), '[]'::jsonb)
from (
  select wk, count(*) as active, count(*) filter (where days >= 2) as multi_day
  from w group by wk
) x;
$function$;

comment on function public.mt_weekly_auth_active_json(int) is
  'Authenticated users who wrote something (save / watch log / list / pin) per ISO '
  'week. Bot-proof floor for the companion north star.';

revoke execute on function public.mt_weekly_return_json(int)      from anon, authenticated, public;
revoke execute on function public.mt_weekly_auth_active_json(int) from anon, authenticated, public;
