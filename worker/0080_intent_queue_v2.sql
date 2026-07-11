-- 0080_intent_queue_v2.sql — layer-1 detector v2: bot-noise filter (2026-07-11)
--
-- docs/PLAN-intent-coverage.md §1 + §8 read-log. Wave 0+1 shipped 0079; its
-- live queue then caught operator/monitoring noise alongside the real search
-- demand — GSC surfaces automated queries too. Observed noise:
--   " -site:facebook.com" and friends — search operators from scrapers/tools,
--   "news for {brand}"                — monitoring/alert crawlers,
--   "wykop.pl …"                      — long operator chains from one aggregator.
-- None of these are answerable human intents, so the detector now excludes
-- them at the source and the queue's already-captured noise is retired to
-- 'rejected'. Everything else in mt_intent_scan() is unchanged from 0079:
-- 28-day window, ≥5 impressions, status left untouched on rescan (triage
-- survives), NEWLY-seen count via (xmax = 0), service-role only.

-- ── detector v2 ─────────────────────────────────────────────────────────────
create or replace function public.mt_intent_scan()
returns integer
language plpgsql
set search_path = public
as $fn$
declare
  new_rows int := 0;
begin
  with agg as (
    select page, query,
           sum(impressions)::int as imps,
           round((sum(position * impressions) / nullif(sum(impressions), 0))::numeric, 1) as wpos
    from mt_gsc_daily
    where day > current_date - 28
      -- v2: drop operator/monitoring bot queries (search operators, alert
      -- crawlers, aggregator operator chains) — never answerable intents.
      and query !~* '(\s-site:|^news for |wykop\.pl)'
    group by page, query
    having sum(impressions) >= 5
  ),
  upsert as (
    insert into intent_queue (page, query, imps, wpos)
    select a.page, a.query, a.imps, a.wpos
    from agg a
    on conflict (page, query) do update
       set imps      = excluded.imps,
           wpos      = excluded.wpos,
           last_seen = now()
       -- status deliberately untouched: triage survives every rescan.
    returning (xmax = 0) as is_new
  )
  select count(*) filter (where is_new) into new_rows from upsert;
  return new_rows;
end;
$fn$;

revoke execute on function public.mt_intent_scan() from anon, authenticated, public;

-- ── retire the noise already captured under 0079 ────────────────────────────
update intent_queue
   set status = 'rejected'
 where status = 'new'
   and query ~* '(\s-site:|^news for |wykop\.pl)';
