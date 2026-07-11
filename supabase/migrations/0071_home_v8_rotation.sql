-- 0071 — Home v8: seeded rotation + TakeScore on cards.
-- New function home_v2_bundle_v3(p_seed text): a superset of home_v2_bundle().
-- Two changes vs v2:
--   (1) ROTATION — the unranked grid sections (picks, newly, canon, rhyme,
--       concepts, lens, directors, auteurs) draw a larger candidate POOL by
--       their quality metric, then sample the display count by md5(seed||slug).
--       Same seed => same result (edge-cache friendly); new seed => new set.
--       Ranked/canon-identity sections (hero, top3, top10, tropes, directorSpots,
--       graph) stay deterministic — rotating a ranked list would misstate rank.
--   (2) TakeScore — every film-object carries ts/tsv/tsr from cinecodex.scores,
--       where the public score U = round(v_value - r_risk). left join => Tier-2
--       unscored films get null (card omits the chip). Rank is NOT exposed.
-- v2 is left intact; app/page.tsx switches the RPC name, so rollback = 1 line.
-- Spec: docs/PLAN-home-v8-rotation.md.

create or replace function public.home_v2_bundle_v3(p_seed text default 'x')
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
with
sd as (select coalesce(nullif(p_seed,''),'x') as seed),
ts_scores as (
  select film_id,
         round(v_value - r_risk)::int as ts,
         round(v_value)::int          as tsv,
         round(r_risk)::int           as tsr
  from cinecodex.scores
  where v_value is not null and r_risk is not null
),
fig_per_film as (
  select g.film_id, count(*) figs from figures g where g.status='approved' group by g.film_id
),
read_per_film as (
  select g.film_id, count(*) reads
  from takes t join figures g on g.id=t.figure_id
  where t.status='published' group by g.film_id
),
trope_per_film as (
  select g.film_id, count(distinct ftm.meta_take_id) trps
  from figure_type_members ftm join figures g on g.id=ftm.figure_id group by g.film_id
),
film_counts as (
  select f.id, coalesce(fp.figs,0) figs, coalesce(rp.reads,0) reads, coalesce(tp.trps,0) trps
  from films f
  left join fig_per_film  fp on fp.film_id=f.id
  left join read_per_film rp on rp.film_id=f.id
  left join trope_per_film tp on tp.film_id=f.id
),
film_rep as (
  select distinct on (g.film_id) g.film_id, g.label as fig_label, g.slug as fig_slug
  from figures g where g.status='approved'
  order by g.film_id, (lower(g.label) ~ 'film as a whole')::int, g.id
),
film_syn as (
  select distinct on (g.film_id) g.film_id, t.take_title, t.framework
  from takes t join figures g on g.id=t.figure_id
  where t.status='published' and t.take_title is not null
  order by g.film_id, t.strength desc nulls last, t.id
),
scored as (
  select f.id, f.title, f.year, f.director, f.slug, f.poster_path, f.backdrop_path,
         fr.imdb_rating, fr.metascore, fr.rt_tomatometer, fs.total_score,
         row_number() over (order by fs.total_score desc nulls last, f.id) as rnk
  from films f
  join film_scores fs on fs.film_id=f.id
  left join film_ratings fr on fr.film_id=f.id
  where f.visible
),
-- rhyme seed rotates: md5-pick one of the top-60 scored films (was rnk=1 fixed)
seed_film as (
  select id, title from scored where rnk<=60
  order by md5((select seed from sd) || slug) limit 1
),
seed_tropes as (
  select distinct ftm.meta_take_id
  from figure_type_members ftm join figures g on g.id=ftm.figure_id
  where g.film_id = (select id from seed_film)
)
select jsonb_build_object(

  'stats', jsonb_build_object(
    'films',     (select count(*) from films where visible),
    'directors', (select count(distinct director_slug) from films where visible and director_slug is not null),
    'tropes',    (select count(*) from meta_takes where status='published' and kind='figure_type'),
    'concepts',  (select count(*) from sm_concepts),
    'readings',  (select count(*) from takes where status='published'),
    'figures',   (select count(*) from figures where status='approved'),
    'lists',     (select count(*) from lineage_lists)
  ),

  -- hero: deterministic top-5, + ts
  'hero', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', s.title, 'year', s.year, 'director', s.director, 'slug', s.slug,
      'poster', s.poster_path, 'backdrop', s.backdrop_path, 'imdb', s.imdb_rating,
      'figures', fc.figs, 'readings', fc.reads, 'tropes', fc.trps,
      'figureLabel', fr.fig_label, 'figureSlug', fr.fig_slug,
      'topReading', coalesce(fy.take_title, 'via '||fr.fig_label),
      'ts', ts.ts, 'tsv', ts.tsv, 'tsr', ts.tsr
    ) order by s.rnk), '[]'::jsonb)
    from scored s
    join film_counts fc on fc.id=s.id
    left join film_rep fr on fr.film_id=s.id
    left join film_syn fy on fy.film_id=s.id
    left join ts_scores ts on ts.film_id=s.id
    where s.rnk<=5
  ),

  -- picks: pool 150 by shared, sample 36 by seed
  'picks', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', p.title, 'year', p.year, 'director', p.director, 'slug', p.slug,
      'poster', p.poster_path, 'backdrop', p.backdrop_path, 'imdb', p.imdb_rating,
      'figures', fc.figs, 'readings', fc.reads, 'tropes', fc.trps,
      'figureLabel', fr.fig_label, 'figureSlug', fr.fig_slug,
      'topReading', coalesce(fy.take_title, 'via '||fr.fig_label),
      'shared', p.shared, 'ts', ts.ts, 'tsv', ts.tsv, 'tsr', ts.tsr
    ) order by p.shared desc, p.slug), '[]'::jsonb)
    from (
      select pool.* from (
        select tf.id, tf.title, tf.year, tf.director, tf.slug, tf.poster_path, tf.backdrop_path,
               frt.imdb_rating, count(*)::int as shared
        from film_next fn
        join films tf on tf.id=fn.target_film_id
        left join film_ratings frt on frt.film_id=tf.id
        where fn.target_film_id is not null and tf.visible and tf.poster_path is not null
        group by tf.id, tf.title, tf.year, tf.director, tf.slug, tf.poster_path, tf.backdrop_path, frt.imdb_rating
        order by shared desc, tf.id
        limit 150
      ) pool
      order by md5((select seed from sd) || pool.slug) limit 36
    ) p
    join film_counts fc on fc.id=p.id
    left join film_rep fr on fr.film_id=p.id
    left join film_syn fy on fy.film_id=p.id
    left join ts_scores ts on ts.film_id=p.id
  ),

  -- top3 / top10: Essential Ten — deterministic (rank identity), top3 gets ts
  'top3', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'rank', s.rnk, 'title', s.title, 'year', s.year, 'director', s.director, 'slug', s.slug,
      'poster', s.poster_path, 'backdrop', s.backdrop_path, 'imdb', s.imdb_rating,
      'metascore', s.metascore, 'rt', s.rt_tomatometer,
      'meta', s.year||' · dir. '||s.director,
      'syn', coalesce(fy.take_title, fr.fig_label, s.title),
      'figureLabel', fr.fig_label, 'figureSlug', fr.fig_slug,
      'ts', ts.ts, 'tsv', ts.tsv, 'tsr', ts.tsr
    ) order by s.rnk), '[]'::jsonb)
    from scored s
    left join film_rep fr on fr.film_id=s.id
    left join film_syn fy on fy.film_id=s.id
    left join ts_scores ts on ts.film_id=s.id
    where s.rnk<=3
  ),

  'top10', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'rank', s.rnk, 'title', s.title, 'slug', s.slug, 'imdb', s.imdb_rating, 'poster', s.poster_path
    ) order by s.rnk), '[]'::jsonb)
    from scored s where s.rnk between 4 and 10
  ),

  -- newly: pool 120 newest, sample 36 by seed
  'newly', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', n.title, 'year', n.year, 'director', n.director, 'slug', n.slug,
      'poster', n.poster_path, 'backdrop', n.backdrop_path, 'imdb', n.imdb_rating,
      'figures', fc.figs, 'readings', fc.reads, 'tropes', fc.trps,
      'figureLabel', fr.fig_label, 'figureSlug', fr.fig_slug,
      'trope', coalesce(mt.title, 'via '||fr.fig_label),
      'framework', coalesce(fy.framework, 'READING'),
      'ts', ts.ts, 'tsv', ts.tsv, 'tsr', ts.tsr
    ) order by n.created_at desc, n.slug), '[]'::jsonb)
    from (
      select pool.* from (
        select f.id, f.title, f.year, f.director, f.slug, f.poster_path, f.backdrop_path,
               f.created_at, frt.imdb_rating
        from films f
        left join film_ratings frt on frt.film_id=f.id
        where f.visible and f.is_analyzed and f.backdrop_path is not null
        order by f.created_at desc, f.id
        limit 120
      ) pool
      order by md5((select seed from sd) || pool.slug) limit 36
    ) n
    join film_counts fc on fc.id=n.id
    left join film_rep fr on fr.film_id=n.id
    left join film_syn fy on fy.film_id=n.id
    left join ts_scores ts on ts.film_id=n.id
    left join lateral (
      select m.title from figure_type_members ftm
      join figures g on g.id=ftm.figure_id
      join meta_takes m on m.id=ftm.meta_take_id
      where g.film_id=n.id and m.status='published' and m.kind='figure_type'
      order by m.film_count desc nulls last limit 1
    ) mt on true
  ),

  -- tropes: deterministic ranked list (widest readings) — NOT rotated
  'tropes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'rank', t.rnk, 'title', t.title, 'slug', t.slug, 'n', t.n, 'pair', coalesce(t.pair, '')
    ) order by t.rnk), '[]'::jsonb)
    from (
      select m.title, m.slug, tc.films as n,
             row_number() over (order by tc.films desc, m.id) as rnk,
             (select string_agg(p.t2, ' ⟷ ') from (
                select distinct on (f.id) f.title t2
                from figure_type_members ftm
                join figures g on g.id=ftm.figure_id
                join films f on f.id=g.film_id
                where ftm.meta_take_id=m.id and f.visible
                order by f.id limit 2) p) as pair
      from meta_takes m
      join trope_counts tc on tc.meta_take_id=m.id
      where m.status='published' and m.kind='figure_type'
      order by tc.films desc
      limit 16
    ) t
  ),

  -- concepts: pool 60 popular, sample 30 by seed
  'concepts', (
    select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug, 'n', c.n, 'backdrop', c.backdrop) order by c.n desc, c.slug), '[]'::jsonb)
    from (
      select pool.* from (
        select sc.name, sc.slug, sc.n, sc.id,
          (select f.backdrop_path
             from takes t join figures g on g.id=t.figure_id join films f on f.id=g.film_id
             where exists (select 1 from public.concept_map k9 where k9.raw_l=lower(btrim(t.concept)) and k9.concept_id=sc.id)
               and t.status='published' and f.visible and f.backdrop_path is not null
             order by f.id limit 1) as backdrop
        from sm_concepts sc order by sc.n desc, sc.id limit 60
      ) pool
      order by md5((select seed from sd) || pool.slug) limit 30
    ) c
  ),

  -- lens: per framework, pool 80 by reads, sample 36 by seed; + ts
  'lens', (
    select jsonb_build_object(
      'frameworks', (select coalesce(jsonb_agg(framework order by cnt desc), '[]'::jsonb)
                     from (select framework, count(*) cnt from takes
                           where status='published' and framework is not null
                           group by framework order by cnt desc) fwlist),
      'byFramework', (
        select coalesce(jsonb_object_agg(fw.framework, fw.films), '{}'::jsonb)
        from (
          select fwl.framework,
            (select coalesce(jsonb_agg(jsonb_build_object(
                'title', x.title, 'year', x.year, 'director', x.director, 'slug', x.slug,
                'poster', x.poster_path, 'backdrop', x.backdrop_path, 'imdb', x.imdb_rating,
                'readings', x.reads, 'figureLabel', x.fig_label, 'figureSlug', x.fig_slug,
                'topReading', coalesce(x.take_title, 'via '||x.fig_label), 'shared', x.reads,
                'ts', ts.ts, 'tsv', ts.tsv, 'tsr', ts.tsr
              ) order by x.reads desc nulls last, x.slug), '[]'::jsonb)
             from (
                select xx.* from (
                  select d.*, coalesce(rp.reads,0) reads from (
                    select distinct on (f.id) f.id, f.title, f.year, f.director, f.slug,
                           f.poster_path, f.backdrop_path, frt.imdb_rating,
                           g.label fig_label, g.slug fig_slug, t.take_title
                    from takes t
                    join figures g on g.id=t.figure_id
                    join films f on f.id=g.film_id
                    left join film_ratings frt on frt.film_id=f.id
                    where t.framework=fwl.framework and t.status='published'
                      and f.visible and f.poster_path is not null
                    order by f.id, t.strength desc nulls last
                  ) d
                  left join read_per_film rp on rp.film_id=d.id
                  order by reads desc nulls last, d.id
                  limit 80
                ) xx
                order by md5((select seed from sd) || xx.slug) limit 36
             ) x
             left join ts_scores ts on ts.film_id=x.id
            ) as films
          from (select distinct framework from takes
                where status='published' and framework is not null) fwl
        ) fw
      )
    )
  ),

  -- directorSpots: deterministic (rotated set = 3 detailed spotlights)
  'directorSpots', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', ds.name, 'slug', ds.director_slug, 'place', coalesce(ds.place, ''),
      'image', ds.image, 'films', ds.films, 'readings', ds.readings, 'tropes', ds.tropes,
      'sig', (select coalesce(jsonb_agg(jsonb_build_object(
                 'title', sg.title, 'count', '×'||sg.c, 'via', 'via '||sg.via)), '[]'::jsonb)
              from (
                select m.title, count(distinct f.id) c, min(g2.label) via
                from films f
                join figures g2 on g2.film_id=f.id
                join figure_type_members ftm on ftm.figure_id=g2.id
                join meta_takes m on m.id=ftm.meta_take_id
                where f.director_slug=ds.director_slug and f.visible
                  and m.status='published' and m.kind='figure_type'
                group by m.id, m.title
                order by count(distinct f.id) desc, m.title limit 3
              ) sg),
      'filmo', (select coalesce(jsonb_agg(jsonb_build_object(
                  'title', dp.film_title, 'year', ''''||right(dp.film_year::text,2))
                  order by dp.pos), '[]'::jsonb)
                from director_picks dp where dp.director_slug=ds.director_slug)
    ) order by ds.rk), '[]'::jsonb)
    from (
      select df.director_slug, coalesce(d.name, df.director_slug) name,
             d.place_of_birth place, d.profile_path image,
             (select count(distinct f.id) from films f where f.director_slug=df.director_slug and f.visible) films,
             (select count(distinct t.id) from films f
                join figures g on g.film_id=f.id and g.status='approved'
                join takes t on t.figure_id=g.id and t.status='published'
                where f.director_slug=df.director_slug and f.visible) readings,
             (select count(distinct ftm.meta_take_id) from films f
                join figures g on g.film_id=f.id
                join figure_type_members ftm on ftm.figure_id=g.id
                where f.director_slug=df.director_slug and f.visible) tropes,
             row_number() over (order by md5((select seed from sd) || df.director_slug)) rk
      from director_facts df
      left join directors d on d.slug=df.director_slug
      where df.intro is not null
        and exists (select 1 from director_picks dp where dp.director_slug=df.director_slug)
      order by rk
      limit 3
    ) ds
  ),

  -- directors: pool 80 by films, sample 36 by seed
  'directors', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', dc.name, 'slug', dc.director_slug,
      'country', coalesce(nullif(trim(split_part(dc.place,',', cardinality(regexp_split_to_array(dc.place,',')))),''), ''),
      'image', dc.image, 'films', dc.films, 'signature', coalesce(dc.sig, '')
    ) order by dc.films desc, dc.director_slug), '[]'::jsonb)
    from (
      select pool.* from (
        select f.director_slug, max(coalesce(d.name, f.director)) name,
               max(d.place_of_birth) place, max(d.profile_path) image, count(distinct f.id) films,
               (select m.title from films f2
                  join figures g on g.film_id=f2.id
                  join figure_type_members ftm on ftm.figure_id=g.id
                  join meta_takes m on m.id=ftm.meta_take_id
                  where f2.director_slug=f.director_slug and f2.visible
                    and m.status='published' and m.kind='figure_type'
                  group by m.id, m.title
                  order by count(distinct f2.id) desc, m.title limit 1) sig
        from films f
        left join directors d on d.slug=f.director_slug
        where f.visible and f.director_slug is not null
        group by f.director_slug
        order by count(distinct f.id) desc, f.director_slug
        limit 80
      ) pool
      order by md5((select seed from sd) || pool.director_slug) limit 36
    ) dc
  ),

  -- auteurs: pool 40 by films (with photo), sample 12 by seed
  'auteurs', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', a.name, 'slug', a.director_slug, 'films', a.films, 'image', a.image) order by a.films desc, a.director_slug), '[]'::jsonb)
    from (
      select pool.* from (
        select f.director_slug, max(coalesce(d.name, f.director)) name, count(distinct f.id) films,
               max(d.profile_path) image
        from films f
        join directors d on d.slug=f.director_slug
        where f.visible and f.director_slug is not null and d.profile_path is not null
        group by f.director_slug
        order by count(distinct f.id) desc, f.director_slug
        limit 40
      ) pool
      order by md5((select seed from sd) || pool.director_slug) limit 12
    ) a
  ),

  -- rhyme: seed film rotates (above); + ts
  'rhyme', (
    select jsonb_build_object(
      'seed', (select title from seed_film),
      'films', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'title', r.title, 'year', r.year, 'director', r.director, 'slug', r.slug,
          'poster', r.poster_path, 'backdrop', r.backdrop_path, 'imdb', r.imdb_rating,
          'figures', fc.figs, 'readings', fc.reads, 'tropes', fc.trps,
          'figureLabel', fr.fig_label, 'figureSlug', fr.fig_slug,
          'topReading', coalesce(fy.take_title, 'via '||fr.fig_label),
          'shared', r.shared, 'ts', ts.ts, 'tsv', ts.tsv, 'tsr', ts.tsr
        ) order by r.shared desc, r.slug), '[]'::jsonb)
        from (
          select f.id, f.title, f.year, f.director, f.slug, f.poster_path, f.backdrop_path,
                 frt.imdb_rating, count(distinct ftm.meta_take_id)::int shared
          from figure_type_members ftm
          join figures g on g.id=ftm.figure_id
          join films f on f.id=g.film_id
          left join film_ratings frt on frt.film_id=f.id
          where ftm.meta_take_id in (select meta_take_id from seed_tropes)
            and f.visible and f.poster_path is not null
            and f.id <> (select id from seed_film)
          group by f.id, f.title, f.year, f.director, f.slug, f.poster_path, f.backdrop_path, frt.imdb_rating
          order by shared desc
          limit 36
        ) r
        join film_counts fc on fc.id=r.id
        left join film_rep fr on fr.film_id=r.id
        left join film_syn fy on fy.film_id=r.id
        left join ts_scores ts on ts.film_id=r.id
      )
    )
  ),

  -- canon: pool 200 by list-count, sample 36 by seed
  'canon', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', c.title, 'year', c.year, 'director', c.director, 'slug', c.slug,
      'poster', c.poster_path, 'backdrop', c.backdrop_path, 'imdb', c.imdb_rating,
      'figures', fc.figs, 'readings', fc.reads, 'tropes', fc.trps,
      'figureLabel', fr.fig_label, 'figureSlug', fr.fig_slug,
      'lists', c.lists, 'ts', ts.ts, 'tsv', ts.tsv, 'tsr', ts.tsr
    ) order by c.lists desc, c.slug), '[]'::jsonb)
    from (
      select pool.* from (
        select f.id, f.title, f.year, f.director, f.slug, f.poster_path, f.backdrop_path,
               frt.imdb_rating, count(*)::int lists
        from film_lineage fl
        join films f on f.id=fl.film_id
        left join film_ratings frt on frt.film_id=f.id
        where f.visible
        group by f.id, f.title, f.year, f.director, f.slug, f.poster_path, f.backdrop_path, frt.imdb_rating
        order by lists desc, f.id
        limit 200
      ) pool
      order by md5((select seed from sd) || pool.slug) limit 36
    ) c
    join film_counts fc on fc.id=c.id
    left join film_rep fr on fr.film_id=c.id
    left join film_syn fy on fy.film_id=c.id
    left join ts_scores ts on ts.film_id=c.id
  ),

  'guide', (
    select jsonb_build_object(
      'director', coalesce(d.name, g.director_slug), 'slug', g.director_slug,
      'steps', (select coalesce(jsonb_agg(jsonb_build_object(
                  'label', dp.label, 'title', dp.film_title, 'year', dp.film_year,
                  'reason', dp.reason, 'slug', dp.film_slug) order by dp.pos), '[]'::jsonb)
                from director_picks dp where dp.director_slug=g.director_slug)
    )
    from (
      select dp.director_slug
      from director_picks dp
      join director_facts df on df.director_slug=dp.director_slug
      group by dp.director_slug
      order by count(*) desc, dp.director_slug
      limit 1
    ) g
    left join directors d on d.slug=g.director_slug
  ),

  'blog', (
    select jsonb_build_object(
      'lead', (select jsonb_build_object(
                 'title', p.title, 'dek', coalesce(p.dek,''),
                 'meta', to_char(p.edition_date,'Mon DD')||' · daily edition · '||coalesce(p.read_min,5)||' min read',
                 'slug', p.slug)
               from posts p where p.status='published' order by p.edition_date desc limit 1),
      'more', (select coalesce(jsonb_agg(jsonb_build_object(
                 'title', m.title,
                 'meta', to_char(m.edition_date,'Mon DD')||' · daily edition · '||coalesce(m.read_min,5)||' min',
                 'slug', m.slug) order by m.edition_date desc), '[]'::jsonb)
               from (select * from posts where status='published' order by edition_date desc offset 1 limit 4) m)
    )
  ),

  'graph', (
    select coalesce(jsonb_agg(node order by ord), '[]'::jsonb)
    from (
      select jsonb_build_object('label', s.title, 'kind', 'film', 'slug', s.slug) node,
             (s.rnk*2 - 1) ord
      from scored s where s.rnk<=9
      union all
      select jsonb_build_object('label', m.title, 'kind', 'trope', 'slug', m.slug) node,
             (row_number() over (order by m.film_count desc nulls last, m.id))*2 ord
      from meta_takes m
      where m.status='published' and m.kind='figure_type'
      order by ord limit 18
    ) g
  )

);
$function$;
