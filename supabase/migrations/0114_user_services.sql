-- 0114_user_services.sql
-- Persist a member's streaming subscriptions to their ACCOUNT (previously the
-- ServicesPicker kept them in localStorage only, so they never reached the room /
-- navigator and reset per device). See HANDOFF-회원가입-전환-설계.md §8.
--
-- Apply: python3 worker/apply-sql.py supabase/migrations/0114_user_services.sql
-- (owner `!`). Until applied, the client falls back to localStorage (fault-soft).

create table if not exists public.user_services (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  country    text not null default 'US',
  providers  text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_services enable row level security;
drop policy if exists user_services_self on public.user_services;
create policy user_services_self on public.user_services
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- read own services (empty row = not set yet)
create or replace function public.me_services()
returns table(country text, providers text[])
language sql stable security definer set search_path = public as $$
  select s.country, s.providers from public.user_services s where s.user_id = auth.uid();
$$;

-- upsert own services
create or replace function public.me_set_services(p_country text, p_providers text[])
returns void
language sql volatile security definer set search_path = public as $$
  insert into public.user_services(user_id, country, providers, updated_at)
  values (auth.uid(), coalesce(nullif(p_country,''),'US'), coalesce(p_providers,'{}'::text[]), now())
  on conflict (user_id) do update
    set country = excluded.country, providers = excluded.providers, updated_at = now();
$$;

grant execute on function public.me_services() to authenticated;
grant execute on function public.me_set_services(text, text[]) to authenticated;
