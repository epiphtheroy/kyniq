# mappings/ — 영화↔리스트(+에디션) 소속/결과 (film_lineage)

컬럼: `tmdb_id, list_slug, edition_year, result, rank, value, confidence, source`

## 규칙
- `tmdb_id` 로 영화 참조(films.tmdb_id 해소). 내부 uuid 미사용 → 스키마 비종속.
- `list_slug` → lineage_lists.slug.
- `edition_year` 있으면 (`list_slug`,`edition_year`)→edition_id 해소. 사조 등 연도 없는 소속은 **공란**.
- `result`: `won`/`nominated`/`selected` (수상·선정). 정전·사조는 보통 공란.
- `rank`: 정전 에디션 내 순위(없으면 공란).
- `confidence`: Wikidata/공식 직매칭=1.0, 제목+연도 퍼지 매칭은 0.6~0.9(<0.8 검수 큐).

## 예시 행 설명(형식용, 적재 전 대체)
- `62` = 2001: A Space Odyssey → S&S 2022 감독폴 1위.
- `843` = In the Mood for Love → 칸 2000 경쟁부문 진출(selected) + 황금종려상 후보(nominated).
- `496243` = Parasite → 칸 2019 황금종려상 수상(won).
- `843` + `hk-new-wave` (edition_year 공란) = 연도 없는 사조 소속 예시.
> tmdb_id 정확도는 보장하지 않으며(형식 예시) 실적재 데이터로 대체합니다.
