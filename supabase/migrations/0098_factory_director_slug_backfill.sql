-- 0098_factory_director_slug_backfill.sql — resolve films.director (free text) -> films.director_slug
-- by EXACT case-insensitive full-name equality against an EXISTING directors row. The directors
-- analogue of 0088_factory_theorist_link. Used by the Tier-2 noindex factory (signal-recovery line).
--
-- SAFE by construction (verified live 2026-07-15: fills 105, leaves 3,894 NULL, 0 mis-assignments):
--   * UPDATE-only on films — can NEVER create a directors row.
--   * Skips composite director strings (comma / '&' / the word "and") — a co-director string must
--     not collapse onto one person's slug (the theorists composite-pollution lesson, for directors).
--   * Assigns only when the ci-exact match is UNIQUE (count(distinct slug)=1). directors.name has
--     NO unique constraint, so this runtime HAVING guard is the only thing preventing a homonym
--     mis-map. (Live: 0 ci-duplicate name groups today — but the guard is mandatory, not cosmetic.)
--   * Fills only rows where director_slug IS NULL (never clobbers a curated slug).
--   * Accent-strict (lower/btrim only): under-match is the safe failure mode.
create or replace function public.factory_director_slug_backfill(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with matched as (
    select f.id, min(d.slug) as slug
    from public.films f
    join public.directors d
      on lower(btrim(d.name)) = lower(btrim(f.director))
    where f.id = any(p_ids)
      and f.director_slug is null
      and f.director is not null
      and btrim(f.director) <> ''
      and position(',' in f.director) = 0
      and position('&' in f.director) = 0
      and f.director !~* '(^|[[:space:]])and([[:space:]]|$)'
    group by f.id
    having count(distinct d.slug) = 1
  )
  update public.films f
  set director_slug = m.slug
  from matched m
  where f.id = m.id
    and f.director_slug is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.factory_director_slug_backfill(uuid[]) to service_role;
