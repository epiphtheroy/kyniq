# MetaTake 개인화 — 마스터 인덱스 (Phase 통합 · 최상위 진입점)

> **여기서 시작하라.** 개인화 시스템(영화를 *지적·미학적 자산*으로 운용)의 *구현 설계*를 5개 Phase로 통합한 최상위 문서. 개념 모델(8 엔진)·데이터 현실·기대 순서·Phase별 상세는 각 하위 문서로 링크한다. 작성 2026-06-26. 폴더: `/Users/jerryje/Documents/MetaTake/docs/logic/`. **DB 미수정 — 모든 SQL은 제안(PROPOSED), 적용은 승인 후.**

---

## 0. 네 갈래 참조축 (무엇을 어디서 읽나)

| 축 | 질문 | 문서 |
|---|---|---|
| **개념 모델** | "어떤 엔진들이 있나" (8 코어 엔진) | `00-INDEX.md` + `01`–`08-*.md` |
| **데이터 현실** | "실제로 무엇을 지을 수 있나" (라이브 DB) | `BUILD-ORDER.md` |
| **기대 순서** | "무엇이 먼저 *맞아야* 하나" (least astonishment) | `INTUITION-ORDER.md` |
| **구현 설계** | "Phase별로 어떻게 짓나" (실 컬럼·제안 SQL) | **`phase0`–`phase4-*.md`** ← 본 인덱스가 통합 |

**한 문장:** `INTUITION-ORDER`가 정한 순서대로, `00-INDEX`의 8 엔진을, `BUILD-ORDER`가 확인한 실 DB 위에, `phase0–4`가 *제안 SQL*로 설계한다. 본 문서가 그 5 Phase의 지도·의존·산출물·페이지 영향을 한 장에 모은다.

---

## 1. 5 Phase 척추 (the spine)

각 Phase = *사용자 한 줄 기대* + 닫는 astonishment + 건드리는 엔진 + 핵심 산출물. 순서는 **기대의 강도 × 어겼을 때 파괴력**(난이도 아님).

| Phase | 사용자 기대 | 닫는 astonishment | 엔진 | 핵심 산출물(제안) | 문서 |
|---|---|---|---|---|---|
| **0 · 정합 척추** | "당연한 게 당연하게" | 화면마다 다른 카운트·NaN·평점준 영화가 추천에 뜸 | (횡단 불변식) | `v_user_film`·`me_summary()`·`film_availability()` + 10 불변식 | `phase0-invariants.md` |
| **1 · 내 것이 정확하다** | "내가 본 것·그 값이 맞다" | **명작이 정전가 40**(Vertigo)·Discovery 전부 0 | ②정전가 · ⑦커버리지 | `compute_film_scores()` v2(REPLACE)·`my_lineage_coverage()` | `phase1-standing.md` |
| **2 · 추천이 나를 안다** | "어떻게 알았지? 다 안 본 거네" | 추천이 taste-blind(누구나 같음)·본 영화가 섞임 | ①취향 · ⑥유사 · ⑤WWI | `user_taste_profile`·`film_taste_vector`·`score_watchlist()` v2·`recommend()` | `phase2-taste.md` |
| **3 · 내가 성장한다** | "보면 늘고, 다음 한 편 값이 보인다" | 봤는데 NAV 하락·라틴 0편인데 또 칸 명작 권유 | ⑧NAV · ④공백 | `compute_portfolio_nav()`·`delta_index()`·`my_blind_spots()` | `phase3-growth.md` |
| **4 · 결을 더하는 것** | "오, 이런 것도" (신뢰 비필수) | 완파 축포 2번·새벽에 짝 둘·비공개 유출 | 완파·발굴·podium·동행·프로필 | `fire_lineage_milestones()`·`my_undervalued()`·`my_podium()`·`todays_companion()`·`public_profile_projection()` | `phase4-delight.md` |

**두 기둥:** Phase 1(객관 ②정전가) × Phase 2(주관 ①취향)가 상위 전부의 두 입력. Phase 3·4는 그 위에 성장·결을 얹는다.

---

## 2. 엔진 ↔ Phase 매트릭스 (8 엔진을 어느 Phase가 짓나)

| # | 엔진(00-INDEX) | 짓는 Phase | 상태 |
|---|---|---|---|
| ① | 취향 벡터 | **Phase 2** | 실 임베딩 접지(takes→figures→films, 1536d, 1,941편) |
| ② | 정전가(Standing) | **Phase 1** | 재캘리브레이션 검증완(Vertigo 40→84) |
| ③ | 리니지 관련성 | Phase 2(①소비)·Phase 3 | ①×② 교차 |
| ④ | 공백/희소 | **Phase 3**(절대) + Phase 2 ①(상대) | 절대결핍 검증완(라틴 블라인드) |
| ⑤ | WWI·추천 이유 | **Phase 2**(taste 주입) + Phase 3(Δindex 논거) | 6+가용 이유 정본 |
| ⑥ | 유사·상호추천 | **Phase 2** | `film_affinities`(38,800) 기성 그래프 |
| ⑦ | 커버리지 | **Phase 1** | `my_lineage_coverage()` 단조 보장 |
| ⑧ | NAV·레벨 | **Phase 3** | 축별 단조 증명·콜드스타트 |
| ⑨ | **내재가치(Cinecodex)** | STEP A 설계 ✅ · **채점 완료(6,701편)** | V·C·R·U·S + 미적 단계 · 정전가 옆 두 번째 객관축 · 비섞임 단방향 · `cinecodex` 스키마 · 남음: Pass2·UI |

---

## 3. 적용·의존 순서 (the build sequence)

**엄격한 선행 의존(astonishment 방지):**

```
Phase 0 (척추)  ─ 먼저, 모두가 상속
   │  v_user_film · me_summary · film_availability · 정렬/스케일/계보우주 규약
   ▼
Phase 1 (정전가)  ─ compute_film_scores v2 적용 → select compute_film_scores() (5,985행 재계산)
   │  ⟹ prestige v2 · discovery v2 · my_lineage_coverage()
   ├───────────────┬───────────────────────────┐
   ▼               ▼                           ▼
Phase 2 (취향)   Phase 3 (성장)              Phase 4 §1·§2 (완파·발굴)
  taste blend     NAV/Δindex/blindspot         my_lineage_coverage·prestige v2 소비
  ⟹ user_taste_profile                         │
   │                                           ▼
   └──────────────────────────────────► Phase 4 §4 (동행)  ─ user_taste_profile 필요
```

**못박는 의존 3개:**
1. **Phase 1 Fix-A·B 선적용** — Phase 2 blend의 `canon=prestige`, Phase 3 NAV의 `prestige`·`disc` 축이 v2 정전가에 의존. v1 위에 올리면 옛 명작 보유가 저평가 전파.
2. **`my_lineage_coverage()`(Phase 1)** = 계보 커버리지 단일 소스 → Phase 3 breadth/blindspot·Phase 4 완파가 경유(`list_id` 반환).
3. **`user_taste_profile`(Phase 2)** → Phase 4 동행 싱크율·Phase 3 ④ 상대 under-index가 소비.

---

## 4. 정본 어휘·불변식 (전 Phase 상속 — 단일 정의)

**점수·총량:** **NAV**(영화적 자산 유일 총량, ⑧/P3) · **정전가/Standing**(영화 객관 시장가 = `film_scores.prestige_score`, ②/P1) · **Discovery**(인기 역가중 발굴 축 = `discovery_score`, P1) · **WWI**(후보 적합도, ⑤/P2) · **레벨 밴드**(NAV 코퍼스 백분위).

**핵심 불변식(Phase 0 정본):**

| 불변식 | 정의 | 비고 |
|---|---|---|
| **본 영화 predicate** | `watched := seen IS TRUE OR rating IS NOT NULL` | 평점⟹봤어요. 단일 소스 `v_user_film` |
| **단일 계보 우주 ⑩** | `lineage_lists.status='active' AND film_count>0` | facet `movement·style` 제외(닮음≠품질). P1/P3/P4 공통 |
| **평점 스케일** | 저장 0.5–5 ↔ 내부 0–10(×2, NEUTRAL=6) ↔ ★5 ↔ 0–100(×20) | `rating_pct = rating×20` |
| **가치 뱃지** | `gap = rating_pct − prestige` → find ≥+12 · over ≤−9 · else fit | P1 재캘리 후 신뢰 |
| **안정 정렬** | 모든 ORDER BY 끝에 `film_id`(또는 `slug`/`list_id`) tie-break | 재로드 reshuffle 0 |
| **콜드스타트** | watched 0 → `forming`·null(NaN 금지) | `me_summary.forming` |
| **`forming` 二分** | 포트폴리오 `forming`(watched<8) ≠ **`taste_forming`**(loved<8, P2) | 어휘 충돌 방지 |

**추천 이유 6+가용 정본(⑤, 00-INDEX §4 색):** `safe` 안전자산(teal=taste ①) · `frontier` 안전한 모험(blue=discovery P1) · `canon` 정전 위상(gold=prestige P1) · `gap` 공백 충족(amber=blindspot/Δindex P3) · `conquer` 도장깨기(red=완파 P3·4) · `reading`(violet=framework P2) · (`avail` green = *이유 아님, 필터/가산* = film_availability P0).

**UX 정본(2026-06 직관화 패스 · `docs/ux/SHARED-STANDARD.md`):** 블라인드/공백 색 = **amber `--blind`**(conquer red와 분리 — 빨강=정복, 앰버=미답) · 추천 최상위 1편 명칭 = **「오늘의 한 편」**(부제 `최대 Δ · → NAV +N`) · 가용성 **3-상태**(가능 solid / 미확인 hollow ring / 만료 D-N) · 완파 **4-상태**(잠금<50 · 진행50–74 · 근접75–99 · 완파100 — Phase 4 마일스톤 일치) · **「형성 중」 = 골드**(red 금지).

**Cinecodex 정본(2026-06 통합 · 엔진 ⑨ · `docs/cinecodex/`):** 두 번째 객관 점수 = ②정전가(시장가) + **⑨ Cinecodex(펀더멘털 등급: V 획득가치·C 진입비용·R 위험·U 영화 순가치·S 샤프 + 미적 단계 L1–L10)**.
- **단방향 비섞임(철칙):** `13차원 →(순수) V/C/R/U/S →(출력 소비) WWI·NAV·가치뱃지`. 외부지표·정전가·NAV/WWI를 Cinecodex *공식*에 입력 금지(역류 금지). 상위 엔진은 *출력만* 소비.
- **어휘 스코프 분리(개명):** 「**미적 단계**」(영화, L1–L10) ≠ 「레벨 밴드」(사용자 NAV 백분위) — 영화엔 "레벨" 미사용 · 「**영화 순가치**」(U, 영화) ≠ 「내 NAV」(헤더) · **C 진입비용** = 난이도 단일 소스(≠커버리지) · **S 샤프**(매수 전 효율) ≠ P&L(보유 후) · **POLAR 분열성** + 「분열적 ≠ 파산적」 규칙.
- **WWI 소비:** 품질 prior = **V**(U 아님 — 이중계산 회피) · R = 위험 multiplier/게이트 · λ = 사용자 위험회피 다이얼.
- **색:** 위험 = 신토큰 `--risk`(완파 `--red`와 구분). **표시:** 우리 점수·외부지표·정전가 *나란히 분리 칸*(안 섞음) + 신뢰도/재현성(`SHARED-STANDARD` S11).
- ※ 이전 "정전가 평단-블렌드" 제안은 **폐기** — 정전가는 시장가로 순수 유지, 내재·망작 판정은 ⑨ 전담.

---

## 5. 제안 산출물 매니페스트 (the build manifest — 승인 후 적용)

**뷰 1 · 테이블 5 · RPC ~17.** 전부 PROPOSED, DB 미수정. NEW=신규, REPLACE=기존 교체.

### Phase 0 — 척추 (먼저)
| 산출물 | 종류 | 비고 |
|---|---|---|
| `v_user_film` | VIEW · NEW | `security_invoker` watched predicate 단일 소스 |
| `me_summary()` | RPC · NEW | 단일 카운트(평균은 rated만 분모) |
| `film_availability(film_id, country)` | RPC · NEW | 지역(profiles.country)∩flatrate, 30일 stale |

### Phase 1 — 정전가 (P3/P4 활성화)
| 산출물 | 종류 | 비고 |
|---|---|---|
| `compute_film_scores()` | RPC · **REPLACE v1→v2** | canon 순위-등급 + discovery 인기역가중 + facet 가드. **적용 후 `select compute_film_scores()` 재계산(5,985행)** |
| `my_lineage_coverage()` | RPC · NEW | 커버리지 단일 소스, `list_id` 반환, 단조 |

### Phase 2 — 취향 (P1 의존)
| 산출물 | 종류 | 비고 |
|---|---|---|
| `film_taste_vector` | TABLE · NEW | `vector(1536)` 영화 해석 centroid(takes→figures, 1,941편 적재) |
| `user_taste_profile` | TABLE · NEW | `v_watched·v_loved·anchors·taste_forming` |
| `refresh_taste_profile(uid)` | RPC · NEW | 빌더(dirty/TTL 재계산) |
| `score_watchlist()` | RPC · **REPLACE** | taste 항 주입(taste_forming면 P1 폴백) |
| `recommend()` | RPC · NEW | 후보 확대(film_affinities ∖ watched) + 다양성 + 이유 |

### Phase 3 — 성장 (P1·P0·커버리지 의존)
| 산출물 | 종류 | 비고 |
|---|---|---|
| `compute_portfolio_nav(uid)` | RPC · NEW | 4축·단조·콜드스타트 null |
| `delta_index(uid, film_id)` | RPC · NEW | "→ NAV +N" 한계기여 |
| `my_blind_spots(uid)` | RPC · NEW | 절대 결핍 랭킹("첫 진입") |

### Phase 4 — 결 (§1·§2는 P1, §4는 P2 의존)
| 산출물 | 종류 | 비고 |
|---|---|---|
| `user_lineage_milestone` | TABLE · NEW | PK(uid,list,threshold) 멱등 |
| `fire_lineage_milestones()` | RPC · NEW | `ON CONFLICT DO NOTHING` 축포 1회 |
| `user_podium` | TABLE · NEW | PK(uid,rank)+unique(uid,film) |
| `my_podium()` (+`set/clear`) | RPC · NEW | 순위 안정 표시 |
| `my_undervalued()` | RPC · NEW | 발굴 정렬(rating≥3.5 게이트) |
| `todays_companion()` | RPC · NEW | KST 자정 결정적 페어(user_taste_profile 필요) |
| `public_profile_projection()` + 커버리지 공개판 | RPC · NEW | 화이트리스트 게이팅 |

---

## 6. 페이지 → Phase·엔진·RPC 지도 (다음 단계 = HTML 정렬용)

라이브 목업 10개. 각 행의 **정렬 포인트** = HTML을 실 로직에 맞출 때 고칠 곳.

| 페이지(목업) | 보여주는 것 | 엔진/Phase | 먹는 RPC(제안) | HTML 정렬 포인트 |
|---|---|---|---|---|
| **기록** `onboard-rate-v2` | 평가→이웃 fly-in · 별점 | ⑥·①(P2) | `recommend`·`film_affinities`·`v_user_film` | 별점 0.5–5 half-star · 평점⟹봤어요 표기 · 이웃=affinities |
| **현황** `command-center` | NAV/레벨 · 커버리지 바 · 블라인드 · 포지셔닝 · 추천 · 별자리 | ⑧⑦④②⑤⑥ (P1·2·3) | `compute_portfolio_nav`·`my_lineage_coverage`·`my_blind_spots`·`score_watchlist` | NAV 콜드스타트 "형성 중" · 레벨 코퍼스<30 미표시 · 커버리지 단조 · 블라인드 "첫 진입" |
| **운용** `asset-desk` | 추천 데스크 5전략 · NAV/P&L/적중률 · Reading·완파 | ⑤⑧④②(P1·2·3·4) | `recommend`·`compute_portfolio_nav`·`delta_index`·`fire_lineage_milestones` | 이유=6taxonomy 색 · "→NAV +N" · P&L은 NAV 안 깎음(저평점만 regret) |
| **분석** `analysis-v2` | 리니지 관련성 · 축 커버리지 · 상호추천 그래프 · 렌즈/형상 | ③⑦⑥①(P2) | `my_lineage_coverage`·`film_affinities`·`user_taste_profile`(anchors) | 앵커=meta_takes(figure_type/reading) · 커버리지 facet |
| **보유** `collection-list-v2` | 정전가(가격)+가치뱃지 · 3전략 추천 | ②⑤①⑦(P1·2) | `film_scores`(prestige v2)·`my_undervalued`·`score_watchlist` | 정전가=Fix-A값(Vertigo 84) · 가치뱃지 gap=rating_pct−prestige · 발굴 rating≥3.5 |
| **볼 영화** `watchlist` | WWI·이유 스택 · Δindex · 후보 · 가용성 | ⑤⑧⑥+가용(P0·2·3) | `score_watchlist` v2·`delta_index`·`film_availability` | WWI=taste blend · 이유 6taxonomy · "→NAV +N" · 지역 flatrate·stale caveat |
| **서재** `library` | 저장/공개 · 폴더 | (의존 약함) | `v_user_film`·`user_pins` | visibility public/private · seen/watchlist 배타 |
| **노트** `write` | take 작성 · figure/trope | ① 기여(P2) | `takes`(author_id=내)·`figures` | 내가 쓴 take = boost ×1.5 + 임베딩 직접 가산 |
| **동행** `pair` | 싱크율 · 가면무도회 | 동행(P4)·①(P2) | `todays_companion`·`user_taste_profile` | 싱크율=v_loved 코사인 · taste_forming면 "형성 중" · KST 자정 회전 · 교집합 앵커만 |
| **공개 프로필** `profile` | 커버리지 · 레벨 · 정전 뱃지 · 리니지 | ⑦⑧②③(P3·4) | `public_profile_projection`·커버리지 공개판 | 화이트리스트(트로프·실명·개별평점 금지) · portfolio_public 게이트 |

(아카이브: `mockup-archive/`의 onboard-rate·analysis·collection-list v1은 은퇴 — 정렬 대상 아님.)

---

## 7. 횡단 관심사 (8 엔진·5 Phase 공통)

**설명가능성** — 모든 점수는 `components`/`nav_components`/`anchors`로 분해 보존("왜 이 값?" 한 줄 응답 못 하면 출시 금지). **콜드스타트** — 라이브가 0~1편이 기본이라 *주 경로*(NaN 0건이 척추). **캘리브레이션** — δ·C·가중·임계는 *코퍼스 튜닝* 가설, 형태만 고정. **갱신/캐싱** — `film_scores`·`user_taste_profile` 머티리얼라이즈 + dirty/TTL. **반-게이밍** — 무차별 시청·평점 인플레는 한계기여 0 수렴·분포 상대화로 방어. **편향 보정** — 서구·정전 편중을 Discovery·selectivity가 상쇄.

---

## 8. 다음 단계 — HTML 정렬

이 인덱스 → 목업 정렬: §6 지도의 *정렬 포인트*대로 10개 `mockup-me-*.html`을 실 로직 어휘·수치 규약에 맞춘다. 우선순위(파괴력 순): **보유(정전가 Fix-A값)·현황(NAV 콜드스타트·커버리지)·볼 영화(WWI 이유 6taxonomy)** → 운용·분석 → 동행·프로필 → 기록·서재·노트. 각 페이지는 §4 정본 어휘(정전가·NAV·WWI·이유 색·별점 스케일)와 §5 RPC 산출 형태를 단일 소스로 따른다.

---

*마스터 인덱스 = 4 참조축(개념·데이터·기대·구현)을 5 Phase 척추로 묶고, 제안 산출물·페이지 영향까지 한 장에. 두 기둥(①주관×②객관) 위에 ⑦⑥이 받치고 ③④가 교차하며 ⑤추천·⑧자산이 정점을 이루는 하나의 운영체계 — 그 전부가 실 DB 컬럼 위에 설계됨(DB 미수정).*
