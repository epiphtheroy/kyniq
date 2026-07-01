# Cinecodex 통합 리뷰 — 렌즈 02: 데이터 · 파이프라인

> **REVIEW-ONLY 산출물. DB 미수정.** 모든 DDL은 *제안(PROPOSED)*이며 승인 후에만 적용. 라이브 Supabase(`jvgarcqrtsmgfimdcwgo`)는 **READ-ONLY**로만 점검(information_schema / SELECT). 작성 2026-06-30. 선행 읽기: `score/Cinecodex_HANDOFF.md`·`cinecodex_schema.sql`·`Cinecodex_Execution_Strategy.md`·`Cinecodex_RUNBOOK.md`·`PROMPT_PRODUCTION_v2.txt`; `docs/logic/MASTER-INDEX.md`·`phase0-invariants.md`·`phase1-standing.md`.

---

## ① 요약 (executive summary)

Cinecodex를 my_room에 *데이터 레이어*로 얹는 데 **구조적 장애는 없다.** 단 하나의 진짜 충돌은 **이름**이다: `cinecodex_schema.sql`이 만드는 `films`·`film_scores`는 my_room의 동명 테이블과 **정면 충돌**하고, 게다가 **키 타입이 다르다**(Cinecodex `bigserial film_id` ↔ my_room `films.id uuid`). 해법은 명확하다 — **Cinecodex의 `films`를 적재하지 않고**(my_room `films`가 이미 코퍼스), Cinecodex 점수계 테이블을 전부 `cinecodex_*` / `cc_*` 네임스페이스로 재선언하며 **PK·FK를 uuid `films.id`로 교체**한다. 외부지표 컬럼은 Cinecodex `films`에서 **삭제**하고 기존 `film_ratings`를 단일 소스로 쓴다.

라이브 실측으로 확인된 정합 근거:

| 점검 항목 | 실측 결과 | 함의 |
|---|---|---|
| `films.id` | **uuid**, PK, default `gen_random_uuid()` | Cinecodex `bigserial` 가정 폐기 → 전 FK를 uuid로 |
| `films` 식별자 | `tmdb_id`(int, UNIQUE)·`imdb_id`(text, 6,665행 채움)·`slug`(UNIQUE) | uuid 조인이 정본, tmdb/imdb는 *적재 시 매핑*용 |
| `film_scores` PK | **`film_id` 단독**(track 컬럼 있으나 PK 미포함) → 영화당 1행 | Cinecodex 점수를 여기 끼워넣지 말 것(영화당 1행 제약 충돌) |
| `film_scores` 컬럼 | prestige/discovery/total(numeric)·components(jsonb)·model_version·computed_at | my_room Phase 1 v2 전용. Cinecodex 13축이 들어갈 자리 없음 |
| `film_ratings` | PK `film_id`·FK→films · imdb_rating·**imdb_votes(6,606행)**·metascore(3,105)·**rt_tomatometer(4,354)**·source·fetched_at | 외부지표 **단일 소스 확정**. Cinecodex `films`의 imdb/rt/meta 컬럼은 **중복 → 제거** |
| `film_ratings` RT 형태 | **`rt_tomatometer` 단일 컬럼** (rt_critic/rt_audience 분리 없음) | Cinecodex 스키마의 `rt_critic`/`rt_audience` 2분할은 **이 DB에 없음** — 표시는 tomatometer만 |
| `lineage_lists.id`·`film_lineage.film_id` | **uuid** | my_room 전체가 uuid 우주 — Cinecodex만 bigserial 이질 |
| 충돌 객체 | `cinecodex*`·`cc_*`·`scoring_runs`·`prompt_versions`·`review_queue`·`batch_jobs`·`drift_runs`·`human_audit`·`anchor_controls` **전부 미존재** | **네임스페이스 클린** — 신규 테이블 0 충돌 |
| 코퍼스 규모 | films 6,701(visible 1,935) · film_scores 5,985 · film_ratings 6,665 | "6,000편" = 기존 카탈로그. **새 코퍼스 적재 불필요** |

**핵심 충돌 해소(한 줄):** Cinecodex 점수계를 `cinecodex_scores`·`cc_scoring_runs`·`cc_*`로 네임스페이스 분리하고 **모든 `film_id`를 `uuid references public.films(id)`로 재정의**, 외부지표는 `film_ratings`로 단일화, U/S는 미저장(λ 가변 → 뷰/앱). Cinecodex는 정전가(`film_scores.prestige_score`) **옆 두 번째 객관 축**으로 *나란히* 산다 — 어느 값도 서로의 입력이 아니다(비섞임 = my_room의 ②정전가 비순환과 동형).

---

## ② MODIFY (기존 my_room 자산에 가하는 변경 — 최소)

원칙: **기존 테이블·RPC는 건드리지 않는다.** Cinecodex는 *부가 레이어*다. 아래는 "변경"이 아니라 "공존을 위한 규약 고정"에 가깝다.

1. **`film_scores` (my_room) — 변경 없음.** Cinecodex 13축/V/C/R을 여기 섞지 않는다. 이 테이블은 Phase 1 v2(prestige/discovery/total)의 단일 소스로 유지. *track 컬럼이 있고 PK가 film_id 단독*이므로 "track별 다중 행"을 가정한 우회 적재도 금지(PK 위반).
2. **`films` (my_room) — 컬럼 추가 없음.** Cinecodex `films`의 imdb_rating/rt/metascore/canon_score 컬럼을 my_room `films`에 추가하지 않는다(이미 `film_ratings`가 보유). canon_score 역시 my_room은 **계보 기반 정전가**로 대체(별도 정전 DB 합산 컬럼 불필요).
3. **`film_ratings` (my_room) — 단일 외부지표 소스로 격상(규약만).** Cinecodex 대시보드의 "나란히" 외부지표는 이 테이블에서 읽는다. **RT는 `rt_tomatometer` 하나** — Cinecodex 문서의 rt_critic/rt_audience 2분할 가정을 *이 DB 형태에 맞춰 단일화*. `[⚠COORD: Display 렌즈]`
4. **`compute_film_scores()` (my_room) — 변경 없음.** Cinecodex 적재가 이 함수의 입력/출력에 영향 주지 않음(비섞임). 단, **공유 정규화 상수**(prestige C=2.42 등)와 Cinecodex 0–100 스케일은 *서로 독립*임을 문서에 명시.

> MODIFY가 사실상 비어 있는 것이 **설계 의도**다 — Cinecodex는 ADD-only로 들어와야 my_room의 Phase 0–4 불변식을 하나도 깨지 않는다.

---

## ③ ADD (제안 테이블 / 뷰 — DDL 스케치, 전부 PROPOSED · 미적용)

네임스페이스 규칙: **점수계 = `cinecodex_*` 또는 `cc_*`**. 모든 `film_id`는 `uuid not null references public.films(id) on delete cascade`. (Cinecodex 원본 스키마의 `bigserial film_id` 및 자체 `films` 테이블은 **채택하지 않음.**)

```sql
-- ===== 제안(PROPOSED) · 승인 후 적용 · DB 현행 미수정 =====
-- 네임스페이스: cinecodex_* / cc_* . 키: 기존 public.films(id) uuid.
-- 비섞임: 외부지표·정전가는 어느 컬럼에도 입력으로 들어가지 않는다.

-- 0) 동결 프롬프트 버전 (사전등록) -- Cinecodex 원본 prompt_versions 그대로, 이름만 cc_
create table public.cc_prompt_versions (
  prompt_version text primary key,             -- 'cinecodex-prod-v2' / '...-v2-note'
  prompt_sha256  text not null,
  prompt_text    text not null,
  rubric_notes   text,
  frozen_at      timestamptz default now()
);

-- 1) 원시 채점 표본 (불변 · 영화×모델×샘플당 1행)
create table public.cc_scoring_runs (
  run_id         bigserial primary key,
  film_id        uuid not null references public.films(id) on delete cascade,  -- ← uuid 매핑
  prompt_version text references public.cc_prompt_versions(prompt_version),
  vendor         text not null,                -- 'anthropic'|'openai'|'google'
  model_id       text not null,                -- 핀고정 스냅샷 e.g. 'claude-sonnet-4-6'
  temperature    numeric not null,
  sample_index   int not null,                 -- 1..N
  batch_id       text,
  -- 13 raw sub-scores (정수 0-100):
  cog int, aff int, form int, moral int, dur int,
  itx int, fr int, etx int, ctx int,
  bank int, insincere int, coward int, polar int,
  note           text,                         -- 감사 서브셋만
  raw_json       jsonb,
  input_tokens int, output_tokens int, cache_read_tokens int, cost_usd numeric,
  parse_ok       boolean default true,
  retry_count    int default 0,
  created_at     timestamptz default now(),
  unique (film_id, prompt_version, model_id, sample_index)   -- 멱등 재개
);
create index on public.cc_scoring_runs (film_id, prompt_version);

-- 2) 집계 발표 점수 (median 파생) -- ★ my_room film_scores 와 이름 충돌 회피 = cinecodex_scores
create table public.cinecodex_scores (
  film_id        uuid not null references public.films(id) on delete cascade,
  prompt_version text references public.cc_prompt_versions(prompt_version),
  panel          text not null,                -- 'sonnet-n3' | 'opus+sonnet'
  -- median 13 sub-scores:
  cog int, aff int, form int, moral int, dur int,
  itx int, fr int, etx int, ctx int,
  bank int, insincere int, coward int, polar int,
  -- 파생 축 (고정 발표 공식):
  v_value  numeric,   -- mean(COG,AFF,FORM,MORAL,DUR)
  c_cost   numeric,   -- mean(ITX,FR,ETX,CTX)
  r_risk   numeric,   -- 0.6*mean(BANK,INSINCERE,COWARD) + 0.4*POLAR
  -- U,S 미저장: λ 가변 → 뷰/앱에서 계산 (my_room "표시가는 단순" 원칙과 동형)
  -- 신뢰도 / 정직 메타:
  n_samples      int,
  sd_v           numeric,        -- 표본 간 V SD (런 노이즈)
  sd_r           numeric,
  panel_disagree numeric,        -- 모델 간 V SD (패널일 때)
  flagged        boolean default false,
  scored_at      timestamptz default now(),
  primary key (film_id, prompt_version, panel)   -- ← film_id 단독 아님: 패널/버전 다중 허용
);

-- 3) 앵커 드리프트 컨트롤셋
create table public.cc_anchor_controls (
  film_id       uuid not null references public.films(id) on delete cascade,
  dimension     text not null,                 -- 'POLAR' 등
  expected_band int not null,                  -- 0/25/50/75/100
  tolerance     int default 12,
  last_observed numeric, last_checked timestamptz, drift_flag boolean default false,
  primary key (film_id, dimension)
);

-- 4) 리뷰 큐 (Opus/인간 에스컬레이션)
create table public.cc_review_queue (
  film_id    uuid not null references public.films(id) on delete cascade,
  reason     text,   -- 'high_sd'|'panel_disagree'|'near_threshold'|'parse_fail'|'high_risk'
  status     text default 'open',
  resolution text,
  created_at timestamptz default now(),
  primary key (film_id, reason)
);

-- 5) 배치 잡 추적 (비동기 Batch API · 재개) -- film_ids 를 uuid[] 로
create table public.cc_batch_jobs (
  batch_id     text primary key,
  vendor text, model_id text, prompt_version text, sample_index int,
  film_ids     uuid[],                         -- ← bigint[] 아님
  n_requested int, n_completed int, n_failed int,
  status       text default 'submitted',
  submitted_at timestamptz default now(), ended_at timestamptz
);

-- 6) 드리프트 게이트 런 로그
create table public.cc_drift_runs (
  drift_run_id bigserial primary key,
  checked_at   timestamptz default now(),
  model_id text, prompt_version text,
  n_controls int, n_out_of_tolerance int,
  gate_passed boolean, details jsonb
);

-- 7) 인간 감사 (인간-vs-AI 타당도 · 입력 아님)
create table public.cc_human_audit (
  film_id uuid not null references public.films(id) on delete cascade,
  rater   text,
  cog int, aff int, form int, moral int, dur int,
  itx int, fr int, etx int, ctx int,
  bank int, insincere int, coward int, polar int,
  created_at timestamptz default now(),
  primary key (film_id, rater)
);

-- ===== 조인 뷰 =====

-- A) U/S 질의시 계산 (λ 기본 1.0, 앱에서 파라미터화)
create or replace view public.cinecodex_scores_ranked as
  select cs.*,
         (cs.v_value - 1.0*cs.r_risk)            as u_net,
         (cs.v_value - 50)/greatest(cs.r_risk,1) as s_sharpe
  from public.cinecodex_scores cs;

-- B) 두 객관 축 + 외부지표 "나란히" — 비섞임 정합 뷰 (대시보드 단일 소스)
--    film_scores(정전가) · cinecodex_scores(미학) · film_ratings(외부) 를
--    film_id(uuid) 로 조인만 — 어떤 값도 다른 값의 산식 입력이 아님.
create or replace view public.film_objective_panel as
  select
    f.id            as film_id,
    f.slug, f.title, f.year, f.director,
    fs.prestige_score, fs.discovery_score, fs.total_score,      -- my_room ②정전가 (Phase 1 v2)
    cs.v_value, cs.c_cost, cs.r_risk,                           -- Cinecodex 미학 (두 번째 축)
    cs.panel, cs.prompt_version, cs.flagged, cs.sd_v,
    fr.imdb_rating, fr.imdb_votes, fr.metascore, fr.rt_tomatometer  -- 외부지표 (표시·검증만)
  from public.films f
  left join public.film_scores      fs on fs.film_id = f.id and fs.track = 'all'
  left join public.cinecodex_scores cs on cs.film_id = f.id
       and cs.prompt_version = 'cinecodex-prod-v2'              -- 발표 버전 핀
  left join public.film_ratings     fr on fr.film_id = f.id;
```

설계 메모:
- **이름 매핑 표:** Cinecodex `films`→(없음, `public.films` 재사용) · Cinecodex `film_scores`→**`cinecodex_scores`** · `scoring_runs`→`cc_scoring_runs` · `prompt_versions`→`cc_prompt_versions` · 나머지 `*`→`cc_*`. 발표 집계 테이블만 `cinecodex_` 접두(가시성), 운영계는 `cc_` 접두(잡음 분리).
- **신뢰도 3종 저장 위치:** `sd_v`·`sd_r`(런 노이즈, N>1일 때만 의미) + `panel_disagree`(모델 간) + `flagged`(불리언) → 전부 `cinecodex_scores`에. 원시 표본별 값은 `cc_scoring_runs`에서 재계산 가능(불변 원본 보존).
- **13축 저장 2층:** 원시 = `cc_scoring_runs`(영화×모델×샘플), 집계 = `cinecodex_scores`(median). RUNBOOK §3대로 **median은 13 하위점수 각각** 낸 뒤 V/C/R 계산(V/C/R 먼저 내고 median 금지).
- **RLS:** 발표 테이블/뷰는 `films`와 동일한 공개 읽기 정책 권장. `cc_scoring_runs`·`cc_human_audit`는 내부 전용(service_role)으로 잠글 것. `[⚠COORD: Security/RLS 렌즈]`

---

## ④ ABSORB (적재 · 생성 순서 — 6,000편 파이프라인)

> 출처: `Cinecodex_Execution_Strategy.md` §3 + `Cinecodex_RUNBOOK.md` §0–10. 통일 설정값: **temp=0.6 · B(배치)=8 · 전수 N=1 → 플래그분 N=3 · Sonnet 주력 / Opus 감사 / Haiku 금지.**

**핵심 정정 (RUNBOOK §0 + 실측):** "6,000편 코퍼스 적재"는 **불필요**. my_room `films`에 이미 6,701편(visible 1,935)·`film_ratings`에 imdb/rt/meta가 적재돼 있다. 따라서 ABSORB는 *영화 메타 적재*가 아니라 **채점 대상 선정 → 채점 → 집계**다.

| 단계 | 작업 | 쓰는 테이블 | 비고 |
|---|---|---|---|
| 0 | **대상 선정** `select id,title,year,director from films where ...` | (읽기) `films` | "6,000편" = visible 또는 in_seed_catalog 기준. **범위 결정 필요(OQ-1)** |
| 1 | 프롬프트 동결 — v2/v2-note 텍스트+SHA256 | `cc_prompt_versions` | `[⚠COORD: Display/Method 렌즈]` SHA 산출 1회 |
| 2 | 모델 스냅샷 확정 (`/v1/models`로 정확 문자열) | (로그) | RUNBOOK §8. 자동 업그레이드 금지 |
| 3 | **Pass1** Sonnet N=1, 무작위 B=8, 캐싱+Batch | `cc_scoring_runs` upsert · `cc_batch_jobs` | custom_id=`{film_id}__{pv}__{model}__s{n}` (**film_id=uuid 문자열**) |
| 4 | **집계** median(13축)→V/C/R, sd_v/sd_r, flagged | `cinecodex_scores` upsert · `cc_review_queue` | RUNBOOK §3 의사코드. 플래그 임계 §4 |
| 5 | **Pass2** Sonnet N=3 (near_threshold/high_sd 분) | `cc_scoring_runs`·`cinecodex_scores` 재집계 | ~15% |
| 6 | **Pass3** Opus N=3 (무작위 5% + high_risk/panel_disagree) | 동상 · 갈리면 `cc_review_queue` | note ON = v2-note |
| 7 | **드리프트 게이트** 60편 컨트롤셋 재채점(매 1,000편 묶음 전) | `cc_anchor_controls`·`cc_drift_runs` | ±12 벗어난 비율 >10% → 정지 |
| 8 | (선택) 교차-벤더 300편 → α/상관 | 별도 환경 산출물 | `[⚠COORD] 샌드박스 egress 차단 — 아래` |
| 9 | 공개: `film_objective_panel` 뷰로 대시보드(나란히) + 정전가 상관 1개 | (읽기 뷰) | `[⚠COORD: Display 렌즈]` |

**실행 환경 (어디서 돌리나) — `[⚠COORD]`:** 이 리뷰 작업 샌드박스는 **egress 차단**이라 Anthropic Batch API·`/v1/models`·OMDB/TMDB·교차-벤더 호출이 **여기선 불가**(HANDOFF §9, Strategy §3.8 명시). 채점 파이프라인은 **사용자 로컬/별도 환경**에서 실행해야 한다:
- 후보 A: 사용자 머신에서 Python 러너(이미 `cinecodex_panel_harness.py` 패턴 존재) + `ANTHROPIC_API_KEY` + Supabase service_role로 `cc_scoring_runs` 직삽입.
- 후보 B: Supabase Edge Function(스케줄)에서 Batch 제출/폴링 — 단 Batch는 장시간 비동기라 Edge timeout과 안 맞음 → 큐+폴링 패턴 필요.
- **권고:** 로컬 배치 러너(A)가 단순·견고. egress 있는 곳에서 1회성 대량 작업.

**비용/기간 (Strategy 부록 A, 실측 토큰 기반):** 6,000편 권장 티어드(Pass1+2+3) ≈ **$11**. 전수 Sonnet N=1 캐싱+배치 Pass1만 ≈ **$6**. 절감 레버: 프롬프트 캐싱(입력 90%↓)·Batch(50%↓)·티어드 N·note 생략. **기간:** Batch API는 보통 ~수 시간~24h/잡(비실시간). 6,000편/B=8 = 750 요청 × N — 파일럿 300편 → 전수 확장. 1주차 실측 3종(B 오염·N 임계·플래그 임계) 먼저. 신토크나이저 ~35% 토큰↑ 가능 → 비용 버퍼.

---

## ⑤ CONFLICT · COORD (충돌 목록 + 렌즈 간 조율 플래그)

| # | 충돌 | 해소 | COORD |
|---|---|---|---|
| C-1 | **`films` 이름 충돌** + 키 타입(bigserial↔uuid) | Cinecodex `films` **미채택**, `public.films`(uuid) 재사용. 전 FK uuid화 | — (이 렌즈에서 종결) |
| C-2 | **`film_scores` 이름 충돌** | 집계 테이블 = **`cinecodex_scores`**(별도). my_room `film_scores`(PK film_id 단독, prestige/discovery/total) 불가침 | — |
| C-3 | **외부지표 중복** (Cinecodex `films`의 imdb/rt/meta ↔ `film_ratings`) | Cinecodex `films` 컬럼 제거, **`film_ratings` 단일 소스**. RT는 `rt_tomatometer` 하나(critic/audience 2분할 미존재) | `[⚠COORD: Display 렌즈]` 대시보드가 어느 컬럼을 읽나 |
| C-4 | **canon_score 컬럼** (Cinecodex `films`) ↔ my_room 계보 정전가 | canon_score 컬럼 불필요. 검증용 정전 상관은 `film_scores.prestige_score` 사용 | `[⚠COORD: Method 렌즈]` 정전가-Cinecodex 상관 1개 |
| C-5 | **U/S 미저장 규칙** | Cinecodex(λ 가변)·my_room("표시가 단순") 둘 다 *뷰/앱 계산* → 일치. `cinecodex_scores_ranked` 뷰 | — |
| C-6 | **실행 환경 egress 차단** | 채점은 사용자 로컬/별도 환경. 이 샌드박스 불가 | `[⚠COORD: Ops 렌즈]` 러너 위치·키 관리 |
| C-7 | **RLS/노출** (원시 표본·인간 감사 비공개, 발표 점수 공개) | `cc_scoring_runs`·`cc_human_audit` service_role 전용, `cinecodex_scores`/뷰 공개 읽기 | `[⚠COORD: Security 렌즈]` |
| C-8 | **track 컬럼 오용 유혹** (my_room film_scores에 cinecodex track 끼우기) | 금지 — film_scores PK=film_id 단독이라 다중 track 행 불가. 별도 테이블만 | — |
| C-9 | **프롬프트 버전 2종** (v2 / v2-note 출력 스키마 분기) | `cc_prompt_versions`에 SHA 별도 동결, `cinecodex_scores.prompt_version`로 구분 | `[⚠COORD: Method 렌즈]` |

---

## ⑥ OPEN QUESTIONS

- **OQ-1 (채점 대상 범위):** "6,000편"의 정확한 술어? `films.visible`(1,935)인가, `in_seed_catalog`(default true)인가, 전체 6,701인가? film_scores는 현재 5,985행. **대상 SELECT 술어를 사용자가 확정**해야 적재 단계가 닫힘.
- **OQ-2 (조인 키 영속성):** custom_id에 uuid를 박으면 길어진다(36자×요소). film_id↔short_id 매핑 테이블(또는 tmdb_id 사용)로 custom_id 압축할지? Batch custom_id 길이 제한 확인 필요.
- **OQ-3 (외부지표 신선도):** `film_ratings.fetched_at`이 30일 초과면 "나란히" 표시에 stale caveat 붙일지(Phase 0 불변식 ⑧과 동형 규약)? 누가 갱신하나.
- **OQ-4 (RT 2분할):** Cinecodex 문서는 rt_critic/rt_audience를 가정하나 my_room은 `rt_tomatometer` 하나뿐. audience 점수가 필요하면 `film_ratings` 확장 vs 표시 생략 — Display 렌즈와 협의.
- **OQ-5 (정전가 상관 검증):** 비섞임 검증용 "정전가↔Cinecodex U(또는 V)" 상관 1개를 어느 코호트에서? prestige v2 적용 후(Vertigo 84) 기준이어야 의미 있음 → Phase 1 v2 적용 선행 의존.
- **OQ-6 (드리프트 컨트롤셋 매핑):** 60편 앵커가 my_room `films`에 전부 존재하는가(slug/imdb_id 매칭)? 없는 앵커는 채점만 하고 표시 제외 또는 films에 추가 — Anchor Bank v2 ↔ films 매칭 점검 필요.
- **OQ-7 (재집계 트리거):** Pass2/Pass3 후 `cinecodex_scores` 재집계를 무엇이 부르나(앱 잡 vs Edge Function vs 로컬 러너)? `compute_film_scores()`처럼 RPC화할지.

---

*렌즈 02 결론: Cinecodex는 my_room에 **ADD-only · uuid-조인 · 비섞임**으로 깨끗이 들어간다. 단일 진짜 충돌(이름+키 타입)은 `cinecodex_*`/`cc_*` 네임스페이스 + 전 FK uuid화 + `film_ratings` 외부지표 단일화로 종결. 실행은 egress 있는 사용자 환경에서, 비용 ~$11. DB 미수정 — 전부 제안.*
