# 레지스트리 빌드 스펙 (Registry Build Spec) · v1

> **목적**: 영화 단위 매핑 *이전에*, "어떤 리스트(영화제/상/정전/사조/국가)를 어디까지 넣을지"를 **등급(T1–T4)·가중치와 함께** 확정한 레지스트리(`lineage_lists` + 일부 `lineage_editions`)를 만든다.
> 이 문서 하나만 읽으면 어떤 에이전트든 동일 품질로 작업·확장할 수 있다. (재사용 가능한 단일 지침)
> 범위: **균형(balanced)** · 등급: **4등급 T1–T4**

---

## 1. 산출물 & 스키마 (정확히 이 컬럼)

### `lineage_lists.csv`
`facet, slug, label, parent_slug, has_editions, tier, authority_weight, source, external_ref, description`
- `facet` ∈ `festival | section | award | canon | movement | national`
- `slug` 전역 UNIQUE, kebab-case, facet 네임스페이스 반영 (예: `cannes-palme-dor`, `venice-golden-lion`).
- `parent_slug`: award/section→festival, 하위사조→상위사조 (없으면 공란, uuid 아님).
- `has_editions`: 연도판 보유 여부. award/section/canon-poll = `true`, movement = `false`.
- `tier`: T1–T4 (§3 루브릭).
- `authority_weight`: tier 밴드 내 수치.
- `source`: `wikidata`/`bfi`/`tspdt`/`afi`/`mubi`/`editorial` 등.
- `external_ref`: JSON 문자열. 가능하면 Wikidata QID 포함 — 예: `{"wikidata":"Q179808"}`.
- `description`: 1줄 이내.

### `lineage_editions.csv` (연도판 — **유한한 정전 폴만** 이 단계에서 작성)
`list_slug, year, edition_label, slug, rank_max, source, external_ref`
- 영화제/상의 매년 에디션은 **여기서 만들지 않는다** (영화 매핑 단계에서 해당 연도 수상작과 함께 생성).
- 이 단계 대상: S&S 각 판(1952…2022), TSPDT 현행+주요 과거판, AFI(1998/2007), 1001 Movies(판), MUBI(롤링=현행 1판) 등 **개수가 유한한** 폴.

---

## 2. 핵심 규칙

- **이 단계는 '리스트의 목록'이다. 영화는 넣지 않는다.** (film_lineage 는 후속.)
- 한 행 = 하나의 시리즈/권위. 매년 반복되는 상은 *시리즈 1행*(예: `cannes-palme-dor`)이고 연도는 후속 에디션으로.
- 모든 행에 `source` 1개 이상, 가능하면 `external_ref.wikidata` 채울 것.
- 중복 금지: 같은 대상은 1 slug. 별칭은 후속 `lineage_list_aliases`.
- 불확실하면 만들지 말고 `description`에 '검토필요' 표기.

---

## 3. 등급 루브릭 (T1–T4) — **비평/시네필 권위 기준** (FIAPF 행정등급 ≠ 권위)

| tier | weight 밴드 | 정의 | 예시 |
|---|---|---|---|
| **T1** | 0.90–1.00 | 정점. 해당 영역 최고 권위 1개 | 황금종려상/황금사자상/황금곰상, 아카데미 작품상, S&S(비평가/감독), TSPDT 1000 |
| **T2** | 0.70–0.88 | 주요 | Big-3의 그랑프리·심사위원대상·감독상·경쟁부문 *진출*, AFI 100, 1001 Movies, Criterion, Cahiers 연간, 시네필 메이저 영화제(선댄스·로카르노·로테르담·산세바스티안·TIFF) 최고상, 주요 시상식(BAFTA·세자르·청룡 등) 작품상 |
| **T3** | 0.50–0.68 | 주목 | 주변부문(주목할만한시선·오리종티·파노라마·감독주간·비평가주간), MUBI Top 1000(커뮤니티), National Film Registry(보존), 부산·카를로비바리·시체스 최고상, 중위 국가상/정전 |
| **T4** | 0.30–0.45 | 맥락 | 사이드바·단편/다큐 전용 상, 군소 영화제, 단발 매체 리스트 |

facet별 적용 힌트:
- **award**: 상 자체의 격(대상>부문상>기술상)으로 tier.
- **section**: 경쟁부문(T2) > 주요 주변부문(T3) > 사이드바(T4).
- **canon**: 방법론·권위(평론가 집계>단일매체>커뮤니티/보존목록).
- **movement**: 영화사적 정전성(주요 사조 T2 / 군소·논쟁적 T3-4). movement는 보통 weight 0.55–0.70.
- **national**: 그 나라 최고 영화상(T2-3) / 국가 정전(T3) / 군소(T4).

---

## 4. facet별 범위 ("어디까지") — 균형

### 4.1 festival / section / award
- **Big-3 (칸·베니스·베를린)**: 영화제 1행(`festival`) + 주요 상(`award`) 전부 + 경쟁부문 및 핵심 주변부문(`section`).
  - 칸: 황금종려상(T1)·그랑프리(T2)·심사위원상(T2)·감독상(T2)·각본상(T2)·남녀주연상(T2)·황금카메라(T2). 부문: 경쟁(T2)·주목할만한시선(T3)·감독주간(T3)·비평가주간(T3).
  - 베니스: 황금사자상(T1)·심사위원대상(T2)·감독상 은사자상(T2)·볼피컵 남녀연기(T2). 부문: 경쟁(T2)·오리종티(T3).
  - 베를린: 황금곰상(T1)·심사위원대상 은곰(T2)·감독상 은곰(T2)·연기 은곰(T2). 부문: 경쟁(T2)·파노라마(T3)·엔카운터스(T3).
- **시네필 메이저 영화제** 최고상: 선댄스(심사위원대상)·TIFF(관객상)·로카르노(황금표범)·로테르담(타이거)·산세바스티안(황금조개)·텔루라이드(선정)·뉴욕영화제(선정). 대개 T2.
- **시상식**: 아카데미(작품상 T1·감독상 T2·국제장편 T2·각본/연기 T2)·BAFTA·세자르·고야·다비드디도나텔로·일본아카데미·청룡·대종·백상·홍콩금상장·필름페어. 작품상 위주 T2-3.

### 4.2 canon
S&S 비평가/감독(각 판)·TSPDT 1000(현행+주요 과거)·AFI 100(1998/2007)·1001 Movies·Criterion Collection·Cahiers du Cinéma 연간 톱텐·**MUBI Top 1000**(커뮤니티 T3)·National Film Registry(보존 T3). 국가 정전은 §4.4와 연계.

### 4.3 movement (연도판 없음, 기간 메타만 `external_ref.period`)
소비에트 몽타주·독일 표현주의·프랑스 시적리얼리즘·이탈리아 네오리얼리즘·프랑스 누벨바그·좌안파·영국 프리시네마/뉴웨이브·뉴 할리우드·뉴 저먼 시네마·시네마 노부·일본 뉴웨이브·홍콩 뉴웨이브·대만 뉴 시네마·한국 뉴웨이브·이란 뉴웨이브·체코 뉴웨이브·도그마95·루마니아 뉴웨이브·뉴 퀴어 시네마·멈블코어·인도 패러렐 시네마·다이렉트 시네마/시네마 베리테·독일 표현주의 등 **약 40개**. 상위/하위 관계는 `parent_slug`(예: 뉴웨이브 묶음).

### 4.4 national (되도록 폭넓게, 확장형)
주요 영화국 **~20개국**: 미국·영국·프랑스·이탈리아·독일·스페인·스웨덴·덴마크·폴란드·체코·러시아/구소련·일본·한국·홍콩·중국·대만·인도·이란·멕시코·브라질·아르헨티나·호주·캐나다 중 20국. 각국: ①최고 영화상(작품상) ②국가 정전 1종(있으면). 군소는 T4.

---

## 5. slug / 표기 컨벤션
- 영화제: `cannes`, `venice`, `berlin`, `sundance`, `locarno`…
- 상: `<festival>-<award>` 예 `cannes-palme-dor`, `venice-golden-lion`, `oscar-best-picture`.
- 부문: `<festival>-<section>` 예 `cannes-un-certain-regard`.
- 정전: 출처-식별 `sight-and-sound-critics`, `tspdt-1000`, `afi-100`, `mubi-top-1000`, `national-film-registry`.
- 사조: 영문 kebab `french-new-wave`, `italian-neorealism`.
- 국가: `national-<iso2>-<무엇>` 예 `national-kr-blue-dragon-best-film`, `national-fr-cesar-best-film`.

---

## 6. 품질/검증 (오케스트레이터가 수행)
- 컬럼 수 일치·JSON 유효성·중복 slug 0·parent_slug 존재·editions의 list_slug 존재(has_editions=true) — 파이썬 체크.
- tier↔weight 밴드 정합성.

---

## 7. 에이전트 운영
- facet별 서브에이전트(①영화제·상 ②정전 ③사조 ④국가)가 본 스펙대로 행을 반환.
- 서브에이전트는 **웹 조사 + DB 읽기 전용**만. DB 쓰기/파일 생성 금지. 결과는 CSV 행(텍스트)으로 반환.
- 오케스트레이터가 병합·중복제거·검증 후 `seeds/lineage_lists.csv`, `seeds/lineage_editions.csv` 작성.
