# 스타일(style) 라인 스펙 · v1 — 감독사조 파일 활용

> 출처: 사용자 제공 `sources/director_styles_source.csv` (167명 감독 × 가변 태그, 총 874셀 / 고유 426태그).
> 이 파일은 기존 movement 레지스트리(41개)와 다른 **새 차원(스타일·그룹)**을 준다.

---

## 1. 분석 요약 (정량)

- 167 감독, 평균 5.2 태그/명, 고유 태그 426개.
- 태그 성격(대략): national 228, **style 141**, concept(Auteur Theory) 107, movement 55, grouping 43, 기타 300(상당수가 style/movement 변형).
- **노이즈/중복**: `Auteur Theory`(107회) = "작가다"라는 뜻 → auteur 라인 자체와 동의 → 드롭. national 태그(French Cinema 등) → `country`로 이미 처리 → 드롭. 같은 개념 철자 분기 다수(예: "Docufiction/Hybrid Cinema" vs "Docufiction (Hybrid style)") → 정규화 필요.

## 2. 활용 결론 — 3가지

1. **새 facet `style` 신설.** 시대·국가를 가로지르는 미학 기술어: Slow Cinema, Minimalism, Female Gaze, Long Take, Magic Realism, Deadpan, Transcendental Style, Genre-Bending 등. movement(역사적·국가적 사조, 기간 보유)와 **다른 축**이다.
2. **movement 보강.** 파일의 Korean New Wave·Neo-Neorealism 등은 기존 movement 레지스트리에 매칭/추가.
3. **(선택) facet `grouping`.** 명명된 코호트·삼부작: Three Amigos, A24 Cinema, Koker/Depression Trilogy, 지역 신(Ozark/Portland Scene). 니치하지만 브라우즈·재미 요소. 우선순위 낮음.

## 3. 데이터 모델 연결

- `style`/`grouping`도 `lineage_lists` 행(facet=style|grouping). slug `style-slow-cinema` 등. `has_editions=false`.
- **가중치 철학 차이**: style은 *권위(prestige)가 아니라 기술(description)*. → `authority_weight`/`tier`에 의존하지 말고 **`selectivity`(IDF) 중심**으로 추천에 사용(희소한 스타일 공유 = 강한 신호). tier는 비워도 됨.
- **이 파일은 director→태그**다. 모델은 film 단위(film_lineage)이므로 **전파(propagation)**: 감독→style을 그 감독의 대표작/관련작 `film_lineage`(facet=style)로 펼친다. movement는 기간 메타로 범위 한정.
- **감독 = 아우터 라인과 동일 인물.** 167명이 70개국 감독 리스트와 대거 중복 → **하나의 감독 레지스트리**로 통합(사람=directors, Wikidata QID 필수). 이 파일이 아우터 라인의 country·movement·style을 동시에 시드한다.

## 4. 정규화(canonicalization) 작업 — 핵심

426 raw → 통제 어휘로 축약:
1. national·Auteur Theory 드롭(각각 country·auteur로 흡수).
2. 철자/표기 변형 병합(Docufiction 3종 → 1 slug 등).
3. 잔여를 facet 분류: style / movement(기존 매칭) / grouping.
4. 각 표준 태그에 **Wikidata QID 부착**(Slow Cinema·Magic Realism 등은 QID 존재; "Bong-tail"·"Ozark Cinema"는 editorial, QID 없음).
→ 결과: 표준 style 어휘 ~80–120개 + director→style 멤버십.

## 5. 주의
- 일부 태그는 주관적/특이("Sensory Cinema", "The Arc (Tarkovsky's lineage)", "Bong-tail") → editorial·저가중 또는 큐레이션 제외.
- style은 prestige 등급이 어색 → tier 생략, selectivity로 처리.
- 스키마: `lineage_lists.facet` 체크에 `style`(필요시 `grouping`) 추가 — additive, 확정 시 반영.
