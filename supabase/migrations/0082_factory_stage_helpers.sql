-- 0082_factory_stage_helpers.sql — Film Factory stage executor functions (public SD)
-- Additive. Called by worker/factory.py for the SQL-typed stages (§5.2 S12/S27/S30/S39/S50/S51).
-- Mirror source: factory/sql/assertions.sql. Applied to live 2026-07-12.

-- S12: assert figures.slug not null across the run's films (0 = pass). Report-only.
create or replace function public.factory_assert_figure_slugs(p_film_ids uuid[])
returns int language sql security definer set search_path=public as $$
  select count(*)::int from public.figures where film_id = any(p_film_ids) and slug is null;
$$;
revoke all on function public.factory_assert_figure_slugs(uuid[]) from anon, authenticated;

-- S27: film_next reverse-target backfill (RUNBOOK §4.3d). Returns rows linked.
create or replace function public.factory_next_target_backfill()
returns int language plpgsql security definer set search_path=public as $$
declare n int;
begin
  update public.film_next fn set target_film_id = f.id
  from public.films f
  where fn.target_film_id is null and f.tmdb_id = fn.tmdb_id;
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.factory_next_target_backfill() from anon, authenticated;

-- S30: director_slugs of the run's films that have ZERO of the 4 director artifacts.
create or replace function public.factory_detect_new_directors(p_film_ids uuid[])
returns jsonb language sql security definer set search_path=public as $$
  with slugs as (
    select distinct f.director_slug s from public.films f
    where f.id = any(p_film_ids) and f.director_slug is not null
  )
  select coalesce(jsonb_agg(s.s), '[]'::jsonb) from slugs s
  where not exists (select 1 from public.director_portrait d where d.director_slug=s.s)
    and not exists (select 1 from public.director_picks   d where d.director_slug=s.s)
    and not exists (select 1 from public.director_facts   d where d.director_slug=s.s)
    and not exists (select 1 from public.director_next    d where d.director_slug=s.s);
$$;
revoke all on function public.factory_detect_new_directors(uuid[]) from anon, authenticated;

-- S39 (BLOCKER FIX): for full-tier films with >=3 approved figures, open the Tier-1 surfaces.
-- Sets is_analyzed=true, clears hold, and forces visible recompute (the live trigger only
-- watches `figures`, so clearing hold alone would not re-evaluate visible).  Returns count flipped.
create or replace function public.factory_analyzed_flip(p_film_ids uuid[])
returns int language plpgsql security definer set search_path=public as $$
declare n int;
begin
  update public.films f set
    is_analyzed = true,
    hold = false,
    visible = ((select count(*) from public.figures g where g.film_id=f.id and g.status='approved') >= 3)
  where f.id = any(p_film_ids)
    and (select count(*) from public.figures g where g.film_id=f.id and g.status='approved') >= 3;
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.factory_analyzed_flip(uuid[]) from anon, authenticated;

-- S50: per-film publication audit (surfaces the <3-figure films etc.).
create or replace function public.factory_run_audit(p_film_ids uuid[])
returns jsonb language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', f.slug, 'title', f.title,
    'figs', (select count(*) from public.figures g where g.film_id=f.id and g.status='approved'),
    'visible', f.visible, 'is_analyzed', f.is_analyzed, 'hold', coalesce(f.hold,false),
    'has_genres', (f.genres is not null and array_length(f.genres,1) >= 1),
    'has_overview', (f.overview is not null),
    'has_poster', (f.poster_path is not null)
  ) order by f.title), '[]'::jsonb)
  from public.films f where f.id = any(p_film_ids);
$$;
revoke all on function public.factory_run_audit(uuid[]) from anon, authenticated;

-- S51: bump last_processed_at (sitemap lastmod contract).
create or replace function public.factory_bump_lastmod(p_film_ids uuid[])
returns int language plpgsql security definer set search_path=public as $$
declare n int;
begin
  update public.films set last_processed_at = now() where id = any(p_film_ids);
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.factory_bump_lastmod(uuid[]) from anon, authenticated;
