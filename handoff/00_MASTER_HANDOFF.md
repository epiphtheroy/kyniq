# MetaTake 계보(Lineage) — 마스터 AI 인수인계 문서

> **이 문서 하나만 읽으면 전체를 파악할 수 있도록** 작성됨. 의도 → 설계 → 실제 구현 → 파일 위치 → 마스터가 할 일 순.
> 작성 주체: 설계·데이터 에이전트(DB 읽기 전용). 실제 DB 적재·웹 통합은 **당신(마스터 AI)** 의 역할.
> 모든 경로는 이 컴퓨터의 실제 절대경로다. 루트: `/Users/jerryje/Documents/MetaTake/handoff/`

---

## 0. 한 문단 요약

MetaTake(기존 Supabase 영화 사이트, TMDb 기반, 프로젝트 `kyniq`/`jvgarcqrtsmgfimdcwgo`)에 **"계보(lineage) 태그 레이어"** 를 붙인다. 영화를 정전(canon)·수상(award)·영화제·국가·감독 계보에 정확히 태깅하고, 그 멤버십들을 가중 합산해 **영화 1편의 총점(Total Score)** 을 매기며, 이를 통해 "별자리(constellation)" 식 추천을 한다. 이 핸드오프는 그 레이어의 **어휘(리스트)·감독·영화-라인 멤버십 실데이터**를 CSV로 완성한 패키지다. 당신은 이걸 DB에 적재하고, 각 영화를 **TMDb ID로 해소**한 뒤 점수를 계산하면 된다.

핵심 현황 수치:
- **영화-라인 멤버십 `film_lineage.csv` = 10,238행 / 115개 라인** (수상 4,998 + 등재 5,240)
- **영화 마스터 `films_master.csv` = 6,733편** (사이트 기존 ~1,900편과 무관하게 TMDb 기준 완전 열거)
- **감독 `auteurs.csv` = 160명** (전원 Wikidata QID 검증) + 대표작 `film_auteur.csv` 407행
- **라인 어휘 `lineage_lists.csv` = 239개** + 에디션 `lineage_editions.csv` 24개

---

## 1. 의도 & 기획 (왜 이걸 만드는가)

### 1.1 최종 목표 = 영화의 총점
사용자의 단일 최종 목표는 **"영화의 총점을 매긴다"**. 지금까지 만든 모든 라인(수상·영화제·정전·감독 등급·전략 포트폴리오)은 그 점수의 *입력*이다. 점수는 두 원칙을 지킨다:
1. **설명 가능(explainable)** — 왜 이 점수인지 라인별 분해(`components`)를 항상 보존. 블랙박스 금지.
2. **편향 보정** — 서구·정전(칸·오스카) 편중을 발굴/희소성 축으로 상쇄.

### 1.2 세 점수를 분리한다 (가장 중요한 설계 결정)
하나의 숫자로 뭉치지 않는다. 성격이 다른 셋을 분리한다:
1. **PrestigeScore (권위/품질)** — 총점의 핵심. 수상·정전·영화제 선정 + 감독 급. *"얼마나 인정받았나."*
2. **DiscoveryScore (희소/발굴)** — 프론티어·전위 영화제의 희소성. *"얼마나 미개척·발굴 가치인가."* 서구 편향 보정.
3. **SimilarityVector (유사/추천)** — 사조·스타일·감독. **스칼라 총점이 아님**(추천용 벡터). 사조·스타일은 *품질이 아니라 닮음*이므로 **총점에서 제외**(범주 오류 방지).

→ **총점 = PrestigeScore (+ γ·DiscoveryScore)**. (자세한 수식 §6)

### 1.3 "별자리(constellation)" 추천 로직
영화들이 공유하는 라인(같은 정전·같은 감독 계보·같은 영화제)으로 영화 간 친화도(`film_affinities`)를 만든다. 사용자의 관람 기록에서 미경험 movement/style을 역산해 "블라인드 스팟"을 추천하는 기능(백로그 F)으로 확장 가능.

### 1.4 사용자가 못박은 제약 (반드시 준수)
- **모든 영화 = TMDB id + (가능하면) Wikidata 링크. 모든 감독 = TMDB id + Wikidata 링크.** Wikidata QID는 1급 필드다.
- **정전 완전성**: 기준은 TMDB. 사이트의 기존 ~1,900편 목록은 *참고만*. 그 목록에 있든 없든 정전 라인은 완전히 나와야 한다. DB 존재 여부는 **`films.in_seed_catalog` 플래그**로만 별도 체크(게이트 아님).
- **읽기 전용 분리**: 설계·데이터 에이전트는 DB를 SELECT만 한다. **테이블 생성·적재·웹 연동은 마스터(당신)** 가 한다. (그래서 이 패키지가 CSV로 전달된다.)
- **TSPDT 1000 / iCheckMovies 류 1000 Greatest Films는 빠뜨리면 안 된다** → TSPDT 1000은 1–1000 완전 열거됨.

---

## 2. 핵심 설계 결정

### 2.1 3층 데이터 모델
```
lineage_lists (시리즈/권위체)  →  lineage_editions (연도판/폴 에디션)  →  film_lineage (영화별 소속/결과)
```
- **연도(year)는 항상 editions 에 산다.** 리스트는 "칸 황금종려상"이라는 권위체, 에디션은 "1955년 황금종려상", 멤버십은 "〈마티〉가 1955 황금종려상 수상".
- 단, 실데이터 `film_lineage.csv`에는 편의상 `edition_year`를 행에 직접 담았다(마스터가 edition으로 정규화).

### 2.2 facet (라인의 8종 분류)
`festival`(영화제 부모노드) · `section`(경쟁부문 등 선정) · `award`(상) · `canon`(정전/베스트 리스트) · `movement`(사조) · `national`(국가 정전·국가상) · `auteur`(감독 계보) · `style`(스타일).

### 2.3 가중치 통합 (`authority_weight`, 0–1)
세 개의 독립 축을 하나의 `authority_weight`로 통합해 점수가 단순해진다:
- **`tier` T1–T4** (권위 등급): T1 .90–1.0 / T2 .70–.88 / T3 .50–.68 / T4 .30–.45.
- **`strategic_tier` S1–S4** (영화제 "포트폴리오" 축, 직교): S1 정상급·S2 전위·S3 프론티어·S4 전문(다큐/복원/애니). → DiscoveryScore 입력.
- **감독 `group` G1–G5** (낮을수록 거장): G1 0.92 · G2 0.82 · G3 0.70 · G4 0.55 · G5 0.40.

### 2.4 result 계수 (`f_result`)
won 1.0 · runner-up 0.60 · nominated 0.45 · **listed 0.45** · selected 0.30. (정전 등재는 순위계수 `f_position`으로 별도 처리.)

### 2.5 ID 해소 전략 (에이전트는 추측 금지)
데이터 에이전트는 TMDb 정수 ID나 QID를 **절대 지어내지 않았다.** 모든 행은 `title + year`(+ 일부 QID) 같은 **안정 키**로만 적는다. **마스터가 TMDb로 해소**한다(이게 마스터의 홈그라운드). 따라서 Wikidata 직접 접속이 막혀도 무방하다.

---

## 3. 실제 구현 결과 (무엇이 만들어졌나)

### 3.1 어휘 레이어 (레지스트리) — `seeds/`
- **`lineage_lists.csv` (239행)** — 모든 라인의 권위 어휘. facet별: movement 67 · award 56 · national 47 · festival 18 · section 18 · canon 18 · style 15. 140개에 Wikidata QID 부착. 컬럼: `facet,slug,label,parent_slug,has_editions,tier,authority_weight,source,external_ref(jsonb),description,country,strategic_tier`.
- **`lineage_editions.csv` (24행)** — S&S 각 에디션, TSPDT 2026(rank_max 1000), AFI 1998/2007, BBC/NYT/TIME/Cahiers/WGA 등.

### 3.2 감독 레이어 — `seeds/` + `mappings/`
- **`auteurs.csv` (160명)** — 70개국 대표 감독. 전원 Wikidata QID 검증(중복 없음). G1 26·G2 22·G3 32·G4 28·G5 52. 컬럼: `slug,name,country,also_country,wikidata,birth_year,group,authority_weight,source,notes`.
- **`auteur_edges.csv` (53행)** — "비슷한 감독" 발굴 간선(comparable_to). 22개는 레지스트리 연결, 31개는 외부 벤치마크.
- **`film_auteur.csv` (407행)** — 감독 대표작. `auteur_slug,film_title,film_year,film_wikidata,rep_type(defining/recent/both),note`. 160명 전원 커버, 406편 고유.

### 3.3 영화-라인 멤버십 — `mappings/film_lineage.csv` (★핵심, 10,238행)
컬럼: `list_slug,edition_year,film_title,film_year,result,rank,note,source`. 채워진 라인 115개. **완전 열거된 대표 라인**:
- **영화제 최고상 전수상**: 칸 황금종려·베니스 황금사자·베를린 황금곰 + 로카르노·로테르담·산세바스티안·카를로비바리·TIFF 인민상·선댄스 GJP
- **영화제 서브상**: 칸(그랑프리·심사위원상·감독상·각본상·남우·여우·카메라도르) · 베니스(은사자 감독·볼피 남우·여우·심사위원대상) · 베를린(은곰 심사위원대상·감독·연기)
- **아카데미·길드·예측지표**: 오스카(작품·감독·국제장편·남우·여우·오리지널각본·각색각본) · BAFTA(작품·감독) · 골든글로브(드라마·뮤지컬코미디) · EFA · 인디스피릿 · DGA · PGA · SAG · 크리틱스초이스 · 고섬 · Saturn · AFA · WGA(오리지널·각색·101대 각본)
- **비평가상**: NYFCC(작품·첫작품) · LAFCA · NSFC · NBR(작품 + Top Ten 연도별 874행)
- **국가 작품상 (20+개국)**: 프 César · 스페인 Goya · 이탈리아 David · 한국 청룡·대종·백상 · 일본 아카데미·키네마준보 Best · 대만 금마장 · 홍콩 HKFA · 중국 금계 · 인도 NFA·필름페어 · 이란 크리스털 시모르그 · 아르헨 실버콘도르 · 브라질 Grande Otelo · 멕시코 Ariel · 호주 AACTA · 캐나다 CSA · 러시아 Nika·골든이글 · 독일·스웨덴·폴란드·덴마크 Bodil/Robert
- **정전/베스트 리스트**: S&S 2022(비평가 100 + 감독 104) · AFI 100 · BBC(21세기·외국어·여성감독 각 100) · NYT 21세기 100 · TIME 100 · Guardian 21세기 100 · Cahiers 100 · **TSPDT 1000(1–1000 완전)** · 1001 Movies(부분 160) · **NFR 925(1989–2025 전 induction 완전)** · 금마장 100 · 키네마준보 올타임 · 이탈리아 100 da salvare · BFI 100 영국 · KOFA 100 한국 · 스페인 Caimán 100 · 브라질 Abraccine 100 · 독일·스웨덴 정전 · 디케이드/21세기 폴(IndieWire 2010s · Cine21 · 멕시코 Somos · 호주·폴란드·루마니아 등)

### 3.4 영화 마스터 — `seeds/films_master.csv` (6,733편)
`film_auteur` + `film_lineage`에서 추출·중복제거한 영화 유니버스. 컬럼: `film_title,film_year,film_wikidata,tmdb_id,n_director_refs,director_slugs,rep_types,source`. (대부분 `tmdb_id`·`film_wikidata`는 비어있음 → 마스터가 해소.) 연대 분포 1890s~2020s, 정점 2010s 894편.

### 3.5 적재 지시서 — `mappings/film_lineage_ingestion_manifest.csv` (139행)
각 라인을 어떻게 채울지 마스터에게 알려주는 표: `list_slug,facet,wikidata,method,note`. 68개는 SPARQL 즉시 가능. (단, **실데이터가 이미 `film_lineage.csv`에 들어있으므로** 대부분은 그 CSV를 직접 적재하면 됨. 매니페스트는 보강·교차검증용.)

---

## 4. 파일 인벤토리 (전체, 실제 경로)

루트: `/Users/jerryje/Documents/MetaTake/handoff/`

### 4.1 마스터가 꼭 읽을 것 (실행 entry)
| 파일 | 내용 |
|---|---|
| `00_MASTER_HANDOFF.md` | **이 문서.** 전체 개요 |
| `10_master_ingestion_runbook.md` | **실행 절차서.** resolve_film()/resolve_person(), SPARQL 템플릿, 적재 순서 |
| `02_schema.sql` | 제안 마이그레이션 v3 (그대로 써도, 자체 스키마로 변형해도 됨) |
| `07_scoring_model.md` | 총점 채점 모델 (수식·예시·파라미터) |
| `OVERVIEW_STATS.md` | 최종 통계 개요 (수치·국가 커버리지·최다 호명 영화) |
| `verify.sql` | 적재 후 검증 쿼리 |

### 4.2 적재할 실데이터 (CSV)
| 파일 | 행수 | 역할 |
|---|---|---|
| `seeds/lineage_lists.csv` | 239 | 라인 어휘 (먼저 적재) |
| `seeds/lineage_editions.csv` | 24 | 에디션(연도판) |
| `seeds/auteurs.csv` | 160 | 감독(=auteur 라인 + directors) |
| `mappings/auteur_edges.csv` | 53 | 감독 발굴 간선 |
| `mappings/film_auteur.csv` | 407 | 감독 대표작 멤버십 |
| `mappings/film_lineage.csv` | **10,238** | **★ 영화-라인 멤버십 (핵심)** |
| `seeds/films_master.csv` | 6,733 | 영화 유니버스(중복제거, tmdb 해소 대상) |
| `mappings/film_lineage_ingestion_manifest.csv` | 139 | 라인별 적재방법(보강용) |

### 4.3 설계·스펙 문서
| 파일 | 내용 |
|---|---|
| `00_INTERFACE_CONTRACT.md` | 경계·모델·키·파일 규격·통합 절차 |
| `01_design.md` | 기존 Supabase DB 분석과 설계 근거 |
| `03_registry_spec.md` | 레지스트리 빌드 스펙, tier 루브릭 T1–T4 |
| `04_auteur_spec.md` | 감독 등급 G1–G5, comparable_to, rep_type |
| `05_style_spec.md` | 스타일/감독사조 라인 스펙 |
| `06_taxonomy_map.md` | movement/style 어휘 매핑 |
| `08_gap_analysis.md` | 갭 분석·result 계수 확장 근거 |
| `09_film_lineage_ingestion_spec.md` | 정전 멤버십 적재 스펙 |
| `MASTER_PLAN.md` / `BACKLOG.md` / `README.md` | 전체 계획 / 백로그(A–J) / 패키지 안내 |
| `ingest_spec.md` | 적재 규칙 |

### 4.4 원본 소스(참고)
`sources/awards_lists_compendium.md` · `cinephile_master_taxonomy.md` · `director_grades_source.md` · `director_styles_source.csv` · `festival_portfolio_apex_predator.md`. `seeds/auteurs_graded.seed.csv`·`auteurs_g5.seed.csv` = 감독 등급 provenance.

### 4.5 무시해도 되는 잔여물
`mappings/_w*.csv` (37개, 전부 `# merged ... safe to delete` 마커) 와 `mappings/_nbr_raw.txt` 는 열거 과정의 임시파일이다. 샌드박스 권한상 삭제만 못했을 뿐 내용은 이미 `film_lineage.csv`에 병합됨 → **삭제해도 무방.** `*.template.csv`는 빈 규격 템플릿.

---

## 5. 데이터 모델 / 스키마 (`02_schema.sql` 요지)
- `lineage_lists` — facet check(8종 포함), 컬럼: country, tier, strategic_tier, authority_weight, selectivity, has_editions, external_ref(jsonb), merged_into, parent_id.
- `lineage_editions` — (list, year) 단위.
- `film_lineage` — surrogate id, **unique (film_id, list_id, coalesce(edition_id, 0-uuid))**, result/rank/value(jsonb).
- `lineage_list_aliases`, `lineage_sources` — 별칭·출처.
- **additive**: `film_affinities`에 `shared_list_ids uuid[]`, `lineage_score numeric` 추가 / `films`에 **`in_seed_catalog boolean not null default true`** 추가 / 신규 `film_scores`(아래).
- RLS 활성 + public-read 정책.

---

## 6. 점수 모델 (`07_scoring_model.md` 요지)

**신호별 기여** `c_i = w_list × f_result × f_position` (0 ≤ c_i < 1).
- `f_position`(정전만): `0.5 + 0.5·(1 − (rank−1)/(rank_max−1))` → 1위≈1.0, 최하≈0.5, 순위없으면 1.0.
- **감독 기여**: `c_director = authority_weight(group) × 0.6` (거장이 약한 작품의 바닥을 받침).

**집계 = 정렬 감쇠 합** (depth 보상, 포화 방지):
```
raw = Σ_k  c_(k) · δ^(k−1)        (δ ≈ 0.6, c 내림차순 정렬)
PrestigeScore(0–100) = 100 · raw / C       (C ≈ 2.42, 백분위 캘리브레이션)
```
→ 가장 큰 상이 영화를 정의하되, 추가 성취가 *깊이*로 더해진다(팔메 단독 < 팔메+오스카+정전).

**DiscoveryScore** = `max over (S2∪S3 멤버십) ( w_list × f_result × selectivity_norm )`. `Total* = PrestigeScore + γ·DiscoveryScore` (γ≈0.15).
**트랙 분리**: feature/documentary/animation/restoration 별로 PrestigeScore 내부 정규화. 다큐를 극영화와 한 스케일로 비교하지 않음.

**저장 `film_scores`**(additive): `film_id, track, prestige_score, discovery_score, total_score, components(jsonb), model_version, computed_at`. `components`로 점수 분해 보존(설명가능성).

검증 예: 〈기생충〉 PrestigeScore ≈ 88 (칸 팔메 0.97 + 오스카 작품 0.96·감독 0.86·국제 0.80 + 감독 G1 0.55 …의 감쇠합). 데이터 정합성 점검상 최다 호명 영화 = Parasite·Brokeback Mountain·Schindler's List(각 19개 라인) → prestige 신호 정상.

---

## 7. 마스터가 할 일 (실행 순서)

> 상세는 `10_master_ingestion_runbook.md`. 핵심 함수 2개:
> - **`resolve_film()`**: `film_wikidata` 있으면 Wikidata `P4947`→tmdb. 없으면 TMDb `/find`(IMDb P345) 또는 `search(title+year)`. 실패시 stub 생성(`visible=false,hold=true,in_seed_catalog=false`).
> - **`resolve_person()`**: `auteurs.wikidata`(QID)→Wikidata `P4985`→`directors.tmdb_person_id` (기존 directors와 dedupe).

1. **스키마** — `02_schema.sql` 적용(또는 변형). facet enum, `strategic_tier`, `in_seed_catalog` 포함.
2. **라인/에디션** — `lineage_lists.csv`(239) upsert `ON CONFLICT(slug)` → `parent_slug→parent_id` 2차 패스. `lineage_editions.csv`(24) upsert.
3. **auteur 라인 + directors** — `auteurs.csv`(160) → `lineage_lists`(facet=auteur, tier=group, external_ref={wikidata,tmdb_person,birth_year}) + `directors` upsert(resolve_person).
4. **감독 간선** — `auteur_edges.csv`(53) → `auteur_edges`.
5. **감독 대표작** — `film_auteur.csv`(407) → 각 행 resolve_film → `film_lineage`(facet=auteur, value={rep_type}).
6. **★ 수상·정전 멤버십** — `film_lineage.csv`(10,238)을 행별로: `list_slug`→list_id, `edition_year`→edition(없으면 생성), `film_title+film_year`→resolve_film→film_id, `result`/`rank` 보존. **이게 메인 적재.** (매니페스트 SPARQL는 누락 보강·교차검증용으로만.)
7. **영화 해소** — `films_master.csv`(6,733)로 사전 해소하거나, 6번에서 on-the-fly. tmdb 매칭 실패분은 stub + `in_seed_catalog=false`.
8. **파생값** — `selectivity`(IDF)·`film_count` 재계산, `film_affinities`(shared_list_ids, lineage_score).
9. **★ 점수** — `07_scoring_model.md`대로 `film_scores` 계산(track 분리, components 보존).
10. **검증** — `verify.sql` + 라인별 멤버 커버리지 + FK + 중복(film,list,edition) 점검.

---

## 8. 데이터 규약 (마스터가 알아야 할 파싱 규칙)

- **CSV의 콤마 포함 제목**은 큰따옴표로 감쌌거나(예 `"Crouching Tiger, Hidden Dragon"`) 콤마를 제거했다. 표준 CSV 파서로 읽으면 됨. (혹시 깨지면: 첫 2필드 + 마지막 4필드 고정, 가운데가 제목인 위치 기반 파서를 쓰라.)
- **`edition_year`(시상/선정 연도) ≠ `film_year`(개봉 연도)** 를 구분해 채웠다. 시상식은 보통 `film_year = edition_year − 1` (예: 오스카). 정전·연도리스트는 보통 같다.
- **동점/공동수상**: `note=shared`. 한 시상식이 여러 영화를 뽑은 해는 각 영화가 별도 행.
- **연기/감독/각본상**도 모두 **해당 영화(film)** 로 매핑했다(사람 이름이 아니라 영화 제목).
- **제목 표기**: 영어/국제 제목 우선, 없으면 원어. TSPDT는 정관사 후치형(`Godfather, The`)이 일부 있음 → resolve_film에서 정규화 권장.
- `source` 컬럼은 전부 `wikipedia-enum`(또는 mirror). 출처 추적은 라인 단위.

---

## 9. 품질·신뢰도·갭 (정직하게)

### 9.1 신뢰 수준
- **높음**: 위키피디아 표를 `?action=raw` 또는 reader 프록시로 받은 라인(영화제 최고상·오스카·길드·국가상·NFR·NBR·TSPDT 등). 에이전트가 7필드 CSV 파싱으로 자가검증.
- **중간**: 일부 정전/디케이드 폴(미러에서 재구성). 오래되거나 모호한 항목은 tmdb 해소 시 미매칭으로 자동 검출됨 → 매칭 실패분은 검수.

### 9.2 의도적으로 비워둔 것 (추측 금지 원칙)
- `national-es-caiman-21c-50` (Caimán 21세기 50선) — 신뢰할 출처 없음/존재 불확실 → **미작성.**
- `national-dk-best` (덴마크 올타임 정전) — 신뢰할 폴 없음 → **미작성.**
- `1001-movies` — 160/약1434만 적재(미러 페이지네이션 한도). 완전판 원하면 listchallenges 36페이지 재열거 필요.

### 9.3 저가치라 의도적으로 **미진행**(사용자 결정: 마스터 선택 보강)
- `criterion-collection`(~1,500) · `mubi-top-1000`(커뮤니티) · `cahiers-annual-top-ten`(연도별) — 부피만 크고 총점 변별력 낮음.
- **영화제 섹션**(`cannes-competition`, `un-certain-regard`, `venice-orizzonti`, `berlin-panorama` 등 18개) — result=selected, weight 0.30. 연간 수십편×수십년이라 매우 크고 변별력 낮음. 필요시 `P1411`(nominated for)로 보강.
- 영화제 **부모노드 18개**(`cannes`,`venice` 등)는 컨테이너라 직접 멤버 불필요(정상).

### 9.4 환경 제약 (왜 일부가 부분적인가)
이 작업은 web_fetch만 외부 접근 가능했고(샌드박스 curl 불가), 공용 호출 한도(429)에 걸렸다. 우회책으로 **listchallenges 미러 · r.jina.ai reader 프록시 · 위키피디아 `?action=raw`** 를 썼다. 마스터는 Wikidata SPARQL·TMDb API를 직접 쓸 수 있으므로 이 제약이 없다 → 부분/누락분을 매니페스트로 손쉽게 보강 가능.

---

## 10. 다음 단계 한 줄
**스키마 적용 → CSV 적재(2~7) → `film_lineage.csv`의 title+year를 TMDb로 해소 → `film_scores` 계산 → `verify.sql`.** 그러면 총점·별자리가 즉시 산출된다.
