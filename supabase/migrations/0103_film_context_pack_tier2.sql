-- 0103_film_context_pack_tier2.sql — extend the context-pack RPC to Tier-2 catalog films.
-- The pack was Tier-1-only (0085: `is_analyzed=true and visible=true`). Tier-2 films now carry
-- real catalog data (TakeScore, standing, honors/lineage, filming locations) and are part of the
-- AI-distribution surface — the "Download for AI" + MCP buttons on their pages need a served pack.
-- SAFE: the analysis sections (readings/figures/tropes/kindred) are empty for Tier-2 (no approved
-- figures, 0 affinities), so a Tier-2 pack is purely catalog facts — nothing premium to leak, and
-- the route already labels everything CC BY-NC. Only the `f` eligibility gate changes vs 0085.
create or replace function public.film_context_pack(p_slug text, p_tier text default 'trim')
returns jsonb
language sql
stable
security definer
set search_path to 'public'
set statement_timeout to '12s'
as $$
with f as (
  select id, slug, title, original_title, year, director, imdb_id, wikidata_id, tmdb_id
  from films
  where slug = p_slug and slug not like 'tmdb-%'
    and ( (is_analyzed = true and visible = true)     -- Tier-1 (full analysis + readings)
       or (coalesce(is_analyzed, false) = false) )    -- Tier-2 catalog record (catalog sections only)
),
sc as (
  select distinct on (s.film_id)
         v_value, c_cost, r_risk,
         cog, aff, form, moral, dur, itx, fr, etx, ctx, bank, insincere, coward, polar,
         flagged
  from cinecodex.scores s
  join f on f.id = s.film_id
  order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
),
st as (
  select prestige_score, discovery_score
  from film_scores fs join f on f.id = fs.film_id
  order by fs.computed_at desc nulls last
  limit 1
),
honors as (
  select ll.label, fl.facet, fl.result, fl.rank,
         row_number() over (
           order by (fl.facet in ('canon','award')) desc,
                    coalesce(ll.authority_weight, 0) desc,
                    fl.rank asc nulls last
         ) rn
  from film_lineage fl
  join f on f.id = fl.film_id
  join lineage_lists ll on ll.id = fl.list_id
),
rd as (
  select distinct on (t.framework)
    t.framework, t.take_title, t.theorist_name, t.concept, t.rationale,
    t.strength, t.is_invitation, g.label as figure_label, g.kind as figure_kind
  from takes t
  join figures g on g.id = t.figure_id and g.status = 'approved'
  join f on f.id = g.film_id
  where t.status = 'published'
  order by t.framework, t.strength desc nulls last, t.confidence desc nulls last, t.created_at
),
kin as (
  select f2.title, f2.year, f2.slug,
         coalesce(array_length(a.shared_meta_take_ids, 1), 0) as shared_threads,
         a.score,
         row_number() over (order by a.score desc nulls last) rn
  from film_affinities a
  join f on f.id = a.film_id
  join films f2 on f2.id = a.related_film_id
),
figs as (
  select g.label, g.kind, g.description
  from figures g join f on f.id = g.film_id
  where g.status = 'approved'
),
locs as (
  select l.name, l.layer, l.narrative_setting, l.scene_role, l.country,
         row_number() over (order by l.confidence desc nulls last) rn
  from film_locations l join f on f.id = l.film_id
),
tropes as (
  select distinct mt.title, mt.laconic, mt.thesis
  from takes t
  join figures g on g.id = t.figure_id
  join f on f.id = g.film_id
  join meta_takes mt on mt.id = t.trope_id
  where t.status = 'published' and mt.status = 'published' and mt.kind = 'figure_type'
)
select case when not exists (select 1 from f) then null else jsonb_build_object(
  'pack_version', 1,
  'tier', p_tier,
  'generated_at', now(),
  'license', case when p_tier = 'full' then 'Metatake Creator License' else 'CC BY-NC 4.0' end,
  'source_url', 'https://metatake.net/film/' || (select slug from f),
  'film', (select to_jsonb(f) - 'id' from f),
  'takescore', (
    select jsonb_build_object(
      'score', round(v_value - r_risk, 1),
      'value', round(v_value, 1), 'cost', round(c_cost, 1), 'risk', round(r_risk, 1),
      'dims', jsonb_build_object(
        'cog', cog, 'aff', aff, 'form', form, 'moral', moral, 'dur', dur, 'itx', itx,
        'fr', fr, 'etx', etx, 'ctx', ctx, 'bank', bank, 'insincere', insincere,
        'coward', coward, 'polar', polar),
      'low_confidence', coalesce(flagged, false)
    ) from sc
  ),
  'standing', (select jsonb_build_object('prestige', round(prestige_score, 1), 'discovery', round(discovery_score, 1)) from st),
  'honors', (
    select coalesce(jsonb_agg(
      jsonb_build_object('list', label, 'facet', facet, 'result', result, 'rank', rank)
      order by rn), '[]'::jsonb)
    from honors where p_tier = 'full' or rn <= 8
  ),
  'readings', (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'framework', framework, 'title', take_title, 'theorist', theorist_name,
        'concept', concept, 'text', rationale,
        'figure', jsonb_build_object('label', figure_label, 'kind', figure_kind))
      order by strength desc nulls last), '[]'::jsonb)
    from (
      select * from rd
      where not coalesce(is_invitation, false)
      order by strength desc nulls last
      limit case when p_tier = 'full' then 100 else 10 end
    ) r
  ),
  'open_question', (select jsonb_build_object('text', rationale) from rd where coalesce(is_invitation, false) limit 1),
  'figures', case when p_tier = 'full'
    then (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'kind', kind, 'description', description)), '[]'::jsonb) from figs)
    else null end,
  'locations', case when p_tier = 'full'
    then (select coalesce(jsonb_agg(
            jsonb_build_object('name', name, 'layer', layer,
              'narrative_setting', narrative_setting, 'scene_role', scene_role, 'country', country)
            order by rn), '[]'::jsonb)
          from locs where rn <= 40)
    else null end,
  'tropes', case when p_tier = 'full'
    then (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'laconic', laconic, 'thesis', thesis)), '[]'::jsonb) from tropes)
    else null end,
  'kindred', (
    select coalesce(jsonb_agg(
      jsonb_build_object('title', title, 'year', year, 'slug', slug, 'shared_threads', shared_threads)
      order by rn), '[]'::jsonb)
    from kin where rn <= case when p_tier = 'full' then 24 else 8 end
  ),
  'counts', jsonb_build_object(
    'readings_total', (select count(*) from rd where not coalesce(is_invitation, false)),
    'included', least(
      (select count(*) from rd where not coalesce(is_invitation, false)),
      case when p_tier = 'full' then 100 else 10 end)
  )
) end
$$;

revoke execute on function public.film_context_pack(text, text) from public;
revoke execute on function public.film_context_pack(text, text) from anon, authenticated;
grant  execute on function public.film_context_pack(text, text) to service_role;
