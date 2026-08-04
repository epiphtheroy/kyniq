-- 0129 — trope_related: same joined-column defect as figure_neighbors (0126).
--
-- APPLIED 2026-08-04 (supabase_migrations: trope_related_use_hnsw).
--
-- Measured before: 673 calls, 414 ms average, 13,452 ms worst case. The probe
-- vector came from a CTE cross-joined into the scan —
--     from meta_takes mt, src s ... order by mt.embedding <=> s.embedding
-- so idx_meta_takes_embedding_hnsw could not be used and every call walked the
-- whole published figure_type set computing cosine distance.
--
-- Reading the vector into a plpgsql variable makes the ORDER BY probe a
-- constant, which is what an HNSW index scan requires. ef_search is raised for
-- the same reason as 0126: the pgvector default (40) is far too low once a
-- filter sits on top, and meta_takes has the same duplicate-embedding clusters.
--
--     414 ms average -> 14.9 ms, 3,348 buffers
--
-- Semantics preserved exactly: same columns, same `sample` sub-select, same
-- ordering, same limit, same jsonb shape and rounding. VERIFIED: md5 of the
-- returned jsonb unchanged for a 20-trope sample (20/20).

create or replace function public.trope_related(p_slug text, p_n integer default 3)
returns jsonb
language plpgsql
stable
set search_path to 'public'
set statement_timeout to '15s'
as $function$
declare
  v vector;
  src_id uuid;
  out_json jsonb;
begin
  select mt.id, mt.embedding into src_id, v
  from meta_takes mt
  where mt.slug = p_slug and mt.kind = 'figure_type' and mt.status = 'published' and mt.embedding is not null
  limit 1;

  if v is null then
    return '[]'::jsonb;
  end if;

  perform set_config('hnsw.ef_search', greatest(greatest(p_n, 1) * 16, 200)::text, true);

  select coalesce(jsonb_agg(obj order by sim desc), '[]'::jsonb) into out_json
  from (
    select
      jsonb_build_object(
        'slug', mt.slug,
        'title', mt.title,
        'laconic', mt.laconic,
        'maturity', mt.maturity,
        'film_count', mt.film_count,
        'member_count', mt.member_count,
        'sim', round((1 - (mt.embedding <=> v))::numeric, 3),
        'sample', (
          select jsonb_build_object('film', f.title, 'year', f.year, 'fw', tk.framework, 'tt', tk.take_title)
          from takes tk
          join figures fg on fg.id = tk.figure_id
          join films f on f.id = fg.film_id
          where tk.trope_id = mt.id and tk.status='published'
            and tk.take_title is not null and coalesce(tk.framework,'') <> 'INVITATION'
          order by tk.id
          limit 1
        )
      ) as obj,
      (1 - (mt.embedding <=> v)) as sim
    from meta_takes mt
    where mt.kind='figure_type' and mt.status='published' and mt.embedding is not null
      and mt.id <> src_id
    order by mt.embedding <=> v
    limit greatest(p_n, 1)
  ) q;

  return out_json;
end
$function$;
