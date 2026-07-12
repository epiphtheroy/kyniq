-- ③ film_kinship — deterministic pair kinship 0..100 (map edge weight + sentence salience).
-- ⚠️ APPROXIMATE RECONSTRUCTION: the exact original blend (cos·40 + tfidf·25 + rarity·35 with
-- corpus-normalised constants) was run interactively (MASS-PRODUCTION.md; not committed) and is
-- not fully recoverable from one sample. This computes a plausible, monotonic kin from the
-- film_affinities evidence columns, scoped to the run's films (additive; existing pairs untouched).
-- If exact parity with the 27k historical rows is required, the owner should re-run the canonical
-- session SQL corpus-wide in a garden pass.
insert into public.film_kinship
  (film_id, related_film_id, kin, cos, tfidf, shared_count, rarity_sum, year_gap, top_node_id, computed_at)
select a.film_id, a.related_film_id,
  round( least(100, greatest(0,
     coalesce(a.cos,0)*40
     + least(coalesce(a.tfidf,0), 25)
     + least(cardinality(coalesce(a.shared_meta_take_ids,'{}'))*8.0, 35) ))::numeric, 1) as kin,
  a.cos, a.tfidf,
  cardinality(coalesce(a.shared_meta_take_ids,'{}')) as shared_count,
  coalesce((select sum(100.0/greatest(ns.film_count,1)) from public.sentence_node_stats ns
            where ns.meta_take_id = any(a.shared_meta_take_ids)), 0) as rarity_sum,
  abs(coalesce(f1.year,0) - coalesce(f2.year,0)) as year_gap,
  (a.shared_meta_take_ids)[1] as top_node_id,
  now()
from public.film_affinities a
join public.films f1 on f1.id = a.film_id
join public.films f2 on f2.id = a.related_film_id
where a.film_id = any({film_ids_array})
on conflict (film_id, related_film_id) do update
  set kin=excluded.kin, cos=excluded.cos, tfidf=excluded.tfidf, shared_count=excluded.shared_count,
      rarity_sum=excluded.rarity_sum, year_gap=excluded.year_gap, top_node_id=excluded.top_node_id, computed_at=now();
