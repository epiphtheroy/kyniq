# FilmCurio — curation registry (별도 분류 DB)

영화 분류 체계를 메인(`public`)과 **분리된** `curation` 스키마로 구축했습니다. 키는 `tmdb_id`.
Supabase 프로젝트 **kyniq** (`jvgarcqrtsmgfimdcwgo`)에 라이브로 들어가 있고, **메인과는 FK·트리거로
연결돼 있지 않습니다.** 확인 후 연결하시면 됩니다(EXPORT_and_OPS.sql §7).

## 무엇이 들어갔나 (현재 상태)

- `curation.film` — 영화 **6,701편** 레지스트리 (분석완료 1,957 + atlas_4744 4,744)
- `curation.hub` — **42개 허브** (라이브 국가 23 + 계획 국가 12 + 지역 7)
- `curation.film_hub` — **2,264개** 영화↔국가허브 멤버십
- `curation.rule` — **14개** 분류 규칙 사전
- `curation.reclassify()` — 점수 기준 재분류 함수 (운영 프로세스)

## 테이블 / 컬럼

### curation.film  (PK tmdb_id)
| 그룹 | 컬럼 |
|---|---|
| 식별 | tmdb_id, title, year, director, original_language, country_code* |
| 출처 | cohort(pilot/seed_567/exp_405/exp_1000/atlas_4744/manual), added_at, source_note |
| 상태 | analysis_status(analyzed/queued/parked/excluded), pipeline_status |
| 점수 | prestige_score, discovery_score, total_score, imdb_rating, imdb_votes |
| 분류 | authority_flag, demand_flag, quadrant(A/B/C/D), score_tier(T1–T4), primary_facet, bucket |
| 결정 | recommended_action(analyze_now/wave2/selective/park), ingest_wave, should_index |
| 운영 | manual_override, curator_note, updated_at |

\* `country_code`는 **잠정값**입니다(아래 주의).

### curation.hub  (PK hub_slug)
hub_slug · hub_type(country/region) · label · country_code · region · strategic_tier(T1/T2/regional)
· authority_weight · status(live/planned/sourcing) · source_ref

### curation.film_hub  (PK tmdb_id, hub_slug)
tmdb_id · hub_slug · rank(국가 정전 내 순위) · via_list(출처 리스트)

### curation.rule
key · category · definition · value  — 임계값/정의를 데이터로 보관(분류 재현·수정 가능)

## 분류 규칙 (요약)

- **authority_flag** = canon/auteur facet 리스트 소속 또는 리스트 authority_weight ≥ 0.85 (시네필 권위)
- **demand_flag** = total_score ≥ 32 또는 imdb_votes ≥ 25,000 (수요)
- **quadrant** = 두 플래그의 2×2 → A(권위+수요) / B(권위) / C(수요) / D(둘 다 낮음)
- **recommended_action** = A: analyze_now · B: wave2(시네필 딥컷 핵심) · C: selective · D: park
- **score_tier** = total_score 구간 T1≥42 / T2 32–42 / T3 20–32 / T4<20
- **should_index** = analysis_status=analyzed 일 때만 true (그 외 noindex)

현재 atlas_4744 분포: A 813 · B 1,179 · C 1,126 · D 1,626.

## 어떻게 쓰나 (운영) — EXPORT_and_OPS.sql 참조

1. **영화 추가**: `curation.film`에 tmdb_id로 insert(점수 포함) → `select curation.reclassify();` 가
   quadrant·action·wave·status를 자동 계산. (`manual_override=true`인 행은 보호됨)
2. **점수 갱신 후**: §6 resync → `reclassify()`.
3. **허브에 영화 추가 / 계획 허브를 live로 승격**: §3, §4.
4. **수동 분류 고정**: §5 (manual_override=true).
5. **전체 CSV 내보내기**: §1 (대시보드 Export 또는 `\copy`). 동봉 CSV는 hub/rule 전체 + film 샘플입니다
   (film 6,701행은 위 방법으로 1‑클릭 추출).

## 주의 — country_code 는 잠정값

국가 코드는 지금 *국가 정전 리스트 멤버십*에서만 도출됩니다. 그런데 일부 국가 리스트는 **자국 영화가
아니라 자국에서 상찬된 외국 영화**도 포함합니다(예: 키네마준포가 〈노인을 위한 나라는 없다〉를 수록).
그래서 country_code/국가 허브 배정은 "만들어진 나라"와 "상찬된 나라"를 섞고 있어 **일부 오배정**이 있습니다.

→ **정밀화(Phase 0)**: atlas_4744의 4,744편에 TMDB `original_language`/`production_countries`를
backfill한 뒤(워커가 이미 분석셋엔 채움) country_code를 *원산지 기준*으로 재계산하면 정확해집니다.
그 다음 T2 국가/지역 허브의 공백 산출도 정확해집니다.

## 메인 연결 (확인 후)

연결은 단방향 읽기 뷰로 충분합니다(EXPORT_and_OPS.sql §7). 사이트는
`analysis_status · recommended_action · ingest_wave · should_index · film_hub`를 읽어 노출을 제어.
롤백은 `drop schema curation cascade;` 한 줄.
