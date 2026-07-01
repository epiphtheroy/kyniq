# Film Quarterly 커버리지 검증 보고서

작성 2026-06-26 · 질문: "우리 DB가 최신 영화이론을 실제로 커버하는가?"
방법: Film Quarterly(UC Press) **최근 2년(Vol 77.3 Spring 2024 ~ Vol 79.3 Spring 2026, 8개 호 + 웹 칼럼/서평)** 기사에서 거론된 이론가·이론/개념을 5개 에이전트로 추출 → 우리 DB(이론가 2,027 + DB theorists 1,840 + canonical 개념 7,403 + theory_canon + sm_concepts)와 대조.

---

## 1. 결론 (커버리지)

| 대상 | 커버 | 전체 | 커버율 |
|---|---|---|---|
| **이론가** | 50 | 138 | **약 36%** |
| **이론/개념** | 39 | 190 | **약 21%** |

핵심: **정전(canon) 이론은 잘 커버하지만, 현재 활동 중인 동시대 영화·스크린 학자에서 큰 공백**이 있습니다. 이는 이 프로젝트 맨 처음 지적했던 "리스트가 영화이론은 고전 편향"이라는 진단을 FQ 데이터로 실증한 결과입니다.

**중요한 해석 단서 두 가지:**
- 개념 커버율(21%)이 낮은 건 일부 착시입니다. FQ 기사는 저자가 그 글에서 만든 **일회성 신조어**(예: "spectral materiality", "viewser", "topo-cinephilia", "re-story-ation", "phantom kingdom of masculinity")를 많이 씁니다. 이런 건 어떤 일반 이론 DB에도 없는 게 정상입니다. 정전 개념(suture, hapticity, the monstrous-feminine, frames of war 등)은 대체로 잡혔습니다.
- 미커버 이론가 138명 중 **약 18명은 이론가가 아니라 감독·작가**(Hitchcock, Spielberg, Cronenberg, P.T. Anderson, Didion, Highsmith, Pynchon, Bram Stoker, Maggie Nelson, Timothy Leary 등)입니다. 이들을 빼면 실질 학자 기준 커버율은 **약 42%**로 올라갑니다.

---

## 2. 잘 커버된 것 (DB가 강한 영역)

FQ가 분석틀로 자주 호출한 정전 이론가는 거의 다 우리 DB에 있습니다: **Laura Mulvey, Gilles Deleuze, Judith Butler, Lauren Berlant(cruel optimism), José Esteban Muñoz(disidentification), Saidiya Hartman(critical fabulation), Eve Sedgwick(reparative reading), bell hooks, Pierre Bourdieu, Julia Kristeva(abjection), Barbara Creed(monstrous-feminine), Sianne Ngai, Stanley Cavell, Hannah Arendt, Susan Stryker, Paul B. Preciado, Laura U. Marks(haptic), Vivian Sobchack, Sergei Eisenstein, Jean-Louis Baudry, Pasolini.** 정동·트랜스·정신분석·탈식민 축은 우리가 보강한 95명 덕에 특히 탄탄합니다.

---

## 3. 공백 — 추가해야 할 동시대 영화·스크린 학자

FQ가 인용·동원하지만 우리 DB에 **없는** 현역 학자들. 이것이 실질적 보강 리스트입니다(감독·작가 제외).

**스크린·미디어 이론 (최우선)**
Caetlin Benson-Allott · Marina Hassapopoulou(interactive cinema, viewser) · Ramzi Fawaz · Erika Balsom · Nico Baumbach · Anne Friedberg · Janet Staiger(perverse spectator) · Jane Feuer · Amy Herzog · Sarah Keller · Janet Murray(digital narrative)

**트랜스·퀴어·인종 영화연구**
Eliza Steinbock(the shimmer) · Cael M. Keegan · Toby Beauchamp · Cameron Awkward-Rich · Kandice Chuh · Rebecca Wanzo(misogynoir 계열) · Samantha Sheppard(must-see blackness) · Yiman Wang(performer-worker studies) · Allyson Nadia Field

**비서구·지역 영화연구**
Lalitha Gopalan(cinema of interruptions) · Jean Ma · Meheli Sen · Rashna Wadia Richards · Valentina Vitali · Rielle Navitski · Chris Berry · Emilie Yueh-yu Yeh · Chenshu Zhou · Seung-hoon Jeong(biopolitical ethics) · Tibetan New Wave 연구자(Francoise Robin, Dan Smyer Yu, Robert Barnett)

**기타 동시대**
Girish Shambu(new cinephilia) · Kartik Nair(spectral materiality) · Laura Horak · Lauren Fournier(autotheory) · Tony Bennett · Deborah Nelson(unsentimentality) · Richard Seymour(disaster nationalism) · Gillian Rose(Holocaust piety) · Eric Lott · Margaret Olin

> 비-이론가(제외 권장): Hitchcock, Spielberg, Cronenberg, P.T. Anderson, Neil Druckmann(감독/게임), Didion, Highsmith, Pynchon, Bram Stoker, Maggie Nelson(작가), Timothy Leary, Terence McKenna, Pema Chödrön, Richard Walther Darré.

---

## 4. 부수 발견 — 우리 작업 로스터의 데이터 격차

검증 중 드러난 점: **DB의 `theorists` 테이블(1,840)이 우리가 작업 기반으로 삼은 업로드 `theory_canon` CSV(2,587)보다 일부 영화이론가를 더 갖고 있습니다.** Barbara Creed·Jean-Louis Baudry·Sergei Eisenstein·Tania Modleski·Pauline Kael·Pasolini·Eric Lott·Gillian Rose·Jean Ma는 DB엔 있으나 우리 개념-DB 로스터엔 누락됐습니다(두 소스가 갈라져 있음). → **개념 DB 로스터를 DB theorists 테이블과 한 번 union**하면 이 9명 + 유사 누락이 자동 보정됩니다.

---

## 5. 방법론 한계 (정직한 고지)

- **표본**: FQ 2025~2026 호 상당수는 본문이 UC Press(online.ucpress.edu)에서 JS 렌더링·페이월이라, 무료 전문·초록·서평 대상 중심으로 추출했습니다. 따라서 미수집 본문의 추가 인용 이론가가 빠졌을 수 있어, **실제 공백은 이 목록보다 클 가능성**이 있습니다(즉 36%는 낙관적 상한에 가까움).
- 커버 판정은 이름 부분일치(ILIKE)+정규화 매칭이라 동명이인·표기차로 인한 오차가 일부 있습니다.
- 전문 접근(기관 로그인 또는 브라우저 JS 렌더링 도구)을 쓰면 2025~2026 본문까지 채굴해 더 정밀한 2차 검증이 가능합니다.

---

## 6. 권고

1. **§3의 동시대 학자 약 50명을 보강 배치**로 DB에 추가(앞서 쓴 개념 추출 파이프라인 그대로 적용 가능).
2. **로스터 union 보정**(§4)으로 DB-내 누락 9명+ 즉시 회수.
3. 원하면 **브라우저 도구로 FQ 2025~26 페이월 본문**까지 열어 2차 정밀 커버리지 측정.

산출 동봉: `coverage/fq_*.csv`(호별 추출 원본), `fq_theorist_coverage.csv`, `fq_concept_coverage.csv`(항목별 커버 판정).
