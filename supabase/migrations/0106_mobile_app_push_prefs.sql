-- 0106: Mobile app (Pre-Watch Companion) — push tokens, edition prefs, push ledger.
-- HANDOFF-모바일앱-프리워치.md §10.1. Additive only; no existing objects touched.

-- Device push tokens (Expo). Registration requires a signed-in user: the only push
-- product ("your watchlisted film arrived on your services") needs user_movies anyway,
-- and requiring auth keeps anon spam out of the table.
create table if not exists public.push_tokens (
  token        text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  country_code text not null default 'US',
  locale       text not null default 'en',
  platform     text not null default 'ios',
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Edition prefs: country (availability scope), locale (content), chosen providers.
-- Join key for the availability-diff push worker.
create table if not exists public.user_prefs (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  country_code text not null default 'US',
  locale       text not null default 'en',
  provider_ids int[] not null default '{}',
  push_enabled boolean not null default false,
  updated_at   timestamptz not null default now()
);
alter table public.user_prefs enable row level security;
drop policy if exists user_prefs_own on public.user_prefs;
create policy user_prefs_own on public.user_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Push ledger: which (user, film, provider, country) arrivals were already notified.
-- Written by the worker only (service role). RLS on with no policies = client deny-all.
create table if not exists public.push_sent (
  user_id      uuid not null references auth.users(id) on delete cascade,
  film_id      uuid not null references public.films(id) on delete cascade,
  provider_id  int  not null,
  country_code text not null,
  sent_at      timestamptz not null default now(),
  primary key (user_id, film_id, provider_id, country_code)
);
alter table public.push_sent enable row level security;
