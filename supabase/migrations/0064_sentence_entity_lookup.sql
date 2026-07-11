-- 0064: entity-centered sentence lookup for the SentenceLexicon panel
-- (applied to prod 2026-07-11 via MCP "sentence_entity_lookup" + "..._fix").
-- Indexes let any mentioned entity find its sentences fast; the RPC returns a
-- diverse pool with the ANCHOR film included (unlike film_sentences_for, whose
-- anchor is implicit) so the panel can recenter on any row.
-- Types: film · director · theorist · trope/take/idea (meta_takes slug) · figure(film,fig).
-- film/figure pools share one anchor → per-anchor diversity cap disabled there.

create index if not exists film_sentences_nodes_gin
  on public.film_sentences using gin (meta_take_ids);
create index if not exists film_sentences_theorist_idx
  on public.film_sentences (theorist_id, salience desc) where theorist_id is not null;
create index if not exists film_sentences_figure_idx
  on public.film_sentences (figure_id) where figure_id is not null;

create or replace function public.sentences_for_entity(
  p_type text, p_key text, p_key2 text default null, p_limit int default 18)
returns jsonb
language plpgsql stable
set statement_timeout = '8s'
as $$
declare
  v_ids bigint[];
  v_anchor_fixed boolean := p_type in ('film','figure');
begin
  if p_type = 'film' then
    v_ids := (select array_agg(id) from (
      select fs.id from film_sentences fs
      join films b on b.id = fs.film_id
      where b.slug = p_key
      order by fs.salience desc, fs.id limit 400) q);
  elsif p_type = 'director' then
    v_ids := (select array_agg(id) from (
      select fs.id from film_sentences fs
      where fs.film_id in (select id from films where director_slug = p_key)
      order by fs.salience desc, fs.id limit 400) q);
  elsif p_type = 'theorist' then
    v_ids := (select array_agg(id) from (
      select fs.id from film_sentences fs
      where fs.theorist_id = (select id from theorists where slug = p_key)
      order by fs.salience desc, fs.id limit 400) q);
  elsif p_type in ('trope', 'take', 'idea') then
    v_ids := (select array_agg(id) from (
      select fs.id from film_sentences fs
      where fs.meta_take_ids @> (select array[mt.id] from meta_takes mt where mt.slug = p_key limit 1)
      order by fs.salience desc, fs.id limit 400) q);
  elsif p_type = 'figure' then
    v_ids := (select array_agg(id) from (
      select fs.id from film_sentences fs
      where fs.figure_id = (
        select f.id from figures f join films b on b.id = f.film_id
        where b.slug = p_key and f.slug = p_key2 limit 1)
      order by fs.salience desc, fs.id limit 400) q);
  else
    v_ids := '{}';
  end if;

  return (
    with base as (
      select fs.* from film_sentences fs where fs.id = any(coalesce(v_ids, '{}'))
    ),
    dedup as (
      select b.*,
        row_number() over (partition by b.pattern order by b.salience desc, b.id) rp,
        row_number() over (partition by b.film_id order by b.salience desc, b.id) rf
      from base b
    ),
    pick as (
      select * from dedup
      where rp <= case when v_anchor_fixed then 4 else 6 end
        and (v_anchor_fixed or rf <= 3)
      order by salience desc, id
      limit greatest(coalesce(p_limit, 18), 1)
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'pattern', p.pattern, 'sentence', p.sentence,
      'salience', p.salience, 'kin', p.kin,
      'film',    jsonb_build_object('slug', bf.slug, 'title', bf.title, 'year', bf.year),
      'other',   case when o.id  is not null then jsonb_build_object('slug', o.slug, 'title', o.title, 'year', o.year) end,
      'node',    case when mt.id is not null then jsonb_build_object('slug', mt.slug, 'title', mt.title, 'kind', mt.kind) end,
      'figure',  case when fg.id is not null then jsonb_build_object('slug', fg.slug, 'label', fg.label) end,
      'theorist',case when th.id is not null then jsonb_build_object('slug', th.slug, 'name', th.name) end,
      'lineage', case when ll.id is not null then jsonb_build_object('slug', ll.slug, 'label', ll.label) end,
      'framework', p.framework
    ) order by p.salience desc, p.id), '[]'::jsonb)
    from pick p
    join films bf on bf.id = p.film_id
    left join public.films o          on o.id  = p.other_film_id
    left join public.meta_takes mt    on mt.id = p.meta_take_ids[1]
    left join public.figures fg       on fg.id = p.figure_id
    left join public.theorists th     on th.id = p.theorist_id
    left join public.lineage_lists ll on ll.id = p.lineage_list_id
  );
end;
$$;
