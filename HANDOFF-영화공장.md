# HANDOFF — 영화공장 (The Film Factory) · 영화 임포터 시스템 설계·작업지시서

**정본.** 작성 2026-07-12 (Claude Fable 5). 근거: 9-에이전트 저장소 전수조사(`docs/factory-census/A~I.md`) + **5-비판 에이전트 적대 검증 라운드 통과**(사실검증×2·커버리지·실행가능성·불변식 — 블로커 5건 포함 30여 건 반영: is_analyzed 세터 부재→S39 신설, 워커 스코핑 부재→§7.13, 질문층→S18-qa, 트리거 라이브 덤프→§4 등).
**목적:** 원우가 영화를 **건당 또는 벌크로** 추가하면, 사람 개입 최소(목표: 0)로 그 영화가 metatake.net의 **모든 표면에 자연스럽게 녹아들도록** 하는 자동화 공장의 완전 설계.
**실행자:** 다른 AI가 이 문서만 보고 구현한다. 이 문서가 모호하면 문서를 고치는 것이 먼저다(§14 P0 참조).
**전제 독서(구현 전 필수):** `docs/RUNBOOK-new-film-ingestion.md`(18단계 정본) · `docs/factory-census/` 9편(본 설계의 사실 근거) · `HANDOFF-연결엔진-커넥션.md` · `docs/00-INDEX.md`.

---

## §BUILD STATUS — 2026-07-12 (P0~P4 골격 + **파일럿 3편 실제 라이브 완주** + Fantasia/Locations 엔진화)

> **⭐ 운영 정본(실행용) = `factory/RUN-PLAYBOOK.md`** — 검증된 end-to-end 명령 시퀀스. 원우가 아무 클로드
> 터미널에서 영화목록 붙이고 "run the film factory per factory/RUN-PLAYBOOK.md" → 같은 퀄리티 재현.
> 이 문서는 설계 정본, README는 요약, PLAYBOOK은 실행 정본.
>
> **파일럿 검증(2026-07-12):** Renoir·Left-Handed Girl·My Father's Shadow(전부 코퍼스 부재 2025작) →
> 무에서 라이브 Tier-1 색인 페이지. 편당 figures 8~9·미스리딩 12~13·이론가연결·트로프·24 movies-like·
> **Fantasia 90~130문장**·locations(Tokyo/Taipei/Lagos)·watch-next·why-watch·TakeScore·to.W·감독포트레이트.
> 실비 ~$1.6. egress(Anthropic/OpenAI/TMDB) 이 터미널서 도달가능(당초 차단 가정 오류)·Mgmt API 브라우저 UA 필수.
> **검증 중 엔진에 추가로 메꾼 것**: Fantasia 13패턴 생성 SQL 재구성(`factory/sql/sentence_*.sql`, 레포에 없던 것)·
> geo S19 스코핑 수정(env→--films)·theorist_id 해소·to.W 규칙조립·asset/next/profile emit §7.13 패치.
> **남은 엔진 갭(PLAYBOOK에 우회법)**: 하드코딩 로더 파일스왑·boldtake preflight RPC우회·factory.py run 실행루프 미코딩.

> 아래가 초기 골격 실제 상태. 운영 카드는 `factory/README.md`.

**✅ 구축·라이브 적용·검증 완료:**
- **DB(라이브 적용):** 마이그레이션 `supabase/migrations/0081_factory_schema.sql`(factory 스키마 runs·intake·stage_runs·change_orders + visible 트리거 VCS 캡처 + 헬퍼 RPC `refresh_film_taste_vector`/`refresh_director_embeddings` + admin 래퍼 6종) · `0082_factory_stage_helpers.sql`(스테이지 실행 함수 6종 — **블로커 해소 `factory_analyzed_flip`**·`factory_next_target_backfill`·`factory_detect_new_directors`·`factory_run_audit`·`factory_bump_lastmod`·`factory_assert_figure_slugs`). **둘 다 라이브 DB에 적용됨.** `factory_gaps_json`이 실제 결손 검출 검증(unscored 274·held 4,760 등).
- **오케스트레이터:** `worker/factory.py`(add/enqueue/plan/review/run/status/verify/gaps/garden-queue/lint — 제어평면 완성, Management API 헬퍼). **`lint` = 47 스테이지 구조오류 0 통과.**
- **매니페스트:** `factory/manifest.json`(47 스테이지, 전 필드·verify_sql은 실제 컬럼명, pricing 맵, 템플릿 변수). lint 통과.
- **워커 스코핑 패치(§7.13) 2종 적용·구문검증:** `film-extract-batch.py`(--films → $1,500 오발사 방지)·`bold-take-gen.py`(emit 모드 --films 우선). 하위호환(플래그 부재 시 무변화).
- **신설 리프(전량 저작·구문/JSON/bash 검증):** `factory/sql/assertions.sql`(0082 미러)·`factory/sql/curation_new_films.sql`(안전부분)·`worker/sentence-refresh.py`·`worker/tv-build-playlists.py`(시그니처 확인)·`worker/factory-sentinel.py`+`factory/coupling-map.json`+`factory-sentinel.sh`(드라이런서 CO 발행 확인)·`app/admin/factory/page.tsx`(+layout NAV)·런처 5종(run-factory-*.command·factory-watch.sh·restart-watchers.command).
- **파일럿 스테이징(라이브):** run #1 + intake 3편(Renoir·Left-Handed Girl·My Father's Shadow, 전부 코퍼스 부재 확인) + R1 프로브(The Return). 상세 `factory/logs/run-1.md`.

**🔎 중대 발견:** 코퍼스 6,975편이 **2024년까지+2025년 상당수 사실상 완비**. 공장의 실제 임무 = 2025+ 신작·심층 희귀작의 **소량 유입**(벌크 아님). 파일럿 후보 대부분이 이미 존재했다.

**⏳ 남은 것(실행자/원우):**
1. **파일럿 실행(원우 Mac):** `python3 worker/factory.py run --run 1 --yes` — 샌드박스는 Anthropic 송신 차단이라 여기서 실행 불가. LLM 배치 ~$5.6 + 신규 3편 라이브 공개. `factory/README.md` 순서대로.
2. **잔여 §7.13 스코핑 패치 4종:** asset-gen·next-gen(emit `--films` 존중+`--out factory-run-{id}`)·catalog-map-run/char(unmapped-only 반조인)·release-events/wd-honors(`--films` 또는 `--all`). 정확한 패치 위치는 census F에 있음. 이것 없이 벌크 run 시 매니페스트 lint가 막음(needs_scoping_patch 유지 스테이지).
3. **정본 SQL 추출 의존(안전한 no-op 상태):** 문장층 13패턴+stats SQL(`factory/sql/sentence_*.sql` — MASS-PRODUCTION 세션에서 추출 필요)·to.W 편지 조립기(curation.rule+투두블유 규칙 포팅). 둘 다 없으면 해당 스테이지는 문서화된 무동작(부재=우아 강등, 손상 아님).
4. **factory.py `run` 실행체 완성:** 제어평면은 완성, `run`의 스테이지 실행 루프(배치 submit/poll/fetch 오케스트레이션)는 Mac에서 워커 구동 — §6 알고리즘대로 실행자가 채운다.
5. **비-app 파일 커밋(원우):** `/admin/factory`는 이미 라이브 배포됨(워처가 자동 커밋·Vercel READY, commit 46bd2b0). 하지만 `worker/factory*.py`·`worker/sentence-refresh.py`·`worker/tv-build-playlists.py`·`factory/`·`supabase/migrations/0081·0082`·`HANDOFF-영화공장.md`·`docs/factory-census/`·워커 패치 2종은 **워처 범위 밖(수동 커밋 필요)** — 샌드박스는 git push 차단이라 원우가 커밋. (빌드 중 `.autodeploy-off`로 잠깐 정지했으나 워처가 스스로 지우고 재개함 — 현재 자동배포 ON.)
6. Sentinel/factory 워처 nohup 기동(원우 Mac; `restart-watchers.command`).
7. ⚠️ 무관 참고: 10:10 직전 두 배포(09:37·09:40)가 ERROR였음(공장 admin 페이지 커밋 이전 — 기존 미커밋 admin 편집/타 작업). 10:10 READY가 덮어써 사이트 정상. 원인 한번 확인 권장.

---

## §0. 문서 사명과 실행자 지침

1. **이 문서는 "설계도+작업지시서"다.** 코드는 없다. 모든 스크립트/SQL/스키마는 명세 수준으로 적혀 있고, 빌더 AI가 작성한다.
2. **`VERIFY:` 표시**가 붙은 항목은 조사 시점에 라이브 DB/외부 상태를 확정하지 못한 것이다. 빌더는 구현 전에 반드시 해당 항목을 검증하고 이 문서를 갱신한다(§17.4에 전체 목록).
3. **이 문서 자체가 공장의 일부다.** §11의 Sentinel이 사이트 변경을 감지하면 이 문서와 `factory/manifest.json`을 함께 갱신한다. 문서와 매니페스트가 어긋나면 매니페스트가 우선한다(매니페스트=기계 정본, 이 문서=사람 정본).
4. **저장소 문화 준수:** Python은 stdlib-only(pip 금지 — 예외는 `Outputs/figure_seo`뿐), 워커는 DRY-default + `--persist`/`--apply`, 더블클릭 런처는 `run-*.command`, 배포는 `deploy-*.command` 또는 자동 워처. env는 루트 `.env.local` 단일 소스.
5. **레거시 경계:** 루트 `AGENTS.md`/`SPEC.md`는 은퇴한 FilmCurio 모델의 문서다 — 따르지 말 것(정신적 유산만 유효: generate→verify→publish, HOLD-when-uncertain, no sockpuppets, content_events 감사로그). `meta_takes.kind='reading'`, `takes.meta_take_id`, `/admin/pipeline`의 `jobs`/`pipeline_config`는 전부 레거시 — 새 공장을 그 위에 짓지 않는다.

---

## §1. 현재 상태 진단 — 왜 공장인가

### 1.1 이미 있는 것 (공장의 부품)
- **파이프라인 정본** `docs/RUNBOOK-new-film-ingestion.md`: 18단계, per-film vs corpus-wide 2계급 원칙, §4 필수 백필, §5 순서 위험, §6 자동화 계획(A~E), §7 검증 체크리스트. 단 **2026-06-24 기준**이라 이후 출시층이 빠져 있다(아래 1.3).
- **워커 ~110종**(`worker/*.py`) + `run-*.command` 런처 + Batch API 패턴(submit/fetch, resume via `.batchids.txt`). 전수 목록: `docs/factory-census/F-workers.md`.
- **부분 오케스트레이터**: `worker/run-pipeline-auto.command`(P3 embed→P4 consolidate→P5 author/rank/recommend), `worker/run-pipeline-finish.command`(⚠️ P6b `trope-build --reset` 포함 — 공장에서는 **사용 금지**, §9).
- **additive 선례**: `worker/trope-incremental.py`(+RPC `trope_match_takes`, cosine≥0.72) — "기존 엔티티를 절대 리네임/재링크하지 않는" 증분 모드의 완성 예. 공장의 모든 corpus 단계가 이 원칙을 따른다.
- **운영 문서=실행 절차 패턴**: `GEO_운영-신규영화-증분처리.md` — 비용 게이트($50)·체크포인트·검증 필수·장부 한 줄 기록. 공장 전체가 이 패턴의 일반화다.
- **자율 루프 선례**: `hourly/now-playing-watch.sh`(nohup 루프+PID+HOLD 킬스위치), Bot Sentinel(Vercel cron 편승), `hourly/ledger.md`(append-only 장부), `curation` phase0(DB-컬럼-as-원장).

### 1.2 없는 것 (공장이 만드는 것)
- `ingest-new.command <titles.csv>` 단일 래퍼(BACKLOG §A 🔴) — **공장 오케스트레이터가 이것이다.**
- 영화×단계 상태 원장(무엇이 어디까지 됐는지 기계가 아는 곳).
- 스테이지 레지스트리(기계가 읽는 공정 정의) — 현재는 사람 기억+문서 산재.
- 퍼블리케이션 자동화(IndexNow·revalidate·frozen JSON 재빌드·entities 동기화 — 전부 수동).
- **사이트 변경 → 공장 설계 자동 갱신 루프(Sentinel)** — 본 설계의 §11.
- <3 figure 경보, resolve 저신뢰 리뷰 큐, 신규 감독 자동 트리거, `films.visible` 트리거의 VCS 캡처.

### 1.3 RUNBOOK 이후 출시되어 공장이 흡수해야 할 층 (2026-06-24 → 07-12 델타)
TakeScore/cinecodex 채점(유료 LLM) · to.W 큐레이션 코멘트(`curation` 스키마, LLM-0) · 문장층 13패턴+`film_kinship`(Stage 18, LLM-0 SQL) · 리셉션 애프터라이프 4소스(`film_reception`+`film_release_events`+`film_wd_honors`) · 미스리딩 기사층(적격성 `misreadingsEligibleSlugs()`) · TV층(`tv_compile_film`+전략 플레이리스트 5,559) · 커넥션 엔진 재건(`film_affinities` RRF+counterpoints) · Screener(`film_provider_index`+`fpi_rebuild()`) · 통합검색 v7(`search_aliases` 한글) · 인텐트 Q&A(렌더타임 LLM-0, per-film 의무 없음) · Tier-2 개방(Editor's digest) · i18n 마스터(**미구현** — 설계만) · 계보 읽는층 · Locations SEO 읽는층. 상세: `docs/factory-census/G-post-runbook.md`.

### 1.4 실행 환경의 진실 (설계를 구속하는 물리 법칙)
- **샌드박스는 Anthropic API·git push 불가** → LLM 워커·배포는 Mac 직접 실행(`.command` 문화의 이유).
- **launchd/cron은 ~/Documents TCC 차단** → 자율 루프는 전부 "Terminal에서 nohup한 while 루프"(재부팅 시 수동 재기동). Vercel cron은 서버측 30분 주기 1개(`/api/metrics/insights`) 존재 — 편승 가능.
- env 단일 소스: 루트 `.env.local`(키 목록: `docs/factory-census/I-admin-ledgers.md` §5). SQL 실행 탈출구: `worker/apply-sql.py`(Management API, `SUPABASE_ACCESS_TOKEN`=sbp_).
- 자동배포 워처는 `app/ components/ lib/`만 스테이징. `middleware.ts`·`public/`·`worker/`·`supabase/`·문서는 수동 커밋.
- node는 `~/.local/node/bin`(PATH 밖). PostgREST 응답은 전부 1,000행 캡(RPC 포함) — 벌크 읽기는 jsonb_agg 단일행 RPC.

---

## §2. 표면 인구조사 — 영화 1편이 닿는 모든 것

공장의 존재 이유: 아래 매트릭스의 모든 행을 **누락 없이, 올바른 순서로, 게이트를 통과시키며** 채우는 것. (전체 상세: census B·C·D. 여기는 공장 관점 요약.)

### 2.1 영화 자신의 페이지 (직접 표면)
| 표면 | 핵심 데이터 | 게이트(누락 시) | 공급 스테이지(§5) |
|---|---|---|---|
| `/film/[slug]` Tier-1 풀 | films·figures·takes·media + 20여 소스 | figures≥3 && visible 아니면 noindex(렌더는 됨) | W0~W3 전부 |
| `/film/[slug]` Tier-2 digest | lineage·ratings·recby·geo·providers·film_scores | hasDigest=false면 About 폴백 | S03·S04·(lineage 자동) |
| `/film/[slug]/misreadings` | takes(비-invitation) | 0건→404, <5건 noindex | S10·S11 |
| `/film/[slug]/reception` | film_reception+wd_honors+release_events+lineage | 실질 0→404, <3 noindex | S05·S06·S17 |
| `/film/lineage/[slug]` | film_lineage | <3행→404 | (리스트 주도 자동, §5 S07 참고) |
| `/film/locations/[slug]` | film_locations(mergeCells) | <3셀→404 (사이트맵 SQL과 동기 필수) | S19 |
| `/film/[slug]/credits` | TMDB live+films.tmdb_id | crew<2 noindex | S03 |
| `/film/[slug]/figure/[fig]` | figures·takes | takes 0→리다이렉트, <3 noindex | S10·S11 |
| `/film/[slug]/[desk]` | essays(verified) | 없으면 404 — **Engine Room 동결 중, 공장 범위 밖** | (제외) |
| `/film/[slug]/q/[q]` | questions(published)+canonical_answers | 미발행→404; qa.xml 자식·df-curious 탭·서프라이즈 question 모드·tv 리치니스의 원천 | S18-qa(⏸ 정책) |
| `/film/[slug]/gallery` | TMDB images | 항상 noindex | S03 |
| `/movies-like/[slug]` | film_affinities+takescore_for_slugs | 0추천=얇은 페이지, <3 noindex | S25 |
| `/takescore/film/[slug]` | cinecodex_card+tow_comment | 미채점→**404** | S40·S41 |
| `/tv/[slug]` | tv_programs(published) | 미컴파일→404 | S42 |
| `/whereto/[slug]` | film_watch_providers+ratings+access_enrichment | providers 0이어도 렌더, 숨김영화 noindex | S04·(S53 옵션) |
| OG 이미지 전 라우트 | films.poster/backdrop_path | 없으면 ogFallback(자동 무결) | S03 |

### 2.2 집계 표면 (영화가 "참여"하는 곳)
| 표면 | 포함 규칙 | 성격 |
|---|---|---|
| `/director/[slug]`+8서브 | films.director_slug(visible) — 기존 감독은 전부 라이브 파생 | **신규 감독만** W2b 필요 |
| `/genre/[slug]` | films.genres[] (S03이 채움; 누락=genre "Other" 붕괴) | 자동 |
| `/trope/[slug]` | takes.trope_id (⚠️ meta_take_id 아님) | S22 후 자동·라이브 재랭킹 |
| `/concept·/theorist·/tradition` | takes.concept→concept_map / takes.theorist_id / canon 링크 | S11·S23 후 자동 |
| `/catalog/[seg]/[slug]` | figure_taxonomy | S14 후 자동 |
| `/lineage/[slug]`·`/movements` | film_lineage / curation.film_hub(tmdb_id 조인) | 리스트/큐레이션 주도 |
| `/credits/[person]` | TMDB live (인물 페이지는 라이브) — 단 색인·감독페이지 크루는 `lib/crew_index.json` **동결 파일** | S53 재빌드 필요 |
| `/strong-misreadings` | published take on approved figure of visible film | S10·S11 후 자동 |
| `/frame/[slug]`+frames.xml | 발행 질문의 primary `question_frames` 링크; `frame_rankings`는 **베이크**(신규=rank 999) | S18-qa 종속 — 질문 정책과 함께 결정; rank 재생성(`worker/frame-rank.py`)은 가든 큐 |
| 홈(`home_v2_bundle_v3` 등 3 RPC)·`/latest`·`/trending`·서프라이즈 20모드·`/network` ego·`/locations`·`/search`(lexical 즉시/semantic은 임베딩 후)·`/rag`·room 렌즈 | 전부 **읽기전용 파생 — 기반 테이블만 차면 자동** | 자동 |
| `/network` Galaxy | film_map_xy — **quarterly 가든 전용**, 신규 영화는 다음 가든까지 부재(의도) | 가든 |
| TV 플레이리스트 | tv_playlist_items **베이크** — 재빌드 필요 | S43 |
| 뉴스 비트게이트 | `hourly/poller/entities.json` **로컬 스냅샷** | S55 |

### 2.3 퍼블리케이션 표면
사이트맵 ~40 자식(각 게이트는 census H §1 표가 정본) · IndexNow(수동 스크립트만 존재) · ISR(온디맨드 생성, 적격성 캐시 최대 24h) · 동결 JSON 3종(`lib/atlas_cities.json`·`lib/crew_index.json`·`lib/access_enrichment.json`) · `films.last_processed_at`=sitemap lastmod 계약 · search_aliases(한글) · /ko(미구현).

---

## §3. 아키텍처 총괄

### 3.1 3평면 분리
```
[실행 평면]  Mac: worker/factory.py + 기존 워커들 + Batch API      (LLM·git push 가능)
[상태 평면]  Supabase `factory` 스키마: intake/runs/stage_runs/change_orders + 뷰
[관측 평면]  /admin/factory (읽기+리뷰 승인) · factory/logs/*.md (append 장부) · run 리포트
```
실행은 항상 Mac(오케스트레이터 CLI 또는 nohup 워처), 진실은 항상 DB, 사람은 admin 페이지나 Claude Code 대화로 개입한다. Vercel은 실행 평면이 아니다(로컬 파이썬을 못 부른다) — admin의 버튼은 DB에 "의사"만 기록하고 Mac 쪽 루프가 집행한다.

### 3.2 8대 설계 결정 (근거 포함)
| # | 결정 | 근거 |
|---|---|---|
| D1 | 원장 = **`factory` DB 스키마** (파일 아님) + 사람용 append 로그 `factory/logs/` | 재개가능성·admin 가시성·cinecodex/curation 격리 스키마 선례. hourly의 ledger.md 패턴은 사람용 미러로 병용 |
| D2 | 공정 정의 = **`factory/manifest.json`** (repo 파일, 버전관리) | Sentinel이 diff·수정 제안하는 대상. JSON=diff 깔끔·언어중립·stdlib 파싱. 주석은 `notes` 필드 |
| D3 | 오케스트레이터 = **`worker/factory.py`** stdlib-only 단일 CLI | 저장소 문화(순수 stdlib·DRY-default). 런처 `run-factory-*.command` |
| D4 | intake = **`factory.intake` 테이블 단일 진입점** (CSV drop·CLI·admin 전부 여기로 수렴) | 벌크/건당/자동 세 경로의 통일. 오케스트레이터는 테이블만 신뢰 |
| D5 | 배치 전략: 스테이지당 **전 영화 통합 1배치**(RUNBOOK §6E), **≤50편이면 sync 병렬**(메모리 룰) | 50% 할인 극대화 + 소량 배치 스톨(24h 만료 실사례) 회피 |
| D6 | corpus 단계는 **additive-safe만** 공장에 편입: null-only(embed)·increment(trope)·derived-swap(affinities/counterpoints/fpi)·ON CONFLICT(문장층). **리네임 계열은 전부 §9 가든으로 격리** | RUNBOOK §0 원칙. `run-pipeline-finish.command`의 `trope-build --reset` 관행을 공장이 **대체**한다 |
| D7 | Sentinel = 코드 드리프트(git diff×coupling map) + 데이터 드리프트(`factory.v_gaps`) + 스키마 드리프트 3중 프로브 → **체인지오더(CO) 발행 → headless Claude가 매니페스트 수정 제안 → 승인 정책에 따라 적용** | "사이트가 변하면 공장도 변한다"의 기계화. nohup 루프(TCC 제약) + 기존 감시 루프 선례 |
| D8 | 검증 = 매니페스트에 스테이지별 `verify_sql`/`probe_url` 내장, 오케스트레이터가 실행·기록 | "알림을 믿지 말고 디스크/DB를 믿어라"(메모리: 위조 알림 실사례) |

### 3.3 신규 영화의 표준 여정 (한 장 요약)
```
intake(CSV/CLI/admin) → W0 신원(resolve→TMDB→외부데이터) → [R1 저신뢰 리뷰]
 → 티어 분기: catalog(Tier-2)는 W0+S40(옵션)+W4로 직행 / full(Tier-1)은 계속
 → W1 콘텐츠(extract→boldtake→trope-tag→catalog→asset→next→reception→geo) [R2 비용 게이트]
 → W2 벡터·그래프(embed→taste→trope-incr→concept→affinities→counterpoints→backfill→문장층)
 → W2b 신규 감독이면(profile·picks·facts·photo·embedding)
 → W3 객관축(cinecodex 채점→curation→tv 컴파일→플레이리스트)
 → W4 퍼블리케이션(가시성 검증→lastmod→revalidate→동결JSON→aliases→entities→워밍→IndexNow→배포검증→리포트)
```

---

## §4. 원장 DB — `factory` 스키마 (마이그레이션 초안)

**빌더 지시:** 아래 SQL을 `supabase/migrations/00XX_factory_schema.sql`로 커밋 후 적용. ⚠️ **번호는 `supabase/migrations/`(현재 최대 0077)와 `worker/00*.sql`(0078~0080이 라이브 적용됨) 양쪽을 스캔해서 결정 — 현재 next free = 0081.** 새 DB 작업은 마이그레이션 커밋이 하우스 룰(0040 이후 관행). **같은 마이그레이션에 `films.visible` 트리거 캡처를 포함**한다(BACKLOG §B 🔴 해소). 검증 과정에서 라이브 정의를 이미 덤프했다:
> **`trg_films_refresh_visible`** = `AFTER INSERT OR DELETE OR UPDATE ON figures FOR EACH ROW` → `films.visible = (approved figures ≥ 3) AND NOT coalesce(films.hold, false)`.
> 함의 ①: 트리거는 **figures에만** 걸려 있다 — `films.hold`를 지워도 visible이 재계산되지 않는다(figure 행을 한 번 touch하거나 visible을 직접 세팅해야 함). 함의 ②: `worker/lineage-resolve.py`가 만드는 스텁은 `hold=true`라 figure가 아무리 쌓여도 영원히 안 열린다 — S50이 hold 해제를 담당(아래). 함의 ③: 로더는 figures를 `status='approved'`로 insert하므로 로드 시점에 즉시 발화한다.

```sql
-- 00XX_factory_schema.sql — Film Factory ledger (설계 초안; 빌더가 확정)
create schema if not exists factory;

-- 1) 진입점: 모든 신규 영화 의사는 여기로
create table factory.intake (
  id bigserial primary key,
  source text not null check (source in ('csv','cli','admin','sentinel','promotion')),
  raw_title text, year_hint int, director_hint text,
  tmdb_id int,                       -- 이미 알면 직행
  film_id uuid references public.films(id),
  tier text not null default 'full' check (tier in ('full','catalog','auto')),
  status text not null default 'queued'
    check (status in ('queued','resolving','review','approved','rejected','ingesting','done','failed')),
  confidence text,                   -- resolve 결과: high/medium/given/low/unmatched
  resolve_note text,                 -- 후보 목록 등 리뷰 근거
  run_id bigint references factory.runs(id),
  requested_by text, created_at timestamptz default now(), decided_at timestamptz
);
-- ⚠️ runs를 intake보다 먼저 생성(FK 순서) — 빌더가 테이블 순서 조정

-- 2) 런(벌크 1회 = 1런; 건당도 1런)
create table factory.runs (
  id bigserial primary key,
  mode text not null check (mode in ('single','bulk','backfill','sentinel')),
  film_count int, est_cost_usd numeric, actual_cost_usd numeric,
  status text not null default 'planning'
    check (status in ('planning','awaiting_review','running','paused','done','failed','aborted')),
  manifest_sha text not null,        -- 실행 시점 manifest.json의 sha256 (재현성)
  started_at timestamptz default now(), finished_at timestamptz, report_md text
);

-- 3) 스테이지 실행 원장 (영화×스테이지; corpus 스테이지는 film_id null = 런 단위 1행)
create table factory.stage_runs (
  id bigserial primary key,
  run_id bigint references factory.runs(id),
  film_id uuid references public.films(id),      -- null이면 corpus/publication 스테이지
  stage_id text not null,                        -- manifest의 stage id (예: 'S10-extract')
  status text not null default 'pending'
    check (status in ('pending','submitted','running','done','failed','skipped','parked')),
  attempt int not null default 1,
  batch_id text,                                 -- Anthropic msgbatch_… (있다면)
  cost_usd numeric, started_at timestamptz, finished_at timestamptz,
  error text, verify_result jsonb,               -- verify_sql/probe 결과
  -- ⚠️ 표현식은 테이블 UNIQUE 제약에 못 들어간다(문법 오류). PG15+이므로:
  unique nulls not distinct (run_id, film_id, stage_id, attempt)
);
create index on factory.stage_runs (run_id, stage_id, status);
create index on factory.stage_runs (film_id);

-- 4) 체인지오더 (Sentinel 산출물)
create table factory.change_orders (
  id bigserial primary key,
  kind text not null check (kind in ('code_drift','data_drift','schema_drift','new_surface','stage_broken','manual')),
  title text not null, evidence jsonb not null,   -- 커밋 해시·파일·gap 쿼리 결과
  affected_stages text[], proposal_md text,       -- headless 에이전트의 매니페스트 수정 제안
  risk text not null default 'review' check (risk in ('auto_ok','review','blocked')),
  status text not null default 'open' check (status in ('open','proposed','approved','applied','dismissed')),
  created_at timestamptz default now(), decided_at timestamptz
);

-- 5) 상태 매트릭스 뷰 (admin·CLI status의 소스; jsonb 단일행 = 1000행 캡 우회)
--    ⚠️ 아래 두 함수는 본문 미작성 초안 — 이대로 적용하면 파싱 에러로 마이그레이션 전체가
--    실패한다. P0에서 본문을 완성해 포함하거나, 임시 스텁 `as $$ select '{}'::jsonb $$` 사용.
create or replace function factory.film_matrix_json(p_limit int default 50)
returns jsonb language sql stable security definer set search_path = public, factory
as $$ select '{}'::jsonb /* P0: 최근 intake 영화 × 전 스테이지 status. 빌더 작성 */ $$;

-- 6) 갭 프로브: "기대 산출물이 없는 영화" (데이터 드리프트의 심장; §11.3)
create or replace function factory.gaps_json(p_days int default 30) returns jsonb
language sql stable security definer set search_path = public, factory
as $$ select '{}'::jsonb /* P0: 최근 N일 영화의 티어별 결손 집계. 빌더 작성 */ $$;
```

**원칙:** ① RLS: factory 스키마는 PostgREST 비노출(anon 정책 0). ② **I/O 채널을 명시한다:** admin 페이지 = public `security definer` 래퍼 RPC(읽기 `factory_matrix_json`/`factory_gaps_json`/`factory_change_orders_json` + **쓰기** `factory_intake_add`/`factory_intake_decide(id,action)`/`factory_co_decide(id,action)` — cinecodex_write_runs 선례); `factory.py` = Management API query 엔드포인트(apply-sql.py와 같은 채널)를 내장 헬퍼로 사용해 factory 스키마를 직접 읽고 쓴다(JSON 행 파싱 지원 — apply-sql.py 자체는 상태코드만 출력하므로 재사용 불가, §7.7). ③ 모든 anon-노출 함수는 함수레벨 `set statement_timeout`(8s). ④ 재실행은 `attempt+1`로 append(원장 불변). ⑤ 사람용 미러: 런 종료 시 `factory/logs/run-<id>.md`에 hourly 스타일 한 줄 요약 append.

---

## §5. 공정 매니페스트 — `factory/manifest.json`

### 5.1 스키마 (필드 정의)
```jsonc
{
  "manifest_version": 1,
  "stages": [{
    "id": "S10-extract",             // 불변 ID. 정렬은 wave+order
    "wave": "W1", "order": 10,
    "title": "Figures+Takes 추출",
    "class": "per_film | corpus | per_director | publication",
    "tier": ["full"],                 // 이 스테이지가 적용되는 티어
    "runner": {                       // 실행 방법 (type별 해석은 factory.py)
      "type": "worker | worker_batch | sql_file | rpc | shell | manual",
      "script": "worker/film-extract-batch.py",
      "submit_args": ["--submit"], "fetch_args": ["--fetch"],
      "per_film_arg": null            // per-film 타게팅 인자 (예: "--film {slug}")
    },
    "depends_on": ["S03-tmdb-fetch"],
    "writes": ["figures","takes"], "reads": ["films","media"],
    "external": ["anthropic_batch"],  // tmdb|omdb|wikidata|brave|google_geocode|youtube|openai_embed|anthropic_batch|anthropic_sync|gemini
    "cost": { "model": "claude-opus-4-8", "usd_per_film_est": 0.30, "max_usd": null, "measured": false },
    "batch_policy": { "combine_across_films": true, "sync_under": 50 },
    "idempotency": "skip_if_exists | null_only | on_conflict | derived_swap | append",
    "gates_unlocked": ["film page figures/misreadings", "visible trigger 진입"],
    "verify_sql": "select count(*)>=3 from figures where film_id='{film_id}' and status='approved'",
    "probe_url": null,                // 있으면 GET+cache-buster로 확인
    "failure_policy": "retry(2) | park | abort_run",
    "coupling": ["app/film/[slug]/page.tsx", "worker/film-extract-batch.py"],  // Sentinel용
    "notes": "boldtake보다 먼저. figures.slug null 백필 어서션은 S12"
  }],
  "pricing": { "claude-opus-4-8": {"in": 15, "out": 75, "batch_x": 0.5}, "claude-sonnet-4-6": {"in": 3, "out": 15, "batch_x": 0.5} }
}
```
**계약 3조:**
- **템플릿 변수 어휘(고정):** `{film_id}`·`{slug}`·`{tmdb_id}`(intake→films 조인에서)·`{slugs}`(런 대상 콤마 결합)·`{run_id}`. `verify_sql`은 **단일 SELECT가 boolean/int 1행**을 반환해야 하며, 실행 채널은 factory.py의 Management-API query 헬퍼다(§7.7).
- **매니페스트 린트(factory.py 내장, Sentinel 재사용):** 필수 필드·depends 사이클·runner 파일 실존 + **"per_film 스테이지는 스코프 불가능한 워커로 실행 금지"** — runner에 `per_film_arg`(또는 대상 한정이 적격성으로 보장됨을 명시한 `scoped_by_eligibility: true`)가 없으면 거부. §5.2의 🔧 표시 워커들이 스코핑 패치(§7.13)를 받기 전에는 해당 스테이지가 린트에서 막히는 것이 **의도된 동작**이다(무스코프 실행 = Tier-2 수천 편 오발사, 실측 위험 ~$1,500).
- **실비 계산:** 배치/응답의 usage 토큰 × pricing 맵(batch_x 반영) → `stage_runs.cost_usd` + `factory/logs/usage.jsonl` append(hourly 패턴).

### 5.2 스테이지 카탈로그 v1 (전체 초안 — 빌더는 이것을 manifest.json으로 옮긴다)

표기: 💰=유료 LLM, 🆓=무료 외부 API, 0️⃣=LLM-0, 🆕=신설 부품(§7에 명세), ⏸=보류/차단.

**W0 — 신원 (per-film, 티어 공통)**
| id | 내용 | runner | 비고 |
|---|---|---|---|
| S01-intake | intake 행 생성·정규화 | factory.py 내장 | CSV 컬럼: `title,year,director,tmdb_id?,tier?` |
| S02-resolve | 제목→tmdb_id, films upsert | `worker/tmdb-resolve.py --in {tmp.csv} --out {tmp.resolved.csv} --persist` 🆓 | **왕복 계약(빌더 준수):** ① factory.py가 intake를 resolve의 입력 CSV 컬럼(`Film_Title,Film_Director_Name,Film_TMDB_ID`)으로 변환해 `--in` 지정(⚠️ 기본 CSV는 과거 405편 리스트 — `--in` 생략 금지; ⚠️ year는 매칭에 미사용, 힌트일 뿐) ② `--persist`는 confidence∈(high,medium,given)만 upsert하고 low/unmatched는 **out-CSV에만** 남는다 ③ factory.py가 out-CSV의 confidence/status/note를 intake로 복사, upsert된 행은 `films?tmdb_id=in.(…)`으로 film_id 백필 ④ low/unmatched → `intake.status='review'` **R1 게이트**(오귀속=하류 전체 오염, auto-approve 금지) |
| S03-tmdb-fetch | 메타+미디어+감독 | `worker/tmdb-fetch.py --film {slug} --persist` 🆓 | **S10 전 필수**(genre Other 붕괴 방지). trailer→tv_eligible의 전제 |
| S04-external | imdb_id·ratings·providers·wikidata_id | `worker/external-data.py --persist` + `worker/wikidata-id.py` 🆓 | 후속 `select fpi_rebuild();`는 S44로 분리. (⚠️ 메모리의 `--shard`는 실존 안 함 — `--limit`/`--scope`뿐) |
| S05-release-events | `worker/release-events.py` 🔧 🆓 | film_release_events | ⚠️ **기본 코호트가 `visible=is.true`** — W0 시점 신규 영화는 안 보인다. §7.13의 `--films` 패치 필수(임시로 `--all` 가능하나 전량 스캔) |
| S06-wd-honors | `worker/wd-honors.py` 🔧 🆓 | film_wd_honors (pqv:P585 함정 내장) | 같은 visible 필터 + **imdb_id 필요 → `depends_on: S04`** |
| S07-lineage-attach | **스테이지 아님(자동)** — tmdb_id upsert가 기존 계보 스텁과 병합 | — | verify만: `film_lineage` 부착 여부 리포트 |

**W1 — 콘텐츠 (per-film, tier=full)**
🔧 = 기존 워커에 **per-run 스코핑 패치 필요**(§7.13) — 패치 전 이 스테이지들은 매니페스트 린트가 실행을 막는다(무스코프 오발사 방지).

| id | 내용 | runner | 비용 |
|---|---|---|---|
| S10-extract | figures 6–8 + takes | `worker/film-extract-batch.py` 🔧 💰Opus Batch | est $0.30/편. ⚠️ **`--films` 없음 + 대상 선정 = "figure 없는 전 영화"** — Tier-2 ~5,000편이 설계상 figure-less이므로 무스코프 `--submit` 1회 = ~$1,500 오발사. §7.13 패치가 P1의 전제 |
| S11-boldtake | SM 14 프레임워크+invitation+theorist/concept | `bold-take-gen.py`→`bold-take-batch.py`→`boldtake-load.py --apply` 🔧 💰Opus | **S20 전 필수**(신규 figure UUID가 임베딩 대상). ⚠️ gen의 `--emit-requests` 경로는 `--films`를 **무시**(전 적격 영화 emit) — §7.13 |
| S12-figure-slug-assert | `figures.slug is null = 0` 어서션+백필 | 🆕 factory 내장 SQL | RUNBOOK §4.1 |
| S13-trope-tag | figure_tags | `worker/trope-tag.py --persist` 💰Opus sync | 미태그 figure만(자기 스코핑 OK) |
| S14-catalog-map | figure_taxonomy | `catalog-map-run.py`(object/location)+`catalog-map-char.py` 🔧 💰Sonnet Batch | ⚠️ 대상="임베딩 있는 그 kind 전 figure"(figure_taxonomy 반조인 없음) — 쓰기는 upsert라 안전하나 **매 런 전 코퍼스 재과금**. §7.13: unmapped-only 필터 |
| S15-asset | why-watch 8렌즈 | `asset-gen.py`→`asset-batch.py`→`asset-load.py` 🔧 💰Opus | ⚠️ emit 대상=전 카탈로그−기존 out.jsonl(파일이 사실상 원장 — D1 위반). §7.13 + `--out factory-run-{run_id}` 명명 규약 |
| S16-next | watch-next | `next-gen.py`→`next-batch.py`→`next-resolve.py`→`next-load.py` 🔧 💰Sonnet | 동일 emit 패턴(§7.13). resolve가 환각 드랍 |
| S17-reception | 4소스 리셉션 | `magazine research agent/reception-run.py`→`reception-load.py` 🆓0️⃣ | resumable — 재개 스킵 경로는 **`reception_data/<slug>.json`**(`--limit` 시 `reception_out_smoke/`). ⚠️ 경로에 공백 — 인용 필수 |
| S17b-features | film_features(kind=reception 등) | `worker/film-features.py` 💰Gemini | **원우 결정 №5=보류/제외.** 매니페스트에 두되 `enabled:false` — 신규 영화에 생성 안 함(S17 4소스로 충분). 가든에서 재평가. |
| S18-qa (등록 전용) | 질문+답(`questions`/`canonical_answers`) — `/film/x/q/*` 페이지·qa.xml·df-curious 탭·서프라이즈 question 모드·tv_eligible 리치니스의 원천 | 신규 full-tier slug를 `worker/qa-seed/` 대기열에 **등록만**(§7.15 훅) | **원우 결정 №8=큐 등록만 확정.** 공장 동기 생성 금지(주간 25–50편 페이스 캡=Ω34와 충돌). S59가 "질문 0편" 카운트 노출. ⚠️ 에세이 동결+질문 대기 = 신규 영화 df-curious 탭 한동안 부재(정상). |
| S18b-clips | YouTube 클립 → `media(meta.type='clip')` (film 히어로 릴·tv_reel 믹스) | `worker/film-clips.py --persist` 🆓(YOUTUBE_API_KEY, ~100–200 유닛/편) | **원우 결정 №9=공장 편입+워처 재건 확정.** 신규 영화는 S18b가 즉시 수집; 기존 코퍼스 순환 보충은 nohup 데일리 워처로 재건해 `restart-watchers.command`(P4)에 포함(사망한 launchd `net.metatake.filmclips` 대체). |
| S19-geo | 촬영지/무대 | `geo-batch-submit.py` 🔧→`geo-batch-collect.py --wait --finish`(내부: load→geo-code) 💰Sonnet-5+🆓 | **$0.166/편 실측**. ⚠️ **현재 플래그로는 런 스코핑 불가**: `--only`는 카테고리 필터, `--seed-only`는 `in_seed_catalog`만(tmdb-resolve는 이 컬럼을 안 세움 → 공장 영화는 시드 밖), 전체 제출은 GEO_운영 문서가 **금지**(백로그 ~$820 혼입). §7.13 `--films` 패치 필수; 임시 우회=편별 `GEO_FILMS={slug} run-geo-extract-apply.command`+`geo-code.py --apply`. GEO_운영 게이트·금지 전부 상속(dropped 미적재, done* append-only, collect 전 재제출 금지) |

**W2 — 벡터·그래프 (corpus-additive; 런당 1회)**
| id | 내용 | runner | 성격 |
|---|---|---|---|
| S20-embed | figures/takes/meta_takes.embedding | `worker/mt-embed.py` 🆓OpenAI | null-only |
| S21-taste-vector | film_taste_vector upsert | 🆕 `factory/sql/taste_vector_upsert.sql` (§7.1) | 신규 영화만 |
| S22-trope-incr | takes.trope_id 증분 배정 | `worker/trope-incremental.py --films {slugs} --persist` | additive 정본. 미배정분은 가든 큐로 집계. ⚠️ `meta_takes.film_count`는 안 건드림(베이크 컬럼) — 트로프 정렬이 가든까지 살짝 스테일(정상, S59 가든 큐에 집계) |
| S23-concept-embed | 신규 raw concept → concept_map | `worker/concept-embed.py` → `--write 0.70` 🆓 | |
| S25-affinities | film_affinities 재구축 | `worker/mt-recommend.py` 0️⃣ | derived-swap(원자 스왑) — 안전 |
| S26-counterpoints | entity_edges 재구축 | 🆕 `factory/sql/counterpoints_rebuild.sql` (§7.2) 0️⃣ | 정본 SQL은 `supabase/rpc/counterpoints.sql` 헤더 2블록 |
| S27-next-backfill | film_next.target_film_id 역백필 | 🆕 SQL 1줄 (RUNBOOK §4.3d) | |
| S28-sentences | 문장층 stats①②→kinship③→13패턴④ | 🆕 `worker/sentence-refresh.py --films {slugs}` (§7.3) 0️⃣ | ON CONFLICT DO NOTHING. 순서 불변 |
| S29-index-health | 대량 인제스트 후 HNSW/IVF 점검 | 🆕 factory 내장(임계: takes +10%↑ 시 경보) | `supabase/build-takes-hnsw.sql` published 부분 인덱스 레시피 |
| (제외) | `mt-consolidate/author/rank` | — | 레거시 reading 허브 전용 — 공장 불편입(§9 근거) |

**W2b — 신규 감독 (per-director, 조건부: 4대 아티팩트 전무 시)**
| id | 내용 | runner |
|---|---|---|
| S30-detect | director_portrait/picks/facts/next 0행 감독 검출 | factory 내장 SQL |
| S31-dir-profile | `director-profile-gen.py`→`-batch.py`→`-load.py --apply` 💰Opus (`--apply`는 load만; gen은 `--all/--dirs/--min-films`) |
| S32-dir-picks | `director-picks-gen.py`→`-batch.py`→`-load.py --apply` 💰Opus (visible 필모 검증 내장) |
| S33-dir-facts | `director-facts-gen.py`(sync)→`director-facts-load.py --apply` | ⚠️ 작가 모델=**Gemini**(`GEMINI_API_KEY` 없으면 하드 종료; Opus는 `--gen-fallback`), 판정=Sonnet, **BRAVE_API_KEY 필수** |
| S34-dir-photo | `worker/director-profiles.py` 🆓 |
| S35-dir-embedding | `select refresh_director_embeddings(array[{slugs}]);` | 🆕 RPC (§7.4) — 현재 ad-hoc SQL뿐(Stage 16 갭 해소). ⚠️ Galaxy 감독 좌표(`director_map_xy`)는 별개로 **다음 가든까지 부재가 의도**(영화 갤럭시와 동일 정책 — verify가 실패로 오인하지 말 것) |

**W3 — 객관축·큐레이션·TV (per-film·런 혼합)**
| id | 내용 | runner |
|---|---|---|
| S39-analyzed-flip | 🆕 **`films.is_analyzed=true` + `hold` 해제** (tier=full, S10/S11 verify 통과분만) | factory 내장 SQL — **블로커 해소 스테이지**: 저장소 어디에도 is_analyzed를 켜는 코드가 없다(세터는 전부 false뿐; 기존 1,935편은 미기록 수동 SQL). 안 켜면 visible이어도 ① film 페이지가 **Tier-2 digest 분기로 렌더**(figures/takes 안 보임) ② `tv_eligible` 즉사 ③ 홈 Newly/exhibits·surprise 풀·misreadingsEligible·/curious 전부 제외. 함께: `hold=false` 처리 + **visible 재계산 강제**(트리거는 figures에만 걸려 있으므로 figure 행 no-op touch 또는 visible 직접 세팅) — 구 "P9 un-hold" 감독 단계의 승계. `depends_on: S10,S11` |
| S40-takescore | cinecodex 채점 | `score/cinecodex_score.py` 💰Sonnet Batch ($0.001–0.005/편 실측). **인보케이션(위치 인자): full-tier = `100000 visible`(S39 후), catalog = `N all`(⚠️ 미채점 백로그 ~274편 동반 — 저렴하나 인지할 것)**. resume=`cinecodex_targets(p_scope,p_limit)`. 드리프트 게이트(anchor ±12) 존중. **PLAN 명시 갭: "score on ingest" — 이 스테이지가 그것** |
| S41-curation | curation.film upsert + film_comment 재계산 | 🆕 `factory/sql/curation_new_films.sql` (§7.5) 0️⃣ — 규칙 정본은 DB `curation.rule`. **`where manual_override is not true` 필수** |
| S42-tv-compile | `select tv_compile_batch(20,4);` 루프(잔여 0까지) 0️⃣ | 게이트 `tv_eligible(film,4)`: visible+analyzed+클린 트레일러+rich≥4. 실패=status='skipped'(정상) |
| S43-tv-playlists | 소축: `select tv_build_all_playlists();` + 대3축(trope 2,859·archetype 1,535·concept 588): 🆕 러너 — `tv_build_{trope,concept,archetype}_playlists(p_min, p_batch:=300, p_offset)` 오프셋 루프(+20s 슬립+헬스체크) 0️⃣ | 런당 1회. advisory lock 777002·pg_sleep 존중. ⚠️ `worker/tv-build-playlists.py`는 **미작성 계획물**(WORKORDER §5d) — §7.14에서 신설 |
| (보류) S45-film-scores | 정전가 prestige/discovery | ⏸ `compute_film_scores`=글로벌 삭제+lineage 의존 — **절대 금지**. 신규 영화는 null(digest 우아 강등). 증분 변형은 §14 P6 |

**W4 — 퍼블리케이션 (런당 1회, 티어 공통)**
| id | 내용 | runner |
|---|---|---|
| S50-visibility-audit | figures≥3→visible **어서션**(S39가 세팅, 여기선 검증), **<3이면 경보 목록**(무경보 noindex 방치 금지), `is_analyzed`/`hold` 상태 어서션, genres/overview/poster 어서션 | 🆕 factory 내장 |
| S51-lastmod | `films.last_processed_at=now()` (대상 영화만) | SQL — sitemap lastmod 계약(census H §1) |
| S52-revalidate | `/api/revalidate`(REVALIDATION_SECRET)로 tag `film:{slug}`·`takescore-film:{slug}`·`home-v2` 무효화 | VERIFY: 라우트 시그니처 확인 후 배선 |
| S44-fpi | `select fpi_rebuild();` | S04 이후면 언제든. Screener 시청국 필터 |
| S53-artifacts | 조건부 동결 JSON 재빌드: `atlas-cities-build.py`(신규 도시 후보 시)·`crew-index-build.py`(크레딧)·`access-enrich-build.py`(옵션) | lib/ 산출물 → 워처가 자동 배포. (참고: `lib/theorist_portrait.json`도 동결 파일 — boldtake가 신규 theorist를 만들 수 있는지 확인되면 4번째 후보, §17.4) |
| S54-ko-aliases | `worker/ko-aliases.py` (wikidata_id 후) | 한글 검색 |
| S55-news-entities | `hourly/poller/sync_entities.py` | 뉴스 비트게이트 매칭 개시 |
| S56-warm | 신규 URL GET 워밍(film/whereto/movies-like/takescore, cache-buster 검증) | 🆕 factory 내장 |
| S57-indexnow | `node scripts/indexnow-ping.mjs <신규 URL만>` | 변경 없는 URL 재핑 금지 |
| S58-deploy-check | lib/ 변경 있었으면 Vercel 최신 배포 READY 확인, ERROR면 빈 커밋 재빌드 | 배포 churn→sitemap DB 과부하 함정 대응 |
| S59-report | verify 전체 실행 → `factory.runs.report_md` + `factory/logs/run-<id>.md` + 가든 큐 집계(미배정 take 수·신규 concept 수·<3figure 목록) | 🆕 |

### 5.3 순서 불변식 (매니페스트 `depends_on`으로 강제)
S03→S10 · S04→S06(wd-honors는 imdb_id 필요) · S10/S11→S20 · S20→S21/S22 · S21→S25(taste가 KNN 입력) · **S22→S25**(TF-IDF 레그가 figure_type_members를 읽음 — 빠지면 신규 영화 어피니티가 KNN-only+빈 근거 컬럼) · S25→S26(counterpoints는 trope_id+affinities 후) · **S22/S25→S28**(kinship이 affinities 성분에서 파생 — RUNBOOK Stage 18 "needs takes, affinities, tropes") · S10~S17→S28 · S10/S11→S39 · S39→S40(visible 스코프)/S42(tv_eligible) · S03(trailer)→S42 · S42→S43 · S04→S44/S54 · 전부→S50~S59. 하브: 어떤 리네임·리셋 계열도 depends 그래프에 존재하지 않는다(§9).

---

## §6. 오케스트레이터 — `worker/factory.py` 명세

stdlib-only. env는 기존 워커들과 동일한 inline `load_env()`(루트 `.env.local`). **내장 DB 채널 2개:** ① PostgREST(service role) — public 테이블/RPC용 ② Management-API query 헬퍼(`POST /v1/projects/jvgarcqrtsmgfimdcwgo/database/query`, `SUPABASE_ACCESS_TOKEN`) — factory 스키마 I/O와 매니페스트 `verify_sql`/`sql_file` 실행용(JSON 행을 파싱해 반환; `apply-sql.py`는 상태코드만 찍으므로 코드 재사용 불가, 같은 엔드포인트만 공유). 외부 바이너리는 절대경로 해석(`~/.local/node/bin/node`, `command -v claude`) — nohup 컨텍스트에 PATH 없음. 서브커맨드:

```
factory.py add "Title (Year)" [--director D] [--tmdb-id N] [--tier full|catalog|auto]
factory.py enqueue <path/to/titles.csv> [--tier …]        # factory/intake/*.csv drop도 동일
factory.py plan [--run <id>]        # intake queued → 런 생성, 스테이지 계획+비용 견적 출력(DRY)
factory.py review                    # R1 큐 표시: 후보/신뢰도, approve/reject 대화형(또는 --approve-all-high)
factory.py run [--run <id>] [--from S10] [--only S40] [--films slug,slug]   # 집행(재개 겸용)
factory.py status [--run <id>]      # 영화×스테이지 매트릭스(factory.film_matrix_json)
factory.py verify [--run <id>] [--films …]   # verify_sql+probe 일괄 → verify_result 기록
factory.py gaps [--days 30]         # 데이터 드리프트 프로브(§11.3와 동일 함수)
factory.py garden-queue             # 가든 패스로 넘길 잔여물 리포트
```

**실행 알고리즘(run):**
1. 런의 대상 영화 목록·티어 확정 → manifest 로드(+sha 기록) → 토폴로지 정렬.
2. per_film 스테이지: `combine_across_films=true`면 전 영화 1배치 submit → `stage_runs(status='submitted', batch_id)` 기록 → poll fetch(90분 스톨=취소+재제출 1회, 메모리 룰) → load → verify_sql per film. 대상 ≤`sync_under`(50)면 배치 대신 해당 워커의 sync 경로/병렬 호출.
3. corpus 스테이지: 런당 1회, film_id null 행.
4. **게이트:** R1(resolve 저신뢰 → `awaiting_review` 정지) · R2(런 견적 합계 > `FACTORY_COST_GATE_USD`(기본 50, env) → 견적 보고 후 정지; geo $50 게이트 선례) · 스테이지별 `max_usd` 초과 동일.
5. 실패: `failure_policy`대로. `park`=그 영화만 제외하고 진행(끝에 리포트), `abort_run`=정지. 모든 에러는 stage_runs.error에.
6. 멱등: 시작 전 각 스테이지 verify_sql로 "이미 충족" 판정 → `skipped`. 따라서 `run` 재실행=재개.
7. 종료: S59 리포트 생성. **어떤 완료 주장도 DB 카운트+파일 실존으로 재확인 후 기록**(위조 알림 교훈).

**런처:** `run-factory-plan.command` / `run-factory-run.command` / `run-factory-status.command` (더블클릭 문화). **전자동 모드(P4):** `factory-watch.sh` — nohup 루프(PID `factory/.watch.pid`, 킬스위치 `factory/HOLD`, hourly 워처 헤더 패턴 복제)가 `factory.intake status='queued'`를 폴링→plan→(R1 없으면)run. 재부팅 후 재기동 한 줄을 스크립트 헤더에 문서화.

---

## §7. 신설 부품 명세 (빌더가 만드는 새 조각 — 총 15종)

1. **`factory/sql/taste_vector_upsert.sql`** — 신규(또는 stale) 영화의 `film_taste_vector` upsert. **확정 사실(검증 완료):** 라이브 컬럼은 `(film_id, embedding, n_takes, built_at)` — `embedding`이며 `v`가 아니다(`phase2-taste.md`의 `v vector` DDL은 미적용 초안). ⚠️ 기존 1,941행의 정의에는 **published 필터가 없다** — 신규분도 동일 정의로 맞출 것(정의 혼합 금지); published 필터 도입은 가든에서 전량 재계산할 때만.
2. **counterpoints 재구축 러너** — 정본은 `supabase/rpc/counterpoints.sql` 헤더 2블록(conn_film_trope_vec→entity_edges). **복사본을 만들지 말고 factory.py가 정본 파일의 헤더 블록을 파싱해 실행**(사본=동기화 사고의 씨앗; "레포가 정본" 불변식). Sentinel 커플링에 `supabase/rpc/**` 룰 포함(§11.1).
3. **`worker/sentence-refresh.py --films <slugs>`** — `sentence-engine/MASS-PRODUCTION.md`의 per-film 증분 레시피를 코드화: ①`sentence_node_stats` ②`sentence_concept_stats` ③`film_kinship` ④13패턴 INSERT(전부 ON CONFLICT DO NOTHING), 대상 영화 필터 주입. 실행 경로는 apply-sql.py(Management API). **불변식: LLM 0·random 0·브랜드 계약 문구 불가침·순서 고정.** corpus-wide 재실행은 이 스크립트 범위 밖(가든).
4. **`refresh_director_embeddings(p_slugs text[] default null)` RPC** — `director_embedding` upsert = 해당 감독 figures.embedding 평균(+nfig). null이면 결손 감독 전체. 마이그레이션으로 커밋(BACKLOG §G 해소). 함수레벨 timeout.
5. **`factory/sql/curation_new_films.sql`** — `curation.film`에 신규 tmdb_id upsert(원산지=TMDB production_countries, phase0 스크립트 로직 참조) + `curation.film_comment` 재계산. **재계산 SQL은 `curation.rule` 테이블과 `HANDOFF-투두블유-큐레이션코멘트.md`에서 빌더가 추출**(verdict v2 규칙: A=canon 3리스트만·award≠A·lowscore 겸손 규칙 등). `manual_override` 존중 필수. VERIFY: 기존 재계산 경로가 이미 DB 함수로 존재하는지 먼저 확인.
6. **S12/S50 어서션 SQL 묶음** — figures.slug null=0 · genres/overview/poster 존재 · figures≥3 · takes.framework not null · figure_taxonomy>0 · film_next/reception/asset 행 존재(=RUNBOOK §7의 기계화).
7. **`worker/factory.py`** (§6) + `run-factory-*.command` 3종 + `factory-watch.sh`.
8. **`factory/manifest.json`** (§5) + 로더/검증기(스키마 검증은 factory.py 내장: 필수 필드·depends 사이클·runner 실존 파일 체크 — 이것이 "factory lint", Sentinel도 재사용).
9. **S52 revalidate 배선** — 확정(검증 완료): `app/api/revalidate/route.ts` 실존, GET `?secret=&path=/a,/b&tag=x,y` / POST `{paths,tags,secret}`, `REVALIDATION_SECRET` 게이트. ⚠️ **paths 파라미터가 필수**(tag만 보내면 400) + paths/tags 각 **20개 캡** — 벌크 런은 20개 단위 분할 호출. 태그 `film:{slug}`·`takescore-film:{slug}`·`home-v2` 전부 실존.
10. **`app/admin/factory/page.tsx`** (§12) + public SD 래퍼 RPC — 읽기 `factory_matrix_json`/`factory_gaps_json`/`factory_change_orders_json` + **쓰기** `factory_intake_add`/`factory_intake_decide(id,action)`/`factory_co_decide(id,action)` (factory 스키마는 PostgREST 비노출이므로 server action이 직접 접근 불가 — cinecodex_write_runs 선례).
11. **`worker/factory-sentinel.py` + `factory/coupling-map.json` + `factory-sentinel.sh`** (§11).
12. **`factory/logs/`** 디렉터리 + append 규약(런 1줄: `ts · run#id · films N · $X.XX · alerts: …`).
13. **기존 워커 스코핑 패치 세트(🔧 — P1의 전제)** — 원칙: `--films slug,…`가 주어지면 대상 선정 = (기존 적격성 집합 ∩ 지정 slug); 없으면 기존 동작 유지(하위호환). 대상과 요점: ⓐ `film-extract-batch.py` — figure-less 선정에 `--films` 교집합 추가 ⓑ `bold-take-gen.py` — `--emit-requests` 경로가 `FILMS_ARG`를 존중하도록 1줄 수정 ⓒ `asset-gen.py`/`next-gen.py` — `emit_requests()`가 `--films` 존중 + 팩토리 인보케이션은 `--out factory-run-{run_id}` 명명(과거 out.jsonl을 원장으로 쓰는 관행 차단) ⓓ `geo-batch-submit.py` — `--films` 필터 신설(카테고리 필터·seed-only로는 런 스코핑 불가, 전체 제출은 금지) ⓔ `release-events.py`/`wd-honors.py` — `--films`(또는 최소 `--all`+delete-insert 멱등에 의존) ⓕ `catalog-map-run.py`/`-char.py` — unmapped-only 반조인(figure_taxonomy 부재분만) + `--films`. 각 패치는 기존 단독 실행 동작을 바꾸지 않는다(플래그 부재 시 무변화)를 수용 기준으로.
14. **`worker/tv-build-playlists.py`** — 대3축 플레이리스트 러너(**WORKORDER-tv-strategic-playlists §5d의 미작성 계획물**): `tv_build_{trope,concept,archetype}_playlists(p_min, p_batch:=300, p_offset)`를 next_offset 재개 루프로, 배치 간 20s 슬립 + `curl https://metatake.net/api/surprise/home` 헬스체크.
15. **qa-seed 대기열 훅** — S18-qa 정책(⏸)에 따라: 신규 full-tier 영화 slug를 qa-seed 프로그램의 입력 대기열(포맷은 `worker/qa-seed/README.md` 확인)에 append하는 소품 + S59 리포트의 "질문 0편" 카운터.

---

## §8. 티어 라우팅과 비용 모델

### 8.1 티어
| 티어 | 스테이지 | 결과 |
|---|---|---|
| `catalog` (Tier-2) | W0 전체 + **S40 채점(원우 결정 №2=YES, `N all` scope)** + S41 + W4 축약(S50 어서션은 완화: figures 요구 없음) | noindex 카탈로그 레코드 + digest + whereto + 검색(catalog 칩) + lineage/locations 표면 + **TS 칩/Screener 포함**(채점하므로). |
| `full` (Tier-1) | 전 스테이지 | ⚠️ visible 트리거(figures≥3)만으로는 **안 열린다** — Tier-1 렌더·TV·홈·미스리딩은 전부 `is_analyzed=true`도 요구하며 그건 S39가 켠다(+hold 해제). visible+analyzed 둘 다 = 완전 개방 |
| `auto` | **원우 결정 №1: 당분간 금지.** intake가 `auto`를 받으면 catalog로 강등 + `status='review'`(사람이 full 승격 판단). 자동 full 승격 규칙은 미구현 — Watchlists Phase 3(행동 기반 승격, intake source='promotion' 재입장)로 미룸. |

### 8.2 비용 모델 (편당; M=실측, E=추정 — **P1 파일럿에서 실측으로 교체**하고 stage_runs.cost_usd로 상시 자가보정)
| 스테이지 | 모델 | 편당 |
|---|---|---|
| S10 extract | Opus Batch | E $0.30 |
| S11 boldtake | Opus Batch | E $0.30 |
| S13 trope-tag | Opus sync | E $0.03 |
| S14 catalog | Sonnet Batch | E $0.02 |
| S15 asset | Opus Batch | E $0.15 |
| S16 next | Sonnet Batch | E $0.02 |
| S17 reception | — | M ~$0 |
| S19 geo | Sonnet-5 Batch | **M $0.166** |
| S20 embed | OpenAI | M <$0.01 |
| S40 takescore | Sonnet Batch | **M $0.001–0.005** |
| W2b 신규 감독(감독당) | Opus+Gemini(facts 작가)+Sonnet(판정) | E $0.5–1.5 (env: ANTHROPIC+GEMINI+BRAVE 3종 필요) |
| **Tier-1 합계** | | **E ≈ $1.0±0.5/편** (+신규 감독당 ~$1) |
| Tier-2 합계 | | ~$0 (S40 포함 시 +$0.005) |

게이트: 런 견적 > $50(기본) → 정지·보고. 전 배치 usage는 hourly의 `usage.jsonl` 패턴으로 `factory/logs/usage.jsonl`에도 append.

---

## §9. 코퍼스-와이드 정책 + 가든 패스

**공장 불변 원칙: 인제스트는 기존 라이브 엔티티의 slug/제목/링크를 절대 바꾸지 않는다.** 공장에 편입된 corpus 단계는 additive-safe 4형(null-only·increment·derived-swap·ON CONFLICT)뿐이다.

**공장 영구 배제(가든 전용·감독 하) 목록:** `trope-build.py --reset` · `trope-persist.py --apply` · `trope-consolidate(-apply).py` · `mt-recluster.py` · `mt-dedupe-rename.py` · `mt-retitle-splits.py` · `galaxy-build.py`(라벨만 제외) · `compute_film_scores` · `theory-import.py`(truncate) · `mt-import.py --fresh` · `film-extract.py --reset`. `run-pipeline-finish.command`는 공장 도입과 함께 **은퇴 선언** — 검증 결과 아무것도 이 스크립트를 체인하지 않아 안전(참조는 문서뿐). 은퇴 주석을 스크립트 헤더·RUNBOOK §1 표·`pipeline-wait-tropetag.py` docstring 3곳에 남길 것(trope 단계는 S22가, un-hold는 S39가 대체).

**가든 패스(분기 1회 권장, 원우 결정 №3):** 별도 감독 세션으로 ① 미배정 take들의 신규 트로프 형성(cluster→gate→name) ② 필요 시 recluster/dedupe(+`slug_history`/`merged_into` 무결성 어서션+`mt-seo-batch` 재실행) ③ `galaxy-build.py`(+`--directors`) ④ film_scores 재계산 ⑤ 코호트 상향 검토. 입력물은 S59가 쌓아 둔 `garden-queue` 리포트. 가든 체크리스트 문서는 P6에서 별도 작성(`docs/RUNBOOK-garden-pass.md`).

---

## §10. 퍼블리케이션·프레시니스 체인 (W4의 근거)

- **사이트맵은 전부 자기 갱신**(force-static ISR 3600) — 단 lastmod는 `films.last_processed_at` 계약(S51), 적격성 캐시(misreadings/director-layer)는 최대 24h, 코호트 캡은 oldest-first라 신작 서브 URL이 광고되지 않을 수 있음(정상 — 캡 상향은 주간 GSC 판단, 2026-07-16까지 동결).
- **동결 3종 JSON**은 절대 자기 갱신 안 됨 → S53. **IndexNow는 수동 스크립트뿐** → S57(신규 URL만).
- ISR: 신규 페이지는 첫 GET에서 온디맨드 생성(S56 워밍) — 라이브 감사 시 캐시버스터 필수, `unstable_cache` null-poison 주의(로더 throw 패턴 불가침).
- i18n: `content_i18n` 리컨실러는 **미구현**. 공장은 스테이지 슬롯 `S86-i18n`(⏸ BLOCKED)을 매니페스트에 예약만 해 둔다 — 웨이브⓪(용어집) 후 `HANDOFF-한국어화-i18n-마스터.md` §6대로 빌드되면 차단 해제. 그때까지 신규 영화 /ko 없음이 정상.

---

## §11. Factory Sentinel — 공장 자기갱신 루프

**사명:** "사이트가 변하면 공장 설계도가 낡는다"를 자동 감지하고, 수정안을 만들어, 정책에 따라 적용한다.

### 11.1 커플링 맵 `factory/coupling-map.json`
경로 글롭 → 영향 스테이지/표면의 역인덱스. 초안 항목(빌더가 §5의 각 스테이지 `coupling` 필드에서 생성):
```jsonc
{ "rules": [
  { "glob": "app/film/**",                "stages": ["W1*","S28","S50"], "kind": "surface" },
  { "glob": "app/*/[slug]/**",            "stages": ["*"],   "kind": "new_surface_heuristic" },
  { "glob": "lib/sitemap-data.ts|lib/seo.ts", "stages": ["W4*"], "kind": "publication" },
  { "glob": "supabase/migrations/*.sql",  "stages": ["*"],   "kind": "schema" },
  { "glob": "worker/*.py",                "stages": ["runner-map"], "kind": "runner" },
  { "glob": "supabase/rpc/**",            "stages": ["S25","S26"], "kind": "canonical_sql" },
  { "glob": "hourly/poller/sync_entities.py", "stages": ["S55"], "kind": "runner" },
  { "glob": "lib/atlas_cities.json|lib/crew_index.json|lib/access_enrichment.json", "stages": ["S53"], "kind": "artifact" }
]}
```

### 11.2 프로브 3종 (worker/factory-sentinel.py; 일 1회 + 온디맨드)
1. **코드 드리프트:** 마지막 체크포인트(`factory/.sentinel-checkpoint` = 커밋 해시) 이후 `git log --name-only` → 변경 경로를 커플링 맵에 대조. 매칭 → CO(kind=code_drift). **신규 표면 휴리스틱**: `app/` 아래 새 디렉터리+`[slug]` 페이지 신설, 또는 신규 파일에 `films`/`film_` 테이블 참조 grep 히트 → CO(kind=new_surface, risk=review).
2. **데이터 드리프트:** `factory.gaps_json()` — 최근 N일 `films.created_at` 영화 중 티어 기대 산출물 결손(예: full인데 figures=0·미채점·providers null·문장층 0행). **공장 밖 진입 영화**(lineage-resolve 스텁, `/api/track` lazy import의 `tmdb-%` 슬러그) 도 여기서 잡혀 intake(source='sentinel', tier='catalog')로 자동 등록. → CO(kind=data_drift) 또는 자동 백필 런.
3. **스키마/공장 린트:** manifest의 runner 파일 실존, writes/reads 테이블 실존(information_schema), verify_sql 드라이런, 신규 마이그레이션에 film FK 테이블 추가 감지(→ "새 층 등장?" CO). RPC 시그니처 소실(예: DROP된 함수) → CO(kind=stage_broken, risk=blocked).

### 11.3 체인지오더 수명주기
`open → proposed → approved → applied`. 발행 시: `factory.change_orders` 행 + `factory/change-orders/CO-<id>.md`(증거·영향 스테이지). **proposed 단계 = headless 에이전트**: sentinel이 `claude -p "<CO 요약 + 본 문서 §5 발췌 + manifest 해당 부분>" --output-format json` 방식으로 Claude Code를 호출해 **manifest.json 수정 diff + 본 문서 갱신 문안**을 제안받아 CO에 첨부. **적용 정책(원우 결정 №4=저위험 즉시 자동, 확정):** `risk='auto_ok'`은 **발생 즉시 적용+커밋**(원우 승인 불요). `risk='review'`(신규 스테이지 제안·비용 영향·스코프 변경)와 `risk='blocked'`(stage_broken)는 원우 승인 대기. **auto_ok 화이트리스트(이 목록에 정확히 맞는 것만; 의심스러우면 review로 강등):** ① runner 파일 경로 단순 이동(내용 동일) ② `coupling-map.json` 항목 추가/경로 갱신 ③ 매니페스트 `notes`/`title` 등 비-동작 필드 ④ 본 문서 순수 문안. 이 넷 이외의 어떤 매니페스트 *동작* 변경(runner/args/depends/gate/cost)도 review. 매니페스트 변경은 항상 git 커밋(수동 커밋 경로 — 워처 범위 밖).

### 11.4 구동
`factory-sentinel.sh` — nohup 루프(일 1회 06:00, PID/HOLD 패턴). 재부팅 재기동 필요(다른 워처와 함께 — P4에서 `restart-watchers.command` 하나로 묶어 3종+공장 워처 일괄 재기동 제공). 알림: CO 발생 시 `factory/logs/`에 기록 + status에 노출(외부 푸시는 범위 밖).

---

## §12. `/admin/factory` 명세

`app/admin/metrics/page.tsx` 패턴 복제: 서버 컴포넌트 + `createAdminClient()` + `export const dynamic="force-dynamic"` + `app/admin/layout.tsx` NAV_ITEMS에 추가. 인증은 middleware의 `/admin/*` 게이트가 자동 처리(⚠️ middleware.ts 수정 불필요 — 경로만 추가되면 됨. 봇 게이트 로직 건드리지 말 것).

**섹션:** ① 런 목록+진행(runs) ② 영화×스테이지 매트릭스(`factory_matrix_json` — 셀=status 색) ③ R1 리뷰 큐(intake status='review' — approve/reject 버튼=server action이 intake 행 update; 집행은 Mac 루프가 픽업) ④ 갭 대시(gaps_json) ⑤ 체인지오더(승인 버튼 동일 패턴) ⑥ 비용(스테이지별 누적 cost_usd). 쓰기는 전부 status 컬럼 변경뿐 — 실행 명령은 admin에서 절대 발사하지 않는다(실행 평면 분리).

---

## §13. 검증 스위트

1. **스테이지 검증**: manifest `verify_sql`(per-film)+`probe_url`(cache-buster GET, 200+핵심 마커 존재). 결과는 stage_runs.verify_result.
2. **런 종합(S59)**: RUNBOOK §7 전 항목 기계화(§7.6 어서션 묶음) + 표면 스팟체크(film page·/api/search 히트·surprise 샘플·connection map>1노드) + 신규 감독 아티팩트 4종+embedding 행 + Vercel READY.
3. **회귀 가드**: 런 전후 `slug_history`/`merged_into` 불변(라이브 슬러그 변경 0 어서션 — 공장이 리네임을 안 했다는 증명), published takes 수 감소 없음, 기존 영화 figures 수 불변.
4. **프로브 원칙**: 배포 직후 라이브 HTML 판정 금지(ISR 캐시) — 코드/DB 우선, HTML은 캐시버스터. React 주석 노드가 텍스트를 쪼개므로 마커 grep은 DOM-정규화 후. TS 검증은 절대 `cinecodex_card` 편별 루프 금지(Ω42) — `takescore_for_slugs` 1콜.

---

## §14. 구현 페이즈 (다른 AI 실행 계획; 각 페이즈=독립 세션 권장)

**P0 — 기반·캡처 (0.5~1일)**
산출: factory 스키마 마이그레이션(**번호 0081+**, §4 — ⚠️ 함수 본문 완성 후 적용, 초안 그대로 적용 금지) + `trg_films_refresh_visible` 캡처(§4에 정의 있음) + 미캡처 films 컬럼 DDL 덤프 · `factory/manifest.json` v1(§5 전체 이기 — 🔧 스테이지는 `blocked_by: "§7.13"` 표기) · factory.py `status`/`verify`/`gaps` 읽기 3종 + Management-API query 헬퍼 · §17.4 잔여 VERIFY 9건 해소·문서 갱신.
수용: `python3 worker/factory.py status`가 최근 영화 매트릭스 출력; `gaps`가 실제 결손(예: 미채점 274) 검출; 마이그레이션이 신규 브랜치 DB에 그대로 적용됨(파싱 에러 0).

**P1 — W0+W1 러너 + R1/R2 게이트 + 🔧 스코핑 패치 (2~3일)**
산출: **§7.13 워커 스코핑 패치 세트(P1의 전제 — 이것 없이 run 금지)** · plan/review/run(재개 포함)·배치 통합·sync_under 분기·매니페스트 린트·`run-factory-*.command`.
수용: **파일럿 3편**(원우 지정) end-to-end → 3편 모두 figures≥3·visible·**is_analyzed**·verify 녹색(S39는 P2 소속이나 파일럿에선 수동 SQL로 대체 확인); **배치 제출 대상 수 = 정확히 3**(스코핑 증명 — 로그로 확인); 비용 실측이 §8.2 표를 갱신; 저신뢰 1건을 일부러 넣어 R1 정지 확인; 각 패치 워커의 무플래그 단독 실행이 기존과 동일 동작(하위호환 회귀 테스트).

**P2 — W2+W2b+W3 (1~2일)**
산출: §7의 1~5 신설 SQL/RPC/스크립트 · **S39 analyzed-flip(블로커 해소)** · 신규 감독 파이프 · S40 채점 편입 · S42/S43 TV(+§7.14 러너).
수용: 파일럿 영화가 **Tier-1 분기로 렌더**(is_analyzed 확인)·/movies-like 추천≥1(근거 컬럼에 shared trope 존재 = S22→S25 순서 증명)·df-know 문장≥2·트로프 배정(또는 가든 큐 집계)·/takescore/film 200·TowCard 렌더·tv_programs 행(적격 시); 신규 감독 1명 4아티팩트+embedding.

**P3 — W4 퍼블리케이션+검증 스위트 (1일)**
산출: S50~S59 전부 + 리포트.
수용: 런 리포트 1장으로 "무엇이 열렸고 무엇이 왜 안 열렸나"가 설명됨; IndexNow 200/202; sitemap에 신규 slug 등장(≤1h); <3figure 경보 동작.

**P4 — /admin/factory + 전자동 워처 (1일)**
산출: §12 페이지 + `factory-watch.sh` + `restart-watchers.command`(전 워처 일괄 재기동).
수용: admin에서 CSV 없이 영화 1편 큐잉→무개입 완주(R1 해당 없을 때); 매트릭스/리뷰/CO 화면 동작.

**P5 — Sentinel v1 (1~2일)**
산출: §11 전부(커플링맵·프로브 3종·CO·headless 제안 루프).
수용: (a) 테스트 커밋(가짜 신규 표면 `app/test-surface/[slug]/page.tsx`)이 CO를 발행하고 제안문이 생성됨 (b) 공장 밖 스텁 영화가 intake로 자동 등록됨 (c) manifest의 runner 경로를 일부러 틀리게 바꾸면 stage_broken CO.

**P6 — 잔여 해소 (원우 우선순위대로)**
가든 패스 런북(`docs/RUNBOOK-garden-pass.md`) · S86-i18n 차단 해제(리컨실러 빌드와 함께) · film_scores 증분 변형 검토 · tradition-match 워커(BACKLOG §B) · 신규 트로프 형성 반자동화 · `/admin/pipeline` 레거시 은퇴 표기 · `app/llms.txt` 재작성(레거시 내용 — census D §13).

**공통 규율:** 각 페이즈 종료 시 ① 이 문서의 해당 §를 "SHIPPED YYYY-MM-DD"로 갱신 ② `docs/00-INDEX.md` 상태 갱신 ③ 마이그레이션은 전부 파일 커밋(하우스 룰) ④ 파일럿·프로브 ≤50건은 sync(배치 금지).

---

## §15. 불변식 전집 (Ω — 공장 코드리뷰 체크리스트)

**순서·데이터**
Ω1 S03(TMDB)→S10(extract) 항상. Ω2 boldtake/asset 등 figure 생성 로드→S20(embed) 전. Ω3 embed→taste/trope-incr/affinities 전. Ω4 문장층 순서 stats→kinship→패턴 고정. Ω5 trope 멤버십은 `takes.trope_id` — `takes.meta_take_id` 회귀 절대 금지(affinities 0행 사고 전력). Ω6 `lib/slug.ts`가 유일 슬러그 생성기(admin import 라우트의 구 slugify 사용 금지). Ω7 `compute_film_scores` 호출 금지(글로벌 삭제). Ω8 lineage 게이트는 실측 행 수 — `lineage_lists.film_count` 금지; `edition_year≠film_year`; 수상은 영화 단위(인물 노미네이션 문구 금지).

**corpus 안전**
Ω9 공장은 라이브 slug/제목/링크를 바꾸지 않는다(리네임=가든 전용, `slug_history`/`merged_into` 필수). Ω10 §9 배제 목록 스크립트를 매니페스트에 넣지 않는다(factory lint가 거부). Ω11 galaxy는 분기 1회(전좌표 이동).

**DB·API**
Ω12 PostgREST 1,000행 캡 — 벌크는 jsonb_agg 단일행 RPC 또는 `.range()` 페이징. Ω13 anon RPC는 함수레벨 `set statement_timeout`. Ω14 오버로드 함수 시그니처 변경=DROP 먼저+재GRANT. Ω15 새 search kind=RPC+프론트 동시 배포. Ω16 factory·curation·cinecodex 스키마는 SD RPC로만 노출. Ω17 cinecodex never-blend(외부 지표 혼합 금지)·프롬프트 버전 SHA 고정·Haiku 채점 금지. Ω18 `curation.manual_override` 존중. Ω19 HNSW는 published 부분 인덱스만(풀테이블 OOM).

**캐시·배포**
Ω20 payload 형태 변경=unstable_cache 키 범프. Ω21 로더는 에러 시 throw(null-poison 404 금지). Ω22 캐시 키에 시간 시드 금지. Ω23 라이브 검증은 캐시버스터+코드 우선. Ω24 워처 범위=app/components/lib — 그 외 수동 커밋; 새 CSS+페이지는 한 커밋; 워처가 스테이징할 파일을 수동 커밋하지 않기(스트랜딩). Ω25 배포 웨이브 후 Vercel 최종 배포 상태 확인(ERROR면 빈 커밋). Ω26 IndexNow 키 파일은 public/ 루트 고정·불변 URL 재핑 금지.

**LLM·비용**
Ω27 ≤50건 sync, 대량만 Batch; 스테이지당 전 영화 통합 배치. Ω28 custom_id ≤64자·콜론 금지; 90분 스톨=취소+재제출. Ω29 페이지 프로즈는 LLM-0 원칙(문장층·to.W·whereto·digest·QuickAnswers·TakeScore prose) — 공장이 이 층들에 LLM을 끼워 넣지 않는다. Ω30 벌크 Opus는 Batch API(구독 세션 불가). Ω31 비용 게이트: 런 견적>$50 정지(geo 선례).

**콘텐츠·브랜드**
Ω32 문장층 브랜드 계약(설계자 명기+Not-AI 디스클레이머) 불가침. Ω33 답 없는 질문 생성 금지(인텐트 헌장). Ω34 no sockpuppets·발행 페이스 제한(스케일드 콘텐츠 남용 가드) — 벌크 인제스트가 한 번에 수천 페이지를 index로 밀지 않도록 코호트 캡 체계 존중. Ω35 reception 인용은 verbatim·출처 링크(저작권 사다리). Ω36 geo: dropped 미적재·checkpoint append-only·수동 INSERT 금지.

**운영**
Ω37 완료 판정은 DB/디스크 3중 대조(알림 불신). Ω38 launchd/cron 금지 — nohup 루프+재부팅 재기동 문서화. Ω39 원장은 append(재시도=attempt+1). Ω40 Sentinel의 매니페스트 자동 적용은 auto_ok 위험도만(기본 전부 리뷰). **Ω41** full-tier 완주 = visible+`is_analyzed=true`+`hold=false` 3중 세트(S39) — 하나라도 빠지면 표면 절반이 닫힌 채 "성공"으로 오인된다. **Ω42** 편별 `cinecodex_card` 루프 금지(DB 다운 3회 전력)·광폭 멀티조인 집계 금지 — 벌크 TS는 `takescore_for_slugs`/`cinecodex_ranked`/`lib/takescore-bulk.ts`만(§12 admin·S56·S59가 특히 유혹 지점). **Ω43** per_film 스테이지를 스코프 불가 워커로 실행 금지(매니페스트 린트가 강제 — §5.1).

---

## §16. 원우 결정 로그 (2026-07-12 확정 — 빌더는 이 값을 그대로 따른다)

전 항목 원우가 결정 완료. 이 절이 정책 정본이며, 아래 §16 규정과 충돌하는 본문 표현은 이쪽이 이긴다.

1. **tier='auto' 판별 규칙 → 당분간 auto 금지, 명시 지정만.** intake는 `full`/`catalog`만 받는다. `tier='auto'` 값이 들어오면(자동 등록 등) **catalog로 안전 강등하고 `intake.status='review'` 플래그**(사람이 full 승격 판단). 자동 full 승격 규칙(votes/lineage)은 지금 만들지 않는다 — Watchlists Phase 3(행동 기반 승격)로 미룬다. Sentinel 자동 등록(§11.2)도 `tier='catalog'` 고정.
2. **신규 Tier-2도 채점(S40) → YES.** catalog 티어도 S40을 `N all` scope로 돌려 채점한다(편당 ~$0.005). 근거: Screener·TS 칩·/takescore/film 완전성. ⚠️ `all` scope는 미채점 백로그(~274편)를 동반하나 저렴 — 인지만.
3. **가든 패스 주기 → 분기 1회.** `docs/RUNBOOK-garden-pass.md`(P6 산출)에 명시. S59가 쌓는 garden-queue가 임계(예: 미배정 take 500+·신규 concept 다수)를 넘으면 조기 소집 가능(하드 스케줄 아님, 임계 트리거 병용).
4. **Sentinel 자동 적용 정책 → 저위험(auto_ok) 즉시 자동, 나머지 전부 리뷰.** `risk='auto_ok'`(runner 파일 경로 이동, coupling-map 갱신, 순수 문서 문안 등 매니페스트의 *동작*을 안 바꾸는 변경)은 발생 즉시 적용+커밋. `risk='review'`(신규 스테이지 제안·비용 영향·스코프 변경)와 `risk='blocked'`(stage_broken)는 원우 승인 대기. auto_ok 분류 기준은 §11.3에 화이트리스트로 명문화(의심스러우면 review).
5. **S17b film-features(Gemini) → 보류/제외.** 신규 영화에 생성하지 않는다(리셉션은 S17 4소스 LLM-0가 커버, Gemini 의존도 축소). 매니페스트에 스테이지로 두되 `enabled:false`. 필요성 확인 시 가든에서 재평가.
6. **비용 게이트 기본값 → $50 유지**(env `FACTORY_COST_GATE_USD=50`). Tier-1 ≈$1/편이므로 ≈50편 벌크마다 사람이 견적을 한 번 본다.
7. **파일럿 3편(P1) → 선정 원칙으로 확정, 실제 제목은 원우 첫 실배치에서 지정.** 원칙: 세 경로를 모두 태우도록 (a) **신규 감독** 1편(W2b 트리거 검증) + (b) **기존 계보에 이미 부착된** 1편(tmdb_id 자동 병합 검증) + (c) **의도적 저신뢰 resolve** 1편(R1 정지 검증, 예: 동명이인 감독 or 흔한 제목). 세 편은 실낭비를 피하려 실제로 올릴 예정작 중에서 고르되, (c)만 R1 테스트용으로 일부러 모호하게 넣는다. ⚠️ 원우가 P1 착수 시 3개 제목을 이 문서에 기입.
8. **질문(Q&A)층 편입 → 큐 등록만(S18-qa 정책).** 공장은 신규 full-tier 영화 slug를 qa-seed 대기열에 등록만 하고, 생성은 qa-seed의 주간 페이스(25~50편, Ω34 스케일드 콘텐츠 가드)에 맡긴다. 공장 동기 생성 금지. ⚠️ 확정 사실로 기록: 에세이 동결 + 질문 대기 상태에서는 **신규 영화의 df-curious 탭이 한동안 부재**(질문이 주간 웨이브로 도착할 때까지) — 정상 동작이며 S59가 "질문 0편" 카운트로 리포트.
9. **film-clips 부활 → 공장 편입(S18b) + 워처 재건.** 신규 영화는 S18b가 즉시 클립 수집; 기존 코퍼스 순환 보충은 `worker/film-clips.py --persist`를 nohup 데일리 워처로 재건해 `restart-watchers.command`(P4)에 포함(사망한 launchd `net.metatake.filmclips` 대체). 무료(YouTube 쿼터만).

---

## §17. 부록

### 17.1 공장 파일맵 (신설 전체)
```
factory/manifest.json            공정 정본(기계)
factory/coupling-map.json        Sentinel 역인덱스
factory/sql/{taste_vector_upsert,counterpoints_rebuild,curation_new_films,stage18_*}.sql
factory/intake/                  CSV drop 폴더
factory/change-orders/CO-*.md    체인지오더(사람용)
factory/logs/{run-*.md,usage.jsonl}
factory/HOLD                     킬스위치(존재 시 워처 정지)
worker/factory.py · worker/factory-sentinel.py · worker/sentence-refresh.py
factory-watch.sh · factory-sentinel.sh · restart-watchers.command
run-factory-{plan,run,status}.command
app/admin/factory/page.tsx
supabase/migrations/00XX_factory_schema.sql (+visible 트리거 캡처)
```

### 17.2 참조 정본 (충돌 시 이쪽이 이김)
파이프라인=`docs/RUNBOOK-new-film-ingestion.md` · 연결=`HANDOFF-연결엔진-커넥션.md` · 문장층=`HANDOFF-임베딩판타지아-문장층.md`+`sentence-engine/MASS-PRODUCTION.md` · 채점=`score/Cinecodex_RUNBOOK.md` · 큐레이션=DB `curation.rule`+`HANDOFF-투두블유-큐레이션코멘트.md` · 지오=`GEO_운영-신규영화-증분처리.md` · TV=`docs/WORKORDER-tv-*.md` · i18n=`HANDOFF-한국어화-i18n-마스터.md` · SEO/사이트맵=`docs/HANDOFF-SEO-마스터.md`+`lib/sitemap-data.ts` 헤더 · 조사 원본=`docs/factory-census/A~I.md`.

### 17.3 모델 라우팅·env (요약)
census F §23–24가 정본. 공장 신설분: factory.py는 LLM 무사용(오케스트레이션만), sentinel의 headless 제안만 Claude Code 호출.

### 17.4 VERIFY 목록 — 2026-07-12 검증 라운드(5-비판 에이전트)에서 대부분 해소됨

**✅ 해소(확정 사실 — 본문에 반영 완료):**
- ~~visible 트리거~~ → 라이브 덤프 완료: `trg_films_refresh_visible`, figures AFTER I/U/D, `(approved≥3) AND NOT hold` (§4).
- ~~film_taste_vector 컬럼~~ → **`embedding`** (`(film_id, embedding, n_takes, built_at)`); published 필터 **없음**(신규분도 동일 정의로) (§7.1).
- ~~/api/revalidate~~ → 실존·GET/POST·`REVALIDATION_SECRET`·**paths 필수·20개 캡** (§7.9).
- ~~cinecodex_progress()~~ → 부재 확정; resume은 `cinecodex_targets(p_scope,p_limit)` (§5.2 S40).
- ~~external-data.py --shard~~ → **없음**(메모리 스테일; 플래그는 `--persist/--refresh/--backdrops/--scope/--limit`).
- ~~filmclips launchd~~ → **사망 확정**(`worker/film-clips-launchd.log` 전량 "can't open input file" = TCC) → S18b 신설 근거.
- ~~is_analyzed 세터~~ → 저장소·트리거 어디에도 없음(전부 false-세터) → S39 신설 근거.
- 마이그레이션 번호: next free = **0081**(`worker/0078~0080` 라이브 적용분 포함 스캔).

**⏳ 잔여(P0에서 해소):**
1. `films` 라이브 컬럼 전체 DDL 덤프(트리거는 확보됨 — 컬럼 세트 확정만).
2. `curation.film_comment` 재계산 경로 — `curation.reclassify()`는 quadrant/action/wave만 계산(확인됨); rationale 재조립 함수의 라이브 존재 여부 + `curation.rule` 전체 덤프.
3. `trending_pool`/`latest_pool` RPC 정의(라이브 전용) — 신규 영화 포함 조건.
4. search RPC의 Tier-2 포함 범위(tier2-almanac 메모의 "검색 RPC Tier-2 제외" 스테일 여부).
5. `sync_entities.py`의 실제 구동 주기(수동 vs 자동 — "일 1회" 선언만 있고 스케줄러 미확인).
6. `bold_take_films` RPC의 적격성 시맨틱(라이브 전용 — S11 emit 대상 자기-스코핑 여부).
7. K_counterpoint 문장 패턴 가능성(구현은 범위 밖, 모순 기록만).
8. Batch API 제약(custom_id 64자·콜론) — repo 문서에 없으면 본 문서 Ω28이 정본.
9. qa-seed 대기열 입력 포맷(`worker/qa-seed/README.md`) — §7.15 훅 구현 전.
10. boldtake 로드가 신규 `theorists` 행을 만드는지(theorist_name만 저장하는지) — 만든다면 `lib/theorist_portrait.json`이 S53의 4번째 동결 파일 후보.

*(끝 — 이 문서는 Sentinel의 관리 대상이다. 공장 관련 세션은 반드시 여기서 시작한다.)*
