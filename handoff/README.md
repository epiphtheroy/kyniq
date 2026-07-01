# MetaTake — 계보(Lineage) 핸드오프 패키지

계보(정전·수상·영화제·사조·국가) 태그 레이어를 **별도로 구축해 마스터 에이전트에게 넘기기 위한** 패키지입니다.

## 전제
- 설계·데이터 에이전트는 **DB 읽기(SELECT)만** 합니다. 쓰기·DDL·적재는 하지 않습니다.
- **통합(테이블 생성·적재·웹 연동)은 마스터 에이전트가** 수행합니다.
- 모든 데이터는 **`tmdb_id`(영화) + `slug`(리스트) + (`list_slug`,`year`)(에디션)** 라는 안정 키로만 참조 → 마스터가 어떤 스키마를 쓰든 통합 가능.

## 데이터 모델 (3층)
`lineage_lists`(시리즈) → `lineage_editions`(연도판) → `film_lineage`(소속/결과). **연도는 항상 editions 에** 있습니다.

## 읽는 순서
1. `00_INTERFACE_CONTRACT.md` — **여기부터.** 경계·모델·키·파일 규격·통합 절차·범위 카탈로그.
2. `01_design.md` — 기존 DB 분석과 설계 근거.
3. `02_schema.sql` — 제안 마이그레이션 v3.
4. `seeds/`, `mappings/` — 적재 데이터(현재 규격 템플릿).
5. `ingest_spec.md`, `verify.sql` — 적재 규칙·검증.

## 상태
- [x] 폴더 골격 + 인터페이스 계약서
- [x] 설계도 / 제안 스키마 v3 (에디션 3층, `tier` 추가, `label_ko` 제거, `result`/`rank` 1급화)
- [x] 레지스트리 빌드 스펙(`03_registry_spec.md`) — 등급 루브릭 T1–T4
- [x] **레지스트리 실데이터**: `seeds/lineage_lists.csv`(133개), `seeds/lineage_editions.csv`(15개) — 검증 통과
- [ ] `mappings/film_lineage.csv` 실데이터 (영화 단위 매핑)
- [ ] `ingest_spec.md` / `verify.sql` 수치 확정

---

## ✅ 적재 준비 완료 — 마스터 실행 (Waves 1–3, 2026-06-25)
**마스터 진입점: `10_master_ingestion_runbook.md`** (순서대로 실행).
- 라인 어휘 `seeds/lineage_lists.csv`(239) + `seeds/lineage_editions.csv`(24) — 검증 통과
- 감독 `seeds/auteurs.csv`(160·QID검증) + `mappings/auteur_edges.csv`(53)
- 감독 대표작 `mappings/film_auteur.csv`(407)
- 수상·정전 멤버십 → `mappings/film_lineage_ingestion_manifest.csv`(139) + `09_*` 스펙으로 **마스터가 Wikidata SPARQL/발행 리스트 + TMDb 해소**
- 점수 `07_scoring_model.md` → `film_scores`

## ✅ Wave4–12 — 수상·정전 실데이터 (위키피디아/미러 열거) — **통계는 `OVERVIEW_STATS.md`**
- `mappings/film_lineage.csv`(**10,238행 / 115개 라인** · won 4,998 / listed 5,240):
  - **영화제 최고상 전수상**: 칸 황금종려·베니스 황금사자·베를린 황금곰 + 로카르노·로테르담·산세바스티안·KV·TIFF인민·선댄스 + 칸/베니스/베를린 서브상(그랑프리·감독상·각본·연기·카메라도르·볼피·은곰)
  - **아카데미·길드·예측지표**: 오스카(작품·감독·국제장편·연기·각본)·BAFTA(작품·감독)·골든글로브(드라마·뮤지컬)·EFA·인디스피릿 + DGA·PGA·SAG·크리틱스초이스·고섬·AFA·Saturn·WGA(오리지널·각색·101)
  - **비평가상**: NYFCC(작품·첫작품)·LAFCA·NSFC·NBR(작품·Top10)
  - **국가 시상식 작품상(20+개국)**: César·Goya·David·청룡·대종·백상·일본아카데미·키네마준보·금마장·홍콩·중국금계·인도NFA·필름페어·이란심로그·아르헨실버콘도르·브라질Grande Otelo·Ariel·AACTA·캐나다CSA·러시아Nika/골든이글·독일·스웨덴·폴란드·덴마크Bodil/Robert
  - **정전**: S&S 2022(비평가+감독)·AFI100·BBC(21세기·외국어·여성감독)·NYT·TIME·Guardian·Cahiers100·**TSPDT 1000(완전)**·1001Movies(부분)·**NFR 925(완전)**·금마장100·키네마준보·이탈리아100·BFI100·KOFA·스페인Caimán·브라질Abraccine·독일·스웨덴 + 디케이드/21세기 폴(IndieWire·Cine21·멕시코Somos·호주·폴란드·루마니아 등)
- `seeds/films_master.csv` 확장: **6,733편**(중복제거 / 1890s~2020s, 정점 2010s 894편). 마스터가 title+year→tmdb 해소(홈그라운드).
- 방법: web_fetch 표 누락/한도(429)는 listchallenges·r.jina.ai reader 프록시·`?action=raw` 위키텍스트로 우회. 부분/무출처 목록은 정직하게 표기(추측 금지).
- **잔여(저가치·선택, 마스터 보강 가능)**: Criterion 컬렉션·MUBI 1000(커뮤니티)·Cahiers 연도별 Top10 / 영화제 섹션(경쟁부문 등 weight 0.30 선정) / 무출처(Caimán-21c·덴마크 올타임).
