-- Connections rebuild pipeline (Phase 0, 2026-07-04) — applied as migrations
-- connections_rebuild_stage + conn_rebuild_rpcs. Runner: worker/mt-recommend.py.
--
-- film_affinities = hybrid of two signals, fused with Reciprocal Rank Fusion (k=60):
--   1. trope TF-IDF  — films sharing published tropes (figure_type_members),
--      weighted ln(1 + N/df) so rare tropes count more; shared trope ids kept
--      (rarest first, max 12) in shared_meta_take_ids as the explainable reason.
--   2. embedding KNN — film_taste_vector cosine, top-30 per film.
-- Top-24 rows per visible film. Deterministic (ties broken by id/slug).
--
-- Staging tables (RLS enabled, no policies = service/definer only):
--   conn_stage_knn(film_id, related_film_id, cos, rk)
--   conn_stage_tfidf(film_id, related_film_id, w, shared uuid[], rt)

create table if not exists public.conn_stage_knn (
  film_id uuid not null,
  related_film_id uuid not null,
  cos real not null,
  rk int not null,
  primary key (film_id, related_film_id)
);
alter table public.conn_stage_knn enable row level security;

create table if not exists public.conn_stage_tfidf (
  film_id uuid not null,
  related_film_id uuid not null,
  w real not null,
  shared uuid[] not null,
  rt int not null,
  primary key (film_id, related_film_id)
);
alter table public.conn_stage_tfidf enable row level security;

create or replace function public.conn_rebuild_stage_truncate() returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  truncate conn_stage_knn;
  truncate conn_stage_tfidf;
end $$;

create or replace function public.conn_stage_knn_chunk(p_offset int, p_limit int) returns int
language plpgsql security definer set search_path to 'public' as $$
declare v_n int;
begin
  with chunk as (
    select ftv.film_id, ftv.embedding
    from film_taste_vector ftv
    join films f on f.id = ftv.film_id and f.visible
    order by ftv.film_id
    limit p_limit offset p_offset
  ),
  ins as (
    insert into conn_stage_knn
    select film_id, fid, cos,
           row_number() over (partition by film_id order by cos desc, fid) as rk
    from (
      select a.film_id, k.fid, k.cos
      from chunk a
      cross join lateral (
        select b.film_id as fid, (1 - (a.embedding <=> b.embedding))::real as cos
        from film_taste_vector b
        join films fb on fb.id = b.film_id and fb.visible
        where b.film_id <> a.film_id
        order by a.embedding <=> b.embedding
        limit 30
      ) k
    ) z
    returning 1
  )
  select count(*) into v_n from ins;
  return v_n;
end $$;

create or replace function public.conn_stage_tfidf_chunk(p_offset int, p_limit int) returns int
language plpgsql security definer set search_path to 'public' as $$
declare v_n int;
begin
  with mem as (
    select distinct g.film_id, fm.meta_take_id as trope_id
    from figure_type_members fm
    join figures g on g.id = fm.figure_id
    join meta_takes m on m.id = fm.meta_take_id and m.kind='figure_type' and m.status='published'
    join films f on f.id = g.film_id and f.visible
  ),
  nn as (select count(distinct film_id)::float as n from mem),
  df as (select trope_id, count(*) as c from mem group by 1),
  chunk as (select distinct film_id from mem order by film_id limit p_limit offset p_offset),
  pw as (
    select a.film_id as fa, b.film_id as fb,
           sum(ln(1 + (select nn.n from nn)/df.c))::real as w,
           (array_agg(a.trope_id order by df.c asc))[1:12] as shared
    from mem a
    join chunk ch on ch.film_id = a.film_id
    join mem b on b.trope_id = a.trope_id and b.film_id <> a.film_id
    join df on df.trope_id = a.trope_id
    group by 1, 2
  ),
  ins as (
    insert into conn_stage_tfidf
    select fa, fb, w, shared,
           row_number() over (partition by fa order by w desc, fb) as rt
    from pw
    returning 1
  )
  select count(*) into v_n from ins;
  return v_n;
end $$;

create or replace function public.conn_affinities_swap() returns int
language plpgsql security definer set search_path to 'public' as $$
declare v_n int;
begin
  truncate film_affinities;
  with ins as (
    insert into film_affinities (film_id, related_film_id, score, shared_meta_take_ids, cos, tfidf, updated_at)
    select f, r, round(score::numeric, 6), coalesce(shared, '{}'), cos, w, now()
    from (
      select coalesce(t.film_id, k.film_id) as f,
             coalesce(t.related_film_id, k.related_film_id) as r,
             coalesce(1.0/(60+t.rt), 0) + coalesce(1.0/(60+k.rk), 0) as score,
             t.shared, k.cos, t.w,
             row_number() over (
               partition by coalesce(t.film_id, k.film_id)
               order by coalesce(1.0/(60+t.rt), 0) + coalesce(1.0/(60+k.rk), 0) desc,
                        coalesce(t.related_film_id, k.related_film_id)
             ) as rn
      from conn_stage_tfidf t
      full outer join conn_stage_knn k
        on k.film_id = t.film_id and k.related_film_id = t.related_film_id
      where coalesce(t.rt, 999) <= 40 or coalesce(k.rk, 999) <= 30
    ) z
    where rn <= 24
    returning 1
  )
  select count(*) into v_n from ins;
  -- evidence backfill: pairs from the TF-IDF leg only still get a taste cosine
  update film_affinities fa
  set cos = (1 - (a.embedding <=> b.embedding))::real
  from film_taste_vector a, film_taste_vector b
  where fa.cos is null and a.film_id = fa.film_id and b.film_id = fa.related_film_id;
  return v_n;
end $$;

revoke execute on function public.conn_rebuild_stage_truncate() from public, anon, authenticated;
revoke execute on function public.conn_stage_knn_chunk(int,int) from public, anon, authenticated;
revoke execute on function public.conn_stage_tfidf_chunk(int,int) from public, anon, authenticated;
revoke execute on function public.conn_affinities_swap() from public, anon, authenticated;
grant execute on function public.conn_rebuild_stage_truncate() to service_role;
grant execute on function public.conn_stage_knn_chunk(int,int) to service_role;
grant execute on function public.conn_stage_tfidf_chunk(int,int) to service_role;
grant execute on function public.conn_affinities_swap() to service_role;
