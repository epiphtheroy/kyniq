# MetaTake 계보·점수 시스템 — 마스터 플랜 (전체 정리)

> 목표: **영화를 리스팅 → 정확히 태깅 → 태깅 기반 점수(총점·구분별·항목수) → 임베딩·별자리 계보 추출**이 가능한 DB를 만든다.
> 역할: 나(설계·데이터)는 read-only DB 열람 + 파일 산출만, 통합·적재는 마스터 에이전트.

---

## 1. 엔티티 / 테이블 맵 (= '별도로 관리되는 DB'들)

| 테이블 | 역할 | 핵심 키/필드 |
|---|---|---|
| `films` | 영화 | **tmdb_id(필수)** · **wikidata_id(필수)** · imdb_id · `in_seed_catalog`(로컬 1,900 여부 플래그) · visible/hold |
| `directors` | 감독(사람) | **tmdb_person_id(필수)** · **wikidata(필수)** · group(G1–G5) |
| `lineage_lists` | 라인 어휘(faceted) | facet(festival/section/award/canon/movement/style/national/auteur) · slug · **country** · tier(T1–T4) · **strategic_tier(S1–S4)** · authority_weight · selectivity · wikidata |
| `lineage_editions` | 연도판 | list_id · year · rank_max |
| `film_lineage` | **태깅(영화↔라인)** | result(won/runner-up/nominated/listed/selected) · rank · value · confidence · source |
| `auteur_edges` | 감독→감독 발굴 | a(신진)·b(기성)·relation(comparable/heir) |
| `lineage_sources` | 출처·크레딧 | name·url·license·credit |
| `film_scores` | **점수 산출물** | prestige/discovery/total · track · **components(jsonb 분해)** · model_version |
| `film_affinities` | **별자리** | related_film_id · shared_list_ids · lineage_score |

> 물리적으론 라인을 **하나의 faceted 테이블**로 둔다(점수·추천·쿼리를 통일하기 위해). 관리상으론 facet·country·별도 seed 파일로 *별도 DB처럼* 독립 큐레이션된다. → "별도 관리" 요구는 충족, 스키마 중복은 회피.

## 2. 확정된 핵심 결정

1. **앵커 = TMDB id** (films·directors 모두). **Wikidata QID는 1급 필드**로 전부 부착·관리.
2. **정전 완전성**: 라인은 TMDB 기준 *완전*. 로컬 1,900은 참고일 뿐 게이트 아님. DB 존재는 `in_seed_catalog` 플래그.
3. **3층 모델**: lineage_lists(시리즈) → lineage_editions(연도) → film_lineage(소속·결과). 연도는 항상 editions.
4. **등급 2축 + 감독축**: 리스트 권위 `tier`(T1–T4) ⟂ 전략 `strategic_tier`(S1–S4); 감독 신뢰도 `group`(G1–G5). 엔진은 전부 `authority_weight`(0–1)로 통일.
5. **점수는 3분리**: **Prestige(총점)** / **Discovery(희소·발굴)** / **Similarity(별자리·추천)**. ⚠️ 사조·스타일은 *총점 제외*(닮음이지 품질 아님) → Similarity로만.
6. **채점 기계**: `c_i = authority_weight × f_result × f_position`(+감독 floor) → 내림차순 감쇠 합. result: won1.0/runner-up0.60/nominated0.45/listed0.45/selected0.30.
7. **구분별 총점 + 항목수**: facet별 sub-score(수상/정전/영화제/국가…) + `components`에 기여 분해·항목수 저장.

## 3. 임베딩 & 별자리 (같은 태깅 데이터, 두 용도)

- **별자리(Similarity)**: 각 영화 = 가중 라인 벡터(sparse) → 공유 라인 기반 유사도 → `film_affinities.shared_list_ids`. 계보는 이 그래프를 따라 뽑음.
- **임베딩**: (a) 위 sparse 가중 벡터 자체, 또는 (b) pgvector dense 임베딩(리스트/영화 — 기존 DB가 이미 vector 사용). 둘 다 수용.
- ⚠️ **별자리(유사) ≠ 총점(권위)**. 같은 film_lineage에서 *다른 계산*. 혼동 금지.

## 4. 에이전트 & 중간 산출물 관리

- 리서치는 지역별·주제별 **서브에이전트 다수**. 결과는 CSV(이름·연도·**QID** 키; tmdb 정수 해소는 마스터 — 추측 금지).
- **산출물 관리 체계**(요청 반영):
  - `sources/` 원본 보존(감독사조·택소노미·등급·포트폴리오·awards 종합 등).
  - `seeds/`·`mappings/` 데이터, `*.template.csv` 규격.
  - `BACKLOG.md` 작업 큐(A–J), `MASTER_PLAN.md`(이 문서).
  - 행마다 `source`·`confidence`, 점수는 `components`·`model_version` → 재현·검수 가능.

## 5. 빌드 순서 (모인 배치)

1. **감독 레지스트리 통합** — 70개국 + G1–G5 등급 + G5 도시에(comparable_to) + 감독사조 + 택소노미 → `directors`(tmdb_person·QID) + `auteurs`(group) + `auteur_edges`.
2. **어휘 확장** — 영화제(전략축·신규) + 비평가/시상식 + 매체·국가 정전(역대+2000이후) + movement/style. (QID 부착, 충돌 정리.)
3. **완전 매핑** — Wikidata→tmdb로 수상작·정전 등재작·대표작을 *완전하게* `film_lineage`. 없는 영화는 stub(`in_seed_catalog=false`).
4. **파생값** — selectivity(IDF)·film_count 계산.
5. **점수 계산** — `film_scores`(prestige/discovery/total·구분별·components).
6. **별자리/임베딩** — `film_affinities` + 벡터.

## 6. 미해결·튜닝 (열린 항목)
- 가중치 최종 보정(감독 group 객관 보정 포함), 점수 파라미터(δ·C·γ) 캘리브레이션.
- 주제 리스트(여성감독·외국어)·craft(각본) 취급, region(중화권) 처리.
- 공개 노출 범위(감독 등급은 내부 신호).
