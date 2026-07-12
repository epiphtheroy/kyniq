-- Permanent engine stage: resolve takes.theorist_name -> takes.theorist_id for a scoped set of
-- films. boldtake-load stores only the name (the model's free-text output); nothing else in the
-- repo ever back-fills theorist_id, so every film added through the incremental engine was
-- invisible on /theorist pages until this ran (confirmed: 0/130 linked for the 20-film batch,
-- vs 100% for the pre-existing corpus). Exact case-insensitive match only — theorists.name has
-- pre-existing composite "A, B" / "A / B" pollution rows (see memory theorists-table-composite-
-- pollution); fuzzy/substring matching would false-link into those. A name with no exact match
-- (e.g. a real person referenced as a concept, not a critical theorist) is correctly left null.
create or replace function public.factory_theorist_link(p_film_ids uuid[])
returns integer
language plpgsql
security definer
as $$
declare n int;
begin
  update takes tk set theorist_id = th.id
  from figures g, theorists th
  where tk.figure_id = g.id
    and g.film_id = any(p_film_ids)
    and tk.status = 'published'
    and tk.theorist_name is not null
    and tk.theorist_id is null
    and lower(th.name) = lower(tk.theorist_name);
  get diagnostics n = row_count; return n;
end $$;

grant execute on function public.factory_theorist_link(uuid[]) to service_role;
