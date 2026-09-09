-- 0151: /admin/app — the app's own page — and the 18-second admin load, fixed.
--
-- Two things, one migration, because the second was found while building the
-- first.
--
-- ── 1. mt_weekly_return_json: 18.6 s mean → 0.3 s ───────────────────────────
-- pg_stat_statements on 2026-09-10: 125 calls, mean 18,624 ms, max 235 s,
-- 2,328 s of database time in total — every /admin/metrics load paid it, and
-- while it ran it competed with production queries for the same CPU. mt_events
-- holds 42k rows; nothing about the data justifies 18 seconds.
--
-- The cause is one line in 0149's `cls`:
--     when exists (select 1 from bot_pref b where b.wk = per.wk and b.pfx = per.pfx)
-- bot_pref is a single-reference CTE, so Postgres inlines it, and a correlated
-- EXISTS over an inlined aggregate becomes a SubPlan that re-runs the whole
-- (wk, pfx) aggregation of `base` once per `per` row — thousands of times.
-- 0120/0150 avoided this by accident (`pfx in (select …)` is uncorrelated and
-- gets hashed). Same numbers, same semantics, materialized CTEs and a LEFT
-- JOIN: EXPLAIN ANALYZE 326 ms.
--
-- ── 2. mt_app_panel_json: daily actives, first launches, downloads, by OS ──
-- The owner asked for iOS / Android daily actives and daily downloads, plus a
-- close look at what people actually tap. 0145's beacon already records the
-- events; 0144's panel summed them without splitting by platform. This read
-- does the split and adds what the beacon now sends (mobile/src/lib/beacon.ts,
-- same OTA):
--   * action `first_launch` — one per install, minted on the device the first
--     time the beacon runs. A first-party install count that needs no store
--     report and lands the same day. (Installs that pre-date this OTA do not
--     replay it: the review ledger's `first` day is older than today, so the
--     beacon treats them as already-installed.)
--   * action `session:start` / `session:end` (props.dur_s, props.screens) —
--     one session per launch, split on a 30-minute background gap.
--   * tap names for the surfaces that were dark: home filters, search queries,
--     navigator destinations, film-page doors, onboarding steps, auth method,
--     settings, connect. Screens were already covered by useSegments.
-- Downloads: mt_app_downloads — iOS from worker/asc-sales-pull.mjs, Android
-- from worker/play-installs-pull.mjs (Play's Cloud Storage export; the Play
-- Console has no installs API). null = no report fetched for that day, which
-- the page prints as "–", never as 0.

-- ═══ 1. weekly return, same answer, hash join instead of a per-row subplan ═══
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
vip as materialized (
  select distinct on (visitor) visitor, prefix
  from mt_visitor_ip, span
  where first_ts >= span.t0 - interval '2 days'
  order by visitor, first_ts
),
-- One scan of mt_events; wv folded in so wvmap does not rescan the table.
base as materialized (
  select e.visitor,
         (e.ts at time zone 'Asia/Seoul')::date                    as d,
         to_char(e.ts at time zone 'Asia/Seoul', 'IYYY-"W"IW')     as wk,
         v.prefix as pfx, e.country as ctry, e.type, e.session, e.path,
         case when e.type = 'pageview' then e.props ->> 'wv' end   as wv
  from mt_events e
  left join vip v on v.visitor = e.visitor, span
  where e.ts >= span.t0
),
pref as (
  select wk, pfx,
         count(distinct session)                                   as s,
         count(distinct path)                                      as p,
         count(*)::numeric / greatest(count(distinct session), 1)  as eps
  from base where pfx is not null group by wk, pfx
),
-- materialized: computed once, joined by hash — never re-run per row.
bot_pref as materialized (
  select wk, pfx from pref where eps < 4.5 and s >= 3 and s >= p * 0.8
),
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
  select per.wk, per.d, per.visitor, per.engaged, case
      when per.ctry = 'KR' and (per.pfx = '180.70.243.0/24' or per.pv >= 8) then 'owner'
      when b.pfx is not null                                             then 'bot'
      when per.sess >= 3 and per.sess >= per.paths                       then 'bot'
      else 'human' end as klass
  from per left join bot_pref b on b.wk = per.wk and b.pfx = per.pfx
),
wvmap as (select distinct wv, visitor, d, wk from base where wv is not null),
joined as (
  select m.wk, m.wv, m.d, c.klass, c.engaged
  from wvmap m join cls c on c.wk = m.wk and c.d = m.d and c.visitor = m.visitor
),
perwv as (
  select wk, wv,
         count(distinct d)                                       as days_raw,
         count(distinct d) filter (where klass = 'human')        as days_human,
         bool_or(klass = 'owner')                                as is_owner,
         coalesce(sum(engaged) filter (where klass = 'human'), 0) as engaged
  from joined group by wk, wv
),
weekly as (
  select wk,
    count(*) filter (where days_raw   >= 1)                                   as visitors_raw,
    count(*) filter (where days_human >= 1 and not is_owner)                  as visitors,
    count(*) filter (where days_raw   >= 2)                                   as returning_raw,
    count(*) filter (where days_human >= 2 and not is_owner)                  as returners,
    count(*) filter (where days_human >= 2 and not is_owner and engaged > 0)  as returners_engaged
  from perwv group by wk
)
select coalesce(jsonb_agg(jsonb_build_object(
    'week',              wk,
    'visitors',          visitors,
    'visitors_raw',      visitors_raw,
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
  'under-counts rotating-IP readers and merges NAT. Trend line, not headcount. '
  '0151: materialized CTEs + hash join (was a per-row subplan, 18 s).';

-- ═══ 2. the app page ════════════════════════════════════════════════════════
create or replace function public.mt_app_panel_json(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
bounds as (
  select (now() at time zone 'Asia/Seoul')::date                                   as today,
         (now() at time zone 'Asia/Seoul')::date - (greatest(p_days, 1) - 1)       as lo
),
day_span as (
  select gd::date as dd
  from bounds, generate_series(bounds.lo, bounds.today, interval '1 day') gd
),
-- Every beacon event in range, with KST day and hour.
ev as (
  select (ts at time zone 'Asia/Seoul')::date                      as dd,
         extract(hour from ts at time zone 'Asia/Seoul')::int      as hh,
         type, name, arg, visitor, session, platform, app_v, country, props
  from mt_app_events, bounds
  where ts >= (bounds.lo::timestamp at time zone 'Asia/Seoul')
),
-- The same, but the trailing 7 days only — headline numbers.
ev7 as (
  select * from ev, bounds where dd > bounds.today - 7
),
evprev as (
  select * from ev, bounds where dd <= bounds.today - 7 and dd > bounds.today - 14
),
-- Session lengths. The beacon sends session:end on EVERY background, with the
-- cumulative duration so far (a killed app never gets a last word), so a session
-- that was resumed within the 30-minute gap has several ends — take the max.
sess_all as (
  select session,
         max(platform)                              as platform,
         max(dd)                                    as dd,
         max((props ->> 'dur_s')::numeric)          as dur_s,
         max((props ->> 'screens')::int)            as screens
  from ev where name = 'session:end' and props ? 'dur_s'
  group by session
),
sess as (select s.* from sess_all s, bounds where s.dd > bounds.today - 7),
sess_daily as (select dd, round(avg(dur_s))::int as avg_session_s from sess_all group by dd),
daily as (
  select dd,
         count(distinct visitor)                                            as devices,
         count(distinct visitor) filter (where platform = 'ios')            as ios,
         count(distinct visitor) filter (where platform = 'android')        as android,
         count(distinct session)                                            as sessions,
         count(distinct session) filter (where platform = 'ios')            as ios_sessions,
         count(distinct session) filter (where platform = 'android')        as android_sessions,
         count(*) filter (where type = 'screen')                            as screens,
         count(*) filter (where type = 'tap')                               as taps,
         count(*) filter (where name = 'first_launch' and platform = 'ios')      as ios_first,
         count(*) filter (where name = 'first_launch' and platform = 'android')  as android_first
  from ev group by dd
),
dl as (
  select day,
         sum(units) filter (where platform = 'ios'     and kind = 'download') as ios_dl,
         sum(units) filter (where platform = 'android' and kind = 'download') as android_dl
  from mt_app_downloads group by day
),
-- 0144's cache-miss floor, kept as the grey columns: what the BFF saw.
ledger as (
  select (ts at time zone 'Asia/Seoul')::date as dd,
         count(*) filter (where ua like '%CFNetwork%')        as ios_calls,
         count(*) filter (where ua ~* 'okhttp|dalvik')        as android_calls
  from api_calls, bounds
  where endpoint like 'app\_%' escape '\'
    and (ua like '%CFNetwork%' or ua ~* 'okhttp|dalvik')
    and ts >= (bounds.lo::timestamp at time zone 'Asia/Seoul')
  group by dd
)
select jsonb_build_object(
  'days', (
    -- Alias must not collide with an inner column name (0059 trap).
    select coalesce(jsonb_agg(to_jsonb(rr) order by rr.day desc), '[]'::jsonb)
    from (
      select ds.dd                          as day,
             coalesce(da.devices, 0)        as devices,
             coalesce(da.ios, 0)            as ios,
             coalesce(da.android, 0)        as android,
             coalesce(da.sessions, 0)       as sessions,
             coalesce(da.ios_sessions, 0)   as ios_sessions,
             coalesce(da.android_sessions, 0) as android_sessions,
             coalesce(da.screens, 0)        as screens,
             coalesce(da.taps, 0)           as taps,
             coalesce(da.ios_first, 0)      as ios_first,
             coalesce(da.android_first, 0)  as android_first,
             sd.avg_session_s               as avg_session_s,
             dl.ios_dl                      as ios_dl,       -- null = no report
             dl.android_dl                  as android_dl,   -- null = no report
             coalesce(lg.ios_calls, 0)      as ios_calls,
             coalesce(lg.android_calls, 0)  as android_calls
      from day_span ds
      left join daily      da on da.dd  = ds.dd
      left join sess_daily sd on sd.dd  = ds.dd
      left join dl            on dl.day = ds.dd
      left join ledger     lg on lg.dd  = ds.dd
    ) rr
  ),
  'screens_top', (
    select coalesce(jsonb_agg(to_jsonb(sc) order by sc.n desc), '[]'::jsonb)
    from (
      select name, count(*) as n, count(distinct visitor) as devices,
             count(distinct visitor) filter (where platform = 'ios')     as ios,
             count(distinct visitor) filter (where platform = 'android') as android
      from ev where type = 'screen' group by name order by count(*) desc limit 16
    ) sc
  ),
  'taps_top', (
    select coalesce(jsonb_agg(to_jsonb(tp) order by tp.n desc), '[]'::jsonb)
    from (
      select name, count(*) as n, count(distinct visitor) as devices,
             count(distinct visitor) filter (where platform = 'ios')     as ios,
             count(distinct visitor) filter (where platform = 'android') as android
      from ev where type = 'tap' group by name order by count(*) desc limit 30
    ) tp
  ),
  'films_top', (
    select coalesce(jsonb_agg(to_jsonb(fm) order by fm.n desc), '[]'::jsonb)
    from (
      select x.slug,
             coalesce((select f.title from films f where f.slug = x.slug limit 1), x.slug) as title,
             x.n, x.devices
      from (
        select regexp_replace(arg, '^/film/([^/?#]+).*$', '\1') as slug,
               count(*) as n, count(distinct visitor) as devices
        from ev where type = 'screen' and name = '/film/[slug]' and arg like '/film/%'
        group by 1 order by count(*) desc limit 15
      ) x
    ) fm
  ),
  'searches_top', (
    select coalesce(jsonb_agg(to_jsonb(sq) order by sq.n desc), '[]'::jsonb)
    from (
      select lower(arg) as q, count(*) as n, count(distinct visitor) as devices
      from ev where type = 'tap' and name = 'search:query' and arg is not null
      group by 1 order by count(*) desc limit 20
    ) sq
  ),
  'reader_top', (
    -- Where the app hands off to the web reader, grouped by the first path segment.
    select coalesce(jsonb_agg(to_jsonb(rd) order by rd.n desc), '[]'::jsonb)
    from (
      select coalesce(nullif(regexp_replace(arg, '^(/[^/?#]*).*$', '\1'), ''), '/') as path,
             count(*) as n, count(distinct visitor) as devices
      from ev where type = 'tap' and name = 'reader:open'
      group by 1 order by count(*) desc limit 12
    ) rd
  ),
  'versions', (
    select coalesce(jsonb_agg(to_jsonb(vv) order by vv.platform, vv.devices desc), '[]'::jsonb)
    from (
      select platform, coalesce(app_v, '?') as app_v, count(distinct visitor) as devices
      from ev7 group by 1, 2
    ) vv
  ),
  'countries', (
    select coalesce(jsonb_agg(to_jsonb(cc) order by cc.devices desc), '[]'::jsonb)
    from (
      select coalesce(country, '?') as country, count(distinct visitor) as devices,
             count(distinct visitor) filter (where platform = 'ios')     as ios,
             count(distinct visitor) filter (where platform = 'android') as android
      from ev group by 1 order by count(distinct visitor) desc limit 12
    ) cc
  ),
  'hours', (
    -- KST hour of day → events and devices, over the whole range.
    select coalesce(jsonb_agg(to_jsonb(hr) order by hr.h), '[]'::jsonb)
    from (
      select gs as h,
             coalesce(count(ev.visitor), 0)          as events,
             coalesce(count(distinct ev.visitor), 0) as devices
      from generate_series(0, 23) gs
      left join ev on ev.hh = gs
      group by gs
    ) hr
  ),
  'session_len', (
    select coalesce(jsonb_agg(to_jsonb(sl) order by sl.ord), '[]'::jsonb)
    from (
      select b.ord, b.label,
             count(s.dur_s)                                       as n,
             count(s.dur_s) filter (where s.platform = 'ios')     as ios,
             count(s.dur_s) filter (where s.platform = 'android') as android
      from (values (1, '<10s', 0, 10), (2, '10–60s', 10, 60), (3, '1–5m', 60, 300),
                   (4, '5–15m', 300, 900), (5, '15m+', 900, 1e9)) b(ord, label, lo, hi)
      left join sess s on s.dur_s >= b.lo and s.dur_s < b.hi
      group by b.ord, b.label
    ) sl
  ),
  'funnels', jsonb_build_object(
    -- Devices, not events: "how many of the people who saw X did Y".
    'onboarding', jsonb_build_object(
      'seen',    (select count(distinct visitor) from ev where type = 'screen' and name = '/onboarding'),
      'account', (select count(distinct visitor) from ev where name = 'onboarding:step' and arg = 'account'),
      'edition', (select count(distinct visitor) from ev where name = 'onboarding:step' and arg = 'edition'),
      'taste',   (select count(distinct visitor) from ev where name = 'onboarding:step' and arg = 'taste'),
      'finish',  (select count(distinct visitor) from ev where name = 'onboarding:finish')
    ),
    'judgment', jsonb_build_object(
      'film_seen', (select count(distinct visitor) from ev where type = 'screen' and name = '/film/[slug]'),
      'judged',    (select count(distinct visitor) from ev where type = 'tap'
                      and name in ('watchlist:add', 'seen', 'rate', 'pass')),
      'rated',     (select count(distinct visitor) from ev where type = 'tap' and name = 'rate'),
      'read_web',  (select count(distinct visitor) from ev where type = 'tap' and name = 'reader:open')
    ),
    'navigator', jsonb_build_object(
      'tab',   (select count(distinct visitor) from ev where type = 'screen' and name = '/(tabs)/navigator'),
      'drive', (select count(distinct visitor) from ev where type = 'screen' and name = '/navigator/drive'),
      'seen',  (select count(distinct visitor) from ev where type = 'tap' and name = 'navigator:seen')
    ),
    'search', jsonb_build_object(
      'tab',   (select count(distinct visitor) from ev where type = 'screen' and name = '/(tabs)/search'),
      'query', (select count(distinct visitor) from ev where type = 'tap' and name = 'search:query'),
      'film',  (select count(distinct visitor) from ev where type = 'tap' and name = 'search:open')
    ),
    'auth', jsonb_build_object(
      'prompted', (select count(distinct visitor) from ev where name = 'onboarding:step' and arg = 'account'),
      'signed',   (select count(distinct visitor) from ev where type = 'tap' and name like 'auth:%' and name <> 'auth:signout')
    )
  ),
  'totals', jsonb_build_object(
    'devices_7d',       (select count(distinct visitor) from ev7),
    'devices_prev7d',   (select count(distinct visitor) from evprev),
    'ios_7d',           (select count(distinct visitor) from ev7 where platform = 'ios'),
    'android_7d',       (select count(distinct visitor) from ev7 where platform = 'android'),
    'sessions_7d',      (select count(distinct session) from ev7),
    'first_7d',         (select count(*) from ev7 where name = 'first_launch'),
    'ios_first_7d',     (select count(*) from ev7 where name = 'first_launch' and platform = 'ios'),
    'android_first_7d', (select count(*) from ev7 where name = 'first_launch' and platform = 'android'),
    'screens_7d',       (select count(*) from ev7 where type = 'screen'),
    'taps_7d',          (select count(*) from ev7 where type = 'tap'),
    'avg_session_s_7d', (select round(avg(dur_s))::int from sess),
    'median_session_s_7d', (select round(percentile_cont(0.5) within group (order by dur_s))::int from sess),
    'screens_per_session_7d', (select round(avg(screens)::numeric, 1) from sess where screens is not null),
    'ios_dl_total',     (select coalesce(sum(units), 0) from mt_app_downloads where platform = 'ios' and kind = 'download'),
    'android_dl_total', (select coalesce(sum(units), 0) from mt_app_downloads where platform = 'android' and kind = 'download'),
    'ios_dl_7d',        (select sum(units) from mt_app_downloads, bounds
                          where platform = 'ios' and kind = 'download' and day > bounds.today - 7),
    'android_dl_7d',    (select sum(units) from mt_app_downloads, bounds
                          where platform = 'android' and kind = 'download' and day > bounds.today - 7),
    'ios_dl_latest',    (select max(day) from mt_app_downloads where platform = 'ios'),
    'android_dl_latest',(select max(day) from mt_app_downloads where platform = 'android'),
    'first_event',      (select min(ts)::date from mt_app_events),
    'push_devices',     (select count(*) from push_tokens)
  )
);
$$;

comment on function public.mt_app_panel_json(int) is
  '/admin/app: daily active devices, sessions, first launches and store '
  'downloads split iOS/Android; screens, taps, films, searches, reader hand-offs, '
  'versions, countries, hour-of-day, session lengths and device funnels — all '
  'from mt_app_events (0145 beacon) + mt_app_downloads + the api_calls floor.';

revoke execute on function public.mt_app_panel_json(int) from anon, authenticated, public;
