-- 0079_intent_queue.sql — layer-1 uncovered-intent detector (2026-07-11)
--
-- docs/PLAN-intent-coverage.md §1. GSC tells us which queries each page is
-- already shown for; this queue keeps the ones with real demand (≥5
-- impressions over a rolling 28-day window) so every coverage wave can check
-- whether the page actually ANSWERS them. status is the hand-worked triage
-- field and is never touched by rescans:
--   new      — detected, not yet triaged
--   covered  — the body already answers it
--   answered — a Quick-answers block was shipped for it
--   rejected — cannot be answered from data (no invention — charter §0-1)
--
--   intent_queue     — the work queue, one row per (page, query).
--   mt_intent_scan() — the detector; piggybacks the existing 30-min
--                      /api/metrics/insights cron (same slot as
--                      mt_detect_bots, 0078). Upserts demand numbers
--                      (imps / weighted position / last_seen) and returns the
--                      number of NEWLY seen (page, query) pairs.

-- ── table ─────────────────────────────────────────────────────────────────
create table if not exists public.intent_queue (
  id         bigint generated always as identity primary key,
  page       text not null,
  query      text not null,
  imps       int,
  wpos       numeric,                        -- impression-weighted avg position
  status     text not null default 'new',    -- new | covered | answered | rejected
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  unique (page, query)
);
alter table public.intent_queue enable row level security;
-- no policies: service-role only.

-- ── detector ──────────────────────────────────────────────────────────────
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
