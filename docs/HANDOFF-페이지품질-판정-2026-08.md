<!-- 2026-08-03. 필름/감독 세부페이지가 "짜깁기라서 색인이 안 되는가"에 대한 판정.
     방법: 실제 프로덕션 페이지 4개(색인/미색인 짝)를 받아 4개 관점이 독립 평가.
     ⚠️ 반박 검증 2건과 최종 종합 에이전트는 실패(정지·네트워크). 아래는 미검증 읽기다.
     단 §1의 차등 분석은 근거가 자기완결적이라 신뢰도가 높다.
     진단 정본 = HANDOFF-구글-트래픽붕괴-2026-07.md · 대응 정본 = HANDOFF-구글붕괴-전략결정-2026-08.md -->

# 페이지 품질 판정 — "짜깁기라서 색인이 안 되나?"

## 0. 결론

**아니다. 인과가 거꾸로다.**
구글이 버린 페이지가 남긴 페이지보다 **모든 축에서 더 깊다.**
`Crawled – currently not indexed`는 여기서 **"가치 없음"이 아니라 "밀렸음"**을 뜻한다.

단, 이것이 사이트 강등을 면책하지는 않는다. **두 사건은 원인이 다르다**(§2).

## 1. 차등 분석 — 자연실험 (신뢰도 ~80%)

검사 대상(전부 라이브 프로덕션 HTML을 받아 텍스트 추출):

| 페이지 | 구글 판정 |
|---|---|
| `/film/the-squid-and-the-whale-2005` | **색인됨** |
| `/film/get-out-2017` | 미색인 |
| `/director/shohei-imamura` | **색인됨** |
| `/director/steven-soderbergh` | 미색인 |

**온페이지 변수는 전부 기각됐다.**
- 섹션 구조: 감독 페어는 **같은 42개 헤딩, 같은 순서**. 이름만 다르다.
- 분량: 이마무라 4,057단어 / 소더버그 4,075단어.
  산문만(25단어 이상 줄) 세면 **이마무라 2,308단어·61줄 vs 소더버그 2,306단어·61줄.**
  **2단어 차이로 정반대 결과.** 길이·산문비율·템플릿밀도를 동시에 죽이는 대조군이다.
- 보일러플레이트: 네 페이지에 바이트 단위로 동일한 건 **439단어**뿐. 주어 정규화 후 재측정해도
  템플릿 총량은 필름 페어 18% vs 16%, 감독 페어 26.5% vs 26.4%.
  **각 페이지의 74~84%는 자기 주제에 대한 텍스트**이고, 살아남은 쪽과 죽은 쪽이 0.5%p 이내로 같다.

**남은 모든 축에서 '버려진' 페이지가 더 풍부하다.**

| 축 | Squid(색인) | Get Out(미색인) |
|---|---|---|
| 고유 복합 고유명사 | 225 | **275** |
| 외부 출처 링크 | 5 | **11** |
| Strong Misreadings | 11 | **14** |
| 수상·정전 블록 | 없음 | Academy Award·Sight&Sound #95 등 **10개 목록** |

감독도 같다: 소더버그 142 readings·101 tropes·62 locations vs 이마무라 79·51·43.

**깨끗하게 가르는 변수는 페이지 밖에 하나 있다 — 유명도.**

| 필름 | 판정 | IMDb 표 |
|---|---|---|
| The Squid and the Whale | **색인** | 93,653 |
| On the Waterfront | 미색인 | 172,324 |
| Wind River | 미색인 | 311,709 |
| Get Out | 미색인 | 814,293 |

| 감독 | 판정 | 필모 합계 표 |
|---|---|---|
| Shōhei Imamura | **색인** | 37,030 |
| Steven Soderbergh | 미색인 | 1,707,298 |
| Roman Polanski | 미색인 | 2,043,805 |

**완벽한 순위 일치.** 이마무라는 버려진 두 감독보다 46~55배 무명이고, 그의 최다 관람작이
소더버그의 최소 관람작보다 표가 적다.

**해석:** 사이트 강등 상태에서 구글은 페이지 자체의 우수성이 아니라 **해당 쿼리에서의 한계효용**으로
재색인한다. "shohei imamura films"는 경쟁자가 없고, "get out sunken place meaning"은 위키피디아·
Vulture·NYT와 9년치 논문이 버티고 있다. **바닥이 낮은 곳에선 통과하고 높은 곳에선 밀린다.**

⚠️ 한계: n=7, `imdb_votes`는 쿼리 경쟁도의 대리변수이지 측정값이 아니다.
다만 "크롤 순서 우연"은 감독 페어를 설명 못 한다 — 무작위가 46배 무명 쪽을 골라 살릴 확률은 낮다.

## 2. 그러나 두 사건을 섞지 말 것

| 사건 | 원인 | 대응 |
|---|---|---|
| **사이트 전체 강등**(07-18) | 6주 만에 25,126 URL, 모든 페이지에 "Drafted by Metatake AI" 각인 = scaled content 판정 | 구조 축소·원저작자 전환(전략결정 문서) |
| **어느 페이지가 살아남았나** | 경쟁 강도 | **페이지 깊이를 늘려도 안 움직인다.** 버려진 게 이미 제일 깊다 |

**페이지별 보강은 2번에 효과가 없다.** 이걸 혼동하면 가장 좋은 페이지를 더 좋게 만드느라 시간을 쓰고
아무 일도 일어나지 않는다.

## 3. 그럼에도 아픈 실측

- **비평가 평가: 22,000단어 중 "다르게 보게 만든 문장"이 4개.** 그 비율이 진단 전부다.
- **원본성 실측: 필름 페이지의 약 60%, 감독 페이지의 약 55%가 구글이 더 나은 출처에서
  이미 얻을 수 있는 것.** 진짜 고유한 부분은 12개 섹션 중 5번째쯤에 묻혀 있다.
- **품질평가자 기준: 필름 페이지 = Medium, scaled-content-abuse 기준 미해당.
  감독 페이지 = Low~Medium, 상당 부분 해당** — 본문이 카운터와 내부링크다.

### 3.1 제거 1순위 — Embedding Fantasia

정수 두 개로 만든 문장과 조인 키를 산문으로 렌더한 것:
> *"Get Out (104 min) runs 12 min shorter than Jordan Peele's Us (116 min)."*
> *"Get Out's 'The Sunken Place' (Du Bois's 'double consciousness') shares its reading lens with **Blazing Saddles** (1974, Mel Brooks)."*

편당 41개 × 2,000편. **인용 하나만으로 scaled content 판정을 정당화할 수 있는 유일한 섹션.**
"SQL로 조립했고 AI가 쓴 게 아니다"라는 라벨은 방어가 안 된다 — 정책은 *"어떻게 만들었든 무관"*이다.

### 3.2 고정 8칸 서식이 새는 곳

`The auteur's vision / Aesthetic innovation / Technical mastery / Philosophical inquiry / ...`
— 8칸 × 2항목 고정이라 **기술적 성취가 없는 영화에도 기술적 성취가 발급된다.**
그리고 DB의 트로프 이름이 문장 옷을 입고 샌다:
> Squid, Context & discourse: *"...where the body and identity are quietly bartered under power's contract."*
= 트로프 `The Body Bartered Under Power's Contract`. 그 트로프에는 24편이 들어 있다.
**24편이 들어가는 범주는 통찰이 아니라 통이다.**

### 3.3 신뢰를 깎는 사실오류 (즉시 수정)

- 이마무라 리셉션: *"Black Rain 1989, directed by **Ridley Scott and Shohei Imamura**"*
  → 동명이작 1989 `Black Rain` 두 편이 제목 문자열로 병합됨. **비평 사이트에서 이 한 줄이
  좋은 리딩 열 개보다 신뢰를 더 깎는다.**
- Get Out의 Sunken Place에 `Heaven As A Neurological Event` 트로프 → 명백히 틀림.
- 숫자 자기모순: 이마무라 헤더 "6 Films" / 본문 "8 films" / "Films 5". 소더버그 "10" vs "12".
- 소더버그 필모 12편(실제 ~35편). `Solaris`·`Contagion`·`Logan Lucky` 없음.
  그런데 "The Life" 본문은 필모에 없는 `Schizopolis`를 언급한다.
- "Where to Start"가 10편에 9개 정거장 → **전부 포함하는 경로는 경로가 아니다.**
  그리고 추천작 `Behind the Candelabra`를 같은 페이지가 "In the catalog"(미독해)로 표시한다.

## 4. 지켜야 할 것 — 이건 진짜다

- **Strong Misreadings, 특히 반증 가능한 것들.** 이게 사이트 최고 자산이다.
  - *"The most powerful indictment of police violence is delivered by a car that turns out to be
    harmless—the terror lives entirely in the audience's automatic assumption."*
  - *"The 'upstate' liberal sanctuary was shot largely around Fairhope and the antebellum landscapes
    of Alabama's Gulf Coast."* — 제작 사실을 리딩으로 전환. 검증 가능·비자명.
  - *"'Nippon konchūki'—literally 'a chronicle of Japanese insects'—is the interpretive key:
    'The Insect Woman' is a mistranslation that personalizes what Imamura meant nationally."*
- **"The leap" 포맷.** 각 리딩 밑에 논증의 위험을 스스로 명시하는 줄.
  평가자 표현: *"편집자처럼 행동하는 유일한 요소"*. 반드시 유지.
- **감독 포트레이트 산문**(~200단어). 네 페이지 통틀어 최고의 글.

## 5. 한 가지만 한다면

**필름당 1인칭 한 문단. 서명 Wonwoo Yoon. invitation **위**에 배치.**

근거가 페이지 안에 이미 있다. **Get Out TakeScore 49, Squid 51.**
Sight & Sound 100선 진입작을 작은 보움백 회고록보다 낮게 매긴 것 — 두 페이지에서 가장 도발적인
비평적 판단이다. 그런데 그것이 **변호 없는 숫자로** 제시되고, 바로 옆 산문은 Get Out이
"Near-Universal Acclaim"을 받았고 위상이 "only deepened"라고 말한다.
**페이지가 자기 판정에 반대한 뒤 심판을 거부한다.**

> *"Get Out이 명성 대비 약간 과대평가됐다고 믿는 비평가에게는 에세이가 있다. 이 페이지에는 점수표가 있다."*

그리고 페이지 어디에도 **`I`가 없다.** 사실이 틀릴 수 있는 문장은 있어도 **취향이 틀릴 수 있는
문장이 하나도 없다.** *"The readings below do not hold back"*는 대담하다고 **말하는** 것이지
대담한 게 아니다.

⚠️ 필름 페이지 상단에 `to. WY. Heo`라는 **실명 수신인**이 남아 있다 —
실제 목소리가 실제 사람에게 쓰던 흔적이 "Drafted by Metatake AI" 머리글 밑에 묻혀 있다.
**그 목소리를 꺼내는 것이 이 사이트에서 아무도 생성할 수 없는 유일한 것이다.**

목표: 200단어, 논쟁에서 방어할 수 있는 것. 왜 이 영화가 나에게 중요한지, 통설이 무엇을 놓쳤는지,
그리고 **왜 그 숫자가 그 숫자인지.**

기준선은 25,126편이 아니라 **오너가 실제로 본 687편**이다.
