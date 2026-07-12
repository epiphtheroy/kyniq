-- ② sentence_concept_stats — film count + earliest holder per (theorist, concept) lens.
-- Source for C_reading / G_theorist_twin / I_lens_twin / N_question concept_films nums.
-- Catalog-wide (idempotent upsert). Reconstructed for the engine.
insert into public.sentence_concept_stats (theorist_name, concept, film_count, earliest_film_id, earliest_year, computed_at)
select tk.theorist_name, tk.concept,
       count(distinct g.film_id) as film_count,
       (array_agg(g.film_id order by f.year nulls last, g.film_id))[1] as earliest_film_id,
       min(f.year) as earliest_year,
       now()
from public.takes tk
join public.figures g on g.id = tk.figure_id
join public.films f on f.id = g.film_id and f.visible
where tk.status='published' and tk.theorist_name is not null and tk.concept is not null
group by tk.theorist_name, tk.concept
on conflict (theorist_name, concept) do update
  set film_count = excluded.film_count, earliest_film_id = excluded.earliest_film_id,
      earliest_year = excluded.earliest_year, computed_at = now();
