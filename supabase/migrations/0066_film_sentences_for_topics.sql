-- 0066: topic browsing for the Embedding Fantasia module (applied to prod
-- 2026-07-11 via MCP "film_sentences_for_topics"). film_sentences_for gains
-- p_per_pattern so the film page fetches a topic-navigable pool (limit 48,
-- per-pattern 6) instead of a flat top-8. Old 3-arg signature DROPPED first
-- (create-or-replace overload trap — two overloads break PostgREST rpc).
drop function if exists public.film_sentences_for(text, int, text[]);

create or replace function public.film_sentences_for(
  p_slug text, p_limit int default 8, p_patterns text[] default null, p_per_pattern int default 2)
returns jsonb
language sql stable
set statement_timeout = '8s'
as $$
with me as (select id from public.films where slug = p_slug),
base as (
  select fs.* from public.film_sentences fs, me
  where fs.film_id = me.id
    and (p_patterns is null or fs.pattern = any(p_patterns))
),
dedup as (
  select b.*,
    row_number() over (partition by b.pattern order by b.salience desc, b.id) rp,
    row_number() over (partition by coalesce(b.other_film_id::text, b.id::text) order by b.salience desc, b.id) rf
  from base b
),
pick as (
  select * from dedup
  where rp <= greatest(coalesce(p_per_pattern, 2), 1) and rf = 1
  order by salience desc, id
  limit greatest(coalesce(p_limit, 8), 1)
)
select coalesce(jsonb_agg(jsonb_build_object(
  'id', p.id, 'pattern', p.pattern, 'sentence', p.sentence,
  'salience', p.salience, 'kin', p.kin,
  'other',   case when o.id  is not null then jsonb_build_object('slug', o.slug, 'title', o.title, 'year', o.year) end,
  'node',    case when mt.id is not null then jsonb_build_object('slug', mt.slug, 'title', mt.title, 'kind', mt.kind) end,
  'figure',  case when fg.id is not null then jsonb_build_object('slug', fg.slug, 'label', fg.label) end,
  'theorist',case when th.id is not null then jsonb_build_object('slug', th.slug, 'name', th.name) end,
  'lineage', case when ll.id is not null then jsonb_build_object('slug', ll.slug, 'label', ll.label) end,
  'framework', p.framework
) order by p.salience desc, p.id), '[]'::jsonb)
from pick p
left join public.films o          on o.id  = p.other_film_id
left join public.meta_takes mt    on mt.id = p.meta_take_ids[1]
left join public.figures fg       on fg.id = p.figure_id
left join public.theorists th     on th.id = p.theorist_id
left join public.lineage_lists ll on ll.id = p.lineage_list_id;
$$;
