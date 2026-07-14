-- 0097_film_index_signals.sql
-- SEO consolidation gate (HANDOFF-SEO-스타터가이드-작업지시서.md §2).
-- Additive, read-only. Owner-run via apply-sql.py BEFORE the P1 code is deployed.
--
-- Purpose: one SECURITY DEFINER function returning per-film "index signals" as a single
-- jsonb array (jsonb_agg single-row pattern — bypasses the PostgREST 1000-row cap, cf. the
-- geo_overview_json precedent). Powers BOTH lib/filmGate.ts filmMainIndexable(slug) and the
-- sitemap roster, so page + sitemap gates share one source of truth. The composite decision
-- (filmIndexBar) lives in TS (lib/seo.ts); this function only returns raw counts.
--
-- Gate (implemented in TS, mirrored here for reference — DO NOT bake thresholds into SQL):
--   Tier-1 (is_analyzed): unchanged (figures >= 3 && visible).
--   Tier-2 (NOT is_analyzed): visible-agnostic, indexable iff
--       slug NOT LIKE 'tmdb-%'                                        -- unresolved-stub guard
--       AND (n_reception >= 3 OR n_lineage >= 3 OR n_wd_honors >= 3)   -- strong-any
--       AND n_providers >= 1.                                         -- availability baseline
--   Verified against prod 2026-07-14: 1,105 Tier-2 films pass; Tier-1 visible = 1,959.
--
-- ⚠️ `hold` is NOT a gate input. It is the factory's "ingested-as-stub, not yet promoted"
--    flag and is set on 4,723 of 4,997 Tier-2 films (the whole catalog cohort), NOT a
--    deliberate per-film hide. Excluding hold would wrongly drop the entire cohort (only 21
--    would survive). It is returned below for observability only. Deliberate junk = tmdb-% stubs
--    (currently 0). The 22 editorially-hidden films are is_analyzed=true and thus never enter the
--    Tier-2 candidate pool. The Next.js app reads films.hold nowhere today.
--
-- Signals are RAW counts. cinecodex.scores lives in the `cinecodex` schema (u := v_value - r_risk,
-- computed at read time; there is no `u` column). SECURITY DEFINER lets anon callers read past
-- RLS (film_locations is intentionally NOT a signal here — anon has no policy on it).

create or replace function public.film_index_signals_json()
returns jsonb
language sql
stable
security definer
set search_path = public, cinecodex
as $$
  with rec as (
    select film_id, count(*)::int as n from public.film_reception group by film_id
  ),
  lin as (
    select film_id, count(*)::int as n from public.film_lineage group by film_id
  ),
  wd as (
    select film_id, count(*)::int as n from public.film_wd_honors group by film_id
  ),
  prov as (
    select film_id, count(*)::int as n from public.film_provider_index group by film_id
  ),
  -- movies-like mirror: only recs whose RELATED film is visible count (page filters .eq visible,true)
  aff as (
    select fa.film_id, count(*)::int as n
    from public.film_affinities fa
    join public.films rf on rf.id = fa.related_film_id and rf.visible
    group by fa.film_id
  ),
  scored as (
    select distinct film_id from cinecodex.scores where v_value is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug',          f.slug,
    'visible',       coalesce(f.visible, false),
    'is_analyzed',   coalesce(f.is_analyzed, false),
    'hold',          coalesce(f.hold, false),
    'is_stub',       (f.slug like 'tmdb-%'),
    'created_at',    f.created_at,               -- sitemap Tier-2 cohort: oldest-first, append-only
    'n_reception',   coalesce(rec.n, 0),
    'n_lineage',     coalesce(lin.n, 0),
    'n_wd_honors',   coalesce(wd.n, 0),
    'n_providers',   coalesce(prov.n, 0),
    'n_affinities',  coalesce(aff.n, 0),
    'has_scores',    (scored.film_id is not null)
  ) order by f.slug), '[]'::jsonb)
  from public.films f
  left join rec    on rec.film_id  = f.id
  left join lin    on lin.film_id  = f.id
  left join wd     on wd.film_id   = f.id
  left join prov   on prov.film_id = f.id
  left join aff    on aff.film_id  = f.id
  left join scored on scored.film_id = f.id;
$$;

comment on function public.film_index_signals_json() is
  'SEO consolidation gate roster (0097). Per-film raw index signals as one jsonb array. Consumed by lib/filmGate.ts + sitemap. Composite threshold lives in TS (filmIndexBar).';

-- Callable by the anon/authenticated web roles (read-only, SECURITY DEFINER).
grant execute on function public.film_index_signals_json() to anon, authenticated, service_role;
