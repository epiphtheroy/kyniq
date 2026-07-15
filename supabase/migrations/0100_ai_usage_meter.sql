-- 0100_ai_usage_meter.sql — AI usage admin "The Meter" (/admin/usage)
-- Canonical: HANDOFF-AI사용현황-어드민.md. Additive, owner-run via apply-sql.py.
--
-- Ledger for /api/v1 REST calls (mcp_calls 0093 already covers MCP), daily rollup
-- tables, and the single-row jsonb read RPC + the 30-min rollup RPC. RLS enabled
-- with ZERO policies = service_role only, matching mcp_calls (0093) / pack_hits
-- (0091). All read RPCs are security-definer, revoked from public/anon/auth.

-- ── 1. api_calls — per-REST-call ledger (mirrors mcp_calls shape) ────────────
-- NOTE: /api/v1 responses are CDN-cached (s-maxage 86400), so a row is written
-- only on a cache MISS. Counts are "distinct fetches", NOT raw loads — the
-- dashboard states this. Inserts sit OUTSIDE the trusted-egress short-circuit
-- (lib/apiGuard guardAndLog) so Anthropic/Claude traffic is ledgered too.
create table if not exists public.api_calls (
  id       bigint generated always as identity primary key,
  ts       timestamptz not null default now(),
  endpoint text not null,          -- 'films_search' | 'film' | 'takescore' | 'locations'
  arg      text,                    -- slug or query, truncated 200 by the caller
  prefix   text,                    -- ip /24
  ua       text,                    -- truncated 300 by the caller
  ok       boolean not null default true,  -- false = harvest-blocked (429)
  ms       integer
);
create index if not exists api_calls_ts_idx on public.api_calls (ts desc);
create index if not exists api_calls_endpoint_ts_idx on public.api_calls (endpoint, ts desc);
alter table public.api_calls enable row level security;

-- ── 2. rollup tables (fed by usage_rollup, read for long-term trends) ────────
create table if not exists public.usage_daily (
  day    date not null,
  source text not null,            -- 'mcp' | 'api'
  key    text not null,            -- tool name or endpoint
  calls  integer not null default 0,
  prefixes integer not null default 0,
  primary key (day, source, key)
);
alter table public.usage_daily enable row level security;

-- Per-day AI-crawler hits, derived by diffing mt_crawler_visits' cumulative
-- counters against a snapshot (that table has no time series of its own).
-- Raw ua is stored; the dashboard classifies (bot_name parsing is unreliable).
create table if not exists public.crawler_daily (
  day  date not null,
  ua   text not null,
  hits integer not null default 0,  -- delta accumulated within the day
  primary key (day, ua)
);
create table if not exists public.crawler_snapshot (
  ua    text primary key,
  hits  integer not null,           -- last-seen cumulative total for this ua
  taken timestamptz not null default now()
);
alter table public.crawler_daily enable row level security;
alter table public.crawler_snapshot enable row level security;

-- ── 3. usage_overview_json — the dashboard read (single-row jsonb) ───────────
-- p_noise=false (default) hides MCP handshakes (_initialize/_tools_list) and
-- health-checker traffic from the headline; the raw rows are still summarised so
-- the "directory discovery" tier can show them. Returns everything /admin/usage
-- needs in one call (dodges the PostgREST 1000-row cap). Client/crawler UA
-- family classification is done in TS (lib/aiClients.classifyAiClient) — this
-- RPC returns raw-by-ua rows (bounded, ~dozens).
create or replace function public.usage_overview_json(
  p_from timestamptz,
  p_to   timestamptz,
  p_noise boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with
  mcp as (
    select * from public.mcp_calls where ts >= p_from and ts < p_to
  ),
  mcp_real as (  -- genuine tool calls (exclude the handshake pseudo-tools)
    select * from mcp where tool not in ('_initialize', '_tools_list')
  ),
  api as (
    select * from public.api_calls where ts >= p_from and ts < p_to
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),

    'mcp', jsonb_build_object(
      'total',      (select count(*) from mcp),
      'handshakes', (select count(*) from mcp where tool in ('_initialize','_tools_list')),
      'tool_calls', (select count(*) from mcp_real),
      'clients',    (select count(distinct prefix) from mcp),
      'by_tool',    coalesce((select jsonb_agg(t) from (
                      select tool, count(*)::int n,
                             round(100.0*count(*) filter (where ok)/greatest(count(*),1))::int ok_pct
                      from mcp_real group by tool order by n desc limit 10) t), '[]'::jsonb),
      'series',     coalesce((select jsonb_agg(s order by (s->>'day')) from (
                      select jsonb_build_object('day', d::date, 'calls', count(*)::int,
                                                'prefixes', count(distinct prefix)::int) s
                      from (select ts, prefix from (select * from mcp where p_noise) u
                            union all select ts, prefix from mcp_real) rows,
                           lateral (select rows.ts::date d) x
                      group by d) s), '[]'::jsonb)
    ),

    'api', jsonb_build_object(
      'total',      (select count(*) from api),
      'blocked',    (select count(*) from api where not ok),
      'clients',    (select count(distinct prefix) from api),
      'by_endpoint', coalesce((select jsonb_agg(t) from (
                      select endpoint, count(*)::int n, count(*) filter (where not ok)::int blocked
                      from api group by endpoint order by n desc limit 10) t), '[]'::jsonb),
      'series',     coalesce((select jsonb_agg(s order by (s->>'day')) from (
                      select jsonb_build_object('day', ts::date, 'calls', count(*)::int,
                                                'prefixes', count(distinct prefix)::int) s
                      from api group by ts::date) s), '[]'::jsonb)
    ),

    -- demand: what films/queries are being asked for (topic signal → content pipeline).
    -- Joins films so the dashboard can badge tier / "factory candidate".
    'demand', coalesce((select jsonb_agg(t) from (
        select d.arg, sum(d.n)::int n,
               jsonb_agg(distinct d.source) sources,
               f.slug is not null as is_film,
               coalesce(f.is_analyzed, false) as is_analyzed,
               coalesce(f.visible, false) as visible
        from (
          select arg, 'mcp' source, count(*) n from mcp_real where arg is not null group by arg
          union all
          select arg, 'api' source, count(*) n from api where arg is not null group by arg
        ) d
        left join public.films f on f.slug = d.arg
        group by d.arg, f.slug, f.is_analyzed, f.visible
        order by n desc limit 25) t), '[]'::jsonb),

    -- clients: raw by-ua (dashboard groups into families). trusted = Anthropic /21.
    'clients', coalesce((select jsonb_agg(t) from (
        select ua, sum(n)::int n, count(distinct prefix)::int prefixes,
               bool_or(prefix ~ '^160\.79\.(10[4-9]|11[0-1])$') as trusted
        from (
          select ua, prefix, count(*) n from mcp group by ua, prefix
          union all
          select ua, prefix, count(*) n from api group by ua, prefix
        ) u group by ua order by n desc limit 30) t), '[]'::jsonb),

    -- AI web crawlers: raw by-ua aggregate of the cumulative visit counters
    -- (mt_crawler_visits, 0081). Dashboard classifies + filters to AI families.
    'crawler', coalesce((select jsonb_agg(t) from (
        select ua, sum(hits)::int hits, max(last_seen) last_seen
        from public.mt_crawler_visits group by ua order by hits desc limit 40) t), '[]'::jsonb),

    'packs', jsonb_build_object(
      'downloads',    (select count(*) from public.pack_downloads),
      'top_films',    coalesce((select jsonb_agg(t) from (
                        select slug, count(*)::int n from public.pack_downloads
                        group by slug order by n desc limit 8) t), '[]'::jsonb),
      'defense_hits', coalesce((select sum(hits)::int from public.pack_hits_daily), 0)
    ),

    'freshness', jsonb_build_object(
      'mcp_calls',  (select max(ts) from public.mcp_calls),
      'api_calls',  (select max(ts) from public.api_calls),
      'crawler',    (select max(last_seen) from public.mt_crawler_visits),
      'usage_daily',(select max(day) from public.usage_daily)
    )
  );
$$;

comment on function public.usage_overview_json(timestamptz, timestamptz, boolean) is
  'AI usage dashboard (/admin/usage) single-row read. HANDOFF-AI사용현황-어드민.md.';

revoke execute on function public.usage_overview_json(timestamptz, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.usage_overview_json(timestamptz, timestamptz, boolean) to service_role;

-- ── 4. usage_rollup — 30-min cron rider: daily fold, crawler diff, 90d GC ────
create or replace function public.usage_rollup()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  had_snapshot boolean;
begin
  -- (a) fold today's + yesterday's mcp_calls into usage_daily (catch late writes)
  insert into public.usage_daily (day, source, key, calls, prefixes)
  select ts::date, 'mcp', tool, count(*)::int, count(distinct prefix)::int
  from public.mcp_calls where ts >= (current_date - 1)
  group by ts::date, tool
  on conflict (day, source, key) do update set calls = excluded.calls, prefixes = excluded.prefixes;

  insert into public.usage_daily (day, source, key, calls, prefixes)
  select ts::date, 'api', endpoint, count(*)::int, count(distinct prefix)::int
  from public.api_calls where ts >= (current_date - 1)
  group by ts::date, endpoint
  on conflict (day, source, key) do update set calls = excluded.calls, prefixes = excluded.prefixes;

  -- (b) crawler daily = diff of cumulative hits vs snapshot (accumulate within day)
  select exists (select 1 from public.crawler_snapshot) into had_snapshot;
  if had_snapshot then
    insert into public.crawler_daily (day, ua, hits)
    select current_date, cur.ua, (cur.h - coalesce(s.hits, 0))
    from (select ua, sum(hits)::int h from public.mt_crawler_visits group by ua) cur
    left join public.crawler_snapshot s on s.ua = cur.ua
    where (cur.h - coalesce(s.hits, 0)) > 0
    on conflict (day, ua) do update set hits = public.crawler_daily.hits + excluded.hits;
  end if;
  -- refresh snapshot to current cumulative (first run just seeds it)
  insert into public.crawler_snapshot (ua, hits, taken)
  select ua, sum(hits)::int, now() from public.mt_crawler_visits group by ua
  on conflict (ua) do update set hits = excluded.hits, taken = now();

  -- (c) retention: raw ledgers 90 days (daily rollup is permanent)
  delete from public.mcp_calls where ts < now() - interval '90 days';
  delete from public.api_calls where ts < now() - interval '90 days';
end;
$$;

comment on function public.usage_rollup() is
  'AI usage 30-min rollup rider (usage_daily fold + crawler_daily diff + 90d GC). HANDOFF-AI사용현황-어드민.md §4.';

revoke execute on function public.usage_rollup() from public, anon, authenticated;
grant execute on function public.usage_rollup() to service_role;
