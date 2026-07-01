# 코어 엔진 ⑥ — 유사 · 상호추천 (Similarity & Mutual Recommendation)

*개인화 로직 명세 시리즈 6/8. 작성 2026-06-26. 짝: `docs/logic/01-taste-vector.md`(임베딩 입력), `docs/logic/02-standing.md`(authority 입력·movement/style 제외 경계), `docs/SUITE-AUDIT-personalization.md`(어휘). 1차 출처: `handoff/00_MASTER_HANDOFF.md`(film_affinities·auteur_edges·film_lineage), `handoff/04_auteur_spec.md`(comparable_to), `handoff/06_taxonomy_map.md`(movement/style). 목업: `mockup-me-onboard-rate-v2.html`(모멘텀 루프), `mockup-me-analysis-v2.html`(상호추천 그래프), `mockup-me-command-center.html`(별자리). 마지막에 8개를 합친다.*

---

## 1. 우리가 하려는 것 (처음 듣는 사람을 위해)

**한 문장:** 영화 한 편(또는 감독 한 명)을 중심에 놓았을 때 — *그것과 닮은* 다른 영화·감독을 찾아 **추천 그래프**를 그리는 엔진. 즉 *"이것을 좋아했다면 — 저것도"* 를 계산하는 인접 관계의 공장.

엔진 ①(취향 벡터)이 *나라는 한 점*을 그렸고, ②(정전가)가 *영화 한 편의 시장가*를 매겼다면, ⑥은 **점과 점 사이의 선분**을 긋는다. MetaTake의 슬로건이 *"영화들 사이의 무의식적 선분"* 인데, 그 선분을 **객관 데이터로 실제로 잇는 것**이 이 엔진의 일이다. ①·②가 *노드의 속성*이라면 ⑥은 *간선(edge)* 그 자체다.

자산운용 비유로: ①이 *내 투자 성향 프로파일*, ②가 *종목의 시장가*라면, ⑥은 **종목 간 상관관계 행렬(correlation matrix)** 이다. "삼성전자를 들었으면 SK하이닉스도" 같은 *동조 종목 추천*. 다만 우리의 상관은 가격 공분산이 아니라 **계보 공유 + 의미 인접** 두 겹으로 잰다.

**세 곳에서 소비된다 (이 엔진의 존재 이유).** 유사 그래프는 한 화면이 아니라 *세 모멘트*를 먹인다:

| 소비처 | 무엇 | 어느 면 |
|---|---|---|
| ① **온보딩 모멘텀 루프** | 방금 평가한 영화 X의 *이웃이 화면으로 날아 들어온다*(fly-in) → "이거 보셨다면 — 이것도?" | `onboard-rate-v2` |
| ② **분석면 상호추천 그래프** | 보유분을 중심으로 감독↔감독·영화↔영화 추천 그래프를 그린다 | `analysis-v2` |
| ③ **WWI(엔진⑤) safe 후보 풀 + 별자리** | safe 추천이 채점할 *후보를 애초에 만들어 공급* + 별자리 시각화 | `command-center`, `watchlist` |

**핵심 차별점 — 우리는 "비슷한 장르"가 아니다.** 대부분의 서비스는 "같은 액션·같은 배우"로 유사를 잰다. MetaTake의 유사는 **두 종류의 닮음**을 합친다: (i) *객관 인접* — 같은 칸 팔메, 같은 감독 계보, 같은 사조에 함께 속함(`film_affinities`·`auteur_edges`), (ii) *의미 인접* — 두 영화에 달린 강한 오독(take)·형상(figure) 임베딩의 코사인. **계보는 "사실상 이웃", 임베딩은 "정신적 이웃"** 이다. 둘 다 써야 *섬뜩하게 맞으면서도 설명 가능한* 추천이 나온다.

**★ 사조·스타일은 *여기서* 쓴다 (엔진②와의 명시적 분기).** 정전가(②)는 movement/style facet을 **제외**했다 — "슬로우 시네마라서 더 좋은 영화"는 범주 오류, 닮음은 품질이 아니기 때문이다. 그런데 ⑥은 *바로 그 닮음의 엔진*이다. 그러므로 **movement·style은 ⑥의 1급 신호**다. 같은 사조(프랑스 뉴웨이브)·같은 스타일(Bressonian)에 속한다는 것은 *품질의 근거는 아니지만 인접의 강력한 근거*다. 정전가에서 버린 facet이 여기서 부활한다 — 이 경계가 ②와 ⑥을 가르는 정의다.

---

## 2. 목표 산출물 (사용자 경험 중심)

⑥은 점수(②)도 좌표(①)도 아니다. **그래프와 리스트**다. 사용자가 보는 것:

| 사용자가 보는 것 | 어디서 / 무엇에서 나오나 |
|---|---|
| **온보딩 fly-in** — "「버닝」 보셨다면 — 이것도?" 5장이 옆에서 *날아 들어옴* | 방금 평가한 X의 `neighbors(X)` 상위 5 (§5-e, `onboard-rate-v2` 모멘텀 레일) |
| **감독 상호추천 그래프** — 채운 노드=본 감독, 테두리 노드=그들이 *추천하는* 미관람 감독, 간선=comparable | `comparable(director)` 그래프 (`analysis-v2` `#agraph`) |
| **영화 상호추천 리스트** — "공유 리니지로 끌어당기는 미관람작 — 연결 많을수록 ↑" | `film_affinities` lineage_score 정렬 (`analysis-v2` aflist) |
| **별자리(constellation)** — 보유분(점등) + 인접 추천(테두리) + 공유 라인 노드(칸 팔메·S&S)가 한 성좌로 | `candidate_pool` + 공유 라인 시드 (`command-center`) |
| **"왜 이웃인가" 근거 한 줄** — "같은 감독 봉준호 · 같은 칸 팔메 · 코사인 0.89" | 간선의 `reasons[]`(설명가능성·필수) |
| **WWI safe 후보가 *섬뜩하게 맞는* 느낌** | safe가 채점하는 후보 풀을 ⑥이 공급(§5-f) |

**저장(간선 단위, 머티리얼라이즈):**
```
film_affinities(film_id, related_film_id, lineage_score, embed_sim, total_affinity,
                shared_list_ids uuid[],   -- 어느 라인을 공유하는가(설명가능성·필수)
                reasons jsonb, model_version, computed_at)
auteur_edges(auteur_id, related_auteur_id, relation, edge_weight,
             shared_list_ids uuid[], embed_sim, source,  -- curated('comparable_to') vs computed
             reasons jsonb)
```

**경험 품질의 기준:** 추천 이웃이 "어떻게 이걸 알았지?"면 성공. "그냥 같은 장르네"면 실패. 그 차이는 *계보+의미 두 겹을 썼는가*에서 갈린다. 그리고 **모든 간선은 `reasons[]`로 한 줄 납득**시켜야 한다(블랙박스 금지, `07` 원칙). 간선 하나당 *"왜 닮았나"* 가 없으면 출시 금지.

---

## 3. 활용 가능한 데이터

⑥은 **거의 전부 객관 데이터 + 엔진① 임베딩**으로 돌아간다. 사용자 데이터는 *어느 노드에 불을 켜느냐*(본 영화/감독 표시)에만 쓰인다 — 그래프 위상 자체는 전역.

| 데이터 | 위치 | 신호 강도 | 역할 |
|---|---|---|---|
| **공유 라인 멤버십** | `film_lineage`(10,238행 / 115라인) | ★★★★★ | 두 영화가 *같은 라인*(칸·정전·감독·사조)에 함께 들어감 = 계보 인접. **lineage_score의 1차 재료.** |
| **`film_affinities`** | `shared_list_ids uuid[]`, `lineage_score`(handoff additive) | ★★★★★ | 위를 미리 집계한 영화↔영화 간선 테이블 |
| **take 임베딩** | `takes.embedding vector(1536)` | ★★★★ | 의미 인접(영화 centroid 코사인) |
| **figure 임베딩** | `figures.embedding vector(1536)` | ★★★ | take 없는 영화의 폴백 의미 신호 |
| **`auteur_edges`** | `comparable_to`(53행 curated, §5b auteur_spec) | ★★★★★ | 감독↔감독 *큐레이션된* 발굴 간선(신진→기성). 파생이 놓치는 고품질 신호 |
| **감독 멤버십** | `film_lineage`(facet=auteur)→공유 감독 | ★★★★ | 같은 감독 = 최강 영화 인접(`sim` 가중 5) |
| **사조 멤버십** | `lineage_lists`(facet=movement), `06_taxonomy_map` | ★★★★ | ★ 같은 사조 = 인접. **②는 버렸으나 ⑥의 1급 신호** |
| **스타일 멤버십** | `lineage_lists`(facet=style, auteur-adjective: Bressonian…) | ★★★ | ★ 같은 스타일 = 인접. style↔auteur 다리(`namesake`) |
| **authority_weight** | `lineage_lists.authority_weight`(0–1)·`auteurs.group`(G1–G5) | ★★★ | 공유 라인의 *가중*(선택적 라인일수록 인접 강함) |
| **selectivity(IDF)** | `lineage_lists.selectivity`(파생) | ★★★ | *희소한* 라인 공유가 *흔한* 라인 공유보다 더 강한 인접 신호 |
| **국가·연대** | `films.tmdb_extra.country`, `year` | ★★ | 폴백 인접(같은 국가·근접 연대), `sim` 가중 1 |
| **정전가(②)** | `film_scores`(엔진②) | ★★ | 콜드스타트 정렬·후보 풀 우선순위(유명작 먼저) |
| **취향 벡터(①)** | `user_taste_profile.v_loved` | ★★ | safe 후보를 *내 취향 쪽으로* 끌어오는 입력(WWI 단계) |

핵심: **가장 강하고 차별적인 재료는 `shared_list_ids`(공유 라인) + take 임베딩의 결합.** 단 — 일부 영화는 라인이 적게 적재돼 있고(thin lineage), 일부는 take가 없다(thin content). *어느 한 겹이 비면 다른 겹으로 받친다*(§4-a). 그리고 라인 미적재와 "진짜 인접 없음"을 구분해야 한다(②-d와 같은 거짓 음성 문제).

---

## 4. 본질적 문제 · 설계 주의점 · 방향성

여기가 설계의 심장이다. 결정 지점 8개, 각각 *문제 → 권장 방향*.

### (a) ★영화↔영화 유사의 두 경로 — 계보 vs 임베딩, 어떻게 결합하나

영화 인접에는 **성격이 다른 두 닮음**이 있고, 둘 다 필요하다.

- **(i) 계보 기반 — `film_affinities`의 lineage_score.** 두 영화가 *몇 개의 라인을 공유*하는가(`shared_list_ids`). 〈기생충〉과 〈브로크백 마운틴〉이 둘 다 칸·오스카·정전에 속하면 그 라인들이 둘을 잇는다. 이것은 **객관 인접** — "세상이 이 둘을 같은 칸에 넣었다"는 사실. *설명 가능*(공유 라인을 그대로 보여줌)하고 *안정적*이다. 단순 공유 *수*가 아니라 **authority·selectivity로 가중**해야 한다: 흔한 라인(TSPDT 1000에 둘 다 있음)을 공유하는 것보다 *희소한 라인*(칸 팔메 같은 해, 같은 감독)을 공유하는 게 훨씬 강한 인접이다 — IDF의 정신.

- **(ii) 취향/내용 기반 — 엔진① 임베딩 코사인.** 두 영화의 take/figure centroid 벡터 코사인. 이것은 **의미 인접** — "두 영화가 *같은 방식으로 읽힌다*"(절제된 응시·전이된 죄). 계보가 *못 잡는* 닮음을 잡는다: 칸에도 정전에도 안 들어간 두 무명작이 *해석적으로는 형제*일 수 있다.

- **방향 — 두 겹을 곱이 아니라 *보완 합*으로, 동적 가중.**
  ```
  total_affinity(a,b) = w_L · lineage_score(a,b) + w_E · embed_sim(a,b)
  ```
  핵심은 **가중을 데이터 풍부도에 비례**시키는 것(①-c의 α 정신). 두 영화 다 라인이 풍부하면 계보를 신뢰(w_L↑); 라인이 빈약하지만 take가 많으면 임베딩에 의존(w_E↑). *어느 한 겹이 0이어도 다른 겹으로 간선이 살아남게.* 이로써 *정전 영화끼리는 계보로, 무명작끼리는 의미로* 자연히 연결된다.
  - **왜 곱이 아닌가:** 곱(AND)이면 *둘 다 높아야* 간선이 생겨, "계보로는 멀지만 의미로는 형제"인 발굴 간선이 죽는다. 합(OR-ish)이 발굴을 산다.
  - **설명가능성:** `reasons[]`에 두 경로를 따로 적는다 — "공유: 칸 팔메·S&S 2022 / 의미 코사인 0.89". 사용자는 *어느 쪽으로 닮았는지* 본다.

### (b) ★감독↔감독 comparable — 큐레이션 간선 vs 계산형, 누가 이기나

감독 인접도 두 출처가 있다.

- **큐레이션 — `auteur_edges`(comparable_to, 53행).** 사람이 손으로 그은 간선(Christos Nikou → Lanthimos, Hlynur Pálmason → Reygadas). `04_auteur_spec` §5b의 핵심: *신진→기성* 발굴 경로. **파생 유사도가 놓치는 고품질 신호** — 필모가 얕은 신진은 임베딩·계보가 빈약해 계산형으론 안 잡히는데, 큐레이션은 잡는다.
- **계산형 — 공동 멤버십·스타일·임베딩.** 두 감독이 *같은 사조/스타일/국가 정전*에 함께 들어감 + 두 감독 대표작 임베딩 centroid 코사인 + 같은 라인 공유. 53행을 넘어 *전 감독 쌍*으로 확장한다.

- **방향 — 큐레이션 우선, 계산형 보강(union, 큐레이션이 tie-break 이김).**
  - `auteur_edges`의 큐레이션 간선은 **항상 포함하고 `edge_weight` 바닥을 높게**(예: ≥0.7) 준다 — 사람이 보증한 신호.
  - 계산형 간선은 그 위에 *추가*된다(공동 멤버십 수·스타일 공유·임베딩 코사인의 가중 합). 큐레이션과 계산형이 같은 쌍을 가리키면 `source='both'`로 합치고 가중 상향(이중 보증).
  - **본 감독 → 추천 감독(미관람) 그래프(목업 정본).** `analysis-v2`가 못박은 시각: *채운 노드 = 본 감독, 테두리 노드 = 그들이 comparable로 가리키는 미관람 감독, 간선 = comparable*. 즉 그래프는 **내 본 감독을 중심으로 한 발 바깥의 미관람 감독**을 보여준다 — 추천의 정의 그 자체. (방향성: 신진→기성 간선이지만, 추천 화살은 *본 감독에서 미관람 감독으로* 읽는다.)
  - **공개 노출 주의(`04` §3 수정 2):** 감독 `group`(G1–G5)은 *내부 가중*에만 — 살아있는 감독을 공개 랭킹으로 노출하면 평판 리스크. 그래프는 *추천 관계*만 보이고 *등급*은 숨긴다.

### (c) ★사조·스타일은 *여기서* 쓴다 — ②와의 경계 (재확인·범주 구분)

이 엔진의 정의적 결정. **엔진②(정전가)는 movement/style facet을 제외**했다(품질 아님). **엔진⑥은 movement/style을 적극 활용**한다(*닮음*의 영역). 이 분기를 흐리면 안 된다.

- **범주 구분 (명확히):**
  - `movement`(사조: 프랑스 뉴웨이브·이탈리아 네오리얼리즘·Cinema Novo…) — **계보형 닮음**. 두 영화가 같은 사조 라인에 멤버. lineage_score 입력. `06_taxonomy_map`의 `subtype`(wave/realism/genre-cycle…)으로 결을 더 잰다.
  - `style`(스타일: Bressonian·Slow Cinema·Lynchian…) — **미학형 닮음**. 특히 *auteur-adjective*(Bressonian)는 `namesake`로 directors에 링크되어 **style↔auteur 다리**를 놓는다(브레송 스타일 영화 ↔ 브레송 감독). 의미 인접과 계보 인접을 잇는 교차연결.
- **방향:**
  - movement/style 공유를 lineage_score에 넣되, **selectivity로 가중**한다 — "둘 다 슬로우 시네마"는 약한 인접(흔함), "둘 다 Zanzibar 그룹"은 강한 인접(희소).
  - **품질로 새지 않게 방화벽:** 이 사조 신호는 *오직 ⑥(인접)에만* 흐르고 *②(정전가)로 역류 금지*. `film_scores`는 movement/style을 안 본다. 두 엔진이 같은 `film_lineage`를 읽되 *facet 화이트리스트가 정반대*다 — ②는 award·canon·national·auteur·festival·section, ⑥은 그 전부 **+ movement·style**.
  - ⚠️ `films.genres`(TMDb 장르)와 `movement/genre-cycle`(누아르·지알로) 혼동 금지(`06` 경고). 장르는 약한 폴백, 사조는 1급 신호.

### (d) 그래프 시딩 — 한 중심 노드에 몇 개를 보여줄까 (degree·임계)

그래프는 *전부* 보여주면 헤어볼(hairball)이 된다. 한 중심 노드 주변에 **무엇을·몇 개를** 띄울지 규칙이 필요하다. 기존 `graph_*_seed` RPC(`graph_portfolio_seed`, `PLAN` §5.1) 패턴을 따른다.

- **방향 — degree 상한 + affinity 임계 + 계층 시드:**
  - **중심(center):** 영화 그래프는 *방금 평가/선택한 영화* 또는 *보유 중심작*; 감독 그래프는 *내 본 감독들*.
  - **1차 이웃(degree-1):** `total_affinity`(영화) 또는 `edge_weight`(감독) 상위 **K개**만(예: 영화 K=6–8, 감독 K=5). 임계 미만(τ) 간선은 자르기 — 약한 인접은 노이즈.
  - **계층 시드(별자리 정본, `command-center`):** 단순 영화-영화 간선만이 아니라 **공유 라인 노드를 중간 노드로** 끼운다 — 〈Parasite〉—[칸 팔메]—〈Yi Yi〉처럼 *왜 이어졌는지*가 노드로 보인다. 이게 헤어볼을 *설명 가능한 성좌*로 바꾼다. 본 영화(점등)·미관람 추천(테두리)·공유 라인(작은 컬러 노드) 3종 노드.
  - **degree 폭주 방지:** 한 라인(예: TSPDT 1000)이 1000편을 다 잇는 슈퍼노드면 무의미 → 라인의 `selectivity`로 가중 + 라인당 표시 멤버 상한. 흔한 라인은 시각화에서 *간선으로만, 노드 강조 없이*.
  - `graph_film_seed(center, k, τ)` / `graph_auteur_seed(uid, k)` RPC로 캡슐화 — 분석면·별자리·온보딩이 같은 시드 함수를 호출.

### (e) 온보딩 이웃 선택 — 방금 평가한 X의 이웃을 어떻게 고르나

`onboard-rate-v2` 모멘텀 루프의 심장: 한 편 평가하면 *비슷한 작품이 날아 들어온다*. 콜드스타트의 한복판(아직 취향 벡터도 없음)이라 **임베딩에 의존할 수 없다** — 가벼운 *구조 기반* 유사를 써야 한다. 목업이 이미 정본 공식을 못박았다:

- **방향 — 구조 가중 sim (목업 `sim()` 정본):**
  ```
  sim(X, f) = 5·[같은 감독] + 3·[같은 사조] + 1·[같은 국가] + 1·[연대 12년 이내]
  ```
  *같은 감독 > 사조 > 국가/연대* 위계. 상위 5편을 fly-in. (이것이 onboard 모멘텀의 실측 동작 — `near = filter(sim>0).sort(desc).slice(0,5)`.)
  - **왜 임베딩 아닌 구조인가:** 온보딩은 *즉답·저비용·설명 가능*이 생명("같은 봉준호 작품"이 "코사인 0.7"보다 납득됨). 라인을 막 불러온 직후라 라인 신호가 이미 풍부.
  - **콜드스타트 정렬 (유명작 우선):** 이웃 후보가 동점이면 **정전가(②) 높은 순**으로 — 처음엔 *아는 영화*가 떠야 사용자가 평가를 이어간다(낯선 무명작이 먼저 뜨면 모멘텀이 끊긴다). 세션이 깊어질수록 정전 가중을 낮추고 발굴을 섞는다.
  - **계보 불러오기 연동(`onboard-rate-v2`):** 평가하면 그 영화의 *감독·정전·영화제·사조 chip*이 "계보 불러오기"로 제시된다(상위 5 chip) → 사용자가 그 라인 전체를 평가 스트림으로 끌어옴. 이웃 선택과 라인 시딩이 한 루프.

### (f) 후보 생성 — WWI safe의 후보 풀을 이 엔진이 공급

엔진⑤(WWI)의 safe(안전자산)는 *후보를 채점*하지만 *후보를 만들지는 않는다*. 그 **후보 풀을 ⑥이 공급**한다 — ⑥은 추천의 *검색(retrieval)* 단계, ⑤는 *순위(ranking)* 단계.

- **방향 — `candidate_pool(uid)` = 보유분 이웃의 합집합:**
  - 내 보유분(특히 `v_loved` 쪽 사랑한 영화) 각각의 미관람 이웃을 `film_affinities`로 끌어온다 → 합집합 → 미관람 필터 → 중복 제거.
  - 감독 그래프의 *미관람 추천 감독* 대표작도 풀에 추가(`auteur_edges` comparable).
  - 이 풀을 ⑤의 safe가 `cos(v_loved, 후보)`로 채점·정렬. **⑥ = "후보가 누구냐", ⑤ = "그중 나에게 맞는 정도".** 역할 분리가 깨끗해야 한다(①-j의 경계 정신).
  - **풀 크기·다양성:** 풀이 *같은 감독 5편*으로 도배되지 않게 — 소스 다양성(감독·사조·정전별 상한). 발굴(엔진④)·정전(②) 후보와도 합쳐져 WWI 최종 풀이 된다.

### (g) 대칭성·방향성 — 간선은 양방향인가

영화 인접은 대체로 *대칭*(A가 B와 닮으면 B도 A와 닮음). 그러나 감독 comparable은 *비대칭*일 수 있다(신진 니코우→기성 란티모스는 "후계", 역방향은 약함). 또 추천은 *미관람 방향*으로만 의미 있다.

- **방향:** `film_affinities`는 **대칭**(한 쌍 1행, 양방향 조회). `auteur_edges`는 **방향성 보존**(relation=`comparable`/`heir`, a=신진·b=기성) 하되 *그래프 표시는 본 감독→미관람 감독*으로 재정렬. 저장은 방향 있게, *소비는 추천 방향*으로.

### (h) 미적재 vs 진짜 비인접 (거짓 음성) · 갱신

②-d와 같은 문제: 라인이 덜 적재된 영화는 *가짜로 이웃이 없다*. take가 0인 영화는 *의미 간선이 안 생긴다*.

- **방향:**
  - 두 겹 보완(§4-a)이 1차 방어 — 라인 없으면 임베딩으로, 임베딩 없으면 라인으로.
  - 둘 다 빈약하면 `affinity_confidence` 낮음 표시 + **국가·연대·장르 폴백 간선**(약한 점선)으로라도 고립 노드를 피한다.
  - `computed_at`·`model_version`로 *계산 안 됨*과 *진짜 고립*을 구분.
  - **갱신:** `film_affinities`는 영화 단위·전역(사용자 무관) → 라인/임베딩 변경 시 해당 영화 쌍 재계산(대량 배치, ②와 동일 패턴). 사용자별 부분(어느 노드 점등·candidate_pool)만 보유분 변경 시 갱신(TTL/dirty). 임베딩 `model_version` 불일치 시 embed_sim 전원 재계산.

---

## 5. 권장 설계 (1차안 — 못박을 공식)

> 모든 상수는 *가설*. 실데이터로 캘리브레이션(§6). 핵심은 *형태*를 고정하는 것.

**영화↔영화 계보 점수** (영화 a, b; 공유 라인 집합 L = `shared_list_ids`):
```
lineage_score(a,b) = Σ_{ℓ∈L}  authority_weight(ℓ) · selectivity(ℓ) · f_result_pair(ℓ)
  selectivity(ℓ) = log(N / film_count(ℓ))           # IDF: 희소 라인일수록 ↑
  f_result_pair(ℓ) = min(f_result(a,ℓ), f_result(b,ℓ))  # 둘 다 '수상'이면 강함
  # 같은 감독(facet=auteur) 공유는 ℓ 가중을 크게(거장 공유 = 강한 인접)
```

**영화↔영화 의미 점수:**
```
embed_sim(a,b) = cos( centroid(a), centroid(b) )      # take 우선, 없으면 figure (①-c)
```

**영화↔영화 총 인접 (보완 합, 동적 가중):**
```
total_affinity(a,b) = w_L·norm(lineage_score) + w_E·embed_sim
  w_L = ρ(a,b)         # 두 영화의 라인 풍부도 (둘 다 풍부 → w_L↑)
  w_E = 1 − ρ(a,b)     # 라인 빈약 → 임베딩에 의존
  ρ = min(1, shared_or_lineage_density / κ)   (κ≈4, 가설)
```

**감독↔감독 간선:**
```
edge_weight(a,b) = max(
    curated_base · [auteur_edges에 존재]      # 큐레이션 바닥, ≈0.7 (가설)
  , w_M·공동멤버십_norm + w_S·스타일공유_norm + w_Eaut·cos(repcentroid_a, repcentroid_b)
)
relation = curated면 'comparable'/'heir' 보존, 아니면 'computed'
source ∈ {curated, computed, both}            # both = 이중 보증, 가중 상향
```

**온보딩 이웃 (구조 sim, 임베딩 전):**
```
sim(X,f) = 5·[같은 감독] + 3·[같은 사조] + 1·[같은 국가] + 1·[|Δyear|<12]
neighbors_onboard(X) = top5( sim>0, tie-break: prestige_score(②) desc )
```

**그래프 시드:**
```
graph_film_seed(center, K=6, τ=0.15)  → degree-K, affinity≥τ, + 공유 라인 중간노드
graph_auteur_seed(uid, K=5)           → 본 감독 중심 + comparable 미관람 1-hop
```

**후보 풀 (WWI safe 공급):**
```
candidate_pool(uid) = ∪_{f∈loved(uid)} top_neighbors(f)  ∪  reps(comparable_directors(uid))
                      − watched(uid),  소스 다양성 상한 적용
```

**예시:** 〈기생충〉 ↔ 〈브로크백 마운틴〉 — 공유: 칸(다름)·오스카 작품(둘 다 listed/won)·S&S 정전 → lineage_score 중상, embed_sim 중(둘 다 가족·계급 응시) → total_affinity 상위 간선. 〈기생충〉 ↔ 〈버닝〉 — 공유: 같은 국가·근접 연대·일부 정전 + embed_sim 높음(한국 계급·응시) → 강한 간선. 온보딩에서 〈버닝〉 평가 시 sim으로 〈기생충〉(같은 국가+사조 근접)이 fly-in.

---

## 6. 콜드스타트·캘리브레이션·갱신 요약

- **콜드스타트(설명가능성 우선):** 온보딩은 임베딩 없이 *구조 sim*(§5-e)으로 즉답. 이웃 동점은 **정전가 정렬(유명작 우선)** — 처음엔 아는 영화가 떠야 모멘텀이 산다. 보유 0편이어도 영화↔영화·감독↔감독 그래프는 *전역 그래프*라 즉시 존재(점등만 비어 있음).
- **두 겹 보완:** 라인 빈약 → 임베딩, 임베딩 없음(take 0) → 라인, 둘 다 없음 → 국가·연대 폴백 + `affinity_confidence` 낮음.
- **캘리브레이션(상수=가설):** `κ`(라인 풍부도 컷)·`curated_base`·`τ`(간선 임계)·`K`(degree)·sim 가중(5/3/1/1)을 코퍼스로 튜닝. 검증: *최다 호명 영화*(Parasite·Brokeback·Schindler 각 19라인, `handoff`)가 서로/이웃과 강한 간선을 갖는지, 무명작이 의미 간선으로 살아남는지.
- **갱신:** `film_affinities`·`auteur_edges`는 영화/감독 단위·전역 1회(사용자 무관, 대량 배치). 라인 적재·임베딩 변경 시 해당 쌍 재계산. `model_version` 불일치 → embed_sim 전원 재계산. 사용자별(노드 점등·candidate_pool)만 보유 변경 시 TTL/dirty 갱신.

---

## 7. 다른 엔진과의 인터페이스 (이 엔진이 *내보내는* 것)

| 소비처 | 쓰는 산출물 |
|---|---|
| **온보딩(모멘텀 루프)** | `neighbors_onboard(film)` = fly-in 5편 + 계보 chip |
| **분석면(`analysis-v2`)** | `comparable(director)` 그래프 · `film_affinities` 리스트(lineage_score 정렬) |
| **별자리(`command-center`)** | `candidate_pool` + 공유 라인 시드 노드(계층 그래프) |
| **⑤ WWI/이유** | `candidate_pool(uid)` = **safe가 채점할 후보 풀 공급**(⑥=검색, ⑤=순위) |
| ④ 공백/희소 | (역방향 — ④가 *안 본* 사조를 역산할 때 ⑥의 사조 그래프 참조) |

**이 엔진이 *받는* 입력:**
| 출처 | 쓰는 것 |
|---|---|
| ① 취향 벡터 | `v_loved`(후보를 내 취향 쪽으로), take/figure 임베딩(embed_sim) |
| ② 정전가 | `prestige_score`(콜드스타트 정렬·후보 우선순위) |
| 데이터 레이어 | `film_lineage`(shared_list_ids), `auteur_edges`(comparable_to), movement/style 멤버십 |

**계약:** 이 엔진은 `{neighbors(film), comparable(director), candidate_pool(uid)}` 세 함수를 제공하고, 각 간선은 `{score, shared_list_ids[], embed_sim, reasons[]}` 를 동반한다. 다른 엔진은 이 셋만 신뢰하면 된다.

**②와 ⑥의 관계(명시):** ② 정전가 = *품질*(세상이 인정했나, movement/style **제외**), ⑥ 유사 = *닮음*(무엇과 인접한가, movement/style **포함**). **같은 `film_lineage`를 읽되 facet 화이트리스트가 정반대** — 이 경계가 두 엔진의 정의다. ①과의 관계: ① = *나라는 점*, ⑥ = *점 사이의 선분*. ⑥은 ①의 임베딩을 빌려 의미 간선을 긋고, ②의 점수를 빌려 후보를 정렬한다.

---

## 8. 못박아야 할 미정 결정 (체크리스트)

1. **계보↔임베딩 결합 방식** — 보완 합(권장) vs 곱. 동적 가중 ρ의 컷 κ(권장 ≈4).
2. **감독 큐레이션 vs 계산형 우선순위** — `curated_base` 바닥값(권장 ≈0.7), source='both' 가중 상향폭.
3. **사조/스타일 selectivity 가중** — 흔한 사조(슬로우 시네마) vs 희소 사조의 인접 강도 차(IDF 형태 확정).
4. **그래프 degree·임계** — 영화 K(권장 6–8)·감독 K(권장 5)·τ(권장 ≈0.15). 슈퍼노드(흔한 라인) 처리.
5. **온보딩 sim 가중** — 5/3/1/1 비율 유지? 콜드스타트 정전 정렬 감쇠 속도(세션 깊이별).
6. **candidate_pool 소스 다양성 상한** — 한 감독·한 사조 도배 방지선, 풀 크기.
7. **affinity_confidence 임계** — 두 겹 다 빈약할 때 폴백/표시 규칙(미적재 vs 진짜 고립).
8. **감독 group 공개 노출** — 그래프에서 등급 완전 비노출 유지(`04` §3 수정 2), 추천 관계만.

---

*다음: 엔진 ⑦ 커버리지(Coverage) — `v_watched`의 앵커 분포로 "내가 가본 영역"의 지도를 그린다. ⑥(인접)의 역(逆) — ⑥이 "닮은 것"이면 ⑦은 "안 가본 것".*
