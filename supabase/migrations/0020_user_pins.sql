-- 0020 — personalization: follow (pin) + like, per user, on any entity.
create table if not exists public.user_pins (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('film','figure','meta_take','take')),
  entity_id   uuid not null,
  kind        text not null check (kind in ('follow','like')),
  created_at  timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id, kind)
);
create index if not exists idx_user_pins_entity on public.user_pins (entity_type, entity_id, kind);

alter table public.user_pins enable row level security;
drop policy if exists "user_pins: rw own" on public.user_pins;
create policy "user_pins: rw own" on public.user_pins for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- public aggregate like counts (view owner bypasses RLS → readable by anon)
create or replace view public.like_counts as
  select entity_type, entity_id, count(*)::int as likes
  from public.user_pins where kind='like'
  group by entity_type, entity_id;
grant select on public.like_counts to anon, authenticated;

-- the caller's own pins, enriched with entity title/slug for the /me dashboard
create or replace function public.get_my_pins()
returns table(kind text, entity_type text, slug text, film_slug text, title text, sub text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.kind, p.entity_type,
    case p.entity_type when 'film' then f.slug when 'meta_take' then m.slug when 'figure' then fig.slug end as slug,
    case p.entity_type when 'figure' then ff.slug end as film_slug,
    case p.entity_type when 'film' then f.title when 'meta_take' then m.title when 'figure' then fig.label end as title,
    case p.entity_type when 'film' then f.year::text when 'meta_take' then m.laconic when 'figure' then ff.title end as sub,
    p.created_at
  from user_pins p
  left join films f       on p.entity_type='film'      and f.id = p.entity_id
  left join meta_takes m  on p.entity_type='meta_take' and m.id = p.entity_id
  left join figures fig   on p.entity_type='figure'    and fig.id = p.entity_id
  left join films ff      on p.entity_type='figure'    and ff.id = fig.film_id
  where p.user_id = auth.uid()
  order by p.created_at desc;
$$;
revoke all on function public.get_my_pins() from public;
grant execute on function public.get_my_pins() to authenticated;
