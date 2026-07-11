-- 0062: RPCs to read film_sentences for surfaces (applied to prod 2026-07-11 via MCP "sentence_rpcs")
-- film_sentences_for → film-page "Did you know" module + map caption strip
-- sentences_ticker    → site-wide connection ticker (home + /room)
-- Docs: sentence-engine/MASS-PRODUCTION.md, docs/WORKORDER-sentence-surfaces.md

create or replace function public.film_sentences_for(p_slug text, p_limit int default 8, p_patterns text[] default null)
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
  where rp <= 2 and rf = 1
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

create or replace function public.sentences_ticker(p_n int default 40)
returns jsonb
language sql stable
set statement_timeout = '8s'
as $$
with pool as (
  select fs.id, fs.pattern, fs.sentence, f.slug as film_slug,
    md5(fs.id::text || to_char(now() at time zone 'utc', 'YYYYMMDDHH24')) as h
  from public.film_sentences fs
  join public.films f on f.id = fs.film_id
  where fs.salience >= 25
    and fs.pattern in ('A_affinity','B_bridge','D_award','E_rank','G_theorist_twin','H_dense','J_location','L_trope')
),
per as (
  select *, row_number() over (partition by pattern order by h) rn from pool
)
select coalesce(jsonb_agg(jsonb_build_object(
  'id', id, 'pattern', pattern, 'sentence', sentence, 'slug', film_slug
) order by h), '[]'::jsonb)
from (select * from per where rn <= 6 order by h limit greatest(coalesce(p_n,40),1)) q;
$$;
