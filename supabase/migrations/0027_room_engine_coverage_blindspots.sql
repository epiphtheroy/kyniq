-- 0027 — /room 엔진 ⑦ 커버리지 + ④ 블라인드 전용 RPC (ROOM-HANDOVER-MASTER §8 P0-1/2)
-- me_coverage(): 전 facet(canon/award/national/auteur) 실측 분모(count distinct film_lineage) 커버리지.
--   portfolio_breakdown.canon(상위 8개 대형정전) 파생의 구조적 저평가를 해소한다.
--   state = S4 완파 4-state: lock<50 / prog50–74 / near75–99 / done100.
-- me_blindspots(): 전 facet 블라인드(미답/얕음<3%) + 엔진④ 생산성 게이트
--   opportunity = authority × (1−coverage) × productivity × (1 + 0.3·selectivity_norm)
--   productivity = clip(cos(v_watched, lineage_anchor), 0.35, 1) — "취향 인접한 안전한 모험"만 권유.

create or replace function public.me_coverage(p_min_total int default 5, p_limit int default 80)
returns table(list_id uuid, slug text, label text, facet text, aw numeric, seen int, total int, pct int, state text)
language sql stable security definer
set search_path = public
as $$
  with mine as (
    select um.film_id from user_movies um
    where um.user_id = auth.uid() and um.seen = true
  ),
  cov as (
    select ll.id, ll.slug, ll.label, ll.facet, coalesce(ll.authority_weight, 0.5) aw,
           count(distinct fl.film_id) total,
           count(distinct m.film_id) seen_n
    from lineage_lists ll
    join film_lineage fl on fl.list_id = ll.id
    left join mine m on m.film_id = fl.film_id
    where ll.status = 'active'
    group by ll.id, ll.slug, ll.label, ll.facet, ll.authority_weight
    having count(distinct fl.film_id) >= greatest(p_min_total, 1)
  )
  select id, slug, label, facet, aw,
         seen_n::int, total::int,
         floor(100.0 * seen_n / total)::int as pct,
         case
           when seen_n >= total then 'done'
           when 100.0 * seen_n / total >= 75 then 'near'
           when 100.0 * seen_n / total >= 50 then 'prog'
           else 'lock'
         end as state
  from cov
  order by (100.0 * seen_n / total) desc, aw desc, total desc
  limit greatest(p_limit, 1);
$$;

create or replace function public.me_blindspots(p_limit int default 12, p_min_total int default 10, p_min_aw numeric default 0.55)
returns table(list_id uuid, slug text, label text, facet text, aw numeric, seen int, total int,
              ratio numeric, productivity numeric, opportunity numeric, gap_reason text)
language sql stable security definer
set search_path = public
as $$
  with mine as (
    select um.film_id from user_movies um
    where um.user_id = auth.uid() and um.seen = true
  ),
  vw as ( -- 엔진① v_watched: 관람작 등가평균 벡터
    select avg(ftv.embedding) v, count(*) n
    from mine m join film_taste_vector ftv on ftv.film_id = m.film_id
  ),
  cov as (
    select ll.id, ll.slug, ll.label, ll.facet, coalesce(ll.authority_weight, 0.5) aw,
           coalesce(ll.selectivity, 0) sel,
           count(distinct fl.film_id) total,
           count(distinct m.film_id) seen_n
    from lineage_lists ll
    join film_lineage fl on fl.list_id = ll.id
    left join mine m on m.film_id = fl.film_id
    where ll.status = 'active'
    group by ll.id, ll.slug, ll.label, ll.facet, ll.authority_weight, ll.selectivity
    having count(distinct fl.film_id) >= greatest(p_min_total, 1)
       and coalesce(ll.authority_weight, 0.5) >= p_min_aw
       and (count(distinct m.film_id) = 0
            or count(distinct m.film_id)::numeric / count(distinct fl.film_id) < 0.03)
  ),
  anch as ( -- 계보 앵커 벡터 = 소속 영화 taste vector 평균
    select c.id, avg(ftv.embedding) av
    from cov c
    join film_lineage fl on fl.list_id = c.id
    join film_taste_vector ftv on ftv.film_id = fl.film_id
    group by c.id
  )
  select c.id, c.slug, c.label, c.facet, c.aw,
         c.seen_n::int, c.total::int,
         round(c.seen_n::numeric / c.total, 4) as ratio,
         prod.p as productivity,
         round(c.aw * (1 - c.seen_n::numeric / c.total) * prod.p
               * (1 + 0.3 * least(c.sel / 10.0, 1)), 4) as opportunity,
         case when c.seen_n = 0 then 'untouched' else 'shallow' end as gap_reason
  from cov c
  left join anch a on a.id = c.id
  cross join vw
  cross join lateral (
    select case
      when vw.n < 3 or a.av is null then 0.70  -- 콜드스타트/무벡터 → 게이트 중립(과필터 방지)
      else greatest(0.35, least(1.0, round((1 - (vw.v <=> a.av))::numeric, 4)))
    end p
  ) prod
  order by opportunity desc
  limit greatest(p_limit, 1);
$$;
