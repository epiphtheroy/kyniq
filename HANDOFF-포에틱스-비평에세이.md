# HANDOFF — Poetics 비평 에세이 코너 작업지시서

> **지위**: 이 문서가 Poetics 코너의 **단일 정본 작업지시서**다. 저술 에이전트가 이 문서만 받아도 43편의 에세이를 참고 파일과 함께 충실히 쓸 수 있도록, 코너 정체성·보이스·형식·에세이 카드(질문·앵커 수치·소스)·불변식·페이즈·검증을 전부 담는다. **셸 구현 스펙 포함**(방법론 독스 패턴 재사용이라 소량).
> 작성: 2026-07-12. 형제: `HANDOFF-방법론-독스.md`(셸·렌더러 선례), `HANDOFF-개발자-독스.md`(🛑 보류 — 그 보류 결정이 이 코너의 존재 이유와 직결됨, §1 참조).

---

## 0. 저술 에이전트 시작 절차

1. 이 문서 전체 → §5 보이스 헌장 → §7 에세이 카드(자기 담당분)의 **소스 파일을 실제로 읽는다**.
2. 수치는 §6 수치 원장에서만 가져온다(임의 수치 금지). 최신성이 필요한 값은 Supabase 읽기로 실측.
3. 에세이는 §5의 형식 계약을 따른다. 답을 내리지 않는다 — **선택과 그 대가를 기록**한다.
4. `/methodology` 문서와 사실·입장 모순 금지(P-1). 겹치는 주제는 링크로 위임하고, 여기선 *질문의 깊이*만 더한다.

**절대 금지(요약)**: "Cinecodex"·"FilmCurio"·"AVAULT"·Supabase ref·키·프롬프트 전문·개별 감독 등급·편집자 현직·"professor" — 방법론 헌장(§8) 그대로 상속. **빌드 뒷이야기(엔지니어링 무용담) 금지** — 그건 보류된 개발자 코너의 영역이다(§1). 콘텐츠 `.ts` 본문에 백틱·달러중괄호 금지(방법론과 동일 계약).

---

## 1. 왜 만드는가 — 그리고 왜 이건 안전한가

이 코너는 사이트를 만들며 **실존적으로 피할 수 없었던 내용적 고민들**을 짧은 에세이로 공개한다: 명작이란 무엇인가, 무엇을 봐야 하는가, 피겨는 왜 단위인가, 팬이론을 어떻게 대할 것인가, 이론을 어떻게 정리할 것인가, 평가 지표 세부항목의 철학, 실패한 저녁에 대한 두려움, 세계 영화의 분포, 작가주의의 현재. **답이 없는 주제들이다.** 가치는 답이 아니라 *구조적 사고의 노력과 흔적* — 실제로 내린 구체적 선택, 그 선택이 남긴 숫자, 그리고 여전히 열려 있는 질문에 있다.

**타깃 독자**: 영화 비평가, 메타비평·비평이론에 관심 있는 사람, 산업적 관점의 사고를 하는 사람, 진지한 시네필. (일반 독자용 /methodology, 개발자용 보류 코너와 3분면을 이룬다.)

**전략적 위치**: 개발자 코너 보류의 결정 규칙은 "사이트가 주장하는 rigor를 *증명*하는 것만 안전"이었다. 이 코너는 그 규칙의 **양의 극단**이다 — 편집자 Wonwoo Yoon의 *비평적 사고력* 자체를 쌓는 코너로, 콘텐츠 권위의 로드베어링 기둥을 직접 강화한다. 브랜딩은 여기서 한다(빌더가 아니라 **비평하는 편집자**로서). 단 §5의 보이스 규율(겸손·보수·무과장)은 동일하게 적용된다.

**SEO 관점**: 각 제목이 비평가·시네필이 실제 검색하는 큰 질문("what makes a film a masterpiece", "are fan theories criticism", "auteur theory today")을 겨냥한다. 에세이마다 사이트의 실물 표면(정전 리스트·TakeScore·lineage·트로프)으로 딥링크 — 에세이가 제품으로 들어가는 문이 된다.

---

## 2. 코너 정체성 (확정)

| 항목 | 결정 |
|---|---|
| 이름 | **Poetics** (비평가에게 자연스러운 고전 참조; MUBI "Notebook"과 충돌 회피 확인) |
| 부제 | *Open questions from building a critical map of cinema* |
| 라우트 | **`/poetics`**(허브) + **`/poetics/[slug]`** — app/에 충돌 없음(실측) |
| 보이스 | **1인칭 단수, 편집자 Wonwoo Yoon 서명** — 이 코너가 편집자 브랜딩의 정본 수단 |
| /curious와의 구분 | Curious=영화에 *대한* 질문(Q&A, SEO 스니펫) / Poetics=**비평 자체에 대한** 질문(서명 에세이). 허브 인트로에 1줄 명시 |
| 분량 | 편당 **500~900단어** (짧게, 많이) |
| 언어 | 영어. ko 보류 |

---

## 3. 구현 스펙 (방법론 패턴 그대로 — 차이만 기술)

방법론 독스(§`HANDOFF-방법론-독스.md` §4)와 동일 구조를 복제한다. 에세이는 산문 전용(코드 없음)이므로 **마크다운-in-TS 그대로 사용**(fs/트레이싱 불필요 — 개발자 코너와 다른 점):

```
app/poetics/layout.tsx               # SiteNav + PoeticsTopTabs + PoeticsSidebar + poetics.css
app/poetics/page.tsx                 # 허브: 코너 선언(§2 부제) + 카테고리 카드 + 에세이 목록
app/poetics/[slug]/page.tsx          # 방법론 [slug] 패턴 복제: ISR 3600, unstable_cache ["poe-render1",slug](본문 변경 배포 시 범프 — v3 교훈), Article JSON-LD(author/editor Person Wonwoo Yoon, datePublished/dateModified), notFound 게이트
app/poetics/poetics.css              # methodology.css 복제·개명(.poe-*). 에세이답게 본문 serif 유지
lib/poetics/registry.ts              # POE_CATEGORIES(7) + POE_ESSAYS(§7의 slug/nav/title/desc/category)
lib/poetics/content/<slug>.ts        # 에세이 본문(마크다운 문자열; lib/docs/md.ts 문법 — 백틱·${} 금지, 스탯타일·표 사용 가능)
components/poetics/{PoeticsSidebar,PoeticsTopTabs,PoeticsPager}.tsx  # components/docs/* 복제(공용화 리팩토링 금지)
app/sitemaps/poetics.xml/route.ts + lib/sitemap-data.ts poeticsEntries() + SECTIONS+="poetics"
app/llms.txt/route.ts                # "## Poetics" 섹션
```
렌더러는 `lib/docs/md.ts` **무변경 재사용**. 바이라인: "By **Wonwoo Yoon**, editor · {월 연도}" — 방법론의 데스크 바이라인과 달리 **개인 서명**(이 코너의 정체성). 각 에세이 하단: Related(제품 표면 딥링크 2~3) → prev/next → corrections 각주.

발견성: 사이트맵·llms.txt·`/methodology` 허브와 상호 링크 1줄·`/editor` 페이지에 "His essays: Poetics →" 1줄·푸터는 오너 컨펌 후.

---

## 4. (의도적 공백 — 없음)

## 5. 보이스·형식 헌장 (에세이 계약)

**보이스**: 1인칭 단수. 겸손하되 실질적 — 자기 확신이 아니라 *결정의 무게*를 보여준다. 마케팅어 0, 과장 0, 전투적 표현 0(방법론 v3 매스킹 기준 상속). 학술 인용은 가볍게(Bloom, Thompson 정도 — 각주 없음). 유머는 건조하게 소량.

**형식 계약(매 에세이)**:
1. **제목 = 질문 또는 긴장을 품은 명제** ("What is a masterpiece, operationally?", "The cruel stepmother problem").
2. **오프닝 = 구체적 상황**: "6,701편에 점수를 매겨야 했을 때, 이 질문을 피할 수 없었다" — 추상적 개론 금지. 사이트를 만들며 실제로 부딪힌 지점에서 시작.
3. **몸통 = 선택의 기록**: 무엇을 고려했고, 무엇을 골랐고, 무엇을 버렸고, **그 선택이 남긴 숫자**(§6 원장). 스탯타일 0~2개 허용.
4. **마무리 = 열린 질문**: 답을 선언하지 않는다. "우리는 X를 골랐다; Y를 잃었다; 그 트레이드가 옳았는지는 아직 모른다"가 이 코너의 기본 종지.
5. 하단 고정: 관련 제품 표면 링크 → corrections 각주("이 에세이는 주장이 아니라 작업 노트다; 사실 오류는 고친다, 입장은 논쟁을 환영한다" 톤).

**기술적 결 (the technical grain) — 오너 지침(2026-07-12), 매 에세이 적용 검토**:
영화가 언제나 주어(主語)다. 그러나 에세이 중간에 **이전에 씨름한 기술적 문제를 1~2문장, 지나가듯** 끼워넣어 전문성(기술성)을 암시한다. 규칙:
1. **기술은 논거의 재료이지 주제가 아니다** — 비평적 질문에 봉사할 때만 등장. 도구 자랑·빌드 무용담·"어떻게 만들었나"는 여전히 금지(그건 보류된 코너).
2. **에세이당 최대 1~2문장, 구체적으로(수치·기제), 담담하게.** 강조하지 않는 것이 강조의 기제다 — 독자가 스스로 "이 사람 만들 줄 아는구나"를 추론하게.
3. 예시(끼워넣기의 감):
   - *"…and when all 26,975 readings were embedded into one space, those two films sat closer than any genre tag would have predicted — which is when the question stopped being theoretical for me."*
   - *"We learned this the quantitative way: score the same film twenty times and the answers agree to within a point or two, which told us the instability we feared lived elsewhere — in the rubric, not the machine."*
   - *"The 1,000-row ceiling in our database's API once silently truncated a canon list, which is its own small lesson in why 'complete enumeration' has to be verified, not assumed."*
4. 판별 테스트: 그 문장을 지워도 에세이가 성립하면 합격(장식), 그 문장이 없으면 논지가 무너지면 재작성(주제가 기술로 넘어간 것).

**보이스 예시(오프닝 한 단락 — 저술 에이전트의 톤 기준)**:
> *Somewhere around the four-thousandth film, the question stopped being rhetorical. "What is a masterpiece?" is a seminar question until you are responsible for a number next to* Jeanne Dielman *— at which point it becomes a design decision with consequences you have to live with in public. We never answered it. What we did instead was refuse to encode it: no film on this site is scored against another, and the scale hoards its 100. This essay is about why that refusal felt more honest than any definition we drafted — and what it cost us.*

---

## 6. 수치 원장 (에세이에 쓸 수 있는 숫자 — 이 표가 정본, 임의 수치 금지)

- 코퍼스: 정독 1,935 · TakeScore 6,701 · 카탈로그 6,975 · 독해 26,975 · 피겨 18,168(편당 ~6–8, 실측 평균 8.2) · 트로프 4,710 · 인용 이론가 898(원천 DB 8,196 개념→정본 1,227) · 연결 46,440 · kin쌍 27,593 · counterpoint 11,213 · 위치핀 25,035 · 감독 869.
- 평가 분포: TS 중앙값 ~36 · 중간80% ~8–57 · 최고 ~86(100 없음) · Value 평균 58 · Risk 평균 ~24.
- 정전: lineage 멤버십 10,545 · standing 보유 ~5,975 · 중앙값 ~33 · 최고 ~99 · 리스트 ~398(채워진 ~274) · **70개국** · 국가 정전 23개국 · essential 993 · verdict 분포(optional 8,180 / popular-not-canon 1,320 / essential 993 / deep cut 955 / start here 182) · 사분면 코호트 A 813/B 1,179/C 1,126/D 1,626.
- 작가주의: 오퇴르 라인 160(~67개국) · 감독 신호 밴드 0.92→0.40(공개, 개별 매핑 비공개).
- 리셉션: 1,887편 · 매체 150(비영어 82, ~30개국) · 리뷰 8,884 · 논문 861.
- 운영(비평적 의미로만 인용): 에세이 첫 검증 탈락 ~1/5 · 무LLM 문장 466,974.
- 가중(이미 공개): T1 .90–1.00/T2 .70–.88/T3 .50–.68/T4 .30–.45 · win×1.0/nom·listing×0.45/selection×0.30 · 랭크 커브 1.0→0.5 · 감쇠 ~0.6.

---

## 7. 에세이 인벤토리 (7카테고리 43편 — 카드가 저술 지시의 정본)

> 카드 형식 — **slug · 질문형 제목**: 앵커(실제 선택+숫자) / 소스 / 주의. 공통 소스: `app/methodology/page.tsx`(공개 입장 기준선), 해당 방법론 문서.

### A. On value — 명작과 평가의 철학 (8)
- **what-is-a-masterpiece · "What is a masterpiece, operationally?"**: 정의 대신 '부호화 거부'를 선택 — 상대비교 없는 독립채점, 100을 아끼는 스케일(최고 86). 소스: `score/Cinecodex_HANDOFF.md`, `score/Cinecodex_지수_설계와_검증.md`. 주의: TakeScore 명칭만.
- **can-value-be-scored · "Can the value of a film be scored at all?"**: 측정회의론을 정면으로; 단일 합성 대신 대시보드(never-blend)라는 답; 괴리(고TS·저인기)가 오히려 상품이라는 역설. 소스: `score/Cinecodex_Conclusions_Display_and_Reliability.md`, `/methodology/what-takescore-ignores`.
- **the-anatomy-of-disappointment · "An anatomy of disappointment"** *(평가 지표 세부항목의 철학 대표작)*: 실망을 4유형으로 해부한 선택 — 지적 파산·미적 불성실·예술적 비겁·분열성, 그리고 분열≠파산의 분리 결정. Risk 평균 24. 소스: `score/cinecodex_schema.sql` 주석, `/methodology/takescore-dimensions`.
- **difficulty-is-a-price · "Difficulty is a price, not a virtue"**: 난이도=비용 축 분리 결정; hard-but-empty=최악의 거래; 접근성 무벌점. 소스: Cinecodex_HANDOFF 철칙.
- **the-fear-of-a-wasted-evening · "The fear of a wasted evening"** *(시간 희소 현대인)*: 두 시간의 회수 불가능성; λ(위험회피 다이얼)를 시청자에게 넘긴 결정 — 같은 영화가 신중한 이에게 다른 점수; 중앙값 36의 정직("대부분의 영화는 그저 그렇다"). 소스: `/methodology/takescore`, `docs/PLAN-me-takescore.md`.
- **ambition-is-not-achievement · "Ambition is not achievement"**: 야망 무가점 철칙과 스펙터클 상한; 시도에 점수를 주면 스케일이 죽는다. 소스: Cinecodex_HANDOFF.
- **what-a-36-means · "What a 36 means"**: 분포의 해석학 — 중간80%가 8–57인 스케일에서 숫자 읽는 법; 관대한 스케일은 아무것도 재지 않는다. 소스: §6 분포.
- **the-rewatch-test · "The rewatch test"**: durability 차원을 넣은 이유 — 극장의 전율과 5년 뒤의 잔존은 다른 자산. 소스: `/methodology/takescore-dimensions`.

### B. On the canon — 정전과 "무엇을 볼까" (7)
- **what-should-you-watch · "What should you watch? (An honest decomposition)"**: 그 질문을 권위×수요 2축으로 분해한 결정; 점수 컷이 버릴 뻔한 것(아방가르드·여성·월드시네마 딥컷 — Deren·Akerman·Varda) 때문에 권위로 게이트. 코호트 813/1,179/1,126/1,626. 소스: `curation-handover/HANDOVER.md`, `/methodology/film-selection`.
- **the-word-essential · "Who deserves the word 'essential'?"**: 6,975편 중 993편에만; award≠canon 결정(수상만으론 essential 불가). 소스: `HANDOFF-투두블유-큐레이션코멘트.md`.
- **when-the-canon-scores-low · "When the canon scores low"**: 정전 등재작이 TS 저점일 때 — "canon"이라 부르길 거부하고 much-seen으로 기술한 결정; 두 숫자의 불일치를 페이지가 허용하는 이유. 소스: to.W HANDOFF, `/methodology/why-a-film-is-in-the-index`.
- **whole-lists-or-nothing · "Whole lists or nothing"**: 완전 열거 철학(팔므도르는 전부 아니면 없음); "N of M" 정직; 10,545 멤버십. 소스: `site_content/METHODOLOGY_LINEAGE_SECTION.md`.
- **writing-for-one-reader · "Writing for one reader"**: 큐레이션 코멘트를 실존 인물(WY. Heo)에게 쓴 결정 — 단일 실독자가 강제하는 정직; "the user"에게 쓰면 거짓말이 쉬워진다. 소스: `/methodology/why-a-film-is-in-the-index`.
- **the-gravity-of-cannes · "The gravity of Cannes"**: 프레스티지의 중력 문제와 discovery 축이라는 균형추; 70개국·국가 정전 23개국의 의도. 소스: `handoff/07_scoring_model.md`, `/methodology/lineage-standing`.
- **a-thousand-titles-that-say-nothing · "A thousand titles that say nothing"**: 저변별 대형 컬렉션 배제 결정 — 변별하지 않는 리스트는 정보가 0. 소스: `handoff/03_registry_spec.md`, `/methodology/lineage-selection`.

### C. On reading — 피겨·미스리딩·트로프·팬이론 (8)
- **why-the-feather-not-the-plot · "Why the feather, not the plot"** *(피겨가 왜 중요한가 대표작)*: 분석 단위를 플롯이 아닌 피겨로 정한 결정; 편당 6–8개, 18,168개; 플롯 요약 비평의 막다른 길. 소스: `docs/CONCEPT-tropes-and-strong-misreadings.md`, `/methodology/figures`.
- **the-cruel-stepmother-problem · "The cruel stepmother problem"** *(피겨 정의 대표작)*: 빈도가 아니라 strikingness+의미 적재(Thompson: 어머니는 모티프가 아니고 계모는 모티프다); '비'는 피겨가 아니고 '멈추지 않는 비'는 피겨일 수 있다는 판별의 고뇌. 소스: CONCEPT 문서, `bold-take-pilot*.md`(판별 흔적).
- **reading-is-always-misreading · "Reading is always misreading"**: Bloom을 이름에 박은 결정 — 'Strong Misreadings'라는 명명은 정답 주장의 영구 포기 각서. 소스: CONCEPT 문서, `app/about/page.tsx` §strong-misreadings.
- **in-defense-of-fan-theories · "In defense of fan theories"** *(팬이론 대표작)*: 팬이론=민중 해석학이라는 입장; 무시도 숭배도 아닌 제3의 길 — 소싱·계량·판정(Apocrypha Desk의 ruled-on 구조); 비평장의 경계 문제. 소스: `lib/desks.ts`(theories), `RUNBOOK-EngineRoom.md` 해당부, `/methodology/essays`.
- **when-a-reading-repeats · "When a reading repeats, it stops being yours"**: 독해가 영화를 건너 재발하는 순간 특이성→패턴(트로프)이 되는 존재론; 발견과 코드의 경계. 소스: CONCEPT 문서, `/methodology/tropes`.
- **the-lifecycle-of-a-cliche · "Every cliché was once a discovery"**: Noble→Fresh→Emerging→Established→Cliché 호를 설계한 이유; 4,710 트로프의 분포; 클리셰를 경멸하지 않는 법. 소스: `/methodology/tropes`.
- **three-readings-per-object · "Three readings per object, never one"**: 피겨당 서로 다른 3프레임워크 강제 규칙 — 불일치의 생산성; 한 독해의 독재 방지. 소스: `lib/frameworks.ts`, `/methodology/frameworks`.
- **why-fourteen · "Why fourteen frameworks (and not twelve, and not truth)"**: 분류학의 자의성을 자인하는 에세이 — 14는 발견이 아니라 실용적 절단; 프레임워크 분류가 놓치는 것. 소스: `lib/frameworks.ts`, CONCEPT 문서.

### D. On theory — 이론을 정리한다는 것 (5)
- **filing-a-century-of-theory · "Filing a century of film theory"**: 8,196 개념→1,227 정본화의 통폐합 결정들 — 병합의 폭력과 효용; 동의어·번역어·유파 내 변주의 처리. 소스: `HANDOFF-이론DB통합-마스터.md` §1~13, `/methodology/theory-explorer`.
- **concepts-are-doors · "A concept is a door, not a cage"**: 독해 속 개념을 링크로 만든 결정 — 인용이 아니라 통로; 898 이론가. 소스: 이론DB HANDOFF, `/methodology/theory-explorer`.
- **the-theorist-as-interlocutor · "The theorist as interlocutor"**: 이론가를 장식 인용이 아닌 대화 상대로 — anchored reading의 규율(조회 대조, 오귀속=hard fail). 소스: `RUNBOOK-EngineRoom.md`, `/methodology/how-a-page-is-made`.
- **distance-as-meaning · "Distance as meaning"**: 임베딩을 비평 도구로 주장함 — 태그가 아니라 거리; 기하학이 비평에 무엇을 주고 무엇을 뺏는가. 소스: `/methodology/embedding-map`, `app/about/page.tsx`(technically minded 문단).
- **database-criticism · "Criticism as a database (and what that does to it)"** *(메타비평 대표작)*: 개별 리뷰의 시대 이후 — 관계가 콘텐츠라는 명제; 46,440 연결·11,213 counterpoint가 만드는 새 장르의 가능성과 천박화 위험. 소스: `docs/PLAN-connections-overhaul.md`, `/methodology/kinship`·`counterpoints`.

### E. On the world map — 세계 영화 분포·작가주의 (6)
- **where-cinema-lives · "Where cinema lives (a distribution, measured)"** *(세계 분포 대표작)*: 70개국 lineage·23개국 국가 정전·~67개국 오퇴르의 실측 분포 — 그리고 그 분포 자체가 우리의 수집 편향임을 자인. 소스: `/methodology/sources-we-monitor`, `handoff/03_registry_spec.md`.
- **the-auteur-in-2026 · "Is the auteur still a useful idea?"** *(작가주의 대표작)*: 160 라인을 유지하는 실용적 이유(신뢰도 신호·발견 경로) vs 이론적 불편(감독=브랜드화); 감독 신호를 댐핑한 결정(거장이 바닥은 올리되 작품을 가리지 않게); 개별 등급 비공개의 윤리. 소스: `handoff/04_auteur_spec.md`(개별 매핑 인용 금지), `/methodology/lineage-standing`.
- **a-nations-hundred-films · "A nation's hundred films"**: 국가 정전의 정치 — 누가 국가를 대표해 목록을 만드나; Cine21 오라벨 정정 사례(21세기 캐논이 아니라 2020 연말 톱10)로 본 정직의 비용. 소스: `SITE_LEDGER.md` §5, METHODOLOGY_LINEAGE_SECTION.
- **movements-are-not-quality · "A movement is not a merit"**: 사조·스타일을 총점에서 뺀 결정(슬로우시네마라서 더 좋은 게 아니다 — 범주 오류); 유사도로만 쓰는 규율. 소스: `handoff/07_scoring_model.md`, `/methodology/lineage-standing`.
- **the-frontier-festival · "The frontier festival problem"**: FESPACO에서 발견된 영화가 서구 하드웨어 부재로 벌점받지 않게 한 축 분리(발굴 보상). 소스: 07_scoring_model, METHODOLOGY_LINEAGE_SECTION.
- **whose-hundred-greatest · "Whose hundred greatest?"**: 폴의 인식론 — S&S(비평가 투표)·TSPDT(출처 명시 메타폴)는 넣고 팬투표·블랙박스 집계는 뺀 3-bar 기준의 철학. 소스: `/methodology/lineage-selection`, `SITE_LEDGER.md` §1b.

### F. On industry & attention — 산업·관심·시간 (5)
- **how-reputations-are-remade · "Reputations are remade, not made"**: 리셉션 아카이브(1,887편·150매체)가 보여주는 평판의 재작성 — 개봉 평점은 시작일 뿐; afterlife라는 렌즈. 소스: `/methodology/reception`, `magazine research agent/인수인계-HANDOVER.md`.
- **attention-is-not-importance · "Attention is not importance"**: 스파이크(검색량)와 중요성의 분리 원칙 — 라이브 데스크가 랭크 대신 verdict를 말하는 이유; wound-no-one. 소스: `/methodology/now-playing`, `HANDOFF-now-플레잉.md`(공개부만).
- **the-economics-of-an-evening · "The economics of an evening"**: 시간=진짜 희소자원이라는 산업 관찰; 시청 결정을 포트폴리오로 은유한 도발(그 은유의 한계 자인). 소스: `/methodology/my-room`, PLAN-me-takescore.
- **availability-is-destiny · "Availability is destiny"**: 스트리밍 가용성이 정전 접근을 규정 — 6,900 watch 페이지·국가별 회전(leaving)의 관찰; 볼 수 없는 정전은 정전인가. 소스: `/methodology/where-to-watch`.
- **the-critic-and-the-aggregator · "The critic and the aggregator"**: 집계 점수 시대에 비평이 설 자리 — never-blend의 산업적 의미(집계에 수렴 안 하는 숫자의 존재 이유). 소스: `/methodology/what-takescore-ignores`, Conclusions 문서.

### G. On machines & criticism — 기계와 비평 (4) ⚠️ 빌드 뒷이야기 금지, /methodology/ai-disclosure 입장과 정합
- **can-a-machine-venture-a-reading · "Can a machine venture a reading?"**: 요약이 아니라 모험적 독해 — 상상력·정서의 영역에 모델이 들어올 때 무엇이 관찰되는가; 이 사이트를 그 실험의 공개 기록으로 보는 관점. 소스: `lib/docs/content/ai-disclosure.ts`(입장 기준), `/methodology/what-ai-does`.
- **the-slop-question · "The slop question"**: 오염 우려의 정확한 해부(문제는 도구가 아니라 무분별 양산) + 비평장의 책임 — 검증·킬 게이트(~1/5 탈락)가 비평적으로 뜻하는 것. 소스: ai-disclosure, `/methodology/essays`.
- **what-machines-cannot-decide · "What machines cannot decide"**: 남는 인간 판단의 자리 — 무엇이 사이트에 서는가는 기계가 결정하지 않는다; 책임의 소재. 소스: `/methodology/editorial-responsibility`.
- **criticism-as-infrastructure · "Criticism as infrastructure"**: 비평을 1회성 텍스트가 아닌 축적 인프라로 짓는다는 것 — 46만 무LLM 문장·연결·정전 기록이 비평사적으로 무엇인지; 인프라화가 죽이는 것(일회의 광채)에 대한 정직. 소스: `/methodology/sentences`, `docs/PLAN-connections-overhaul.md`.

---

## 8. 불변식 (P-1 ~ P-7)

- **P-1** `/methodology`와 사실·수치·입장 모순 금지. 수치는 §6 원장만.
- **P-2** 방법론 §8 금지어 전부 상속 + **빌드 뒷이야기 금지**(개발자 코너 보류 결정 존중 — 엔지니어링 선택담·도구 이야기·"AI로 어떻게 지었나"를 *주제*로 삼지 않는다. 기계 이야기는 G군의 *비평 담론* 수위까지만). **단, §5 "기술적 결" 기법은 허용이자 권장** — 에세이당 1~2문장, 지나가듯, 비평 논거에 봉사할 때만(판별 테스트 통과 필수). 이것이 보류된 개발자 브랜딩을 위험 없이 회수하는 공식 경로다.
- **P-3** 매 에세이 형식 계약(§5) 준수 — 특히 '열린 질문' 종지와 구체적 오프닝.
- **P-4** 콘텐츠 검증은 실제 tsc 컴파일 + 렌더 스모크(방법론 교훈: 문자수 스캔 금지). 백틱·${} 금지.
- **P-5** 캐시 키 `poe-render1`, 본문 변경 배포 시 범프.
- **P-6** 개인 서명(Wonwoo Yoon) 코너지만 자랑·확신 어조 금지 — 방법론 v3 매스킹 기준(보수적·논리적·겸손)이 여기도 상한선.
- **P-7** 에세이마다 제품 표면 딥링크 ≥1(에세이는 문이다).

## 9. 실행 페이즈

- **P0 — 셸 + 파일럿 3편**: §3 구현 + 대표작 3편(what-is-a-masterpiece · the-cruel-stepmother-problem · in-defense-of-fan-theories)을 먼저 써서 보이스 검증 — **오너 검수 후** 계속.
- **P1 — 대표작 우선 10편**: 각 카테고리 대표작(§7에 *대표작* 표기) + A·C군 잔여.
- **P2 — 전체 43편** (군별 저술→검증 에이전트: P-1 모순·§6 수치 대조·금지어·형식 계약).
- **P3 — 발견성**: 사이트맵·llms.txt·methodology/editor 상호 링크·IndexNow.
- **P4 — 보류**: ko, 외부 신디케이션(오너).

## 10. 검증 체크리스트

1. tsc+프로덕션 빌드, 렌더 스모크(전 편). 2. 금지어 grep(방법론 §8 목록+professor+현직) 0. 3. §6 수치 대조 전수. 4. /methodology 입장 모순 없음(특히 G군↔ai-disclosure, B군↔why-a-film-is-in-the-index). 5. 라이브 200+JSON-LD+앵커 회귀 없음. 6. 형식 계약 샘플 검사(오프닝 구체성·열린 종지).

## 11. 결정 로그
- 2026-07-12 — 기획 확정(본 문서). /poetics·43편·1인칭 편집자 서명·마크다운-in-TS(산문 전용이라 fs 불필요)·P0 파일럿 3편 오너 검수 게이트. 개발자 코너 보류와의 관계 §1 명시(이 코너=권위를 쌓는 안전한 브랜딩 수단). 구현·저술 미착수 — 다른 에이전트 수행.
- 2026-07-12 — **오너 추가 지침: "기술적 결" 기법 채택**(§5·P-2 반영). 에세이 중간에 이전에 씨름한 기술 문제를 1~2문장 지나가듯 끼워넣어 전문성을 암시하되, **핵심은 언제나 영화**. 판별 테스트(지워도 성립=합격) 포함. 이 기법이 보류된 개발자 브랜딩 가치를 위험 없이 회수하는 공식 경로.
