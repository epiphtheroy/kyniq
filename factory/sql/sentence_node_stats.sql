-- ① sentence_node_stats — catalog-wide film count per interpretation node (trope/meta_take).
-- Rarity source for L_trope / B_bridge nums. Catalog-wide by nature (idempotent upsert).
-- Reconstructed for the engine (factory) from the film_sentences structure + MASS-PRODUCTION.md.
insert into public.sentence_node_stats (meta_take_id, film_count, computed_at)
select mt.id, count(distinct g.film_id), now()
from public.meta_takes mt
join public.takes tk on tk.trope_id = mt.id and tk.status='published'
join public.figures g on g.id = tk.figure_id
join public.films f on f.id = g.film_id and f.visible
where mt.kind='figure_type' and mt.status='published'
group by mt.id
on conflict (meta_take_id) do update set film_count = excluded.film_count, computed_at = now();
