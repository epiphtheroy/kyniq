-- 0043 — deterministic ORDER BY tiebreakers for the four big-list room RPCs.
-- These are paged client-side through PostgREST .range() chunks (OFFSET per
-- chunk, each chunk a separate execution). Postgres gives no ordering guarantee
-- inside ties across executions, so a >1000-row tie group straddling a chunk
-- boundary can duplicate rows in one chunk and drop them in the next. A unique
-- trailing key makes OFFSET paging deterministic. Bodies are otherwise
-- identical to 0033 (me_collection / me_watchlist_scored / me_authored_takes)
-- and 0028 (me_library); return types unchanged, so CREATE OR REPLACE suffices.

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
  order by fs.prestige_score desc nulls last, (b.v_value - b.r_risk) desc nulls last, f.slug;
$function$;

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
  order by um.added_at desc, f.slug;
$function$;

CREATE OR REPLACE FUNCTION public.me_library()
returns table(entity_type text, slug text, film_slug text, title text, sub text, def text,
              film_count integer, maturity text, prestige numeric, rating numeric,
              seen boolean, fav boolean, visibility text, created_at timestamp with time zone)
language sql stable security definer
set search_path = public
as $$
  with pins as (
    select
      p.entity_type,
      p.entity_id,
      bool_or(p.kind = 'like') as fav,
      bool_or(p.visibility = 'public') as pub,
      max(p.created_at)        as created_at
    from user_pins p
    where p.user_id = auth.uid()
    group by p.entity_type, p.entity_id
  )
  select
    case
      when pn.entity_type = 'film' then 'film'
      when pn.entity_type = 'figure' then 'figure'
      when pn.entity_type = 'meta_take' and m.kind = 'figure_type' then 'trope'
      when pn.entity_type = 'meta_take' then 'misreading'
      else pn.entity_type
    end as entity_type,
    case pn.entity_type
      when 'film' then f.slug
      when 'meta_take' then m.slug
      when 'figure' then fig.slug
    end as slug,
    case pn.entity_type when 'figure' then ff.slug end as film_slug,
    case pn.entity_type
      when 'film' then f.title
      when 'meta_take' then m.title
      when 'figure' then fig.label
    end as title,
    case pn.entity_type
      when 'film' then f.year::text
      when 'meta_take' then m.laconic
      when 'figure' then ff.title
    end as sub,
    case pn.entity_type
      when 'meta_take' then coalesce(m.thesis, m.laconic)
      when 'figure' then fig.description
    end as def,
    case pn.entity_type
      when 'meta_take' then m.film_count
      when 'figure' then 1
    end as film_count,
    case pn.entity_type when 'meta_take' then m.maturity end as maturity,
    fs.prestige_score as prestige,
    um.rating,
    um.seen,
    pn.fav,
    case when pn.pub then 'public' else 'private' end as visibility,
    pn.created_at
  from pins pn
  left join films f        on pn.entity_type='film'      and f.id  = pn.entity_id
  left join user_movies um on pn.entity_type='film'      and um.film_id = pn.entity_id and um.user_id = auth.uid()
  left join film_scores fs on pn.entity_type='film'      and fs.film_id = pn.entity_id
  left join meta_takes m   on pn.entity_type='meta_take' and m.id   = pn.entity_id
  left join figures fig    on pn.entity_type='figure'    and fig.id = pn.entity_id
  left join films ff       on pn.entity_type='figure'    and ff.id  = fig.film_id
  order by pn.created_at desc, pn.entity_type, pn.entity_id;
$$;

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
  order by t.created_at desc, t.id;
$function$;
