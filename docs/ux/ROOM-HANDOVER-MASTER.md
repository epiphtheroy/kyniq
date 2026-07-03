# METATAKE `/room` — 인수인계 마스터 (단일 정본)

> **이 문서의 약속:** 이 문서 **하나만** 읽으면, 다른 AI/개발자가 Metatake `/room`(다크 "영화적 자산 운영 OS")의 **최종 의도**를 정확히 이해하고, **아직 풀어야 할 숙제**를 정확히 안다. 목업 이미지가 없어도 의도가 선다.
> **구성 원칙:** ①제품 정체 → ②절대 불변식 → ③9 엔진(로직 캐논) → ④표시 표준 S1–S11 → ⑤셸 해부 → ⑥페이지별 사양+디테일 의도 → ⑦현재 구현/감사 → ⑧풀어야 할 숙제 → ⑨데이터·RPC·색토큰 → ⑩파일 링크 인덱스.
> **원 소스(이 문서가 통합한 것):** 디자인 의도 [`HTML-DESIGN-HANDOFF.md`](./HTML-DESIGN-HANDOFF.md) · 표시 정본 [`SHARED-STANDARD.md`](./SHARED-STANDARD.md) · 검토 방법론 [`00-UX-REVIEW-GUIDE.md`](./00-UX-REVIEW-GUIDE.md) · 충돌 해소 [`CONFLICTS-AND-COORDINATION.md`](./CONFLICTS-AND-COORDINATION.md) · 페이지별 UX 의도 [`docs/ux/<page>.md`](.) ×10 · 로직 [`docs/logic/`](../logic/) 9엔진 · 구현 계획 [`PLAN-room-implementation.md`](./PLAN-room-implementation.md) · **현재 구현·감사·숙제** [`ROOM-LOGIC-AUDIT.md`](./ROOM-LOGIC-AUDIT.md) · 사이트 현황 [`STATE.md`](../STATE.md).
> 작성 2026-07-02. 이 문서는 개정한다(§11 로그).

---

## 0. 30초 요약 (TL;DR)

`/room`은 영화를 **지적·미학적 자산**으로 다루는 **개인 운영체제**다. 블룸버그 터미널의 밀도로, 사용자가 "정말 나를 위한 운영 시스템이 있다"고 느끼게 하는 것이 목표(취향이 아니라 **의미**). 12개 라우트(현황·보유·볼영화·데스크·분석·평가카드·기록·서재·노트·동행·지리Atlas·감독정복)가 하나의 4단 셸을 공유한다. 모든 화면의 숫자·색·위치는 **9개 로직 엔진**의 창(窓)이다. 5대 약속(★★★): **정전가 정확 · WWI 위험 거르기 · Cinecodex 나란히(비섞임) · NAV 단조 · 설명가능 인스펙터.**

**현재 상태 한 줄 (2026-07-03 갱신):** **P0 전부 + P1 상당수 해소.** `me_coverage`⑦·`me_blindspots`④ 신설·배선, WWI conquer/gap 실태깅, 쓰기 경로(담기/봤어요/관심없음/서재 공개토글·즐겨찾기/노트 저장·게시) 전부 실 mutation 배선, 티커/시스템카드 실데이터(`me_system_status`), `nav_snapshots`+`me_nav_history` 자산곡선 실렌더, `/u/me` 404 수정, 신규 DB 변경 전부 마이그레이션 역커밋(0027–0030). **남은 숙제 = §8 잔여(동행 P1-7, /api/geo 스코프 P1-9 일부, P2/P3).**

---

## 1. 제품 정체 — 왜 "운영시스템 셸"인가 (★★★ 전체를 지배하는 의도)

출처: [`HTML-DESIGN-HANDOFF.md`](./HTML-DESIGN-HANDOFF.md) §1–2.

- **자산 메타포의 시각화.** 영화 = 자산. 화면은 소비앱이 아니라 **트레이딩 데스크/블룸버그 터미널**의 헤드리스·고밀도. 이건 스타일이 아니라 의미다.
- **4단 접이식 셸(왜 4단인가).** 운영자는 넷을 *동시에* 본다: ①어디로 갈지(**좌 레일**) ②무엇을 보는지(**중앙 워크스페이스**) ③선택한 것의 상세·왜(**우 인스펙터**) ④지금 일어나는 일(**극우 라이브 피드**). 각 열 접이 = `localStorage` 공유. **이 4단은 전 페이지 불변**(공개 프로필만 예외=라이트 스킨). 페이지가 바뀌는 건 *중앙·인스펙터·피드의 콘텐츠*뿐.
- **인스펙터-스왑 = 설명가능성의 UI 구현(★★★).** 무엇을 클릭하든(추천/영화/계보) 우측 인스펙터가 *그것의 상세와 "왜 이 값인지"*로 스왑. "로직은 숨기되(계산) 근거는 보인다(WHY)". 인스펙터가 비면 그 페이지의 *분석 요약*을 기본 표시.
- **색은 코드다(★★★).** 6이유(safe teal · frontier blue · canon gold · gap amber · conquer red · reading violet) · 블라인드 amber(≠완파 red) · 형성중 골드 · **위험 `--risk`(≠완파 red)**. 같은 빨강이 "정복"과 "위험"을 동시에 뜻하면 오독 → 반드시 토큰 분리.
- **검토 4렌즈(모든 페이지가 이걸로 다듬어짐, [`00-UX-REVIEW-GUIDE.md`](./00-UX-REVIEW-GUIDE.md)):** ①경험 흐름(3초 안에 *지금 뭘 하나*가 보이나·주 행동 하나) ②눈동자(가장 중요한 숫자가 위계 최상단·색은 의미만) ③클릭 최소화(인라인·hover-reveal·스마트 기본값) ④직관성(affordance·자명한 라벨·예측 가능·같은 행동=같은 패턴). 한 줄: **"사용자는 우리 로직을 모른다. 눈으로 보고 손으로 누른다."**

---

## 2. 절대 불변식 (어기면 로직 약속 위반) — 의도(왜)까지

이 7개는 화면·RPC·신규 코드 **모두**가 지켜야 한다. (감사에서 현재 준수 확인됨 — [`ROOM-LOGIC-AUDIT.md`](./ROOM-LOGIC-AUDIT.md) §1.)

1. **비섞임(never-blend) — Cinecodex(우리 V/C/R/U/S) ≠ 외부(imdb/rt/meta) ≠ 정전가(prestige).** 절대 한 숫자로 합치지 않고 분리 칸. *왜:* 셋은 서로 다른 질문(내재가치/대중반응/제도인정)이라 평균 내면 셋 다 죽는다. 특히 **Cinecodex는 단방향** — 만들 때 외부·정전가를 입력으로 넣으면 순환성(§3-⑨).
2. **위험색 분리 — 위험 R = `--risk`(#D64518), 완파/정복 = `--conquer`/`--red`(#E3120B).** 재사용 금지. *왜:* 빨강이 "정복했다"와 "위험하다"를 동시에 뜻하면 즉각 오독.
3. **NAV 단조 — 관람은 NAV를 깎지 않는다(포화·감쇠만).** *왜:* NAV를 올리는 가장 쉬운 길이 곧 좋은 시네필 행동이어야 한다(반-게이밍). 저평점·dropped는 P&L엔 음수지만 NAV 절대값은 비하락. 신규 NAV 로직(자산곡선 등)은 **단조 어서션** 포함.
4. **실 숫자만(no-fake-data).** 하드코딩 금지. 부족분은 "형성 중"(골드)·정직한 빈 상태(NaN 금지). *왜:* 지어낸 숫자 하나가 시스템 전체 신뢰를 무너뜨린다. (현재 위반: 셸 티커/시스템카드 일부 하드코딩 — §8 P0.)
5. **설명가능 인스펙터.** 클릭 → "상세 + 왜 이 값". 특히 추천은 `reasons[]`(기여도 순 분해)가 없으면 출시 금지("WWI 88"만 보이면 실패, "왜 88인지"가 한 줄로 납득돼야 성공).
6. **DB 가산(additive) + 개인정보 스코핑.** 공개 테이블 불변. 개인/룸 데이터는 `auth.uid()` 스코프 SECURITY DEFINER RPC로만. 신규 개인 write는 RPC 레벨에서 스코핑 강제(프런트 신뢰 금지).
7. **공개 프로필 금지 항목.** 13서브·Cinecodex 신뢰도·prompt_sha·개별 별점·취향벡터는 다크 셸 전용 — 공개 프로필 노출 금지. 화이트리스트 투영은 RPC/뷰 레벨 강제.

---

## 3. 9 엔진 (로직 캐논) — HTML이 프레임하는 창

전체 사양: [`docs/logic/`](../logic/) (엔진별 01–09 + [`LOGIC-SPEC-FULL.md`](../logic/LOGIC-SPEC-FULL.md) + [`BUILD-ORDER.md`](../logic/BUILD-ORDER.md)). **두 기둥 = ①주관(취향) × ②객관(정전가). ⑨는 ② 옆 두 번째 객관축.** 동행 싱크율 = 두 사용자 ① 코사인.

### ① 취향 벡터 (Taste Vector) — [`01-taste-vector.md`](../logic/01-taste-vector.md)
- **의도:** 사용자가 *어떤 종류의 시네필인지*(장르가 아니라 "보는 방식")를 1536차원 좌표로 압축. Letterboxd식 표면 메타가 아니라 **해석 레이어**(take·figure·framework·계보)로 만든다. 거의 모든 엔진의 최하 입력.
- **수식:** 영화벡터 `v_film = normalize(α·mean(take_emb) + (1−α)·meta_emb)`, `α=min(1, n_takes/5)`. 두 사용자 벡터: `v_watched`(등가평균→커버리지) / `v_loved = normalize(Σ w(f)·v_film)`(사랑 가중→추천), `w=max(0,rating−6)·recency·signal_boost`, `recency=0.5^(Δyears/2.5)`, `signal_boost=1+0.5·[내가 take 씀]+0.25·[like]`.
- **불변식:** **앵커(이름) 없이는 출시 금지**(1536차원 블랙박스=설명불가=금지). 취향은 "안전자산(safe)"의 앵커일 뿐 추천을 독점하지 않는다(필터버블 금지).
- **출력·RPC:** `{v_watched, v_loved, clusters, anchors[], confidence}`. 현재 룸에선 `film_taste_vector`(1,941행) + `me_taste_signature`/`me_taste_neighbors`/`me_figure_cloud`로 소비.

### ② 정전가 (Standing) — [`02-standing.md`](../logic/02-standing.md)
- **의도:** 한 영화가 *당신이 누구든 상관없이* 영화사·비평·시상에서 얼마나 인정받았나 = **객관 시장가**. ①의 정확한 대척점. 가치뱃지("저평가 발굴/합치/고평가 실망" = 정전가 vs 내 별점)의 기준선.
- **수식:** 신호 `c_i = w_list × f_result × f_position`(won 1.0·runner-up .60·nominated/listed .45·selected .30). `PrestigeScore = 100·Σ c_(k)·δ^(k−1)/C`(δ≈0.6, 정렬 감쇠). `DiscoveryScore = max(w_list × f_result × selectivity_norm)` (S2∪S3 멤버십).
- **불변식:** **품질·권위만 담고 *닮음*(movement/style facet)은 절대 넣지 않는다**("슬로우 시네마라서 좋다"는 범주 오류 — 닮음은 ①/⑥의 영역). 사용자 데이터 1g도 금지. "미적재"와 "진짜 낮음" 구분.
- **출력·RPC:** `film_scores`(5,977행) `{prestige, discovery, total, components}`. `compute_film_scores` v2(Fix-A). *검증값: Vertigo 84.5·기생충≈88.*

### ③ 리니지 관련성 (Lineage Relevance) — [`03-lineage-relevance.md`](../logic/03-lineage-relevance.md)
- **의도:** 본 영화들이 어떤 계보에 얼마나, *얼마나 그답게* 속하나. ①×②가 처음 교차. 가장 차별적 산출 = **과집중(over-index)** — "유명해서 어쩌다 봄" vs "사랑해서 봄"을 가르는 칼.
- **수식(항상 4점수 보존):** coverage · over_index(베이지안 수축 `oi_shrunk=(k+α)/(|W|·p_corpus+α)`, CI 하한>1일 때만 단언) · rating_weighted · vec_prox. 블렌드 z-가중합(시그니처용 `w=(.15,.45,.25,.15)` 과집중 최대).
- **불변식:** **4점수+components 단일 숫자로 뭉개지 않는다.** facet 정책이 ②와 다름 — **movement/style 포함**(사조 쏠림이 시그니처의 본질).
- **출력·RPC:** `user_lineage_relevance`(설계). 현재 룸에선 `me_taste_signature` anchor/lineage로 부분 소비.

### ④ 공백 / 희소 (Gap · Blind Spot) — [`04-gap.md`](../logic/04-gap.md)
- **의도:** "안 가본·얕은 영역"을 축별로 식별 → 현황의 **블라인드**와 추천의 **gap 이유**. 엔진①의 "취향을 감옥으로 만들지 말 것"을 집행하는 **단 하나의 균형추**.
- **수식:** `opportunity(j) = authority(j)·(1−coverage_world(j))·productivity(j)·(1+λ·selectivity_norm)`, `productivity=clip(cos(v_watched, anchor(j)),0.35,1)`. 후보 `gapfill(f)=max_j(opportunity(j)·novelty(f,j))`.
- **불변식:** **단순 결핍을 다 들이밀지 않는다**(생산성 게이트 = "취향 인접한 안전한 모험"만). 게이지는 *고발이 아니라 권유*.
- **출력·RPC:** `user_gap_profile`(설계). **현재 미구현** — `me_blindspots` 필요(§8 P0).

### ⑤ WWI (Why-Watch Index) — [`05-wwi.md`](../logic/05-wwi.md)
- **의도:** **시리즈 최상위 통합 엔진.** 후보가 나에게 얼마나 볼 가치 있나를 단일 점수가 아니라 **6개 이유로 분해된 가중합**으로(애널리스트 BUY 리포트). 추천 3면(볼영화·데스크·보유추천)의 심장.
- **수식:** 6 이유 각 0–100(safe·frontier·conquer·gap·canon·reading). `WWI = 100·Σ w_r·s_r/Σ w_r`, default `w0={safe .30, frontier .18, conquer .15, gap .15, canon .12, reading .10}`. λ/틸트 슬라이더로 safe·canon↓·frontier·gap↑. 콜드게이트(N_loved<8): safe·gap·reading×conf, canon↑. `Δindex(f)=⑧.marginal`.
- **불변식:** **`reasons[]`(기여도 순) 없으면 출시 금지.** safe는 1차 동력이되 독점자 아님(frontier·gap 바닥 비율로 필터버블 방어). avail은 이유가 아니라 필터/가산.
- **출력·RPC:** `me_recommend_wwi(λ, limit)` — 현재 룸의 실제 정의는 `wwi=100·conf·(0.45u+0.35t+0.20s)`(단순화판; **conquer 이유 미방출**, gap은 discovery≥55 프록시 → §8 P0).

### ⑥ 유사 · 상호추천 (Similarity) — [`06-similarity.md`](../logic/06-similarity.md)
- **의도:** 영화↔영화·감독↔감독의 **추천 그래프(간선)** = "이걸 좋아했다면 저것도"(점 사이의 선분). WWI safe의 후보 풀을 *검색*해 공급.
- **수식:** `total_affinity = w_L·norm(lineage_score) + w_E·embed_sim`(곱 아닌 합), `ρ=min(1,라인풍부도/κ)`. 온보딩 구조 sim(임베딩 전): `5·[같은 감독]+3·[같은 사조]+1·[같은 국가]+1·[|Δyear|<12]`.
- **불변식:** **movement/style은 ⑥의 1급 신호**(②가 버린 facet이 여기서 부활) — 단 **②로 역류 금지.** 계보+임베딩은 합(OR-ish)으로 결합(발굴 간선이 죽지 않게). 간선마다 `reasons[]`.
- **출력·RPC:** `film_affinities`(38,800행 이미 존재 — "만들 것"이 아니라 "블렌드·검증할 것"), `me_taste_neighbors`, `film_room_context`(movies_like).

### ⑦ 커버리지 집계 (Coverage) — [`07-coverage.md`](../logic/07-coverage.md)
- **의도:** 모든 계보 라인에 대해 "이 라인 전체 중 몇 편 봤나"의 **원시 사실**(커버리지 매트릭스·게이지·도장깨기 진척의 토대). **취향 1g도 안 섞는 무취향 사실 레이어**(③ 주관 랭킹의 정반대).
- **수식:** `seen_i/total_i=pct_i`, `type=(total≤150)?finite:deep`. 가중 KPI `weighted_coverage=Σ W_i·seen_i/Σ W_i·total_i`, `W_i=authority·size_damp`. 감독 `near_complete=(total_rep−seen_rep≤2)&(pct≥.75)`.
- **불변식:** **"안 봐서 낮음"과 "데이터가 없어서 낮음"을 절대 같게 보이지 않게**(data_completeness 게이트). 분모 정규화 금지. "21/77" 클릭 시 어느 편이 비었는지 분해 필수.
- **출력·RPC:** `user_coverage`(설계). **현재 미구현** — 룸은 `portfolio_breakdown.canon`(facet=canon·상위 8개)에서 파생 → 구조적 저평가. **`me_coverage` 필요(§8 P0).**

### ⑧ NAV · 레벨 (Portfolio NAV & Level) — [`08-nav-level.md`](../logic/08-nav-level.md)
- **의도:** 영화적 자산 총량을 헤더에 박히는 **단 하나의 숫자(NAV) + 레벨 밴드**로(펀드 NAV = 보유 시가총액). 자산운용 비유의 정점·되먹임.
- **수식:** `NAV=100·(w_b·breadth+w_p·prestige+w_d·depth+w_v·disc)/C`, `w=(.35,.35,.20,.10)`. 레벨 밴드=코퍼스 백분위(절대 컷 금지). `Δindex≈100/C·[w_b·Δbreadth+w_p·prestige·novelty+w_v·disc·novelty]`, `novelty=1−(보유 유사 비중)`.
- **불변식:** **NAV는 유일 총량 — 어떤 면도 경쟁 총량을 만들지 않는다.** **단조 / 부피 보상 금지.** P&L은 NAV 절대값에 직접 미가산(이중계산 방지). 분해 없이는 출시 금지.
- **출력·RPC:** `me_portfolio_nav`(실 정의 = `100·(1−0.5^(pd/1.4))`, `pd`=관람작 prestige 감쇠합; <8편이면 null="형성 중"). **자산곡선용 `nav_snapshots`/`me_nav_history` 미구현(§8 P1).**

### ⑨ 내재가치 (Intrinsic Value · Cinecodex / TakeScore) — [`09-intrinsic-cinecodex.md`](../logic/09-intrinsic-cinecodex.md)
- **의도:** 영화의 **펀더멘털 등급** — 세상의 인정과 무관하게 작품이 무엇을 돌려주고(V)·얼마나 어렵고(C)·얼마나 위험한지(R). ② 옆 두 번째 객관축. ②가 못 하는 것(저야망 vs 분열적 실패 구분, **망작 거르기**)을 R/U가 해결.
- **수식:** `V=(COG+AFF+FORM+MORAL+DUR)/5` · `C=(ITX+FR+ETX+CTX)/4`(난이도, 가치 아님) · `R=0.6·((BANK+INSINCERE+COWARD)/3)+0.4·POLAR` · `U=V−λ·R`(λ 기본 1.0 위험회피 다이얼) · `S=(V−50)/max(R,1)`(샤프).
- **불변식(the core):** **비섞임=단방향** — Cinecodex는 만들고 상위 엔진(⑤⑧)은 출력만 쓴다. WWI/NAV/정전가/외부지표를 Cinecodex *입력*으로 되돌리면 위반. 3철칙: ①난이도는 비용이지 가치 아님(C≠V) ②분열적 ≠ 파산적(고POLAR ≠ BANK) ③야망 ≠ 성취(스펙터클 FORM 상한 ~55). WWI prior는 **V**(U 아님 — 이중계산 방지).
- **출력·RPC:** 격리 `cinecodex` 스키마(`cinecodex.scores` 6,701행 + `cinecodex_confidence`). `cinecodex_card`·`cinecodex_ranked`·`takescore_for_slugs`. 사이트에선 **TakeScore(TS)** 로 노출.

### 엔진 의존 순서 (BUILD-ORDER) — [`BUILD-ORDER.md`](../logic/BUILD-ORDER.md)
L0 ①·② (병렬) → L1 ⑦·⑥ → L2 ③·④ → L3 ⑧·⑤(가장 많은 의존, 추천 정점) + Δindex는 ⑤↔⑧ 되먹임. ⑨는 ② 옆 두 번째 객관축.
구현 순서: **W0 ② 재캘리브레이션 ∥ W1 ① 취향벡터(키스톤) → W2 ⑦ 커버리지 → W3 최소 WWI⑤(⑥은 블렌드만) → W4 증폭(⑧ NAV·③·④·랭킹·페어).**

---

## 4. 표시 표준 S1–S11 (SHARED-STANDARD — 12 충돌의 단일 정본)

전체: [`SHARED-STANDARD.md`](./SHARED-STANDARD.md). 🎨=디자인 · 🔧=백엔드 전제.

- **S1 추천 명칭** — Δindex 최상위 1편 = **「오늘의 한 편」** + 부제 `최대 Δ · → NAV +N`. 폐기: "오늘 할 일/최대 알파/최상위 기회"(라벨 금지).
- **S2 색 토큰 정본** — `--blind:#E8B23A`(블라인드=gap amber, conquer red 재사용 금지: *빨강=정복했다, 앰버=아직 안 갔다*) · `--forming:#C8922B`(형성중 중립 골드, red 금지) · `--masque:#9B8CF0`(동행 보라). 타입 6색: 영화 ink·감독 violet·트로프 teal·미스리딩 amber·리니지 blue·형상 `#86b9ec`.
- **S3 가용성 3-상태** — 가능(solid green + 제공자·지역) / 미확인(hollow ring + "정보 없음 ≠ 안 됨") / 만료(pill `D-N`).
- **S4 완파 4-state** — 잠금<50(회색) / 진행50–74(`--canon`) / 근접75–99(`--canon` 강조) / 완파100(`--conquer` 축포). Phase 4 `fire_lineage_milestones`(50/75/100) 일치.
- **S5 용어집 hover** — `.gloss`(점선 밑줄 + 한국어 정의). 정본 사전: 정전가·NAV·WWI·Δindex·커버리지·블라인드·정복도·aw·rel·cov.
- **S6 별점 표준** — `.starwrap` 0.5–5 half-star, hover preview, "0.5–5" 단서, **평점 ⟹ 봤어요 자동**("평점을 주면 자동으로 '봤어요'"). 🔧 `rate_film`→가치뱃지·NAV 즉시 재계산.
- **S7 인라인 액션 바** — 행/카드 hover: 담기·봤어요·관심없음·공개토글, 동일 아이콘·피드백, `stopPropagation`.
- **S8 담기 동작 의미** — **담기 = 워치리스트 추가(제자리 마킹+toast, 이동 없음)** / 봤어요 = 보유로 이동(+별점). inspector "담기"도 동일(`location.href→collection` 금지). 🔧 `add_watchlist`·`mark_watched`.
- **S9 공개 토글** — pill 1종 `🌐 공개 중`/`🔒 비공개`, role=switch, 제자리 토글. 🔧 item-level(`user_movies.visibility`) + profile section-level(`portfolio_public` 화이트리스트, RPC/뷰 강제).
- **S10 write 인스펙터 반응형 예외** — write는 좁은 폭에서도 인스펙터(첨부 레일) 유지(`body.keep-inspector`).
- **S11 Cinecodex 표시** — 나란히(우리/외부/정전 분리 칸, never-blend) · 위험색 `--risk`(≠완파) · 신뢰도 흐림(단 **분열적 고POLAR ≠ 불신뢰**) · 재현성 카드(model·prompt_sha·n·sd) · 미평가=흐린 빈 카드 · 공개프로필 13서브/신뢰도 금지 · 어휘(미적단계≠레벨, U 순가치≠NAV, C 진입비용, S 샤프, POLAR 분열성).

---

## 5. 공유 셸 해부 (전 페이지 불변)

출처: [`HTML-DESIGN-HANDOFF.md`](./HTML-DESIGN-HANDOFF.md) §2. 구현: [`components/room/RoomShell.tsx`](../../components/room/RoomShell.tsx) · [`InspectorContext.tsx`](../../components/room/InspectorContext.tsx) · [`CmdK.tsx`](../../components/room/CmdK.tsx) · 스코프 CSS [`app/room/room.css`](../../app/room/room.css).

| 부위 | 무엇 | 왜 여기 · 어느 로직 |
|---|---|---|
| **appbar** | 로고·breadcrumb·⌘K·**NAV chip**·아바타 | NAV chip = ⑧ 총자산 상시 노출 · ⌘K = 영화/계보/감독/페이지 즉시 이동 |
| **ticker (LIVE)** | 흐르는 이벤트 | "살아있는 시스템" + 실 이벤트(신규 등재·추천 갱신·완파 근접·정전가/Cinecodex 재평가) |
| **좌 레일** | 글로벌 네비 + "이 화면" 점프 | 접으면 아이콘. `.on`=현재. *전 페이지 동일 목록* |
| **중앙 main** | 페이지 고유 워크스페이스 | 여기만 페이지마다 다름 |
| **우 인스펙터** | 클릭 대상 상세/근거 | 설명가능성. 기본=분석 요약. **Cinecodex 카드 자리(§6 평가카드)** |
| **극우 activity** | 라이브 피드 + 시스템 상태 | 완파 근접·Δ 기회·동행·고위험 경보·모델 상태·콜드 데모 토글 |
| **⌘K 팔레트** | 검색/이동(`film_search`) | 헤드리스 top-tech 감각 |

---

## 6. 페이지별 사양 + 디테일 의도 (핵심)

각 블록: **존재이유 / 지배엔진 / 주행동 / 구성·연동 / Cinecodex 강약 / 디테일 의도(WHY) / 표준 / 현재상태 / 링크.** 디테일 의도는 [`docs/ux/<page>.md`](.)의 요지를 손실 없이 옮긴 것 — byte 단위는 각 링크 참조.
목업 접근: 리포 루트 `mockup-me-*.html`, 라이브 `https://metatake.net/my_room/mockup-me-*.html`.

---

### 6.1 현황 · 커맨드센터 ★★★
- **존재이유:** 하루를 여는 대시보드 — "내 자산이 얼마고, 오늘 뭘 하면 되나". **지배엔진** ⑧⑦④②⑤⑥⑨. **주행동:** "오늘의 한 편" 담기(히어로, 0스크롤).
- **구성·연동:** ①NAV 히어로(=⑧, breadth/prestige/depth/disc 분해=설명가능) → ②KPI(보유·계보·커버리지·Discovery·블라인드) → ③커버리지 매트릭스(=⑦ 단조) → ④WWI 추천 데스크(=⑤ 6이유색·Δindex) → ⑤별자리(=⑥ affinity SVG). 인스펙터=클릭 상세, 피드=완파/블라인드/Δ/동행/시스템.
- **Cinecodex:** 히어로/KPI에 **U·R 요약** · 추천 행 위험 점 · 피드 "고위험 경보" · 인스펙터 Cinecodex 카드.
- **디테일 의도(WHY):** ①진입 시 *뭘 하나*가 안 보였음(주 행동이 인스펙터에 묻혀 2~3클릭) → **"오늘 할 일" 액션 배너**(hero 바로 아래: 추천1위 요약 + 담기 + 미니 바로가기 3개)로 "현황만 보고 나가는" 대시보드를 "한 편 정하고 나가는" 것으로. ②커버리지 매트릭스가 추천보다 위 = 행동가능 모듈이 위계에서 밀림 → **추천 데스크를 매트릭스 위로**(F패턴 첫 시선). ③담기 3클릭 → **행 인라인 hover 퀵액션**(stopPropagation·토스트·행 dimming). ④추천 행 클릭 단서 부재 → hover "분석 ▸" 라벨(affordance). ⑤죽은 컨트롤 정직화(커버리지 세그 `covSort` 연결, `aw`→`관람%`, Abraccine 0% 행에 블라인드 칩). ⑥cold-start 데모 토글이 묻혀 있어 라벨/점선박스로 발견성↑.
- **표준:** S1·S2(blind색)·S3·S4·S5·S6/7/8. **현재상태:** ⚠️ 커버리지·블라인드가 `portfolio_breakdown.canon`(상위 8개)에서 파생돼 구조적 저평가 · conquer 미방출 · 티커 하드코딩(§8).
- **링크:** 목업 [`mockup-me-command-center.html`](../../mockup-me-command-center.html) · UX 의도 [`command-center.md`](./command-center.md) · 구현 [`CommandCenterWorkspace.tsx`](../../components/room/CommandCenterWorkspace.tsx) · 라우트 [`app/room/page.tsx`](../../app/room/page.tsx).

### 6.2 보유 · 컬렉션 ★★★
- **존재이유:** 내 영화 *자산 거래소* — 각 보유작이 *가격(정전가)*을 갖고, 내 평가와의 차익이 *가치뱃지*. **지배엔진** ②⑨①. **주행동:** 발굴(저평가) 보기 · 인라인 별점.
- **구성·연동:** 툴바(정렬 정전가/별점/발굴·facet·검색) → 자산 데이터테이블(포스터·제목/감독·계보배지·**정전가 가격**·내 ★·**가치뱃지**). 인스펙터=자산 카드(정전가 분해·뱃지 산술·가용성).
- **Cinecodex ★★★:** 각 행/인스펙터에 **정전가 | V | U 나란히**(분리 칸) + **가치뱃지 2축**: (별점 vs 정전가)=시장 합치 / (별점 vs V)=분석 합치. 예: La La Land 정전가 85·V 57·R 39 → "시장은 정전, 분석은 위험 경고"가 한 눈에.
- **디테일 의도(WHY):** ①주 행동 "발굴 보기"가 레일 깊숙이 → **툴바 "발굴만 보기" 토글**(청록 캡슐+카운트). ②KPI 카드가 죽은 숫자 → **1클릭 필터화**(find/fit/over/전체 + 활성 표식). ③발굴 행 좌측 청록·고평가 행 좌측 적색 액센트로 "알파/리스크" 스캔 즉시 분별. ④별점 표시 전용→이탈 → **인라인 별점**(hover 미리보기·클릭 확정 → 가치뱃지·gap·정렬·KPI 즉시 재계산). **수식 gap=별점%−정전가·find≥+12/over≤−9·0.5–5 스케일 보존.** ⑤헤더 `정전가(가격)`/`내 ★ ✎` 명시. ⑥레일·KPI·툴바가 단일 `navFilter` 상태 공유.
- **표준:** S3·S6·S7/8/9. **현재상태:** ✅ never-blend·2축 뱃지 준수 · ⚠️ "최근순" 정렬 데드 · 정전 "발견" 칸 `—` 고정.
- **링크:** [`mockup-me-collection-list-v2.html`](../../mockup-me-collection-list-v2.html) · [`collection.md`](./collection.md) · [`CollectionWorkspace.tsx`](../../components/room/CollectionWorkspace.tsx) · [`app/room/collection/page.tsx`](../../app/room/collection/page.tsx).

### 6.3 볼 영화 · 워치리스트 ★★★ (Cinecodex 업데이트의 최대 변화)
- **존재이유(갱신):** 매수 후보 데스크 + **실망 거르기**. 예전엔 "나에게 맞나(WWI)"만, 이제 "**얼마나 위험한가(R)·순가치(U)**"까지. **지배엔진** ⑤⑨⑥. **주행동:** 담기/봤어요/관심없음 인라인 · 위험 필터 · λ 다이얼.
- **구성·연동:** 툴바(전략필터·정렬 WWI/Δ/**위험**/만료·**λ 다이얼**·검색) → 후보 랭킹(랭크·6이유색칩·**WWI**·**Δindex**·**위험배지 R**·가용성·만료). 인스펙터=WWI 분해 + Cinecodex 카드 + 담기.
- **Cinecodex ★★★:** 위험배지(R, `--risk`)·U 컬럼·"고위험 숨기기" 토글·λ 다이얼. 고위험(Babylon R51·La La Land R39) 자동 강등 + 경고.
- **디테일 의도(WHY):** ①진입 시 주 행동이 화면에 없음 → **히어로 주 행동 클러스터**(담기 / 왜1위·상세 / 가용 배지) 0~1클릭. ②만료 임박 후보가 1위와 동급 → **`.rrow.urgent`**(노란 좌액센트+경고 배경)로 시간-임계 상단 식별. ③후보 처리 2~3클릭 → **행 인라인 액션**(담기/봤어요/관심없음, 봤어요·관심없음은 페이드 후 제거, 담기는 ✓). ④흔한 두 의도 → 툴바 **원클릭 "지금 볼 수 있는 것만"·"만료 임박순"**. ⑤"정보 없음" 솔리드 점이 "off"로 오독 → **속 빈 링 + "가용성 미확인"**("≠ 안 됨"). ⑥행 전체 cursor:pointer인데 무동작(거짓 affordance) → **행 클릭→인스펙터** 핸들러.
- **표준:** S1·S2·S3·S5·S6/7/8. **S8 발견:** 인스펙터 "담기"가 collection으로 *이동*하던 것 → **제자리 마킹+toast(이동 없음)**로 수정. **현재상태:** ✅ λ 재계산이 원천 공식과 일치 · ⚠️ 담기/봤어요/관심없음 **로컬 상태만(DB 미기록)** · conquer 미방출(§8).
- **링크:** [`mockup-me-watchlist.html`](../../mockup-me-watchlist.html) · [`watchlist.md`](./watchlist.md) · [`WatchlistWorkspace.tsx`](../../components/room/WatchlistWorkspace.tsx) · [`app/room/watchlist/page.tsx`](../../app/room/watchlist/page.tsx).

### 6.4 운용 데스크 (Asset Desk) ★★
- **존재이유:** 트레이딩 데스크 — *"다음 한 편을 고르면 NAV가 오른다"*. 5전략·P&L·샤프(S)·λ. **지배엔진** ⑤⑧⑨④. **주행동:** 5전략 카드 담기.
- **구성·연동:** 5전략 보드(안전자산/모험/도장깨기/공백/정전, 각 후보+이유칩+WWI+Δ) → P&L(자산곡선 단조·적중률·regret 목록). Cinecodex: **S 위험조정 정렬** · **λ 다이얼** · "고위험 매수 경고".
- **디테일 의도(WHY):** ①주/부 위계 부재 → **5전략 보드를 `.mod.prime`(붉은 글로우)로 격상** + 헤더를 **"다음 한 편을 고르세요 · 5 전략 추천"** 행동 지시문으로. ②담기 3클릭 + 인스펙터 `location.href` 이탈 → **전 카드 인라인 `+담기`(hover)+토스트**, 인스펙터 담기도 *이동 대신 추가*. ③균일한 10후보 → **"오늘의 최대 알파" 단일 강조**(티커 "Δindex 최대 기회"와 일치). ④KPI 첫 칸이 히어로 NAV와 완전 중복 → **행동 칸(`kpi-go`)으로 교체**. ⑤"관람은 NAV 안 깎음" 카피가 6회+ 반복 → 한 번만 명료하게(자산곡선 옆만 정본 전체 문장).
- **표준:** S1·S4·S5·S7/8. **현재상태:** ✅ P&L 실측·NAV 불변 서사 정합 · ❌ 자산곡선 = `nav_snapshots` 없음 → 영구 부재(정직 empty) · conquer/gap 컬럼 영구 공백(§8).
- **링크:** [`mockup-me-asset-desk.html`](../../mockup-me-asset-desk.html) · [`asset-desk.md`](./asset-desk.md) · [`DeskWorkspace.tsx`](../../components/room/DeskWorkspace.tsx) · [`app/room/desk/page.tsx`](../../app/room/desk/page.tsx).

### 6.5 분석 (Analysis) ★★
- **존재이유:** 분석 워크벤치 — "내 취향이 어떤 모양이고, 어디가 비었나". **지배엔진** ③⑦⑥①⑨. **주행동:** 인사이트 리드에서 모듈로 드릴.
- **구성·연동:** 인사이트 리드 배너 → KPI → **Prestige×Discovery 산점** → **μ–σ 위험평면(V 세로 × R 가로)** → 형상 클라우드 → 축 커버리지 → 상호추천 그래프.
- **Cinecodex ★★:** **μ–σ 위험평면** 신설 — 좌상(고V·저R)=이상향, 우측(고R)=위험. 저위험 고가치(Tokyo Story·Yi Yi) vs 분열(La La Land·Babylon) 시각 대비.
- **디테일 의도(WHY):** ①차트만 나열돼 "그래서 뭘 알았나"를 사용자가 합성 → **인사이트 리드 배너**(PT Serif 문장, ①최대 블라인드 ②취향 이동 ③정체성+최적 계보; 각 줄 클릭→모듈 직행). ②블라인드 KPI가 양성과 동급 → `.alertkpi`(적색)+**모든 KPI 클릭 점프**. ③죽은 어포던스(연대/국가/감독 행·그래프 노드 클릭 무동작) → **인스펙터 드릴 활성화**(축 분해+"다음 행동"), 노드 히트영역+10px. ④약어(앵커·rel·cov) → **글로스 툴팁** + "앵커=보는 방식" 평문 인트로.
- **표준:** S1(no-op — 추천 표면 없음)·S2 blind색·S5. **현재상태:** ⚠️ 축 커버리지가 커맨드센터와 동일 ⑦ 결함 공유 · maturity/films 미소비.
- **링크:** [`mockup-me-analysis-v2.html`](../../mockup-me-analysis-v2.html) · [`analysis.md`](./analysis.md) · [`AnalysisWorkspace.tsx`](../../components/room/AnalysisWorkspace.tsx) · [`app/room/analysis/page.tsx`](../../app/room/analysis/page.tsx).

### 6.6 평가 카드 (Film Cinecodex) ★★ — 인스펙터 "더 보기"의 목적지
- **존재이유:** 한 영화의 Cinecodex 풀 분해. **지배엔진** ⑨.
- **구성:** 히어로(3축 도넛 V/C/R + U/S 큰 숫자 + **미적 단계** 배지 L1–L10) → 13 서브점수(접이, 각 레벨·근거 1줄·비교작 3) → **나란히 3분할**(우리 V/R/U | 외부 imdb/rt/meta | 정전가) → 신뢰도 카드(접이: model·prompt_sha·n·sd·flagged). 다크 셸 어휘 재사용.
- **디테일 의도(WHY):** ★★★ 나란히 3분할·미적 단계. 신뢰도 낮으면 흐림이되 **분열적(고 R/POLAR) ≠ 불신뢰**(La La Land R39는 분열이지 오류 아님). 미평가 = 「Cinecodex 미평가」 흐린 카드(NaN 금지).
- **현재상태:** ✅ 13서브·비교작·신뢰도 실 RPC(`cinecodex_card`) · never-blend 준수 · ⚠️ per-film 비평 산문 미구현(정직한 부재 — 루브릭 라벨로 대체) · 정전 "발견" 칸 `—`.
- **링크:** [`mockup-me-film-cinecodex.html`](../../mockup-me-film-cinecodex.html) *(루트에만; 라이브 my_room 미배포)* · 구현 [`EvalCard.tsx`](../../components/room/EvalCard.tsx) + [`CinecodexCard.tsx`](../../components/room/CinecodexCard.tsx) + [`FilmContentHub.tsx`](../../components/room/FilmContentHub.tsx) · 라우트 [`app/room/film/[slug]/page.tsx`](../../app/room/film/[slug]/page.tsx). 사이트 공개판 [`/takescore`](../../app/takescore/page.tsx).

### 6.7 기록 · 평가 (Onboard·Rate) ★
- **존재이유:** "별 하나 누르면 평가 끝(=봤어요), 사랑한 작품이 쌓이면 취향 벡터 형성". **지배엔진** ①⑥. **주행동:** 별 누르기.
- **디테일 의도(WHY):** ①주 행동이 묻힘 → **평가 모듈 primary 격상** + **주 행동 큐 배너**("본 영화의 별을 누르세요 — 0.5–5★ … 자동 봤어요 … ★4↑이면 닮은 영화가 날아옵니다"). ②이웃 fly-in이 평가 전에도 빈 상자로 상시 노출 = 서프라이즈 죽음 → **idle/armed 2-상태**(평가 전엔 접힌 초대 문구, 도착 시에만 보라 글로우+"N편 도착" 배지+펄스+자동 스크롤). ③"왜 떴나"를 *이유 앞·수치 괄호*로 재배치. ④일괄 평가 기본 ★3(미입력 시).
- **표준:** S6 별점 · 형성중색(S2). **현재상태:** ✅ `rate_film` **실제 mutation**(auth.uid·0.5–5 클램프) — 룸에서 유일하게 write 완결.
- **링크:** [`mockup-me-onboard-rate-v2.html`](../../mockup-me-onboard-rate-v2.html) · [`onboard-rate.md`](./onboard-rate.md) · [`RateWorkspace.tsx`](../../components/room/RateWorkspace.tsx) · [`app/room/rate/page.tsx`](../../app/room/rate/page.tsx).

### 6.8 서재 (Library) ★
- **존재이유:** *이질적인 것들*(영화·감독·트로프·미스리딩·리니지·형상)을 한 곳에서 분류·공개.
- **디테일 의도(WHY):** ①공개/비공개가 카드에 없어 인스펙터 경유 → **카드 우상단 인라인 pill 토글**. ②추상 항목(트로프·형상)이 카드만으론 불명 → **정의 티저 2줄 클램프** + 유형 아이콘. ③hero 유형 막대 6종 분리 + 클릭 진입. ④빈 상태 문맥별 재작성 + 필터 "지우기" 칩.
- **표준:** S2(figure색 확인)·S7/S9. **현재상태:** ⚠️ 공개토글·즐겨찾기 **로컬만(DB 미저장)** — `user_pins`에 visibility 컬럼 없음(§8 P2).
- **링크:** [`mockup-me-library.html`](../../mockup-me-library.html) · [`library.md`](./library.md) · [`LibraryWorkspace.tsx`](../../components/room/LibraryWorkspace.tsx) · [`app/room/library/page.tsx`](../../app/room/library/page.tsx).

### 6.9 노트 · 글쓰기 (Write) ★
- **존재이유:** "내가 쓴 글 = 가장 강한 취향 신호(×1.5)"인 비평 컴포저. **지배엔진** ①.
- **디테일 의도(WHY):** ①"어디서 쓰기 시작?" 불명 → **"+ 새 글" 라벨 버튼** + 유도형 placeholder. ②"저장"이 공개/비공개 무관하게 동일 → **맥락형 게시 버튼**(비공개="초안 저장" / 공개=초록 "게시 · 「영화/figure/트로프」로 · 내 프로필에 공개" — 라우팅 목적지를 버튼에 명시, least-astonishment). ③자동저장 표시 추가(보존 불안 제거). ④유형(강한 오독/코멘트/트로프) 정의를 상시 힌트 + 유형별 placeholder. ⑤boost 배너 접기(localStorage).
- **표준:** S9·**S10(인스펙터 반응형 예외 — write는 좁은 폭에서도 첨부 레일 유지)**. **현재상태:** ❌ 저장·게시가 **로컬 draft만**(`takes` RLS는 견고하나 부르는 mutation 경로 없음) → 향후 게시 시 **HTML sanitize 필수**(§8 P1).
- **링크:** [`mockup-me-write.html`](../../mockup-me-write.html) · [`write.md`](./write.md) · [`WriteWorkspace.tsx`](../../components/room/WriteWorkspace.tsx) · [`app/room/write/page.tsx`](../../app/room/write/page.tsx).

### 6.10 동행 (Pair · 가면무도회) ★
- **존재이유:** 슬로우 SNS — "오늘 누구와 통했나"를 가면 쓴 한 장으로. 싱크율 = 두 사용자 `v_loved` 코사인.
- **디테일 의도(WHY):** ①보임/가림 규칙이 텍스트로만 존재 → **`.veil` 칩**(눈 3개=공개: 싱크율·교집합 앵커·공통 계보 / 눈가림 3개=비공개: 실명·사진·개별평점·전체취향)로 *말 안 해도* 보게. ②주 행동 위계 부재 → **"가면 벗기"를 `.pri`(보라 글로우)**, 나머지 격하. ③**신뢰 보장 한 줄**("가면 벗기는 공개 프로필로만 — 그 이상은 결코 안 보임"). ④회전 카운트다운을 *만료*가 아니라 *기대감*("자정 KST면 새 한 명으로 회전"). ⑤"형성 중 1명"이 빨강(하락)으로 오독 → 골드 중립 + 오늘 셀 표식.
- **표준:** S2(masque 토큰·forming 골드)·S5. **현재상태:** ❌ **완전 스텁** — 파트너/매칭/초대/동의 테이블 전무. `me_pair_state`는 "나 외 loved≥1 유저 COUNT"만. **구현 시 부분노출을 RPC 레벨에서 강제**(§8 P1).
- **링크:** [`mockup-me-pair.html`](../../mockup-me-pair.html) · [`pair.md`](./pair.md) · [`PairWorkspace.tsx`](../../components/room/PairWorkspace.tsx) · [`app/room/pair/page.tsx`](../../app/room/pair/page.tsx).

### 6.11 공개 프로필 ★★ (라이트 스킨 — 다크 셸 밖)
- **존재이유:** (방문자) "이 사람이 어떤 시네필인지 3초에" / (오너) "무엇이 공개·비공개인지 통제". **라이트 "Living Paper" 스킨 절대 유지 — 다크로 전환 안 함.**
- **디테일 의도(WHY):** ①자랑할 업적(완파·근접)이 뱃지 모듈에 묻힘 → **대표 업적 하이라이트 스트립**(NAV 카드 바로 아래, BADGES에서 파생). ②뱃지 상태 라벨 없음 → **정복/근접/잠금 텍스트 배지**(S4 4-state 매핑). ③섹션 공개 토글이 17px 아이콘 → **진짜 pill 버튼**(role=switch) + **라이브 카운터**("공개 N · 비공개 M"). ④"방문자 시점 미리보기" 자명화.
- **표준:** S4 완파 4-state · S9 공개토글(라이트) · 다크 토큰 미도입. **금지 노출 확인:** 13서브·신뢰도·prompt_sha·개별평점·취향벡터 없음. **현재상태:** ✅ `public_portfolio(_meta)` 이중 게이트 · ⚠️ 셸의 `/u/me` 링크 404(§8 P1).
- **링크:** [`mockup-me-profile.html`](../../mockup-me-profile.html) · [`profile.md`](./profile.md) · 구현 [`app/u/[username]/page.tsx`](../../app/u/[username]/page.tsx).

### 6.12 지리 Atlas + 6.13 감독 정복 (목업 없는 추가 구축)
- **지리 Atlas** (`/room/atlas`): 본 영화 촬영지·무대를 손수 그린 SVG 세계지도 + 국가별 커버리지 + 지리 블라인드(④). 외부 타일 호출 0(프라이버시 최적). ⚠️ 대륙매핑 하드코딩·점 미중복제거. 구현 [`AtlasWorkspace.tsx`](../../components/room/AtlasWorkspace.tsx) · [`app/room/atlas/page.tsx`](../../app/room/atlas/page.tsx) · RPC `me_geo_coverage`.
- **감독 정복** (`/room/auteurs`): seen≥1 감독별 오이브르 정복도(seen/total) 완파 4-state + 도장깨기. ⚠️ "전 작품 정복" 카피는 실은 *우리 DB 기준*. 구현 [`AuteursWorkspace.tsx`](../../components/room/AuteursWorkspace.tsx) · [`app/room/auteurs/page.tsx`](../../app/room/auteurs/page.tsx) · RPC `me_auteur_conquest`.
- (전 감사: [`ROOM-LOGIC-AUDIT.md`](./ROOM-LOGIC-AUDIT.md) §2.6–2.9, §4 지도호출.)

---

## 7. 현재 구현 상태 + 감사 요약

전체·근거: [`ROOM-LOGIC-AUDIT.md`](./ROOM-LOGIC-AUDIT.md)(섹션별 [확정/부족/보강안/개인정보] + 개인정보 흐름표 + 지도·커넥션 세부 + P0–P3). 사이트 전체 현황: [`STATE.md`](../STATE.md).

- **잘 지켜진 것(잠금):** never-blend · NAV 단조 · 색토큰 분리 · 개인정보 스코핑(RPC 17종 DEFINER+auth.uid) · 정직한 빈 상태. **타 유저 데이터 누출 경로 없음**(기본 private, 공개프로필 금지필드 미노출 확인).
- **구조적 사실:** ~20 `me_*` room RPC + Cinecodex 전 레이어가 **마이그레이션 밖(out-of-band, DB 직접 생성)** — 버전관리 갭.

---

## 8. 풀어야 할 숙제 (the homework) — 정확히

이 섹션이 인수받는 AI가 *다음에 할 일*이다. 우선순위는 [`ROOM-LOGIC-AUDIT.md`](./ROOM-LOGIC-AUDIT.md) §7과 로직 [`BUILD-ORDER.md`](../logic/BUILD-ORDER.md)를 통합.

**P0 — 로직 정합성: ✅ 전부 완료 (2026-07-03, 마이그레이션 0027–0030 + 프론트 배선)**
1. ✅ **`me_coverage()`(엔진⑦)** — 전 facet(canon/award/national/auteur) **실측 분모**(`count(distinct film_lineage)`), `p_min_total`·`p_limit` 파라미터, S4 4-state. 커맨드센터 매트릭스(facet 그룹) + 분석 축커버리지 교체 완료.
2. ✅ **`me_blindspots()`(엔진④)** — 전 facet 미답/얕음(<3%) + **생산성 게이트**(v_watched × 계보 앵커 코사인, 0.35–1 클립) + opportunity 순위. 블라인드 칩 클릭 → 기회값 분해 인스펙터(설명가능).
3. ✅ **`me_recommend_wwi` v2** — conquer=진행 중(50–99%) 계보 완파 진척 조인, gap=실 블라인드 계보 조인(disc≥55 프록시 제거). 제외 규칙 정밀화(seen/dismissed만 제외 — 담긴 후보는 유지) + `in_watchlist` 반환.
4. ✅ **쓰기 경로 배선** — `me_set_watchlist`·`me_mark_seen`·`me_dismiss`(user_movies.dismissed 신설)·`set_pin_visibility`+`me_toggle_fav`(user_pins.visibility 신설)·`save_take`(**서버측 HTML 화이트리스트 새니타이즈** `sanitize_user_html`, takes.figure_id NOT NULL 완화). 워치리스트/데스크/서재/노트 프론트 전부 낙관적 UI+토스트로 배선.
5. ✅ **셸 티커/시스템카드** — `me_system_status()`(채점편수·모델버전·최근 재계산·취향벡터 수·최고 정전가 실측)로 교체. 하드코딩 0.

**P1 — 기능 완성 + 프라이버시:**
6. ✅ **`nav_snapshots` + `me_nav_history()`** — RLS(본인 select), `rate_film`/`me_mark_seen`이 스냅샷 적재, 데스크 자산곡선 실렌더(스냅샷+오늘 라이브, 단조 어서션 포함, 합성 없음).
7. **동행 `pair_matches` + `me_today_pair()` + consent** — 싱크율·교집합 앵커만 RPC 레벨에서 노출(실명·개별평점·전체취향 금지). *(잔여)*
8. ✅ **노트 `save_take()` + HTML sanitize** — 완료(4번에 포함). 단, 영화 첨부→페이지 라우팅은 형성 중(UI 명시).
9. **`/api/geo` 스코프·레이트리밋 · Atlas 대륙매핑 DB화** *(잔여)* · ✅ **`/u/me` 404 수정**(`app/u/me/route.ts` 302 → `/u/{username}`).

**P2/P3:** 서재 `user_pins.visibility` 컬럼 · 컬렉션 "최근순"·"발견" 배선 · auteurs "DB 기준" 카피 · SVG 점 dedup · per-sub 비평 rationale(fake 금지) · CmdK 링크 룸 통일.

**엔진 빌드 관점(BUILD-ORDER):** 룸의 현재 `me_*`는 **W0–W4의 단순화 프로토타입**이다. 정식 엔진(취향벡터 앵커·정전가 재캘리브레이션·커버리지·WWI 6이유·NAV 4축 분해)은 [`docs/logic/`](../logic/)에 완전 명세돼 있으나 아직 **substrate만 준비**(예: ① 앵커 없이 출시 금지 규칙 미충족). 정식화 순서 = **W0 ② 재캘리브레이션 ∥ W1 ① 취향벡터 → W2 ⑦ → W3 ⑤ → W4 ⑧③④.**

**구조:** room RPC 20종 + Cinecodex DDL을 **마이그레이션으로 역커밋**(리뷰·롤백·재현). *(부분 진행: 이번 신설·개정분은 전부 `supabase/migrations/0027–0030`으로 커밋됨 — me_coverage·me_blindspots·me_recommend_wwi v2·쓰기 mutation 6종·sanitize_user_html·me_library v2·me_system_status·nav_snapshots·me_nav_history·rate_film v2. 기존 20종 역커밋은 잔여.)*

---

## 9. 데이터 · RPC · 색토큰 레퍼런스

**Room RPC(전 SECURITY DEFINER; 개인 auth.uid 스코프):** `me_portfolio_nav`·`portfolio_breakdown`·`me_recommend_wwi(λ,limit)`(v2: conquer/gap 실태깅+in_watchlist)·`me_collection`·`me_taste_neighbors(limit)`·`me_taste_signature(limit)`·`me_figure_cloud(limit)`·`me_watched_scored`·`me_takescore_summary`·`me_watchlist_scored`·`me_auteur_conquest(limit)`·`me_geo_coverage`·`me_library`(v2: visibility)·`me_authored_takes`·`me_rate_stats`·`me_recent_ratings(limit)`·`me_pair_state` · **엔진 RPC(2026-07-03 신설):** `me_coverage(min_total,limit)`⑦·`me_blindspots(limit,min_total,min_aw)`④·`me_nav_history(days)`·`me_system_status` · **mutation:** `rate_film`(+NAV 스냅샷)·`me_set_watchlist`·`me_mark_seen`(+스냅샷)·`me_dismiss`·`set_pin_visibility`·`me_toggle_fav`·`save_take`(sanitize)·`me_snapshot_nav` · 공개: `cinecodex_card(slug)`·`film_room_context(slug)`·`film_search(q,limit)`·`takescore_for_slugs(slugs[])`. **미존재(신설 대상):** `me_today_pair`.

**색 토큰(`room.css`):** `--risk #D64518`(위험 R) · `--red`/`--conquer #E3120B`(완파/정복) · `--blind #E8B23A`(블라인드) · `--forming #C8922B`(형성중) · `--masque #9B8CF0`(동행) · 6이유(safe teal·frontier blue·canon gold·gap amber·conquer red·reading violet). **risk ≠ conquer 필수.**

**실 Cinecodex 값(목업 진정성 — 이 숫자를 쓸 것; [`HTML-DESIGN-HANDOFF.md`](./HTML-DESIGN-HANDOFF.md) §4):**

| 영화 | V | C | R | U(λ1) | S | 성격 |
|---|---|---|---|---|---|---|
| Tokyo Story | 93 | 51 | 7 | 86 | 6.0 | 최고가·최저위험 |
| Yi Yi | 86 | 50 | 10 | 76 | 3.6 | 안전한 걸작 |
| Vertigo | 86 | 50 | 17 | 69 | 2.1 | (정전가 84.5) |
| 2001 | 88 | 60 | 21 | 67 | 1.8 | 난해 |
| Stalker | 91 | 79 | 32 | 59 | 1.3 | 최고 난도·분열 |
| Parasite | 67 | 33 | 18 | 49 | 1.0 | 접근성↑ |
| La La Land | 57 | 35 | 39 | 19 | 0.2 | 분열적 대중작 |
| Babylon | 55 | 49 | 51 | 4 | 0.1 | 야심·실패 위험 |
| Avengers: Endgame | 37 | 40 | 33 | 4 | −0.4 | 저가치 |

(전체 25편 표 = HANDOFF §4.)

---

## 10. 파일 링크 인덱스 (전체)

**의도·표준 문서 (docs/ux/):**
- [`HTML-DESIGN-HANDOFF.md`](./HTML-DESIGN-HANDOFF.md) — 왜 이렇게(디자인 의도·셸·S11·강약·실 Cinecodex 표)
- [`SHARED-STANDARD.md`](./SHARED-STANDARD.md) — S1–S11 표시 정본
- [`00-UX-REVIEW-GUIDE.md`](./00-UX-REVIEW-GUIDE.md) — 검토 4렌즈 방법론
- [`CONFLICTS-AND-COORDINATION.md`](./CONFLICTS-AND-COORDINATION.md) — 12 [⚠COORD] 클러스터(SHARED-STANDARD가 해소)
- [`PLAN-room-implementation.md`](./PLAN-room-implementation.md) — 구현 계획(Phase 1 기준, 일부 낡음)
- [`ROOM-LOGIC-AUDIT.md`](./ROOM-LOGIC-AUDIT.md) — **현재 구현·감사·개인정보·P0–P3 숙제(개정 정본)**
- 페이지별 UX 의도: [`command-center.md`](./command-center.md) · [`collection.md`](./collection.md) · [`watchlist.md`](./watchlist.md) · [`asset-desk.md`](./asset-desk.md) · [`analysis.md`](./analysis.md) · [`onboard-rate.md`](./onboard-rate.md) · [`library.md`](./library.md) · [`write.md`](./write.md) · [`pair.md`](./pair.md) · [`profile.md`](./profile.md)

**로직 캐논 (docs/logic/):** [`00-INDEX.md`](../logic/00-INDEX.md) · [`BUILD-ORDER.md`](../logic/BUILD-ORDER.md) · [`LOGIC-SPEC-FULL.md`](../logic/LOGIC-SPEC-FULL.md) · 엔진 [`01-taste-vector`](../logic/01-taste-vector.md) [`02-standing`](../logic/02-standing.md) [`03-lineage-relevance`](../logic/03-lineage-relevance.md) [`04-gap`](../logic/04-gap.md) [`05-wwi`](../logic/05-wwi.md) [`06-similarity`](../logic/06-similarity.md) [`07-coverage`](../logic/07-coverage.md) [`08-nav-level`](../logic/08-nav-level.md) [`09-intrinsic-cinecodex`](../logic/09-intrinsic-cinecodex.md) · 불변식 [`phase0-invariants.md`](../logic/phase0-invariants.md)

**HTML 목업 (리포 루트; 라이브 `https://metatake.net/my_room/<파일>`):**
[`command-center`](../../mockup-me-command-center.html) · [`collection-list-v2`](../../mockup-me-collection-list-v2.html) · [`watchlist`](../../mockup-me-watchlist.html) · [`asset-desk`](../../mockup-me-asset-desk.html) · [`analysis-v2`](../../mockup-me-analysis-v2.html) · [`onboard-rate-v2`](../../mockup-me-onboard-rate-v2.html) · [`library`](../../mockup-me-library.html) · [`write`](../../mockup-me-write.html) · [`pair`](../../mockup-me-pair.html) · [`profile`](../../mockup-me-profile.html) · [`film-cinecodex`](../../mockup-me-film-cinecodex.html)*(라이브 미배포)*. 변형본 백업 = `mockup-archive/`.

**구현 (components/room/, app/room/):** 셸 [`RoomShell`](../../components/room/RoomShell.tsx)·[`InspectorContext`](../../components/room/InspectorContext.tsx)·[`CmdK`](../../components/room/CmdK.tsx)·[`room.css`](../../app/room/room.css). 워크스페이스: [`CommandCenter`](../../components/room/CommandCenterWorkspace.tsx)·[`Collection`](../../components/room/CollectionWorkspace.tsx)·[`Watchlist`](../../components/room/WatchlistWorkspace.tsx)·[`Desk`](../../components/room/DeskWorkspace.tsx)·[`Analysis`](../../components/room/AnalysisWorkspace.tsx)·[`Atlas`](../../components/room/AtlasWorkspace.tsx)·[`Auteurs`](../../components/room/AuteursWorkspace.tsx)·[`Rate`](../../components/room/RateWorkspace.tsx)·[`Library`](../../components/room/LibraryWorkspace.tsx)·[`Write`](../../components/room/WriteWorkspace.tsx)·[`Pair`](../../components/room/PairWorkspace.tsx)·[`EvalCard`](../../components/room/EvalCard.tsx)·[`CinecodexCard`](../../components/room/CinecodexCard.tsx)·[`FilmContentHub`](../../components/room/FilmContentHub.tsx). 라우트 그룹 [`app/room/`](../../app/room/).

---

## 11. 개정 로그
- **2026-07-03** §8 P0 전항 + P1 6·8·9(/u/me) 완료 반영. 신설: `me_coverage`⑦·`me_blindspots`④(생산성 게이트)·`me_system_status`·`nav_snapshots`/`me_nav_history`/`me_snapshot_nav`·mutation 6종(`me_set_watchlist`/`me_mark_seen`/`me_dismiss`/`set_pin_visibility`/`me_toggle_fav`/`save_take`+`sanitize_user_html`). 개정: `me_recommend_wwi` v2(conquer/gap 실태깅·in_watchlist·제외규칙 정밀화)·`me_library` v2(visibility)·`rate_film`(스냅샷). DDL: `user_movies.dismissed`·`user_pins.visibility`·`takes.figure_id` NULL 허용·`nav_snapshots`(RLS). 전부 `supabase/migrations/0027–0030` 역커밋. 프론트: 커맨드센터/분석(⑦④ 실배선)·워치리스트/데스크(쓰기+자산곡선)·서재(공개토글·즐겨찾기 영구화)·노트(save_take)·셸(티커/시스템카드 실데이터)·`/u/me` 리다이렉트.
- **2026-07-02** 최초 작성. HTML-DESIGN-HANDOFF·SHARED-STANDARD·00-UX-REVIEW-GUIDE·CONFLICTS·10 페이지 UX 의도·9 로직 엔진·ROOM-LOGIC-AUDIT를 단일 인수인계로 통합. 의도(디테일 포함) + 파일 링크 인덱스 + 풀어야 할 숙제(P0–P3 + 엔진 W0–W4) 확립.
