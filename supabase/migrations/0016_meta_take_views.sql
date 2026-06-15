-- 0016 — meta-take view counter + register aggregation view
-- (a) DB-native popularity counter for sorting the meta-takes index ("most viewed").
--     Independent of Vercel Web Analytics. Incremented client-side via RPC so it
--     counts real page views (ISR-cached server renders would undercount).
-- (b) meta_take_register_counts: per meta-take register tally, for the index's
--     "group by register" facet. Sparse until figure-enrichment populates registers.

-- (a) view counter -----------------------------------------------------------
alter table public.meta_takes
  add column if not exists view_count bigint not null default 0;

create or replace function public.increment_meta_take_views(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.meta_takes
     set view_count = view_count + 1
   where slug = p_slug and status = 'published';
$$;

revoke all on function public.increment_meta_take_views(text) from public;
grant execute on function public.increment_meta_take_views(text) to anon, authenticated;

-- (b) register tally per meta-take -------------------------------------------
create or replace view public.meta_take_register_counts as
select t.meta_take_id,
       t.register,
       count(*)::int as take_count
from public.takes t
where t.meta_take_id is not null
  and t.register is not null
group by t.meta_take_id, t.register;

grant select on public.meta_take_register_counts to anon, authenticated;
