-- 0061_tv_reel.sql — fallback trailer reel for the unified entity video hero.
-- Given a set of film slugs, return one clean trailer/teaser YouTube id per film
-- (deterministic order by slug hash) using the SAME clean-clip filter as the
-- broadcast compiler (0058): no explainers/featurettes/interviews. Security
-- definer + a function-level statement_timeout so the anon 3s wall never bites.
create or replace function public.tv_reel(p_slugs text[], p_cap int default 10)
returns jsonb
language sql stable security definer set search_path to 'public' set statement_timeout to '8s'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', ext, 'title', ttl) order by ord), '[]'::jsonb)
  from (
    select ext, ttl, ord
    from (
      select distinct on (f.id)
        md.external_id ext, coalesce(md.title, f.title) ttl, abs(hashtext(f.slug)) ord
      from unnest(coalesce(p_slugs, '{}'::text[])) s(slug)
      join films f on f.slug = s.slug
      join media md on md.entity_type='film' and md.entity_id=f.id and md.kind='video'
        and md.external_id is not null
        and md.title ~* 'trailer|teaser'
        and md.title !~* 'explain|featurette|behind the scenes|interview|review|breakdown|react|making of|commentary'
      order by f.id, (md.title !~* 'trailer'), md.position nulls last
      limit 200
    ) per_film
    order by ord
    limit greatest(1, least(coalesce(p_cap, 10), 20))
  ) q
$$;
