-- 0081_crawler_handshake.sql
-- Observe crawlers that visit metatake.net (User-Agent + self-declared homepage
-- URL) and record polite "visit-back" handshakes so our own MetatakeBot leaves
-- metatake.net in their logs. Consumed by:
--   app/api/bots/observe   (records visits, seeds pending handshakes)
--   lib/bots/handshake     (visits back, robots-respecting, 1×/host/30d)
-- Service-role only, RLS on with no policies (mirrors mt_events / bot_blocks).

-- One row per distinct crawler User-Agent seen.
create table if not exists public.mt_crawler_visits (
  id            bigint generated always as identity primary key,
  ua            text        not null unique,
  bot_name      text,
  declared_url  text,
  declared_host text,
  ip_prefix     text,
  sample_path   text,
  hits          integer     not null default 1,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now()
);
create index if not exists mt_crawler_visits_host_idx
  on public.mt_crawler_visits (declared_host) where declared_host is not null;
create index if not exists mt_crawler_visits_lastseen_idx
  on public.mt_crawler_visits (last_seen desc);

-- One row per declared host we may visit back.
create table if not exists public.mt_crawler_handshakes (
  id           bigint generated always as identity primary key,
  host         text        not null unique,
  target_url   text        not null,
  status       text        not null default 'pending', -- pending|done|robots_blocked|skipped|error
  http_status  integer,
  reason       text,
  attempts     integer     not null default 0,
  first_seen   timestamptz not null default now(),
  last_attempt timestamptz
);
create index if not exists mt_crawler_handshakes_status_idx
  on public.mt_crawler_handshakes (status, last_attempt);

-- Upsert a visit (atomic hit counter) and seed a pending handshake for a newly
-- seen host. Called from app/api/bots/observe with the service role.
create or replace function public.mt_crawler_observe(
  p_ua            text,
  p_bot_name      text,
  p_declared_url  text,
  p_declared_host text,
  p_ip_prefix     text,
  p_path          text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mt_crawler_visits as v
    (ua, bot_name, declared_url, declared_host, ip_prefix, sample_path)
  values (p_ua, p_bot_name, p_declared_url, p_declared_host, p_ip_prefix, p_path)
  on conflict (ua) do update set
    hits          = v.hits + 1,
    last_seen     = now(),
    ip_prefix     = coalesce(excluded.ip_prefix, v.ip_prefix),
    sample_path   = coalesce(excluded.sample_path, v.sample_path),
    declared_url  = coalesce(v.declared_url, excluded.declared_url),
    declared_host = coalesce(v.declared_host, excluded.declared_host),
    bot_name      = coalesce(v.bot_name, excluded.bot_name);

  if p_declared_host is not null and p_declared_url is not null then
    insert into public.mt_crawler_handshakes (host, target_url)
    values (p_declared_host, p_declared_url)
    on conflict (host) do nothing;
  end if;
end;
$$;

alter table public.mt_crawler_visits     enable row level security;
alter table public.mt_crawler_handshakes enable row level security;
revoke all on public.mt_crawler_visits     from anon, authenticated;
revoke all on public.mt_crawler_handshakes from anon, authenticated;
revoke all on function public.mt_crawler_observe(text,text,text,text,text,text) from anon, authenticated;
