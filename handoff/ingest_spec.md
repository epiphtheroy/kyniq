# 적재 명세 (Ingest Spec) · v3 (에디션 3층)

> 마스터 에이전트가 seeds/mappings 를 적재할 때의 규칙.

## 1. 순서
1. `lineage_lists` upsert(`ON CONFLICT (slug)`) → `parent_slug`→`parent_id` 2차 패스.
2. `lineage_editions` upsert(`ON CONFLICT (slug)`) — `list_slug`→`list_id` 해소. `(list_id, year)` 유일.
3. `film_lineage` upsert — `tmdb_id`→`films.id`, `list_slug`→`list_id`, (`list_slug`,`edition_year`)→`edition_id`.
4. `selectivity`/`film_count` 재계산(`02_schema.sql` §8).
5. `film_affinities` additive 확장 → `lineage_score`/`shared_list_ids` 계산.

## 2. upsert 키
- `lineage_lists`: `(slug)`
- `lineage_editions`: `(slug)` [= 사실상 (list_id, year)]
- `film_lineage`: `(film_id, list_id, coalesce(edition_id, 0-uuid))`

## 3. 정전 완전성 / tmdb_id 미존재 처리 (확정)
- 계보는 **TMDB 기준으로 완전하게** 채운다. 로컬 ~1,900 카탈로그는 *참고일 뿐 게이트가 아니다.*
- tmdb_id 미존재 → **스킵 금지**, `films`에 tmdb_id 앵커로 레코드 생성(`visible=false`, `hold=true`).
- DB 존재 유무 = **`films.in_seed_catalog` 플래그**로만 기록(기존=true, 신규 정전영화=false). 게이팅 아님.

## 4. edition 해소 규칙
- `edition_year` 가 있는데 해당 에디션이 없으면 → 적재 보류 후 `lineage_editions` 보강(에디션 먼저).
- `edition_year` 공란(사조 등) → `edition_id = null`, list 직접 연결.

## 5. result/rank 규약
- award/section: `result` 필수 권장(won/nominated/selected), `rank` 보통 null.
- canon: `rank` 권장(에디션 내 순위), `result` null.
- movement/national(연도없음): 둘 다 null 가능.

## 6. confidence
- 공식/Wikidata 직매칭 1.0 · 퍼지 0.6~0.9 · `<0.8` 검수 큐.

## 7. 출처 표기
- `lineage_sources`(또는 각 행 `source`)로 크레딧 보존 → 공개 페이지 명시.

## 8. 미해결(다음 단계)
- [ ] facet 별 authority_weight 기준표 확정.
- [ ] 영화제/정전 최종 범위(계약서 §7) 확정.
- [ ] 사조 자동분류 후 수작업 검수 범위.
