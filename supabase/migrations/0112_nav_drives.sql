-- 0112: The Navigator — drive persistence (HANDOFF-내비게이터-시네필터바이턴.md §8, P5 잔여 ③).
-- A "drive" is the in-progress journey state a member starts by pressing 안내 시작.
-- INVARIANT (§10-1): the chevron position + progress are NEVER stored — they stay
-- derived from user_movies ∩ destination. This row only remembers WHICH destination
-- the member is on and their route preference, so /room/navigator can offer 이어가기.
-- Additive only; no existing objects touched. Not wired to a writer yet (groundwork).

create table if not exists public.nav_drives (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  dest_kind  text not null,                    -- 'dir' | 'lineage' | 'decade' | 'sub'
  dest_key   text not null,                    -- slug / lineage slug / decade year / 'mine'
  route_pref text not null default 'fewest',   -- 'fewest' | 'fastest' | 'no_tolls'
  started_at timestamptz not null default now(),
  skipped    jsonb not null default '[]'::jsonb,  -- slugs sent to the back of the route
  arrived_at timestamptz                       -- null = active; set on 도착
);
-- One active drive per member (v1: a Navigator guides one destination at a time, §2).
create unique index if not exists nav_drives_one_active
  on public.nav_drives (user_id) where arrived_at is null;
create index if not exists nav_drives_user_idx on public.nav_drives (user_id, started_at desc);

-- Deny-all RLS: RLS on with no policies = client can't touch it. Writes go through the
-- service role (worker/BFF); reads for the member go through the me_* RPC below.
alter table public.nav_drives enable row level security;

-- The member's active drive (arrived_at is null), most recent first. SECURITY DEFINER so
-- it reads past deny-all RLS, but returns only this member's own row (scoped to auth.uid()).
create or replace function public.me_nav_active()
returns table (
  dest_kind  text,
  dest_key   text,
  route_pref text,
  started_at timestamptz,
  skipped    jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select dest_kind, dest_key, route_pref, started_at, skipped
  from public.nav_drives
  where user_id = auth.uid() and arrived_at is null
  order by started_at desc
  limit 1;
$$;

revoke all on function public.me_nav_active() from public;
revoke execute on function public.me_nav_active() from anon;
grant execute on function public.me_nav_active() to authenticated;
