# HANDOFF — Tier-2 공장 (카탈로그 라인) 구축 지시서

> **한 줄**: 기존 영화공장(이하 **Tier-1 공장**)의 축소 라인. 영화를 **현재 Tier-2 수준의 정보**
> (카탈로그 메타 + 객관 신호층)까지만 만들어 사이트에 넣는다. Strong Misreadings급 콘텐츠 생산
> (figures/takes/why-watch/watch-next/감독 프로필) **없음**. 목표: 편당 ~$0.01–0.03, 시간당 수백 편.
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

- **Tier-2 다이제스트는 공장 산출물이 아니다**: `/film/[slug]`의 Tier-2 다이제스트는 렌더타임
  규칙 프로즈(`app/film/[slug]/page.tsx`의 digestHonorLabel 등)로, **수상·개봉·평점 행만 있으면
  자동 조립**된다. 공장은 데이터 행만 채우면 된다.
- **색인 여부도 공장이 결정하지 않는다**: INDEX는 SEO 게이트(마이그 0097 — 강신호 any(수상/개봉/
  scholarship) + 가용성 + NOT tmdb-스텁; hold는 입력 아님)가 렌더타임에 판정. 공장의 역할은
  **게이트 통과 신호(S05/S06/S04)를 채우고, 리포트에 게이트 통과 여부를 표기**하는 것.

## §1 Tier-2 품질바 (산출물 계약 — 이 표가 S59 리포트가 되어야 함)

편당 완료 판정: `tmdb메타 ✓ · imdb ✓ · ratings ✓ · providers ✓ · release ≥1 · honors n(0 허용) ·
TakeScore ✓ · geo n(0 허용) · sentences n(0 허용) · IDX(0097 게이트 통과 여부, 정보성) · LIVE(HTTP 200)`.
**visible=false·is_analyzed=false 유지가 정상 상태다** (visible 트리거는 figures≥3에만 반응하고
Tier-2는 figures를 만들지 않으므로 자연 보장 — 절대 손대지 말 것).

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

### T3. S17 리셉션 — catalog 레인에 이미 있으나 스코핑 검증 필요
`magazine research agent/reception-run.py`가 `--limit 0`으로 전 대기열을 도는 구조다.
`--films` 스코핑을 추가하고 manifest 인자를 `["--films", "{slugs}"]`로 교체하라.
품질바에서는 **선택 항목**(현 커버리지 0.8% — Tier-2 계약에 사실상 없음). OpenAlex 429 함정
(메모리 참조: 백오프 필수) 건드리지 말 것.

### T4. S40 TakeScore catalog 검증
manifest상 이미 `full,catalog`. 파일럿에서 실제로 catalog 영화가 채점되는지만 검증.
⚠️ `compute_film_scores()`는 **전역 delete라 호출 금지**(메모리 불변식). 채점은 S40 워커 경로만.

### T5. Tier-2 품질바 리포트 — `worker/factory.py`
`run_quality_report()`와 `report_md()`는 현재 full 전용(figs/misr 중심)이다. **tier 분기** 추가:
- catalog 영화용 SELECT(§1의 칼럼): imdb_id·film_ratings·film_watch_providers·
  film_release_events(count)·film_wd_honors(count)·TakeScore 존재·film_locations(count)·
  film_sentences(count)·**IDX**(0097 게이트 술어를 그대로 복제 — 정의는
  `supabase/migrations/0097_*.sql`에서 복사, 절대 재발명하지 말 것)·LIVE.
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
   ⓒ `/film/<slug>` HTTP 200 + Tier-2 다이제스트 렌더 ⓓ visible=false·is_analyzed=false 유지
   ⓔ 정전급 1편은 IDX ✓, 무명작은 IDX ✗(noindex)가 **정상** ⓕ 편당 실측 비용 ≤$0.05
   ⓖ `factory.py lint` 클린 ⓗ Tier-1 파일럿 1편 회귀(기존 레인 무손상).
4. 실측 비용·시간을 이 문서와 RUN-PLAYBOOK에 기록.

### T8. 문서
`factory/RUN-PLAYBOOK.md`에 "Tier-2 라인" 섹션(투입 명령·품질바·비용), `factory/README.md`·
`HANDOFF-영화공장.md` §BUILD STATUS에 두-레인 체제 반영, 메모리 갱신.

## §3 비용·처리량 (실측 기반 추정)

| 항목 | Tier-1 공장 | **Tier-2 공장** |
|---|---|---|
| LLM 유료 스테이지 | S10/S11/S13/S14/S15/S16/S31-33/S40 | **S40(sonnet)·S19(haiku) 둘뿐** |
| 편당 비용(배치) | ~$1.0–2.0 | **~$0.01–0.03** |
| 편당 비용(실시간) | ~2× | ≤$0.05 |
| 1,000편 | $1,000–2,000 / 수일(배치 대기) | **$10–30 / 몇 시간** |
| 병목 | Anthropic 배치 큐 | 외부 API 레이트리밋(TMDB·Wikidata·OpenAlex) |

나머지 전부 무료 API(TMDB·Wikidata·OpenAlex·JustWatch-via-TMDB). 대량 투입 시 HTTP_FANOUT=6
유지, 단일런 락·하트비트는 기존 엔진 그대로 적용됨.

## §4 함정·금지 (기존 불변식 전부 유효)

- **visible/is_analyzed/hold를 공장에서 절대 조작하지 말 것** (S39는 full 전용으로 이미 격리).
  색인은 0097 게이트가, visible은 figures 트리거가 결정한다.
- `compute_film_scores()` 호출 금지(전역 delete). Mgmt API는 브라우저 UA. PostgREST 1000행 절단.
- 단일런 락: Tier-1 런과 Tier-2 런도 **동시 실행 금지**(같은 엔진·같은 락 — 2026-07-13 DB IO
  장애 교훈). 대량(>5편)은 배치 모드가 기본, 테스트는 `--sync`.
- 사이트맵/색인 대량 유입 주의: 신규 Tier-2는 기본 noindex(게이트 미통과)라 안전하지만,
  정전급 대량 투입 시 IDX 통과 편수가 리포트에 보이므로 오너가 페이스 판단.
- 리네임 금지(어드민 카피만 변경). 기존 Tier-1 레인 회귀 테스트 필수(T7-ⓗ).

## §5 승격 경로 (Tier-2 → Tier-1)

같은 영화를 나중에 `tier=full`로 재투입하면 된다: S02-resolve가 `exists`로 인식 →
Tier-1 전용 스테이지(S10~)만 실질 작업(카탈로그 데이터는 idempotent skip). 기존 hold 스텁
승격의 PROMOTE 패리티(figure 게이트에서 hold 해제+visible)는 이미 엔진에 있다(2026-07-13).
어드민에서는 "Tier-2 → Tier-1 승격 = 같은 목록을 Tier-1 라디오로 재제출"이라고 안내 문구 한 줄.

## §6 참고
- 정본: `HANDOFF-영화공장.md`(설계) · `factory/RUN-PLAYBOOK.md`(운영) ·
  `factory/EXECUTOR-CODING-NOTES.md`(실측 교훈: 실패패턴·병렬 스펙·sync 모드·락/하트비트)
- Tier-2 기존편 보강은 별도 작업지시서 `HANDOFF-Tier2-메인통합.md`(C1~C5)와 **신호 정의를 공유**
  한다 — 이 공장은 "신규 영화"용, 그 문서는 "기존 1,105 승격편" 백필용. 게이트·필드 정의가
  어긋나면 안 됨(둘 다 0097을 정본으로).
