# 마스터 적재 런북 (Master Ingestion Runbook) · v1

> 마스터 에이전트가 이 핸드오프를 DB로 적재하는 **실행 절차**. 수상작·정전 멤버십은 여기서 **Wikidata SPARQL/발행 리스트 + TMDb 해소**로 완성한다(에이전트 추측분 없음).
> 입력: `02_schema.sql`, `seeds/*.csv`, `mappings/*.csv`, 스펙 `00·03·04·05·06·07·09`.

---

## 0. 공통 — 영화 해소 함수 `resolve_film()`
1. `film_wikidata` 있으면 → Wikidata `P4947`(TMDb movie ID) → `films.tmdb_id`.
2. 없으면 → TMDb `/find` by IMDb(`P345`) 또는 TMDb search `title+year`.
3. 매칭 실패 → `films` stub 생성(tmdb 있으면 채우고, `visible=false`,`hold=true`), **`in_seed_catalog=false`**.
   - 기존 ~1,900 카탈로그 영화는 `in_seed_catalog=true`(default).

감독 해소 `resolve_person()`: `auteurs.wikidata`(QID) → Wikidata `P4985`(TMDb person ID) → `directors.tmdb_person_id`(없으면 생성, 기존 862행과 dedupe).

---

## 1. 스키마
`02_schema.sql` 적용(또는 자체 스키마로 변형). facet enum: festival/section/award/canon/movement/national/auteur/style. `lineage_lists.strategic_tier`, `films.in_seed_catalog` 포함.

## 2. 라인 어휘
- `seeds/lineage_lists.csv`(239) upsert(`ON CONFLICT(slug)`) → `parent_slug→parent_id` 2차 패스.
- `seeds/lineage_editions.csv`(24) upsert.
- **auteur 라인 생성**: `seeds/auteurs.csv`(160) → `lineage_lists`(facet=auteur, slug, label=name, country, tier=group, authority_weight, external_ref={wikidata, tmdb_person, birth_year}). 동시에 `directors` upsert(resolve_person).
- `seeds/auteurs_graded.seed.csv`/`auteurs_g5.seed.csv`는 provenance(참고).

## 3. 감독 발굴 간선
`mappings/auteur_edges.csv`(53) → `auteur_edges`. `b_slug` 빈 행(외부 벤치마크 31)은 참조 감독으로 추가하거나 텍스트 유지.

## 4. 감독 대표작 (이미 산출됨)
`mappings/film_auteur.csv`(407) → 각 행 resolve_film → `film_lineage`(facet=auteur, list_id=auteur-라인, `value={"rep_type":...}`). rep_type defining/recent/both.

## 5. 수상작·정전 멤버십 (SPARQL/발행 리스트) — `mappings/film_lineage_ingestion_manifest.csv`(139)
매니페스트의 `method`별로:

### 5a. `sparql_P166` (award/national award, QID 보유 68개)
```sparql
SELECT ?film ?filmLabel ?year ?tmdb WHERE {
  ?film wdt:P166 wd:{QID} .                      # award received
  OPTIONAL { ?film wdt:P577 ?d. BIND(YEAR(?d) AS ?year) }
  OPTIONAL { ?film wdt:P4947 ?tmdb }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
```
→ `result=won`, `edition_year=?year`. **후보(nominated)**: 동일하되 `?film wdt:P1411 wd:{QID}`.
→ resolve_film로 tmdb 해소 후 `film_lineage(list_slug, edition_year, result, ...)`.

### 5b. QID 없는 award 22개(서브상)
먼저 그 상의 Wikidata QID를 확인(`external_ref.wikidata` 보강) 후 5a. 또는 Wikipedia "List of … winners" 표를 title+year로 적재. (목록: 칸 그랑프리·심사위원상·감독상·각본상·남녀주연상, 베니스·베를린 서브상, 선댄스 GJP, 부산 뉴커런츠, 크리틱스초이스, 새턴, BAFICI/FESPACO/IDFA/CPH:DOX/Annecy 상.)

### 5c. `canon` 18개 (랭킹)
- Wikidata 리스트 항목이 있으면(S&S 2022 Q115577992, TIME Q3738538 등) 멤버+순위 추출.
- 없으면 **발행 리스트**: **TSPDT 1000 = 공식 엑셀**(제목·연도·IMDb) → resolve_film, `rank` 보존, `edition_year=2026`. AFI/BBC/Guardian/NYT/TIME/Cahiers/WGA·국가 100선도 원문 순위표 → title+year → tmdb, `rank` 보존. 주제 리스트(women/foreign)는 `scope` 유지.

### 5d. `section` 18개 (경쟁부문 진출)
영화제 에디션 데이터/`P1411`(nominated for)로 in-competition 목록 → `result=selected`(가중치 낮음). 필요도 낮으면 후순위.

> 매니페스트 `wikidata` 열이 SPARQL 즉시 가능 여부. award 56·national 47·canon 18·section 18.

## 6. 파생값 & 점수
- `selectivity`(IDF)·`film_count` 재계산(`02_schema.sql §8`).
- `film_affinities`(shared_list_ids, lineage_score) 계산.
- **`film_scores`**: `07_scoring_model.md`대로 Prestige(감쇠합)·Discovery(전략축 S2/S3 희소)·track 분리, `components` 보존, result 계수(won1.0/runner-up0.60/nominated0.45/listed0.45/selected0.30).

## 7. 검증
`verify.sql` + 매니페스트 커버리지(각 라인이 멤버를 받았는지)·FK·중복(film,list,edition) 점검.

---
## 순서 요약
스키마 → 라인/에디션/auteur 라인 → directors → auteur_edges → film_auteur → (SPARQL/발행)수상·정전 → 파생/점수 → 검증.
