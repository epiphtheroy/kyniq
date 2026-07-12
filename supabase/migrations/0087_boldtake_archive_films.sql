-- Scoped archive: retire a specific run's framework-null extraction takes (NOT global).
-- boldtake_archive_old() retires ALL framework-null takes; the factory needs a per-run scope
-- so an incremental promotion never touches other films' takes.
create or replace function public.boldtake_archive_films(p_film_ids uuid[])
returns integer
language plpgsql
security definer
set statement_timeout to '0'
as $$
declare n int;
begin
  update takes tk set status='retired'
  from figures g
  where tk.figure_id = g.id
    and g.film_id = any(p_film_ids)
    and tk.framework is null
    and tk.status <> 'retired'
    and coalesce(tk.is_invitation,false) = false;
  get diagnostics n = row_count; return n;
end $$;

grant execute on function public.boldtake_archive_films(uuid[]) to service_role;
