-- 0033 — room RPC 역커밋 스냅샷 (ROOM-HANDOVER-MASTER §8 구조 항목, LOGIC-AUDIT §7-12)
-- 라이브 DB(jvgarcqrtsmgfimdcwgo)에 out-of-band로 생성돼 있던 room RPC를 pg_get_functiondef로
-- 바이트 그대로 덤프한 것 (2026-07-03). 전부 이미 라이브에 존재 — create or replace 멱등.
-- 별도 마이그레이션에 이미 커밋된 것은 제외: me_library v2·쓰기 mutation(0028) ·
-- me_recommend_wwi v2(0029) · rate_film v2·me_system_status·me_nav_history(0030) ·
-- me_today_pair 계열(0031) · me_geo_coverage v2(0032).
-- 잔여(후속): cinecodex 스키마 DDL(scores/confidence 테이블·인덱스) 역커밋.

CREATE OR REPLACE FUNCTION public.cinecodex_card(p_slug text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cinecodex'
AS $function$
  with tgt as (
    select f.id, f.slug, f.title, f.year, f.director, f.poster_path
    from public.films f where f.slug = p_slug
  ),
  best as (
    select distinct on (s.film_id) s.film_id, s.cog,s.aff,s.form,s.moral,s.dur,
      s.itx,s.fr,s.etx,s.ctx,s.bank,s.insincere,s.coward,s.polar,
      s.v_value,s.c_cost,s.r_risk,s.n_samples,s.sd_v,s.sd_r,s.panel,s.prompt_version,s.flagged,s.scored_at
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  b as (select * from best where film_id = (select id from tgt)),
  long as (
    select bb.film_id, v.code, v.val
    from best bb, lateral (values
      ('cog',bb.cog),('aff',bb.aff),('form',bb.form),('moral',bb.moral),('dur',bb.dur),
      ('itx',bb.itx),('fr',bb.fr),('etx',bb.etx),('ctx',bb.ctx),
      ('bank',bb.bank),('insincere',bb.insincere),('coward',bb.coward),('polar',bb.polar)
    ) v(code,val)
  ),
  tv as (select code, val from long where film_id = (select id from tgt)),
  comps as (
    select code, json_agg(title order by rn) filter (where rn <= 3) films
    from (
      select l.code, f.title,
        row_number() over (partition by l.code order by abs(l.val - t.val), fs.prestige_score desc nulls last) rn
      from long l
      join tv t on t.code = l.code
      join public.films f on f.id = l.film_id and f.visible
      left join public.film_scores fs on fs.film_id = l.film_id
      where l.film_id <> (select id from tgt)
    ) q group by code
  ),
  basket as (
    select json_agg(json_build_object('title', f.title, 'slug', f.slug,
             'u', round(bx.v_value - bx.r_risk), 'r', round(bx.r_risk),
             'self', f.id = (select id from tgt)) order by (bx.v_value - bx.r_risk) desc) rows
    from public.films f join best bx on bx.film_id = f.id
    where f.slug in ('tokyo-story-1953','yi-yi-2000','parasite-2019','babylon-2022','citizen-kane-1941')
       or f.id = (select id from tgt)
  ),
  lineage as (
    select array_agg(distinct fl.facet) filter (where fl.facet in ('award','festival','canon','national')) labels
    from public.film_lineage fl where fl.film_id = (select id from tgt)
  )
  select json_build_object(
    'slug', t.slug, 'title', t.title, 'year', t.year, 'director', t.director, 'poster_path', t.poster_path,
    'v', round(b.v_value,1), 'c', round(b.c_cost,1), 'r', round(b.r_risk,1),
    'u', round(b.v_value - b.r_risk), 's', round((b.v_value-50)/greatest(b.r_risk,1),2),
    'subs', json_build_object(
      'cog',b.cog,'aff',b.aff,'form',b.form,'moral',b.moral,'dur',b.dur,
      'itx',b.itx,'fr',b.fr,'etx',b.etx,'ctx',b.ctx,
      'bank',b.bank,'insincere',b.insincere,'coward',b.coward,'polar',b.polar),
    'comps', (select json_object_agg(code, films) from comps),
    'reliability', json_build_object('n_samples',b.n_samples,'sd_v',b.sd_v,'sd_r',b.sd_r,
      'panel',b.panel,'prompt_version',b.prompt_version,'flagged',b.flagged,'scored_at',b.scored_at),
    'conf', (select conf from public.cinecodex_confidence cc where cc.film_id=t.id),
    'tier', (select tier from public.cinecodex_confidence cc where cc.film_id=t.id),
    'n_takes', (select n_takes from public.cinecodex_confidence cc where cc.film_id=t.id),
    'ext', (select json_build_object('imdb',r.imdb_rating,'rt',r.rt_tomatometer,'meta',r.metascore)
            from public.film_ratings r where r.film_id=t.id),
    'standing', json_build_object(
       'prestige', (select round(prestige_score) from public.film_scores fs where fs.film_id=t.id),
       'labels', (select labels from lineage)),
    'basket', (select rows from basket)
  )
  from tgt t, b;
$function$


CREATE OR REPLACE FUNCTION public.film_room_context(p_slug text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with f as (select id from public.films where slug = p_slug)
  select json_build_object(
    'watch_next', (
      select json_agg(x order by x.position) from (
        select fn.position, coalesce(tf.title, fn.rec_title) title,
               coalesce(tf.year, fn.rec_year) as yr, tf.slug, coalesce(tf.poster_path, fn.poster_path) poster_path, fn.reason
        from public.film_next fn
        left join public.films tf on tf.id = fn.target_film_id and tf.visible
        where fn.source_film_id = (select id from f)
        order by fn.position limit 4
      ) x
    ),
    'movies_like', (
      select json_agg(x order by x.score desc) from (
        select rf.slug, rf.title, rf.year as yr, rf.poster_path, round(fa.score::numeric,3) score
        from public.film_affinities fa
        join public.films rf on rf.id = fa.related_film_id and rf.visible
        where fa.film_id = (select id from f)
        order by fa.score desc limit 4
      ) x
    ),
    'locations', (
      select json_agg(x) from (
        select fl.name, fl.country, fl.kind, fl.narrative_setting, fl.lat, fl.lng, fl.layer
        from public.film_locations fl
        where fl.film_id = (select id from f) and fl.lat is not null
        order by fl.tier nulls last, fl.confidence desc nulls last limit 6
      ) x
    ),
    'loc_count', (select count(*) from public.film_locations where film_id = (select id from f) and lat is not null),
    'avail', (
      select case
        when jsonb_typeof(wp.results #> '{KR,flatrate}') = 'array' and jsonb_array_length(wp.results #> '{KR,flatrate}') > 0
          then json_build_object('state','on','provider', wp.results #>> '{KR,flatrate,0,provider_name}')
        else json_build_object('state','unk') end
      from public.film_watch_providers wp where wp.film_id = (select id from f)
    )
  );
$function$


CREATE OR REPLACE FUNCTION public.film_search(p_q text, p_limit integer DEFAULT 8)
 RETURNS TABLE(slug text, title text, year integer, poster_path text, director text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select f.slug, f.title, f.year, f.poster_path, f.director
  from films f
  where f.visible and p_q is not null and length(trim(p_q)) >= 1
    and f.title ilike '%'||p_q||'%'
  order by (f.title ilike p_q||'%') desc, f.title
  limit greatest(p_limit,1);
$function$


CREATE OR REPLACE FUNCTION public.me_auteur_conquest(p_limit integer DEFAULT 40)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cinecodex'
AS $function$
  with best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.r_risk
    from cinecodex.scores s
    order by s.film_id,
      case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  -- directors the user has seen >=1 visible film of
  seen_dirs as (
    select f.director_slug,
           count(*) filter (where um.seen = true)                 as seen,
           avg(um.rating) filter (where um.seen = true)           as avg_rating
    from public.user_movies um
    join public.films f on f.id = um.film_id
    where um.user_id = auth.uid()
      and um.seen = true
      and f.visible = true
      and f.director_slug is not null
    group by f.director_slug
  ),
  -- total visible films in DB per those directors
  totals as (
    select f.director_slug,
           count(*)               as total,
           max(f.director)        as director_name
    from public.films f
    where f.visible = true
      and f.director_slug in (select director_slug from seen_dirs)
    group by f.director_slug
  ),
  -- rank unseen visible films of each seen director by prestige desc
  unseen_ranked as (
    select f.director_slug, f.slug, f.title, f.year, f.poster_path,
           fs.prestige_score                                       as prestige,
           round(b.v_value - b.r_risk)::int                        as u,
           row_number() over (
             partition by f.director_slug
             order by fs.prestige_score desc nulls last,
                      (b.v_value - b.r_risk) desc nulls last,
                      f.year desc nulls last
           )                                                       as rn
    from public.films f
    left join film_scores fs on fs.film_id = f.id
    left join best b on b.film_id = f.id
    where f.visible = true
      and f.director_slug in (select director_slug from seen_dirs)
      and not exists (
        select 1 from public.user_movies um2
        where um2.user_id = auth.uid() and um2.film_id = f.id
      )
  ),
  unseen_top as (
    select director_slug,
           json_agg(
             json_build_object(
               'slug', slug, 'title', title, 'year', year,
               'poster_path', poster_path, 'prestige', prestige, 'u', u
             ) order by rn
           ) as items
    from unseen_ranked
    where rn <= 3
    group by director_slug
  )
  select coalesce(json_agg(row_to_json(x) order by x.seen desc, x.pct desc), '[]'::json)
  from (
    select t.director_slug                                         as slug,
           coalesce(d.name, t.director_name)                       as name,
           d.profile_path,
           sd.seen,
           t.total,
           round(sd.seen::numeric / nullif(t.total,0) * 100)::int  as pct,
           round(sd.avg_rating, 2)                                 as avg_rating,
           coalesce(ut.items, '[]'::json)                          as unseen_top
    from seen_dirs sd
    join totals t on t.director_slug = sd.director_slug
    left join public.directors d on d.slug = sd.director_slug
    left join unseen_top ut on ut.director_slug = sd.director_slug
    order by sd.seen desc, pct desc
    limit p_limit
  ) x;
$function$


CREATE OR REPLACE FUNCTION public.me_authored_takes()
 RETURNS TABLE(take_id uuid, title text, framework text, register text, body text, status text, is_public boolean, film_slug text, film_title text, figure_slug text, figure_label text, meta_take_slug text, meta_take_title text, upvotes integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    t.id as take_id,
    coalesce(nullif(t.take_title,''), fig.label) as title,
    t.framework,
    t.register,
    t.rationale as body,
    t.status,
    (t.status = 'published') as is_public,
    ff.slug  as film_slug,
    ff.title as film_title,
    fig.slug as figure_slug,
    fig.label as figure_label,
    m.slug   as meta_take_slug,
    m.title  as meta_take_title,
    t.upvotes,
    t.created_at
  from takes t
  left join figures fig   on fig.id = t.figure_id
  left join films ff      on ff.id  = fig.film_id
  left join meta_takes m  on m.id   = t.meta_take_id
  where t.author_id = auth.uid()
  order by t.created_at desc;
$function$


CREATE OR REPLACE FUNCTION public.me_collection()
 RETURNS TABLE(slug text, title text, year integer, poster_path text, director text, rating numeric, v numeric, c numeric, r numeric, u integer, prestige numeric, discovery numeric, conf integer, tier text, imdb numeric, rt integer, meta integer, votes bigint, added_at timestamp with time zone, facets text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cinecodex'
AS $function$
  with best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.c_cost, s.r_risk
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  )
  select f.slug, f.title, f.year, f.poster_path, f.director, um.rating,
         round(b.v_value,1) v, round(b.c_cost,1) c, round(b.r_risk,1) r,
         round(b.v_value - b.r_risk)::int u,
         fs.prestige_score prestige, fs.discovery_score discovery,
         cc.conf, cc.tier,
         fr.imdb_rating imdb, fr.rt_tomatometer rt, fr.metascore meta, cc.votes,
         um.watched_at added_at,
         (select array_agg(distinct fl.facet) from public.film_lineage fl
            where fl.film_id = um.film_id and fl.facet in ('canon','award','national','auteur')) facets
  from user_movies um
  join films f on f.id = um.film_id
  left join best b on b.film_id = um.film_id
  left join film_scores fs on fs.film_id = um.film_id
  left join cinecodex_confidence cc on cc.film_id = um.film_id
  left join film_ratings fr on fr.film_id = um.film_id
  where um.user_id = auth.uid() and um.seen = true
  order by fs.prestige_score desc nulls last, (b.v_value - b.r_risk) desc nulls last;
$function$


CREATE OR REPLACE FUNCTION public.me_figure_cloud(p_limit integer DEFAULT 30)
 RETURNS TABLE(label text, slug text, n integer, maturity text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select mt.title as label,
         mt.slug  as slug,
         count(distinct fg.film_id)::int as n,
         mt.maturity as maturity
  from figures fg
  join user_movies um on um.film_id = fg.film_id
  join figure_type_members ftm on ftm.figure_id = fg.id
  join meta_takes mt on mt.id = ftm.meta_take_id
  where um.user_id = auth.uid()
    and um.seen
    and mt.kind = 'figure_type'
    and mt.status = 'published'
  group by mt.title, mt.slug, mt.maturity
  order by count(distinct fg.film_id) desc, mt.title
  limit greatest(p_limit, 1);
$function$


CREATE OR REPLACE FUNCTION public.me_pair_state()
 RETURNS TABLE(candidates integer, loved_n integer, forming boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (select count(distinct um2.user_id)::int
       from user_movies um2
      where um2.user_id <> auth.uid()
        and um2.seen and um2.rating >= 4.5) candidates,
    (select count(*)::int from user_movies um
       where um.user_id = auth.uid() and um.seen and um.rating >= 4.5) loved_n,
    ((select count(*) from user_movies um
       where um.user_id = auth.uid() and um.seen and um.rating >= 4.5) < 8) forming;
$function$


CREATE OR REPLACE FUNCTION public.me_portfolio_nav()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with seen as (
    select um.film_id, fs.prestige_score p
    from user_movies um
    left join film_scores fs on fs.film_id = um.film_id
    where um.user_id = auth.uid() and um.seen = true
  ),
  ranked as (
    select p, row_number() over (order by p desc nulls last) k from seen where p is not null
  ),
  pd as (select coalesce(sum((p/100.0) * power(0.85, k-1)), 0) s from ranked),
  lines as (
    select count(distinct fl.list_id) n
    from user_movies um
    join film_lineage fl on fl.film_id = um.film_id
    join lineage_lists ll on ll.id = fl.list_id and ll.facet in ('canon','award','national','festival','section')
    where um.user_id = auth.uid() and um.seen = true
  )
  select json_build_object(
    'n_watched', (select count(*) from seen),
    'n_scored',  (select count(*) from ranked),
    'essentials',(select count(*) from seen where p >= 70),
    'avg_standing', (select round(avg(p)) from seen where p is not null),
    'lines', (select n from lines),
    'nav', case when (select count(*) from seen) < 8 then null
                else round(100 * (1 - power(0.5, (select s from pd) / 1.4))) end
  );
$function$


CREATE OR REPLACE FUNCTION public.me_rate_stats()
 RETURNS TABLE(rated integer, loved integer, seen integer, watchlist integer, session_new integer, forming boolean, loved_target integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    count(*) filter (where um.rating is not null)::int rated,
    count(*) filter (where um.rating >= 4.5)::int loved,
    count(*) filter (where um.seen)::int seen,
    count(*) filter (where um.watchlist)::int watchlist,
    count(*) filter (where um.rating is not null and um.added_at >= now() - interval '24 hours')::int session_new,
    (count(*) filter (where um.rating >= 4.5) < 8) forming,
    8 loved_target
  from user_movies um
  where um.user_id = auth.uid();
$function$


CREATE OR REPLACE FUNCTION public.me_recent_ratings(p_limit integer DEFAULT 24)
 RETURNS TABLE(slug text, title text, year integer, poster_path text, director text, rating numeric, loved boolean, watched_at date, added_at timestamp with time zone, v numeric, r numeric, prestige numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cinecodex'
AS $function$
  with best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.r_risk
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  )
  select f.slug, f.title, f.year, f.poster_path, f.director,
         um.rating, (um.rating >= 4.5) loved, um.watched_at, um.added_at,
         round(b.v_value,1) v, round(b.r_risk,1) r, fs.prestige_score prestige
  from user_movies um
  join films f on f.id = um.film_id
  left join best b on b.film_id = um.film_id
  left join film_scores fs on fs.film_id = um.film_id
  where um.user_id = auth.uid() and um.rating is not null
  order by um.added_at desc nulls last, um.watched_at desc nulls last
  limit greatest(p_limit,1);
$function$


CREATE OR REPLACE FUNCTION public.me_takescore_summary()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cinecodex'
AS $function$
  with best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.c_cost, s.r_risk
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  seen as (
    select f.slug, f.title, f.year, um.rating,
           b.v_value v, b.r_risk r, (b.v_value - b.r_risk) u
    from user_movies um
    join films f on f.id = um.film_id
    left join best b on b.film_id = um.film_id
    where um.user_id = auth.uid() and um.seen = true
  ),
  scored as (select * from seen where v is not null)
  select json_build_object(
    'n_watched', (select count(*) from seen),
    'n_scored',  (select count(*) from scored),
    'median_ts', (select round(percentile_cont(0.5) within group (order by u)) from scored),
    'avg_v',     (select round(avg(v)) from scored),
    'avg_r',     (select round(avg(r)) from scored),
    'best',      (select json_build_object('slug',slug,'title',title,'ts',round(u)) from scored order by u desc nulls last limit 1),
    'riskiest',  (select json_build_object('slug',slug,'title',title,'r',round(r)) from scored order by r desc nulls last limit 1),
    'value_gap', (select round(avg(rating*20 - v)) from scored where rating is not null),
    'n_gap',     (select count(*) from scored where rating is not null)
  );
$function$


CREATE OR REPLACE FUNCTION public.me_taste_neighbors(p_limit integer DEFAULT 8)
 RETURNS TABLE(slug text, title text, year integer, poster_path text, director text, v numeric, r numeric, prestige numeric, sim numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cinecodex'
AS $function$
  with loved as (
    select l2_normalize(avg(ftv.embedding)) lv, count(*) n
    from user_movies um
    join film_taste_vector ftv on ftv.film_id = um.film_id
    where um.user_id = auth.uid() and um.seen = true and um.rating >= 3.5 and ftv.embedding is not null
  ),
  best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.r_risk
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  )
  select f.slug, f.title, f.year, f.poster_path, f.director,
         round(b.v_value,1) v, round(b.r_risk,1) r, fs.prestige_score,
         round((1 - (ftv.embedding <=> loved.lv))::numeric, 3) sim
  from loved
  join film_taste_vector ftv on loved.n >= 3 and loved.lv is not null
  join films f on f.id = ftv.film_id and f.visible
  left join best b on b.film_id = ftv.film_id
  left join film_scores fs on fs.film_id = ftv.film_id
  where not exists (select 1 from user_movies um2 where um2.user_id = auth.uid() and um2.film_id = ftv.film_id)
  order by ftv.embedding <=> loved.lv
  limit greatest(p_limit,1);
$function$


CREATE OR REPLACE FUNCTION public.me_taste_signature(p_limit integer DEFAULT 6)
 RETURNS TABLE(kind text, label text, films integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with loved as (
    select um.film_id from user_movies um
    where um.user_id = auth.uid() and um.seen and um.rating >= 4.5
  ),
  anchors as (
    select 'anchor'::text kind, mt.title label, count(distinct fg.film_id)::int films
    from figures fg
    join loved l on l.film_id = fg.film_id
    join figure_type_members ftm on ftm.figure_id = fg.id
    join meta_takes mt on mt.id = ftm.meta_take_id
    where mt.kind = 'figure_type' and mt.status is distinct from 'merged'
    group by mt.title having count(distinct fg.film_id) >= 2
    order by count(distinct fg.film_id) desc, mt.title
    limit greatest(p_limit,1)
  ),
  lineages as (
    select 'lineage'::text kind, ll.label, count(distinct fl.film_id)::int films
    from film_lineage fl
    join loved l on l.film_id = fl.film_id
    join lineage_lists ll on ll.id = fl.list_id
    where ll.status is distinct from 'merged'
    group by ll.label having count(distinct fl.film_id) >= 2
    order by count(distinct fl.film_id) desc, ll.label
    limit greatest(p_limit,1)
  )
  select * from anchors
  union all
  select * from lineages;
$function$


CREATE OR REPLACE FUNCTION public.me_watched_scored()
 RETURNS TABLE(slug text, title text, year integer, poster_path text, director text, rating numeric, v numeric, c numeric, r numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cinecodex'
AS $function$
  with best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.c_cost, s.r_risk
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  )
  select f.slug, f.title, f.year, f.poster_path, f.director,
         um.rating,
         round(b.v_value,1) v, round(b.c_cost,1) c, round(b.r_risk,1) r
  from user_movies um
  join films f on f.id = um.film_id
  left join best b on b.film_id = um.film_id
  where um.user_id = auth.uid() and um.seen = true
  order by (b.v_value - b.r_risk) desc nulls last, um.watched_at desc nulls last;
$function$


CREATE OR REPLACE FUNCTION public.me_watchlist_scored()
 RETURNS TABLE(slug text, title text, year integer, poster_path text, director text, rating numeric, added_at timestamp with time zone, v numeric, c numeric, r numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cinecodex'
AS $function$
  with best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.c_cost, s.r_risk
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  )
  select f.slug, f.title, f.year, f.poster_path, f.director,
         um.rating, um.added_at,
         round(b.v_value,1) v, round(b.c_cost,1) c, round(b.r_risk,1) r
  from user_movies um
  join films f on f.id = um.film_id
  left join best b on b.film_id = um.film_id
  where um.user_id = auth.uid() and um.watchlist = true
  order by um.added_at desc;
$function$


CREATE OR REPLACE FUNCTION public.portfolio_breakdown()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (select auth.uid() as uid),
  seen as (select um.film_id, um.rating from public.user_movies um, me where um.user_id = me.uid and um.seen),
  fseen as (select f.* from public.films f join seen s on s.film_id = f.id),
  decade as (select jsonb_object_agg(d, c) j from (select ((year/10)*10)::text||'s' d, count(*) c from fseen where year is not null group by 1 order by 2 desc) x),
  country as (select jsonb_object_agg(co, c) j from (select co, count(*) c from (select jsonb_array_elements_text(coalesce(tmdb_extra->'country','[]'::jsonb)) co from fseen) y group by 1 order by 2 desc limit 12) x),
  director as (select jsonb_object_agg(dir, c) j from (select director dir, count(*) c from fseen where director is not null group by 1 order by 2 desc limit 12) x),
  framework as (select jsonb_object_agg(fw, c) j from (select t.framework fw, count(distinct fg.film_id) c from public.figures fg join public.takes t on t.figure_id = fg.id where fg.film_id in (select film_id from seen) and t.status='published' and t.framework is not null group by 1 order by 2 desc) x),
  trope as (select jsonb_object_agg(title, c) j from (select mt.title, count(distinct fg.film_id) c from public.figure_type_members ftm join public.figures fg on fg.id=ftm.figure_id join public.meta_takes mt on mt.id=ftm.meta_take_id where fg.film_id in (select film_id from seen) and mt.kind='figure_type' and mt.status='published' group by 1 order by 2 desc limit 15) x),
  canon as (select jsonb_agg(jsonb_build_object('label',label,'seen',seen_n,'total',total) order by total desc) j from (
      select ll.label, ll.film_count total, count(distinct s.film_id) seen_n
      from public.lineage_lists ll
      join public.film_lineage fl on fl.list_id = ll.id and ll.facet='canon'
      left join seen s on s.film_id = fl.film_id
      group by ll.id, ll.label, ll.film_count
      having ll.film_count >= 90 order by ll.film_count desc limit 8) x)
  select jsonb_build_object(
    'watched', (select count(*) from seen),
    'watchlist', (select count(*) from public.user_movies um, me where um.user_id=me.uid and um.watchlist),
    'avg_rating', (select round(avg(rating),1) from seen where rating is not null),
    'my_takes', (select count(*) from public.takes t, me where t.author_id = me.uid),
    'decade', coalesce((select j from decade),'{}'::jsonb),
    'country', coalesce((select j from country),'{}'::jsonb),
    'director', coalesce((select j from director),'{}'::jsonb),
    'framework', coalesce((select j from framework),'{}'::jsonb),
    'trope', coalesce((select j from trope),'{}'::jsonb),
    'canon', coalesce((select j from canon),'[]'::jsonb));
$function$


CREATE OR REPLACE FUNCTION public.takescore_for_slugs(p_slugs text[])
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cinecodex'
AS $function$
  with best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.r_risk
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  )
  select coalesce(json_agg(json_build_object('slug', f.slug, 'ts', round(b.v_value - b.r_risk))), '[]'::json)
  from best b join public.films f on f.id=b.film_id
  where f.slug = any(p_slugs);
$function$

