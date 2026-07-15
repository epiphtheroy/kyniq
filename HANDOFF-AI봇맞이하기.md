# HANDOFF — AI봇 맞이하기 프로젝트 (Agent-Readiness / GEO·AEO)

> **한 줄 정의**: 사람들이 점점 에이전트(ChatGPT·Claude·Perplexity·구직/벤더조사 에이전트)를 시켜 검색·조사·행동을 대신하게 되는 흐름에 맞춰, **에이전트가 좋아하고 통째로 물어가서 자기 사용자에게 전달하고 싶어하는 형태**로 metatake의 정보를 정리·노출한다. 특히 이제 시작하는 **법인 제휴마케팅**에서, 잠재 파트너의 조사 에이전트가 metatake를 발견·신뢰·전달하게 만드는 것이 목표.

- **상태**: 기획·리서치·실측 완료 → **구현 대기** (이 문서 = 실행용 작업지시서)
- **작성일**: 2026-07-15
- **대상 프로젝트(Supabase)**: `kyniq` = `jvgarcqrtsmgfimdcwgo` (도쿄 리전)
- **선행 읽기(메모리 정본)**: [[ai-distribution-surface]] (`HANDOFF-AI배포표면.md`), [[mcp-server-live]] (`HANDOFF-MCP-서버.md`), [[data-business-context-packs]] (`HANDOFF-컨텍스트팩-실행.md`), [[ai-usage-admin-plan]] (`HANDOFF-AI사용현황-어드민.md`), [[ai-disclosure-placement-policy]], [[crm-touchpoint-engine]]
- **핵심 원칙**: 이건 "트래픽 X% 증가" 프로젝트가 **아니다**. (1) 지금 불가능한 에이전트 채널을 **0→1**로 여는 것 + (2) 곧 들어올 크롤을 인용/딜로 바꾸는 **전환율을 미리 세팅**하는 것. 성공은 유입 세션이 아니라 **"답변 속 지명 인용 + MCP/API 풀 + 에이전트 숏리스트 등장"**으로 판단.

---

## §0. 의도 (왜 이걸 하는가)

오너의 문제의식: **검색·조사·구매 행동이 사람에서 에이전트로 이동하고 있다.** 구직자는 구직 에이전트를, 법인 구매자는 벤더조사 에이전트를 쓴다(B2B 구매자 ~94%가 구매 과정에서 LLM 사용, ~83%가 판매자 접촉 *전에* 요건 확정). 그렇다면 metatake는 **그 에이전트들이 물어가고 싶어하는 콘텐츠·데이터·제안을 미리 심어두어야** 한다.

오너의 원래 비유: "구직 에이전트를 위해 구인정보를 올려두듯이." → 이 프로젝트는 그 비유를 metatake의 실제 용도(영화비평 데이터 라이선스 + 법인 제휴)로 일반화한다.

**일반화 법칙(리서치에서 도출):**
> 에이전트는 *자기가 가져갈 수 있는 URL 위에, 깨끗한 자기서술(타입드) 객체로 표현된 것*은 통째로 물어가고, *산문뿐인 것*은 요약하거나 건너뛴다. Google for Jobs가 페이지의 `JobPosting` JSON-LD를 통째로 수집하는 것과 같은 메커니즘 — 우리는 그 "채용공고"의 B2B/데이터 등가물을 만든다.

---

## §1. 개념 모델 — 4개의 순차 관문 (앞이 막히면 뒤는 무의미)

| 관문 | 질문 | metatake 현 위치 |
|---|---|---|
| **① 적격성** | 인용봇이 페이지를 가져갈 수 있나? (robots/WAF, 학습봇↔인용봇 분리) | ✅ **강함** — 이미 인용봇 명시 허용·학습봇 차단 |
| **② 추출성** | 한 문단만 떼어내도 말이 되나? (SSR HTML·결론-우선·자립 청크·문장형 수치) | ⚠️ **약함** — 비평이 분위기부터 시작→결론이 묻힘 |
| **③ 신뢰·선호** | 여러 후보 중 왜 하필 우리를? (엔티티 신원·저자·1차 데이터·사실 일관성) | ⚠️ **공백** — Wikidata 없음, `sameAs` 소셜 3개뿐 |
| **④ 배포 채널** | 에이전트가 끌어가 출처표기하는 타입드 표면 (MCP·API·Dataset·피드) | ✅ **최고 수준**, 단 **B2B 제안 객체가 없음** |

**결론: 진짜 격차는 ③ 엔티티 신원, ② 읽기 표면 추출성, 그리고 기계가독 B2B 제안 객체(§작업 Tier 2) 세 가지.** ①·④는 이미 앞서 있으니 새로 만들지 말고 **격차만** 메운다.

---

## §2. 실측 베이스라인 (2026-07-15 기준, 계측 ~1주치)

> ⚠️ 계측이 전부 이번 주(07-10~15)에 시작됨. 아웃컴 지표는 사실상 **0에 가깝다.** 그래서 "%상승"을 약속할 수 없다(0의 40%는 0). 이 표는 작업 전 스냅샷 = 나중에 "숫자가 바뀌었는지" 비교 기준.

| 지표 | 현재값 | 해석 |
|---|---|---|
| REST `/api/v1` 호출 | **0행** | 에이전트 API 유입 전무 (로깅 오늘 시작) |
| MCP 실제 툴 호출 | **29건/4일 (≈7/일)** | search_films 20·criticism 5·connected 2·takescore 2 — **대부분 본인 테스트 추정** |
| MCP 핸드셰이크 노이즈 | 2,044건 (98.6%) | `_initialize`·`_tools_list` — 실사용 아님 |
| AI엔진→사람 리퍼럴 | **1건** (bing.com) | ChatGPT/Perplexity 답변發 클릭 ≈ 0 |
| 사이트 전체 이벤트 | 7,024/6일 (≈1,170/일) | 소규모 초기 트래픽 |
| **AI 검색봇 실크롤(누적)** | Applebot 1,786·Googlebot 532·Bing 387·**OAI-SearchBot 73·PerplexityBot 28·Claude-SearchBot 3·Claude-User 7** | ✅ **적격성 게이트 작동 중** — 인용봇이 이미 방문 |

**두 가지 시사점:**
1. **인용봇은 이미 문 앞에 와 있는데(OAI 73·Pplx 28·Claude 3) 그들이 물어갈 타입드 표면·신원이 없어 전환이 0.** 이 간극을 메우는 게 이 프로젝트.
2. **Applebot이 최대 AI 크롤러(1,786)**인데 robots가 `Applebot-Extended`를 차단 중 → §Tier0 0.3에서 오너 결정 필요(본체 Applebot은 통과, Extended는 학습 opt-out).

---

## §3. 이 작업의 "수치 효과"는 두 종류다

### (A) 0→1 능력 잠금 해제 — 측정 가능·확실 (%가 아니라 스위치)
| 작업 | 지금 | 작업 후 |
|---|---|---|
| MCP `search`+`fetch` 툴 | ChatGPT Deep Research **호출 불가(하드 0)** | 딥리서치 표면 전체에서 **호출 가능** |
| 커넥터 디렉터리 등록 | ChatGPT·Claude 툴 목록 **부재(0)** | 최고-인텐트 에이전트가 **발견** |
| `/partners` + Dataset 스키마 | Dataset Search 노출 0, 전달할 제안 **없음** | Dataset Search 색인 + **타입드 제안 통째 전달** |
| Wikidata + `sameAs` | 엔티티 미해결 → **오귀속/크레딧 분산** | **지명 인용** |

### (B) 확률 배수 — 오늘의 0은 안 움직이지만 미래 볼륨의 전환율을 세팅
answer-first 리드·통계 문장화·자립 청크·엔티티 신원 = **크롤/쿼리 1건당 인용 확률**을 올림. 연구 벤치마크(다른 사이트 기준, 우리 값 아님): 통계+인용+출처 **+30~41%**(Princeton GEO, KDD 2024), 자립 청크 **~2.3배**, 고코사인(>0.88) 구절 **최대 7.3배**, 첫 100단어 결론-우선이 최상위 인용원의 ~90%.

### B2B 효과 (진짜 목표) — 트래픽 지표가 아님
잠재 파트너의 조사 에이전트가 "영화비평 데이터 제공사"를 조사/검증할 때, **깨끗한 타입드 제안(누가·무엇을·라이선스·연락처)이 통째로 전달되어 숏리스트에 등장하느냐(0→1).** 숏리스트 등장 여부가 딜을 가른다 — 어떤 트래픽 %보다 가치 큼.

### 정직한 규모·타이밍
니치 + 1주차 기준 3개월 현실적 아웃컴은 **수십~수백 단위** AI-귀속 접점(수천 아님). 크롤:유입 비율 1,700:1(OpenAI)~38,000:1(Anthropic)이라 인용이 잘 돼도 클릭은 소수. **성공을 트래픽으로 판단 금지.**

---

## §4. 작업 목록 (Tier 0 → 3, 파일 경로·수용 기준 포함)

> **커밋 규율(중요)**: `app/**`·`components/**`·`lib/**`는 워처가 스테이징. 그러나 **`middleware.ts`·`public/.well-known/*`·사이트맵은 수동 커밋**([[autodeploy-watcher-scope]]). Supabase 마이그레이션은 오너 `!` 실행 토큰 필요할 수 있음.
> **라이브 감사 함정**: 배포 직후 ISR 캐시가 구버전을 보여줄 수 있음 — 코드 먼저 확인 + 캐시버스터([[live-audit-isr-cache-trap]]).

### ── Tier 0: 배관 점검·수리 (이번 주, 대부분 시간 단위) ──

**0.1 SSR 확인 (curl 감사)** · 읽기 전용
- **할 일**: JS 없이(`curl`) 비평 본문·TakeScore 숫자·촬영지·Q&A가 첫 HTML 응답에 있는지 확인. anon/DB-timeout 폴백 경로가 빈 껍데기를 내보내지 않는지.
- **왜**: AI 크롤러(GPTBot·ClaudeBot·PerplexityBot·OAI-SearchBot)는 JS 실행 안 함·하이드레이션 안 기다림·재시도 안 함.
- **수용 기준**: 대표 5개 페이지(film 본문, takescore, locations, misreadings, methodology)에서 핵심 텍스트·숫자가 raw HTML에 존재. 폴백 경로 포함.
- **파일**: (검증만) Next.js SSR/ISR, [[isr-caching-pattern]]

**0.2 WAF 봇 통과 검증** · 읽기 전용
- **할 일**: OAI-SearchBot·Claude-SearchBot·Claude-User·ChatGPT-User·PerplexityBot·Googlebot이 미들웨어/WAF 끝단까지 통과하는지. Bytespider 잡는 그물에 인용봇이 안 걸리는지.
- **수용 기준**: 각 인용봇 UA로 요청 시 200(403 아님). robots.txt뿐 아니라 실집행층까지.
- **파일**: `middleware.ts`(수동커밋), Bot Sentinel 루프([[vercel-waf-bot-block]])

**0.3 [오너 결정] Applebot-Extended 재검토**
- **할 일**: 현재 `app/robots.ts`의 `TRAINING_BOTS`가 `Applebot-Extended`·`Google-Extended`·`Amazonbot`·`Meta-ExternalAgent` 차단. **§2에서 Applebot 본체가 최대 크롤러(1,786회)로 확인됨.** `Google-Extended`는 순수 학습 토큰(인용봇 Googlebot과 별개)이라 **유지 권장**. `Applebot-Extended`(Apple Intelligence 그라운딩 경계 흐림)는 오너 결정.
- **수용 기준**: 오너가 명시 결정 후 반영. 임의 변경 금지.
- **파일**: `app/robots.ts` (현재 인용봇 허용/학습봇 차단 구조는 이미 올바름 — 건드릴 곳은 이 한 토큰뿐)

**0.4 ⭐ 엔티티 신원: Wikidata + `sameAs`** (Tier 0 최대 레버)
- **할 일**:
  1. **Wikidata 항목 생성**: Metatake(조직) + 제원우(저자, 경희대 박사 2022, `knowsAbout`=film criticism). Q-ID 확보. ⚠️ **notability 허들 가능** — 제3자 출처가 부족하면 반려될 수 있음(→ §2.7 언드미디어와 상호 의존).
  2. `app/layout.tsx` `#org`의 `sameAs`(현재 `lib/seo.ts:194` `SOCIAL_PROFILES` = Substack·Letterboxd·X 3개)에 **Wikidata URI 추가** + 편집자 `Person` 노드 교차링크(`founder`/`author`).
  3. **Movie 노드에 `sameAs`** = TMDB(이미 보유)+IMDb+Wikidata URI. 감독 `Person`도 동일(Wikidata/VIAF).
- **왜**: 답변 엔진은 구절 매칭이 아니라 **엔티티 검증**으로 작동. 신원 미해결 시 "Metatake"·`metatake.net`·`net.metatake/mcp`·"제원우"가 한 실체인지 몰라 크레딧 분산. 실무 보고: 신규 Wikidata+`sameAs`가 4~8주 내 AI 답변 반영.
- **⚠️ 정책 무충돌**: 저자-신원 스키마는 E-E-A-T 저자 귀속층. "AI-drafted 자기라벨 금지"([[ai-disclosure-placement-policy]])는 *읽기표면 바이라인*에 관한 것 — **인간 저자 신원 스키마는 오히려 권장**되며 정책과 일치.
- **수용 기준**: Rich Results/Schema Validator 통과. `sameAs`에 Wikidata URI 포함. Movie 샘플에 TMDB/IMDb/Wikidata URI 3종.
- **파일**: `app/layout.tsx`, `lib/seo.ts`, film/director `page.tsx`. Wikidata 항목 생성 자체는 오너 몫(계정).

**0.5 사실 일관성 = 신뢰 불변식**
- **할 일**: TakeScore·개봉연도·감독귀속·슬러그를 Tier-1↔Tier-2↔API↔MCP↔컨텍스트 팩 전부에서 **단일 필드에서 파생.** Tier-2/중복 표면에 canonical URL 확인.
- **왜**: 검색된 문서들이 모순되면 모델이 그 출처를 신뢰 안 하고 버림.
- **수용 기준**: 무작위 10개 영화에서 5개 표면의 TakeScore/연도 완전 일치.
- **파일**: `lib/pack.ts`(이미 API/MCP 공유 소스 — 좋음), 점수 RPC.

**0.6 JSON-LD 정밀화(늘리지 말고)**
- **할 일**: 모든 스키마 값이 화면 가시 텍스트와 문자 그대로 일치(특히 TakeScore 숫자 — 불일치 시 스팸 구조화데이터 조치 위험). 빈 placeholder 스키마 제거(부분충전 스키마는 ~18점 인용 페널티). CI에 Rich Results 검증 훅.
- **왜**: 스키마는 **신원용**이지 직접 인용 레버 아님(Ahrefs 1,885페이지: 노이즈~소폭 하락). "스키마는 신원, 인용은 산문."
- **파일**: 약 40개 페이지 타입의 JSON-LD.

### ── Tier 1: 최고 ROI 신규 표면 (2~4주, 실험 검증 레버) ──

**1.1 ⭐ 모든 읽기 표면에 결론-우선(BLUF) 리드**
- **할 일**: 에세이 앞에 **2~4문장·엔티티 명시·주장 먼저** 리드. 예: *"「화양연화」(2000)는 반복으로 그리움을 무대화한다 — Metatake의 독해는 반복되는 계단 숏이 어긋난 만남을 형식적 리듬으로 바꾼다고 본다. TakeScore 8.3/13."* 분위기 산문은 리드 아래로. **리드 문자열 = 팩/API가 내보내는 것과 동일 문자열 재사용.**
- **왜**: 최상위 인용원 ~90%가 첫 100단어에 핵심 답변. 비평의 "결론 묻기" 본능과 정반대 — **가장 강한 단일 구조 레버**, 재작성 아니라 템플릿 변경(기존 한 줄 논지+TakeScore를 위로).
- **수용 기준**: film 페이지 템플릿에 리드 블록 추가, 백필 렌더. 리드가 팩/MCP 문자열과 동일.
- **파일**: film `page.tsx`, `lib/pack.ts`.

**1.2 구절 단위 자립 청크**
- **할 일**: 각 H2/H3가 문맥 없이 생존하게 — 섹션 첫머리에 엔티티명 재명시("그 영화" 금지), 한 섹션 한 아이디어, 토픽 문장 전면, ~130~200단어, 질문형 헤딩("「멀홀랜드 드라이브」의 파란 상자는 무엇을 하는가?").
- **왜**: 검색은 구절 단위. 페이지 1위여도 청크 미포착이면 인용 0. Claude Citations API는 문장 단위.
- **파일**: 읽기표면 렌더러.

**1.3 Princeton GEO 승자 3종 주입** (실험상 +30~41%)
- **할 일**: (1) **출처표기된 통계** — TakeScore와 13차원 하위 점수를 문장으로("Metatake의 TakeScore 8.3/13, 형식통제 9/10"), 정전순위·촬영지 수. **거의 공짜(데이터 이미 있음).** (2) 짧은 비평가/출처 **인용문**을 각 독해에. (3) 이름·링크된 **출처**(기존 리셉션 파이프라인 출처를 산문 인라인으로).
- **⚠️ 하지 말 것**: 제목 키워드 스터핑·전문용어 남발 = 기준선 이하 성과.
- **파일**: 리셉션 파이프라인, `lib/pack.ts`.

**1.4 공개 TakeScore 방법론 페이지**
- **할 일**: `/methodology/takescore`(또는 기존 `/methodology` 허브에 병합)로 13차원·척도·산출법 정의. 팬아웃 하위질문(무엇/어떻게/커버리지)을 자립 구절로.
- **⚠️ 앵커 보존**: `/methodology` 허브 앵커 6종 절대 보존([[methodology-docs-hub-plan]]).
- **파일**: `/methodology` 허브(이미 존재).

**1.5 llms.txt에 기계 표면 광고**
- **할 일**: `app/llms.txt/route.ts`에 `## For machines — API, MCP & datasets` 섹션 추가: OpenAPI URL(`/api/v1/openapi.json`)·MCP 엔드포인트+툴 목록·`/data`·Zenodo DOI·CC BY-NC 표기 + 복붙 예시 호출 2~3개. **현재 llms.txt는 코퍼스만 알리고 무료 API/MCP/데이터셋을 언급 안 함 — 낭비된 인계.**
- **⚠️ 건드리지 말 것**: 현재 llms.txt의 "AI-drafted, human-edited" 문구는 **전용 AI-공개층이라 정책상 유지**([[ai-disclosure-placement-policy]] — 읽기표면 바이라인만 금지, llms.txt는 공개 허용층). 이 문구 제거 금지.
- **파일**: `app/llms.txt/route.ts` (약 1시간)

### ── Tier 2: B2B/제휴 에이전트 표면 ("채용공고" 등가물) ── ★ 오너 최우선

**2.1 ⭐ 단일 기계가독 제안 페이지 `/partners`** (없음 → 신설)
- **할 일**: `app/partners/page.tsx` 신설. 하나의 `@graph`에: `Organization`(`#org` + 강화된 `sameAs`·`knowsAbout` + **`ContactPoint` `contactType:"business partnerships"` + 실제 이메일**) + `Dataset`(들, §2.2) + `Service`/`WebAPI`(`offeredBy` 조직, `license`=CC BY-NC 4.0 URL, `availability`, 가격 또는 "상업 조건 문의" `Offer`). **동일 사실을 접힘선 위 자립 산문 리드로도** 전면 배치.
  - 산문 리드 예: *"Metatake는 6,700+편의 구조화된 영화비평 데이터를 라이선스합니다: 다중 프레임워크 독해, 13차원 TakeScore, 130개국 ~17,341개 촬영지, 모티프, 유사영화 그래프. CC BY-NC 4.0로 REST API·MCP·데이터셋 다운로드 무료, 상업 조건은 문의."*
- **왜**: 생태계 절반(평문 RAG: Perplexity·Claude)은 JSON-LD를 안 읽음 → 산문 리드 필요. 나머지 절반(지식그래프 파서)은 타입드 객체를 통째로 듦 → **둘 다 제공.** 이 페이지가 JobPosting의 B2B 등가물.
- **수용 기준**: footer·MCP 툴 설명에서 링크. Rich Results 통과. 산문 리드가 접힘선 위 raw HTML에 존재.
- **파일**: `app/partners/page.tsx`(신설), footer 컴포넌트.

**2.2 Dataset 스키마 수리·재배치**
- **현 상태(확인됨)**: `app/locations/page.tsx:24` Dataset 노드에 **`license` 없음·`distribution`/`DataDownload` 없음·`identifier`(DOI) 없음·`variablesMeasured`/`temporalCoverage` 없음.** `app/data/page.tsx`엔 **Dataset JSON-LD 자체가 없음.**
- **할 일**: `/data`(+`/partners`)에 팩별 `Dataset`: `license`=`https://creativecommons.org/licenses/by-nc/4.0/`·`isAccessibleForFree:true`·`creator`=`#org`·`identifier`=**Zenodo DOI `10.5281/zenodo.21336967`**·`temporalCoverage`·`variablesMeasured` + **`distribution[]`의 `DataDownload`**(Hugging Face·Zenodo·CSV/JSONL·`/api/v1/locations`, 각 `encodingFormat`). 랜딩을 사이트맵에 추가.
- **왜**: `Dataset`+`DataDownload`가 Google Dataset Search를 구동·벤더조사 에이전트가 "실재·라이선스·다운로드 가능" 판단. distribution·license 없는 Dataset은 그 에이전트에게 투명인간. **가장 전략 부합·미개발 스키마.**
- **파일**: `app/data/page.tsx`, `app/locations/page.tsx`, 사이트맵.

**2.3 ⭐ MCP `search`+`fetch` 툴 추가 → 커넥터 디렉터리 등록**
- **현 상태(확인됨)**: `app/api/mcp/route.ts` 툴 = `search_films`·`get_film_criticism`·`get_takescore`·`find_connected_films`(라인 ~87–146, 디스패치 ~340). `RO` 힌트 상수(라인 83)·`INSTRUCTIONS`(라인 68) 이미 있음.
- **할 일**:
  1. **읽기전용 `search`(id+title+url 반환)·`fetch`(id로 전문 반환) 툴 2개 추가.** **ChatGPT Deep Research는 이 두 이름이 없는 서버를 거부**(딥리서치는 오직 이 두 이름만 호출). 현재 툴셋은 이 요건 **미충족**. 기존 도메인 툴은 유지하고 병렬 추가.
  2. **Claude Connectors Directory** 제출: OAuth 사용자 동의 + **개인정보처리방침**(없으면 즉시 거부) + `readOnlyHint`/`destructiveHint`(이미 설정됨 ✅).
  3. **ChatGPT** apps/plugin 포털 제출.
- **⚠️ caveat**: MCP 툴이 `mcp_calls`에 로깅 → 엄밀히는 부작용이라 `readOnlyHint:true` 논란 소지(실무상 분석 로깅은 읽기전용 취급이라 거의 문제없음). 로깅을 응답 의미론과 대역 외로 유지. **MCP 핫패스 DB 금지**([[mcp-server-live]]).
- **수용 기준**: `search`·`fetch`가 MCP `tools/list`에 노출·정상 응답. 딥리서치 테스트 통과.
- **파일**: `app/api/mcp/route.ts`, `lib/pack.ts` 재사용.

**2.4 모든 페이로드에 출처표기 표준화**
- **할 일**: 모든 REST·MCP 결과 객체에 동일 3필드 `canonical_url`·`attribution:"Metatake"`·`license:"CC BY-NC 4.0"` + `as_of` 날짜. (현재 MCP `INSTRUCTIONS`·팩 footer엔 있지만 **모든 객체에 인-밴드 균일하게**.) 본문에도 `Source: Metatake — metatake.net/film/…` 삽입.
- **왜**: CC BY-NC은 법적 백스톱일 뿐 출처표기 강제 못 함(CC 자신이 "기계 재사용에 제한적"이라 명시). 크레딧은 **페이로드에 실려 가는 출처표기**로만 안정 이동 → "스크랩 원료"에서 "지명 출처"로 전환.
- **파일**: `lib/apiv1`, `lib/apiGuard`, `lib/pack.ts`, `app/api/mcp/route.ts`.

**2.5 well-known 카드 + discover→query→cite 상호링크**
- **할 일**: 정적 **`/.well-known/mcp/server.json`**(레지스트리 `server.json` 미러) + **`/.well-known/security.txt`**. 체인 상호링크: 레지스트리 → well-known → `/api/v1/openapi.json` → llms.txt → `/api/v1` 인덱스 → `/partners`. **크롤 가능한 `/api/v1/index`**(페이지네이션 카탈로그) 추가. 레지스트리 `server.json` description을 마케팅 카피로(커버리지 수치·예시 쿼리·CC BY-NC).
- **🚫 하지 말 것**: `/.well-known/ai-plugin.json`(ChatGPT 플러그인 생태계 죽음, 2024.3 종료) — 부재가 정답.
- **⚠️ 수동커밋**: `public/.well-known/*`.
- **파일**: `public/.well-known/`, `app/api/v1/`.

**2.6 `/api/v1` 에이전트-우선 감사**
- **할 일**: 전 엔드포인트 동일 필드명·커서 페이지네이션(`next_cursor`+`total_count`+권장 max 200+)·기계가독 에러코드+수정힌트·**에러와 구별되는 명확한 0-결과 객체**·경량 JSON·**미리요약된 `digest` 필드**.
- **왜**: 에이전트가 스크랩 대신 API를 고르는 건 경제성(스키마 JSON이 HTML 대비 토큰 ~90%↓) — API가 스크랩보다 싸고 안정적임이 증명돼야.
- **파일**: `app/api/v1/*`.

**2.7 언드미디어/브랜드 언급 (최대 비기술 레버)** ★ 프로그램(코드 아님)
- **할 일**: 성공 지표를 **제3자 글·뉴스레터·팟캐스트·특히 YouTube에서 "Metatake"/"TakeScore" 지명 언급**(링크 유무 무관)으로. **날짜 붙은 1차 연구물**("연간 촬영지 현황" 또는 TakeScore 방법론 리포트) 발행 → 업계지 피칭. 기존 `/crm`·아웃리치를 에디토리얼 커버리지로 조준.
- **왜**: 자가발행 사이트 최대 공백. 브랜드 언급의 AI 가시성 상관 **r≈0.664 vs 백링크 r≈0.218**(YouTube r≈0.737). AI 리퍼럴이 1건인 근본 원인 = 제3자 출처에 이름 부재 → **사람 접촉 전 후보 탈락.** (Wikidata notability 허들도 이걸로 풀림.)
- **⚠️ 규율**: 아웃리치 상한·중복금지·주간 한도([[outreach-execution-status]]). **산문 편수 발표 금지**(데이터 수치는 OK) — "촬영지 현황"은 데이터 산출물이라 OK.

### ── Tier 3: 관찰 목록 (지금 베팅 금지) ──
- **NLWeb `/ask`**: 스키마/RSS→대화형+MCP. 저비용이나 채택 초기 → Tier 1~2 후 값싸게 또는 스킵.
- **에이전트 상거래(AP2·ACP·x402)**: 결제/인가층이지 발견층 아님. 요청당 과금 판매 결정 시에만 x402 먼저.
- **A2A**: 에이전트 오케스트레이션(엔터프라이즈), MCP보다 후순위. metatake가 *에이전트*를 노출할 때만.
- **콘텐츠 협상(Markdown-for-agents)**: `Accept: text/markdown`에 `.md`. 최적화이지 기반 아님(HTML 이미 깨끗) — 컨텍스트 팩 API가 대부분 수행. 저순위.

---

## §5. 🚫 만들지 말 것 (수고 절약)
- **`llms-full.txt`** — 인용봇 미조회. 컨텍스트 팩 API가 온디맨드로 더 잘 수행 중.
- **`ai-plugin.json`** — 죽은 생태계. 부재가 정답.
- **HowTo 스키마** — 구글 2023 리치결과 제거. 비평 무관.
- **C2PA/Content Credentials** — AI 생성 *미디어* 진위층, 인용 레버 아님. 텍스트에 소급 금지.
- **FAQPage/QAPage 재도입** — 2026-07-14 은퇴 결정 유지(구글 FAQ 리치결과 표시 폐기). Q&A *산문*에 투자. (`QAPage`는 진짜 단일질문 페이지에 무비용이면 소폭 유용 정도.)
- **백링크 빌딩을 AI-인용 레버로** — 약한 신호(r≈0.22). 에너지를 §2.7 브랜드 언급으로.

---

## §6. 정책·계약 충돌 주의 (반드시 준수)
1. **AI-공개 정책**([[ai-disclosure-placement-policy]]): "AI-drafted" 바이라인 라벨은 *읽기표면*에만 금지. **저자-신원 스키마(0.4)·llms.txt의 공개 문구(1.5)는 유지/권장** — 다른 층.
2. **"Not AI-written" 문장층(Embedding Fantasia)**([[sentence-engine-poc]]): 정반대 계약(인간저작 주장). §1.3 통계/인용 주입은 *읽기표면*에만, 문장층 불건드림.
3. **브랜드 명명 규율**: "News" 금지·**산문 편수 발표 금지**(데이터 수치 OK)·Locations(≠Atlas). `/partners`·리포트는 데이터 수치로만.
4. **편집자 신원**([[editor-identity-decision-pending]]): "제원우 / Wonwoo Yoon", "lead author", 경희대 박사(2022), **교수 직함 금지.** Wikidata·Person 스키마가 정확히 준수.
5. **CC BY-NC ↔ 상업 제휴**: 공개 라이선스는 *비상업.* 상업 제품용 파트너는 *별도 상업 허가* 필요 → `/partners`는 CC BY-NC=무료/개방 티어, "상업 조건 문의"=유료 경로로 제시. `license` 필드가 상업 무료를 암시 금지.
6. **워처/배포 위생**: `middleware.ts`·`public/.well-known/*`·사이트맵 = 수동 커밋([[autodeploy-watcher-scope]]).

---

## §7. 측정 계획 (숫자가 바뀌는 걸 직접 보는 법)
프로젝트 `jvgarcqrtsmgfimdcwgo`. 작업 전/후 비교용 4개 지표:

| 지표 | before(2026-07-15) | 추적 쿼리/방법 | 목표 방향 |
|---|---|---|---|
| MCP 실툴 호출/일 | ≈7 (자가 테스트) | `SELECT count(*) FROM mcp_calls WHERE tool NOT LIKE '\_%' AND ts>=now()-interval '7 days'` | 디렉터리 등록 후 외부 유입 |
| REST API 호출/일 | 0 | `SELECT count(*) FROM api_calls WHERE ts>=now()-interval '7 days'` | /partners·llms.txt 링크 후 첫 유입 |
| Dataset Search 노출 | 0 | GSC(Dataset 리치 결과) | Dataset 스키마 후 노출 발생 |
| AI 검색봇 크롤 깊이 | OAI 73·Pplx 28·Claude 3 | `crawler_daily`/`mt_crawler_visits` | 구조화 개선 후 빈도·페이지수↑ |

- ⚠️ **`crawler_daily`는 현재 2026-07-15 하루치(526행)만 존재.** 크론이 매일 append하는지 확인 필요(안 하면 추이 관찰 불가). 오너/실행 AI가 점검.
- AI 봇 분류 UA 패턴(참고): `gpt|openai|anthropic|claude|perplexity|googlebot|google-extended|applebot|bing|bytespider|ccbot|gemini`.

---

## §8. 우선순위 스택 (딱 6개만 한다면, 이 순서로)
1. **Wikidata + 풍부한 `sameAs`** (0.4) — 지명 인용의 신원 토대
2. **읽기 페이지 BLUF 리드 + TakeScore 문장형 통계** (1.1+1.3) — 실험 검증 최강 레버, 데이터 재활용
3. **`/partners` 기계가독 제안 페이지** (2.1) — B2B용 "채용공고"
4. **MCP `search`+`fetch` + 커넥터 디렉터리 등록** (2.3) — 딥리서치 관문 통과(현재 탈락 중)
5. **Dataset 스키마 수리**(distribution+license+DOI) (2.2) — Dataset Search·벤더 에이전트 가시화
6. **언드미디어/브랜드 언급 아웃리치**(`/crm`) (2.7) — 최대 공백·2026 최강 인용 예측변수(프로그램)

나머지(well-known 카드, llms.txt 보강, 페이로드 출처표기 통일, API 감사)는 위 6개 주변에 끼우는 값싼 연결 조직. NLWeb·에이전트상거래·A2A는 구체적 필요(과금 판매·에이전트 노출) 생길 때까지 관찰.

---

## 부록 A. 관련 파일·라우트·테이블
- **robots**: `app/robots.ts` (인용봇 허용/학습봇 차단 구조 이미 정확)
- **llms.txt**: `app/llms.txt/route.ts`
- **Organization/저자 스키마**: `app/layout.tsx`(`#org`), `lib/seo.ts:194`(`SOCIAL_PROFILES`)
- **MCP**: `app/api/mcp/route.ts`(툴 ~87–146, RO 힌트 83, INSTRUCTIONS 68, 디스패치 ~340)
- **REST API**: `app/api/v1/{films,locations,takescore}`, `app/api/v1/openapi.json`, `app/api/v1/embed.js`
- **Dataset 스키마**: `app/locations/page.tsx:24`(distribution/license 결여), `app/lineage/page.tsx`
- **/data 배포 허브**: `app/data/page.tsx`(Dataset JSON-LD 없음)
- **/partners**: 미존재 → 신설
- **팩 렌더러(공유 소스)**: `lib/pack.ts`
- **Zenodo DOI**: `10.5281/zenodo.21336967`
- **DB(kyniq=`jvgarcqrtsmgfimdcwgo`)**: `api_calls`·`mcp_calls`·`mt_events`·`mt_crawler_visits`·`crawler_daily`·`usage_daily`·`bot_blocks`·`mt_crawler_handshakes`

## 부록 B. 리서치 근거(요약)
- Princeton/IIT-Delhi GEO (Aggarwal et al., KDD 2024, arXiv 2311.09735): 통계+인용문+출처 인용 = +30~41% 인용 점유. 키워드 스터핑은 기준선 이하.
- 학습봇↔인용봇 분리: OpenAI(GPTBot/OAI-SearchBot/ChatGPT-User), Anthropic(ClaudeBot/Claude-SearchBot/Claude-User), Google(Google-Extended≠Googlebot).
- 스키마 인용 효과: Ahrefs 1,885페이지 ~노이즈. → 신원용으로만.
- llms.txt: ~97% 미조회, 구글 미지원 → 에이전트/코딩툴 온보딩용.
- 브랜드 언급 상관 r≈0.664 vs 백링크 r≈0.218 (YouTube r≈0.737).
- 크롤:유입 1,700:1(OpenAI)~38,000:1(Anthropic) → 트래픽은 틀린 점수판.
- ChatGPT Deep Research: `search`+`fetch` 툴 필수.
- Google Jobs: `JobPosting` JSON-LD 온페이지 수집(Indexing API 2025 파트너 외 폐쇄) → 온페이지 타입드 객체가 내구 채널.
