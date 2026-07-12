-- Bulk intake insert with dedup — ONE round-trip for N films (the /admin/factory upload box
-- and `factory.py ingest` both call this). Mirrors factory_intake_add's auto->review rule.
create or replace function public.factory_intake_add_batch(
  p_source text, p_rows jsonb, p_requested_by text default 'admin')
returns integer
language plpgsql
security definer
set search_path = public, factory
as $$
declare
  r jsonb; n int := 0;
  v_title text; v_year int; v_tmdb int; v_dir text; v_tier text; eff_tier text; eff_status text;
begin
  if p_source is null or p_source not in ('csv','cli','admin','sentinel','promotion') then
    p_source := 'admin';
  end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    v_title := nullif(btrim(r->>'title'), '');
    if v_title is null then continue; end if;
    begin v_year := nullif(btrim(r->>'year'), '')::int; exception when others then v_year := null; end;
    begin v_tmdb := nullif(btrim(r->>'tmdb_id'), '')::int; exception when others then v_tmdb := null; end;
    v_dir  := nullif(btrim(r->>'director'), '');
    v_tier := lower(coalesce(nullif(btrim(r->>'tier'), ''), 'full'));
    if v_tier not in ('full','catalog','auto') then v_tier := 'full'; end if;
    if v_tier = 'auto' then eff_tier := 'catalog'; eff_status := 'review';
    else eff_tier := v_tier; eff_status := 'queued'; end if;
    -- dedup: skip a title(+year) already present and not rejected (avoids re-adding live/pending films)
    if exists (select 1 from factory.intake i
               where lower(i.raw_title) = lower(v_title)
                 and (i.year_hint is not distinct from v_year)
                 and i.status <> 'rejected') then
      continue;
    end if;
    insert into factory.intake(source, raw_title, year_hint, director_hint, tmdb_id, tier, status, requested_by)
    values (p_source, v_title, v_year, v_dir, v_tmdb, eff_tier, eff_status, p_requested_by);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.factory_intake_add_batch(text, jsonb, text) from anon, authenticated;
grant execute on function public.factory_intake_add_batch(text, jsonb, text) to service_role;
