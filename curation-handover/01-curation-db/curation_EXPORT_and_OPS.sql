-- =====================================================================
-- FilmCurio  curation  schema  —  export & operations
-- Project: kyniq (jvgarcqrtsmgfimdcwgo).  Schema is isolated from public.
-- =====================================================================

-- ---------- 1) EXPORT full tables to CSV ----------
-- Option A (Supabase dashboard): Table editor > curation.film > Export > CSV.
-- Option B (psql / local): \copy writes to YOUR machine:
\copy (select * from curation.film order by cohort, quadrant, total_score desc nulls last) to 'curation_film.csv' csv header
\copy (select * from curation.hub order by strategic_tier, status, hub_slug)               to 'curation_hub.csv' csv header
\copy (select fh.*, f.title, h.label from curation.film_hub fh
        join curation.film f using(tmdb_id) join curation.hub h using(hub_slug)
        order by hub_slug, rank)                                                          to 'curation_film_hub.csv' csv header
\copy (select * from curation.rule order by category, key)                                 to 'curation_rule.csv' csv header

-- ---------- 2) ADD a film (free-form intake) ----------
-- tmdb_id is the key. Minimal insert, then reclassify() derives the rest.
insert into curation.film (tmdb_id, title, year, director, cohort, added_at,
                           total_score, imdb_votes, authority_flag, primary_facet, country_code)
values (:tmdb_id, :title, :year, :director, 'manual', current_date,
        :total_score, :imdb_votes, :authority_flag, :primary_facet, :country_code)
on conflict (tmdb_id) do update set
  title=excluded.title, year=excluded.year, total_score=excluded.total_score,
  imdb_votes=excluded.imdb_votes, authority_flag=excluded.authority_flag,
  primary_facet=excluded.primary_facet, country_code=excluded.country_code
where curation.film.manual_override = false;

select curation.reclassify();   -- recompute quadrant / tier / action / wave / status

-- ---------- 3) ADD a film to a hub ----------
insert into curation.film_hub (tmdb_id, hub_slug, rank, via_list)
values (:tmdb_id, :hub_slug, :rank, :source)
on conflict (tmdb_id, hub_slug) do nothing;

-- ---------- 4) PROMOTE a planned hub to live (after sourcing its canon) ----------
update curation.hub set status='live', authority_weight=:auth, source_ref=:source
where hub_slug = :hub_slug;

-- ---------- 5) MANUAL override (freeze a row from auto-reclassify) ----------
update curation.film
set quadrant=:q, recommended_action=:action, ingest_wave=:wave,
    manual_override=true, curator_note=:note, updated_at=now()
where tmdb_id = :tmdb_id;

-- ---------- 6) RESYNC scores from public (when public.film_scores changes) ----------
-- pulls latest score/rating for rows present in public; respects manual_override.
update curation.film cf set
  total_score = s.total_score, prestige_score = s.prestige_score,
  discovery_score = s.discovery_score, imdb_rating = r.imdb_rating, imdb_votes = r.imdb_votes
from public.films f
left join lateral (select prestige_score,discovery_score,total_score from public.film_scores s
                   where s.film_id=f.id order by computed_at desc nulls last limit 1) s on true
left join lateral (select imdb_rating,imdb_votes from public.film_ratings r
                   where r.film_id=f.id order by fetched_at desc nulls last limit 1) r on true
where f.tmdb_id = cf.tmdb_id and cf.manual_override = false;
select curation.reclassify();

-- ---------- 7) CONNECT to main (only after you confirm) ----------
-- The website would read decisions like this (example view, run when ready):
-- create or replace view public.v_curation_decisions as
--   select tmdb_id, analysis_status, recommended_action, ingest_wave, should_index,
--          quadrant, score_tier, country_code
--   from curation.film;
-- Drop everything to roll back:  drop schema curation cascade;
