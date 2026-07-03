-- 0029 — me_recommend_wwi v2 (ROOM-HANDOVER-MASTER §8 P0-3)
-- 변경점 (기존 시그니처·수식·정렬 보존):
--  1) reasons: conquer 실태깅 — 후보가 "진행 중 계보(관람 50–99%, total≥5)"의 완파를 진척시키면 방출.
--  2) reasons: gap 실태깅 — discovery≥55 프록시 제거. 후보가 실제 블라인드 계보
--     (권위 aw≥0.55, total≥10, 미답 또는 관람<3%)에 속할 때만 방출.
--  3) 제외 규칙 정밀화 — seen/dismissed만 후보에서 제외. 워치리스트 담기(watchlist)는
--     후보로 유지되어 새로고침 후에도 "담음" 상태로 계속 보인다(S8 제자리 마킹).
--  4) 반환 컬럼 끝에 in_watchlist boolean 추가(프론트 kept 시딩용).
-- 반환 타입 변경이므로 drop 후 재생성.

drop function if exists public.me_recommend_wwi(numeric, integer);

create function public.me_recommend_wwi(p_lambda numeric default 1.0, p_limit integer default 12)
returns table(slug text, title text, year integer, poster_path text, director text,
              v numeric, r numeric, ts integer, prestige numeric, conf integer, tier text,
              sim numeric, u_util integer, t_taste integer, s_standing integer, wwi integer,
              disc numeric, reasons text[], avail json, delta integer, in_watchlist boolean)
language sql stable security definer
set search_path = public, cinecodex
as $$
  with loved as (
    select l2_normalize(avg(ftv.embedding)) lv, count(*) n
    from user_movies um
    join film_taste_vector ftv on ftv.film_id = um.film_id
    where um.user_id = auth.uid() and um.seen = true and um.rating >= 3.5 and ftv.embedding is not null
  ),
  best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.r_risk
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  seenp as (
    select fs.prestige_score p, row_number() over (order by fs.prestige_score desc) k
    from user_movies um join film_scores fs on fs.film_id = um.film_id
    where um.user_id = auth.uid() and um.seen = true and fs.prestige_score is not null
  ),
  pdbase as (select coalesce(sum((p/100.0) * power(0.85, (k-1)::numeric)), 0) s from seenp),
  mycov as ( -- 엔진⑦ 파생: 계보별 관람 커버리지 (conquer/gap 실태깅의 공통 기반)
    select ll.id list_id, coalesce(ll.authority_weight, 0.5) aw,
           count(distinct fl.film_id) total, count(distinct sm.film_id) seen_n
    from lineage_lists ll
    join film_lineage fl on fl.list_id = ll.id
    left join (select um.film_id from user_movies um where um.user_id = auth.uid() and um.seen) sm
      on sm.film_id = fl.film_id
    where ll.status = 'active'
    group by ll.id, ll.authority_weight
  ),
  conquer_lists as ( -- 도장깨기: 진행 중(50–99%) 라인
    select list_id from mycov
    where total >= 5 and seen_n < total and seen_n::numeric / total >= 0.5
  ),
  gap_lists as ( -- 엔진④ 블라인드: 권위 있는 미답/얕음 라인
    select list_id from mycov
    where total >= 10 and aw >= 0.55
      and (seen_n = 0 or seen_n::numeric / total < 0.03)
  ),
  cand as (
    select f.id fid, f.slug, f.title, f.year, f.poster_path, f.director,
           round(b.v_value,1) v, round(b.r_risk,1) r,
           round(b.v_value - greatest(p_lambda,0)*b.r_risk)::int ts,
           fs.prestige_score prestige, fs.discovery_score disc, coalesce(cc.conf,40) conf, coalesce(cc.tier,'Moderate') tier,
           round((1 - (ftv.embedding <=> loved.lv))::numeric, 3) sim,
           greatest(0, least(1, (b.v_value - greatest(p_lambda,0)*b.r_risk)/100.0)) u01,
           greatest(0, least(1, ((1 - (ftv.embedding <=> loved.lv)) - 0.60)/0.35)) t01,
           greatest(0, least(1, coalesce(fs.prestige_score,0)/100.0)) s01,
           coalesce(cc.conf,40)/100.0 c01, b.v_value vv, b.r_risk rr
    from loved
    join film_taste_vector ftv on loved.n >= 3 and loved.lv is not null
    join films f on f.id = ftv.film_id and f.visible
    join best b on b.film_id = ftv.film_id
    left join film_scores fs on fs.film_id = ftv.film_id
    left join cinecodex_confidence cc on cc.film_id = ftv.film_id
    where not exists (
      select 1 from user_movies um2
      where um2.user_id = auth.uid() and um2.film_id = ftv.film_id
        and (um2.seen or coalesce(um2.dismissed, false))
    )
  )
  select c.slug,c.title,c.year,c.poster_path,c.director, c.v,c.r,c.ts,c.prestige,c.conf,c.tier, c.sim,
    round(c.u01*100)::int u_util, round(c.t01*100)::int t_taste, round(c.s01*100)::int s_standing,
    round(100 * c.c01 * (0.45*c.u01 + 0.35*c.t01 + 0.20*c.s01))::int wwi,
    c.disc,
    coalesce(nullif(array_remove(array[
      case when c.rr <= 15 then 'safe' end,
      case when c.sim >= 0.82 then 'reading' end,
      case when c.prestige >= 80 then 'canon' end,
      case when exists (select 1 from film_lineage flg
                        where flg.film_id = c.fid and flg.list_id in (select list_id from gap_lists))
           then 'gap' end,
      case when exists (select 1 from film_lineage flc
                        where flc.film_id = c.fid and flc.list_id in (select list_id from conquer_lists))
           then 'conquer' end,
      case when (c.rr between 16 and 28 and c.vv >= 75) or c.disc >= 40 then 'frontier' end
    ], null), '{}'), array['frontier']) reasons,
    (select case
       when jsonb_typeof(wp.results #> '{KR,flatrate}') = 'array' and jsonb_array_length(wp.results #> '{KR,flatrate}') > 0
         then json_build_object('state','on','provider', wp.results #>> '{KR,flatrate,0,provider_name}')
       else json_build_object('state','unk') end
     from film_watch_providers wp where wp.film_id = c.fid) avail,
    greatest(0, round(100 * (
        power(0.5, (select s from pdbase)/1.4)
      - power(0.5, ((select s from pdbase) + (coalesce(c.prestige,0)/100.0) * power(0.85, (select count(*) from seenp sp where sp.p > coalesce(c.prestige,0))::numeric))/1.4)
    )))::int delta,
    exists (select 1 from user_movies um3
            where um3.user_id = auth.uid() and um3.film_id = c.fid and um3.watchlist) in_watchlist
  from cand c
  order by c.c01 * (0.40*c.t01 + 0.25*c.s01 + 0.35*greatest(0,least(1, c.vv/100.0))) desc
  limit greatest(p_limit,1);
$$;
