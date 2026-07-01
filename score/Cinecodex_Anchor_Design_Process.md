# Cinecodex 앵커 설계 — 과정·고민·출처 문서 (공개용)

> 13개 하위차원의 점수 밴드별 "앵커 영화"를 어떻게 설계·검증·재조정했는지에 대한 완전한 기록.
> 목적: ① 공개 방어(왜 이 점수냐에 실제 영화+근거로 즉답), ② AI 채점 일관성(few-shot 고정앵커가 분산을 줄임).
> 산출물: `Cinecodex_Anchor_Bank_v2.md`(검증 완료본, 13차원×5밴드, ~520개 앵커). 감사 추적: `cinecodex_anchor_research/`의 A1–A6(원자료)·VB1–VB3(검증)·BANK_v2_*(재조정).

---

## 1. 왜 앵커인가
앵커는 "이 점수의 기준이 되는 실제 영화"다. 두 역할을 동시에 한다.
- **방패(defense):** 점수가 자의적이지 않다는 증거 — 각 밴드에 합의 가능한 예시 영화가 박혀 있으면 외부 비판에 즉답할 수 있다(BARS, behaviorally anchored rating scale).
- **일관성 장치:** 프롬프트에 고정 앵커를 넣으면 LLM 채점 분산이 줄어든다(few-shot anchoring — Lu 2022, Sclar 2023). 즉 앵커가 촘촘할수록 AI 점수가 안정된다.

핵심 미션: 우리 카탈로그는 대부분 시네필 영화다. 그 안에서 **위험도 높은 영화(분열적)·실망도 높은 영화(공허·불성실·비겁)를 걸러내는 것**이 본질. 그래서 위험군(POLAR·BANK·INSINCERE·COWARD)에 화력과 검증을 더 배치했다.

---

## 2. 계층형 에이전트 아키텍처
관제탑(나) 아래 4개 층을 운영했다. 위험군에는 Opus, 나머지에는 Sonnet을 배정.

```
관제탑(통제·QC·루프)
  ├─ 1차 리서치 6기 (병렬)
  │    A1 COG·AFF(Sonnet) · A2 FORM·MORAL·DUR(Sonnet) · A3 ITX·FR·ETX·CTX(Sonnet)
  │    A4 POLAR(Opus, 데이터 집중) · A5 BANK·INSINCERE(Opus) · A6 COWARD+함정(Sonnet)
  ├─ 2차 적대적 검증 3기 (병렬, 전원 Opus)
  │    VB1 가치·비용 · VB2 POLAR 데이터 · VB3 파산·비겁(분열≠파산 집중)
  ├─ 3차 재조정 편집 2기 (Opus)
  │    BANK_v2_value_cost · BANK_v2_risk  (검증 지적 전부 반영)
  └─ 관제탑 QC + 루프 (배치·출처·중복 확인 → 미흡분 재작업)
```
각 에이전트는 WebSearch·web_fetch로 평론·커뮤니티·평점분산을 실제 조사하고 출처 URL과 함께 작성했다.

---

## 3. 핵심 고민과 처리 (이 부분이 방어의 본체)

### 고민 ①  "분열적"과 "파산"은 다르다 (THE BIG ONE)
가장 위험한 오류: *옹호 진영이 분명한 분열작*을 "지적 파산/미적 불성실/예술적 비겁"으로 낙인찍는 것. 1차 리서치는 The Counselor·Cloud Atlas·Only God Forgives·Neon Demon·Babylon·Vox Lux·Knight of Cups를 BANK/INSINCERE/COWARD 고밴드에 넣었다.
- **검증(VB3)이 적발:** 이들 모두 강한 비평 옹호 진영 존재(Ebert 4/4 Cloud Atlas, Bradshaw 5/5 Only God Forgives, Brody "instant classic" Knight of Cups 등). → 이건 *파산이 아니라 분열(POLAR)*이다.
- **처리:** 7편을 위험-실패 밴드에서 **삭제하고 POLAR로 이송**, 각 이송을 changelog에 명시. Donnie Darko(RT 88%)는 위험 앵커 부적격으로 완전 제거. 원칙 확립: **"강한 옹호 진영이 있으면 그 영화는 분열적이지 파산이 아니다."**

### 고민 ②  난이도는 비용이지 가치가 아니다
어려운 영화를 무의식적으로 고평가하는 함정. → 비용축(ITX·FR·ETX·CTX)을 가치축과 분리하고, 노트에 "공허하고 어려운 영화는 고비용+저가치"임을 명시(예: Histoire(s) du cinéma ETX=100이라고 Bicycle Thieves ETX=0보다 우월한 게 아니다).

### 고민 ③  COG가 '가독성'을 처벌하고 있었다
1차안은 Parasite·Arrival의 인지가치(COG)를 25로 낮게 줬다 — 접근성이 높다는 이유로. 이건 비용축(이해 난이도)을 가치축에 끌어들인 오염. **처리:** COG 25→50으로 상향, COG 25 밴드를 "한 가지 아이디어를 명료하게 전달하는" 안정적 예시(The Truman Show 등)로 재구성.

### 고민 ④  앵커는 합의적이어야 한다
분열작을 *가치 앵커*로 쓰면 자가 흔들린다. **처리:** Tree of Life·Dancer in the Dark·Funny Games·Son of Saul·Joker를 가치 앵커 슬롯에서 제거하고 합의작으로 교체(Tree of Life→Mirror at COG100; Dancer→Tokyo Story at AFF100; Son of Saul→Timbuktu at MORAL75). 분열작은 POLAR축에서 다룬다.

### 고민 ⑤  "분열"과 "니치(표본 부족)"는 다르다
POLAR은 *많은 관객이 실제로 갈리는 것*이지 *소수만 본 것*이 아니다. **처리:** Letterboxd 표준편차는 **1만+ 평점 표본** 리스트만 사용(소표본 Plan 9·Pink Flamingos는 강등/플래그), RT 비평-관객 격차·Cannes 야유/기립 동시 보고 등 *대규모 engaged 표본*에 근거. 역방향 격차(Climax 비평68/관객91)도 포함.

### 고민 ⑥  출처 무결성
검증에서 적발·처리한 출처 문제:
- **콘텐츠팜/모순 출처 폐기:** neurolaunch(자폐 스크리닝 SEO팜), Collider(인용처가 오히려 FORM 캡을 *반박*), Psychology Today(Tree of Life를 혹평한 글) → 전부 교체/삭제, 깨진 URL 수정.
- **오인용 URL 3건 적발:** Empire/Jupiter Ascending 페이지를 "300" 인용에, Wikipedia/The Lighthouse를 There Will Be Blood 주장에, Ebert/Transformers를 Southland Tales 칸 반응에 잘못 연결 → 올바른 출처로 교체(예: Southland Tales는 Hollywood Reporter "칸 재앙" 기사로).
- **한 명의 혹평 vs 합의:** Vanilla Sky 등 단일 평론에 의존한 앵커 제거. 고밴드 앵커는 *광범위한 비평적 합의*를 요구.

### 고민 ⑦  '함정(traps)' 도시에의 오염
Tár(MC 93, 오스카 6노미)가 "시네필 함정"에 잘못 들어가 있었다 → 제거(걸작 합의는 함정이 아니다). The Great Beauty(외국어영화 오스카)도 COWARD에서 제거. 함정은 *프레스티지 신호 + 실제 실망 위험*을 모두 가진 영화만, 위험 유형 라벨(empty-style/allegory-overload/auteur-self-indulgence/bitterly-divisive)과 함께.

### 고민 ⑧  서구·남성 편향
1차안에 사하라이남 아프리카 0편, Varda·Martel 부재. **처리:** Touki Bouki(Mambéty)·Black Girl(Sembène)·Timbuktu(Sissako)·Meghe Dhaka Tara(Ghatak)·Zama(Martel)·Cléo from 5 to 7(Varda)를 적정 밴드에 출처와 함께 추가.

### 고민 ⑨  순환성(circularity) 경계
정전 "위대한 영화" 목록을 *정답*으로 쓰면 그 편향을 그대로 수입한다. → 앵커는 목록 복사가 아니라 *개별 작품의 구체적 근거*로 배치하도록 지시.

---

## 4. 참고한 자료 (카테고리별)
- **평점 분산 데이터:** Rotten Tomatoes 비평 vs 관객 점수, Metacritic 비평 Metascore vs User Score, Letterboxd 평점 분포/표준편차, statsignificant.com 분열성 분석.
- **축제 반응:** Cannes 야유/기립·관객 퇴장 보도(Variety "Cannes walkouts", Hollywood Reporter 등).
- **평론·에세이:** Roger Ebert(.com), The Guardian(Bradshaw), BFI/Sight & Sound, Senses of Cinema, Criterion, Variety, IndieWire, The New Yorker(Brody), A.V. Club, Telegraph 등.
- **학술/심층:** CINEJ Cinema Journal, Film Quarterly, Tate/Frieze(미술·형식), Bordwell "art cinema" 계열.
- 각 비자명/고위험 배치에는 실제 페치한 URL을 첨부. 관제탑이 대표 출처(예: Ebert "Only God Forgives")를 재확인해 실재·내용 일치 검증.

검증 규모: 3개 Opus 검증관이 **22+개 출처 URL을 재페치**하고 14개 POLAR 수치를 재확인. 데이터 무결성은 통과(허위 수치 없음), 일부 stale 수치(Beau Is Afraid 비평 67%, The Brutalist 96–97%) 정정.

---

## 5. 검증 결론 (VB 판정)
- **가치축(COG·AFF·FORM·MORAL·DUR):** REVISE → 모두 반영 완료(축오염·합의취약·출처·편향).
- **비용축(ITX·FR·ETX·CTX):** ACCEPT(경미한 출처 보강만).
- **POLAR:** REVISE(경미) → 수치 정정 + 강앵커 추가(Hereditary 91/56·D+, Irréversible, Killing of a Sacred Deer) + 니치 강등.
- **BANK·INSINCERE·COWARD:** REVISE → 분열≠파산 이송 7편 + 출처 정정 + 단일혹평 앵커 제거 + 함정 정리.

---

## 6. 정직한 한계 (공개 시 함께 밝힐 것)
- 앵커는 *출처에 근거한 LLM 판단*이지, 아직 *인간 합의 패널*의 산물은 아니다. 다음 단계: 시네필 다수가 앵커 영화를 독립 채점→중앙값으로 승격(순환성 제거).
- POLAR 데이터는 표본·시점에 민감 — 정기 재확인 필요(평점은 변한다).
- 일부 함정 라벨·경계 사례는 여전히 논쟁적(분열작을 함정에 넣을지 등). 이는 *판단 공개*로 방어.
- 커버리지는 더 넓혀야 함(다큐·애니·비서구 추가, 밴드당 3→5편).
- 본 과정 자체가 단일 회사(Claude) 모델군 내 작업 — 교차-회사 검증은 별도 하니스로(앞선 패널 실험 참조).

---

## 7. 감사 추적 파일
- 원자료: `cinecodex_anchor_research/A1_value_cog_aff.md`, `A2_value_form_moral_dur.md`, `A3_cost_itx_fr_etx_ctx.md`, `A4_risk_polar.md`, `A5_risk_bank_insincere.md`, `A6_risk_coward_traps.md`
- 검증: `VB1_verify_value_cost.md`, `VB2_verify_polar.md`, `VB3_verify_risk.md`
- 재조정: `BANK_v2_value_cost.md`, `BANK_v2_risk.md`
- 최종 통합본: `Cinecodex_Anchor_Bank_v2.md`
