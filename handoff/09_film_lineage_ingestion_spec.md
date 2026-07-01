# film_lineage 적재 스펙 (마스터용) · v1

> **왜 이 문서**: 대형 정전 랭킹(S&S 250·TSPDT 1000·국가 100선)과 영화제 전수상작은 **에이전트가 추측하면 오염**된다. 정확·완전하게 채우려면 **Wikidata(영화의 TMDb ID P4947를 동반)나 발행 리스트**에서 *그대로* 적재해야 한다. 이건 TMDb API/SPARQL 도구를 가진 **마스터가 수행**한다.
> 입력: `seeds/lineage_lists.csv`(각 라인의 `external_ref.wikidata` QID 보유) + `seeds/lineage_editions.csv`.

---

## 1. 산출 대상 (film_lineage)
컬럼(권장): `list_slug, edition_year, film_title, film_year, film_wikidata, film_tmdb, result, rank, source, confidence`
- 영화는 `film_tmdb`(가능시) 또는 `film_wikidata`/`film_title+year`로 식별 → `films.tmdb_id` 해소. 없으면 stub(`in_seed_catalog=false`).
- `result`: won/runner-up/nominated/listed/selected. `rank`: 정전 내 순위.

## 2. 영화제·시상식 전수상작 — Wikidata SPARQL
각 award 라인의 `external_ref.wikidata`(예: 황금종려상 Q179808)로 전 수상작을 TMDb ID와 함께:
```sparql
SELECT ?film ?filmLabel ?year ?tmdb WHERE {
  ?film wdt:P166 wd:Q179808 .                       # award received = Palme d'Or
  OPTIONAL { ?film wdt:P577 ?d. BIND(YEAR(?d) AS ?year) }
  OPTIONAL { ?film wdt:P4947 ?tmdb }                # TMDb movie ID
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
```
→ `result=won`, `edition_year=?year`, `film_tmdb=?tmdb`. 후보(nominated)는 `wdt:P1411`로 별도 질의. 황금사자상·황금곰상·오스카 등도 동일(우리 레지스트리의 QID 사용).

## 3. 정전 리스트 멤버십
- **Wikidata 항목이 있는 폴**(예: S&S 2022 Q115577992): 멤버를 `P361`(part of)/리스트 항목 관계로 질의하거나, 발행 순위표를 받아 `title+year`로 매칭 후 각 영화의 P4947로 tmdb 해소. `rank` 보존.
- **TSPDT 1000**: 공식 **엑셀**(제목·연도·IMDb id 일부)을 받아 IMDb→TMDb(`/find`)·또는 title+year로 해소. `rank` 보존, `edition_year=2026`.
- **AFI·BBC·Guardian·NYT·TIME·국가 100선**: 발행 리스트(대개 Wikipedia/원문)에서 순위표 추출 → title+year → tmdb. 주제 리스트(여성감독·외국어)는 `external_ref.scope` 유지.

## 4. film_auteur 와의 통합 (이미 산출됨)
- `mappings/film_auteur.csv`(407행, 감독 160명 대표작)도 같은 방식으로 영화를 해소: `film_wikidata` 있으면 그것으로, 없으면 `film_title+film_year`로 tmdb 해소 → `film_lineage`(facet=auteur, list=해당 감독 라인) + `value.rep_type`.

## 5. 정합성
- 모든 영화는 `films.tmdb_id`로 수렴(없으면 stub, `in_seed_catalog=false`).
- 라인↔에디션↔영화 FK 검증(`verify.sql` 확장).
- 같은 (film,list,edition) 중복 금지.

> 요약: **수상작·정전 멤버십의 '완전성'은 Wikidata/발행리스트 + TMDb 해소(마스터)로 달성**한다. 에이전트가 만든 건 *대표작(film_auteur)*까지이며, 그 이상(1000편 랭킹)은 추측하지 않는다.
