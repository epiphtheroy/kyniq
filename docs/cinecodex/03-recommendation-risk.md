# Cinecodex × MetaTake — 03 · 추천·위험 통합 렌즈 (REVIEW)

> **REVIEW-ONLY.** 이 문서는 *제안*이다. DB·파일·HTML 미수정. 모든 SQL/공식은 PROPOSED.
> 렌즈: **추천 × 위험 통합.** Cinecodex의 미션(위험·실망작 거르기)은 곧 추천 문제 그 자체 → R/U/S가 WWI·추천을 어떻게 바꾸나.
> 읽은 정본: Cinecodex(`HANDOFF`·`지수_설계와_검증`·`Conclusions_Display_and_Reliability`·`cinecodex_schema.sql`) · my_room(`MASTER-INDEX`·`phase2-taste`·`phase3-growth`·`05-wwi`·`04-gap`·`02-standing`).
> 작성 2026-06-30. 시리즈 03 (01·02는 미작성). 페이지 영향: watchlist · asset-desk · collection · command-center.

---

## ① 요약 (한 화면)

**핵심 명제: 취향 적합(fit)은 ①이, 품질·위험(quality·risk)은 Cinecodex가 댄다. WWI는 둘을 곱해 결정한다.**

지금의 WWI는 6이유 가중합인데, 그중 *품질 prior*는 `canon`(②정전가) 하나뿐이고 **위험(실망 가능성)은 어디에도 없다.** 이게 정확히 Cinecodex가 메우는 구멍이다. Cinecodex는 영화 1편당 **V(획득가치)·R(위험도)·U=V−λR·S=샤프**를 제공하고, 그 미션이 *"실망작 거르기"*다. 따라서:

- **WWI는 Cinecodex U를 *품질 prior*로, R을 *위험 필터/감점*로 소비**한다. taste(①)는 *나에게 맞나*, U/R(Cinecodex)는 *애초에 볼 가치가 있나·실패하나*. 두 질문은 직교하므로 **곱(게이트)으로 결합**하지 합산으로 섞지 않는다.
- **두 정렬을 한 데스크에서:** **U = 만인 공통 품질 게이트**(객관, 하한 컷·고위험 자동 강등), **WWI = 개인 재정렬**(주관). U가 바닥을 깔고, WWI가 그 위에서 순서를 정한다.
- **λ 위험회피 다이얼 = 사용자 컨트롤**(보수적 λ↑ ↔ 모험적 λ↓). 이건 WWI의 기존 *Affinity↔Discovery 슬라이더(t)*와 **다른 축**이다 — t는 "익숙↔새로움", λ는 "안전↔도박". 둘 다 둔다(2-노브).
- **가치뱃지 확장:** 기존 (내 별점 vs ②정전가) 1축에 **(내 별점 vs Cinecodex V) 둘째 축**을 더한다 — *대중/제도 합치*와 *분석적 합치*를 분리.
- **추천 6이유에 위험을 추가**하되 7번째 이유 칸이 아니라 **카드 전역 *경고 배지*(risk pill)**로. 이유는 "왜 봐야 하나"(가산), 위험은 "왜 망설여야 하나"(감산) — 톤을 분리.

**비섞임 원칙 준수:** Cinecodex 점수는 *소비*만 한다 — V/R/U/S를 *읽어서* WWI 게이트·정렬·배지에 쓰되, **MetaTake의 ②정전가·①취향을 Cinecodex 공식에 역주입하지 않는다.** 두 객관 점수(②정전가 = 제도/시장가, Cinecodex = 분석가)는 *나란히* 산다. (`[⚠COORD-1]`)

---

## ② MODIFY (기존 산출물 수정 제안)

### M1 · WWI 공식 — Cinecodex U를 품질 prior로, R을 위험 필터로 주입
**대상:** `05-wwi.md` §5 / `phase2-taste.md` §7(a) `score_watchlist()` v2.
**현재:** `WWI = Σ w_r·s_r` (6이유), 품질 prior = `canon`(②) 단독, 위험항 0.
**제안 — 게이트 형식(섞지 않고 곱한다):**
```
# 1) 품질 prior 확장: canon 이유를 "이중 객관"으로
s_canon   = ②.standing_백분위(f)                      # 제도/시장가 (기존)
s_quality = norm( Cinecodex.U(f, λ) )                  # 분석가 순가치 U=V−λR (NEW, λ=사용자 다이얼)
# canon 이유 = 두 객관의 가중평균(설명가능성 위해 분해 보존):
s_canon'  = κ·s_canon + (1−κ)·s_quality               # κ≈0.5 가설, 두 출처 명시 표기

# 2) 위험은 가중합에 넣지 않고 *후처리 감점/게이트*로 (실망작 거르기)
risk_mult(f) = clamp( 1 − ρ·R̂(f), floor, 1 )           # R̂=Cinecodex R 정규화 0..1, ρ≈0.5, floor≈0.5
WWI(f)    = 100 · ( Σ_r w_r·s_r / Σ w_r ) · risk_mult(f)   # 위험이 적합도를 *깎는다*
```
**근거:** Cinecodex 미션이 "실망작 거르기"인데 현 WWI엔 위험항이 0이라, 취향엔 맞지만 *분열적으로 실패하는* 야심작(바빌론형)을 거를 수가 없다. `risk_mult`가 그걸 자동 감점한다. **floor를 두는 이유:** 고위험을 0으로 죽이지 않는다 — λ가 낮은(모험) 사용자에겐 고위험-고수익이 *상품*이다(§ADD A2 참조). κ로 두 객관(②/Cinecodex)을 명시 분해해 "왜 canon 점수가 이런가"를 한 줄로 답한다.
**콜드스타트:** `taste_forming`이면 taste 항이 죽는다 — 이때 `s_quality`(Cinecodex U)가 **canon 폴백을 강화**한다(②정전가 단독보다 위험-조정된 U가 더 안전한 폴백). "데이터 없으면 모두에게 옳은 영화" 원칙(05-wwi §4-g)과 정합하되, *위험까지 조정된* 모두에게 옳은 영화.

### M2 · 가치뱃지 — 둘째 축(별점 vs Cinecodex V) 추가
**대상:** `02-standing.md` §4(j) · `MASTER-INDEX` §4 가치뱃지 불변식 · collection.
**현재:** `gap = rating_pct − prestige` → find(≥+12)/over(≤−9)/fit. **1축**(별점 vs ②정전가).
**제안 — 2축 뱃지:**
```
gap_canon = rating_pct − ②prestige          # 기존: 제도/시장 대비 내 평가 (대중·정전 합치/이탈)
gap_value = rating_pct − Cinecodex.V         # NEW: 분석적 획득가치 대비 내 평가 (분석 합치/이탈)
```
| 두 축의 부호 조합 | 의미(보유작 사후 평가) |
|---|---|
| 별점↑ · V↑ · 정전가↓ | **숨은 보석 검증** — 정전은 낮지만 나도 Cinecodex도 높게 본다 |
| 별점↑ · V↓ · 정전가↑ | **길티 플레저** — 제도는 높이 쳐도 분석적 획득가치는 낮음(내가 즐겼을 뿐) |
| 별점↓ · V↑ | **놓친 깊이** — 분석은 높은데 내가 낮게 줌(재관람 후보) |
| 별점↑ · V↓ · 정전가↓ | **순수 오락** — 둘 다 낮은데 내가 좋아함(정직한 즐거움) |
**근거:** 기존 1축은 "제도 합치"만 본다. Cinecodex V는 *지속·전이되는 획득가치*(인기 아님)라 별점과의 차익이 **다른 정보**를 준다 — 정전가 차익은 "세상이 인정했나", V 차익은 "오래 남는가". `[⚠COORD-2]` UX는 두 축을 한 뱃지에 압축할지(2×2 미니맵) 분리할지 조율 필요.

### M3 · asset-desk E/R 좌표를 Cinecodex로 접지
**대상:** `05-wwi.md` §2.2 / `asset-desk.md`(리스크–리턴 프론티어 산점도).
**현재:** `E`(기대 미적수익)·`R`(리스크=실망 확률)이 *WWI·분산 기반*의 자체 추정 — 정의가 헐겁다("E = WWI 또는 safe·canon 기반").
**제안:** **E ← Cinecodex V**(또는 U), **R ← Cinecodex R**로 직접 접지. 산점도 = **(R, V) 평면** = Cinecodex 설계문 §5.2의 *그 산점도 그대로*. 좌상(고V·저R)="안전한 걸작", 우상="고위험-고수익", 우하="지뢰". 그리고 **위험조정 수익 = S(샤프)** 를 데스크의 "적중률/알파" 옆 1급 지표로 노출. λ 다이얼이 이 평면의 *등U선 기울기*를 돌린다(시각적으로 직관적). `[⚠COORD-3]`

### M4 · 추천 6이유에 위험 경고 — 7번째 이유가 아니라 *경고 배지*
**대상:** `05-wwi.md` §4(e) 이유 스택 / `MASTER-INDEX` §4 이유 6+가용 정본.
**현재:** 6이유(safe·frontier·conquer·gap·canon·reading) + avail(이유 아님). 전부 *가산* 톤(왜 봐야 하나).
**제안:** **위험을 7번째 이유로 넣지 않는다**(이유 = 가산, 위험 = 감산 — 톤 충돌). 대신 카드에 **risk pill**(별도 톤, 예 회색/적색):
- `R̂ ≥ τ_hi` → **「고위험 · 분열작」** 배지 + VaR 어법 한 줄(아래 A3). 동시에 *왜* 위험한지 분해: BANK(지적 파산)/INSINCERE(미적 불성실)/COWARD(예술적 비겁)/POLAR(분열) 중 최대 기여 1개를 토큰으로("분열적 — 호불호 갈림" vs "미적 불성실 — 스타일만").
- `polar`(분열성) ↑인데 `BANK/INSINCERE/COWARD`는 낮으면 → **「갈림 · 옹호 진영 있음」**(파산 아님 — Cinecodex 철칙 ②). frontier/모험가에겐 오히려 매력.
**근거:** "실패가 두려운 사람"이 핵심 사용자(Cinecodex §0). 6이유는 *왜 좋은지*만 말하는데, 위험 경고가 없으면 추천이 *낙관 편향*된다. 단 이유 스택의 가산 논리를 오염시키면 안 되므로 시각적·논리적으로 분리.

---

## ③ ADD (신규 산출물 제안)

### A1 · 객관 U 품질 게이트 — 추천 후보 풀의 바닥
**제안 RPC(개념):** `recommend()`(phase2 §7-b) 후보 생성 시, **Cinecodex U(λ_floor) 하한 컷**을 *선택적 게이트*로:
```
candidates = (① affinity 이웃 ∖ watched ∖ watchlist)
           ∩ { f : Cinecodex.U(f, λ_user) ≥ U_gate }      # 고위험·저가치 자동 배제
```
- **U_gate = "지뢰 거르기"**(Cinecodex §5.2 우하단 = 저V·고R). 만인 공통 = *취향 이전에* 품질 바닥.
- **소프트 게이트 권장:** 하드 컷이면 컬트 걸작(고R·고V, λ 낮은 유저에겐 보석)을 죽인다 → λ_user에 연동된 게이트(보수적이면 컷↑, 모험적이면 컷↓ 또는 끔). "고위험작 자동 강등"은 **정렬 페널티**(risk_mult)로, "지뢰 배제"는 **게이트**로 — 둘은 다른 메커니즘.
- **Cinecodex 커버리지 게이트:** Cinecodex는 ~6,000편 카탈로그. *점수 없는 후보*는 게이트를 *통과*시키되(abstain, 죽이지 않음) "Cinecodex 미평가" 라벨 — taste가 vector 없는 영화에서 abstain하는 패턴(phase2 §1)과 동일 원칙.

### A2 · λ 위험회피 다이얼 = 사용자 컨트롤 (2-노브 설계)
**제안:** watchlist/asset-desk에 **λ 슬라이더**(보수적 ↔ 모험적) 신설. 기존 WWI `t`(Affinity↔Discovery) 슬라이더와 **공존**:

| 노브 | 축 | 무엇을 바꾸나 | 기존 정합 |
|---|---|---|---|
| **t** (Affinity↔Discovery) | 익숙 ↔ 새로움 | safe·canon ↔ frontier·gap 가중 틸트 | 05-wwi §4-d (기존) |
| **λ** (보수적↔모험적) | 안전 ↔ 도박 | `s_quality=U(λ)` + `risk_mult(ρ는 λ에 연동)` | Cinecodex §5.1 (신규) |

- **λ 범위:** Cinecodex HANDOFF는 **λ 0.5–1.0(사용자 조정)** 명시 → 그 범위를 UI 기본값으로. 모험 극단(λ<0.5 또는 음수)은 "도박 모드"로 별도 노출 가능하나 1차안은 0.5–1.0.
- **데스크 기본 λ:** asset-desk는 "중립 운용" = λ=1.0(기본, 위험회피 표준). watchlist는 사용자 λ.
- **두 노브 직교 확인:** t는 *가중치*만(s_r 불변), λ는 *Cinecodex U/R 소비분*만 바꿈 → 서로 점수를 거짓으로 만들지 않음(05-wwi §4-d 원칙 상속). `[⚠COORD-4]` UX는 2-노브가 과한지(인지 부하) 검토 — 1차는 λ만 노출, t는 고급 토글일 수도.

### A3 · VaR 어법 한 줄 (실망 확률) — "실패가 두려운 사람"의 언어
**제안:** 고위험 카드(M4 배지)에 Cinecodex §4의 **VaR 어법**:
> "이 영화를 4/10 이하로 느낄 확률 ≈ 12%"

- 출처: Cinecodex R + 분열성(POLAR) → 손실 확률 추정. σ보다 손실회피 심리에 직접 닿음(Cinecodex §4).
- **MetaTake 톤 정합:** "→ NAV +N"(이득)의 거울상으로 "↓ 실망 P≈X%"(위험). 자산 운용 어휘와 일관.

### A4 · collection 보유작 위험 프로파일
**제안:** collection 페이지에 **보유 포트폴리오의 위험 분포**(Cinecodex R 히스토그램 + 평균 S):
- "당신의 보유 30편: 평균 R 22(저위험 편중) · 고위험작 2편 · 포트폴리오 S 1.8". 자산운용의 *리스크 프로파일* 카드.
- M2의 2축 가치뱃지와 결합 → 보유작별 (별점·V·정전가·R) 4값 = 사후 평가의 완전체.
- NAV(⑧)는 *총량*, 이건 *위험 결*. NAV depth/disc 축과 직교(NAV는 위험을 안 본다 — 그 빈자리를 메움).

---

## ④ ABSORB (Cinecodex가 흡수/대체하는 것 — 중복 제거)

| MetaTake 기존 | Cinecodex 대응 | 권고 |
|---|---|---|
| asset-desk **E/R 자체 추정**("WWI 또는 safe·canon 기반", 헐거움) | V·R·S(정의·검증·신뢰도 카드 완비) | **Cinecodex로 대체**(M3). 자체 추정 폐기 — 더 엄밀한 객관 소스 존재 |
| WWI **위험 부재**(실망작 못 거름) | R·U·risk_mult | **흡수**(M1·M4). 빈 슬롯을 Cinecodex가 채움 |
| 가치뱃지 1축(별점 vs 정전가) | + V 축 | **확장**(M2). 기존 축 유지 + 분석 축 추가(대체 아님 — 둘은 다른 정보) |
| (없음) 위험-조정 순위 | **S 샤프** | **신규 흡수** — "위험 대비 효율" 정렬은 MetaTake에 없던 것 |

**대체 아님 — 공존(흡수 금지) 명시:**
- **②정전가 ≠ Cinecodex.** 정전가 = *제도/시장가*(영화제·수상 멤버십 기하), Cinecodex = *분석가 획득가치*(13차원 LLM). 둘은 **다른 객관**이고 가치뱃지·canon 이유에서 *둘 다* 쓴다(M1 κ). MASTER-INDEX의 "Cinecodex = 정전가 옆 두 번째 객관 점수" 정의를 그대로 지킨다.
- **①취향 ≠ V.** taste = *나에게 맞나*(코사인), V = *오래 남나*(품질). WWI에서 safe(①)와 s_quality(V)는 **다른 다리** — 곱 게이트로 결합(M1)하지 합산 안 함.
- **④gap·⑦conquer·⑧NAV는 Cinecodex와 무관** — 멤버십 기하(커버리지·공백·총량)는 위험·품질과 직교. 흡수 대상 아님. (단 A4 위험 프로파일이 NAV 옆에 *결*을 더함.)

---

## ⑤ CONFLICT · COORD (`[⚠COORD]`)

- **`[⚠COORD-1]` 비섞임 vs 블렌드 충돌(가장 중요).** Cinecodex 철칙 = *외부·정전가를 공식에 안 섞음*. MetaTake WWI = *섞는 게 본질*(6이유 가중합). **해소:** WWI는 Cinecodex 점수를 *소비*만 한다(읽어서 게이트/정렬/배지) — Cinecodex *내부 공식*엔 MetaTake 값(②정전가·①취향)을 절대 역주입 안 함. 두 시스템의 경계 = "Cinecodex는 만들고, WWI는 쓴다." 이 경계를 코드 계약으로 못박아야(Cinecodex는 *입력으로 MetaTake를 받지 않는다*). **조율 대상:** Cinecodex 팀 + WWI(⑤) 소유자.

- **`[⚠COORD-2]` 가치뱃지 2축 UX.** (별점 vs 정전가) + (별점 vs V) = 2축. 한 뱃지에 압축(2×2 미니맵)할지, 두 뱃지로 분리할지, collection 카드 밀도 한계. **조율 대상:** collection UX + 02-standing(②) + M2.

- **`[⚠COORD-3]` E/R 좌표 정의 충돌.** asset-desk가 이미 E/R 산점도를 *자체 추정*으로 그림. M3는 Cinecodex V/R로 교체 — 기존 카피·좌표·navguard 메시지 재정렬 필요(asset-desk.md §2의 개선분과 충돌 가능). **조율 대상:** asset-desk UX + 05-wwi §2.2.

- **`[⚠COORD-4]` 2-노브(t·λ) 인지 부하.** WWI 슬라이더(t)에 λ를 더하면 사용자가 손잡이 둘을 만난다. 직교하지만 헷갈릴 수 있음(둘 다 "안전↔모험"으로 *오해* 가능 — t는 익숙/새로움, λ는 위험/수익). **해소안:** 1차 λ만 노출, t는 고급 토글. 또는 라벨 명확화. **조율 대상:** watchlist/asset-desk UX + 05-wwi §4-d.

- **`[⚠COORD-5]` Cinecodex 커버리지 vs MetaTake 카탈로그.** Cinecodex ~6,000편 vs MetaTake 채점 카탈로그 ~5,985 + 추천 후보(affinity 이웃). 교집합·정합 미확인. *Cinecodex 미평가* 후보의 게이트/배지 폴백(abstain) 규칙 필요(A1). film_id 매핑(Cinecodex `films.film_id` bigserial vs MetaTake `films.id` uuid)도 조인 키 설계 필요. **조율 대상:** 데이터/스키마 + Cinecodex 실행팀.

- **`[⚠COORD-6]` λ↔t↔콜드스타트 상호작용.** 콜드스타트(taste_forming)면 taste 죽고 canon 폴백 → 거기에 λ(Cinecodex U)가 들어오면 *어느 폴백이 우선*인가(②정전가 단독 vs Cinecodex U). M1은 "U가 폴백 강화"를 제안하나, 정전가도 폴백 소스라 우선순위 규칙 필요. **조율 대상:** phase2 §4-g(콜드 게이트) + M1.

- **`[⚠COORD-7]` 신뢰도 전파.** Cinecodex는 *측정된 신뢰도*(sd_v, panel_disagree, flagged)를 갖는다. WWI가 U/R을 소비할 때 *Cinecodex 자신의 불확실성*을 전파할지(예: flagged 영화의 risk_mult 보수화, panel_disagree 높으면 confidence band). MetaTake confidence 게이트(①)와 Cinecodex 신뢰도의 결합 규칙 미정. **조율 대상:** Cinecodex 신뢰도(`Conclusions` Part B) + WWI confidence(05-wwi §3).

---

## ⑥ OPEN QUESTIONS

1. **U vs V를 품질 prior로?** M1의 `s_quality`를 U(위험조정 순가치)로 둘지 V(순수 획득가치)로 둘지. U면 위험이 *두 번* 들어간다(s_quality의 U + risk_mult). **잠정:** s_quality=**V**(순수 품질), 위험은 risk_mult가 *한 번만* — 이중계산 회피. (M1 본문은 U로 적었으나 이 질문이 미해결 — V가 더 깨끗할 수 있음.)
2. **risk_mult의 ρ·floor·τ_hi 캘리브레이션.** 위험 감점 세기(ρ), 고위험 죽이지 않는 바닥(floor), "고위험 배지" 임계(τ_hi). λ에 연동? 코퍼스 R 분포로 튜닝.
3. **κ(②정전가 vs Cinecodex V 혼합비).** canon 이유에서 두 객관을 어떻게 가중(0.5?). 둘이 크게 갈리는 영화(제도는 높은데 V 낮음 = 길티 플레저류)에서 어느 쪽을 신뢰?
4. **S(샤프)를 정렬 1급으로?** asset-desk에서 WWI 정렬 vs S 정렬 vs U 정렬 — 어느 게 기본? 「오늘의 한 편」을 S 최대(위험 대비 효율)로 둘지 WWI 최대(개인 적합)로 둘지.
5. **λ 다이얼 영속·동기화.** λ가 사용자별 영속 설정인지 세션 슬라이더인지. profiles에 저장? watchlist↔asset-desk 동기?
6. **Cinecodex 미평가 영화 비중.** 추천 후보 중 Cinecodex 점수 *있는* 비율이 낮으면 게이트/배지가 희박해진다 — abstain 폴백이 잦으면 위험 필터가 사실상 무력. 커버리지 실측 필요(`[⚠COORD-5]` 후속).
7. **VaR 어법 산출.** "4/10 이하 확률 ≈12%"를 Cinecodex R+POLAR에서 *어떻게* 추정(분포 가정·캘리브레이션). 거짓 정밀 금지(Cinecodex §8-3) — 밴드로?
8. **위험-조정이 다양성(MMR)과 충돌?** risk_mult가 고위험 frontier를 깎으면, 다양성 바닥(05-wwi §4-h)이 올리려는 frontier와 *반대로* 작동. "안전한 모험"(frontier = 상방↑·하방 net 받침)은 *원래 저위험*이어야 하므로 대개 정합하나, 고위험 frontier에서 충돌 — 규칙 필요.

---

### WWI × Cinecodex 모델 (한 장 요약)

```
                  ┌─────────────── 두 객관 (나란히, 안 섞음) ───────────────┐
①취향(fit)         ②정전가(제도/시장가)          Cinecodex(분석가: V·R·U·S)
  │ safe              │ canon ────┐                  │
  │                   │           κ blend            │ V → s_quality (품질 prior)
  ▼                   ▼           ▼                  │ R → risk_mult (위험 감점/게이트)
 s_safe ··· s_frontier ··· s_conquer ··· s_gap ··· s_canon'        │ U → 후보 풀 게이트(A1)·폴백
  └──────────── Σ wᵣ·sᵣ (6이유 가중합) ────────────┘                │ S → asset-desk 위험조정 정렬
                       │                                            │ λ → 사용자 다이얼(보수↔모험)
                       ▼                                            │
        WWI(f) = (Σ wᵣ·sᵣ / Σ wᵣ) · risk_mult(f)  ←────────────────┘
                       │
   정렬: U-게이트(만인 공통 바닥) → WWI(개인 재정렬) → S(위험조정, 선택)
   배지: risk pill(고위험·분열) + VaR("실망 P≈X%") · 가치뱃지 2축(별점 vs 정전가 / vs V)
```

**한 문장:** taste=fit은 ①이, 품질·위험은 Cinecodex가, 정전 위상은 ②가 댄다 — WWI가 셋을 *곱과 합으로* 통합하되, U는 만인 공통 품질 바닥을 깔고 WWI는 그 위에서 개인 재정렬하며, λ 다이얼이 안전↔모험을 사용자 손에 쥐어준다. **Cinecodex는 만들고, WWI는 쓴다(비섞임).**

---

*REVIEW-ONLY. DB·파일 미수정. 모든 제안은 PROPOSED, 적용은 승인 후. 시리즈 03/추천·위험 렌즈 — 01·02(미작성)와 합쳐 단일 통합 설계로 묶일 것.*
