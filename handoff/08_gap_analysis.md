# 갭 분석 & 점수 개선 — awards/lists 종합 자료 기준 · v1

> 출처: `sources/awards_lists_compendium.md` (6개 파일 복합). 현 레지스트리(133개)와 대조.

---

## 1. 빠진 것 (등록 필요) — facet별

### A. 시상식(award) — MISSING
- `golden-globe-best-picture`(드라마/뮤지컬·코미디 분리), `critics-choice-best-picture`(BFCA), **유럽영화상 EFA**(`efa-best-film`), **아시안 필름 어워즈 AFA**(`afa-best-film`).
- 독립·장르: `independent-spirit-best-feature`, `gotham-best-feature`, `saturn-best-film`(장르).
- (세자르·고야·다비드는 national에 이미 있음.)

### B. 비평가 협회(award, 신규 묶음) — MISSING 전부
- `nyfcc-best-film`, `lafca-best-picture`, `nsfc-best-picture`, `nbr-best-film` + **`nbr-top-ten`(canon성 연간 리스트)**.
- 결과 표기 핵심: 이들은 **Winner + Runner-up** 발표 → `result=runner-up`(후보 등가). NBR Top10 = `result=listed`.
- 신인 신호: **NYFCC Best First Film**, LAFCA **Douglas Edwards 실험영화상** → debut/실험 플래그.
- 북미 3대 석권 = '그랜드 슬램'(consensus 신호).

### C. 길드(award, 예측지표) — MISSING
- `dga-best-director`, `sag-best-cast`, `wga-best-screenplay`, `pga-best-picture`. (오스카 예측력↑, 가중치는 중간.)

### D. 정전 매체/주제 리스트(canon) — MISSING
- `bbc-21st-century`(2016), `bbc-foreign-language`, `bbc-women-directors`, `guardian-21st-century`, `nyt-21st-century`, `time-all-time-100`(2005), **`cahiers-100-plus-beaux`**(2008, 기존 cahiers 연간과 별개), `wga-101-screenplays`(각본 정전).

### E. 국가 정전(national, 역대) — MISSING 다수
- `national-jp-kinema-junpo-alltime`(※ 기존 kinema-junpo는 *연간 award*, 이건 *역대 canon* — 별 slug), `national-tw-golden-horse-100`(※ golden-horse award와 별개), `national-it-100-da-salvare`, `national-de-wichtigste`, `national-es-caiman-100`, `national-se-flm`, `national-pl-najlepsze`, `national-dk-best`, `national-mx-somos-100`, `national-br-abraccine-100`, `national-ar-encuesta`, `national-ca-tiff-top-ten`, `national-au-best`. (KOFA 100·BFI 100은 보유.)

### F. 국가 정전(national, 2000년 이후) — MISSING
- `national-kr-cine21-21c`, `national-jp-kinema-junpo-2000s`, `national-es-caiman-21c-50`, `national-ro-rfca-decade`, `national-us-indiewire-decade`, `national-ar-21c` 등.

→ 대략 **40~55개 신규 리스트**. 대부분 canon·national. 정전 완전성(§계약 §5) 확대의 핵심.

---

## 2. 충돌 정리 (reconcile)
- **키네마 준보**: 연간 시상(award) vs 역대 베스트(canon) — *서로 다른 두 항목*. slug 분리(`national-jp-kinema-junpo-best-film`(기존) / `national-jp-kinema-junpo-alltime`).
- **금마장**: 작품상(award) vs `100 Greatest Chinese-Language Films`(canon) — 분리.
- **Cahiers**: 연간 Top10(기존 `cahiers-annual-top-ten`) vs `100 plus beaux`(2008 단발) — 분리.
- **AFI / BFI 100 / KOFA 100**: 이미 보유 → 중복 금지, QID만 보강.
- 중화권 100대는 **국가 경계를 넘음**(대만+홍콩+중국) → `country` 단일값 애매 → `external_ref.region="chinese-language"`로 표기, country 비움.

---

## 3. 점수 모델 개선점 (07에 반영) — 이 자료의 최대 수확

1. **`result` 계수 확장.** 비평가협회의 *후보 등가물*을 반영:
   | result | f_result |
   |---|---|
   | won | 1.0 |
   | **runner-up** (비평가 차점) | **0.60** |
   | nominated | 0.45 |
   | **listed** (NBR Top10·매체 Best-of) | **0.45** |
   | selected (영화제 섹션) | 0.30 |
2. **consensus(그랜드 슬램) 시너지.** NYFCC+LAFCA+NSFC 동시 Best Film 등 다수 협회 합의 → depth 합산이 이미 보상. (과설계 금지, 선택적 소폭 보너스.)
3. **debut 신호.** NYFCC Best First Film·Caméra d'Or·신인 부문 → `value.debut=true` → 신진 발굴(Discovery/auteur)에 가산.
4. **편향 보정 *검증*.** 이 자료 스스로 "북미 편중 → 유럽(S&S·Cahiers)·국가 정전으로 균형" 처방. = 우리 **DiscoveryScore·selectivity 설계가 옳음**을 외부 확인. 국가 정전 대량 추가가 곧 균형추.
5. **craft 정전.** WGA 101(각본)·기술부문상 → 별도 `subtype=craft`, 총점엔 소폭(연출·작품 위주 유지).
6. **주제 리스트 주의.** BBC women-directors/foreign-language 등은 *다양성 큐레이션* → 총점 prestige를 왜곡하지 않게 일반 canon과 동일 취급하되 `external_ref.scope` 표기(필터/기능용).

---

## 4. 균형 활용 권고
- 무게중심: 신규의 다수가 **유럽·아시아·남미 국가 정전** → 자동으로 미국 편중을 상쇄. 좋음.
- 가중치: 비평가협회·길드는 *연간·예측성* 신호라 T2~T3, 매체 21세기 리스트는 T2, 국가 정전은 T2~T3, 주제/각본 리스트는 T3.
- 우선순위: (1) result 계수 확장(즉시), (2) 비평가 빅3+NBR·EFA·AFA·매체 정전(고가치), (3) 국가 정전 대량(완전성), (4) 길드·장르·주제(보강).
