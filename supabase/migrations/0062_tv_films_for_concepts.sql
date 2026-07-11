-- 0062_tv_films_for_concepts.sql — film slugs for a set of concept slugs.
-- Feeds the /tradition/[slug] video hero's reel: a theory school is a set of
-- concepts, and each concept's films come from takes.concept (slugified with
-- the SAME regex as concept_readings / the concept builder). Returns the films
-- carrying the most readings first. Anon-safe (function-level statement_timeout).
create or replace function public.tv_films_for_concepts(p_slugs text[], p_cap int default 60)
returns text[]
language sql stable security definer set search_path to 'public' set statement_timeout to '8s'
as $$
  select coalesce(array_agg(fslug order by n desc), '{}'::text[])
  from (
    select f.slug fslug, count(*) n
    from takes tk
    join figures g on g.id = tk.figure_id
    join films f on f.id = g.film_id
    where tk.status = 'published' and coalesce(tk.concept, '') <> ''
      and tv_slugify(tk.concept) = any(coalesce(p_slugs, '{}'::text[]))
    group by f.slug
    order by count(*) desc
    limit greatest(1, least(coalesce(p_cap, 60), 80))
  ) q
$$;
