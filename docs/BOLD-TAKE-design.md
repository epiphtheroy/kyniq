# Bold Take — Design & State (저장본)
_작성: 2026-06-22 · 메타테이크 해석 수준 상향 + 재구조 설계_

## 1. 핵심 결정 (검증됨)
메타테이크는 *해석(비평적 주장)* 이어야 한다 — 트로프처럼 "공통점 묶음"이 아니라, **감독 의도와 독립적인(death-of-author) 대담한 도약**. 진단: 현재 935개 reading 허브는 평균 4.57개 레지스터가 섞인 *주제 군집*(=트로프 닮음). 해법으로 명명을 해석-중심으로 올렸고(검증됨), 더 근본적으로 **bold take 생성 레이어**가 필요하다고 합의.

파일럿 3편으로 *수준 검증 완료(사용자 승인)*:
- `bold-take-pilot.md` (3편 6개, essential-only)
- `bold-take-pilot-v2-blackswan.md` (11프레임워크 × 1–3)
- `bold-take-pilot-clairesknee.md` (로메르 — 의도에 맞서는 독해)
- `bold-take-pilot-drivemycar.md` (하마구치 — "아주 마음에 듦")

## 2. 분류체계 — 11개 비평 프레임워크
출처: `/Users/jerryje/Documents/3set/추가 검토/*.docx` (11개)
LOCATION(디제시스×촬영현실) · SIGNIFIER→SIGNIFIED(기표×기의, 알레고리) · CONTEXT(텍스트×맥락) · PROCESS(산물×제작과정) · PHENOMENON→NOUMENON(불가해×본체) · NOUMENON(물자체) · ENIGMA(표면수수께끼×핵심진실, ripple) · PSYCHOANALYTIC(증상×정신분석) · ETHICAL-PHILOSOPHICAL(행동×윤리) · ETHICO-POLITICAL(행동×권력/이데올로기) · META-CRITICISM(비평담론×맥락).

**공통 방법:** 비평가 역할 → 후보 3쌍 생성 → (본질성 + 의외성이되 방어가능 + 통합/파급력)으로 평가 → **가장 강력한 하나 선택** → 기각된 2개는 도입부에 언급 → **의도와 독립**.

## 3. v2 생성 구조 (사용자 확정 방향)
영화마다 **11개 요소 전부**에서 *요소별 1–3개* 추출. 강한 렌즈는 2–3, 약하면 1. 각 take는 실제 **피겨에 정박**. "과감하되 증거(피겨)에서 방어 가능."
- 미결: 약한 렌즈의 하한 — (A) 엄격히 항상 1개 vs (B, 권장) **0–3 + 강도 점수**(약하면 생략/숨김).

## 4. 재구조 (3층 재정의)
- **트로프 = 반복되는 형태**(렌즈 무관). ← 현재 트로프 + 현재 메타테이크 중 *순수 주제/형태형* 흡수.
- **테이크 = 대담한 읽기**(피겨별, 11프레임워크, 의도 독립). ← take 레이어 *제자리 업그레이드*(추가 아님 → 겹침 없음).
- **메타테이크 = 반복되는 대담한 읽기**(bold take들의 군집). ← 진짜 해석 층.
- 11프레임워크 = 새 분류체계(기존 10 register 대체).
- 폭증/중복: `mt-recluster.py` 엔진 재사용으로 통제(이미 검증).

## 5. 현재 상태
- `worker/mt-recluster.py` — 병합(LLM 군집화)+분할(>70 k-means)+재명명, 해석-중심 명명. DRY 검증 양호(병합 201). **보류(persist 안 함)** — bold-take 재군집이 이를 덮어쓰므로 이중작업 방지.
- `worker/run-recluster-dry.command`, `run-recluster.command` 존재.
- DB 보조물: RPC `reading_hub_dup_pairs`, `reading_hub_take_counts`, `reading_hub_registers` (+ 기존 `bulk_set_embeddings`). `service_role.statement_timeout=300s`.

## 6. 다음 단계 (TODO)
1. **요소별 하한 결정**(0–3+점수 vs 엄격1).
2. **프로덕션 워커**(영화×11프레임워크, 후보→선택, 피겨 정박, 본질만) 설계·작성 → **5–10편 실제 DRY**로 비용·품질 측정.
3. 좋으면 전량 생성 → bold take로 take 레이어 교체 → `mt-recluster`로 메타테이크 재군집 → 현 메타테이크의 주제형은 트로프로 → 재랭크/추천/SEO/배포.
4. (보류 중인) 단순 recluster는 위 3에 흡수되므로 단독 실행 불필요.
