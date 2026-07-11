-- 0065: view-flavored catalog sampler for the /map SentenceLexicon rail
-- (applied to prod 2026-07-11 via MCP "sentences_sample" + "..._floor_fix").
-- Same projection as sentences_for_entity (anchor film + entity links); pool is
-- a catalog-wide per-pattern-diverse sample seeded on the UTC hour (deterministic
-- within the hour → edge-cacheable, no random()). Salience floor 15 (F_compare
-- carries flat 20), per-pattern cap 9 so 2-pattern views still fill 18 rows.
-- View mapping lives in components/MapExplorer.tsx VIEW_ROOT:
--   films = A_affinity,B_bridge,H_dense · directors = F_compare,E_rank
--   critical = C_reading,G_theorist_twin,I_lens_twin,L_trope,M_frame
--   galaxy = E_rank,D_award,J_location
create or replace function public.sentences_sample(
  p_patterns text[] default null, p_n int default 18)
returns jsonb
language plpgsql stable
set statement_timeout = '8s'
as $$
declare
  v_ids bigint[];
begin
  v_ids := (
    with pool as (
      select fs.id, fs.pattern,
        md5(fs.id::text || to_char(now() at time zone 'utc', 'YYYYMMDDHH24')) as h
      from film_sentences fs
      where fs.salience >= 15
        and (p_patterns is null or fs.pattern = any(p_patterns))
    ),
    per as (
      select *, row_number() over (partition by pattern order by h) rn from pool
    )
    select array_agg(id) from (
      select id from per where rn <= 9 order by h limit greatest(coalesce(p_n, 18), 1)
    ) q
  );

  return (
    with base as (
      select fs.* from film_sentences fs where fs.id = any(coalesce(v_ids, '{}'))
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
    ) order by md5(p.id::text || to_char(now() at time zone 'utc', 'YYYYMMDDHH24'))), '[]'::jsonb)
    from base p
    join films bf on bf.id = p.film_id
    left join public.films o          on o.id  = p.other_film_id
    left join public.meta_takes mt    on mt.id = p.meta_take_ids[1]
    left join public.figures fg       on fg.id = p.figure_id
    left join public.theorists th     on th.id = p.theorist_id
    left join public.lineage_lists ll on ll.id = p.lineage_list_id
  );
end;
$$;
