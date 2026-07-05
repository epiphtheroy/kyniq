-- Galaxy map SQL (films + directors). Applied as migrations: film_map_xy,
-- galaxy_cluster_labels_rpc (+ galaxy_labels_truncate_fix, galaxy_labels_dedupe),
-- galaxy_json_rpc, director_galaxy. Builder: worker/galaxy-build.py.
--
-- Tables:
--   film_map_xy(film_id pk, x, y, cluster)           t-SNE seed 42 over film_taste_vector, k=14
--   film_map_clusters(cluster pk, n, label_genre, label_trope)
--   director_map_xy(slug pk, x, y, cluster)          t-SNE seed 42 over director_embedding, k=10
--   director_map_clusters(cluster pk, n, label_genre)
-- All read-policy public; label refreshers service_role only.

create or replace function public.galaxy_json() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'points', coalesce((select jsonb_agg(jsonb_build_object(
        'slug', f.slug, 'title', f.title, 'year', f.year,
        'd', f.director, 'p', f.poster_path,
        'x', x.x, 'y', x.y, 'c', x.cluster) order by f.slug)
      from film_map_xy x join films f on f.id = x.film_id and f.visible), '[]'::jsonb),
    'clusters', coalesce((select jsonb_agg(jsonb_build_object(
        'c', cluster, 'n', n, 'genre', label_genre, 'trope', label_trope) order by cluster)
      from film_map_clusters), '[]'::jsonb));
$$;
grant execute on function public.galaxy_json() to anon, authenticated, service_role;

create or replace function public.galaxy_directors_json() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'points', coalesce((select jsonb_agg(jsonb_build_object(
        'slug', dx.slug,
        'title', coalesce((select max(f.director) from films f where f.director_slug = dx.slug), dx.slug),
        'n', (select count(*) from films f where f.director_slug = dx.slug and f.visible),
        'x', dx.x, 'y', dx.y, 'c', dx.cluster) order by dx.slug)
      from director_map_xy dx), '[]'::jsonb),
    'clusters', coalesce((select jsonb_agg(jsonb_build_object(
        'c', cluster, 'n', n, 'genre', label_genre) order by cluster)
      from director_map_clusters), '[]'::jsonb));
$$;
grant execute on function public.galaxy_directors_json() to anon, authenticated, service_role;

-- film cluster labels: top-2 distinctive genres (3 when duplicated) + top idf trope
create or replace function public.galaxy_refresh_cluster_labels() returns int
language plpgsql security definer set search_path to 'public' as $$
declare v_n int;
begin
  truncate film_map_clusters;
  with cs as (select cluster, count(*)::float n from film_map_xy group by 1),
  tot as (select count(*)::float nn from film_map_xy),
  gg as (
    select x.cluster, g.genre, count(*)::float cnt
    from film_map_xy x
    join films f on f.id = x.film_id, unnest(f.genres) as g(genre)
    group by 1, 2
  ),
  gt as (select genre, sum(cnt) gcnt from gg group by 1),
  gsc as (
    select gg.cluster, gg.genre,
           row_number() over (partition by gg.cluster
             order by (gg.cnt / cs.n) / ((gt.gcnt + 20) / tot.nn) desc, gg.genre) rk
    from gg join gt using (genre) join cs on cs.cluster = gg.cluster cross join tot
    where gg.cnt >= 5
  ),
  glab2 as (select cluster, string_agg(genre, ' · ' order by rk) g2 from gsc where rk <= 2 group by cluster),
  glab3 as (select cluster, string_agg(genre, ' · ' order by rk) g3 from gsc where rk <= 3 group by cluster),
  gdup as (select g2, count(*) c from glab2 group by 1),
  glab as (
    select glab2.cluster,
           case when gdup.c > 1 then coalesce(glab3.g3, glab2.g2) else glab2.g2 end label_genre
    from glab2 join gdup using (g2)
    left join glab3 on glab3.cluster = glab2.cluster
  ),
  tr as (
    select x.cluster, v.trope_id, count(distinct x.film_id)::float cnt
    from film_map_xy x join conn_film_trope_vec v on v.film_id = x.film_id
    group by 1, 2
  ),
  trd as (select trope_id, count(distinct film_id)::float df from conn_film_trope_vec group by 1),
  tsc as (
    select tr.cluster, tr.trope_id,
           row_number() over (partition by tr.cluster
             order by tr.cnt * ln(1 + (select nn from tot)/trd.df) desc, tr.trope_id) rk
    from tr join trd using (trope_id)
    where tr.cnt >= 3
  ),
  tlab as (select tsc.cluster, m.title label_trope from tsc join meta_takes m on m.id = tsc.trope_id where tsc.rk = 1),
  ins as (
    insert into film_map_clusters (cluster, n, label_genre, label_trope)
    select cs.cluster, cs.n::int, glab.label_genre, tlab.label_trope
    from cs left join glab on glab.cluster = cs.cluster
            left join tlab on tlab.cluster = cs.cluster
    returning 1
  )
  select count(*) into v_n from ins;
  return v_n;
end $$;
revoke execute on function public.galaxy_refresh_cluster_labels() from public, anon, authenticated;
grant execute on function public.galaxy_refresh_cluster_labels() to service_role;

-- director cluster labels: top-2 distinctive genres (3 when duplicated) over their films
create or replace function public.galaxy_refresh_director_labels() returns int
language plpgsql security definer set search_path to 'public' as $$
declare v_n int;
begin
  truncate director_map_clusters;
  with cs as (select cluster, count(*)::float n from director_map_xy group by 1),
  tot as (select count(*)::float nn from director_map_xy),
  gg as (
    select dx.cluster, g.genre, count(*)::float cnt
    from director_map_xy dx
    join films f on f.director_slug = dx.slug and f.visible, unnest(f.genres) as g(genre)
    group by 1, 2
  ),
  gt as (select genre, sum(cnt) gcnt from gg group by 1),
  gsc as (
    select gg.cluster, gg.genre,
           row_number() over (partition by gg.cluster
             order by (gg.cnt / cs.n) / ((gt.gcnt + 20) / tot.nn) desc, gg.genre) rk
    from gg join gt using (genre) join cs on cs.cluster = gg.cluster cross join tot
    where gg.cnt >= 4
  ),
  glab2 as (select cluster, string_agg(genre, ' · ' order by rk) g2 from gsc where rk <= 2 group by cluster),
  glab3 as (select cluster, string_agg(genre, ' · ' order by rk) g3 from gsc where rk <= 3 group by cluster),
  gdup as (select g2, count(*) c from glab2 group by 1),
  glab as (
    select glab2.cluster,
           case when gdup.c > 1 then coalesce(glab3.g3, glab2.g2) else glab2.g2 end label_genre
    from glab2 join gdup using (g2)
    left join glab3 on glab3.cluster = glab2.cluster
  ),
  ins as (
    insert into director_map_clusters (cluster, n, label_genre)
    select cs.cluster, cs.n::int, glab.label_genre
    from cs left join glab on glab.cluster = cs.cluster
    returning 1
  )
  select count(*) into v_n from ins;
  return v_n;
end $$;
revoke execute on function public.galaxy_refresh_director_labels() from public, anon, authenticated;
grant execute on function public.galaxy_refresh_director_labels() to service_role;
