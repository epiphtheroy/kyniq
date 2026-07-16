# HANDOFF — Tier-2 공장 (카탈로그 라인) 구축 지시서

> **한 줄**: 기존 영화공장(이하 **Tier-1 공장**)의 축소 라인. 영화를 **현재 Tier-2 수준의 정보**
> (카탈로그 메타 + 객관 신호층)까지만 만들어 사이트에 넣는다. Strong Misreadings급 콘텐츠 생산
> (figures/takes/why-watch/watch-next/감독 프로필) **없음**. 목표: 편당 ~$0.01–0.03, 시간당 수백 편.
>
> **개정 2026-07-15 (v2)**: Tier-2 메인 통합(C1~C5·D1~D6) SHIPPED + 문서 정합(5fae0fe) 반영 —
> 게이트 신호 정정(reception/lineage/wd_honors — 개봉은 본문 재료), 정본을 filmIndexBar로 교체,
> 스틸 C4 패리티·사이트맵 코호트 캡(INDEX_COHORT_FILMS_T2)·감독 404 정상 판정 추가.
>
> **대원칙 — 신축 금지, 포크 금지.** 이것은 새 코드베이스가 아니라 `worker/factory.py` +
> `factory/manifest.json`의 **`tier=catalog` 레인을 완성**하는 일이다. 엔진은 하나, 조립 라인이 둘.
> 실행·원장·락·리포트·어드민 전부 기존 공장 것을 그대로 쓴다.
> (참조: `HANDOFF-영화공장.md`, 운영 정본 `factory/RUN-PLAYBOOK.md`, 실측 교훈
> `factory/EXECUTOR-CODING-NOTES.md`)

## §0 왜 이미 절반이 있는가 (2026-07-15 실측)

- `factory/manifest.json`의 48개 스테이지 중 **21개가 이미 `"tier": ["full","catalog"]`** 로 선언되어
  있고, executor의 `stage_films()`는 intake의 tier 값으로 스테이지를 필터링한다(구현 완료·검증됨).
- intake 3경로(어드민 "Add films" 패널 / `factory.py ingest --tier` / CSV `tier` 칼럼) 모두
  **tier 값을 이미 받는다**. 어드민 `app/admin/factory/page.tsx`에 tier 셀렉터 존재(기본 full).
- 오너 확정(HANDOFF-영화공장 §16): ①`tier=auto` 금지(명시 지정만) ②**Tier-2도 TakeScore 채점**(S40).
- 현재 Tier-2 코퍼스 = **4,997편** (`coalesce(is_analyzed,false)=false`). 실측 커버리지:

| 데이터 | 보유 | 비율 | 생산 스테이지 |
|---|---|---|---|
| imdb_id / 평점(film_ratings) | 4,956 | 99% | S04-external |
| 시청 제공자(film_watch_providers) | 4,997 | 100% | S04-external |
| 개봉 이벤트(film_release_events) | 4,991 | ~100% | S05 |
| 수상(film_wd_honors) | 2,520 | 50% | S06 |
| TakeScore(채점) | (S40, 오너 확정) | — | S40 |
| 촬영지(film_locations) | 2,478 | 50% | S19-geo |
| 문장층(film_sentences, 무-테이크 패턴) | 4,735 | 95% | S28 |
| 리셉션(film_reception) | 38 | 0.8% | S17 (선택) |
| figures / takes / misreadings / why / next | 0 | 0% | **생산 안 함 (계약)** |

> **[반영 2026-07-16 — 필름페이지 보강 정합]** 위 산출 행들은 이제 필름 세부페이지의 **섹션 리드 입력**이다(렌더가 결정론 문장으로 조립, LLM-0). 두 정합 포인트: ⓐ **R-D 다이제스트 계약 확장** — Editor's digest의 "공장은 행만 채운다; 문장 조립은 렌더(LLM-0)" 분업이 #5/#6/#8/#9/#11/#13 전 섹션 리드로 확장된다. enrichment는 **신규 LLM 스테이지 0·신규 gate 신호 0** → `filmIndexBar`/`INDEX_COHORT_FILMS_T2`/`coupling-map.json` 무변경(색인/robots/사이트맵 불변). ⓑ **#11 촬영지 리드는 `film_locations.name`(주소급, 예 "Hanam, Gyeonggi Province")을 읽는다** — 이 name은 S19 정본 `geo-extract-search.py`(sonnet+Tavily)만 생산. 금지된 순수-haiku `geo-extract.py` 핀은 거친 lat/lon만 있고 주소급 name이 없어 geoCount>0이어도 **degraded/빈 리드** → re-geocode 후보로 표기. 정본: 루트 `HANDOFF-필름페이지-보강-작업지시서.md` §0.2·§3.5·§6.2.

- **⭐ 2026-07-15 Tier-2 메인 통합 SHIPPED** (`HANDOFF-Tier2-메인통합.md`, commit 5e8f507):
  Tier-2 메인이 이제 공장 산출 행을 **본문에 직접 렌더**한다 — C1 수상 다이제스트(film_wd_honors),
  C2 개봉 연혁 다이제스트(film_release_events), C3 scholarship(film_reception, 전부 academic —
  "critics said" 카피 금지·scholarship 프레이밍), C4 스틸 패리티(media **≥5장 권장**), C5 ReadPlates.
  다이제스트 계약 R-D(부분집합+다른 문장형+전문 링크) 준수는 렌더 쪽 책임 — 공장은 행만 채운다.
  **킨드레드/TV는 Tier-2 계약상 불가**(affinities 0행이 정상 — t2Sections 셸이 대체)이고, 영상
  iframe은 GSC watch-page 플래그 때문에 절대 금지 — S25/S42가 full 전용인 현 배선과 정확히 일치.
- **색인 여부는 공장이 결정하지 않는다. 정본 게이트 = `lib/seo.ts filmIndexBar`(코드 SSOT)**:
  Tier-2는 `(n_reception≥3 OR n_lineage≥3 OR n_wd_honors≥3) AND n_providers≥1 AND NOT slug like
  'tmdb-%'`. 원신호는 `film_index_signals_json()` RPC(마이그 0097). **hold은 게이트 입력이 아니다**
  (hold=공장의 "미승격 스텁" 플래그 — catalog 인테이크가 hold=true 스텁을 만드는 것이 정상).
  주의: **개봉(S05)은 게이트 신호가 아니라 본문 재료**다. 게이트 신호 중 공장이 채울 수 있는 것은
  wd_honors(S06)·reception(S17)·providers(S04)이며, **lineage(정전 리스트 멤버십)는 공장 스테이지가
  없다**(별도 큐레이션 계열 — 신작은 주로 honors/reception으로 게이트를 넘는다고 리포트에 전제).

## §1 Tier-2 품질바 (산출물 계약 — 이 표가 S59 리포트가 되어야 함)

편당 완료 판정: `tmdb메타 ✓ · imdb ✓ · ratings ✓ · providers ✓ · release ≥1 · honors n(0 허용) ·
media n(스틸 — C4 패리티상 ≥5 권장, 0 허용) · TakeScore ✓ · geo n(0 허용) · sentences n(0 허용) ·
IDX(filmIndexBar 통과 여부, 정보성) · LIVE(HTTP 200)`.
**visible=false·is_analyzed=false 유지가 정상 상태다** (visible 트리거는 figures≥3에만 반응하고
Tier-2는 figures를 만들지 않으므로 자연 보장 — 절대 손대지 말 것).

> **[반영 2026-07-16 — 필름페이지 보강 정합]** 위 "0 허용" 필드(honors·geo·sentences)는 이제 단순 정보성 칼럼이 아니라 **필름 세부페이지 섹션 리드의 render-critical 입력**이다 — #8 Lineage 리드(honors/lineage)·#11 Locations 리드(`film_locations.name` 주소급)·#10 Fantasia 리드(sentences). 부재 시 리드는 **자기부정 문장이 아니라 섹션 부재**로 강등(원칙 C = 이 품질바의 정직성과 정합, 결함 아님). **T5/S59 품질바 리포트에 "enrichment-lead readiness" 지표 추가 권장**: 색인작별 ≥1 location name(S19)·≥1 honor/lineage(S06/큐레이션)·subscores(S40)·전지역 offers(S04) 보유 여부 → 완전 리드셋을 렌더하는 색인작 vs 희소 페이지 수를 오너가 관측. 정본: 루트 `HANDOFF-필름페이지-보강-작업지시서.md` §7.

## §2 빌드 작업 목록 (T1~T8, 순서대로)

### T1. S05·S06 언블록 — Tier-2의 핵심 신호이자 유일한 실질 블로커
`worker/release-events.py`·`worker/wd-honors.py`는 현재 코호트가 `--all`(tmdb/imdb 보유 전체) 또는
기본(visible만)이라 **신규 W0 영화(아직 visible 아님)를 스코프할 수 없어** manifest에서
`blocked_by: worker-scoping-patch`로 막혀 있다.
- 두 스크립트에 `--films slug1,slug2` 지원 추가. 기존 §7.13 패턴 그대로(참조 구현:
  `worker/asset-gen.py` 상단 `FILMS_ARG` + todo 필터 한 줄):
  `FILMS_ARG = (args[args.index("--films")+1].split(",")) if "--films" in args else None`
  → 코호트 질의 결과를 `slug in FILMS_ARG`로 필터. `--films`가 있으면 visible 조건 무시.
- manifest 수정: 두 스테이지 runner를 `"submit_args": ["--films", "{slugs}"]`로, 
  `needs_scoping_patch`·`blocked_by` 제거, `"scoped_by_eligibility": true` 추가(린트 Ω43).
  notes에 언블록 날짜 기록. `python3 worker/factory.py lint` 통과 확인.
- verify_sql: S05는 `exists(film_release_events)`, S06은 **null**(수상 없는 영화가 정상이므로).
- ⚠️ wd-honors는 Wikidata SPARQL — UA 필수·레이트리밋 유의. release-events는 TMDB.

### T2. S28 문장층을 catalog 레인에 편입
실측상 Tier-2의 95%가 이미 무-테이크 패턴(D_award/E_rank/J_location 등) 문장을 갖고 있다
(코퍼스 전역 실행의 부산물). 공장이 신규 Tier-2에도 같은 수준을 보장하도록:
- manifest S28 `"tier": ["full"]` → `["full", "catalog"]`.
- S28 `verify_sql`을 **null**로 (무명작은 패턴 0개가 정상 — exists 검증은 catalog에서 오탐.
  개수는 S59 품질바가 정보성으로 보고).
- 근거: 패턴 SQL(`factory/sql/sentence_patterns.sql`)은 있는 데이터만으로 생성되고
  ON CONFLICT DO NOTHING이라 부분 데이터에 안전. takes 필요 패턴(A/B/C/G/H/I/L/M/N)은
  자연히 0행 → 무해.

> **[반영 2026-07-16 — #10 Fantasia 리드 전방 의존]** 필름페이지 보강 #10(Embedding Fantasia 리드)과 #11 시티급 지명 리드는 **S28 문장층에 의존**하는데, S28은 라이브 `factory/manifest.json`에서 아직 `tier=["full"]`만이다(위 T2의 `["full","catalog"]` 편입은 문서화된 TODO·미SHIP). 기존 Tier-2 ~95%는 코퍼스 전역 실행의 부산물로 문장을 갖지만, **신규 Tier-2 카탈로그 인제스트는 T2가 SHIP되기 전까지 빈 Fantasia 리드**를 렌더한다(원칙 C에 따라 섹션 부재). #10을 신규 카탈로그작에도 유지하려면 T2 우선.

### T3. S17 리셉션 — catalog 레인에 이미 있으나 스코핑 검증 필요
`magazine research agent/reception-run.py`가 `--limit 0`으로 전 대기열을 도는 구조다.
`--films` 스코핑을 추가하고 manifest 인자를 `["--films", "{slugs}"]`로 교체하라.
**지위 격상 주의**: reception≥3은 filmIndexBar의 강신호 중 하나이므로 S17은 단순 부가정보가
아니라 **게이트 신호 생산자**다(Tier-2 리셉션은 100% academic → 페이지에선 scholarship 프레이밍).
다만 무명작은 논문이 없어 커버리지가 낮은 게 정상 — 품질바에서는 여전히 정보성 칼럼(0 허용),
정전급 투입분의 IDX 통과를 실질적으로 좌우한다. OpenAlex 429 함정(백오프 필수) 건드리지 말 것.

### T4. S40 TakeScore catalog 검증
manifest상 이미 `full,catalog`. 파일럿에서 실제로 catalog 영화가 채점되는지만 검증.
⚠️ `compute_film_scores()`는 **전역 delete라 호출 금지**(메모리 불변식). 채점은 S40 워커 경로만.

### T5. Tier-2 품질바 리포트 — `worker/factory.py`
`run_quality_report()`와 `report_md()`는 현재 full 전용(figs/misr 중심)이다. **tier 분기** 추가:
- catalog 영화용 SELECT(§1의 칼럼): imdb_id·film_ratings·film_watch_providers·
  film_release_events(count)·film_wd_honors(count)·media(count)·TakeScore 존재·
  film_locations(count)·film_sentences(count)·**IDX**·LIVE.
- **IDX 칼럼은 술어를 재발명하지 말 것**: `film_index_signals_json()` RPC(0097)로 원신호를 받아
  `lib/seo.ts filmIndexBar`의 술어(§0에 인용)를 그대로 미러. filmIndexBar가 바뀌면 이 칼럼도
  같이 바뀌어야 하므로 factory.py 주석에 "SSOT=lib/seo.ts filmIndexBar" 명기 +
  `factory/coupling-map.json`에 lib/seo.ts 추가(Sentinel이 드리프트 감지).
- report_md: 런에 두 tier가 섞이면 표 2개. incomplete 판정도 tier별 계약으로
  (catalog 완료 = imdb·ratings·providers·release·TS·LIVE; honors/geo/sent/recep/IDX는 정보성).
- `factory_matrix_json`/`factory_gaps_json`(어드민 관측)이 catalog 계약을 이해하도록 확장
  (gaps가 "figures 없음"을 Tier-2 결함으로 오탐하지 않게).

### T6. 어드민 — `/admin/factory` 두-레인 리브랜딩
`app/admin/factory/page.tsx`:
- 헤더/카피: "The Film Factory" 아래 두 라인 명시 — **"Tier-1 공장 (full): 전 공정, 미스리딩까지,
  ~$1.5–2/편"** / **"Tier-2 공장 (catalog): 카탈로그+신호층만, ~$0.01–0.03/편"**.
- "⓪ Add films" 패널의 tier `<select>`를 **두 개의 명시 라디오 버튼**으로 교체(기본 선택 없음
  → 미선택 시 제출 불가: 오너의 "auto 금지·명시 지정만" 결정을 UI로 강제).
- 런 목록·인테이크 표에 tier 뱃지(full=보라, catalog=회색 등). 런 리포트는 report_md 그대로 렌더.
- **이름은 UI·문서 수준에서만** "Tier-1 공장/Tier-2 공장". manifest 스테이지 id·스키마·함수명은
  절대 리네임 금지(additive-only 원칙 — 리네임은 커플링 파괴 클래스).
- `factory/coupling-map.json`에 release-events.py·wd-honors.py 추가(Sentinel 감시).

### T7. 파일럿 (수용 기준)
1. 실존하되 코퍼스에 없는 영화 3편을 `tier=catalog`로 어드민 패널에서 투입 (1편은 tmdb id 명기,
   1편은 제목만, 1편은 수상 이력 있는 정전급 — IDX 게이트 통과 확인용).
2. `python3 worker/factory.py plan --write` → `run --run N --sync --yes` (**테스트는 실시간** —
   오너 규칙; ≤5편이면 자동 실시간).
3. 판정: ⓐ S10~S16·S30~·S39가 리포트에 아예 안 나타남(스킵) ⓑ §1 품질바 전 칼럼 채움
   ⓒ `/film/<slug>` HTTP 200 + **새 레이아웃 본문 렌더 확인: C1 수상 다이제스트·C2 개봉 연혁·
   C4 스틸(media ≥5장이면)·킨드레드/TV 부재가 정상** ⓓ visible=false·is_analyzed=false·hold=true 유지
   ⓔ 정전급 1편은 IDX ✓, 무명작은 IDX ✗(noindex)가 **정상** ⓕ 신규 감독이 생겼다면 그 감독
   허브가 404 또는 noindex인 것이 **정상**(Tier-2 전용 감독은 페이지 없음 — directorGate)
   ⓖ 편당 실측 비용 ≤$0.05 ⓗ `factory.py lint` 클린 ⓘ Tier-1 파일럿 1편 회귀(기존 레인 무손상).
4. 실측 비용·시간을 이 문서와 RUN-PLAYBOOK에 기록.

### T8. 문서
`factory/RUN-PLAYBOOK.md`에 "Tier-2 라인" 섹션(투입 명령·품질바·비용), `factory/README.md`·
`HANDOFF-영화공장.md` §BUILD STATUS에 두-레인 체제 반영, 메모리 갱신.

## §3 비용·처리량 (실측 기반 추정)

| 항목 | Tier-1 공장 | **Tier-2 공장** |
|---|---|---|
| LLM 유료 스테이지 | S10/S11/S13/S14/S15/S16/S31-33/S40/S19 | **S40(sonnet)·S19(sonnet+Tavily 검색) 둘뿐** |
| 편당 비용(배치) | ~$1.0–2.0 | **~$0.04–0.06** |
| 편당 비용(실시간) | ~2× | ≤$0.10 |
| 1,000편 | $1,000–2,000 / 수일(배치 대기) | **$40–60 / 몇 시간** |
| 병목 | Anthropic 배치 큐 | 외부 API 레이트리밋(TMDB·Wikidata·OpenAlex·Tavily) |

**⚠️ S19 촬영지 모델 (오너 지시 2026-07-15)**: 순수 haiku `geo-extract.py`(기억만·거친 핀 3~4개)는
저품질로 **공장 사용 금지**. 정본 = `geo-extract-search.py`(sonnet-4-6 + Tavily 다중출처 검색,
최소 2출처, 보호DB 격리, 주소급 name → geo-code 정밀 핀). manifest S19에 반영됨(2026-07-15).
TAVILY_API_KEY 필요. 비용 상승(편당 ~$0.04)은 품질 계약의 대가 — 다운그레이드 금지.

> **[반영 2026-07-16 — /methodology 프로비넌스 싱크]** 필름페이지 보강 #7(내부 모델명 `sonnet-n1`/`{data.panel}` 표면 누수 제거)·#10은 소비자 표면에서 모델/패널명을 걷어내고 **모든 모델·패널 공개를 `/methodology`로 라우팅**한다. 따라서 `/methodology`는 이 매니페스트의 실제 스테이지 모델을 **정확히 미러**해야 한다 — S40 TakeScore=`cinecodex_score.py`(sonnet, Haiku 금지), S19 촬영지=`geo-extract-search.py`(sonnet-4-6 + Tavily 다중출처), S28 Fantasia 문장=LLM-0/결정론. ⚠️ #10 미묘점: Fantasia 면책 "SQL-assembled, not AI-written"은 S28 문장 **조립**엔 참이나 그 **입력인 위치(S19)는 sonnet 추출**이다 → /methodology는 위치가 순수 결정론이라고 주장하지 말고 정확히 서술.

## §3b 그래프 파급 (신작이 기존 영화·감독에 미치는 영향 — 배선 현황)

| 파급 | Tier-1 레인 | Tier-2 레인 |
|---|---|---|
| 기존 영화들의 movies-like/kindred에 신작 진입 | ✓ S25 전역 재계산 | **불가(설계)** — 킨드레드는 takes 임베딩 기반이라 Tier-2는 원천 배제(승격 1,105편도 0행). "Tier-2 kindred 원장 재구축"은 BACKLOG의 오너 결정 항목 |

| **크레딧 "몇 번째 협업" 집계**(필름페이지 보강 #12) | ✓ **render-time** (`lib/film-credits-data.ts`가 TMDB `/person/{id}/movie_credits`에서 idx/shared/careerFirst 계산, daily-cache `film-credits-page-2`) — 코퍼스에 credits/cast/crew 스테이지 **없음**(S03=media+directors만) | ✓ 동일. **TMDB-sourced라 Tier-2 코퍼스 credits 커버리지에 무의존**(얇은 행 과소계수 없음). 계획의 "신규 additive RPC(마이그)"는 (a) TMDB render-time 유지 시 **리던던트=0 공장작업**, (b) DB precompute 이탈 시 **신규 테이블+스테이지+전코퍼스 백필**. **오너 결정**. gate 신호 아님 → `coupling-map.json` 진입 금지 |
| 기존 영화들의 watch-next가 신작을 내부 링크로 | ✓ S27 백필 | ✓ **S27을 catalog에 편입(2026-07-15)** — 기존 영화의 tmdb-only 추천이 신규 Tier-2 영화를 가리키면 자동 연결 |
| 문장층 교차 언급(kinship) | ✓ S28 | 부분(무-테이크 패턴만) |
| 유사도 공간 편입(영화 임베딩·taste) | ✓ S20/S21/S23 | 불가(takes 없음) |
| 감독 유사도 공간에 신규 감독 편입 | ✓ S35 임베딩 리프레시 | 해당 없음(감독 아티팩트 생산 안 함) |
| **기존 감독들의 큐레이션 산출물(where-to-start·next) 재계산** | **✗ 설계상 미포함** — LLM 저술물이라 신작 유입마다 재생성하지 않고 분기별 garden pass 몫(오너 결정 ③) | ✗ 동일 |

나머지 전부 무료 API(TMDB·Wikidata·OpenAlex·JustWatch-via-TMDB). 대량 투입 시 HTTP_FANOUT=6
유지, 단일런 락·하트비트는 기존 엔진 그대로 적용됨.

## §4 함정·금지 (기존 불변식 전부 유효)

- **visible/is_analyzed/hold를 공장에서 절대 조작하지 말 것** (S39는 full 전용으로 이미 격리).
  색인은 0097 게이트가, visible은 figures 트리거가 결정한다.
- `compute_film_scores()` 호출 금지(전역 delete). Mgmt API는 브라우저 UA. PostgREST 1000행 절단.
- 단일런 락: Tier-1 런과 Tier-2 런도 **동시 실행 금지**(같은 엔진·같은 락 — 2026-07-13 DB IO
  장애 교훈). 대량(>5편)은 배치 모드가 기본, 테스트는 `--sync`.
- 사이트맵/색인 대량 유입 주의: 신규 Tier-2는 대부분 noindex(게이트 미통과)라 안전. IDX 통과분도
  **사이트맵 코호트 캡이 페이스를 통제한다** — `lib/seo.ts INDEX_COHORT_FILMS_T2`(현재 300/1,105,
  주간 GSC-증거 룰로만 상향). 즉 "생산량 ≠ 광고량": 1,000편을 하루에 만들어도 색인 광고는 코호트
  룰대로 나간다. 공장이 이 캡을 만지는 것은 금지(오너+GSC 증거 전용 레버).
- 리네임 금지(어드민 카피만 변경). 기존 Tier-1 레인 회귀 테스트 필수(T7-ⓗ).

## §5 승격 경로 (Tier-2 → Tier-1)

같은 영화를 나중에 `tier=full`로 재투입하면 된다: S02-resolve가 `exists`로 인식 →
Tier-1 전용 스테이지(S10~)만 실질 작업(카탈로그 데이터는 idempotent skip). 기존 hold 스텁
승격의 PROMOTE 패리티(figure 게이트에서 hold 해제+visible)는 이미 엔진에 있다(2026-07-13).
어드민에서는 "Tier-2 → Tier-1 승격 = 같은 목록을 Tier-1 라디오로 재제출"이라고 안내 문구 한 줄.

## §6 참고
- 정본: `HANDOFF-영화공장.md`(설계) · `factory/RUN-PLAYBOOK.md`(운영) ·
  `factory/EXECUTOR-CODING-NOTES.md`(실측 교훈: 실패패턴·병렬 스펙·sync 모드·락/하트비트)
- **레이아웃·게이트 계약 정본**: `HANDOFF-Tier2-메인통합.md`(✅ SHIPPED 2026-07-15, 5e8f507 —
  Tier-2 메인·감독 허브가 무엇을 렌더하는지) + `lib/seo.ts filmIndexBar`(색인 술어 SSOT) +
  `docs/REMEMBER-thin-content-gate.md`(게이트 역사·hold 시맨틱). 이 공장은 "신규 영화"용이고
  그 배포는 "기존 승격편" 통합이었다 — 공장이 채우는 필드가 곧 그 레이아웃의 입력이므로
  필드 정의가 어긋나면 안 된다.
