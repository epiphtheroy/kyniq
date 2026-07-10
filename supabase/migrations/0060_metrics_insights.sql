-- 0060_metrics_insights.sql — rule-based one-line insight feed + GSC overview (2026-07-10)
--
-- mt_generate_insights(): 13 mechanical detectors (LLM-free) over mt_events +
-- mt_gsc_daily, each emitting Korean one-liners into mt_insights. Dedup via
-- unique(key): one-time keys for "first ever" facts, ISO-week keys for
-- repeatable observations. Triggered every 30 min by Vercel cron
-- (/api/metrics/insights) and opportunistically on /admin/metrics load.
-- mt_gsc_overview_json(): the dashboard's Search-Console panel.
--
-- ⚠️ alias trap (see 0058 header): jsonb_agg(to_jsonb(alias)) aliases must not
-- equal an inner column name.

create table if not exists public.mt_insights (
  id   bigint generated always as identity primary key,
  ts   timestamptz not null default now(),
  kind text not null,          -- detector id, or '_run' marker rows
  key  text not null unique,   -- dedup key
  line text not null,          -- the one-liner shown on the dashboard
  data jsonb
);
create index if not exists mt_insights_ts_idx on public.mt_insights (ts desc);
alter table public.mt_insights enable row level security;

create or replace function public.mt_generate_insights()
returns integer
language plpgsql
set search_path = public
as $fn$
declare
  ins int := 0; n int := 0;
  latest date;
  site_dwell numeric;
begin
  select max(day) into latest from mt_gsc_daily;

  -- ── GSC detectors ──────────────────────────────────────────────────────
  if latest is not null then

    -- 1) new query first seen (within the last 3 data-days)
    insert into mt_insights (kind, key, line, data)
    select 'gsc_new_query',
           'gscq:' || q.query || ':' || q.page,
           format('🔎 새 검색어 첫 노출: “%s” → %s (평균 %s위, 노출 %s회)',
                  q.query, replace(q.page, 'https://metatake.net', ''), round(q.wpos::numeric, 1), q.imps),
           jsonb_build_object('query', q.query, 'page', q.page, 'pos', round(q.wpos::numeric, 1), 'impressions', q.imps)
    from (
      select query, page, sum(impressions) as imps,
             sum(position * impressions) / nullif(sum(impressions), 0) as wpos,
             min(day) as first_day
      from mt_gsc_daily group by query, page
    ) q
    where q.first_day >= latest - 2 and q.imps >= 2
    order by q.imps desc limit 10
    on conflict (key) do nothing;
    get diagnostics n = row_count; ins := ins + n;

    -- 2) weekly rank movers (|Δ| ≥ 3 positions, both windows ≥ 3 impressions)
    insert into mt_insights (kind, key, line, data)
    select case when m.delta <= 0 then 'gsc_rank_up' else 'gsc_rank_down' end,
           'rank:' || m.query || ':' || to_char(latest, 'IYYY-IW'),
           format(case when m.delta <= 0
                       then '📈 순위 상승: “%s” %s위 → %s위 (최근 7일 노출 %s회)'
                       else '📉 순위 하락: “%s” %s위 → %s위 (최근 7일 노출 %s회)' end,
                  m.query, round(m.prev_pos::numeric, 1), round(m.cur_pos::numeric, 1), m.cur_imps),
           jsonb_build_object('query', m.query, 'from', round(m.prev_pos::numeric, 1), 'to', round(m.cur_pos::numeric, 1))
    from (
      select c.query, c.wpos as cur_pos, p.wpos as prev_pos, c.imps as cur_imps,
             c.wpos - p.wpos as delta
      from (select query, sum(position*impressions)/nullif(sum(impressions),0) as wpos, sum(impressions) as imps
            from mt_gsc_daily where day > latest - 7 group by query having sum(impressions) >= 3) c
      join (select query, sum(position*impressions)/nullif(sum(impressions),0) as wpos, sum(impressions) as imps
            from mt_gsc_daily where day > latest - 14 and day <= latest - 7 group by query having sum(impressions) >= 3) p
        using (query)
    ) m
    where abs(m.delta) >= 3
    order by abs(m.delta) desc limit 8
    on conflict (key) do nothing;
    get diagnostics n = row_count; ins := ins + n;

    -- 3) top-10 entry (last 3 data-days ≤ 10위, prior week > 10위)
    insert into mt_insights (kind, key, line, data)
    select 'gsc_top10',
           'top10:' || t.query || ':' || to_char(latest, 'IYYY-IW'),
           format('🥇 톱10 진입: “%s” → %s (%s위)', t.query, replace(t.page, 'https://metatake.net', ''), round(t.wpos::numeric, 1)),
           jsonb_build_object('query', t.query, 'page', t.page, 'pos', round(t.wpos::numeric, 1))
    from (
      select c.query, c.page, c.wpos
      from (select query, page, sum(position*impressions)/nullif(sum(impressions),0) as wpos, sum(impressions) as imps
            from mt_gsc_daily where day > latest - 3 group by query, page having sum(impressions) >= 2) c
      join (select query, sum(position*impressions)/nullif(sum(impressions),0) as wpos
            from mt_gsc_daily where day > latest - 10 and day <= latest - 3 group by query having sum(impressions) >= 2) p
        using (query)
      where c.wpos <= 10 and p.wpos > 10
    ) t
    limit 8
    on conflict (key) do nothing;
    get diagnostics n = row_count; ins := ins + n;

    -- 4) impressions but zero clicks (weekly opportunity list)
    insert into mt_insights (kind, key, line, data)
    select 'gsc_zero_click',
           'zeroclick:' || z.page || ':' || to_char(latest, 'IYYY-IW'),
           format('💡 기회: %s — 최근 7일 노출 %s회·클릭 0 (평균 %s위). 제목/메타 개선 후보',
                  replace(z.page, 'https://metatake.net', ''), z.imps, round(z.wpos::numeric, 1)),
           jsonb_build_object('page', z.page, 'impressions', z.imps, 'pos', round(z.wpos::numeric, 1))
    from (
      select page, sum(impressions) as imps, sum(clicks) as clicks,
             sum(position*impressions)/nullif(sum(impressions),0) as wpos
      from mt_gsc_daily where day > latest - 7 group by page
    ) z
    where z.imps >= 15 and z.clicks = 0
    order by z.imps desc limit 6
    on conflict (key) do nothing;
    get diagnostics n = row_count; ins := ins + n;

    -- 5) first-ever click on a (query, page)
    insert into mt_insights (kind, key, line, data)
    select 'gsc_first_click',
           'firstclick:' || d.query || ':' || d.page,
           format('🖱️ 첫 클릭: “%s” → %s', d.query, replace(d.page, 'https://metatake.net', '')),
           jsonb_build_object('query', d.query, 'page', d.page)
    from mt_gsc_daily d
    where d.day = latest and d.clicks > 0
      and not exists (select 1 from mt_gsc_daily e
                      where e.query = d.query and e.page = d.page and e.day < latest and e.clicks > 0)
    limit 8
    on conflict (key) do nothing;
    get diagnostics n = row_count; ins := ins + n;

    -- 6) weekly search digest (once per ISO week of data)
    insert into mt_insights (kind, key, line, data)
    select 'gsc_week',
           'gscweek:' || to_char(latest, 'IYYY-IW'),
           format('📊 검색 주간: 노출 %s회(전주 %s) · 클릭 %s회(전주 %s) · 평균 %s위',
                  w.ci, coalesce(w.pi_::text, '–'), w.cc, coalesce(w.pc::text, '–'),
                  coalesce(round(w.cpos::numeric, 1)::text, '–')),
           jsonb_build_object('impressions', w.ci, 'clicks', w.cc)
    from (
      select
        (select coalesce(sum(impressions),0) from mt_gsc_daily where day > latest - 7)  as ci,
        (select coalesce(sum(clicks),0)      from mt_gsc_daily where day > latest - 7)  as cc,
        (select sum(impressions) from mt_gsc_daily where day > latest - 14 and day <= latest - 7) as pi_,
        (select sum(clicks)      from mt_gsc_daily where day > latest - 14 and day <= latest - 7) as pc,
        (select sum(position*impressions)/nullif(sum(impressions),0) from mt_gsc_daily where day > latest - 7) as cpos
    ) w
    where w.ci > 0
    on conflict (key) do nothing;
    get diagnostics n = row_count; ins := ins + n;
  end if;

  -- ── behaviour detectors (mt_events) ────────────────────────────────────

  -- 7) traffic spike: last completed hour ≥ 3× the 7-day same-hour average
  insert into mt_insights (kind, key, line, data)
  select 'traffic_spike',
         'spike:' || to_char(s.h, 'YYYY-MM-DD HH24'),
         format('🚀 트래픽 급증: %s시(KST) 페이지뷰 %s회 — 평소 같은 시간대 평균 %s회',
                to_char(s.h at time zone 'Asia/Seoul', 'MM-DD HH24'), s.cur, round(s.base, 1)),
         jsonb_build_object('hour', to_char(s.h, 'YYYY-MM-DD HH24:00'), 'pv', s.cur, 'base', round(s.base, 1))
  from (
    select date_trunc('hour', now() - interval '1 hour') as h,
           (select count(*) from mt_events where type = 'pageview'
             and ts >= date_trunc('hour', now() - interval '1 hour')
             and ts <  date_trunc('hour', now())) as cur,
           (select avg(c) from (
              select count(*) as c from mt_events
              where type = 'pageview'
                and ts >= date_trunc('hour', now()) - interval '7 days'
                and ts <  date_trunc('hour', now() - interval '1 hour')
                and date_part('hour', ts) = date_part('hour', now() - interval '1 hour')
              group by date_trunc('hour', ts)
            ) b) as base
  ) s
  where s.base is not null and s.cur >= 30 and s.cur >= 3 * s.base
  on conflict (key) do nothing;
  get diagnostics n = row_count; ins := ins + n;

  -- 8) new referrer domain (first seen in 24h, ≥ 2 pageviews)
  insert into mt_insights (kind, key, line, data)
  select 'new_referrer', 'ref:' || r.dom,
         format('🔗 새 유입처: %s (24시간 %s회)', r.dom, r.cnt),
         jsonb_build_object('domain', r.dom, 'n', r.cnt)
  from (
    select ref_domain as dom, count(*) as cnt, min(ts) as first_ts
    from mt_events
    where type = 'pageview' and coalesce(ref_domain, '') <> '' and ts > now() - interval '30 days'
    group by 1
  ) r
  where r.first_ts > now() - interval '24 hours' and r.cnt >= 2
  order by r.cnt desc limit 8
  on conflict (key) do nothing;
  get diagnostics n = row_count; ins := ins + n;

  -- 9) new country (first seen in 24h, ≥ 3 visitors)
  insert into mt_insights (kind, key, line, data)
  select 'new_country', 'country:' || c.ctry,
         format('🌍 새 방문 국가: %s (24시간 방문자 %s명)', c.ctry, c.vis),
         jsonb_build_object('country', c.ctry, 'visitors', c.vis)
  from (
    select country as ctry, count(distinct visitor) filter (where ts > now() - interval '24 hours') as vis,
           min(ts) as first_ts
    from mt_events
    where type = 'pageview' and country is not null and ts > now() - interval '30 days'
    group by 1
  ) c
  where c.first_ts > now() - interval '24 hours' and c.vis >= 3
  limit 8
  on conflict (key) do nothing;
  get diagnostics n = row_count; ins := ins + n;

  -- 10) on-site searches with zero hits (content gap, weekly)
  insert into mt_insights (kind, key, line, data)
  select 'search_zero', 'searchzero:' || z.q || ':' || to_char(now(), 'IYYY-IW'),
         format('🕳️ 사이트 검색 무결과: “%s” (%s회) — 콘텐츠 갭 후보', z.q, z.cnt),
         jsonb_build_object('q', z.q, 'n', z.cnt)
  from (
    select lower(props->>'q') as q, count(*) as cnt
    from mt_events
    where type = 'search' and (props->>'hits')::int = 0 and ts > now() - interval '7 days'
    group by 1
  ) z
  where z.cnt >= 2
  order by z.cnt desc limit 6
  on conflict (key) do nothing;
  get diagnostics n = row_count; ins := ins + n;

  -- 11/12) dwell outliers (weekly): long-read pages + shallow popular pages
  select avg((props->>'dwell_ms')::numeric) / 1000 into site_dwell
  from mt_events where type = 'leave' and props ? 'dwell_ms' and ts > now() - interval '7 days';

  if site_dwell is not null then
    insert into mt_insights (kind, key, line, data)
    select 'sticky_page', 'sticky:' || d.path || ':' || to_char(now(), 'IYYY-IW'),
           format('📖 오래 읽는 페이지: %s (평균 %s초 · 사이트 평균 %s초)', d.path, round(d.dwell), round(site_dwell)),
           jsonb_build_object('path', d.path, 'dwell_s', round(d.dwell))
    from (
      select path, avg((props->>'dwell_ms')::numeric) / 1000 as dwell, count(*) as leaves
      from mt_events
      where type = 'leave' and props ? 'dwell_ms' and ts > now() - interval '7 days'
      group by path
    ) d
    where d.leaves >= 10 and d.dwell >= greatest(90, 2 * site_dwell)
    order by d.dwell desc limit 5
    on conflict (key) do nothing;
    get diagnostics n = row_count; ins := ins + n;
  end if;

  insert into mt_insights (kind, key, line, data)
  select 'shallow_popular', 'shallow:' || s.path || ':' || to_char(now(), 'IYYY-IW'),
         format('⚠️ 인기인데 얕게 읽힘: %s (7일 조회 %s · 평균 스크롤 %s%%)', s.path, s.pv, round(s.scroll)),
         jsonb_build_object('path', s.path, 'pv', s.pv, 'scroll', round(s.scroll))
  from (
    select l.path,
           avg((l.props->>'scroll_pct')::numeric) as scroll,
           count(*) as leaves,
           (select count(*) from mt_events p where p.type = 'pageview' and p.path = l.path and p.ts > now() - interval '7 days') as pv
    from mt_events l
    where l.type = 'leave' and l.props ? 'scroll_pct' and l.ts > now() - interval '7 days'
    group by l.path
  ) s
  where s.pv >= 50 and s.leaves >= 10 and s.scroll <= 25
  order by s.pv desc limit 5
  on conflict (key) do nothing;
  get diagnostics n = row_count; ins := ins + n;

  -- 13) slow LCP (weekly)
  insert into mt_insights (kind, key, line, data)
  select 'slow_lcp', 'lcp:' || to_char(now(), 'IYYY-IW'),
         format('🐢 느린 로딩: LCP p75 %sms (7일, 표본 %s)', round(v.p75), v.cnt),
         jsonb_build_object('p75', round(v.p75), 'n', v.cnt)
  from (
    select percentile_cont(0.75) within group (order by (props->>'value')::numeric) as p75, count(*) as cnt
    from mt_events
    where type = 'vital' and props->>'name' = 'LCP' and ts > now() - interval '7 days'
  ) v
  where v.cnt >= 30 and v.p75 > 4000
  on conflict (key) do nothing;
  get diagnostics n = row_count; ins := ins + n;

  return ins;
end;
$fn$;

-- ── GSC overview panel (dashboard) ─────────────────────────────────────────
create or replace function public.mt_gsc_overview_json(p_days int default 28)
returns jsonb
language sql stable
set search_path = public
as $$
with latest as (select max(day) as d from mt_gsc_daily),
cur as (
  select * from mt_gsc_daily where day > (select d from latest) - p_days
),
series as (
  select day, sum(clicks) as clicks, sum(impressions) as impressions
  from cur group by day
),
w1 as (select * from mt_gsc_daily where day > (select d from latest) - 7),
w0 as (select * from mt_gsc_daily where day > (select d from latest) - 14 and day <= (select d from latest) - 7),
totals as (
  select
    (select coalesce(sum(impressions), 0) from w1) as impressions_7d,
    (select coalesce(sum(clicks), 0) from w1)      as clicks_7d,
    (select round((sum(position*impressions)/nullif(sum(impressions),0))::numeric, 1) from w1) as pos_7d,
    (select coalesce(sum(impressions), 0) from w0) as impressions_prev,
    (select coalesce(sum(clicks), 0) from w0)      as clicks_prev,
    (select round((sum(position*impressions)/nullif(sum(impressions),0))::numeric, 1) from w0) as pos_prev,
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

revoke execute on function public.mt_generate_insights() from anon, authenticated, public;
revoke execute on function public.mt_gsc_overview_json(int) from anon, authenticated, public;
