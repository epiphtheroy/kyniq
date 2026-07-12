-- factory_queue_run(): create a 'queued' run from eligible intake and link it.
-- Single source of truth for BOTH the /admin/factory "Run" button and `factory.py queue`.
-- The Mac watcher (worker/factory-watch.sh) claims queued runs (queued->running) and executes.
create or replace function public.factory_queue_run()
returns bigint
language plpgsql
security definer
set search_path = public, factory
as $$
declare rid bigint; ntot int;
begin
  select count(*) into ntot
    from factory.intake where status in ('queued','approved') and run_id is null;
  if ntot = 0 then return null; end if;
  insert into factory.runs(mode, film_count, status)
    values('bulk', ntot, 'queued') returning id into rid;
  update factory.intake set run_id = rid
    where status in ('queued','approved') and run_id is null;
  return rid;
end $$;

grant execute on function public.factory_queue_run() to service_role;
