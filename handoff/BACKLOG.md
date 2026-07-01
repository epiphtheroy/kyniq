# MetaTake 계보 — 배치 작업 백로그 (Queued Work)

> 여러 건을 모아 **한꺼번에 실행**하기 위한 큐. 각 항목은 스펙이 준비되면 build로 전환.

| # | 작업 | 입력/스펙 | 산출물 | 상태 |
|---|---|---|---|---|
| A | **국가-감독 아우터 라인 (+5그룹 등급 +신진 발굴)** | 70개국 감독 + `sources/director_grades_source.md`(G1–G5 prior) + `seeds/auteurs_g5.seed.csv`(G5 53명 구조화·comparable_to) + `04_auteur_spec.md` | `seeds/auteurs.csv`(160·QID검증), `mappings/auteur_edges.csv`(53) ✅ Wave2 / `mappings/film_auteur.csv`(407·감독160) ✅ Wave3a | ✅ **감독 레지스트리+대표작 완료**(film_lineage 해소는 마스터) |
| B | **스타일/감독사조 라인** | `sources/director_styles_source.csv` + `05_style_spec.md` | `style`(+grouping) 어휘 + director→style 멤버십 | 스펙 완료, **build 대기** |
| C | **정전 영화 단위 매핑** | 레지스트리(`seeds/*.csv`) | `mappings/film_lineage.csv`(**10,238행/115라인**) + `seeds/films_master.csv`(**6,733편**) + `OVERVIEW_STATS.md` | ✅ **전수 열거 완료(Wave4–12)**: 영화제 최고상+서브상·오스카/길드/예측지표·비평가상·20여개국 국가상·TSPDT1000·NFR925·NBR Top10·정전 다수. 잔여(Criterion·MUBI·섹션)는 저가치 → 마스터 선택 보강. **다음 = tmdb 해소** |
| D | **Wikidata QID 콘코던스** | 전체 리스트/감독/영화 | QID 부착·검증 유지(상시) | 진행 규칙(상시) |
| E | **movement/style 어휘 확장** | `sources/cinephile_master_taxonomy.md` + `06_taxonomy_map.md` | movement +26·style +15·genre-cycle (레지스트리 반영) / movement→감독 멤버십은 Wave2 | ✅ **레지스트리 빌드 완료(Wave1)** |
| F | **블라인드 스팟 탐지(기능)** | 택소노미 + 사용자 관람기록 | 미경험 movement/style 역산 기능 | 아이디어 (제품) |
| G | **영화 총점 채점 모델** | 전 라인 + `07_scoring_model.md` | `film_scores`(prestige/discovery/total + components) | 스펙 완료, **계산 대기**(라인 적재 후) |
| H | **영화제 전략축·신규 영화제 확장** | `sources/festival_portfolio_apex_predator.md` | `strategic_tier`(S1–S4) 부여 + 신규 영화제/섹션 20개 | ✅ **레지스트리 빌드 완료(Wave1)** |
| I | **시상식·비평가·매체·국가 정전 대량 확장** | `sources/awards_lists_compendium.md` + `08_gap_analysis.md` | 신규 ~40-55개(골든글로브·크리틱스초이스·EFA·AFA·인디스피릿·고섬·새턴 / NSFC·NYFCC·LAFCA·NBR+Top10 / DGA·SAG·WGA·PGA / BBC·Guardian·NYT·TIME·Cahiers100·WGA101 / 국가 정전 역대+2000이후) | ✅ **레지스트리 빌드 완료(Wave1)** (일부 national 검토필요) |
| J | **점수 result 계수 확장** | `08_gap_analysis.md` | runner-up 0.60 / listed 0.45 / debut 플래그 — `07_scoring_model.md` 반영 완료 | **반영됨** |

## 통합 원칙(공통)
- 감독은 **하나의 레지스트리**로 합친다(A의 아우터 + B의 감독사조 = 동일 인물군). 사람=`directors`, 키=`tmdb_person_id`/Wikidata QID.
- **정전 완전성**: TMDB 기준 완전, 로컬 ~1,900은 참고. DB 존재 = `films.in_seed_catalog` 플래그(게이트 아님).
- **Wikidata QID는 1급 필드**로 모든 리스트/감독/영화에 부착·관리(`external_ref.wikidata`).
- 에이전트는 tmdb 정수 ID 추측 금지 → 이름+연도+QID로, tmdb 해소는 마스터.

## 실행 순서(권장)
1. 감독 레지스트리 통합 빌드(A+B 동시) — QID·country·movement·style 한 번에.
2. 정전 영화 매핑(C) — Big-3부터 완전 적재.
3. 가중치 최종 튜닝 → `film_affinities` 계산.
