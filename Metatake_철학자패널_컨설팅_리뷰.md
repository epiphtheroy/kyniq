# Metatake 철학자 패널 컨설팅 리뷰

> **가상 컨설팅.** 아래는 현대 철학자 8인의 관점을 빌려 metatake.net을 총체적으로 리뷰한 가상의 자문 기록이다. 실제 인물의 발언이 아니며, 각 철학자의 공개된 사상을 근거로 한 시뮬레이션이다.
> 모든 인용 워딩은 2026-07-16 기준 코드베이스·라이브 사이트에서 그대로(verbatim) 추출했다.
> 원칙: **긴 진단보다 정확한 대안.** 각 항목은 `현행 → 대안 → 이유` 구조를 지킨다.

패널: 자크 랑시에르 · 마이클 샌델 · 한병철 · 루치아노 플로리디 · 마사 누스바움 · 콰메 앤서니 아피아 · 유크 후이 · 도나 해러웨이

---

## 0. 패널 공동 결의 — 철학 이전의 문제 (P0, 즉시 수정)

철학적 논쟁이 필요 없는 사실 불일치. 사이트의 인식적 신뢰(epistemic trust)를 갉아먹는 순서대로.

| # | 현행 | 수정안 | 위치 |
|---|---|---|---|
| 1 | v6 메서드 바: **"Built on AI embeddings — not AI-generated content."** — 리딩이 AI-drafted인 이상 거짓 진술 | "Built on AI embeddings **and AI-drafted readings** — every connection measured, every page answered for." | `home-redesign-v6-the-pair.html` `.basis` → 전역 메시징 표준이므로 최우선 |
| 2 | About: "Nothing publishes without the **desk's pass**" ↔ 매니페스토 제안본: "**published directly** rather than passing a separate human or second-model sign-off" | 실제 파이프라인 기준으로 하나만 참으로. 감사-루프가 실체라면: "Everything publishes into the desk's **audit loop**: risky pages are checked before they ship, the rest are checked as they live, and corrections are public." | `app/about/page.tsx` ↔ `Metatake_소개_매니페스토_제안.md` |
| 3 | Risk 차원명이 페이지마다 다름: `/takescore/about`는 **Hollowness**, 영화 상세는 **Bankruptcy** | 사용자 표면은 **Hollowness**로 통일(‘파산’은 금융 은유 — §2 참조). 내부 키 `BANK`는 유지 | `lib/cinecodex_dims.ts` 표시 라벨, `lib/takescore_prose.ts` |
| 4 | 영화 수: 홈 히어로 **6,701** ↔ 영화 페이지 **6,978** | 카운트를 DB 쿼리로 단일 소스화. 하드코딩 숫자 전면 금지 | 홈 히어로 카피 |
| 5 | 비문: "TakeScore measures **Our own estimate** of the durable value…" | "TakeScore is our own estimate of the durable value…" (템플릿 조립부 수정) | 영화 상세 범례 |
| 6 | Lineage 깨진 문자열: "The Metatake list · to. WY. **Heofor** WY. Heo" | 공백/조립 버그 수정 + `WY. Heo`가 누구인지 1줄 표기 | `/lineage` |
| 7 | 프레임워크 수: About **"fourteen frameworks"** ↔ v6 **"ten critical registers"** | 둘이 다른 층위라면(14 misreading 프레임워크 / 10 레지스터) 두 문서 모두에 관계를 1줄로 명시: "ten registers a take is filed under; fourteen frameworks a strong misreading can run" | `app/about/page.tsx`, v6 시안 |
| 8 | `/privacy` `/terms`에 "⚠ Draft — pending legal review" 배너가 라이브 노출 | 법률 검토 완료 후 배너 제거. 그 전까지는 최소한 "last reviewed {date}"로 교체 — ‘초안’ 딱지는 모든 약속의 효력을 스스로 부정한다 | `app/privacy/page.tsx`, `app/terms/page.tsx` |
| 9 | 라이선스 3종 혼재: 약관 CC **BY-SA**(기여물) / 푸터 CC **BY-NC**(자체 저작) / llms.txt CC BY-NC + 지오데이터 CC **BY** | 3층 구조를 **한 페이지**(`/data` 또는 `/legal/licenses`)에 표로 명시하고 terms·footer·llms.txt가 그 페이지를 링크. 내용 자체는 3층이어도 되나, 서로를 모르는 3개의 선언은 안 된다 | `Footer.tsx`, `app/terms/page.tsx`, `app/llms.txt/route.ts` |
| 10 | 구(舊) nav `MetatakeNav.tsx`(💬 Chat, Archetype 등)가 일부 페이지에 잔존, nav의 `Movements`는 리다이렉트된 죽은 코너 | 전 페이지 `home2/Nav.tsx`로 통일, Movements 항목 제거(→ Lineage에 흡수됨) | `components/MetatakeNav.tsx` |
| 11 | `/film/alien-1979` 60초 타임아웃 | 상세 페이지 성능 감사(스트리밍/ISR 분할) — 느린 페이지는 모든 카피 개선을 무의미하게 만든다 | 성능 |
| 12 | 내부 브랜드 혼재: package명 `filmcurio`, START-HERE는 "filmcurio.com… Q&A platform" | 내부 문서에 "구명칭" 헤더 1줄씩. 신규 기여자가 정체성을 오독하는 비용이 실재함 | `package.json`, `START-HERE.md` |

---

## 1. 자크 랑시에르 — 해석의 평등, 관객의 해방

**담당: 편집 철학 워딩, 커뮤니티 정책, 스포일러 UI**

총평: "Strong Misreading"은 내 『해방된 관객』의 명제 — 관객은 이미 해석자다 — 를 상표로 만든 드문 사이트다. 그러나 워딩 곳곳에서 ‘정답을 아는 스승’의 목소리가 새어 나온다.

| 현행 | 대안 | 이유 |
|---|---|---|
| 가이드라인: "Interpretations aren't right or wrong — only **shallower or deeper**." | "Interpretations aren't right or wrong — they differ in **how much they let you see**. Factual errors, though, are always worth flagging." | ‘얕음/깊음’은 옳고 그름의 서열을 수직 축으로 재수입한 것. 사이트 자신의 기준(‘what it lets you see’ — Strong Misreading 문구)과 통일하면 서열 없이 변별이 된다 |
| 스포일러 리빌 버튼: "**Reveal the answer**" | "**Show the ending**" (major) / "**Show the details**" (mild) | 해석 사이트에 ‘정답(answer)’은 금칙어다. 리딩은 답이 아니라는 것이 About 1조("A verdict closes a film; a reading opens it")의 약속 |
| 스포일러 배너: "Spoiler zone — this reading goes all the way to the end." | 유지 (훌륭함) + 목록 칩 "🍿 Ending inside"도 유지 | 경고를 위협이 아닌 예고편으로 만든 좋은 설계 |
| 마이룸 empty state: "your own words are the strongest **taste signal (×1.5)**" | "Write your first reading — **it becomes part of the map**, and it teaches the room your taste." | 사용자의 글을 알고리즘 입력값(×1.5)으로 호명하면 지적 평등이 아니라 데이터 추출이 된다. 가중치는 설명 페이지로 |
| 사용자 테이크의 위치: "logged-in readers can add their own **beneath** any figure" | 사용자 리딩을 별도 하단 구획이 아니라 **같은 리딩 목록에 `Reader` 배지로 병렬 배치**하고, 트로프 매칭(임베딩)에도 동일 자격으로 투입 | ‘beneath’(아래에)는 공간적 위계다. 6조 "disagreement is not flattened"를 UI로 증명하려면 기계 리딩과 독자 리딩이 같은 표면에서 경쟁해야 한다 |
| upvote-only 정책 | 유지하되 정렬 기본값을 ‘추천순’이 아닌 ‘최신+다양성(레지스터 분산)’으로 | 다운보트 없음은 옳다. 그러나 업보트 정렬은 결국 다수결 — 랭킹의 뒷문이다 |

---

## 2. 마이클 샌델 — 돈으로 살 수 없는 것들, 가치의 시장화

**담당: TakeScore 워딩, 마이룸 금융 은유, 점수 구조**

총평: 헌장 3조는 "Value is not popularity"라 선언하고, 7조는 "no one can pay to place a reading"이라 못 박는다. 훌륭하다. 그런데 그 가치를 표현하는 언어가 전부 **금융시장에서 차용**됐다 — Sharpe, net return, holdings, ledger, NAV, positions, high-yield propositions, Screener(종목 스크리너), appraised(감정가). 시장 논리를 거부하는 사이트가 시장의 문법으로 말하면, 은유가 결국 사고를 식민화한다.

### 2a. 워딩 교체표

| 현행 | 대안 | 이유 |
|---|---|---|
| "**Cinematic Sharpe**" · "Efficiency (value per risk)" — Tokyo Story에 "6 Efficiency" | 숫자 노출 폐지, 문장으로: "**Almost all of its value survives the risk.**" (S≥4) / "Much of its value is at stake." (S<1.5) | ‘샤프 지수 6’은 시네필에게 무정보다. 위험 대비 가치라는 직관만 남기고 금융 계보는 끊는다 |
| net-return 밴드: "one of the **safest high-yield propositions** in the catalog" | "a film that **repays attention almost without fail**" | proposition(투자상품)→attention(주의)의 언어로. 가치의 단위는 수익이 아니라 관람자의 변화다 |
| "a strong **net return** for a serious viewer" | "**what it gives outlasts what it risks**" | 동일 |
| "the risk **consumes** nearly all of the value" | "the risk **eats most of what it offers**" — 유지 가능(이미 비금융적) | — |
| 마이룸 instruments: **Holdings / Ledger / Performance(NAV) / positions** | **Seen / Viewing log / Depth over time / films you've seen** | ‘내 영화 포트폴리오의 순자산가치’는 관람을 자산 축적으로 프레이밍한다. "NAV never falls. Watching adds"의 좋은 의도(성장만 있는 기록)는 "**Every film adds. Nothing here ever subtracts.**"로 은유 없이 말할 수 있다 |
| λ 명칭: "**boldness dial**" / "risk-aversion dial" | "**tolerance for divisive films**" 슬라이더 (라벨: "Show me the gambles ↔ Keep it safe") | ‘위험회피 계수’는 경제학 교과서의 언어. 다이얼이 실제로 조절하는 것(갈라지는 영화의 노출)을 그대로 말하라 |
| 영화 페이지: "**#1 of 6,978** by TakeScore — top 1%" | "**Measures in the top 1%** of the catalog" (순번 제거, 분위만) | 헌장 2조 "The record is **relations, not rankings**"와의 정면충돌. 서수(#1)는 랭킹이고, 분위(top 1%)는 측정이다. 이 한 줄이 헌장의 진정성을 판정한다 |
| Screener 히어로: "6,701 films **appraised**" | "6,978 films **read and measured**" | appraisal은 감정평가(경매)의 언어. 측정(measure)은 이미 사이트의 동사다 |

### 2b. 구조 대안 — POLAR(갈라짐)를 벌점에서 해방하라

- **현행**: `R = 0.6·mean(BANK, INSINCERE, COWARD) + 0.4·POLAR`, `TS = V − λ·R`. 즉 **관객이 갈라진다는 사실 자체가 점수를 깎는다.**
- **문제**: 헌장 6조 "disagreement is not flattened"와 모순. 『mother!』형 문제작은 공허하지 않아도(BANK 낮음) 갈라짐만으로 TS가 깎인다. 갈라짐은 결함(hollowness·insincerity·cowardice)과 존재론적으로 다른 종류다 — 전자는 작품의 실패, 후자는 수용의 사실.
- **대안 구조**:
  1. `R = mean(BANK, INSINCERE, COWARD)` — 위험을 **작품 내재적 실패**로 순화.
  2. POLAR는 TS에서 제거하고 **별도 표시축 "Division"** 으로: Standing과 동일한 지위("A separate axis — never part of the TakeScore"). 배지 워딩: "**Divides its audience — {POLAR}/100.** Not a flaw; a fact about reception."
  3. λ 다이얼은 이제 Division 필터를 겸한다(높은 λ = Division 높은 작품을 뒤로).
- **이행 비용**: U·S는 저장 안 되고 쿼리 시 계산(`film_scores_ranked`)이므로 마이그레이션 없이 뷰 수정으로 A/B 가능. 재채점 불필요 — 13개 하위점수는 그대로.
- **부수 효과**: `/takescore/about`의 "Risk ≥ 50 = divisive **or** hollow"라는 해석 불가능한 이중성이 해소된다.

### 2c. 음수 은폐 금지

- **현행**: `displayTs = max(0, round(u))` — 음수 TS를 0으로 클램프.
- **대안**: 음수는 음수로 표시하고 1줄: "**Below zero: at default caution, its risks outweigh what it gives.**" 또는 숫자 대신 "—"와 동일 문구.
- **이유**: 0과 −30을 같은 얼굴로 만드는 것은 측정을 자처하는 시스템의 자기검열이다. ‘정직한 자’의 브랜드는 나쁜 소식의 표시 방식에서 판정된다.

---

## 3. 한병철 — 투명사회, 피로사회, 사물의 소멸

**담당: 디자인 시스템, 홈 구조, 속도·주의(attention) 설계**

총평: "흰 종이, 검은 잉크, 빨강 하나, 라이트 온리" — 이 금욕은 디지털 매끄러움(das Glatte)에 대한 보기 드문 저항이며 그대로 지켜야 한다. 위협은 밖이 아니라 안에 있다: 홈은 16개 밴드가 스크롤을 요구하는 **자극의 적층**이 되었고, ‘Trending’은 주의경제의 문법을 그대로 수입했다.

| 현행 | 대안 | 이유 |
|---|---|---|
| 홈 16+ 밴드 (Surprise hero → Screener → lens ribbon → Now Playing → Today → … → Six ways in) | **8밴드로 감량**: Hero → **Six ways in을 2번째로 승격** → Screener → 살아있는 지도 → From the readings → Now Playing → The Daily → TV. 나머지(Popular concepts, Newly mapped, Directors spotlight, rhyme…)는 "Six ways in"의 문 뒤로 | 사색의 사이트가 무한 피드를 흉내 내면 자기부정이다. ‘여섯 개의 문’이 맨 아래 있다는 것은 집의 현관이 뒷마당에 있다는 뜻 |
| nav 코너명 "**Trending**" / H1 "Trending — the readings drawing the most attention" | 코너명 "**Resonating**" / "readings that **keep being returned to** — measured in re-reads, not clicks" (실제로 재방문·체류 기반 지표로 교체) | ‘지금 뜨는 것’은 모든 플랫폼의 언어. 이 사이트의 차별성은 오래 울리는 것(Nachklang)이다. 지표까지 바꿔야 워딩이 거짓이 안 된다 |
| 히어로 버튼 "↻ **Surprise me** — hit Space" | "**Pull a thread** — hit Space" | 슬롯머신의 우연이 아니라 직조의 우연으로. 매니페스토가 이미 채택한 은유("keep pulling the thread")와 통일 — 사이트 전체가 하나의 은유 체계를 갖게 된다 |
| 다크 예외: 별자리 창만 검정 ("The one place on this paper where colour is allowed to glow") | 유지 + DESIGN-SYSTEM.md에 **조항으로 명문화**: "Dark surfaces: exactly one — the constellation. Never a second." | 빛나는 것이 하나뿐일 때만 빛난다. ‘빨강 하나’ 규율과 같은 문법으로 적어야 v3/v4/v6 문서 표류가 멈춘다 |
| 디자인 문서 버전 표류: globals.css "v3" / DESIGN-SYSTEM.md "v4" / 홈 시안 "v6" | DESIGN-SYSTEM.md를 단일 정본으로 선언, 각 파일 헤더에 "canon: DESIGN-SYSTEM.md" 1줄 | 규율은 문서가 하나일 때만 규율이다 |
| 모바일: 홈 페어 라인이 820px 미만 `display:none` | 감사 문서의 처방대로 모바일 퍼스트 재작성 — 핵심 은유(두 영화 사이의 선)는 **모든 화면에서** 보여야 한다 | 사이트의 존재 이유(선)를 폰에서 지우는 것은 독자 대부분에게 사이트를 지우는 것 |
| "No emojis" 규칙 + 스포일러 마스킹만 예외 | 유지 | 올바른 금욕, 올바른 예외 — 예외가 하나뿐이라 규칙이 산다 |

---

## 4. 루치아노 플로리디 — 정보윤리, 투명성의 설계

**담당: AI 공개 정책, 출처·귀속, 법적 표면**

총평: 이 사이트의 AI 공개는 **층위마다 다른 진실**을 말한다 — llms.txt는 "AI-drafted, human-edited"라 공개하고, 읽기 표면은 "AI-drafted 라벨 금지" 규칙이 있으며, 별도 문장층은 인간 저작을 주장하고, DB_Protocol은 "as if **Anthony Lane himself** wrote it"이라 지시한다. 기계에게는 진실을, 인간에게는 침묵을 말하는 구조는 투명성이 아니라 **선택적 공시**다.

| 현행 | 대안 | 이유 |
|---|---|---|
| AI 고지가 About·/methodology·llms.txt에만 존재, 홈·영화·리딩 페이지에는 없음 | **1문장 출처표시(provenance line)를 모든 리딩·점수 표면의 푸터에 고정**: "Drafted by Metatake Editorial, an AI system; answered for by the desk. **How →**" | 공시는 독자가 콘텐츠를 만나는 그 표면에 있어야 공시다. About은 찾아간 사람만 읽는다. 이미 가진 최고의 문장("drafted by a machine, answered for by a person")을 재사용하면 된다 |
| `HANDOFF-AI봇맞이하기.md`: "AI-drafted 바이라인 라벨은 읽기표면에만 금지" | 이 규칙 폐지 — 위 provenance line으로 대체 | ‘기계에게 공개, 인간에게 비공개’는 규제 관점에서도(EU AI Act 스타일 고지 의무) 최악의 조합이다 |
| Embedding Fantasia 문장층: "Not AI-written" 인간저작 주장 | 실제로 인간이 쓴 문장만 그 계약을 달 수 있게 파이프라인에서 강제하거나, 문구를 "assembled by fixed rules, no language model"(이미 ai-disclosure에 있는 정확한 표현)로 교체 | ‘규칙 기반 조립’과 ‘인간 저작’은 다른 주장이다. 정확한 참 진술이 이미 문서에 존재하므로 그것을 쓰라 |
| DB_Protocol: "must read as if **Anthony Lane himself wrote it**… hide the machinery" | "Write **in the register of the great stylists — under our own name**. The database is your instrument; never cite it, never impersonate a living critic." + editorial-voices.md의 "Never use a real critic's name, never imply one"을 상위 규칙으로 선언 | 실존 비평가 문체 사칭은 그 인물의 평판 자산을 무단 차용하는 것 — 두 내부 문서가 정면충돌 중이므로 하나를 죽여야 한다. 죽일 쪽은 자명하다 |
| "hide the machinery" (DB 은폐 지시) | "**Don't cite the machinery** — write from the facts it surfaced" | 은폐(hide)와 비인용(don't cite)은 윤리적으로 다르다. 후자는 정당한 문체 규칙, 전자는 기만 |
| 스포일러: 인간에겐 블러, 크롤러/AI에겐 SSR 전문 노출 (의도적 SEO 설계) | 최소한 `/methodology`에 1줄 공시: "Spoiler blurs are a courtesy to human eyes; the full text is in the page for search engines and screen readers." + 스크린리더 사용자용 skip 컨트롤 | 정보 비대칭 자체보다 비공시가 문제. 또한 블러가 CSS뿐이면 스크린리더 사용자는 보호받지 못한다 — 접근성 관점에서 `aria` 처리 필요 |
| terms: "AI-generated content is **clearly labeled**…" ↔ 실제로는 표면 라벨 없음 | 위 provenance line 도입으로 이 약관 문장을 참으로 만들거나, 약관을 현실에 맞게 수정 | 약관이 거짓말하는 사이트는 법적 위험 이전에 신뢰 파산 |
| privacy: "If you prefer to **opt out of AI training** data usage, **contact us**." | 셀프서비스: 계정 설정에 "Exclude my contributions from AI training" 토글 + robots/llms.txt에 사용자 기여 구획의 학습 정책 명시 | ‘메일 주시면’은 권리의 마찰 설계다. 권리는 버튼이어야 한다 |

---

## 5. 마사 누스바움 — 감정의 지성, 역량 접근

**담당: 온보딩, 용어 접근성, Cost 축 워딩, 커뮤니티 톤**

총평: "Affective yield"를 인지·형식과 동급의 가치 축에 둔 것 — 감정은 지성의 형식이라는 내 평생의 주장 — 을 지지한다. 문제는 **역량(capability)**: 이 사이트는 figure, take, meta-take, trope, archetype, frame, lens, register라는 8개의 유사 개념을 방문자에게 던진다. 자유는 실질적 접근 능력이 있을 때만 자유다.

| 현행 | 대안 | 이유 |
|---|---|---|
| 고유 개념 8종이 인라인 정의 없이 사용 (설명은 별도 페이지) | **첫 등장 용어에 점선 밑줄 + 1줄 팝오버 사전**. 정의는 이미 존재한다(v6의 4단 정의가 최고): figure = "A concrete thing the film keeps returning to", take = "One reading of that figure", meta-take = "The concept that surfaces when the same reading crosses many films" | 새 어휘를 만드는 것은 좋다(사유는 새 말을 요구한다). 배울 통로 없이 쓰는 것이 배제다 |
| `Tropes`(Patterns) vs `Archetypes`(catalog) vs `meta-takes`(→/tropes 리다이렉트) 관계 미설명 | 각 인덱스 헤더에 관계 1줄: "**A trope is a figure many films share; an archetype is what kind of figure it is.**" | 두 코너가 사실상 같은 것의 두 절단면임을 아는 사람은 현재 운영자뿐이다 |
| Cost 밴드어: "Advanced viewing" / "**Expert terrain**" | "**Comes alive with context**" / "**Richest for the far-travelled**" | ‘전문가 지형’은 문지기의 언어다. 헌장 4조("Difficulty is a price, not a virtue **and not a sin**")의 정신은 비용을 알려주되 자격을 묻지 않는 것 |
| 영화 페이지 학술어 무각주: shomin-geki, mono no aware, anicca, kō | 위 팝오버 사전에 포함: "shomin-geki — dramas of ordinary middle-class life" 식 1줄 | 각주는 독자를 어리게 보는 것이 아니라 문을 열어두는 것 |
| Cost 축이 ‘영화의 속성’으로만 표기 | 로그인 사용자에겐 상대화: "**Cost 51 — for you, likely lower: you've seen 6 of its kin.**" (마이룸 시청 데이터 활용) | 진입비용은 관계적 속성이다. 이미 개인화 인프라(WWI)가 있으므로 표시만 바꾸면 된다 |
| 가이드라인 "Keep it about the film… no personal attacks" + Now Playing "wound no one" 원칙 | 유지, 그리고 Now Playing의 원칙("takes positions on works, ideas and institutions, never on a person's character")을 **커뮤니티 가이드라인에도 승격** | 운영진에게만 적용되는 윤리는 위선으로 읽힌다. 같은 문장이면 충분하다 |
| 16세 연령 제한, 삭제 시 익명화 | 유지 | 적절 |

---

## 6. 콰메 앤서니 아피아 — 세계시민주의, 번역의 윤리

**담당: 언어 정책, 커버리지 편향, 세계영화 표면**

총평: 서울에서, 한국인 편집자가, 오즈와 홍상수를 다루며 만든 사이트가 **영어로만 말하고**, 언어 토글은 `EN ▾`이라는 작동하지 않는 약속으로 걸려 있다. 코스모폴리터니즘은 하나의 세계어가 아니라 번역 속의 대화다.

| 현행 | 대안 | 이유 |
|---|---|---|
| `EN ▾` 비활성 placeholder 토글 | **작동 전까지 제거.** 1차 목표: About·Methodology·Guidelines·TakeScore about 4개 정적 페이지의 한국어판(`/ko/about`…) — 매니페스토 제안본에 이미 한국어 카피 존재("영화를, 가까이 읽다") | 작동하지 않는 언어 토글은 이중의 실례다: 기능으로도 거짓, 환대로도 거짓. 이미 번역된 자산부터 살리라 |
| Cinecodex 앵커 8편: Tokyo Story, Stalker, Seven Samurai, Parasite, Skyfall, mother!, Babylon, Transformers | **비서구 앵커 확대 — 인도·아프리카·라틴아메리카 0편인 상태 해소**: Pather Panchali(사트야지트 레이), Touki Bouki(만베티), Memories of Underdevelopment(구티에레스 알레아) 등을 골드 스코어와 함께 추가 | 자기 문서가 이미 자인한다("calibrated on a largely cinephile catalogue, non-Western… deserve continued auditing"). 감사(audit)의 첫 실행은 자(ruler) 자체를 넓히는 것 — 앵커는 채점의 자다 |
| Lineage: "National cinemas 41" | 유지하되 교차 코너 1개 추가: "**Between traditions**" — 국적으로 분류 불가능한 작품·작가(디아스포라, 합작)의 계보 | 국민국가 격자는 유용하지만, 시네마의 가장 흥미로운 부분은 격자 사이에서 일어난다. ‘연결의 사이트’라는 정체성과도 맞다 |
| 리딩의 이론가 인용이 유럽 이론 중심(14 프레임워크) | 프레임워크 자체는 유지, `/theorist` 인덱스에 비서구 이론가 열 확충 + Poetics에 "reading {비서구 이론가} through cinema" 시리즈 | 도구 상자를 부수지 말고 늘리라. ‘hundreds of theorists cited by name’이 자랑이라면 그 명단의 지도도 자랑할 수 있어야 한다 |

---

## 7. 유크 후이 — 기술다양성(technodiversity), 코스모테크닉스

**담당: 임베딩 형이상학, 점수 파이프라인의 기술적 정직성**

총평: "Every reading is placed in **a single embedding space, where distance means kinship of meaning**" — 이것은 방법이 아니라 형이상학이다. 코사인 거리는 의미의 친족성이 아니라 **하나의 특정 모델(text-embedding-3-small)이 본 세계의 기하학**이다. 도구를 바꾸면 지도가 바뀐다. 그 사실을 숨기지 말고 정체성으로 삼으라.

| 현행 | 대안 | 이유 |
|---|---|---|
| About: "distance means kinship of meaning" | "distance is **our instrument's estimate** of kinship — one instrument, one geometry, versioned like everything else here" | 단일 공간의 보편성 주장을 접고 도구의 상황성을 명시하면, 오히려 ‘측정하는 사이트’라는 브랜드가 강해진다 |
| 임베딩 모델 표기가 v6 시안 스펙 줄에만 존재 | `/network`·`/tropes`·rankings 표면 푸터에 상시 1줄: "Geometry: text-embedding-3-small · 1,536d · cosine. **Change the lens and the map redraws.**" | 지도의 조건을 지도에 적는 것 — 모든 정직한 지도학의 관행 |
| Cinecodex production이 `sonnet-n1` 단일 모델 (권고 구성은 Opus+Sonnet 2-모델 패널; 크로스-벤더 검증은 미실행) | ① 프로덕션을 권고 구성(2-모델 중앙값)으로 승격 ② 준비된 `cinecodex_panel_harness.py`로 OpenAI/Gemini 교차 검증 1회 실행 후 결과를 `/takescore/about` "Why you can trust it"에 공개 — 일치하든 불일치하든 | 단일 채점자의 α=0.958은 자기 일관성이지 간주관성이 아니다. 기술다양성은 규범이기 전에 신뢰도 장치다. 불일치의 공개는 약점이 아니라 이 사이트만 할 수 있는 콘텐츠다 |
| "connections **no human index would catch**" (v6, 반복 사용) | "connections **a human index wouldn't have looked for**" | 기계의 우월 주장(catch)을 탐색 방향의 차이(look for)로. 전자는 검증 불가능한 과장, 후자는 참 |
| 트로프 Maturity 배지: "Fresh → Emerging → Established → **Cliché**" | 유지 — 훌륭함 | 형상의 생애주기를 표기하는 것은 기술 시스템이 자기 산출물을 소모품으로 인식하는 드문 사례. 반어의 용기를 지지한다 |

---

## 8. 도나 해러웨이 — 상황적 지식(situated knowledges)

**담당: ‘serious viewer’ 문제, 신뢰도 표기, 점수의 관점성**

총평: 루브릭 첫 문장 — "the DURABLE value **a serious cinephile** gains" — 이 시스템의 신은 ‘진지한 시네필’이라는 단일 관점이다. 어디에도 없는 곳에서 보는 시선(the view from nowhere)을 나는 ‘신의 속임수(god trick)’라 불렀다. 해결은 관점을 없애는 것이 아니라 **관점을 서명하는 것**이다. 이 사이트는 이미 절반쯤 했다("a well-calibrated opinion, not a fact") — 끝까지 가라.

| 현행 | 대안 | 이유 |
|---|---|---|
| "AI-estimated… a judgment, not a fact"가 `/takescore/film/[slug]`의 Trust 카드에만 존재 | **모든 TS 배지의 툴팁/탭 헤더에 축약형 고정**: "TS 86 — **a judgment, not a fact** · confidence: high" | 숫자는 여행하며 문맥을 벗는다. 판단임을 알리는 꼬리표는 숫자에 붙어 다녀야 한다 |
| 점수 관점이 암묵적("serious viewer") | `/takescore/about`에 **"Scored from somewhere"** 문단 신설: "Every score has a viewpoint. Ours: a viewer who rewatches, reads, and lets films change them. If that isn't you, the number bends — the dial below is yours." + λ 슬라이더를 그 문단 옆에 배치, 로그인 시 λ 저장 | 관점의 명시는 점수의 권위를 깎지 않는다 — 반박 가능한 좌표를 줌으로써 오히려 신뢰를 만든다 |
| `sd_v, sd_r, panel_disagree` 저장하지만 표면 미노출 | 상세 페이지 축 옆에 소표기: "Value 93 **±1**" — 분산 큰 영화는 "**the panel split on this one**" 배지 | 불확실성의 공개는 이 사이트가 IMDb와 다른 종(種)임을 증명하는 가장 싼 방법. 데이터는 이미 있다 |
| 쿼드런트 서술어 "a safe masterpiece" 등 | 유지 + 4상한에 "**panel split**" 변형 추가 (분산 조건부) | 서술어 시스템 자체는 숫자보다 정직한 발명품 |

---

## 9. 패널 합동 워크숍 — 메뉴명·코너명 개정안

현행 6그룹: `Watch / Wander / Read / Theory / Patterns / You`

**진단 합의**: ① `Watch` 아래에 Films·Directors가 있으나 실제로는 브라우징(읽기)이지 시청이 아니다 — 스트리밍 기대를 유발. ② `Wander`는 9개 항목의 잡동사니(점수 도구 + 지도 + 시청처). ③ 사이트의 주인공(About 자칭: meta-take = "the main character of this site")인 Tropes가 `Patterns`라는 2차 그룹에 숨어 있다. ④ `Curious`는 클릭 전 내용 예측 불가.

**개정안 (6그룹 유지)**:

| 신 그룹 | 하위 항목 | 변경 근거 |
|---|---|---|
| **Films** | Films · Directors · Latest · Genres | ‘Watch’의 오해 제거. 이름이 곧 내용 |
| **Tropes** | Tropes · Archetypes · Figures | 주인공의 1급 승격. Patterns 그룹 해체 |
| **TakeScore** | The Screener · What to Watch · Where to watch · Essential 10 | ‘결정 도구’ 계열의 단일 지붕. 점수 브랜드를 nav에서 노출 |
| **Maps** | Connections · Lineage · Locations · Credits web | ‘Wander’의 시적 모호함을 지도적 정확함으로. (Movements 항목 삭제 — 이미 Lineage로 통합) |
| **Read** | Now Playing · The Daily · Poetics · Open Questions(←Curious) · Updates · Newsletter | ‘Curious?’ → "**Open Questions**": H1 "questions the films keep raising"이 이미 그 뜻 |
| **Theory** | Concepts · Theorists · Traditions · Strong Misreadings · Methodology | 유지 (잘 됨) |

로그인 그룹 `You` → 워드마크 우측의 `My Room` 단독 버튼으로 (현행 Room 아이콘 확장). ‘You’라는 호명은 그룹명으로서 정보가 0이다.

**개별 명칭**:

| 현행 | 대안 | 이유 |
|---|---|---|
| 영화 상세 탭 "**Embedding Fantasia**" | "**Resonances**" (또는 "In the map") | 내부 기술어 + 사적 농담. 탭은 문패지 시가 아니다 |
| 탭 "Afterlife" | 유지 + 툴팁 "how the film lived on — remakes, echoes, influence" | 시적이지만 유일하게 해석 가능한 시 |
| "Now Playing" | 유지 가능하되 서브타이틀 상시 노출: "the news, read through the archive" | 극장 상영작 코너로 오해되는 것을 서브타이틀이 방어 |
| 존 라벨 "Close readings / **may spoil his films**" | "may spoil **this film and others**" (성별·단수 오류) | 감독이 여성/복수인 경우 문법 파탄. they 또는 명사로 |
| 검색 placeholder "Search all of Metatake…" | 유지 | 좋음 |

---

## 10. 우선순위 로드맵

**P0 — 이번 주 (신뢰 결함·거짓 진술)**
§0 전체(12건) + "not AI-generated content" 문구(§0-1) + provenance line 도입(§4) + terms의 "clearly labeled" 정합화(§4) + "may spoil his films" 문법(§9).

**P1 — 이번 달 (구조적 정합성)**
POLAR 분리 실험(§2b, 뷰 수정만으로 A/B 가능) + 음수 TS 표시(§2c) + 금융 은유 워딩 교체(§2a) + nav 개정(§9) + 용어 팝오버 사전(§5) + Trending→Resonating(§3) + 신뢰도(±sd) 표면화(§8).

**P2 — 이번 분기 (확장)**
한국어 정적 페이지 4종(§6) + 비서구 앵커 확충 후 재보정 런(§6) + 크로스-벤더 패널 1회 실행·공개(§7) + 2-모델 프로덕션 승격(§7) + 사용자 리딩 병렬 배치(§1) + Cost 개인화 표시(§5) + 홈 8밴드 감량(§3).

---

## 종장 — 패널 공동 성명

이 사이트의 헌장(Seven articles)은 진심이고, 대부분의 결함은 헌장을 **덜 믿어서**가 아니라 헌장이 UI·데이터·내부 프로토콜까지 **아직 내려가지 않아서** 생겼다. "랭킹이 아니라 관계"라면서 #1을 표시하고, "기록은 공개"라면서 기계에게만 공시하고, "가치는 인기가 아니"라면서 가치를 수익률의 언어로 말한다. 우리가 제안한 것은 새 철학이 아니다 — **이미 선언한 철학의 집행**이다.
