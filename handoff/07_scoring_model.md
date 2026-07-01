# 영화 총점(Total Score) 채점 모델 · v1

> 최종 목표: 영화 1편의 **총점**. 지금까지 만든 모든 라인(수상·영화제·정전·감독 등급·전략 포트폴리오)이 이 점수의 *입력*이다.
> 원칙: 점수는 **설명 가능(explainable)**해야 하고, 서구·정전 편향을 보정해야 한다.

---

## 1. 세 점수를 분리한다 (가장 중요한 설계 결정)

하나의 숫자로 뭉치지 않는다. 성격이 다른 셋을 분리하고 총점은 그 조합이다.

1. **PrestigeScore (권위/품질)** — 총점의 핵심. 수상·정전·영화제 선정 + 감독 급. *"얼마나 인정받았나."*
2. **DiscoveryScore (희소/발굴)** — 프론티어·전위 라인의 희소성. *"얼마나 미개척·발굴 가치인가."* 서구 편향 보정.
3. **SimilarityVector (유사/추천)** — 사조·스타일·감독. **스칼라 점수가 아님**(추천용 벡터).

> ⚠️ 사조·스타일은 *총점에 넣지 않는다*. "슬로우 시네마라서 더 좋은 영화"는 범주 오류. 품질이 아니라 *닮음*이므로 SimilarityVector로만 쓴다.

**총점** = `PrestigeScore` (+ 선택적으로 `γ·DiscoveryScore`).

---

## 2. 신호별 기여도 (per-signal contribution)

영화가 가진 각 라인 멤버십 i 의 기여:

```
c_i = w_list × f_result × f_position        (0 ≤ c_i < 1)
```

- `w_list` = 그 라인의 `authority_weight` (0–1).
- `f_result` (수상/선정 결과):
  | 결과 | f_result | 비고 |
  |---|---|---|
  | won (수상) | 1.0 | |
  | runner-up (비평가 차점) | 0.60 | 비평가협회 Runner-up = 후보 등가(near-tie) |
  | nominated (후보/경쟁 진출) | 0.45 | |
  | listed (연간 Top-N·매체 best-of) | 0.45 | NBR Top10·BBC 21세기 등 연간/주제 리스트 포함 |
  | selected (영화제 섹션 선정) | 0.30 | |
  | (all-time 정전 등재) | 1.0 × f_position | 순위계수로 처리(아래) |
  - `value.debut=true`(신인감독상·Caméra d'Or 등) → 총점엔 미반영, **DiscoveryScore/신진 발굴에 가산**.
- `f_position` (정전만, 에디션 내 순위): `0.5 + 0.5·(1 − (rank−1)/max(rank_max−1,1))` → 1위≈1.0, 최하위≈0.5. 순위 없으면 1.0.

**감독 기여**: 감독 등급도 한 신호로 포함하되 *댐핑*(영화 자체 성취보다 약하게):
`c_director = authority_weight(group) × 0.6` (예: G1 → 0.55 floor). 거장이면 라인 약한 작품도 바닥을 받쳐줌.

---

## 3. 집계 — 정렬 감쇠 합 (depth를 보상, 포화 방지)

신호를 내림차순 정렬해 기하 감쇠로 합산:

```
raw = Σ_k  c_(k) · δ^(k−1)      (δ ≈ 0.6, c_(1) ≥ c_(2) ≥ …)
PrestigeScore(0–100) = 100 · raw / C
```

- 최강 신호가 만점 비중, 2번째 0.6, 3번째 0.36 … → **하나의 큰 상이 영화를 정의**하되, 추가 성취가 *깊이*로 더해진다(팔메 단독 < 팔메+오스카+정전).
- `C` = 정규화 상수(코퍼스 보정; 기본 ≈ 2.42 = 1/(1−δ)×0.97). 상위 영화가 100 근처가 되도록 백분위로 캘리브레이션.
- 대안: **noisy-OR** `1−Π(1−c_i)` (경계 [0,1], 자연 포화). 단 엘리트 영화들이 모두 ≈1로 압축돼 변별력↓ → 본 모델은 감쇠합을 1차안으로.

---

## 4. 전략 포트폴리오(S1–S4) 통합 = DiscoveryScore

영화는 자신이 선정된 영화제의 `strategic_tier`를 상속한다.

```
DiscoveryScore = max over (S2 전위 ∪ S3 프론티어) 멤버십 of ( w_list × f_result × selectivity_norm )
```

- `selectivity`(IDF, 희소도)가 높을수록↑ → **FESPACO·BAFICI 같은 프론티어 발굴이 보상**받음.
- `Total* = PrestigeScore + γ·DiscoveryScore` (γ≈0.15, 튜닝). 서구 정전 편향을 과하지 않게 보정.
- **S4 전문가(다큐·복원·애니)는 별도 트랙**: 다큐를 극영화와 한 스케일로 비교하지 않음. 트랙별로 PrestigeScore를 내부 정규화(track = film의 주 유형). 교차 비교는 신중히.

---

## 5. 저장 (additive, 마스터가 계산)

```sql
-- film_scores (신규, additive)
film_id uuid pk → films(id)
track text            -- feature | documentary | animation | restoration
prestige_score numeric
discovery_score numeric
total_score numeric
components jsonb       -- 어떤 라인이 얼마 기여했는지(설명가능성)
model_version text
computed_at timestamptz
```
`components`로 **점수 분해를 보존** → 공개 DB에서 "왜 이 점수인지" 투명하게 표시, 블랙박스 회피.

---

## 6. 예시 — 〈기생충〉(feature 트랙)

| 신호 | w_list | f_result | f_pos | c_i |
|---|---|---|---|---|
| 칸 황금종려상 won | 0.97 | 1.0 | — | 0.97 |
| 오스카 작품상 won | 0.96 | 1.0 | — | 0.96 |
| 오스카 감독상 won | 0.86 | 1.0 | — | 0.86 |
| 오스카 국제장편 won | 0.80 | 1.0 | — | 0.80 |
| 감독 봉준호 G1 | 0.92 | (×0.6) | — | 0.55 |
| 칸 경쟁 selected | 0.80 | 0.30 | — | 0.24 |

raw = 0.97 + 0.6·0.96 + 0.36·0.86 + 0.216·0.80 + 0.1296·0.55 + 0.0778·0.24 ≈ **2.12**
PrestigeScore ≈ 100·2.12/2.42 ≈ **88**. (프론티어 라인 없음 → DiscoveryScore 낮음.)

대조: FESPACO 장편상 수상 + 자국 정전만 가진 영화 → PrestigeScore는 중간이지만 `selectivity`가 높아 **DiscoveryScore가 커서 Total\*이 보정**됨.

---

## 7. 파라미터 & 주의 (튜닝 대상)

- 튜닝값: `δ`(0.6), `C`(정규화), `γ`(0.15), `f_result`/감독 댐핑(0.6).
- **편향 경고**: 순수 prestige는 칸·오스카 편중 → DiscoveryScore·selectivity가 균형추. 시대 보정(옛 영화는 라인 수↑) 고려.
- 총점은 *하나의 신호*일 뿐 — 반드시 `components`로 분해 노출. 살아있는 감독·동시대작은 라인이 미완이라 점수가 낮을 수 있음(시간에 따라 갱신).
- 사조/스타일은 총점 제외(§1) — 추천 유사도로만.
