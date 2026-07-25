-- 0111: Weekly returning visitors — the companion north-star metric
-- (HANDOFF-사업전략-생존과성장.md §6.5: GSC는 관찰만, 북극성=주간 재방문자).
--
-- props->>'wv' is a week-scoped visitor hash (sha256(isoweek|ip|ua|salt),
-- 24 hex chars) written by app/api/metrics/route.ts on pageview events since
-- 2026-07-25. Same privacy properties as the daily `visitor` column: rotates
-- every ISO week, no PII, useless for cross-week tracking.
--
-- "Returning" = a wv seen on >= 2 distinct days within one ISO week.
-- The /admin/metrics panel fails soft until this migration is applied
-- (same pattern as the GSC panels).

create index if not exists mt_events_wv_idx
  on public.mt_events ((props ->> 'wv'), ts)
  where type = 'pageview' and props ? 'wv';

create or replace function public.mt_weekly_return_json(p_weeks int default 8)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with pv as (
    select props ->> 'wv'            as wv,
           (ts at time zone 'Asia/Seoul')::date as d,
           to_char(ts at time zone 'Asia/Seoul', 'IYYY-"W"IW') as wk
    from mt_events
    where type = 'pageview'
      and props ? 'wv'
      and ts >= date_trunc('week', now() at time zone 'Asia/Seoul')
                - (greatest(p_weeks, 1) || ' weeks')::interval
  ),
  per as (
    select wk, wv, count(distinct d) as days
    from pv
    group by wk, wv
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('week', wk, 'visitors', visitors, 'returning', returning)
      order by wk
    ),
    '[]'::jsonb
  )
  from (
    select wk,
           count(*)                              as visitors,
           count(*) filter (where days >= 2)     as returning
    from per
    group by wk
  ) x;
$$;

-- Dashboard calls this with the service-role admin client only (0058 pattern).
revoke execute on function public.mt_weekly_return_json(int) from anon, authenticated, public;
