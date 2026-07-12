-- 0093_mcp_calls.sql — usage ledger for the public Metatake MCP server (2026-07-13)
--
-- The MCP server (/api/mcp) is channel ② made concrete: AI assistants call our
-- tools at answer time and get attributed, linked, current data. This table is
-- the "취할 것만 취한다" side of that deal — every tools/call is logged (tool,
-- argument, /24 prefix, UA) so we can measure real demand, see which films AIs
-- ask about, and judge the whole strategy with numbers instead of hope.
--
-- Service-role writes only (RLS on, zero policies — same posture as pack_*).
-- Prefix (not full IP) keeps the Plausible-style no-PII stance of mt_events.

create table if not exists public.mcp_calls (
  id     bigint generated always as identity primary key,
  ts     timestamptz not null default now(),
  tool   text not null,           -- search_films | get_film_criticism | …
  arg    text,                    -- the slug or query (truncated)
  prefix text,                    -- caller /24 (v4) or /48 (v6)
  ua     text,                    -- client User-Agent (identifies the AI host app)
  ok     boolean not null default true,
  ms     int                      -- handler latency
);
create index if not exists mcp_calls_ts_idx   on public.mcp_calls (ts desc);
create index if not exists mcp_calls_tool_idx on public.mcp_calls (tool, ts desc);
alter table public.mcp_calls enable row level security;
