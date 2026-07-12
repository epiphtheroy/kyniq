-- 0085_film_context_pack.sql — 컨텍스트 팩 화이트리스트 조립 RPC (데이터 상품 W1)
-- 정본: HANDOFF-컨텍스트팩-실행.md §4(포맷)·§5(화이트리스트)·§6.1.
--
-- 원칙:
--   • 금지 필드는 SELECT 자체에서 배제한다 (프론트 필터 의존 금지). 특히 좌표(lat/lng),
--     TMDB 편집필드(overview/tagline/poster/genres/…), OMDb 평점, 시청처, verbatim 인용.
--   • LLM 호출 0 — 순수 DB→jsonb 조립. 렌더는 lib/pack.ts가 이 jsonb를 마크다운으로.
--   • 유료 경계 = DB 엣지 (§2-7): full 함수는 service_role 전용, trim 래퍼만 anon.
--
-- 슬러그 적격: is_analyzed=true AND visible=true (Tier-1). 그 외 → NULL 반환 → 라우트 404.

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
  where slug = p_slug and is_analyzed = true and visible = true
),
sc as (  -- TakeScore: 공개 film 페이지의 cinecodex_for와 동일 선택(패널 우선순위, distinct on).
         -- ⚠️ flagged를 제외하지 않는다 — 사이트가 flagged 점수도 표시하므로(cinecodex_for),
         -- 제외하면 팩이 원본 페이지와 모순되고 Tier-1의 70%가 점수를 잃는다(2026-07-12 실측).
         -- 대신 low_confidence 마커로 정직하게 노출한다.
  select distinct on (s.film_id)
         v_value, c_cost, r_risk,
         cog, aff, form, moral, dur, itx, fr, etx, ctx, bank, insincere, coward, polar,
         flagged
  from cinecodex.scores s
  join f on f.id = s.film_id
  order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
),
st as (  -- Metatake canon-standing (track='all' 단일 행, §6.0 확인)
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
rd as (  -- 프레임워크당 대표 1개 (strength → confidence → created_at 결정론)
  select distinct on (t.framework)
    t.framework, t.take_title, t.theorist_name, t.concept, t.rationale,
    t.strength, t.is_invitation, g.label as figure_label, g.kind as figure_kind
  from takes t
  join figures g on g.id = t.figure_id and g.status = 'approved'  -- 화이트리스트: 승인 피겨만 노출 (사이트 readings와 동일)
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
locs as (  -- ⚠️ 좌표(lat/lng) 절대 미포함 (§5). 지명·layer·국가·산문만.
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
      'score', round(v_value - r_risk, 1),   -- headline TakeScore (= film 페이지의 u = value − risk)
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

-- 유료 경계: Postgres는 함수에 PUBLIC EXECUTE를 기본 부여 → 명시적으로 회수한다 (§2-7).
revoke execute on function public.film_context_pack(text, text) from public;
revoke execute on function public.film_context_pack(text, text) from anon, authenticated;
grant  execute on function public.film_context_pack(text, text) to service_role;

-- 트림 전용 무인증 래퍼 (anon에 노출되는 유일 함수). SECURITY DEFINER라 내부 full 함수를
-- 정의자 권한으로 호출하지만, tier를 'trim'으로 하드코딩하므로 full은 절대 새지 않는다.
create or replace function public.film_context_pack_trim(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
set statement_timeout to '12s'
as $$
  select public.film_context_pack(p_slug, 'trim')
$$;

revoke execute on function public.film_context_pack_trim(text) from public;
grant  execute on function public.film_context_pack_trim(text) to anon, authenticated;
