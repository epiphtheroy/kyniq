# 마스터 택소노미 통합 맵 · v1

> 출처: 사용자 제공 "The Cinephile's Master Taxonomy" (`sources/cinephile_master_taxonomy.md`, 12개 섹션 I–XII).
> 이것이 **movement/style 어휘의 정본(backbone)**이 된다 — 기존 movement 레지스트리(41) + 감독사조 style 을 흡수·확장.

---

## 1. 결론

이 택소노미는 세 가지를 동시에 준다: ① 움직임/스타일 **어휘**(기간·국가·설명 포함), ② 각 항목의 **대표 감독(key figures)** = movement→director 매핑, ③ 비평 **렉시콘**(Bressonian, Slow Cinema…). 즉 어휘이자 멤버십이자 콘텐츠다.

## 2. 섹션 → facet 매핑 (facet은 minimal 유지: movement / style + `subtype`)

| 섹션 | 내용 | facet | subtype |
|---|---|---|---|
| I | 초기·역사적 아방가르드 | movement | early / avant-garde |
| II | 고전기·전후 리얼리즘 | movement | national-school / realism |
| III | 글로벌 뉴웨이브 | movement | wave |
| IV | 동구권 | movement | wave |
| V | 정치·탈식민 | movement | political |
| VI | 동아시아 르네상스 | movement | wave |
| VII | 후기20C·포스트모던 | movement | wave |
| VIII | 동시대 트렌드 | movement(웨이브) + **style**(Slow Cinema) | wave / aesthetic |
| IX | 실험·언더그라운드 | movement | avant-garde |
| X | 다큐 모드 | movement | documentary-mode |
| XI | 장르 역학(누아르·지알로·스파게티웨스턴·핑크·엘리베이티드호러) | movement | **genre-cycle** |
| XII | 비평 개념·기술어 | **style** + concept | aesthetic / auteur-adjective / concept |

**설계 결정**
- facet 폭증 방지: `movement` + `style` 둘만 두고, 12섹션 구조는 **`subtype`**(external_ref.subtype 또는 신규 컬럼)으로 보존.
- **장르-사이클**(누아르 등)은 `movement / genre-cycle`. ⚠️ `films.genres`(TMDb)와 혼동 금지 — 그건 별개 축.
- **작가-형용사**(Bressonian·Lynchian·Tarkovskian·Ozu-esque)는 `style / auteur-adjective` + `external_ref.namesake` → **directors 로 링크**(style↔auteur 다리). 멋진 교차연결.
- 순수 이론(Post-Cinema·Metamodernism·Auteur Theory)은 `concept`(렉시콘, 우선순위 낮음). `Auteur Theory`는 노이즈로 드롭.

## 3. 삼원 통합 (충돌 정리)

이 택소노미(movement→감독) + `director_styles_source.csv`(감독→style) + 70개국 아우터 리스트(감독→대표작) = **하나의 감독 레지스트리 + 하나의 movement/style 어휘 + 멤버십**으로 수렴.
- movement 멤버십은 **대표감독→그 감독의 해당 기간 작품**으로 전파(period로 범위 한정).
- 모든 어휘·감독에 **Wikidata QID 부착**(사용자 상시 지침).

## 4. 기존과의 충돌·정리 (reconcile-as-we-go)

- 기존 41 movement 와 **slug로 병합**: 기존 QID 유지, 신규 ~25–30개 추가(Cinema of Attractions, Brighton School, Kammerspielfilm, Cinéma Pur, Japanese Golden Age, Polish School, Yugoslav Black Wave, Imperfect Cinema, 5th/6th Generation, Greek Weird Wave, New Argentine, No Wave, Structural/Materialist, Zanzibar, Sensory Ethnography Lab, Essay Film, Desktop Documentary, Spaghetti Western, Giallo, Pinku Eiga, Elevated Horror …).
- 기존에 내가 만든 `new-objectivity` 중복은 이 택소노미의 정돈된 **Kammerspielfilm**으로 통합.
- **하위-웨이브 계층화**(`parent_slug`): 프랑스 뉴웨이브 ⊃ Cahiers/Left Bank; 홍콩 1st/2nd wave; 중국 5세대/6세대; 대만 뉴시네마 ⊃ Tsai(2세대).

## 5. 제품 활용 — 핵심 기능 2개

1. **블라인드 스팟 탐지(Strategy 5).** 사용자가 본 영화 → 어떤 movement/style/wave 를 *한 번도 안 봤는지* 역산. 추천(유사)의 **역(逆)**으로, 이 택소노미가 있어야 가능. 강력한 차별점: "당신은 Slow Cinema/Cinema Novo 를 아직 안 봤습니다."
2. **인터프리테이션 렉시콘.** 각 항목의 설명·대표작 → 공개 movement 페이지 콘텐츠 + 용어 학습(= '해석 자본' 축적).

## 6. 보존/큐
- 원본: `sources/cinephile_master_taxonomy.md`.
- 백로그 항목으로 등록(움직임 어휘 확장 + style/genre-cycle/auteur-adjective).
