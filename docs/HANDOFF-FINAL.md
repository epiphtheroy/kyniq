# MetaTake · my_room — 최종 인수인계 (FINAL HANDOFF)

> **이 문서 하나로** 다른 AI/엔지니어가 프로젝트의 *목적·설계·계산법·파일 위치·DB 현황·다음 작업*을 이어받는다. 작성 2026-07-01. 기준 경로 `/Users/jerryje/Documents/MetaTake/`. Supabase 프로젝트 `jvgarcqrtsmgfimdcwgo`(name kyniq). 배포 `https://metatake.net/my_room`.
>
> **읽는 순서:** §1 미션 → §2 전체 지도 → §3 계산법(공식 총람) → §4 엔진별 설계 → §5 Cinecodex(신규 완료) → §6 UX 설계 → §7 파일 지도 → §8 DB 현황 → §9 상태·다음 → §10 원칙.

---

## 1. 무엇을 · 왜 (미션)

**문제.** 많은 사람이 좋은 영화를 보고 싶지만 *실패(시간 낭비)가 두려워* 열지 못한다. 그리고 자기가 본 영화들이 *무엇인지·어디에 있는지* 잃어버린다.

**해결(한 문장).** 영화를 **지적·미학적 자산**으로 다루는 *개인 운영체계(OS)* — 내가 본 영화를 포트폴리오처럼 운용하고, 다음 한 편을 *나에게 맞고(개인) + 그 자체로 좋고 위험이 낮은(객관)* 것으로 고른다. "Bloomberg for cinema."

**두 축.**
- **개인화(내게 맞나):** 취향 벡터①로 "이 영화가 나와 통하나"를 잰다.
- **객관 평가(영화 자체):** 두 개의 객관 점수 — **정전가②**(세상이 인정했나 = *시장가*) + **Cinecodex⑨**(작품이 무엇을 돌려주고 얼마나 위험한가 = *펀더멘털 애널리스트 등급*).

**왜 이 형태인가.** 자산 메타포는 은유가 아니라 *운영 논리*다: 본 영화=포트폴리오, 볼 영화=파이프라인, 유한한 관람 생애=자본, 정전가=가격, Cinecodex U/R=순가치/위험등급, NAV=총자산, WWI=매수 적합도. 이 격자가 "무엇을·왜·다음"을 일관되게 답한다.

---

## 2. 시스템 전체 지도

```
개인(주관)                    객관(만인 공통)
 ①취향벡터 ──fit──┐      ┌── ②정전가(Standing) = 시장가 (계보·수상 인정)
                 │      └── ⑨Cinecodex        = 펀더멘털 등급 (V·C·R·U·S)
   ⑥유사(affinity)·⑦커버리지가 받치고
   ③리니지 관련성·④공백이 교차하고
   ⑤WWI(추천)·⑧NAV(자산)이 정점.
```

**9 코어 엔진** (개념 모델 = `docs/logic/00-INDEX.md`):
①취향벡터 ②정전가 ③리니지관련성 ④공백/블라인드 ⑤WWI·추천 ⑥유사/상호추천 ⑦커버리지 ⑧NAV·레벨 **⑨내재가치(Cinecodex)**.

**5 Phase** (구현 순서 = `docs/logic/MASTER-INDEX.md`, `INTUITION-ORDER.md`):
Phase 0 정합 척추 → 1 정전가(내 것이 정확) → 2 취향(추천이 나를 앎) → 3 성장(NAV·성장) → 4 결(완파·발굴·동행·프로필). + Cinecodex STEP A(원칙·문서 정합, 완료) / STEP B(채점·UI).

**10 페이지**(다크 운영 셸 9 + 라이트 공개 프로필 1) — §6·§7.

---

## 3. 계산법 (모든 공식 한곳)

> 상수는 캘리브레이션 가설, *형태*가 정본. 모든 점수는 `components`로 분해 보존(설명가능성). 반올림·스케일·정렬·콜드스타트는 Phase 0 불변식.

**정전가 (②, `phase1-standing.md`) — Fix-A.** 영화의 계보 등재 한 줄마다 기여 `c`:
```
canon:  c = aw × (0.45 + 0.50 × pos_norm)      pos_norm = 1−(rank−1)/(rank_max−1)   (1위→aw×0.95, 바닥→aw×0.45)
award/national/section: c = aw × f_result       (won 1.0·runner-up 0.6·nominated/listed 0.45·selected 0.30)
auteur: c = aw × 0.6
raw = Σ c·0.6^(k−1)  (c 내림차순 k)      정전가 = min(100, round(100·raw/2.42, 1))
facet 범위: canon·award·national·auteur·festival·section (movement·style 제외)
```
*왜:* v1은 canon 등재를 `listed=0.45` 고정으로 깎아 Vertigo=40(수상 없는 옛 명작 저평가). Fix-A는 순위-등급 곡선으로 정전 정점을 수상급으로 인정 → **Vertigo 40→84** 등 시간 편향 제거.

**Discovery (②, Fix-B).** `discovery = prestige × (1 − pop_norm)`, `pop_norm = clamp((log10(imdb_votes)−2.5)/3.5, 0,1)`. *왜:* 인정 높은데 덜 알려진 영화(발굴)를 별도 축으로. 가격엔 안 섞음.

**가치 뱃지 (Phase 0 ③·I).** `gap = rating_pct − 정전가` (`rating_pct = ★×20`). find ≥ +12 · over ≤ −9 · else fit. *왜:* "내가 시장보다 높이/낮게 보나"를 직관화. + 2축(별점 vs Cinecodex V, 엔진 ⑨).

**커버리지 (⑦, `phase1-standing.md`).** 라인별 `watched / film_count`. 단조(영화 더 보면 % 비감소). 계보 우주 = `status='active' AND film_count>0`.

**NAV (⑧, `phase3-growth.md`).** `NAV = round(100·(0.35·breadth + 0.35·prestige + 0.20·depth + 0.10·disc)/C)`
```
breadth = Σ aw·watched_in(line)      (라인당 1회 → 부피 면역)
prestige= Σ prestige(f_k)·0.85^(k−1)  (내림차순)
depth   = Σ max(0, rating10−6)/4      (★3 초과분만 → 저평점 0 기여, 인플레 방어)
disc    = Σ discovery(g_k)·0.85^(k−1)
```
*핵심:* **단조** — 영화를 더 봐도 NAV 절대 안 내려감(관람은 처벌 안 함). 저평점은 P&L regret에만, NAV엔 미반영. 콜드스타트(<8편) → null·"형성 중".

**Δindex (⑧).** `NAV(F∪{f}) − NAV(F)` ≈ 새로 여는 라인의 authority 합. *왜:* 공백 메우는 영화의 "+N"이 포화 영역 고권위작보다 커야 함(체감효용 감소를 구조에).

**취향 벡터 (①, `phase2-taste.md`).** `v_film = normalize(avg(takes.embedding via figures.film_id))` (1536d). `v_loved = normalize(Σ w(f)·v_film)`, `w = max(0, rating10−6)·recency·boost`. 앵커 = meta_takes(figure_type·reading) 코사인 상위. `taste_forming` = loved<8. *왜:* 장르가 아니라 *해석 시그니처*로 취향을 잡음(Vertigo→Psycho·Mulholland Drive 이웃 검증됨).

**WWI (⑤, `phase2-taste.md` §7).** `WWI = round(w_t·taste + w_l·lineage + w_g·gap + w_c·canon) × risk_mult` (`taste_forming`이면 taste-blind 폴백). 이유 = 6+가용 정본(safe·frontier·canon·gap·conquer·reading·avail). **Cinecodex 소비:** 품질 prior = V, 위험 필터 = `risk_mult = clamp(1−ρR, floor, 1)`(곱셈, 합산 아님), U = 후보 게이트, λ = 위험회피 다이얼. 단방향(역류 금지).

**Cinecodex (⑨, `09-intrinsic-cinecodex.md`).** LLM이 13차원(0–100) 채점 → 3축:
```
V 획득가치 = (COG+AFF+FORM+MORAL+DUR)/5
C 진입비용 = (ITX+FR+ETX+CTX)/4
R 위험도   = 0.6·((BANK+INSINCERE+COWARD)/3) + 0.4·POLAR
U 영화순가치= V − λ·R      S 샤프 = (V−50)/max(R,1)
집계: 영화별 N 샘플의 서브점수별 median → 그 13 median에서 V/C/R.
```
*왜:* 정전가(인정)는 저야망(배트맨)과 분열적 실패(바빌론)를 구분 못 하고 시간 편향이 있다. Cinecodex는 *작품 자체*를 분해해 **망작·실망 위험(R)**을 잡는다. 외부지표·정전가를 공식에 절대 안 넣음(비섞임 단방향).

---

## 4. 엔진별 설계 — 무엇 / 왜 / 어떻게

| # | 엔진 | 무엇 | 왜 이렇게 | 문서 |
|---|---|---|---|---|
| ① | 취향 벡터 | *어떤 시네필인지*를 1536d 한 점 + 앵커 | 장르 아닌 *해석 시그니처*가 차별점(Letterboxd와 다름). take 임베딩이 1차 재료 | `01-taste-vector.md`·`phase2-taste.md` |
| ② | 정전가 | 계보·수상 인정의 가중합(시장가) | 순위-등급 곡선으로 시간 편향 제거(Fix-A). 대중성 배제 | `02-standing.md`·`phase1-standing.md` |
| ③ | 리니지 관련성 | "나에게 맞는 계보" 랭킹 | ①×② 첫 교차. 취향·커버리지로 계보를 개인화 | `03-lineage-relevance.md` |
| ④ | 공백/블라인드 | 안 가본 권위 계보(첫 진입) | 절대 결핍은 ②⑦만으로, 상대 under-index는 ① 소비 | `04-gap.md`·`phase3-growth.md` |
| ⑤ | WWI·추천 | 후보의 나에게 맞는 정도 + 위험 | taste=fit(①)·품질/위험=⑨·인정=②를 블렌드×위험. 6이유 | `05-wwi.md`·`phase2-taste.md` |
| ⑥ | 유사/상호추천 | 영화↔영화·감독↔감독 그래프 | `film_affinities`(38,800) 기성 그래프. 후보 생성 | `06-similarity.md` |
| ⑦ | 커버리지 | 라인별 몇 % 봤나 (단조) | "많이 본 게 위", 영화 더 봐도 안 내려감 | `07-coverage.md`·`phase1-standing.md` |
| ⑧ | NAV·레벨 | 포트폴리오 총자산 + 레벨 밴드 | 4축, **단조**(관람 처벌 금지), 저평점만 P&L | `08-nav-level.md`·`phase3-growth.md` |
| ⑨ | **내재가치 Cinecodex** | 영화 펀더멘털 등급 V·C·R·U·S | 정전가가 못 잡는 *망작·위험*을 LLM 13차원 분해로. 비섞임 단방향 | `09-intrinsic-cinecodex.md`·`docs/cinecodex/` |

---

## 5. Cinecodex — 신규 완료 (2026-07-01)

**정체.** 정전가 옆 *두 번째 객관 점수*. LLM(Sonnet)이 8개 앵커가 박힌 동결 프롬프트로 13 미학 차원을 채점 → V(획득가치)·C(진입비용)·R(위험)·U(순가치=V−λR)·S(샤프). 어휘 정본: 「미적 단계」(≠사용자 레벨밴드)·「영화 순가치」U(≠NAV)·C 진입비용·S 샤프·POLAR 분열성.

**채점 현황(실측).** **6,701편 전부 Pass1 N=1 완료**(`cinecodex.scores`, panel `sonnet-n1`, prompt `cinecodex-prod-v2`, temp 0.6, B=8). 분포 V med 60·R med 23·C avg 34. **flagged 4,289**(N=1이라 sd 미측정 → Pass2 N=3 권장).

**검증(핵심 증명).** 밀양 V84.6/R12.8/U71.8 ≫ 어벤져스 V36.6/U3.6. **Babylon R=50.8(최고)** — V는 55(중간)지만 *분열적 실패*를 R이 포착 = "망작 거르기"의 정답. Tokyo Story U86·S6.0(가장 안전한 걸작). (표: `09-intrinsic §6b`.)

**파이프라인.** `score/cinecodex_score.py`(로컬 Mac 실행 — 샌드박스 egress 차단). Anthropic Messages API + 프롬프트 캐싱 + 스레드풀, resumable. RPC로 Supabase 적재: `cinecodex_freeze_prompt`→`cinecodex_targets`→`cinecodex_write_runs`→`cinecodex_aggregate`. 비용 ~$11(실측 티어). 재실행 = 신규작만.

**통합 원칙(비섞임 단방향).** `13차원 →(순수) V/C/R/U/S →(출력 소비) ⑤WWI·⑧NAV·가치뱃지`. 외부지표·정전가·NAV/WWI를 Cinecodex 공식에 입력 금지. 상위 엔진은 출력만 소비. 표시는 *나란히 분리 칸*(우리/외부/정전) + 신뢰도(SHARED-STANDARD S11). 검토 상세: `docs/cinecodex/INTEGRATION-CONSOLIDATED.md`.

---

## 6. UX·디자인 결정 — 무엇 / 왜

**운영시스템 셸(다크, 4단 접이).** 좌 네비 레일 · 중앙 워크스페이스 · 우 인스펙터(클릭→상세) · 극우 라이브 피드. 각 접이식(localStorage 공유) + ⌘K 팔레트. *왜:* "최첨단 고객관리/트레이딩 데스크" 인상 + 정보 밀도. 정본 셸 = `mockup-me-command-center.html`. 공개 프로필만 *라이트 쇼케이스*(공개/비공개 대비).

**직관화(사용자 눈·손·클릭).** 12 조율 클러스터로 전 페이지 정합(`docs/ux/CONFLICTS-AND-COORDINATION.md`, `SHARED-STANDARD.md`): 인라인 별점·담기/봤어요, 「오늘의 한 편」 명칭, 블라인드=amber(완파 red와 분리), 가용성 3상태, 완파 4상태, 용어집 툴팁, 공개 토글 pill, 위험=`--risk` 색.

**Cinecodex 표시(S11).** 우리 점수·외부지표·정전가 *분리 칸*(안 섞음) + 신뢰도 흐림(단 분열적≠불신뢰) + 재현성 카드 + 미평가 빈 상태 + 공개 프로필 노출 금지(13서브·신뢰도·prompt_sha).

**신규 UI(STEP B, 점수 생겼으니 활성 가능):** 영화별 「Cinecodex 평가 카드」(3축·U/S·미적 단계·13서브·비교작·나란히·신뢰도) · μ–σ 평면(V×R) · watchlist 위험 배지/필터. 설계: `docs/cinecodex/04-ux-pages.md`.

---

## 7. 파일 지도 (전부)

**로직 설계 `docs/logic/`**
- `00-INDEX.md` 8+1 엔진 개념 모델 · `MASTER-INDEX.md` 최상위 진입(5 Phase·매니페스트·페이지 지도·정본 어휘)
- `01`~`08-*.md` 엔진 명세 · **`09-intrinsic-cinecodex.md`** 내재가치 · `LOGIC-SPEC-FULL.md` 합본
- `BUILD-ORDER.md`(데이터 현실) · `INTUITION-ORDER.md`(예측가능성·Contract A–K)
- `phase0-invariants.md`(불변식 ①–⑪) · `phase1-standing.md` · `phase2-taste.md` · `phase3-growth.md` · `phase4-delight.md`

**UX `docs/ux/`**
- `00-UX-REVIEW-GUIDE.md` · `SHARED-STANDARD.md`(S1–S11 정본) · `CONFLICTS-AND-COORDINATION.md`(12 클러스터)
- `<page>.md` ×10 (페이지별 UX 발견 + 표준 적용)

**Cinecodex 통합 검토 `docs/cinecodex/`**
- `INTEGRATION-CONSOLIDATED.md`(총합 의견) · `01-concept-engines`·`02-data-pipeline`·`03-recommendation-risk`·`04-ux-pages`·`05-principle-vocab-conflicts.md`

**Cinecodex 원천 `score/`** (채점 시스템 그 자체)
- `Cinecodex_HANDOFF.md`(원 인수인계) · `cinecodex_score.py`(러너) · `run-cinecodex-*.command`(더블클릭 실행) · `PROMPT_PRODUCTION_v2.txt`(동결 프롬프트) · `cinecodex_schema.sql` · `Cinecodex_RUNBOOK.md` · `Cinecodex_Execution_Strategy.md`
- `Cinecodex_Anchor_Bank_v2.md`(520 앵커) · `CInecodex_Score.md`(10레벨+3지수 프레임) · `Cinecodex_지수_설계와_검증.md` · `Cinecodex_Conclusions_Display_and_Reliability.md` · `cinecodex_run1~3/`(검증 런) · `cinecodex_panel_harness.py`

**목업(HTML) — 루트 `mockup-me-*.html` ×10**
- 현황 `command-center` · 보유 `collection-list-v2` · 볼영화 `watchlist` · 운용 `asset-desk` · 분석 `analysis-v2` · 기록 `onboard-rate-v2` · 서재 `library` · 노트 `write` · 동행 `pair` · 공개 `profile`
- `mockup-archive/`: 버전 백업(-v1 프리셸 · -preux · -std)

**배포 `my_room/`** = 10 목업 + `index.html`(→커맨드센터). `https://metatake.net/my_room`. (사용자 프로덕션 `kyniq`와 분리.)

**기타 상위 문서 `docs/`**: `PLAN-personalization-portfolio.md`(초기 기획+DB 정합) · `SUITE-AUDIT-personalization.md`(어휘 감사) · `HANDOFF-MASTER-personalization.md`(스위트 인수인계) · **`HANDOFF-FINAL.md`(이 문서)**.

---

## 8. DB 현황 (Supabase `jvgarcqrtsmgfimdcwgo`)

**`public` 스키마 (실재 데이터):**
- `films`(id uuid·slug·title·year·director·genres[]·tmdb_extra·visible[1,935]·in_seed_catalog / 총 6,701) · `film_scores`(prestige_score·discovery_score·total_score·components / 5,985 — **모델 v1, Fix-A 미적용**) · `film_ratings`(imdb/metascore/rt_tomatometer / 6,606)
- `film_lineage`·`lineage_lists`(facet·authority_weight·selectivity·film_count / 399 active)·`lineage_editions`(rank_max) · `film_affinities`(38,800) · `film_next`·`director_next`·`meta_take_edges`
- `takes`(73,478 embedded)·`figures`(18,168 embedded)·`meta_takes`(figure_type·reading) · `user_movies`(rating 0.5–5·seen·watchlist·visibility)·`profiles`(portfolio_public·country)
- 기존 RPC: `compute_film_scores`·`score_watchlist`·`portfolio_breakdown`·`public_portfolio`·`lineage_*`·`home_*`

**`cinecodex` 스키마 (신규, 채점 완료):**
- `scores`(6,701 · 13 median + v_value·c_cost·r_risk + 신뢰도·flagged) · `scoring_runs`(6,701 원시) · `prompt_versions`(동결) · `review_queue` · `drift_runs` · `anchor_controls` · `human_audit` · `batch_jobs`
- RPC: `cinecodex_freeze_prompt`·`cinecodex_targets`·`cinecodex_write_runs`·`cinecodex_aggregate`

**⚠ 제안 상태(미적용) — 승인 후 마이그레이션:** Phase 0–4의 뷰·RPC·테이블(`v_user_film`·`me_summary`·`film_availability`·`compute_film_scores` **v2(Fix-A)**·`my_lineage_coverage`·`user_taste_profile`·`film_taste_vector`·`score_watchlist` v2·`recommend`·`compute_portfolio_nav`·`delta_index`·`my_blind_spots`·완파/podium/동행/공개투영 + `rate_film`/`add_watchlist`/`mark_watched`/`dismiss_candidate`/`set_visibility`). 매니페스트: `MASTER-INDEX §5`. **DB는 설계 참고용 — 지금까지 public은 미수정(cinecodex 스키마만 사용자가 적재).**

---

## 9. 상태 · 다음

**완료.** 9 엔진 설계 · 5 Phase 로직(제안 SQL) · 10 페이지 운영시스템 셸 + 직관화 + 표준 정합 · my_room 배포 · Cinecodex STEP A(원칙·문서 정합) · **Cinecodex 6,701편 채점(Pass1)**.

**다음(우선순위).**
1. **정전가 Fix-A 적용** — `compute_film_scores` v2 교체 후 재계산(현 public은 v1: Vertigo 40). 이게 NAV·가치뱃지·WWI canon의 선행.
2. **Cinecodex Pass2** — flagged 4,289편 N=3 재채점(신뢰도) + (선택) Opus 감사.
3. **STEP B UI** — 평가 카드·μ–σ·watchlist 위험 배지(점수 생겼으니 가능).
4. **Phase 0–2 RPC 적용** — 승인 후 `v_user_film`·`me_summary`·`user_taste_profile`·`score_watchlist` v2(taste+risk) 등.
5. **검증** — 정전가↔Cinecodex 상관 1개, 인간 감사 α.

**의존 잠금:** Fix-A 먼저(NAV·blend·가치뱃지 선행) · 취향벡터(Phase 2) 먼저(동행·상대 공백) · Cinecodex 점수(완료)가 WWI 위험·평가카드 선행.

---

## 10. 원칙 (철학 — 무엇을 어겨선 안 되나)

1. **예측가능성(least astonishment)** — 로직은 숨기고 결과는 기대를 배신 안 함. 작은 정합 로직(본 것=본 것·같은 수=같은 수·안정 정렬)이 화려한 추천보다 먼저(`INTUITION-ORDER.md`).
2. **비섞임 단방향(Cinecodex)** — 산출은 순수(외부·정전가 입력 금지), 상위 엔진은 출력만 소비. 역류 금지.
3. **설명가능성** — 모든 점수는 `components`로 분해. "왜 이 값?"에 한 줄로 답 못하면 출시 금지.
4. **단조·비처벌** — 관람은 NAV를 절대 안 깎음. 저평점만 P&L regret.
5. **개인 × 객관 분리** — fit(①)·인정(②)·내재(⑨)는 다른 질문. 한 숫자로 뭉치지 않음(나란히 표시).
6. **콜드스타트** — 0편·미평가에도 NaN 0, "형성 중"/"미평가"로 정직.
7. **DB 존중** — public은 설계 참고용, 변경은 제안→승인. (Cinecodex는 격리 스키마.)

---

*MetaTake my_room = 영화를 자산으로 운용하는 개인 OS. 개인(취향)과 두 객관(정전가=시장가 · Cinecodex=펀더멘털 등급)을 한 격자에 세우고, 예측가능성·비섞임·단조·설명가능성을 지키며, 6,701편의 미학 등급까지 실측으로 확보했다. 남은 것은 제안 SQL의 적용과 STEP B UI — 이 문서가 그 지도다.*
