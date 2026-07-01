# 50개 영화이론 저널 — 커버리지 종합 보고서

작성 2026-06-26
질문: "내가 고른 50개 저널 최근 3년 논문에서 거론된 이론/이론가를 우리 DB가 커버하는가?"
방법: 10개 병렬 에이전트(하네스)로 50저널 2023~2026 논문에서 **키워드·이론가·개념목적·논문(제목/저자/저널/권호/연도/링크)·논문의 주장·접근여부**를 구조화 추출 → 우리 DB(개념-DB 로스터 2,037 + DB `theorists` 1,840 + canonical 개념 7,403 + theory_canon + sm_concepts)와 대조.

---

## 1. 추출 규모

| 항목 | 값 |
|---|---|
| 커버한 저널 | 47 / 50 (Cine Documental은 2023~26 발간호 없음; Plaridel·일부는 영화이론 논문 희소) |
| 추출 레코드(키워드×논문) | **334** |
| 고유 키워드 | 319 |
| 고유 이론가(실인물) | 251 |
| 접근 | OA 141 / abstract-only 193 |
| 연도 | 2023:48 · 2024:116 · 2025:134 · 2026:33 |

최다 인용 이론가: Derrida·Deleuze(각7), Mbembe·Foucault(각5), Chion(4), Berlant·Ahmed·Rancière·Bataille(각3).

---

## 2. 결론 (커버리지)

| 대상 | 커버 | 전체 | 커버율 |
|---|---|---|---|
| **이론가** | 138 | 251 | **약 55%** |
| **키워드/이론** | 104 | 319 | **약 33%** |

- 로컬 개념-DB 로스터만으로는 이론가 89·키워드 55였으나, **DB `theorists`·`theory_canon`·`sm_concepts`를 합치면 이론가 +49, 키워드 +49** 추가 커버.
- **FQ 단독(이론가 36%/개념 21%)보다 높습니다.** 50저널 학술 논문은 정전 이론가(Deleuze·Derrida·Foucault·Mbembe·Bourdieu·Butler·Berlant·Hartman·Bataille·Rancière 등)를 분석틀로 더 많이 호출하고, 그 정전은 우리 DB가 잘 커버하기 때문입니다.
- 키워드 33%가 낮아 보이는 건 일부 착시 — 저널 키워드의 다수가 **논문별 신조어**(phantasmagorical realism, spectacular silence, re'nao(熱鬧), triangular exchange, transtopia, salaryman masculinity 등)라 일반 이론 DB엔 없는 게 정상.

---

## 3. 잘 커버된 것 (DB의 강한 엔진)

저널들이 반복 호출하고 우리 DB가 보유한 정전·동시대 핵심: necropolitics(Mbembe), hauntology(Derrida), affect/cruel optimism(Berlant), afterlives of slavery(Hartman), the distribution of the sensible(Rancière), biopolitics/bare life(Foucault·Agamben), Third Cinema(Solanas·Getino), structures of feeling(Williams), reparative reading(Sedgwick), Sinophone(Shih), accented cinema(Naficy), the accursed share(Bataille), acousmêtre(Chion), plasticity(Malabou), new materialism, postmemory(Hirsch). → 정동·탈식민·정신분석·사운드·아시아 정전 축은 우리가 보강한 95명 효과로 특히 탄탄.

---

## 4. 진짜 공백 — 추가해야 할 이론가 (약 59명)

50저널이 분석틀로 쓰지만 우리 DB에 **없는** 실제 학자들. 영역별로:

**미디어 산업·플랫폼·인프라**
David Nieborg · Patrick Vonderau · Ramon Lobato · Karin van Es · John Durham Peters · Susan Leigh Star · Charles Acland · Haidee Wasson · Vinzenz Hediger

**비디오그래픽·팬·시청 연구**
Christian Keathley · Louisa Stein · Francesca Coppa · Kate Nash

**동아시아·시노폰·일본**
Hongwei Bao · Howard Chiang · Song Hwee Lim · Anatoly Detwyler · Romit Dasgupta · Thomas Lamarre(확인요)

**라틴아메리카·글로벌 사우스·트랜스내셔널**
Macarena Gómez-Barris · Paul Schroeder Rodríguez · Cecília Mello · Gustavo Subero · Barbara Zecchi · Teshome Gabriel · Will Higbee · Mette Hjort(확인요) · Olivier Marboeuf

**다큐·포렌식·실험영화**
Eyal Weizman · Forensic Architecture(집단) · Alisa Lebow · Ursula Biemann · Nicole Brenez · Dagmar Brunow

**철학·이론**
Alberto Toscano(late fascism) · Athena Athanasiou(agonistic mourning) · Sara Protasi(envy) · Shannon Sullivan(white privilege) · Robert Pfaller(interpassivity) · Edward Schiappa · Enrico Terrone

**남아시아·시각문화·인류학**
Ranjani Mazumdar · Christopher Pinney · Deborah Poole · Nils Bubandt

**기타 동시대**
Legacy Russell(glitch feminism) · Alan Cholodenko(animation) · Carlo Cenciarelli(sound) · Tanya Horeck(true crime) · Brian R. Jacobson · Whit Pow · Yasmina Price · Diana W. Anselmo · Caren Kaplan · Inderpal Grewal · Gerald Vizenor · Eve Tuck

> FQ 보고서의 공백 ~50명과 **상당 부분 다릅니다**(겹치는 건 Benson-Allott류 일부). 두 목록을 합치면 추가 대상 약 90~100명.

---

## 5. 권고 (재개 시 다음 단계)

1. **§4 공백 ~59명 + FQ §3 ~50명 = 약 90~100명**을 3단계 개념 추출 파이프라인으로 DB에 보강.
2. **로스터 union 보정**: DB `theorists`(1,840) ∪ 우리 개념-DB 로스터(2,037) → 49명+ 자동 회수(Creed·Baudry·Eisenstein·Doane·Edelman 등).
3. 저널 키워드 DB의 **신조어 키워드**는 그대로 "동시대 키워드" 보조 인덱스로 보존(일반 DB엔 없어도 검색·태깅 가치 있음).

---

## 6. 한계 (정직한 고지)
- 다수 저널(T&F·MUSE·Silverchair)이 페이월/봇차단이라 **초록 기반 추출**이 많음 → 본문 내 추가 인용은 누락 가능(커버율은 낙관적 상한에 가까움).
- 이론가 파싱에 공저·계보 표기("A / B", "after C")가 섞여 일부 노이즈 존재(정제했으나 잔여 가능).
- 매칭은 이름·키워드 부분일치(ILIKE)+정규화라 동명이인·표기차 오차 일부.

산출 동봉: `Journal_Theory_Keyword_DB.xlsx`(334 레코드), `journals_keyword_db.csv`, `_work/coverage/journal_*`(판정·공백 원본).
