# HANDOFF — AI 집필 크레딧 표기 개편 (정본·실행지침서)

**한 줄:** 사이트 전 표면의 저작 표기를 "집필 = Metatake AI · 설계·감독·감수 = 윤원우(Wonwoo Yoon)" 체계로 전환한다. 2026-07-15 결정 749c35a("읽기 표면 바이라인에 AI 자기-라벨 금지")의 **의도적 번복**이며, 철학자 패널 리뷰(PR #8)가 지적한 저작 정직성 문제의 완결이다.

- **상태:** 기획 확정 (2026-07-17) · **오너 결정 D1~D8 전량 확정 (2026-07-17, §2 상단 표)** · **P1·P2 구현 완료 — P3 관찰 창 대기**. P4·P5는 미착수(§8).
- **작성 근거:** 오너 지시(2026-07-17 대화) + 11레인 코드베이스/DB 탐사(파일:라인 실측). 이 문서의 모든 파일:라인은 2026-07-17 기준 실측값이다 — 구현 시점에 어긋나면 grep으로 재확인할 것(±수 라인 드리프트는 정상).
- **관련 정본:** `HANDOFF-철학자패널-리뷰반영.md`(보류됐던 provenance line의 상위 구현) · `HANDOFF-투두블유-큐레이션코멘트.md`(§0 철학 필독) · `docs/HANDOFF-SEO-마스터.md`(사이트맵·색인) · auto-memory `ai-disclosure-placement-policy`(이 문서로 대체됨 — 메모리도 갱신할 것).

---

## 0. ⭐ 철학 — 왜 이렇게 하는가 (이거 안 읽고 문구 바꾸지 말 것)

**오너 결정의 취지:** 콘텐츠는 Metatake AI가 방법론에 따라 집필/산출하고, 그 방법론의 설계·감독·감수는 실명 인간(윤원우)이 수행한다 — 이 사실을 숨기지 않고 **영화 크레딧 문법으로 당당하게** 표기한다. 사과문이 아니라 크레딧롤이다.

**왜 지금 뒤집는가:** 749c35a(2026-07-15)는 "페이지마다 AI 도장을 찍으면 비평이 'AI 콘텐츠'로 재프레이밍되어 디스미스된다"는 근거로 바이라인 무표기를 택했다. 그 우려는 여전히 실재하지만, ① 철학자 패널이 지적한 대로 현행 표기(특히 to.W의 "from. W. Yoon" 인간 서명, /now·/poetics의 개인 바이라인)는 사람이 쓰지 않은 글에 사람 서명이 붙는 구조라 정직성 부채가 더 크고, ② /terms가 이미 "AI-generated content is clearly labeled"라고 약속하고 있는데 현행 읽기 표면은 이 약속을 지키지 않으며, ③ 에이전트-레디니스 전략(AI 크롤러 신뢰 신호) 관점에서 명시적 provenance가 자산이 되기 때문이다. **번복은 어정쩡한 절충이 아니라 전면 일관 적용이어야 한다** — 일부만 바꾸면 최악.

**3대 원칙:**
1. **층별 정확성.** 이 사이트의 콘텐츠는 단일하지 않다: LLM이 초안을 쓰는 층(A), 규칙으로 조립되는 LLM-0 층(B), LLM이 점수만 계산하는 층(C), 사람이 직접 쓴 층(H). 라벨은 층의 사실과 일치해야 한다. **모든 층에 "Written by Metatake AI"를 일괄 도장 찍으면 B·H층에서 새로운 거짓이 생긴다** — 그건 이 개편의 취지(정직성)를 스스로 배반하는 것.
2. **책임 주체는 항상 사람.** 모든 라벨의 뒷부분은 실명 인간 크레딧(윤원우, /editor 링크)이다. "AI가 썼다"는 앞부분과 "사람이 설계·감독·감수하고 책임진다"는 뒷부분은 한 세트 — 어느 한쪽만 있는 표기를 만들지 말 것.
3. **methodology가 정본, 바이라인은 요약.** 모든 바이라인의 "how this is made"가 /methodology로 링크되므로, methodology를 먼저 고치고(§4) 바이라인이 그것을 가리키게 한다. 순서 역전 금지.

---

## 1. 라벨 사전 (canonical vocabulary) — 이 문서의 유일한 문구 원천

새 문구는 반드시 아래 표에서 가져다 쓴다. 표면마다 임의 변형 금지(템플릿 지문 방지 차원의 축약형은 §5 각 항목에 명시).

| 코드 | 적용 층 | EN (정본) | KO (ko.ts 값) |
|---|---|---|---|
| ~~**A**~~ ⚠️ **폐기됨 — §10-bis 참조** | — | ~~`Written by Metatake AI · designed, directed & reviewed by Wonwoo Yoon`~~ **"reviewed"가 리딩층에서 거짓** | ~~`집필 Metatake AI · 설계·감독·감수 Wonwoo Yoon`~~ |
| **A** (LLM 초안) **신 정본** | 클로즈리딩·인비테이션·데스크 에세이·Q&A(AI분)·Poetics(→D6) · **where-to-start/who-is-next(→D7)** | `Written by Metatake AI · designed & directed by Wonwoo Yoon, who answers for it` | `집필 Metatake AI · 설계·감독 Wonwoo Yoon (책임)` |
| **A-now** (무인 자동 발행) | **Now 레터 · The Daily** | 사전 검토 주장 금지. 형: `Written by Metatake AI · published on a machine gate, reviewed after the fact by Wonwoo Yoon` | — (EN 전용) |
| **B** (규칙 조립 LLM-0) | to.W·문장층(Fantasia)·에디터스 다이제스트·where-to-watch·리셉션 조립·크레딧 산문·미스리딩 재조립 기사·TV 편성 | `Composed by the Metatake method — no language model · designed & supervised by Wonwoo Yoon` | `Metatake 방법론으로 조립 — 언어모델 미사용 · 설계·감수 Wonwoo Yoon` |
| **C** (AI 계산·점수) | TakeScore·임베딩·커넥션 | `AI-computed by Metatake AI against a version-locked rubric · designed and calibrated by Wonwoo Yoon` | `Metatake AI가 고정 루브릭으로 산출 · 설계·보정 Wonwoo Yoon` |
| **H** (인간 집필) | where-to-start 픽 문장(→D7에서 사실 확인) | 기존 인간 크레딧 유지, A/B 적용 금지 | — |

**명명 규칙:**
- AI 시스템의 공개 명칭은 **"Metatake AI"로 통일**한다(§2 D1). 현재 전 표면이 "Metatake Editorial"을 쓰고 있으므로 이 개편은 리네임을 포함한다. "Metatake AI Editorial"은 to.W 발신자 한정 변형(§2 D2).
- 사람 이름은 항상 `Wonwoo Yoon` + `/editor` 링크. 한국어 표기에서도 로마자 유지(기존 관행 ko.ts:451-452와 일치).
- 브랜드 불변: "TakeScore"라는 이름 자체는 유지(§2 D3). "Metatake"·"TakeScore" 등 제품 어휘는 ko 사전에 넣지 않는다(번역 금지 계약, ko.ts 헤더).
- 라벨 뒤에는 기존 관행대로 ` · how this is made`(/methodology 링크)를 잇는다.

---

## 2. 오너 결정 항목 — ✅ 전량 확정 (2026-07-17)

**확정 결과 (이 표가 정본. 아래 D1~D8 서술은 판단 근거로 보존):**

| D | 확정 | 비고 |
|---|---|---|
| **D1** | **전면 리네임** "Metatake Editorial" → **"Metatake AI"** | 권고안 채택. "(formerly styled Metatake Editorial)" 기록은 **/methodology/ai-disclosure·/editor 2곳뿐**. DB `author_name`·admin·`lib/pipeline.ts`는 **P5**(⚠️ pipeline.ts는 라이브 LLM 시스템 프롬프트 — 기계적 치환 시 생성 문체가 바뀜) |
| **D2** | **`from. Metatake AI Editorial`** + `directed by W. Yoon` 유지 | 권고안 채택. methodology 재서술 동반(발신=데스크·판정데이터=AI산출 TakeScore·문장조립=규칙). "not written by an AI"는 **조립에 대해 참 → 삭제가 아니라 정밀 재서술** |
| **D3** | **리네임 반대 · 부제 방식** | 권고안 채택. "TakeScore" 이름 유지. `takescore/[dim]:318-321`이 템플릿 — 단, **표면마다 문장 변주**(§8 템플릿 지문) |
| **D4** | 크레딧 → `Composed by the Metatake method · designed by Wonwoo Yoon` · **디스클레이머 유지** | 권고안 채택. sentences.ts 계약을 "형식은 진화, 2줄 구조는 불변"으로 개정. ⚠️ `components/FilmSentences.tsx:15-17`의 **의도적 좁은 스코프**(위치 입력은 S19 sonnet 추출기) — 넓히면 참이 거짓 됨 |
| **D5** | **권고안** "Built on AI embeddings. The readings are AI-drafted criticism — reviewed, and answered for, by a named editor." | ⚠️ 뒷문장 "The model does not write opinions"도 **이제 거짓** → 함께 재작성. 참인 부분(임베딩=연결을 찾는 악기)은 보존 |
| **D6** | **라벨 A + 허브 문안 개정** | "one editor's desk — drafted by Metatake AI from the editor's own viewing log, directed & signed off by Wonwoo Yoon". 동반 수정 2곳(**신규 발견**): `/about` "His signed essays run in Poetics" · `llms.txt:39`. 43편 본문은 **불변**(§10-12) |
| **D7** | **H층 해제 → 라벨 A + methodology 전면 정정** | ⚠️ **문서의 가정이 증거로 뒤집힘.** 실측: picks·reason 전부 **Opus-4.8 배치 생성**(`worker/director-picks-gen.py`·`director-profile-gen.py` → 배치 `msgbatch_01SKWH2BQxcHmMek5XMo8KSe`·`msgbatch_01Cn7yz5ufeQnfv6BxkB5Srw` → 로더가 `.strip()`만 하고 무수정 적재). **결정적 증거: 모델의 JSON 스키마 실패가 프로덕션에 살아 있음** — `director_next.rec_name = "Alfonso Cuarón shares with Béla Tarr"` 외 3종(`"Bertolt Brecht's heir Peter Watkins"` 등), jsonl↔DB 바이트 동일. **H층 없음**(§1 표의 H행은 공란이 됨) |
| **D8** | **B안 "systematic guide"** — /about 신설 절 "Why now" | 오너 승인 문안 확정(§4-4에 전문). 스탠드퍼스트 직후 배치. 7조 신조·#strong-misreadings 불변 |
| **롤아웃** | **P0→P2까지 실행 · P3 관찰 창 준수 · P4는 관찰 후** | §8 순서 그대로 |

**D7 정정의 정확한 경계(중요):** "렌더 시점 LLM-0"은 **참이므로 보존**한다(`start/page.tsx:19-23` "every sentence is assembled from DB fields"). 고쳐야 할 것은 **"렌더에 LLM 없음" ≠ "LLM이 손댄 적 없음"** 의 혼동이다. 이 구분이 A1(아래 §2-1)의 일반 원칙이기도 하다.

### 2-1. ⚠️ P4로 이월된 신규 결정 항목 (D9~D12) — 정찰이 발견, 문서에 없던 것

P4 착수 전 오너 확정 필요. 전부 **§5-1 공유 컴포넌트/§5-5 잔여** 표면이라 이번 패스 범위 밖.

- **D9 (최대 쟁점). 재조립층(A 원재료, 신규 추론 0)은 A인가 B인가?** `/film/meaning/[slug]`가 대표: 페이지 헤더가 "LLM-free… Still zero LLM"이라 선언하는데 `:313-314`가 LLM 저작 `takes.rationale`·`leap`을 **그대로 렌더**한다. 문서 §4-2는 B(원재료는 A)로 매핑했으나, 독자가 보는 산문은 100% LLM 문장이다. **D7이 같은 질문에 이미 A로 답했으므로 일관성상 A 권고** — "보이는 산문이 지배한다". 파급: `/take`·`/trope`·`/figure` 등 takes를 재렌더하는 전 표면.
- **D10. `/catalog/[seg]/[slug]`** — `detail.definition`은 **사람이 만든 스프레드시트**(`worker/catalog-load.py`가 `Element/Object_Catalog.xlsx` 파싱) = **H**, members/kindred는 임베딩+LLM 분류기 = **C**. 현행 "Drafted by Metatake Editorial"은 **양쪽 다 거짓**. 문서 §4-2의 10행 표에 catalog 행 자체가 없음.
- **D11. `/theorist/[slug]`** — `:226 const bio = wd?.description ?? blurb` → **Wikidata 서술이 1순위**(제3자 저작). 이걸 "Metatake AI 집필"로도 "Wonwoo Yoon 감수"로도 표기하면 거짓.
- **D12. `/film/locations/[slug]`** — 핀 산문(`pinProse()` :105-112)의 입력은 `movie_locations_llmsearch.py`가 생성했고 **기본 모델이 `gpt-4o-mini`**(:170). 라벨 B("언어모델 미사용")는 거짓, 라벨 A("Metatake AI")는 **OpenAI 산출물을 자사 AI 크레딧으로** 표기하게 됨. **제3의 형식 필요.**

### 2-2. 판단 근거 (원문 보존)

- **D1. 시스템 명명: "Metatake Editorial" → "Metatake AI" 전면 리네임 여부.**
  실측: 사이트는 AI 시스템을 일관되게 "Metatake Editorial"로 부른다 — /about("Metatake Editorial, a purpose-built system", app/about/page.tsx:107), /editor(:75), llms.txt(route.ts:26), /terms("attributed to the Metatake Editorial team", app/terms/page.tsx:55), 바이라인 전부, Q&A 크레딧 저장값(app/admin/review/page.tsx:101 `author_name: "Metatake Editorial"`, lib/pipeline.ts:8 시스템 프로필). 같은 실체에 두 이름이 생기면 신뢰 신호가 흐려진다.
  **권고:** 공개 표면은 "Metatake AI"로 통일 리네임 + /methodology/ai-disclosure와 /editor에 한 줄("formerly styled Metatake Editorial") 기록. DB 저장값(author_name)과 admin 도구는 후순위(P5)로 함께 변경하되 기존 행 백필은 불필요(표시 시점 매핑도 가능). *대안: "Metatake Editorial"을 유지하고 라벨만 "Written by Metatake Editorial, our AI system"으로 쓰는 보수안 — 오너가 "Metatake AI"를 명시 지정했으므로 기본값은 리네임.*
- **D2. to.W 발신자 문구.** 오너 지정: `from. Metatake AI Editorial`. 단 to.W 편지는 **LLM-0 규칙 조립**이고 /methodology/why-a-film-is-in-the-index가 "assembled by rule, **not written by an AI**"를 명시한다(그리고 이 문장은 참이다). 발신자를 "Metatake AI Editorial"로 바꾸려면 methodology 문서를 "발신 주체는 데스크(판정 데이터는 AI 산출 TakeScore), 문장 조립은 규칙"으로 재서술해 모순을 없애야 한다(§4-6).
  **권고:** `from. Metatake AI Editorial` 채택 + 서명행에 `directed by W. Yoon` 유지(아바타 → /editor 링크 보존) + methodology 재서술. *대안: `from. the Metatake desk`(층 사실에 더 근접하나 오너 취지와 거리).*
- **D3. TakeScore 브랜드.** 오너 제안: "AI-TakeScore for Cinepile" 리네임. **권고: 리네임 반대, 부제 방식.** 근거: ① "Cinepile"이 cinephile의 오기라면 교정 필요, 의도적 조어라면 기존 학술 벤치마크 CinePile(2024, 영상 QA 데이터셋)과 충돌. ② /takescore 계열 6,701페이지가 라이브 — URL·스키마·내부참조 마이그레이션 비용 실재. ③ 부제 방식으로 취지가 100% 담김. 이미 존재하는 정본 문장(app/takescore/[dim]/page.tsx:318 "TakeScore™ is Metatake's own scoring system — designed and calibrated by Wonwoo Yoon…")을 템플릿으로 전 표면 확산(§5-4). 오너가 리네임을 확정하면 별도 마이그레이션 계획(308·사이트맵·스키마)을 이 문서에 추가한 뒤 착수.
- **D4. Embedding Fantasia 계약 개정.** /methodology/sentences(lib/docs/content/sentences.ts:41)는 "credited as **a data fantasia by Wonwoo Yoon**… We never remove either line"를 공표한 계약이다. 크레딧 문구를 라벨 B로 바꾸려면 이 계약 문서를 먼저 개정해야 한다("credit의 형식은 진화하되 credit+disclaimer 두 줄의 존재는 불변" 식으로). "not AI-written" 디스클레이머 자체는 **참이므로 유지**.
  **권고:** 크레딧을 `Composed by the Metatake method · designed by Wonwoo Yoon`으로, 디스클레이머는 유지. metatake-tv.ts:14가 이 계약을 참조하므로 동반 수정.
- **D5. /manifesto 배너.** HomeClient.tsx:117 "**Built on AI embeddings — not AI-generated content.**"가 /manifesto에 라이브(홈에서 삭제된 게 아니라 이사한 것). 새 체계와 정면 충돌하는 최상위 모순.
  **권고:** "Built on AI embeddings. The readings are AI-drafted criticism — reviewed, and answered for, by a named editor." 방향으로 재작성(정확한 문안은 오너 검수).
- **D6. Poetics 서명 에세이.** 현행: "By Wonwoo Yoon, editor"(개인 바이라인) + /poetics 허브 "these notes are one editor's, signed" + updates 피드 공표(lib/updates/posts.ts:106). 실제로는 2026-07-12 에이전트 세션이 43편 전면 재저술(커밋 2e59663, 예시는 오너 시청로그) — **개인 인간 서명과 실제 생산방식의 간극이 사이트에서 가장 크다.** 철학자 패널 논리가 가장 강하게 적용되는 지점.
  **권고:** 라벨 A 적용 + 허브 문안을 "one editor's desk — drafted by Metatake AI from the editor's own viewing log, directed & signed off by Wonwoo Yoon" 방향으로. updates 피드는 append-only이므로 과거 포스트 수정 대신 새 포스트로 정정 공지(§7 참조).
- **D7. "인간 손" 클레임 층의 사실 확인 (where-to-start + who-is-next).** /methodology/where-to-start:40이 "What you read as the reason is **a human sentence, not a generated one**"이라 주장하고, `app/director/[slug]/next/page.tsx:328`은 "Every list like this is **curated by hand**, one kinship at a time"라고 주장한다(reason 문장은 director_next 테이블 저장 데이터). 픽 선정·reason 문장이 실제로 인간 작성이면 H층으로 보호(A/B 적용 금지), 아니면 methodology와 해당 문구를 고쳐야 한다. 오너에게 확인 후 진행.
- **D8. 회사 소개(/about) 미션 헤드라인.** 오너 지시(2026-07-17): 이 주제(AI 집필+인간 감독 체계)를 회사 소개 페이지에서 **거의 헤드라인급으로** 다룬다. 취지 문안의 골자 — ① 사람들이 영화를 더 많이 보길 바란다, ② 좋은 영화를 감별하거나 "나에게 필요한 영화인지" 판단할 때 AI의 도움을 받는 사람들이 이미 많다, ③ Metatake는 그런 사람들을 위한 **체계적 가이드**다: 공개된 방법론(루브릭·프레임워크·신뢰도)으로 산출한 기준점을 제공해 **각자의 AI 프롬프트 결과를 스스로 판단할 수 있게 돕는다**. 즉 "AI로 영화를 고르는 시대의 보정 기준(calibration reference)"이라는 포지셔닝 — 새 크레딧 체계(우리가 AI를 공개적으로 쓰고 방법을 전부 공개한다)와 논리적으로 한 몸이다.
  **적용 위치(안):** /about 스탠드퍼스트(:49) 확장 또는 신조 위 신설 섹션 + 메타디스크립션(:11) + /partners 리드 + llms.txt About 절 한 줄. ⚠️ /about은 오너 승인 응축 신조(~440단어, about-page-condensed) — **정확한 문안은 오너 검수 필수**, 구현 AI는 초안 2~3안을 만들어 오너 컨펌 후 반영. 7조 신조 자체와 #strong-misreadings 앵커는 불변.

---

## 3. 전체 지형 — 무엇이 어디에 있는가 (실측 요약)

구현 AI가 반드시 알아야 할 구조적 사실:

1. **공유 크레딧 컴포넌트는 ~~2개뿐~~ → ⚠️ 3개다 (2026-07-17 정찰이 반증).** 세 번째는 **`app/concept/[slug]/page.tsx:36`에 정의된 로컬 그림자 `Provenance`**(렌더 :486·:801) — 문자열이 다르고("By the Metatake concept desk"·"Revised {date}"), **`t()` 없음·locale prop 없음·MethodologyBadge 없음**. **`components/Provenance.tsx`를 고쳐도 /concept은 조용히 누락된다.** §5-1에 반드시 포함할 것(P4). 나머지 2개는: `components/Byline.tsx`(상단: "Drafted by Metatake Editorial · reviewed & edited by Wonwoo Yoon · updated {d} · how this is made") + `components/Provenance.tsx`(하단: "Generated by the Metatake editorial method · created/updated · editorial desk led by Wonwoo Yoon · how this is made"). 이 둘이 ~20개 라우트 패밀리에 렌더된다. **단, Tier-2 카탈로그 필름 페이지는 의도적으로 Byline을 안 붙인다**(film/[slug]/_shared.tsx:1236-1239 주석: 규칙 조립 레코드에 "drafted by"는 과대표기) — 이 구분은 새 체계에서도 유지한다(Tier-2는 라벨 B 성격).
2. **그 위에 수작업 인라인 크레딧이 산재.** "Analysis by Metatake Editorial · edited by Wonwoo Yoon" 푸터 가족(theorist·concept×2·credits·감독 서브 8종), "Drafted/Assembled by Metatake Editorial, edited by…" 인트로 덱, "Compiled from the Metatake database · Edited by…"(Tier-2 다이제스트), "Computed by Metatake's connection engine · Edited by…"(킨드레드/카운터포인트), "Metatake Editorial · … compiled …" 레코드 푸터(lineage/locations), 인비테이션 서명("— Wonwoo Yoon, Editor"), 개인 바이라인(/now "Wonwoo Yoon, founder & editor" · /now/daily "By Wonwoo Yoon" · /poetics "By Wonwoo Yoon, editor" · /takescore/film "By Wonwoo Yoon, Editor — Metatake"). 전체 목록과 신규 문구는 §5 표.
3. **JSON-LD의 지배 패턴은 author=Organization "Metatake" + editor=Person "Wonwoo Yoon" + publisher=Organization.** 이 패턴은 새 가시 크레딧과 이미 정합한다(Organization이 AI 시스템을 포괄). **JSON-LD는 이번 개편에서 원칙적으로 불변** — 특히 Review author=Organization은 2026-07-14 SEO 확정 결정(lib/seo.ts:181)이라 절대 변경 금지. 예외적 정리 대상(P5, 선택)은 §5-7.
4. **i18n:** 바이라인 문구는 `t(locale, "정확한 영어 문자열")` + `lib/i18n/dict/ko.ts`(키=영어 원문 byte-exact). 기존 바이라인 클러스터는 ko.ts:489-497, to.W 클러스터는 448-453. 영어 원문 문자열을 바꾸면 **ko 키가 조용히 깨져 영어로 폴백**되므로, 영어 문구 변경 = ko.ts 키·값 동시 교체가 철칙. 검증은 `node scripts/i18n-audit.mjs`.
5. **이름 주입 생성기는 없다.** 이름/이니셜은 전부 렌더 시 JSX 리터럴로 붙는다(worker/factory 프롬프트에 이름 주입 0건 — 재발 경로 없음). supabase/migrations에도 이름 시드 0건. 따라서 이 개편은 원칙적으로 **코드 수정만으로 완결**된다(DB 본문 스윕 결과는 §6 확인).
6. **/methodology 앵커 6종(#connections #rankings #locations #index #now #corrections)은 허브 page.tsx의 하드코딩 id이며 40+페이지가 딥링크한다. #strong-misreadings는 /about에 있다(7페이지 참조). 절대 리네임 금지.**

---

## 4. Phase 1 — methodology·투명성층 개정 (선행, 가장 먼저)

> 독스 본문은 `lib/docs/content/<slug>.ts`(마크다운 템플릿 리터럴), 등록은 `lib/docs/registry.ts`(DOCS 배열)와 `lib/docs/content/index.ts`. 신규 독스 추가 절차: registry에 DocMeta 추가 → content/index.ts에 import+DOC_BODIES 등록 → content/<slug>.ts 생성. **이번 개편은 신규 독스 없이 기존 개정으로 충분하다**(what-ai-does가 크레딧 정본 역할).

### 4-1. CONTRADICTED — 전면 재작성 2건 (최우선)
1. `lib/docs/content/what-ai-does.ts:37-38` — 섹션 "## What that means for a byline": **"There are no individual per-page bylines on Metatake…"** 전체가 새 체계와 정면 모순. 재작성 방향: "우리는 층별 명시 크레딧을 단다 — LLM 초안 층은 'Written by Metatake AI', 규칙 조립 층은 'Composed by the Metatake method', 모두 설계·감독·감수자 실명과 함께. AI 초안을 인간 에세이로 분장시키지 않겠다는 원칙은 그대로다 — 이제 그 원칙을 페이지 위에 쓴다." 기존 문단의 논거("dress an AI draft as a human essay" 거부)는 새 체계를 지지하므로 재활용.
2. `lib/docs/content/editorial-responsibility.ts:30` — **"We chose review over bylines."** 이 이분법 폐기. 뒷문장 "the AI drafted this, the desk reviewed it, and here is who leads that desk"는 새 크레딧의 내용 그 자체이므로 보존하고, "이제 그 한 줄을 모든 페이지에 명시한다"로 잇는다.

### 4-2. ai-disclosure.ts — 정본 지도 개정
- `lib/docs/content/ai-disclosure.ts:28-39` 층별 표 10행에 **크레딧 라벨 열 추가**(각 행 → A/B/C/H 매핑: 클로즈리딩 A · 데스크에세이 A · 임베딩 C · to.W B(D2 반영) · 문장층 B · 미스리딩기사 B(원재료는 A) · where-to-watch/리셉션 B · TakeScore C · where-to-start H(D7) · lineage/locations B).
- :43 "what it means for bylines is set out in…" 포인터 문장을 새 크레딧 서술로 갱신.
- D1 확정 시 "Metatake Editorial"→"Metatake AI" 치환 + "(formerly styled Metatake Editorial)" 1회 기록.

### 4-3. NEEDS-REWORD — 독스 개별 항목
| 파일:라인 | 현재 | 조치 |
|---|---|---|
| `app/methodology/page.tsx:57-60` | "By the Metatake editorial desk · Reviewed July 2026" | 라벨 A 형식으로(허브 자체가 AI 초안+검수 문서) 또는 데스크 표기 유지+격상 — 문안 §1 |
| `app/methodology/page.tsx:233-236` | Locations를 "Metatake Editorial researches…"로 서술 | 규칙/컴파일 층이므로 B 어휘로(locations.ts 본문과 정합) |
| `app/methodology/page.tsx:354-356` | Now 레터 "carries Wonwoo Yoon's byline" | 라벨 A 서술로("Written by Metatake AI, reviewed & signed off by Wonwoo Yoon") |
| `app/methodology/page.tsx:359-360` | "What keeps it from being 'AI writing about the news'…" | 방어적 프레이밍 제거 — "It *is* AI writing, anchored to live data and human-approved" 방향 |
| `lib/docs/content/now-playing.ts:4` | "signed editor's letter" | "letter written by Metatake AI and signed off by the editor" |
| `lib/docs/content/the-daily.ts:14` | "the desk's byline"(AI 언급 없음) | 라벨 A 명시 |
| `lib/docs/content/why-a-film-is-in-the-index.ts:4,6` | "signed *W. Yoon*" / "not written by an AI" | D2 확정안 반영: 발신자 변경 + "조립은 규칙, 판정 데이터는 AI 산출" 재서술 |
| `lib/docs/content/tiers.ts:42` | 다이제스트 "is bylined" | 라벨 B 문구와 일치 확인 |
| `lib/docs/content/sentences.ts:41` | "a data fantasia by Wonwoo Yoon… never remove either line" | D4 확정안으로 계약 개정 |
| `lib/docs/content/metatake-tv.ts:14` | "same brand contract the sentence layer keeps" | sentences.ts와 락스텝 수정 |
| `lib/docs/content/open-data.ts:21` | "the part a person actually wrote" | "AI-drafted and human-reviewed"로 (라이선스 조항 자체는 유지) |
| `lib/docs/registry.ts` desc 문자열 | :48 what-ai-does · :53 "not written by an AI" · :80 sentences · :87 where-to-start · :106 ai-disclosure 등 | 본문 개정과 동시 갱신 — **registry desc는 /llms.txt에 자동 전파**되므로 누락 금지 |

### 4-4. 투명성층 나머지
- `app/about/page.tsx:49` "Every page is drafted by a machine and answered for by a person" — **유지**(새 체계의 헌장 문장). :107 "Metatake Editorial, a purpose-built system" — D1 반영 + "Every page is drafted by"의 과일반화 수정(규칙 조립 페이지는 AI 초안이 아님 — "Every reading is drafted by…; the record pages are composed by rule" 식 층 구분). 7조 신조(:71-97)는 불변, #strong-misreadings 앵커 불변.
- **/about 미션 헤드라인(D8):** 확정 문안을 스탠드퍼스트 직후 또는 신조 직전에 배치. 방향 예시(오너 검수용 초안 소재): "We want you to watch more films — and better ones. If you already ask an AI what to watch, Metatake is the reference that keeps that answer honest: a published method, a version-locked rubric, and readings you can check your prompt against." 메타디스크립션(:11)·/partners 리드·llms.txt에 같은 취지 1줄씩(문장은 표면마다 다르게 — 템플릿 지문 방지).
- `app/terms/page.tsx:55` "AI-generated content is clearly labeled and attributed to the Metatake Editorial team." — 새 체계가 이 약속을 비로소 참으로 만든다. D1 확정 시 "Metatake AI team"으로. :77 "Last updated" 날짜 갱신. ⚠️ terms는 "DRAFT — NEEDS LEGAL REVIEW" 배너 상태 — 법률 검토는 오너 몫, 이번엔 문구 정합만.
- `app/llms.txt/route.ts:23,26` — "AI-drafted, human-edited" 서술은 이미 정합. D1 반영 + 새 크레딧 체계 한 줄 추가("Every page carries an explicit provenance credit."). :39는 Poetics 안내("Open questions… by editor Wonwoo Yoon") — **D6 확정안과 동기화**(개인 서명 서술이므로).
- `lib/pack.ts:271` "This pack is AI-generated criticism with human curation." — 유지(이미 정합). citeLine(:77-84) "original, human-curated interpretation"과의 일관성 확인. **⚠️ lead.ts·pack.ts 문자열은 API/MCP가 그대로 소비하는 계약** — 표면 간 바이트 동일성 유지, 임의 변형 금지.
- `app/editor/page.tsx:75-84` — "There are no individual per-page bylines" 문장 제거(모순), 새 크레딧 체계 서술로 교체. D1 반영.

---

## 5. Phase 2 — 표면별 크레딧 적용 (파일:라인 작업표)

### 5-1. 공유 컴포넌트 2종 (최대 파급 — 신중히)
- `components/Byline.tsx:42` — `Drafted by Metatake Editorial · reviewed & edited by Wonwoo Yoon` → 라벨 A: `Written by Metatake AI · designed, directed & reviewed by Wonwoo Yoon`. t() 키 3개가 바뀌므로 **ko.ts:495-497 키·값 동시 교체**. 주의: Byline이 붙는 표면 중 일부는 B층(예: /whereto 가용성 리포트, catalog 허브) — **Byline에 `variant?: "ai" | "method"` prop을 신설**해 층별 라벨을 갈아끼우는 방식을 권고(호출부 ~20곳에서 층에 맞는 variant 지정; 기본값 "ai"). 렌더 호출부 전체 목록은 탐사 원본(Outputs 스크래치 `discovery-bylines.json`)과 grep으로 확정.
- `components/Provenance.tsx:20-25` — "Generated by the Metatake editorial method · … · editorial desk led by Wonwoo Yoon" → `Generated by the Metatake method · … · designed, directed & reviewed by Wonwoo Yoon`(하단 푸터는 층 중립 문구 유지 가능 — 상단 Byline이 층별 라벨을 담당). 컴포넌트 doc-comment(:6-8 "We don't credit individual authors…")도 새 정책 서술로 갱신. ko.ts:489-493 동시 교체.

### 5-2. to.W 4표면 (D2)
| 위치 | 현재 | 변경 |
|---|---|---|
| `components/read/TowCard.tsx:86` | `from. W. Yoon` | `from. Metatake AI Editorial` + 새 줄 `directed by W. Yoon`(아바타 /editor 링크 유지, :87 title/aria는 t()-래핑 유지) |
| `app/director/[slug]/_shared.tsx:791-792` | `from. W. Yoon` + 아바타(raw 문자열) | 동일 변경 + **title/aria를 t()로 래핑**(현재 필름 표면과 달리 raw — 기존 결함 동시 수정) |
| `app/takescore/film/[slug]/page.tsx:270-271` JSX 주석 | "from. W. Yoon" 언급 | 주석 갱신 |
| `components/read/tow-card.css:2` 주석 | "W. Heo… W. Yoon" | 주석 갱신(수신은 이미 WY. Heo로 리네임됨 — 46bd2b0) |
- 수신자 "to. WY. Heo"는 **불변**(실존 개인, 신원 상세 표기는 철학자 패널 때 기각 확정). `/lineage/for-w-heo`와 /lineage 허브 카드(:105)도 수신 표기라 불변.
- `lib/poetics/content/writing-for-one-reader.ts` — 편지 장치를 1인칭으로 설명하는 에세이("a signature, mine"). D2·D6 확정 후 **오너 검수 하에** 재서술(안티-포뮬러 계약 층이라 기계적 치환 금지).
- HANDOFF-투두블유-큐레이션코멘트.md §"편지 형식"도 새 계약으로 갱신.

### 5-3. 인비테이션·필름 페이지 인라인 크레딧 (`app/film/[slug]/_shared.tsx`)
| 라인 | 현재 | 변경(라벨) |
|---|---|---|
| :1540 | 인비테이션 서명 `— Wonwoo Yoon, {t("Editor")}` | A 축약: `— Metatake AI · reviewed by Wonwoo Yoon`(ko.ts 키 추가) — 인비테이션은 takes(AI 초안)층 |
| :1573 | "Written for this film by Metatake Editorial (edited by Wonwoo Yoon), not aggregated from reviews." | "Written for this film by Metatake AI (directed & reviewed by Wonwoo Yoon), not aggregated from reviews." — ko.ts:232-233 동시 교체 |
| :1645 | 미스리딩 인트로 "Drafted by Metatake Editorial, edited by…" | A 문구 — ko.ts:238-239 동시 교체 |
| :1125,:1107 | Tier-2 다이제스트 "Compiled from the Metatake database · Edited by…" / "— Metatake Editorial" | B 문구: "Composed by the Metatake method from the database · supervised by Wonwoo Yoon" / 인용 어트리뷰션 "— Metatake" — ko.ts:223-224 동시 교체 |
| :1941,:1996 | "Computed by Metatake's connection engine · Edited by…" | C 축약: "Computed by Metatake AI's connection engine · designed by Wonwoo Yoon" — ⚠️ **ko 키는 2개다: :1941→ko.ts:246, :1996→ko.ts:260**(문서가 :246 하나로 적은 건 오류. :1996은 긴 키의 꼬리만 크레딧이라 :246만 고치면 /ko가 :1996에서 깨짐). :246의 아포스트로피는 **U+2019**(`Metatake’s`) — 바이트 정확 주의 |
- 코드 주석(:1440-1441 "signed by the human editor", :775, :832, :1064-1067)도 새 계약 서술로 갱신(렌더엔 영향 없지만 다음 구현자의 나침반).

### 5-4. TakeScore 표면 (D3 = 부제 방식 기준)
정본 문장(이미 존재): `app/takescore/[dim]/page.tsx:318` "TakeScore™ is Metatake's own scoring system — designed and calibrated by Wonwoo Yoon, founder & editor of Metatake. …frozen rubric (cinecodex-prod-v2)…" — **이 문장이 템플릿. 중복 없이 확산:**
| 위치 | 조치 |
|---|---|
| `app/takescore/about/page.tsx:114-124` "Why you can trust it" | 라벨 C 전문 삽입: "Every score is computed by Metatake AI against a version-locked rubric designed and calibrated by Wonwoo Yoon." (기존 "rubric-anchored AI estimate" ab-note와 정합) |
| `components/screener/ScreenerExplorer.tsx:284` 히어로 sub | 한 줄 추가: "An AI-computed metric for cinephiles — designed by Wonwoo Yoon." |
| `components/CinecodexPanel.tsx:413-414` df-src | 기존 "AI-estimated (TakeScore rubric)…" 문장 뒤에 " Designed and calibrated by Wonwoo Yoon." 추가 — **ko.ts:622 키 교체 필수**(영어 원문이 바뀌므로) |
| `app/takescore/film/[slug]/page.tsx:452-458` tsf-byline | "By Wonwoo Yoon, Editor — Metatake" → "Scored by Metatake AI · rubric designed by Wonwoo Yoon, Editor" |
| `app/takescore/page.tsx:150-152` 푸터 | 소스 크레딧 뒤에 설계자 한 줄 |
| `lib/pack.ts:124-132` 팩 TakeScore 섹션 | METHOD_URL 근처 한 줄: "AI-computed; rubric designed by Wonwoo Yoon." |
| `app/partners/page.tsx:94`("a computed 13-dimension value assessment") · `app/embed/page.tsx:25`("Metatake's 13-dimension critical assessment" — "computed" 없음) | 두 곳 모두 설계자 부기(파트너/임베드는 B2B 신뢰 신호) — embed 배지 title의 "human-curated" 문구(embed/takescore/[slug]/route.ts:45-46)는 §5-7에서 처리 |
- `lib/lead.ts:38` BLUF("Metatake rates …")는 **계약 문자열 — 불변**(API/MCP 바이트 동일성).
- prose 층 주의: 페이지 산문은 규칙 기반(lib/takescore_prose.ts, LLM-0), 점수만 AI — "AI가 이 문장을 썼다"는 서술을 만들지 말 것.

### 5-5. 개인 바이라인 표면 → 라벨 A 전환
| 위치 | 현재 | 변경 |
|---|---|---|
| `app/now/[slug]/page.tsx:118-129` | 아바타 W + "Wonwoo Yoon, founder & editor · anchored on…" | "Written by Metatake AI · reviewed & signed off by Wonwoo Yoon · anchored on…" (아바타·/editor 링크는 감수자 크레딧에 유지) |
| `app/now/daily/[date]/page.tsx:92` | "By **Wonwoo Yoon** · the Now Playing desk closed the day" | "By Metatake AI · the Now Playing desk closed the day · signed off by Wonwoo Yoon" |
| `app/blog/[slug]/page.tsx:79` + `app/blog/page.tsx:92` | "The Metatake desk" | "Written by Metatake AI · directed by the Metatake desk" 또는 D1 어휘로 통일 |
| `app/poetics/page.tsx:34-36` + `app/poetics/[slug]/page.tsx:101` | "By Wonwoo Yoon, editor" | D6 확정안 |
| `app/film/[slug]/q/[question-slug]/page.tsx:350,:355` | isAI 시 "Metatake Editorial"(:350) + "Drafted and fact-checked…"(:355) | "Metatake AI"(D1) + 이탤릭 문구 유지 |
| `app/film/[slug]/reception/page.tsx:514` | "Assembled and edited by Wonwoo Yoon" | B: "Assembled by the Metatake method · edited by Wonwoo Yoon" |
| 감독 서브 8종 인트로 덱 + "Metatake Editorial" 크레딧 푸터 가족 — 문형 변주 주의: "Analysis by"(theorist:501·concept:602,927·credits:298·credits/[person]:688) · "By"(movies-like:213) · "Drafted by"(meaning:278) · "ranked by"(frame:240) · "compiled by"(director/_shared:1012) | "Metatake Editorial" | 층에 맞춰 A("Written/Drafted by Metatake AI")·B("Assembled/Composed by the Metatake method")·C("Computed by Metatake AI") 갈아끼움 — 감독 서브는 대부분 규칙 조립(B), 미스리딩·에세이 계열은 A. **치환은 grep 기반으로(문형이 제각각이라 일괄 치환 불가)** |
| lineage/locations 레코드 푸터(film/lineage:397·lineage/[slug]:391·locations 3종) | "Metatake Editorial · … compiled …" | B: "Metatake · compiled by the Metatake method · supervised by Wonwoo Yoon" |
| `app/film/[slug]/[desk]/page.tsx:277-284` 에세이 플라크(engine 렌더 :281) + **별도 파일** `app/film/[slug]/[desk]/ko/page.tsx:216-221` 한국어 플라크(Byline :204·Provenance :223 — locale prop 누락, §7 i18n 갭) | "engine: {essay.engine}" 이미 엔진명 공개 | 유지 + "Written by Metatake AI ({engine})" 형식으로 격상 — 이 플라크는 새 체계의 모범 선례 |

### 5-6. "no AI/no LLM" 클레임 정밀화 (B층 — 참이므로 유지하되 어휘 통일)
- ⚠️ 경로 정정: `components/read/FilmSentences.tsx`는 **존재하지 않는다** → **`components/FilmSentences.tsx:104`**(임포트 `app/film/[slug]/_shared.tsx:41`, 렌더 :1146·:1729). "tv 메타 4종"도 실제 **3종**(`tv/lists:19`·`tv/list/[slug]:48`·`tv/[slug]:66`; 4번째로 센 `TVListView.tsx:45`는 컴포넌트).
- ⚠️ **`components/FilmSentences.tsx:15-17`은 의도적 좁은 스코프 — 넓히지 말 것.** 주석 원문: "'SQL-assembled, not AI-written'은 S28 문장 조립(LLM-0)을 서술한 것이지 파이프라인 전체가 결정론적이라는 주장이 아니다(**위치 입력은 S19 sonnet 추출기**) — 과대표기 금지." 선행 구현자가 이미 D12와 같은 문제에 부딪혀 스코프를 좁혀 해결한 흔적이다. D4 재작성이 이 문장을 넓히면 **참인 문장이 거짓이 된다**. `_shared.tsx:775`는 이 문구가 **EN 전용 로케일 게이트**(:780)의 근거임을 기록 — 재서술 시 i18n 부작용 있음.
- FilmSentences.tsx:104 · EntityFantasia.tsx:106 — D4 확정안(크레딧 교체, "not AI-written" 디스클레이머 유지). ⚠️ EntityFantasia는 /ko/director에도 영어로 렌더(로케일 게이트 없음) — 이번엔 현상 유지, 기록만.
- SentenceLexicon.tsx:183 "SQL-assembled, no AI text" — 참. 유지(홈·/network·필름 커넥션 데스크 렌더).
- BroadcastCard.tsx:69,96 · TVSingle:36 · TVDirectory:220 · TVListView:45 · tv 메타 4종 — "no LLM" 참. 유지. PlaylistTVEmbed.tsx:33은 **고아 컴포넌트** — 삭제 권고(부활 시 구계약 부활 방지).
- 원칙: B층의 "no LLM" 문구는 새 체계의 모순이 아니라 **층별 정확성의 증거**다. 지우지 말고, A층 라벨과 같은 페이지에 공존할 때 문구가 서로를 부정하지 않는지만 확인(예: /takescore/film — C층 점수 + B층 to.W가 한 페이지).

### 5-7. ⚠️ 외부 배포 표면의 "human-curated" 거짓 클레임 ~~7곳~~ **8곳** (P2 — ✅ 완료 2026-07-17)

> **정정 1 (2026-07-17):** 8번째가 있다 — **`public/.well-known/mcp/server.json:5`** "Original, human-curated film criticism for 6,700+ films…". **배포된 실파일**(MCP 레지스트리가 소비)이라 `app/api/mcp/route.ts:64`와 도달 범위가 같다. §7의 "전수 확인됨" 주장은 거짓이었다.
> **정정 2:** 코드 밖 잔존 7건은 코드 수정으로 못 고친다 — **오너가 외부 리스팅을 직접 수정해야 함**: `docs/GPT-STORE-PACKAGE.md:25` · `docs/MCP-DIRECTORY-SUBMISSION.md:45,77` · `docs/LAUNCH-POSTS.md:19` · `extension/store/build-store-assets.py:48,88` · `extension/README.md:46` · `metatake-extension{, 2}/README.md:38`.
> **정정 3 (오탐 방지):** `hourly/TREND-SOURCES.md:58` · `hourly/DESIGN.md:119`의 "human-curated"는 **Techmeme을 서술**한 것 — 건드리지 말 것.
> **정정 4:** 감독 랭킹 "Assembled by Metatake Editorial"은 2곳이 아니라 **3곳**(`takescore:294`·`start:268`·**`theory:369`** 누락). 그리고 **아래 "라벨 B로" 지시는 D7이 뒤집었다** — `start`·`theory`가 렌더하는 reason 산문은 Opus 생성이므로 **A**다. B를 붙이면 "언어모델 미사용"이 LLM 산문 위에 얹히는 **신규 거짓**이 된다(§0 원칙 1 정면 위반). `takescore:294`만 다름: 산문은 규칙(LLM-0)·숫자는 AI 산출 → B+C 합성 표기.
AI 초안 비평을 **인간 저작으로 표기하는, 외부로 가장 널리 퍼지는 문구들.** 새 체계 이전 기준으로도 거짓이므로 관찰 창을 기다리지 않고 P2에서 수정한다(대부분 비색인 API/기계 표면이라 SEO 리스크 없음):
| 위치 | 현재 | 변경 |
|---|---|---|
| `app/mcp/page.tsx:79` | "original, human-curated criticism" | "original criticism — AI-drafted, human-reviewed" |
| `app/api/mcp/route.ts:64` (MCP instructions — 모델에게 그대로 전달됨) | "original, human-curated film criticism" | 동일 교체 |
| `app/api/v1/route.ts:26` · `app/api/v1/openapi.json/route.ts:18` | "human-curated" | 동일 교체 |
| `app/api/v1/embed.js/route.ts:44` · `app/embed/takescore/[slug]/route.ts:45` (제3자 사이트에 박히는 배지 title) | "human-curated film criticism" | "AI-computed, human-directed film criticism" |
| `lib/pack.ts:82` citeLine | "original, human-curated interpretation" | "original, AI-drafted and human-reviewed interpretation" — **같은 파일 :271("AI-generated criticism with human curation")과의 자기모순 해소** |
동류 수정: Ask/Chat/RAG 스탬프 "Grounded in the corpus · **retrieved, not generated**"(ask-ai:111·rag:171·chat:183) — 답변 산문은 LLM 합성이므로(로딩 문구 스스로 "then composing") "retrieved, then composed — every claim linked to its source"로. 감독 랭킹 페이지의 "Assembled by Metatake Editorial"(director takescore:292-295·start:267-268)은 규칙 조립 층이므로 라벨 B로(§5-5 표와 일관 — 필름 다이제스트가 의도적으로 피한 과대표기를 여기서도 제거).

### 5-8. JSON-LD (원칙 불변 + 선택적 정리 P5)
- **불변:** Review author=Organization "Metatake"(film _shared:1419, takescore/film:200) · 지배 패턴(author=Org, editor=Person) 전체 · Organization name "Metatake"(JSON-LD에 "Metatake AI"라는 엔티티를 만들지 말 것 — 스키마상 조직은 하나).
- **선택 정리(P5, 별도 커밋):** now/daily author url이 /about을 가리키는 이상치(:77) → /editor로 · @id 누락 표면들(catalog:205, trope:292, figure:248, next:203, q:186) → `editor#person` @id 통일 · strong-misreadings/[fw]:41,68의 author=Person(유일한 개인 저자 스키마) → 지배 패턴(author=Org)으로 · methodology/[slug]:89-90·poetics:72-73·takescore/[dim]:259·now:83의 author=Person — D6·라벨 A 전환과 정합하게 author=Org+editor=Person으로 검토. desk 에세이(:230 publisher-only)에 author=Org 추가 검토.

---

## 6. Phase 3 — 이름·이니셜 전수 정리 + DB 확인 결과

- 코드 표면의 이름 등장 전체 목록은 §5 작업표가 커버한다(탐사로 확정: 이름은 전부 JSX 리터럴, 생성기 주입 0, 마이그레이션 시드 0). §5에 없는 이름 표면 — /editor 프로필(정본, 유지) · /about "Who answers"(:129,146 유지+D1 반영) · /contact(:16-18 유지) · /partners(:126 "Editor and lead author" 유지) · Footer 이메일(유지) · llms.txt(§4-4) · updates 피드(:106, append-only — 수정 금지, 신규 포스트로 공지) · lib/seo.ts PERSON_SAME_AS·ORCID(유지) · public/.well-known/security.txt(유지).
- **DB 전수 스윕 결과 (2026-07-17, 프로덕션 kyniq 읽기 전용, ~80테이블/~140 산문 컬럼, jsonb 포함): 독자 노출 산문층에 편집자 이름 잔존 0.**
  - **인비테이션 확정 클린:** EN = `public.takes.rationale WHERE is_invitation=true` 1,959행 — 0건(히트 3건은 전부 영화 인명 오탐). KO = `content_i18n` invitation 1,898행 포함 테이블 전체 21,561행 — 0건. **크레딧 변경은 프론트 템플릿 수정으로 완결, DB 재작성 불필요.**
  - 전 콘텐츠층 클린: film_sentences(44만행, "yoon" 321건 전부 윤종빈 등 영화 인명) · takes · curation.film_comment(11,633) · meta_takes · essays · canonical_answers · now_* · posts · film_reception · director_* · theory·lineage·tv·figures 등. `%w. yoon%` 정확 패턴 0건.
  - 진짜 히트 4건은 전부 내부/운영 행: `curation.rule` 2행(편지 규약 문서 — **to.W 서명 변경 시 이 rulebook의 `comment.language` 키도 UPDATE해서 규약-표면 동기 유지**, 이것이 유일한 DB 후속 작업) · profiles 오너 계정 1행 · crm_settings 1행 · crm_touches/inbound(오너 아웃리치 스레드 — CRM 실명 발신 정책상 정상).
- **⚠️ 부수 발견(오너 보고, 이 개편 범위 밖) — 2026-07-17 실측으로 위험도 하향 정정:** `curation.*` 11개 테이블은 RLS 비활성 + 정책 0개가 **맞다**. 그러나 **"anon 키로 읽기/쓰기 가능"은 거짓이었다** — `curation` 스키마는 PostgREST에 **노출돼 있지 않다**(anon 요청 시 `PGRST106 Invalid schema: curation`, HTTP 406; 노출 스키마는 `public, graphql_public`뿐. 대조군 `public.films`는 200). 따라서 `curation.rule`의 필명↔실명 매핑("W. Yoon=제원우")도 **외부 노출 없음**.
  → 실제 성격은 **잠복 위험**이다: 누군가 `curation`을 노출 스키마에 추가하는 순간, 정책이 하나도 없으므로 전부 즉시 공개된다. **RLS 자동 활성화는 여전히 금지**(정책 없이 켜면 서비스롤 경로가 파손). 조치는 "노출 스키마를 늘리지 않는다"로 충분하며, 긴급도 아님. auto-memory `ai-credit-overhaul-plan`의 동일 경고도 이 내용으로 정정할 것.

## 7. Phase 4 — 작동방식 서술 전면 정합 감사 (전수 스윕 결과)

감사 규칙: **CONTRADICTED = 즉시 수정**(§5와 동일 커밋 가능) · **VAGUE**("we/Metatake"가 주체 불명) = 라벨 어휘로 조이되 과도한 도장 금지(모든 문장에 크레딧을 달라는 게 아니라 **거짓만 없애면 된다**) · **AFFIRMED = 불변.**

**CONTRADICTED (전수 — §5-7·D5에 미포함분 없음이 확인됨):** ① "human-curated" 외부 배포 7곳(§5-7) ② /manifesto 배너(D5) ③ pack.ts 자기모순(§5-7) ④ 감독 랭킹 "Assembled by Metatake Editorial"(§5-7) ⑤ Ask/RAG "retrieved, not generated" 스탬프(§5-7) ⑥ director/next "curated by hand"(D7 확인 후 처리).

**VAGUE 클러스터 (P4에서 일괄 조임 — 문구는 §1 어휘 기준, 표면마다 문장형 다르게):**
| 클러스터 | 위치 | 조임 방향 |
|---|---|---|
| "Metatake reads" 브랜드-행위자 패턴 | lib/lead.ts:40 · lib/related.ts:789("How Metatake reads {film}") · lib/hubExplore.ts:141 · strong-misreadings:11,36-39 · manifesto 타이틀/데스크 · whereto:324 | 브랜드 주어는 허용 관행이나, 크레딧 라벨이 같은 페이지에 있으면 유지 가능 — 라벨 없는 표면만 "reads, by method" 명시. ⚠️ lead.ts는 계약 문자열(§10-7) — 변경 시 오너 승인 |
| "Curated, not algorithmic" | film _shared:1869-1873(Watch next — 픽별 브리지는 LLM 산문) · director _shared:1049,1216-1218,1249 · curious/directors:217 · ko.ts:192-193,336,346,437 | "Curated by the method, reasons written by Metatake AI" 방향 — D7 결과에 따라 확정 |
| "we rank/recommend/choose" | what-to-watch:16 + MarqueeExplorer:268 · lineage/for-w-heo:35,90-94 | "ranked by TakeScore"·"marked by the method" 등 계산 주체 명시 |
| Now 데스크 인간 화법 | now:151-153("the desk reviewed…judged") · now/wire:17,72 · "We wrote it" 배지(now/wire:109·now/daily:139) | 라벨 A 정합 화법("the desk" = AI+감수 체계임을 methodology가 정의하므로 배지는 "Written here" 등 중립형 검토 |
| /curious 행위자 불명 | :21,110("answered in full, then fact-checked") · :173-175("researched") · :228 | 엔진룸 파이프라인 명시("answered by Metatake AI, adversarially fact-checked") |
| /about 과일반화 | :107-109 "Every page is drafted by Metatake Editorial" | §4-4에서 층 구분으로 해소 |
| 기타 | frame:183("Metatake ranks") · AskBox:27 · director life 다이제스트(ko.ts:346) | 케이스별 §1 어휘 |

**AFFIRMED 확인(불변 유지, 재확인만):** about:11,49,94 · editor:9,20,75-88 · llms.txt · takescore/about:116-122 · film why-watch:1573·미스리딩 sub:1645·커넥션 푸터:1941,1996 · reception:422-425,514 · figure:472-473 · trope:519-520 · engine-room:78-102 · Fantasia/TV no-LLM 클러스터 · partners:94,97 · pack.ts:271. 참고: Tier-2 다이제스트의 독자 노출 헤더는 "The Metatake record on {title}"(_shared:1070)이며 "Editor's digest"는 CSS/주석에만 존재. 엔진룸의 "The prose is never edited after verification"과 /editor의 "edits or cuts" 서술은 층이 다르므로(데스크 에세이 vs 클로즈리딩) methodology 개정 시 한 문장으로 구분 명시.
- 개편 공지: /updates에 신규 포스트 1건(§7 규약: 배열 맨 위 prepend, "News" 명명 금지, 산문 편수 발표 금지). 내용: 크레딧 체계 전환 공지 + methodology 링크. D6 정정 공지 포함 여부는 오너 결정.

---

## 8. 롤아웃 순서·SEO 가드 (이 순서를 지킬 것)

**P0.** 오너 결정 D1~D8 확정 → 이 문서에 결과 기입. (D8 문안 초안 2~3안 제시 → 오너 컨펌.)
**P1.** Phase 1(§4: methodology·투명성층·/manifesto D5·/editor·/about 미션 헤드라인 D8) — 한 배포. 읽기 표면 대부분 미변경이므로 색인 리스크 최소.
**P2.** to.W(§5-2) + TakeScore(§5-4) + 개인 바이라인 3종(/now·/now/daily·/poetics) + **외부 배포 "human-curated" 7곳(§5-7 — 거짓 표기라 관찰 창 면제)** — 한 배포. 페이지 수 적고 정직성 개선 효과가 가장 큰 곳.
**P3.** **관찰 창 2~4주.** GSC 색인·노출 추이 관찰(비교 기준: 크롤됨-색인안됨 잔량, 주요 쿼리 노출). 이상 없으면 진행, 하락 시 오너 보고 후 판단.
**P4.** 전면 바이라인(§5-1 공유 컴포넌트 + §5-3 + §5-5 나머지) + §7 감사 반영 — **심야 배포, 배포 배칭**(HANDOFF-DB성능-인시던트 규칙: 대량 변경과 배포 몰아치기 금지, ISR 캐시 초기화가 DB 부하로 직결).
**P5.** 선택 정리(JSON-LD 이상치 §5-7, admin author_name D1 반영, PlaylistTVEmbed 삭제).

**SEO 가드레일:**
- 이번 개편은 **EN 페이지 본문을 전 사이트에서 바꾼다**(ko-프로젝션과 달리 EN 바이트 동일성이 성립하지 않음). 그래서 P2→P3 관찰→P4 순서가 필수다. 구글은 AI 콘텐츠 자체를 벌하지 않으나(공식 입장: 유용성 기준), 수천 페이지 동시 템플릿 변경은 재크롤 물결을 만든다 — GSC "크롤됨-색인안됨"을 막 회복한 상태(56759a6)임을 잊지 말 것.
- 새 크레딧 줄은 **짧게, 페이지당 1~2곳**(상단 Byline + 하단 Provenance 체계 유지). 섹션마다 도장 찍지 말 것 — 템플릿 지문 가중.
- 메타디스크립션·OG는 이번에 건드리지 않는다(별도 결정 전까지).

---

## 9. 검증 (배포 전·후)

1. `npx tsc --noEmit` (독스 콘텐츠 검증 포함 — methodology 수정의 표준 검증).
2. `node scripts/i18n-audit.mjs` — 새/변경 t() 키가 ko.ts에 전부 있는지(키는 byte-exact, 선행·후행 공백 포함). 영어 폴백은 **조용히** 일어나므로 감사 필수.
3. 라이브 검증(배포 후): `/film/parasite`(Tier-1 A+B+C 공존) · Tier-2 카탈로그 1편(Byline 부재 유지 확인) · `/takescore/film/<slug>`(to.W from-line) · `/director/<slug>`(dr-tow) · `/now/<slug>` · `/poetics` · `/methodology/what-ai-does` · `/manifesto` · `/ko/film/<slug>`(ko 라벨) · `/llms.txt`. ⚠️ 캐시 함정 2종: 배포 직후 감사는 구 ISR 캐시 오진 — 캐시버스터(?v=) 필수([[live-audit-isr-cache-trap]]) · React 주석 노드가 텍스트를 쪼개므로 라이브 HTML grep은 부분 문자열로([[live-html-grep-and-cache-traps]]).
4. JSON-LD 검증: 변경 페이지 소스에서 author/editor 노드가 의도와 일치하는지(P5 전에는 "변경 없음"이 정답).
5. /terms·/about·/methodology·바이라인이 서로 모순 없는지 최종 크로스리딩(§1 표 기준).

## 10. 금지·함정 요약 (위반 시 롤백 사유)

1. **앵커 불변:** /methodology 6앵커 + /about#strong-misreadings 리네임·삭제 금지.
2. **Review author=Organization 불변**(SEO 확정 결정). JSON-LD에 "Metatake AI" 조직 신설 금지.
3. **Fantasia "not AI-written" 디스클레이머 삭제 금지**(참인 문장 + 계약) — 크레딧 반쪽만 D4로 개정.
4. **Tier-2에 Byline(라벨 A) 부착 금지** — 규칙 조립 레코드에 "Written by AI"는 과대표기(기존 구분 유지).
5. **H층 보호:** where-to-start(D7 확인 전)·오너가 직접 쓴 텍스트에 A/B 라벨 금지.
6. **영어 문구 변경 = ko.ts 키 동시 교체.** 하나라도 빠지면 /ko가 영어로 조용히 폴백.
7. **lead.ts·pack.ts 계약 문자열 임의 변형 금지**(API/MCP 소비자 바이트 계약).
8. **updates 피드 append-only** — 과거 포스트 수정 금지, "News" 명명 금지, 산문 편수 발표 금지.
9. **수신자 WY. Heo 표기 불변**(실존 개인 신원 상세 금지 — 기각 확정 사항).
10. **워처 스코프:** 루트 파일(이 문서·middleware 등)은 수동 커밋 — 자동배포 워처는 app/components/lib만 스테이징. 프로덕션 쓰기(main 병합·배포)는 오너 `!` 실행 관행 준수.
11. **브랜드 어휘 ko 번역 금지**(Metatake·TakeScore·Strong Misreadings·Embedding Fantasia 등 — ko.ts 헤더 계약).
12. **poetics/updates 등 "안티-포뮬러" 층은 기계적 일괄 치환 금지** — 문장 단위 재서술 + 오너 검수.

---

*부록: 탐사 원자료(파일:라인 전수 목록 JSON/MD)는 세션 스크래치 `scratchpad/discovery-*.{json,md}` 및 워크플로우 저널에 보존. 이 문서와 어긋나는 경우 코드가 정본이다 — grep으로 재확정하라.*

---

## 10-bis. 🚨 이 개편이 발굴한 것 — 사이트의 중심 약속이 거짓이었다 (2026-07-17, 오너 확인)

> **이 절이 이 문서에서 가장 중요하다.** 크레딧 표기 개편보다 크다. D1~D8보다 먼저 읽어라.

Metatake는 약 10개 표면에서 **"모든 리딩은 발행 전 인간 편집자가 읽고 승인한다"**고 공표해 왔다. **거짓이다.** 오너가 2026-07-17 확인: **발행 전 사람 검토는 없다.**

**실측 증거(프로덕션 kyniq):**
- `public.takes` — `status='published'` **27,328행, 그중 `reviewed_by`가 채워진 행 0건(0.0%)**.
- **draft 상태가 아예 없다.** take은 `published` 아니면 `retired`뿐 — 사람을 기다리는 상태가 존재하지 않는다.
- `public.content_events` — **take 관련 행 0건**, 그리고 **인간 액터 행 0건**(전부 `actor_kind` = `ai` 또는 `system`). 이벤트 종류 중에 **`meta_take_published_unreviewed`**(203행)가 실재한다 — 코드베이스가 "미검토 발행"에 이름을 붙여두고 있었다.
- `app/admin/review/page.tsx`는 `questions`·`canonical_answers`만 게이팅한다 — **리딩용 검토 UI는 존재하지 않는다.**

**⚠️ 과잉교정 금지 — 참인 부분은 크고 진짜다:**
- **기계 검토는 실재하고 가혹하다.** 독립 체커가 오귀속 개념·발명된 용어·화면 오류·DB가 뒷받침 못 하는 주장을 잡아내고, 실패작은 반려·재실패는 폐기. **`retired` 46,988행 vs `published` 27,328행 — 초안의 약 63%를 죽인다.** 이건 진짜 게이트다. 다만 **사람이 아닐 뿐**이다.
- 편집자는 **방법론·프레임워크·루브릭·체커를 설계했고**, 산출물에 **책임지며**, 정정은 공개되고 그의 앞으로 오며, 언제든 리딩을 retire할 수 있고, 누구도 돈으로 리딩을 넣거나 바꾸거나 뺄 수 없다.
- **정직한 형태:** 모델이 초안 → 기계 체커가 강하게 게이팅 → 발행 → **편집자가 책임지고 틀린 것을 고친다.** 책임은 진짜다. **발행 전 인간 열람이 없을 뿐이다.**

**→ 라벨 A 재설계(§1 표 대체):** `Written by Metatake AI · designed, directed & **reviewed** by Wonwoo Yoon` 은 **가장 큰 층에서 거짓**이므로 폐기.
**신 라벨 A (EN 정본):** `Written by Metatake AI · designed & directed by Wonwoo Yoon, who answers for it`
"reviewed"를 리딩층의 **사전** 주장으로 쓰지 말 것. "answers for it"(책임 절반)은 절대 빼지 말 것(§0 원칙 2).

**교훈:** 이 개편의 진짜 가치는 문구 교체가 아니라 **주장↔코드 대조**였다. 문서(§4-3)가 지시한 문구조차 거짓이었고("Now 레터 = reviewed & signed off by Wonwoo Yoon" — 실제로는 무인 자동 발행), 그 거짓을 그대로 구현했다가 검증에서 잡혔다. **라벨을 붙이기 전에 그 산문을 만드는 스크립트를 열어라.**

---

## 11. AS-BUILT — P1·P2 구현 기록 (2026-07-17, 브랜치 `feat/ai-credit-overhaul`)

**상태: P1·P2 코드 완료 · tsc 청정(선재 오류 15건 외 0) · i18n 감사 통과 · P3 관찰 창 대기.** 배포·main 병합은 오너 몫(§10-10).

### 11-1. ⚠️ 가장 중요한 교훈 — "번역이 아니라 사실 확인이다"

이 개편의 실제 위험은 문구를 놓치는 게 아니라 **새 거짓을 만드는 것**이었고, 실제로 만들었다. 1차 구현 후 적대적 검증에서 **신규 거짓 6건**이 나왔다(전부 수정 완료). 재발 방지용으로 남긴다:

1. **`/methodology` Locations에 "no language model writes any part of it"를 새로 붙였다** — 핀 산문(`pinProse()`가 렌더하는 `narrative_setting`·`scene_role`)은 **`gpt-4o-mini` 출력**이다(`movie_locations_llmsearch.py:170`). D12로 P4에 이월해둔 표면에, 이 개편이 막으려던 바로 그 거짓을 스스로 찍은 것. **§0 원칙 1의 교과서적 위반.**
2. **"reviewed" 남발.** 감독 픽/who-is-next에 "directed & reviewed by Wonwoo Yoon"을 붙였으나 **리뷰 단계가 존재하지 않는다**(로더는 `.strip()`만). 라이브가 즉석 반증: `/director/lars-von-trier/next`가 감독 이름으로 `"Bertolt Brecht's heir Peter Watkins"`를 렌더 중.
   → **라벨 A의 "reviewed"는 층마다 참이 아니다.** takes(클로즈리딩)는 참(리뷰 파이프라인 실재), 감독 픽은 거짓. **A를 통째로 붙이지 말고 층별로 검증하라.**
3. **`ai-disclosure`의 B 정의가 절대문이었다** — "no language model was involved in the writing **at all**". locations 행이 B라서 즉시 거짓. `sentences.ts:43`의 정직한 형식(*"문장은 규칙이 쓴다 · 상류 입력은 모델이 뽑았을 수 있다"*)을 B 정의로 채택해 해소.
4. **"curated" 잔존이 같은 페이지 자기모순을 만들었다** — `next:229` "curated, not algorithmic" vs `next:332` "drafted by Metatake AI". `next:125`는 **JSON-LD·메타디스크립션으로 유출**됐다(기계가 읽는 거짓).
5. **D4가 절반만 됐다** — `sentences.ts`가 "credit은 **currently** *Composed by the Metatake method*"라고 선언했는데 컴포넌트는 여전히 "a data fantasia by Wonwoo Yoon"을 렌더. 문서만 고치면 문서가 거짓이 된다. → 컴포넌트 2종 동반 수정으로 해소.
6. **`sentences.ts`가 위치 입력이 "reviewed되어 저장된다"고 썼다** — 실제 게이트는 **독립 출처 ≥2 규칙 + 모델 verifier**(`verify_candidate`), 사람이 아니다. "corroboration, not a person reading each one"으로 정정.

**규칙화:** 새 문장에 `reviewed / curated / by hand / no language model / verified / human`을 쓰기 전에 **그 문장을 산출하는 스크립트를 열어 확인하라.** 못 열면 쓰지 마라.

### 11-2. 구현된 것

- **P1(§4):** `what-ai-does`(바이라인 절 전면 재작성) · `editorial-responsibility`("review over bylines" 폐기) · `ai-disclosure`(층별 표에 **크레딧 라벨 열** 신설 + B 정의 정직화 + "formerly styled" 1회) · `methodology/page.tsx` 4곳 + 날짜 스탬프 · 독스 8종(`where-to-start` **D7 전면 정정**·`now-playing`·`the-daily`·`why-a-film-is-in-the-index` **D2**·`tiers`·`sentences` **D4**·`metatake-tv`·`open-data` **S10**) · `registry.ts` desc(→ /llms.txt 자동 전파) · `/about`(**D8 "Why now" 신설 절** + 메타디스크립션 + 층 구분 + D6 동기) · `/terms`(S6 맞춤 재작성 + 날짜) · `/editor`("no bylines" 제거 + "formerly styled") · `/llms.txt` · **`/manifesto` 배너(D5)**.
- **P2:** to.W 4표면(**D2** 발신자 + `director/_shared`의 raw title/aria **t() 래핑 결함 동시 수정**) · TakeScore 7표면(**D3 부제**, 표면마다 문장 변주) · 개인 바이라인(`/now`·`/now/daily`·`/poetics` **D6**; `/now`의 **aria-label 중복**도 수정 — 안 고치면 스크린리더에 옛 크레딧 잔존) · **"human-curated" 8곳**(문서의 7 + `.well-known/mcp/server.json`) · `pack.ts` 자기모순(:82↔:271) · Ask/RAG 스탬프 · 감독 랭킹 3곳 · `lib/datasets.ts`.
- **D4 후속:** `components/FilmSentences.tsx`·`EntityFantasia.tsx` 크레딧 교체(디스클레이머 **유지**).
- **오너 추가 결정(2026-07-17):** ① **인원수 주장 금지** — "a small editorial desk that reviews everything"(/editor:20·/about:144·/editor:9 메타)은 사람 팀을 주장하므로 삭제. 대신 **`editor of record`**(책임 소재)만 쓴다. 사람이 몇이든 참이고, 라벨 A의 단수 "reviewed by Wonwoo Yoon"과도 충돌하지 않는다. ② **`writing-for-one-reader.ts` 재서술을 구현 AI가 수행·커밋**(§10-12의 오너 검수 요건을 오너가 명시 위임). 재서술 논지: 편지 산문은 템플릿이고 데스크가 서명한다 — **오너가 건 것은 서명이 아니라 수신자(봉투)** 다. 에세이 자신의 원칙("you cannot bluff a reader who knows you")을 에세이에 적용한 형태.

### 11-3. 남은 일 (오너 몫 / 다음 세션)

| # | 무엇 | 왜 |
|---|---|---|
| **R1** | **`worker/sql/2026-07-17-tow-rulebook-sync.sql` 실행** | §6이 지정한 **유일한 DB 후속**. 에이전트 프로덕션 쓰기가 classifier에 차단됨(메모리의 "차단 반증됨"은 상황 의존 — 이번엔 차단). 실행: `! python3 /Users/jerryje/Documents/MetaTake/worker/apply-sql.py /Users/jerryje/Documents/MetaTake/worker/sql/2026-07-17-tow-rulebook-sync.sql` (⚠️ **절대경로 필수** — apply-sql.py 경로버그) |
| **R2** | **외부 리스팅 "human-curated" 7건** — 코드로 못 고침 | 이미 제3자에 배포됨: `docs/GPT-STORE-PACKAGE.md:25` · `docs/MCP-DIRECTORY-SUBMISSION.md:45,77` · `docs/LAUNCH-POSTS.md:19` · `extension/store/build-store-assets.py:48,88` · `extension/README.md:46` · `metatake-extension{, 2}/README.md:38`. 라이브 리스팅(Chrome 웹스토어·MCP 디렉터리·GPT 스토어) 본문을 오너가 수정해야 함 |
| **R3** | **`director_next.rec_name` 오염 4행** — 이 개편과 무관한 **라이브 데이터 버그** | `"Alfonso Cuarón shares with Béla Tarr"` 등이 감독 이름으로 렌더 + **Person JSON-LD로 유출** 중. D7 조사의 부산물. 별도 티켓 권장. 근본 대책: `director_picks`/`director_next`에 `source` 컬럼 신설(`director_portrait`엔 이미 `source='ai'`가 있다 — **없어서 거짓 주장이 안 잡혔다**) |
| **R4** | **P3 관찰 창 2~4주** → 이상 없으면 **P4** | P4 = §5-1 공유 컴포넌트(+**`/concept` 그림자**) · §5-3 · §5-5 잔여 · §7 VAGUE. 착수 전 **D9~D12 확정**(§2-1) |
| **R5** | P4 전 **ko 역방향 orphan 체크 1회성 스크립트** | `scripts/i18n-audit.mjs`는 **code→dict 단방향**이라 "영어를 바꿔 죽은 ko 키"를 **원리적으로 못 잡는다**(이 개편의 실패 모드 그 자체). alias import(`t as tr`)·동적 키도 못 봄 |
| **R6** | P5: `admin/review` `author_name` · `lib/pipeline.ts` · JSON-LD 이상치 · `PlaylistTVEmbed` 삭제 | ⚠️ `pipeline.ts`의 "You are Metatake Editorial…"은 **라이브 LLM 시스템 프롬프트** — 치환 시 생성 문체가 변함 |

### 11-4. 전환기 상태 (의도된 것)

P1·P2만 배포되므로 **관찰 창 동안 "Metatake AI"와 "Metatake Editorial"이 공존**한다(P4 표면 = 공유 Byline/Provenance·필름 인라인 크레딧·§5-5 잔여). §8이 설계한 순서의 필연적 결과이며, §0-3의 "일부만 바꾸면 최악"은 **최종 상태**에 대한 경고지 롤아웃 중간 상태에 대한 것이 아니다. P4에서 해소된다.
