-- 적재 후 검증 (읽기 전용). 마스터 에이전트가 통합 후 실행. v3(에디션 3층)

-- 1) facet 분포
select facet, count(*) lists from public.lineage_lists group by facet order by lists desc;

-- 2) 에디션/연결 규모
select
  (select count(*) from public.lineage_editions) as editions,
  (select count(*) from public.film_lineage)      as links,
  (select count(distinct film_id) from public.film_lineage) as films_tagged,
  (select count(distinct list_id) from public.film_lineage) as lists_used;

-- 3) 고아 참조 (FK 있으면 0)
select
  (select count(*) from public.film_lineage fl
     left join public.lineage_lists ll on ll.id=fl.list_id where ll.id is null) as orphan_list,
  (select count(*) from public.film_lineage fl
     where fl.edition_id is not null and not exists
       (select 1 from public.lineage_editions e where e.id=fl.edition_id)) as orphan_edition;

-- 4) 규약 점검: has_editions=true 인데 에디션 없는 리스트
select ll.slug from public.lineage_lists ll
where ll.has_editions
  and not exists (select 1 from public.lineage_editions e where e.list_id=ll.id);

-- 5) 규약 점검: award/section 인데 result 없는 연결
select count(*) as award_links_missing_result
from public.film_lineage
where facet in ('award','section') and result is null;

-- 6) 규약 점검: canon 인데 edition_id 없는 연결(에디션 연결 권장)
select count(*) as canon_links_without_edition
from public.film_lineage where facet='canon' and edition_id is null;

-- 7) 상위 권위 리스트 표본
select slug, facet, authority_weight, film_count, selectivity
from public.lineage_lists order by authority_weight desc nulls last limit 20;

-- 8) 추천 직물 점검
-- select * from public.film_affinities where lineage_score is not null
-- order by lineage_score desc limit 20;
