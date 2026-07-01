# FilmCurio / Metatake — 영화 카탈로그 & 큐레이션 분류 체계 인수인계 문서

> 작성일 2026-06-18 · 대상 프로젝트 **FilmCurio / Metatake** · Supabase 프로젝트 **kyniq**
> (`jvgarcqrtsmgfimdcwgo`) · 이 작업은 라이브 DB의 **격리 스키마 `curation`** 에 구현되었으며
> 메인(`public`)은 손대지 않았다.
>
> 이 문서는 (1) 왜 했는지(의도), (2) 어떻게 기획했는지, (3) 무엇을 구축했는지,
> (4) 왜 그렇게 결정했는지(논문용 근거), (5) 남은 작업, (6) 정확한 파일 위치를 빠짐없이 정리한다.

---

## 0. 한 페이지 요약

FilmCurio는 영화의 **상징·비평적 읽기**를 생성하는 시네필 대상 사이트다(엔티티 모델
`film → figure → take → meta-take`). 출발 질문은 *"앞으로 영화를 몇 편, 어떤 기준으로 더 넣을 것인가"* 였다.

이 작업에서 우리는 순서대로:
1. 기존 카탈로그(분석완료 ~1,957편)를 진단하고 **큐레이션 원칙**(reach × density × graph cohesion)과
   **demand × density 점수 모델**을 세웠다.
2. 그 원칙으로 **신규 후보 405편**과 **1,000편**(수요×밀도 랭킹) 리스트를 만들었다.
3. 그 사이 DB에 **4,744편의 정전·영화제 벌크 임포트**가 들어왔고, 이를 분석해
   "전부 분석할 가치가 있는가"를 판정했다 → **2축(권위 × 수요) 사분면**으로 슬라이스.
4. 국가별 정전을 **테마 허브(World Cinema Atlas)** 로 표면화하는 방향을 설계했다.
5. 이 모든 분류를 영구 관리할 **별도 분류 레지스트리(`curation` 스키마)** 를 tmdb_id 키로 구축했다.
6. **Phase 0(원산지 국가 재계산)** 를 in-DB로 실행해 **68개국 / 22개 라이브 국가 허브** 의 아틀라스를 세웠고,
   권위 있는 최종 확정용 **TMDB 스크립트**를 남겼다.

**현재 상태 스냅샷(2026-06-18):** 레지스트리 영화 6,701편 · 분석완료 1,957 · 분석대기(queued) 3,118 ·
보류(parked) 1,626 · 국가 허브 22 live + 14 planned + 지역 7 · 원산지 배정 2,609편(68개국) · 미확정 4,092편(TMDB 대기).

---

## 1. 배경 & 의도 (왜 했는가)

### 1.1 사이트의 정체성
FilmCurio/Metatake는 단순 영화 DB가 아니라 **비평 엔진**이다. 핵심 엔티티는 4층이다.

- **figure(형상)** — 작품에 고정된 구체적·관찰 가능한 요소(인물·사물·촬영지·트로프·형식).
- **take(밝힘)** — 한 형상에 다는 비평적 읽기 하나(화면 근거 필수).
- **meta-take(허브)** — 여러 영화의 형상을 끌어모으는 연결 개념 = **사이트의 주인공(고유 페이지)**.

즉 사이트의 가치는 영화 자체가 아니라 영화에서 추출되는 **상징·비평 밀도**에 있다. 청중은 **시네필**이다.
이 정체성이 모든 의사결정의 기준선이 되었다.

### 1.2 출발 질문
운영자(wonwoo)의 최초 질문: *"카탈로그에 영화를 몇 편 더, 어떤 영화를 넣어야 하는가? 유명하되 상징이
빈약하면 재미없고, 그렇다고 너무 마이너해도 곤란하다. 넷플릭스/Mubi/Kanopy 같은 플랫폼 큐레이션을
중심으로 하는 게 방법일까?"*

### 1.3 즉시 도출된 핵심 통찰
기존 카탈로그(당시 분석본)를 정량 분석한 결과:

- **"상징 없는 유명작" 우려는 데이터상 거의 근거가 없다.** 형상 산출량(figure yield)은 평균 8.2개/편으로
  고른 편이고, 대중영화도 풍부했다(오션스 일레븐 17개, 300 15개, 스콧 필그림 14개). 비평 이론(장르론·
  남성성 연구·이데올로기 비판)이 대중영화에도 적용되기 때문이다.
- **진짜 빈틈은 시대·지역**이었다: 1990~2010년대에 편중, **1980년 이전 정전은 사실상 공백**,
  인도·아프리카·대만/홍콩 뉴웨이브 등 지역 정전이 얇았다.

이 통찰이 "유명도"가 아니라 **비평 밀도 × 도달 가능성 × 그래프 응집성**을 기준으로 삼게 만든 출발점이다.

---

## 2. 기획 (어떻게 설계했는가)

### 2.1 3-필터 큐레이션 원칙 (모든 후보가 동시 통과)
1. **도달성(reach)** — Criterion·Mubi·Kanopy·TSPDT 1000·Sight&Sound·영화제 수상·스트리밍 인기 중
   최소 한 곳에 큐레이션됨. (= "찾아볼 수 있는 작품")
2. **밀도(density)** — 학술 비평 문헌이 존재. figure-enrich 엔진의 원료. (= "비평이 써진 작품")
3. **그래프 응집(graph cohesion)** — 기존 메타테이크·오퇴르에 연결되어 고아 노드를 만들지 않음.

### 2.2 3 바구니(bucket) 구성
- **클래식 정전 backfill** — 1980년 이전·세계영화·오퇴르 심화 (밀도 척추)
- **동시대 큐레이션** — 2018–2026 영화제·스트리밍·A24 + 살아있는 오퇴르 후속작 (신선도·SEO)
- **대중·장르 깊이** — 프랜차이즈·호러·애니·아시아 상업영화·다큐 (검색 트래픽)
- 가중치는 작업에 따라 40/33/27(균형) 적용.

### 2.3 demand × density 점수 모델 (1,000편 랭킹에 도입)
> `Priority = Demand(1–5) × Density(1–5) + 최신가산(2018~ +2, 2010~ +1) + 그래프가산(허브 감독 +1)`
- **Demand(수요/클릭)** = IMDb/Letterboxd 인기·평점, 스트리밍 최다시청, 박스오피스/프랜차이즈, 시네필 검색.
- **Density(밀도)** = TSPDT·S&S·Criterion·학술 비평·오퇴르·형상 산출 잠재력.
- 결과 리스트는 점수로 정렬(랭킹)되어 "플랫폼 안에서도 순위가 있다"는 직관을 반영.

### 2.4 2축 분류 — authority × demand (4,744 코호트 판정에 도입)
DB의 4,744편을 "전부 분석할지"를 결정하기 위해 **두 축을 분리**했다.
- **포함 여부(worth) = 시네필 권위(authority)** — total_score가 아니라 *리니지 권위*(canon/auteur facet 또는
  authority_weight ≥ 0.85)로 게이트. (이유는 §5.1 참조)
- **우선순위(order) = 수요(demand)** — total_score ≥ 32 또는 IMDb 표수 ≥ 25,000.
- 두 축의 2×2 사분면 → A(분석 우선) / B(시네필 딥컷 핵심) / C(선별) / D(보류).

### 2.5 World Cinema Atlas — 국가 정전 허브
국가별 정전을 한 덩어리가 아니라 **테마 큐레이션 허브**로 쪼개는 구상. 메타테이크가 영화를 *읽기(개념)*로
연결한다면, 국가 허브는 *출신·정전*으로 연결한다 — **직교하는 두 번째 내비게이션 축**. 더 나아가 "들어온 걸
큐레이션"에서 "**세계영화 지도를 먼저 그리고 각국 정전을 능동 수급**"으로 사고를 전환했다(§2.6).

### 2.6 능동적 정전 수급 전략 (선정 프레임)
- **게이트**: 권위 있는 정전 리스트가 존재/수급 가능한가.
- **단독 허브 조건**: 영화 ≥ ~12편 **또는** 높은 시네필 살리언스(세네갈처럼 적어도 단독 가치).
- **그 외**: 지역 허브로 묶음(서아프리카·마그레브·동남아·캅카스·발칸·중앙아시아·북유럽 군소).
- 규율 4가지(비대화 방지): ① 허브는 일찍 발행·영화 분석은 우선순위대로 ② 군소 국가영화는 밀도 한계 인정
  ③ 출처 권위 기준(아카이브 > 평론투표 > 국가영화상 > 매체) ④ 분석 비용 상한.

---

## 3. 분석 결과 (데이터로 본 것)

### 3.1 카탈로그 성장 타임라인 (DB `films.created_at` 코호트)
| 코호트 | 편수 | 임포트일 | 성격 |
|---|---|---|---|
| pilot | 15 | 06-02/03 | 파이프라인 시범 |
| seed_567 | 550 | 06-13 | 최초 시드(사용자 ~567편) |
| exp_405 | 400 | 06-17 | 본 작업 1차 후보 405 |
| exp_1000 | 992 | 06-18 | 본 작업 2차 후보 1,000 |
| **atlas_4744** | **4,744** | **06-25** | **정전·영화제 벌크 임포트(미분석)** |
| **합계** | **6,701** | | 분석완료 1,957 / 미분석 4,744 |

### 3.2 4,744 코호트의 정체
단순 "영화제 수상작"이 아니라 **399개 권위 리스트의 합집합**이었다. best-authority facet 기준 분포:
- national 1,702 · award 1,538 · canon 1,341 · auteur 160.
- 전 연대(1890s~2020s, 1950년 이전만 771편)·압도적 국제/아카이브 성격.
- 리니지 인프라: 리스트 399개, `film_lineage` 10,561행, `film_scores` 5,985, `film_ratings` 6,665,
  `film_reception` 8,884. **기존과 정확히 중복 0편.**

### 3.3 점수·수요 분포 (분석 판정의 근거)
- total_score: 분석완료 카탈로그 median 32.3 / p90 69.3 vs 신규 코호트 median 27.3 / p90 42.2
  → **신규는 체계적으로 낮음**.
- 수요(IMDb 표수): <1k 1,732편 · 1–5k 1,255 · 5–25k 1,009 · 25–100k 442 · ≥100k 215.
  → **63%가 표수 5천 미만(37%는 1천 미만)** = 질은 좋지만(평균 평점 7.0) 무명.

### 3.4 2×2 사분면 (atlas_4744)
| | 수요 高 | 수요 低 |
|---|---|---|
| **권위 高** | **A 813** — 지금 분석 | **B 1,179** — 시네필 딥컷 핵심 |
| **권위 低** | **C 1,126** — 선별 | **D 1,626** — 보류(미색인 보관) |

→ 권위 게이트 통과(분석 권장) ≈ **1,992편**, 보류 롱테일 ≈ **2,750편**.

### 3.5 국가 분포 (Phase 0 결과)
원산지 배정 후 **68개 원산국**. 상위: 미국·독일·프랑스·이탈리아·한국·일본·영국·스페인·멕시코·인도…
(국가 리스트만 보던 23개국에서 대폭 확장 — auteur=감독국적 신호가 ~65개국을 해금).

---

## 4. 구축물 (무엇을 만들었는가)

### 4.1 신규 후보 리스트
- **405편** — canon 164 / contemp 132 / popular 109 (40/33/27), 3 웨이브. 기존 567과 중복 0.
- **1,000편** — canon 400 / contemp 330 / popular 270, demand×density로 랭킹한 4 웨이브(각 250).
  기존 567 + 405와 중복 0.
- 산출 파일: §6 참조.

### 4.2 `curation` 격리 스키마 (분류 레지스트리) — 핵심 구축물
메인(`public`)과 **FK·트리거 없이 분리**된 별도 스키마. 키는 `tmdb_id`. 확인 후 단방향 뷰로 연결.

**테이블**
- **`curation.film`** (PK `tmdb_id`, 6,701행) — 식별(title·year·director·original_language·country_code)
  · 출처(cohort·added_at) · 상태(analysis_status·pipeline_status) · 점수(prestige/discovery/total_score·
  imdb_rating·imdb_votes) · 분류(authority_flag·demand_flag·quadrant·score_tier·primary_facet·bucket·
  **origin_confidence**) · 결정(recommended_action·ingest_wave·should_index) · 운영(manual_override·
  curator_note·updated_at).
- **`curation.hub`** (43행) — 아틀라스 정의. hub_slug·hub_type(country/region)·label·country_code·region·
  strategic_tier(T1/T2/regional)·authority_weight·status(live/planned)·source_ref.
- **`curation.film_hub`** (2,473행) — 영화↔허브 멤버십(rank·via_list).
- **`curation.rule`** (18행) — 임계값/정의 사전(분류 재현·수정 가능).

**함수(운영 프로세스)**
- `curation.reclassify()` — 점수 기준으로 quadrant·tier·action·wave·status를 재계산(manual_override 보호).
- `curation.rebuild_country_hubs()` — 12편 floor로 국가 허브 생성·승격·강등 + 멤버십 재구축(멱등).

**분류 규칙(요약)**
- authority_flag = canon/auteur facet 또는 authority_weight ≥ 0.85
- demand_flag = total_score ≥ 32 또는 imdb_votes ≥ 25,000
- quadrant = 두 플래그의 2×2 (A/B/C/D)
- recommended_action = A: analyze_now · B: wave2 · C: selective · D: park
- score_tier = T1≥42 / T2 32–42 / T3 20–32 / T4<20
- should_index = analysis_status=analyzed 일 때만 true

### 4.3 Phase 0 — 원산지 국가 & 아틀라스
`country_code`를 **원산지 기준**으로 재계산(in-DB). origin_confidence: confident / resolved / language /
unknown / api. **약 2,609편을 68개국에 배정**, **국가 허브 22 live + 14 planned + 지역 7**.
QC 검증으로 오염을 단계적으로 제거(§5.5). 권위 있는 최종 확정은 TMDB 스크립트(§6, §5.6).

---

## 5. 의사결정 기록 & 근거 (왜 그렇게 했는가) — *논문용 핵심*

### 5.1 왜 total_score로 자르지 않았나
프로젝트의 기존 `total_score`는 **대중·오스카 프레스티지 편향**이다. 상위는 Marty·Gandhi·La La Land,
**하위는 마야 데렌·샹탈 아커만·아녜스 바르다·클레르 드니** — 시네필이 가장 아끼는 아방가르드/여성/월드시네마
딥컷이다. 따라서 점수로 컷하면 *시네필 사이트가 버려선 안 될 것을 정확히 버린다.* → 포함 여부는 점수가 아니라
**권위(authority)** 로 게이트해야 한다는 결론.

### 5.2 왜 2축을 분리했나
"분석할 가치(worth)"와 "먼저 할 순서(priority)"는 다른 질문이다. worth는 시네필 권위로, priority는 수요로
판정해야 둘 다 만족한다. 이 분리가 권위 高·수요 低(B, 1,179편)인 **딥컷을 살리면서**(시네필 정체성) 동시에
트래픽 우선순위를 잡게 한다.

### 5.3 왜 "전부 분석"을 하지 않나
4,744편 전부 분석 시 카탈로그가 ~6,700편 → 편당 ~10 Q&A면 **~6.7만 페이지**. 프로젝트 문서가 경고한
'AI 과다 콘텐츠' SEO 위험 상한을 크게 넘고, 40%(D)는 점수<20·63% 표수<5천이라 비평 문헌이 얇아
**thin-page**를 양산한다. → 권위 게이트로 ~1,992편만 분석, 나머지는 미색인 보관.

### 5.4 왜 국가를 facet으로 슬라이스(아틀라스)했나
① **시네필 탐색 동선** — 시네필은 "한국영화/이란영화를 파보고 싶다" 식으로 국가 단위로 탐험한다.
② **GEO·토픽 권위** — "best Korean films" 같은 고의도 쿼리를 직격, *완전성 자체가 LLM 인용 권위*.
③ **고아 thin-page 회피** — 무명작에 부모 허브·내부 링크·맥락을 부여.
④ **운영 단위화** — 국가별로 끊어 발행·분석.
그리고 이건 새 인프라가 아니라 DB의 `lineage_lists`(facet='national')를 **표면으로 끌어올리는** 일이다.

### 5.5 왜 격리 스키마인가
메인 무중단·확인 후 연결·롤백 1줄(`drop schema curation cascade;`). 분류는 *메타데이터*이고 사이트 콘텐츠를
만들지 않으므로, 메인과 분리해도 사이트는 영향받지 않는다. 연결은 단방향 읽기 뷰로 충분하다.

### 5.6 Phase 0의 핵심 난제 — 리스트 멤버십 ≠ 원산지
가장 중요한 발견. **"X 리스트에 있다" ≠ "X에서 만들어졌다".** 오염원을 QC로 단계적으로 발견·제거했다:
1. **축제 개최국 오염** — 로카르노(스위스)·FESPACO(부르키나파소)·Fajr(이란) 등 *award facet*의 country는
   영화 원산지가 아니라 *축제 개최국*이라, 국제 수상작을 엉뚱한 국가에 배정(예: 〈킬러스 키스〉→스위스).
   → award facet 제외.
2. **국제 평론가 정전 오염** — 카이에 뒤 시네마(fr)·NBR(us) 같은 *canon facet* 리스트가 외국영화를 끌어옴
   (예: 〈위대한 독재자〉→fr). → canon facet 제외.
3. **범지역 리스트 오염** — 골든호스(대만, 범중화권)·키네마준포 연간상(일본, 외국영화 랭킹)이
   홍콩·미국 영화를 흡수(예: 〈다크 나이트〉→일본). → 해당 리스트 개별 제외.
4. **언어 일관성 가드** — 분석본은 `original_language`가 있어, *영어 영화는 비영어권 허브에 못 들어옴*으로
   잔여 오염 제거(예: 〈컨택트〉가 한국에서 제거).
최종적으로 **국가 신호는 감독국적(auteur)+자국 정전(national)** 만 신뢰. 그래도 언어정보 없는 atlas 영화의
일부 잔여 오염(예: 〈그랜 토리노〉가 아직 일본)은 in-DB로는 불가 → **권위 있는 확정은 TMDB
`production_countries`**(§6 스크립트). 이 정밀도/커버리지 트레이드오프 때문에 in-DB 단계는 **정밀도 우선**으로
(배정 2,609편) 잡고, 커버리지(나머지 4,092편)는 TMDB가 채우도록 설계했다.

### 5.7 인프라 제약 기록 (재현성)
- 작업 샌드박스는 **외부 인터넷이 없다**(TMDB·Supabase 직접 접속 불가, DNS 차단). DB 작업은 Supabase
  **MCP**(execute_sql)로만 수행. `web_fetch`는 GET 전용이라 TMDB Bearer 헤더 인증 불가, 긴 URL(SPARQL) 차단.
- 따라서 ~6,700건의 TMDB 호출은 샌드박스에서 불가능 → 운영자 머신/워커에서 1회 실행하는 스크립트로 분리.

---

## 6. 남은 작업 (TODO) — 우선순위 순

1. **[필수] Phase 0 finalizer 실행** — `02-phase0/phase0_origin_backfill.py`.
   `MetaTake/.env.local`의 `TMDB_READ_TOKEN`을 자동으로 읽음. `SUPABASE_DB_URL`만 설정 후 1회 실행
   (~6.7k 호출, ~4분). 효과: 미확정 4,092편의 원산지 확정 + 잔여 오염(그랜 토리노 등) 교정 +
   `rebuild_country_hubs()` 자동 호출 → 대만·네덜란드·체코·그리스·포르투갈·터키 등이 12편 floor를 넘겨
   라이브로 승격. **완료 후 `01-curation-db/curation_hub.csv` 재추출.**
2. **[필수] 메인 연결** — 확인 후 단방향 읽기 뷰 생성(`01-curation-db/curation_EXPORT_and_OPS.sql §7`).
   사이트는 `analysis_status·recommended_action·ingest_wave·should_index·film_hub`를 읽어 노출 제어.
3. **[권장] 위생 정리** — 기존 카탈로그 중복 8 + TMDB 오매칭 노이즈 ~10편 제거.
   전 영화 `original_language`/genres backfill(워커 `tmdb-fetch`).
4. **[선택] Wave 1 분석 파이프라인** — `recommended_action='analyze_now'`(quadrant A) 큐를 figure-enrich에
   투입해 실제 메타테이크 페이지 생성. *의무 아님* — 분류와 분석은 분리돼 있고, SEO 과다콘텐츠 위험 때문에
   소량 점진이 안전. "분석 콘텐츠를 더 늘리고 싶을 때"의 첫 배치.
5. **[성장] T2/지역 허브 정전 능동 수급** — 체코·헝가리·그리스·터키·포르투갈·이스라엘 등 단일 정전 수급 →
   임포트 → 허브. floor 미달은 지역 허브(서아프리카·동남아 등)로.
6. **[확장] 사조(movement)/주제 facet 허브** — 같은 lineage 기계로 누벨바그·뉴저먼·도그마95 등 사조 허브,
   감독 회고전 허브 → **국가·사조·작가 3중 큐레이션 그래프**(진짜 해자).

---

## 7. 데이터 모델 레퍼런스

### 7.1 `curation.film` 컬럼
identity: `tmdb_id`(PK) · `title` · `year` · `director` · `original_language` · `country_code`*
provenance: `cohort` · `added_at` · `source_note`
lifecycle: `analysis_status`(analyzed/queued/parked/excluded) · `pipeline_status`
scores: `prestige_score` · `discovery_score` · `total_score` · `imdb_rating` · `imdb_votes`
classification: `authority_flag` · `demand_flag` · `quadrant`(A/B/C/D) · `score_tier`(T1–T4) ·
  `primary_facet` · `bucket` · `origin_confidence`(confident/resolved/language/unknown/api)
decision: `recommended_action` · `ingest_wave` · `should_index`
ops: `manual_override` · `curator_note` · `updated_at`
\* `country_code`는 Phase 0 finalizer 실행 전까지 in-DB 추정값(§5.6).

### 7.2 코호트 매핑 (created_at → cohort)
06-02/03 → pilot · 06-13 → seed_567 · 06-17 → exp_405 · 06-18 → exp_1000 · 06-25 → atlas_4744 · 그 외 → manual

### 7.3 규칙 사전
전 18개 규칙은 `curation.rule` 테이블 및 `01-curation-db/curation_rule.csv` 참조(authority_flag·demand_flag·
quadrant·score_tier·should_index·hub.standalone·hub.regional·manual_override·origin_confidence·
country_code.source·phase0.status·origin.method 등).

---

## 8. 운영 매뉴얼 (전체 SQL은 `01-curation-db/curation_EXPORT_and_OPS.sql`)

- **영화 추가**: `curation.film`에 tmdb_id로 insert(점수 포함) → `select curation.reclassify();`
- **점수 갱신 후 재분류**: 동 SQL §6 resync → `reclassify()`.
- **허브에 영화 추가 / 계획 허브 승격**: 동 SQL §3, §4 또는 `select curation.rebuild_country_hubs();`
- **수동 분류 고정**: `manual_override=true` (재계산 배치가 보호).
- **전체 CSV 추출**: Supabase 대시보드 Export 또는 `\copy`(동 SQL §1).
- **롤백**: `drop schema curation cascade;`

---

## 9. 파일 인덱스 (정확한 위치)

루트: **`/Users/jerryje/Documents/MetaTake/curation-handover/`**

```
curation-handover/
├─ HANDOVER.md                         ← 이 문서 (마스터)
├─ 00-candidate-lists/
│   ├─ FilmCurio_확장후보_405.xlsx       후보 405 (4시트: 전략/후보/웨이브/Import)
│   ├─ metatake_films_expansion_405.csv 405 import용 3열 CSV
│   ├─ FilmCurio_확장후보_1000.xlsx      후보 1,000 (랭킹·4시트)
│   ├─ metatake_films_expansion_1000.csv 1,000 import용 3열 CSV(순위순)
│   └─ filmcurio_candidates_1000.csv    1,000 풍부 컬럼(점수·사분면·웨이브)
├─ 01-curation-db/
│   ├─ README_curation.md               레지스트리 스키마·사용·연결 설명
│   ├─ curation_EXPORT_and_OPS.sql       추출·추가·승격·연결·롤백 SQL 전부
│   ├─ curation_hub.csv                  아틀라스 허브 현재 스냅샷(43행)
│   ├─ curation_rule.csv                 규칙 사전
│   └─ curation_film_sample.csv          레지스트리 샘플(~20행, 구조 예시)
├─ 02-phase0/
│   ├─ phase0_README.md                  Phase 0 실행 내역·잔여·실행법
│   └─ phase0_origin_backfill.py         TMDB 원산지 최종 확정 스크립트(운영자 실행)
└─ 03-build-scripts/                     (재현성용)
    ├─ build_candidates.py / build_xlsx.py        405 생성
    ├─ build_1000.py / build_xlsx_1000.py         1,000 생성
    ├─ existing_567_titles.txt                    중복제거 기준(기존 시드 타이틀)
    └─ filmcurio_candidates.csv                   405 풍부 컬럼
```

**라이브 DB**: Supabase 프로젝트 `kyniq`(`jvgarcqrtsmgfimdcwgo`), 스키마 **`curation`**
(테이블 film·hub·film_hub·rule, 함수 reclassify()·rebuild_country_hubs()). 메인 스키마 `public`은 미변경.

---

## 10. 용어집

- **figure / take / meta-take** — 형상 / 밝힘(읽기) / 허브(연결 개념). 사이트 콘텐츠의 3층.
- **facet** — 리니지 리스트의 종류: national(국가 정전)·canon(정전)·award(영화제상)·auteur(감독)·
  festival·movement·style·section.
- **authority / demand** — 시네필 권위(포함 게이트) / 수요(우선순위).
- **quadrant A/B/C/D** — authority×demand 2×2. A 분석우선·B 딥컷핵심·C 선별·D 보류.
- **bucket** — 큐레이션 바구니: canon / contemporary / popular.
- **cohort** — 임포트 출처(pilot/seed_567/exp_405/exp_1000/atlas_4744/manual).
- **origin_confidence** — 원산지 신뢰도: confident·resolved·language·unknown·api.
- **atlas / hub** — 세계영화 지도 / 국가·지역·사조 큐레이션 허브.

---

## 11. 부록 — 현재 수치 스냅샷 (2026-06-18)

| 항목 | 값 |
|---|---|
| 레지스트리 영화(curation.film) | 6,701 |
| 분석완료 / 분석대기(queued) / 보류(parked) | 1,957 / 3,118 / 1,626 |
| atlas_4744 사분면 A/B/C/D | 813 / 1,179 / 1,126 / 1,626 |
| 국가 허브 live / planned / 지역 | 22 / 14 / 7 |
| 원산지 배정 / 미확정(TMDB 대기) | 2,609 / 4,092 |
| 원산국 수 | 68 |
| film_hub 멤버십 / 규칙 | 2,473 / 18 |

*이 표는 Phase 0 finalizer 실행 전 기준이며, 실행 후 배정·허브 수가 늘어난다.*

---

## 12. 부록 B — 사조(movement) 허브 연결 (2026-06-18 추가)

DB에는 사조 taxonomy가 **정의(라벨·슬러그)만 심어져 있고 영화 연결은 0건**이었다
(movement 67 · festival 18 · section 18 · style 15 = 총 118개 빈 리스트). 이는 운영자가 정보를 안 준
문제가 아니라, taxonomy 스캐폴딩의 멤버십이 채워진 적이 없던 상태다.

**해결**: 대부분의 사조는 **감독 정체성**으로 정의되므로, `curation.film.director`(2,155편 보유) +
auteur 신호를 이용해 **외부 정보 없이 자동 연결**했다. 방법 = 사조별 감독 로스터 + 연도창(year window),
`unaccent(lower(director))` 매칭. 결과:

- **사조 허브 27개 live**(324 film-movement 멤버십). curation.hub(hub_type='movement') +
  curation.film_hub에 적재.
- 상위: Iranian New Wave 28 · Japanese Golden Age 24 · French New Wave 22 · New Hollywood 21 ·
  New German Cinema 20 · Chinese Sixth Gen 18 · Korean New Wave 17 · Nuevo Cine Mexicano 17 …
- QC 검증 정확(예: French New Wave = 400 Blows·Breathless·Pierrot le Fou·Weekend; New Hollywood =
  Bonnie and Clyde·Godfather·Taxi Driver·Apocalypse Now·Raging Bull; Korean New Wave = 초록물고기·
  올드보이·마더·시).

**미연결(신호 부족)**: 스타일 기반 사조(film-noir, classical-hollywood, direct-cinema, essay-film,
cinema-verite, giallo/soviet-montage 등 저커버리지)는 감독만으로 정의되지 않는다. 이들은
키워드/장르/연도 또는 외부 신호(Wikidata P135, TMDB keywords)가 필요 → 후속 작업.

**재실행/확장**: `curation.rebuild_country_hubs()`는 국가 전용. 사조는 감독 로스터 매핑 SQL(이번 실행분)을
재사용·확장하면 된다. 규칙 `movement.hub`, `movement.method`를 `curation.rule`에 기록.

**갱신된 아틀라스 = 국가(country) + 지역(region) + 사조(movement)의 3축.** 최신 허브 스냅샷:
`01-curation-db/curation_hub.csv`(country 36 + movement 34 + region 7).

> 이로써 §5.4에서 예고한 **국가·사조·작가 3중 큐레이션 그래프** 중 국가·사조 두 축이 라이브가 되었다.
