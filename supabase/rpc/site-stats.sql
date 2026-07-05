-- Live corpus numbers (applied as migration methodology_stats_rpc).
-- Consumed by /methodology stat tiles; safe for any page that states scale —
-- numbers are always read from the DB, never hard-coded into prose.
create or replace function public.methodology_stats_json() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'films',         (select count(*) from films where visible),
    'figures',       (select count(*) from figures where status='approved'),
    'readings',      (select count(*) from takes where status='published'),
    'tropes',        (select count(*) from meta_takes where kind='figure_type' and status='published'),
    'concepts',      (select count(*) from sm_concepts),
    'concept_links', (select count(*) from concept_map),
    'theorists',     (select count(distinct theorist_id) from takes where status='published' and theorist_id is not null),
    'kin_edges',     (select count(*) from film_affinities),
    'counterpoints', (select count(*) from entity_edges where kind='counterpoint'),
    'locations',     (select count(*) from film_locations)
  );
$$;
grant execute on function public.methodology_stats_json() to anon, authenticated, service_role;
