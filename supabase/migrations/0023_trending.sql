-- 0023 — trending: daily view events (for "this week") + a blended trending RPC.

create table if not exists public.view_events (
  entity_type text not null default 'meta_take',
  entity_id   uuid not null,
  day         date not null default current_date,
  n           int  not null default 0,
  primary key (entity_type, entity_id, day)
);
alter table public.view_events enable row level security;
drop policy if exists "view_events read" on public.view_events;
create policy "view_events read" on public.view_events for select using (true);
grant select on public.view_events to anon, authenticated;

-- extend the existing beacon RPC to also bump today's bucket (weekly data accrues from now)
create or replace function public.increment_meta_take_views(p_slug text)
returns void language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  update public.meta_takes set view_count = view_count + 1
   where slug = p_slug and status = 'published'
  returning id into mid;
  if mid is not null then
    insert into public.view_events(entity_type, entity_id, day, n)
    values ('meta_take', mid, current_date, 1)
    on conflict (entity_type, entity_id, day) do update set n = view_events.n + 1;
  end if;
end;
$$;
grant execute on function public.increment_meta_take_views(text) to anon, authenticated;

-- trending meta takes. p_window: 'week' (last 7 days of views) or 'all' (cumulative).
-- score blends engagement (views, likes) with connectedness (films) so the board
-- is meaningful before real traffic accrues, then shifts to engagement with use.
create or replace function public.trending_meta_takes(p_window text default 'all', p_limit int default 30)
returns table(slug text, title text, laconic text, views int, likes int, films int, score numeric)
language sql stable as $$
  with v as (
    select m.id, m.slug, m.title, m.laconic,
      case when p_window = 'week'
        then coalesce((select sum(e.n) from view_events e
                        where e.entity_type='meta_take' and e.entity_id=m.id and e.day >= current_date - 6), 0)
        else m.view_count end::int as views,
      coalesce((select count(*) from user_pins up
                 where up.kind='like' and up.entity_type='meta_take' and up.entity_id=m.id),0)::int as likes,
      coalesce((select fc.film_count from meta_take_film_counts fc where fc.meta_take_id=m.id),0)::int as films
    from meta_takes m
    where m.status='published'
  )
  select slug, title, laconic, views, likes, films,
         (views + likes*3 + films*0.5)::numeric as score
  from v
  order by score desc, views desc, films desc, title
  limit p_limit;
$$;
grant execute on function public.trending_meta_takes(text, int) to anon, authenticated;
