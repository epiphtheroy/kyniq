-- ============================================================================
-- factory/sql/curation_new_films.sql  —  Film Factory stage S41 (§7.5)
-- ----------------------------------------------------------------------------
-- MIRROR FILE.  This is BOTH:
--   (a) a factory stage runner (manifest S41: `curation.film upsert + reclassify`), and
--   (b) applyable as a real migration — the curation-session builder that ships it
--       assigns the next supabase/migrations/00XX_ number and copies this body verbatim.
--   Keep this file as the source of record; mirror it into the numbered migration
--   exactly (see factory/sql/assertions.sql ↔ 0082 for the established MIRROR pattern).
--
-- WHAT THIS DOES
--   Upserts curation.film rows for the factory run's new films (by public.films.id),
--   then calls curation.reclassify() so quadrant / score_tier / primary_facet /
--   recommended_action / should_index are recomputed. Returns the count actually
--   written. Rows frozen by a curator (manual_override) are NEVER overwritten.
--   Mapping mirrors the curation ops book:
--     curation-handover/01-curation-db/curation_EXPORT_and_OPS.sql  (#2 ADD, #6 RESYNC).
--
-- WHAT THIS DELIBERATELY DOES **NOT** DO  (scoped SAFELY — do not fabricate)
--   The to.W letter — curation.film_comment (verdict / rationale / auteur_flag …) —
--   is NOT recomputed here. That letter is assembled from the intricate, brand-
--   sensitive verdict-v2 rules (A = canon 3-lists only · award ≠ A · low-score
--   humility clause · optional-verdict phrasing …). Those rules live in
--   HANDOFF-투두블유-큐레이션코멘트.md and the curation.rule table (34 rows) and
--   have NO existing DB builder function. Porting them into a
--   `curation.build_film_comment(...)` builder is a separate curation-session task.
--   Until that builder exists, a new film simply has no curation.film_comment row —
--   and the /takescore/film/[slug] TowCard is gracefully ABSENT (not an error).
--   reclassify() recomputes the *classification*, never the letter.
--
-- VERIFY / NOTES (columns confirmed against contract + curation_EXPORT_and_OPS.sql):
--   * public.films has NO original_language and NO country_code column. On INSERT
--     both are left NULL and origin_confidence is left to its default — the
--     authoritative origin is backfilled afterward from TMDB production_countries by
--     curation-handover/02-phase0/phase0_origin_backfill.py (which itself respects
--     manual_override). We never touch those three on the UPDATE path.
--   * prestige_score / discovery_score / total_score  ← LEFT JOIN LATERAL
--     public.film_scores on film_id (latest by computed_at).
--   * imdb_rating / imdb_votes ← LEFT JOIN LATERAL public.film_ratings on film_id
--     (latest by fetched_at).
--   * cohort tagged 'factory'; added_at = current_date.
--   * Grants: service-role only (called by worker/factory.py via the Management API).
-- ============================================================================

create or replace function public.factory_curation_upsert_new(p_film_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  with src as (
    select
      f.tmdb_id,
      f.title,
      f.year,
      f.director,
      s.prestige_score,
      s.discovery_score,
      s.total_score,
      r.imdb_rating,
      r.imdb_votes
    from public.films f
    left join lateral (
      select prestige_score, discovery_score, total_score
      from public.film_scores s
      where s.film_id = f.id
      order by s.computed_at desc nulls last
      limit 1
    ) s on true
    left join lateral (
      select imdb_rating, imdb_votes
      from public.film_ratings r
      where r.film_id = f.id
      order by r.fetched_at desc nulls last
      limit 1
    ) r on true
    where f.id = any(p_film_ids)
      and f.tmdb_id is not null
  ),
  up as (
    insert into curation.film as cf (
      tmdb_id, title, year, director,
      prestige_score, discovery_score, total_score,
      imdb_rating, imdb_votes,
      cohort, added_at
    )
    select
      tmdb_id, title, year, director,
      prestige_score, discovery_score, total_score,
      imdb_rating, imdb_votes,
      'factory', current_date
    from src
    on conflict (tmdb_id) do update set
      title           = excluded.title,
      year            = excluded.year,
      director        = coalesce(excluded.director, cf.director),
      prestige_score  = coalesce(excluded.prestige_score,  cf.prestige_score),
      discovery_score = coalesce(excluded.discovery_score, cf.discovery_score),
      total_score     = coalesce(excluded.total_score,     cf.total_score),
      imdb_rating     = coalesce(excluded.imdb_rating,     cf.imdb_rating),
      imdb_votes      = coalesce(excluded.imdb_votes,      cf.imdb_votes)
      -- NEVER overwrite curator-frozen rows:
      where cf.manual_override is not true
    returning cf.tmdb_id
  )
  select count(*)::int into n from up;

  -- Recompute quadrant / score_tier / primary_facet / recommended_action / should_index.
  -- (Does NOT compute the to.W curation.film_comment letter — see header.)
  perform curation.reclassify();

  return coalesce(n, 0);
end
$$;

revoke all on function public.factory_curation_upsert_new(uuid[]) from anon, authenticated;
