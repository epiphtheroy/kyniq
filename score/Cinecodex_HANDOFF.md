# Cinecodex — 인수인계 마스터 문서 (HANDOFF)

> 이 문서 하나로 다른 AI/엔지니어가 목적·목표·현황·다음 작업을 이해하고 이어받을 수 있도록 작성됨.
> 작성 기준일: 2026-06-29. 모든 경로는 `/Users/jerryje/Documents/MetaTake/score/` 기준.

---

## 1. 목적과 목표 (왜 이걸 하는가)
**문제:** 많은 사람이 좋은 영화를 보고 싶지만 *실패(시간 낭비)가 두려워* 열어보지 못한다.
**해결:** 시네필이 한 영화에서 얻는 **획득가치(V)** 와 그 시도의 **위험도(R)**, 그리고 그것을 해금하는 **진입비용(C)** 을, 투명하고 재현 가능한 방식으로 산정해 제공한다. 인기(IMDb/RT/Metascore)가 아니라 *지속적 예술·관조적 수확*을 잰다.
**핵심 미션:** 대부분 시네필 영화로 구성된 카탈로그(6,000편) 안에서 **위험도·실망도 높은 영화를 걸러내기.**
**비섞임 원칙:** 우리 점수는 독자 계산. 외부지표는 *나란히* 보여주되 절대 공식에 넣지 않는다. 정전가는 *검증 기준*이지 입력이 아니다(순환성 회피).

---

## 2. 개념 모델 (점수 정의 — 한눈에)
13개 하위점수(0–100)에서 3축을 고정 공식으로 계산한다.
- **V 획득가치** = mean(COG 인지, AFF 정서, FORM 형식, MORAL 도덕, DUR 지속). 높을수록 좋음.
- **C 진입비용** = mean(ITX 영화사, FR 형식급진, ETX 외부지식, CTX 감독오에브르). *비용이지 가치 아님.*
- **R 위험도** = 0.6·mean(BANK 지적파산, INSINCERE 미적불성실, COWARD 예술적비겁) + 0.4·POLAR 분열성. 높을수록 위험.
- **U 순가치** = V − λ·R (λ=위험회피 다이얼, 기본 1.0). **정렬 기준.**
- **S 샤프** = (V−50)/max(R,1). 위험 대비 효율.
철칙 3개: ① 난이도는 비용이지 가치 아님. ② 분열적 ≠ 파산적(옹호 진영 강하면 POLAR↑이지 BANK/INSINCERE/COWARD 아님). ③ 야망 ≠ 성취(과시적 스펙터클은 FORM 상한 ~55).

---

## 3. 지금까지 한 일 (현황)
1. **방법론 설계** — `Cinecodex_지수_설계와_검증.md` (3축 의사결정 모델, μ–σ 평면, 타당도/공표 전략).
2. **외부지표·신뢰도 결론** — `Cinecodex_Conclusions_Display_and_Reliability.md` (나란히 표시·비섞임, AI 재현성 프로토콜, 연구 인용).
3. **50편 앵커셋 + 채점 검증** — 프롬프트 v1.0→v1.1 루프, Opus/Sonnet 3런 ICC≈0.99. (`Cinecodex_AnchorSet_50_EvalKey.md`, `Cinecodex_Run_Results_v1.1.md`, `cinecodex_scores_v1.1.csv`)
4. **모델 패널 실험** — Opus·Sonnet·Haiku × 3런. 결론: **Sonnet 주력, Opus 감사, Haiku 배제.** Opus+Sonnet 패널 α=0.958. (`Cinecodex_Panel_Experiment_RESULTS.md`, `cinecodex_panel_harness.py`)
5. **앵커 뱅크 v2(검증완료)** — 13차원×5밴드 ~520 앵커, 적대적 검증+재조정. (`Cinecodex_Anchor_Bank_v2.md`, 과정문서 `Cinecodex_Anchor_Design_Process.md`, 감사추적 `cinecodex_anchor_research/`)
6. **6,000편 실행 설계(현재 단계)** — 비용모델·DB·프로덕션 프롬프트·전략. (`Cinecodex_Execution_Strategy.md`, `PROMPT_PRODUCTION_v2.txt`, `cinecodex_schema.sql`)

---

## 4. 실행에 필요한 자산 (파일 지도)
| 파일 | 용도 | 프롬프트에 넣나? |
|---|---|---|
| `PROMPT_PRODUCTION_v2.txt` | 프로덕션 채점 시스템 프롬프트(린, 8앵커). 동결+해시. | **예(정적, 캐시)** |
| `Cinecodex_RUNBOOK.md` | **실행 구현 디테일**(코퍼스·배치 와이어·집계·플래그 임계·드리프트·재개) | — |
| `cinecodex_schema.sql` | Supabase/Postgres 스키마 | — |
| `Cinecodex_Execution_Strategy.md` | 실행 전략·파이프라인·비용표·1주차 검증 | — |
| `Cinecodex_Anchor_Bank_v2.md` | 520 앵커 = 오프라인 캘리브레이션 + 공개 방어 | **아니오** |
| `cinecodex_panel_harness.py` | 교차-벤더 검증(샌드박스 밖 실행) | — |
| `cinecodex_run3/PROMPT_v1.1.txt` | 50편 평가용(연구/회귀 테스트) | — |

---

## 5. 실행 방법 (구체 단계)
상세는 `Cinecodex_Execution_Strategy.md` §3. 요약:
1. `films` 적재(6,000편 + 외부지표 별도 컬럼).
2. `prompt_versions`에 `cinecodex-prod-v2` 텍스트+SHA 동결.
3. 무작위 순서로 B=8 배치 생성.
4. **Pass1** Sonnet N=1, 프롬프트 캐싱+Batch API → `scoring_runs`(raw 13점수 + model_id/temp/sample/prompt_version 로깅).
5. 집계 잡: median → `film_scores`(V/C/R/U/S + 신뢰도 메타). 플래그(임계근처/파싱실패/고SD) → `review_queue`.
6. **Pass2** Sonnet N=3 플래그분 재채점. **Pass3** Opus N=3 감사 5%+고위험.
7. 매 묶음마다 **앵커 드리프트 게이트**(컨트롤셋 재채점, ±12 벗어나면 정지).
8. (선택) 교차-벤더 300편 샘플 → 벤더 간 α.
9. 공개: 점수+외부지표 대시보드(나란히)+정전가 상관 1개.

설정값: temperature 0.6 · **전수 N=1 → 플래그분만 N=3** · B=8 · λ 0.5–1.0(사용자 조정). 코퍼스 소스·배치 와이어포맷·집계 median 단위·플래그 임계 수치·드리프트 정지규칙·재개 쿼리 등 **구현 디테일은 전부 `Cinecodex_RUNBOOK.md`** 에 있다(이것 없이는 실행 불가).

---

## 6. 비용 (실측 기반)
6,000편 전수 ≈ **$6–19**, 권장 티어드 ≈ **$11**. 비용은 제약이 아님 → 일관성·검증에 투자. (표: 전략문서 부록 A.) 절감 레버: 프롬프트 캐싱(입력 90%↓), Batch(50%↓), Sonnet 주력, 티어드 N, note 생략.

---

## 7. 앵커가 사고를 방해/비용 문제? → 해결됨
520편을 프롬프트에 넣지 않는다. **8편만** 자(尺)로 프롬프트에. 520편은 (a) 공개 방어 문서, (b) 오프라인 드리프트 테스트셋으로 분리. 비용은 캐싱으로 무력화, 사고 방해는 8편 제한으로 해결.

---

## 8. 다음에 할 일 (이어받는 사람용 우선순위)
1. **1주차 실측 3종**(전략문서 부록 C): 배치크기 B 오염 검증, N 라우팅 임계, 플래그 임계.
2. 프로덕션 프롬프트 SHA 동결 + `prompt_versions` 등록.
3. 6,000편 `films` 적재(TMDB로 메타데이터, 외부지표 별도).
4. 앵커 컨트롤셋(약 60편) 선정 — `Cinecodex_Anchor_Bank_v2.md`의 합의 강한 앵커에서.
5. Pass1 파일럿 300편 → 파서·집계·플래그 동작 확인 → 전수 확장.
6. 교차-벤더 검증(`cinecodex_panel_harness.py`, 샌드박스 밖)으로 단일 회사 특이성 아님 입증.
7. 인간 감사 표본으로 인간–AI 상관(α≥0.80 목표) 측정.

---

## 9. 정직한 한계 (공개 시 함께)
- 앵커·점수는 *출처에 근거한 LLM 판단*이지 아직 *인간 합의 패널* 산물 아님. 순환성 완전 차단엔 인간 합의 앵커 승격 필요.
- 상용 API는 비트 결정론 불가(temp 0도 비결정). 그래서 "측정·공개된 신뢰도"로 방어(재현성 카드).
- POLAR 데이터는 표본·시점 민감 → 정기 갱신.
- 교차-회사 검증은 이 작업 샌드박스에서 불가(egress 차단)였음 → 사용자 환경에서 하니스로.
- 커버리지·편향 감사 지속 확장 필요(비서구·다큐·애니).

---

## 10. 용어/공식 빠른참조
V=(COG+AFF+FORM+MORAL+DUR)/5 · C=(ITX+FR+ETX+CTX)/4 · R=0.6·(BANK+INSINCERE+COWARD)/3+0.4·POLAR · U=V−λR · S=(V−50)/max(R,1).
모델: Sonnet 주력 / Opus 감사 / Haiku 금지. 전수 N=1 → 플래그 N=3. B=8. temp 0.6. 캐싱+Batch 필수. 외부지표·정전가 = 표시·검증만, 입력 아님. 집계 median은 **하위점수별**로 낸 뒤 V/C/R 계산.
