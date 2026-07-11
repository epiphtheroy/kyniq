-- 0075 — Home: "From the readings desk" (news-box section replacing the bare
-- trope list). A seeded hourly sample of PUBLISHED readings (takes) with real
-- title + excerpt, joined to their film/figure so each card deep-links to
-- /film/{slug}/figure/{figSlug}. Pool gates: strength>=4, take_title present,
-- rationale long enough to excerpt, film visible+postered. LLM-0.
create or replace function public.home_readings_desk(p_seed text default 'x')
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
 set statement_timeout to '6s'
as $function$
with pick as (
  select t.id, t.take_title, t.framework, t.strength,
         left(regexp_replace(t.rationale, '\s+', ' ', 'g'), 300) as excerpt,
         g.label as fig_label, g.slug as fig_slug,
         f.title as film_title, f.slug as film_slug, f.year, f.poster_path
  from takes t
  join figures g on g.id = t.figure_id and g.status = 'approved'
  join films f on f.id = g.film_id and f.visible and f.poster_path is not null
  where t.status = 'published' and t.is_invitation = false
    and t.take_title is not null and length(coalesce(t.rationale,'')) > 250
    and t.strength >= 4
  order by md5(coalesce(nullif(p_seed,''),'x') || t.id::text)
  limit 7
)
select coalesce(jsonb_agg(jsonb_build_object(
  'title', p.take_title, 'excerpt', p.excerpt, 'framework', p.framework,
  'film', p.film_title, 'slug', p.film_slug, 'year', p.year,
  'poster', p.poster_path, 'figure', p.fig_label, 'figSlug', p.fig_slug,
  'ts', ts.ts
) order by p.strength desc, p.id), '[]'::jsonb)
from pick p
left join lateral (
  select round(s.v_value - s.r_risk)::int as ts
  from cinecodex.scores s where s.film_id = (select id from films where slug = p.film_slug limit 1)
) ts on true
$function$;
