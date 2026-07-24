-- 0109: Connect — OAuth connections to external film services (Trakt/TMDB/Simkl).
-- HANDOFF-커넥트-기록이관.md §4, phase I2. Tokens are encrypted at rest
-- (AES-256-GCM, server-held key) AND never exposed to the client: the base
-- table has RLS enabled with NO client policies (deny-all, like push_sent), so
-- the anon/authenticated key cannot read the token columns at all. All token
-- use is mediated by the connect API under the service role. The app reads
-- token-free status via the me_connections() RPC below. Additive only.

create table if not exists public.user_connections (
  user_id          uuid not null references auth.users(id) on delete cascade,
  provider         text not null check (provider in ('trakt','tmdb','simkl')),
  -- encrypted at rest (iv:tag:ciphertext, base64) — server decrypts with CONNECT_TOKEN_KEY
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  account_ref      text,          -- provider account id (e.g. tmdb v4 account_object_id)
  scope            text,
  status           text not null default 'connected'
                     check (status in ('connected','error','revoked')),
  last_sync_at     timestamptz,
  sync_cursor      text,          -- incremental watermark (Simkl date_from / activities hash)
  synced_films     int  not null default 0,
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_connections enable row level security;
-- No client policies on purpose: token columns must never reach the client.
-- (RLS on + zero policies = deny-all to anon/authenticated; service role bypasses.)

-- Token-free status for the signed-in user — powers the Connect hub tiles.
-- SECURITY DEFINER so it can read past the deny-all RLS, but it returns only
-- non-secret columns and is scoped to auth.uid().
create or replace function public.me_connections()
returns table (
  provider     text,
  status       text,
  last_sync_at timestamptz,
  synced_films int,
  error        text,
  created_at   timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select provider, status, last_sync_at, synced_films, error, created_at
  from public.user_connections
  where user_id = auth.uid()
  order by created_at;
$$;

revoke all on function public.me_connections() from public;
revoke execute on function public.me_connections() from anon;
grant execute on function public.me_connections() to authenticated;
