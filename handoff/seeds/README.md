# seeds/ — 시리즈/권위 + 연도판

두 파일로 나뉩니다. 실데이터는 `*.csv`(template 없는 이름)로 추가됩니다.

## 1) lineage_lists — 시리즈/권위 (안정 어휘)
컬럼: `facet, slug, label, parent_slug, has_editions, authority_weight, source, external_ref, description`
- `slug` 전역 UNIQUE, kebab. `facet` 네임스페이스 반영(예: `cannes-palme-dor`).
- `parent_slug` 는 같은 파일의 다른 `slug`(uuid 아님). award/section→festival, 하위사조→사조.
- `has_editions` = 연도판을 갖는가. award/section/canon=`true`, movement=`false`.
- `authority_weight` 0~1 추천 가중치(수작업).
- ※ `label_ko` 는 제거됨(요청 반영). 표시명 현지화는 후에 UI/별도 컬럼에서.

## 2) lineage_editions — 연도판 (연도가 사는 곳)
컬럼: `list_slug, year, edition_label, slug, rank_max, source, external_ref`
- `has_editions=false` 인 리스트는 여기 행이 없음.
- `slug` 예: `cannes-palme-dor-2019`, `sight-and-sound-critics-2022`.
- `rank_max` 는 정전 리스트 크기(예: 1000, 250).

> 템플릿의 예시 행은 적재 전 삭제/대체.
