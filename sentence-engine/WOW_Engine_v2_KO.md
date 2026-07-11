# WOW Engine v2 — 놀라움 순위 기반, 패러프레이즈, LLM-프리 문장 생성

**목적.** 이 프로젝트는 데이터베이스를 직접 조회하지 않고서는 알 수 없는 것들 — 영화들 사이의 숨겨진 연결 — 을 영어 문장으로 명시화한다. 모든 문장은 Postgres `format()`으로 작성되며, LLM은 전혀 사용하지 않는다. v2는 하나의 편집 원칙을 중심으로 v1 엔진을 업그레이드한다: **와우 포인트** ("*이것*이 *저것*과 연결된다고?"). 한 문장이 자리를 차지하려면 검증 가능한 놀라움을 전달해야 하며, 그 놀라움 자체가 데이터로부터 계산된다.

**검증된 결과 (라이브 kyniq DB, 2026-07-10):**
- *기생충* (2019) → **11개 패밀리**에 걸쳐 **41개 문장**
- *페르소나* (1966) → **8개 패밀리**에 걸쳐 **39개 문장** (데이터 프로파일이 다르면 패밀리 구성도 달라진다; 엔진이 적응한다)

v1은 *기생충*에 대해 238개 문장을 생성했지만, 그 중 ~190개는 거의 동일한 팬아웃 노이즈였다 (주로 68편 영화가 공유하는 마르크스의 상품 페티시즘을 통한 95개 G + 95개 I — 공동 멤버십이 아무도 놀라게 하지 않는 개념). v2는 원시 볼륨을 **순위가 매겨진, 다양한, 증거에 뒷받침된 놀라움**으로 교환한다 — 그리고 볼륨은 카탈로그 규모에서 돌아온다 (6,700편 × ~40 = ~270k 품질 문장).

---

## 1. 설계

### 1.1 네 박자 문장 (수사학적 계약)
모든 문장은 원우가 지정한 피치 논리를 따른다:

| 박자 | 기능 | 예시 단편 |
|---|---|---|
| **앵커** | 항상 제목 먼저 | "기생충 (2019)…" |
| **구체화** | 특정 요소 또는 정확한 수치 | "…'박씨 저택 아래 비밀 벙커'…" |
| **전환** | 놀라운 연결 | "…오직 한 편의 영화와 공유한다 — 혹성탈출 (1968)…" |
| **근거** | 이유, 명칭 제시 | "…: '세트장이 곧 매장된 논제다'." |

한 문장, 피치 길이. 데이터가 추가 펀치를 지원할 때 (25년 이상의 시간 차이, 세 편짜리 희귀성), **짧은 두 번째 문장**이 이를 착지시킨다: *"두 편은 51년 차이를 두고 만들어졌다."*

### 1.2 와우-피처 스택 (SQL로 계산)
놀라움은 주장하는 것이 아니라 측정된다. 다섯 가지 피처가 라우팅과 점수를 결정한다:

| 피처 | 소스 | 와우 판독값 |
|---|---|---|
| **노드 팬아웃** | 카탈로그 전체에서 공유된 `meta_take`당 영화 수 | 팬아웃 = 2 → "카탈로그에서 유일한 두 편" (최강 주장) |
| **개념 팬아웃** | (이론가, 개념)당 영화 수 | 1 = 단독 렌즈; 3–6 = 소수 클럽; >40 = 넓은 대화 (쌍당 와우 거의 0) |
| **연도 차이** | `abs(base.year − other.year)` | 51년 차이 = 시간 다리 드라마 |
| **장르 불일치** | `NOT (genres && genres)`, '드라마'는 캐치올로 제외 | 코미디 ↔ 호러가 하나의 인물을 공유 = 장르를 초월 |
| **복수성** | ≥2개 노드를 공유하는 쌍 | "두 가지 실로 동시에 묶인" |

### 1.3 라우팅: 모든 친화성 쌍은 정확히 하나의 문장만 받는다
v1은 같은 쌍에 대해 A+B+H를 발화했다 (3배 반복). v2는 각 쌍을 우선순위에 따라 *가장 강한* 패밀리로 라우팅한다:

```
nfilms=2                     → P1_exclusive_pair
장르 불일치 (비드라마)         → P4_genre_clash
연도 차이 ≥ 25               → P3_time_bridge
그 외                        → P2_kinship
```
렌즈 공간 개념은 팬아웃 밴드로 분할되어 어떤 개념도 이중으로 커버되지 않는다: ≤12 → P6, 13–40 → P9 (개념당 10개 상한), >40 → P10 (메타 문장 하나). 팬아웃=1 → P8; 3–6도 P7 클럽 문장을 받는다.

### 1.4 패러프레이즈 뱅크 — 결정론적, 무작위 아님
각 패밀리는 2–6개의 템플릿 변형을 가진다 (**12개 패밀리 전체에 걸쳐 42개 표면 형식**). 변형은 `md5(base‖other‖node)`를 N으로 모듈로 연산하여 선택된다 — 따라서 출력은 완전히 재현 가능하며 (같은 입력 → 같은 문장, `random()` 없음), 인접 문장은 구성에서 차이를 보인다. 희귀성/간격 펀치 접미사는 탈상관 해시 잉여 (`(h/7) % 3`)에서 자체 3-변형 뱅크를 가진다.

레지스터: 세련되지만 부하를 지탱하는 — *kinship(친족), seam(이음새), thread(실), echo(메아리), lineage(계보), grammar(문법), counsel(조언), stage(무대), yield(산출), harvest(수확)*. 의도적으로 사용된 영어 구문 특성: 콜론 계시, 대시 전환, 대조 ("코미디로 분류; 호러로 분류"), 평행 구조 ("하나의 렌즈, 두 편의 영화"), 짧은 문장 펀치.

### 1.5 와우 점수
모든 문장은 숫자 `wow` (라우트 강도 + 간격/희귀성 보너스)와 함께 제공되므로, 다운스트림 표면은 `ORDER BY wow DESC LIMIT k`를 사용할 수 있다. 관찰된 범위 ≈ 30–116.

---

## 2. 12개 패밀리

| 패밀리 | 주장 | 기생충 | 페르소나 |
|---|---|--:|--:|
| P1_exclusive_pair | 카탈로그에서 오직 두 편만 이 노드를 무대에 올린다 | 5 | 0 |
| P2_kinship | 예상치 못한 동반자 + 공유된 인물 | 6 | 7 |
| P3_time_bridge | ≥25년에 걸친 같은 논제 (방향 인식) | 2 | 7 |
| P4_genre_clash | 불일치 장르, 같은 인물 | 1 | 3 |
| P5_thesis_element | 장면/모티프 = 영화의 논제 (이론가 + 강도) | 6 | 8 |
| P6_lens_unlock | 같은 희귀 렌즈 (≤12편)가 두 영화를 모두 연다 | 3 | 0 |
| P7_select_club | 이 렌즈 아래 3–6편 중 하나, 멤버 명명 | 1 | 0 |
| P8_solo_lens | 카탈로그에서 이 렌즈 아래 *유일한* 영화 | 3 | 7 |
| P9_same_grammar | 중간 밴드 렌즈 쌍둥이, 연도 차이 대조 (상한 10) | 10 | 0 |
| P10_wide_conversation | *자신만의 문*을 통해 N편 계보에 합류 | 1 | 1 |
| P11_double_bond | 한 영화와 두 개의 공유 노드 | 0 | 5 |
| P12_lens_lineage | 카탈로그에서 렌즈의 최초 보유자 (≥15년 이상 오래된) | 3 | 1 |
| **합계** | | **41** | **39** |

패밀리 구성은 각 영화의 데이터 형태에 맞게 적응한다: *기생충*은 독점 쌍과 중간 밴드 렌즈 쌍둥이가 풍부하고; *페르소나*는 단독 렌즈 (융의 *persona*!), 이중 결합, 시간 다리가 풍부하다.

## 3. 샘플 출력 (실제 SQL 출력, 무편집)

**P1 — 독점 쌍 (최고 와우, 116):**
- 기생충 (2019)은 카탈로그에서 오직 한 편의 영화 — 혹성탈출 (1968) — 과 공유하는 독해를 지닌다: '세트장이 곧 매장된 논제다'. 두 편은 51년 차이를 두고 만들어졌다.
- 기생충 (2019)과 탐포포 (1985)는 카탈로그에서 '식사가 영화 전체의 논제'를 무대에 올리는 유일한 두 편이다. 두 편은 34년 차이를 두고 만들어졌다.

**P8 — 단독 렌즈:**
- 페르소나 (1966)는 카탈로그에서 어떤 다른 영화도 공유하지 않는 렌즈를 가진다: 칼 융의 '페르소나 / 사회적 자아의 가면'.
- 기생충 (2019)은 카탈로그에서 프란츠 파농의 '사회적 위계의 신체적 각인'을 통해 읽히는 유일한 영화다 — 코를 찌푸리는 행위가 계급 폭력의 결정적 행위다.

**P12 — 렌즈 계보:**
- 기생충 (2019)은 카사블랑카 (1943)에서 카탈로그에 처음 등장한 렌즈를 작동시킨다 — 카를 마르크스의 '상품 페티시즘'.
- 페르소나 (1966)는 옵세시오네 (1943)로 시작되는 계보 안에 서 있다: 장-폴 사르트르의 '자기기만(마우베즈 푸아)'을 통해 읽히는 카탈로그의 영화들.

**P11 — 이중 결합:**
- 페르소나 (1966)는 홀리 모터스 (2012)와 두 번 수렴한다: '진짜 얼굴인 가면'과 '수행 또는 의상 아래에는 자아가 없다'.

**P4 — 장르 충돌:**
- 기생충 (2019)은 코미디로 분류되고; 바바리안 (2022)은 호러로 분류된다 — 그러나 두 편 모두 '매장된 방이 건축적 무의식'을 무대에 올린다.
- 페르소나 (1966)는 장르를 가로질러 샤임 (1968)에 닿는다: 미스터리에서 전쟁으로, 하나의 공유된 인물 — '파뢰 섬, 영혼이 되는 섬'.

**P3 — 시간 다리 (방향 인식: 오래된 영화는 "심고", 새 영화는 "거둔다"):**
- 기생충 (2019)은 뻐꾸기 둥지 위로 날아간 새 (1975)가 44년 전에 내린 논제를 이어받는다: '제목은 기생충을 지명하지, 숙주를 지명하지 않는다'. 카탈로그에서 이 인물을 담은 영화는 세 편뿐이다.
- 페르소나 (1966)는 35년 뒤 모래 아래에서 (2000)가 수확할 논제를 심는다: '고발은 억압된 것의 귀환이다'. 카탈로그는 이것을 무대에 올리는 영화를 세 편만 헤아린다.

**P5 — 요소를 논제로:**
- 기생충의 '박씨 저택 아래 비밀 벙커'는 세트 장식이 아니라 논제다 — 지그문트 프로이트의 '억압된 것의 귀환': 벙커는 자본의 건축적 무의식이다.
- 페르소나의 '타오르는 필름'은 영화가 패를 드러내는 곳이다: 앙드레 바쟁과 함께 읽으면, '죽음 마스크로서의 이미지 / 사진적 이미지의 존재론'이 된다 — 타는 필름 스트립은 영화가 자신의 주제를 감당할 수 없다고 고백하는 것이다.

**P7 — 소수 클럽:**
- 기생충 (2019)은 4편의 클럽에 속한다: 피에르 부르디외의 '아비투스'를 통해 읽히는 카탈로그 유일의 영화들 — 아사코 I & II (2018), 오렌지 병사 (1977), 절멸의 천사 (1962)와 함께.

**P9 — 같은 문법 (대조적 색채):**
- 기생충과 고스트버스터즈 (1984)는 35년 차이로 만들어졌지만, 두 편 모두 지그문트 프로이트의 '억압된 것의 귀환'에 답한다.
- 기생충과 외로운 곳에서 (니콜라스 레이, 1950) — 69년 차이 — 는 같은 문법을 따른다: 지그문트 프로이트의 '억압된 것의 귀환'.

**P10 — 넓은 대화 (68편의 마르크스 노이즈를 한 문장으로 압축):**
- 기생충 (2019)은 카를 마르크스의 '상품 페티시즘' 아래 68편의 계보에 합류하며, '학자의 돌 (수석)'을 통해 자신만의 주장을 펼친다.

## 4. 품질 게이트 & 주의사항

- **P4에서 드라마 제외**: '드라마'는 캐치올 장르다; "미스터리 vs 드라마"는 충돌로 읽히지 않는다. 어느 영화의 주 장르가 드라마인 쌍은 P3/P2로 밀려난다 (검증됨: 페르소나의 P4가 11 → 3개 진짜 충돌로 줄었고, 밀려난 쌍들이 *더 나은* 시간 다리 문장을 만들어냈다).
- **전체 영화 특수 케이스**: 인물 레이블 `The film as a whole`은 요소 구문을 깨뜨린다 ("its 'The film as a whole' is not set dressing…") → P5의 전체 영화 전용 템플릿으로 라우팅되고, P6에서 제외된다.
- **상한은 매개변수다**: P6 `wr<=8`, P9 `wr<=10` 개념당. 볼륨을 위해 올리거나, 엄격함을 위해 낮춘다. 모든 상한은 SQL에서 볼 수 있다.
- **소유격 규칙**: *s*로 끝나는 제목은 단독 아포스트로피를 취한다 (`CASE WHEN right(title,1)='s'`).
- **`random()` 없음**: 모든 다양성은 md5 해시에서 파생 → 결정론적, 재현 가능, 차이 확인 가능.
- **`film_affinities.score`는 여전히 0.0** (파이프라인 재계산) — 공유 노드 카디널리티와 노드 팬아웃이 친화성 신호로 대신한다. 점수가 복원되면 재검토.
- **최종 `SELECT DISTINCT`**는 별칭 노드 중복을 방지한다.

## 5. 스케일링
`base`의 `WHERE id='…'`를 `WHERE visible`로 바꾸고, 각 gen 브랜치에 `b.id AS film_id`를 추가하여 구체화한다:
```sql
CREATE TABLE film_sentences AS
SELECT DISTINCT film_id, pattern, wow, sentence FROM gen;
```
두 개의 전역 CTE (`node_fanout`, `concept_fanout`)는 이미 카탈로그 전체를 대상으로 한다 — 한 번 계산되고 모든 영화에 서비스된다. ~6,700편 × ~40 = **$0 LLM 비용으로 ~270k개의 순위가 매겨진, 단조롭지 않은, 검증 가능한 문장**.

## 6. 엔진 (정규 SQL — 한 곳에서 영화 ID만 교체)

```sql
WITH base AS (
  SELECT id, title, year, coalesce(genres,'{}') AS genres,
    CASE WHEN right(title,1)='s' THEN title||'''' ELSE title||'''s' END AS poss
  FROM films WHERE id='8092e77c-ce4d-4eca-b2ff-6625a714d29e'  -- ← 여기만 교체
),
node_fanout AS (
  SELECT s.id AS node_id, count(DISTINCT fa.film_id) AS nfilms
  FROM film_affinities fa, unnest(fa.shared_meta_take_ids) s(id)
  GROUP BY s.id
),
concept_fanout AS (
  SELECT t.theorist_name, t.concept, count(DISTINCT f.film_id) AS nfilms
  FROM takes t JOIN figures f ON f.id=t.figure_id
  WHERE t.theorist_name IS NOT NULL AND t.concept IS NOT NULL
  GROUP BY 1,2
),
pairs_all AS (
  SELECT b.title AS bt, b.year AS by2, b.genres AS bg,
         rf.id AS oid, rf.title AS ot, rf.year AS oy, rf.director AS od, coalesce(rf.genres,'{}') AS og,
         mt.title AS node, nf.nfilms, abs(b.year-rf.year) AS gap,
         row_number() OVER (PARTITION BY rf.id ORDER BY nf.nfilms ASC, mt.title) AS rn
  FROM film_affinities fa
  JOIN films rf ON rf.id=fa.related_film_id
  CROSS JOIN base b
  JOIN LATERAL unnest(fa.shared_meta_take_ids) u(id) ON true
  JOIN node_fanout nf ON nf.node_id=u.id
  JOIN meta_takes mt ON mt.id=u.id
  WHERE fa.film_id=b.id
),
p AS (
  SELECT *,
    CASE
      WHEN nfilms=2 THEN 'P1_exclusive_pair'
      WHEN NOT (bg && og) AND cardinality(bg)>0 AND cardinality(og)>0
           AND lower(bg[1])<>'drama' AND lower(og[1])<>'drama' THEN 'P4_genre_clash'
      WHEN gap>=25 THEN 'P3_time_bridge'
      ELSE 'P2_kinship' END AS fam,
    (('x'||substr(md5(bt||ot||node),1,8))::bit(32)::int & 2147483647) AS h
  FROM pairs_all WHERE rn=1
),
readings AS (
  SELECT f.label, t.theorist_name AS th, t.concept AS c, t.strength, t.take_title, cf.nfilms AS cfn
  FROM figures f JOIN takes t ON t.figure_id=f.id
  CROSS JOIN base b
  JOIN concept_fanout cf ON cf.theorist_name=t.theorist_name AND cf.concept=t.concept
  WHERE f.film_id=b.id AND t.theorist_name IS NOT NULL AND t.take_title IS NOT NULL
),
rconcepts AS (SELECT DISTINCT th, c, cfn FROM readings),
relem AS (
  SELECT th, c, min(label) AS label
  FROM readings WHERE label <> 'The film as a whole' GROUP BY th, c
),
twins AS (
  SELECT rc.th, rc.c, rc.cfn, of.title AS ot, of.year AS oy, of.director AS od,
         abs(of.year - b.year) AS gap,
         row_number() OVER (PARTITION BY rc.th, rc.c ORDER BY abs(of.year-b.year) DESC, of.title) AS wr
  FROM rconcepts rc
  JOIN takes t2 ON t2.theorist_name=rc.th AND t2.concept=rc.c
  JOIN figures f2 ON f2.id=t2.figure_id
  JOIN films of ON of.id=f2.film_id
  CROSS JOIN base b
  WHERE of.id <> b.id
  GROUP BY rc.th, rc.c, rc.cfn, of.title, of.year, of.director, b.year
),
club AS (
  SELECT th, c, cfn,
    array_to_string((array_agg(DISTINCT ot||' ('||oy||')' ORDER BY ot||' ('||oy||')'))[1:3], ', ') AS members
  FROM twins WHERE cfn BETWEEN 3 AND 6 GROUP BY th, c, cfn
),
earliest AS (
  SELECT DISTINCT ON (rc.th, rc.c) rc.th, rc.c, rc.cfn, of.title AS et, of.year AS ey
  FROM rconcepts rc
  JOIN takes t2 ON t2.theorist_name=rc.th AND t2.concept=rc.c
  JOIN figures f2 ON f2.id=t2.figure_id
  JOIN films of ON of.id=f2.film_id
  ORDER BY rc.th, rc.c, of.year ASC, of.title
),
gen AS (
  -- ── 쌍 패밀리: 각 친화성 쌍은 정확히 하나의 문장만 발화, 우선순위에 따라 라우팅 ──
  SELECT fam AS pattern,
    round(CASE fam
      WHEN 'P1_exclusive_pair' THEN 90 + least(gap,60)/2.0
      WHEN 'P4_genre_clash'    THEN 70 + least(gap,60)/2.0 + CASE WHEN nfilms=3 THEN 10 ELSE 0 END
      WHEN 'P3_time_bridge'    THEN 55 + least(gap,60)/2.0 + CASE WHEN nfilms=3 THEN 10 ELSE 0 END
      ELSE 40 + (10-least(nfilms,10)) + least(gap,24)/2.0 END) AS wow,
    CASE fam
      WHEN 'P1_exclusive_pair' THEN
        format((ARRAY[
          '%1$s (%2$s) shares '%6$s' with exactly one other film in the catalog: %3$s (%4$s, %5$s).',
          '%1$s (%2$s) and %3$s (%5$s) are the only two films in the catalog that stage '%6$s'.',
          '%1$s (%2$s) holds a reading it shares with one film alone — %3$s (%5$s): '%6$s'.'
        ])[1 + h % 3], bt, by2, ot, od, oy, node)
        || CASE WHEN gap>=25 THEN format(' The two were made %s years apart.', gap) ELSE '' END
      WHEN 'P4_genre_clash' THEN
        format((ARRAY[
          '%1$s (%2$s) files under %7$s; %3$s (%5$s) files under %8$s — yet both stage '%6$s'.',
          '%1$s (%2$s) and %3$s (%5$s) sit on different shelves — %7$s, %8$s — but build the same figure: '%6$s'.',
          '%1$s (%2$s) crosses genre lines to reach %3$s (%5$s): %7$s to %8$s, one shared figure — '%6$s'.'
        ])[1 + h % 3], bt, by2, ot, od, oy, node, lower(bg[1]), lower(og[1]))
        || CASE WHEN nfilms=3 THEN (ARRAY[
             ' Only three films in the catalog carry this figure.',
             ' The catalog counts just three films that stage it.',
             ' Three films in the whole catalog, no more.'])[1 + (h/7) % 3] ELSE '' END
      WHEN 'P3_time_bridge' THEN
        CASE WHEN oy < by2 THEN
          format((ARRAY[
            '%1$s (%2$s) picks up an argument %3$s laid down %7$s years earlier: '%6$s'.',
            '%1$s (%2$s) answers a question %3$s posed in %5$s: '%6$s'.',
            '%1$s (%2$s) carries a %7$s-year echo of %3$s (%5$s): both stage '%6$s'.'
          ])[1 + h % 3], bt, by2, ot, od, oy, node, gap)
        ELSE
          format((ARRAY[
            '%1$s (%2$s) plants an argument that %3$s harvests %7$s years later: '%6$s'.',
            '%1$s (%2$s) asks a question %3$s answers in %5$s: '%6$s'.'
          ])[1 + h % 2], bt, by2, ot, od, oy, node, gap)
        END
        || CASE WHEN nfilms=3 THEN (ARRAY[
             ' Only three films in the catalog carry this figure.',
             ' The catalog counts just three films that stage it.',
             ' Three films in the whole catalog, no more.'])[1 + (h/7) % 3] ELSE '' END
      ELSE
        format((ARRAY[
          '%1$s (%2$s) keeps unexpected company with %3$s (%4$s, %5$s): both stage '%6$s'.',
          '%1$s (%2$s) finds a quiet twin in %3$s (%5$s) — the shared figure is '%6$s'.',
          '%1$s (%2$s) is stitched to %3$s (%5$s) by a single thread: '%6$s'.',
          '%1$s (%2$s) and %3$s (%5$s) run on the same current: '%6$s'.',
          '%1$s (%2$s) trades a quiet secret with %3$s (%4$s, %5$s) — each builds '%6$s'.'
        ])[1 + h % 5], bt, by2, ot, od, oy, node)
        || CASE WHEN nfilms=3 THEN (ARRAY[
             ' Only three films in the catalog carry this figure.',
             ' The catalog counts just three films that stage it.',
             ' Three films in the whole catalog, no more.'])[1 + (h/7) % 3] ELSE '' END
    END AS sentence
  FROM p
  UNION ALL
  -- ── P11: 이중 결합 (≥2개 노드를 공유하는 쌍) ──
  SELECT 'P11_double_bond', 85,
    format((ARRAY[
      '%1$s (%2$s) converges with %3$s (%4$s) twice over: '%5$s' and '%6$s'.',
      '%1$s (%2$s) is bound to %3$s (%4$s) by two threads at once — '%5$s' and '%6$s'.'
    ])[1 + (('x'||substr(md5(bt||ot||'p11'),1,8))::bit(32)::int & 2147483647) % 2],
    bt, by2, ot, oy, n1, n2)
  FROM (
    SELECT bt, by2, ot, oy,
      (array_agg(node ORDER BY nfilms))[1] AS n1, (array_agg(node ORDER BY nfilms))[2] AS n2
    FROM pairs_all GROUP BY bt, by2, ot, oy HAVING count(*)>=2
  ) dbl
  UNION ALL
  -- ── P5: 요소를 논제로 (강도 ≥ 4; 전체 영화 레이블 특수 처리) ──
  SELECT 'P5_thesis_element', round(48 + r.strength*4),
    CASE WHEN r.label = 'The film as a whole' THEN
      format((ARRAY[
        '%1$s (%2$s), taken whole, runs on %3$s''s '%4$s' — %5$s.',
        '%1$s (%2$s) is, end to end, an essay in %3$s''s '%4$s': %5$s.'
      ])[1 + (('x'||substr(md5(b.title||r.th||r.c||'p5'),1,8))::bit(32)::int & 2147483647) % 2],
      b.title, b.year, r.th, r.c, r.take_title)
    ELSE
      format((ARRAY[
        '%1$s '%2$s' is not set dressing but a thesis — %3$s''s '%4$s': %5$s.',
        '%1$s '%2$s' carries the film''s real argument: %3$s''s '%4$s' — %5$s.',
        '%1$s '%2$s' is where the film shows its hand: read with %3$s, it becomes '%4$s' — %5$s.',
        '%1$s '%2$s' works as an argument in disguise — %3$s''s '%4$s', at intensity %6$s/5: %5$s.'
      ])[1 + (('x'||substr(md5(b.title||r.th||r.c||r.label||'p5'),1,8))::bit(32)::int & 2147483647) % 4],
      b.poss, r.label, r.th, r.c, r.take_title, r.strength)
    END
  FROM readings r CROSS JOIN base b WHERE r.strength >= 4
  UNION ALL
  -- ── P8: 단독 렌즈 (개념 팬아웃 = 1) ──
  SELECT 'P8_solo_lens', 88,
    format((ARRAY[
      '%1$s (%2$s) is the only film in the catalog read through %3$s''s '%4$s' — %5$s.',
      '%1$s (%2$s) holds a lens no other film in the catalog shares: %3$s''s '%4$s'.'
    ])[1 + (('x'||substr(md5(b.title||r.th||r.c||'p8'),1,8))::bit(32)::int & 2147483647) % 2],
    b.title, b.year, r.th, r.c, min(r.take_title))
  FROM readings r CROSS JOIN base b WHERE r.cfn = 1
  GROUP BY b.title, b.year, r.th, r.c
  UNION ALL
  -- ── P7: 소수 클럽 (개념 팬아웃 3–6, 멤버 명명) ──
  SELECT 'P7_select_club', round(75 + (6 - cl.cfn)*3),
    format((ARRAY[
      '%1$s (%2$s) belongs to a club of %3$s: the catalog''s only films read through %4$s''s '%5$s' — alongside %6$s.',
      '%1$s (%2$s) is one of just %3$s films in the catalog that answer to %4$s''s '%5$s'; the others are %6$s.'
    ])[1 + (('x'||substr(md5(b.title||cl.th||cl.c||'p7'),1,8))::bit(32)::int & 2147483647) % 2],
    b.title, b.year, cl.cfn, cl.th, cl.c, cl.members)
  FROM club cl CROSS JOIN base b
  UNION ALL
  -- ── P6: 렌즈 언락 (팬아웃 ≤ 12, 요소 앵커, 개념당 상위 8개) ──
  SELECT 'P6_lens_unlock', round(45 + least(tw.gap,60)/4.0),
    format((ARRAY[
      '%1$s '%2$s' answers to %3$s''s '%4$s' — the same lens that unlocks %5$s (%6$s).',
      '%7$s reads '%2$s' through %3$s''s '%4$s'; the very same key opens %5$s (%6$s).',
      '%1$s '%2$s' and %5$s (%6$s) yield to one lens: %3$s''s '%4$s'.'
    ])[1 + (('x'||substr(md5(b.title||tw.th||tw.c||tw.ot||'p6'),1,8))::bit(32)::int & 2147483647) % 3],
    b.poss, re.label, tw.th, tw.c, tw.ot, tw.oy, b.title)
  FROM twins tw JOIN relem re ON re.th=tw.th AND re.c=tw.c CROSS JOIN base b
  WHERE tw.cfn <= 12 AND tw.wr <= 8
  UNION ALL
  -- ── P9: 같은 문법 (팬아웃 13–40, 연도 거리 기준 개념당 상위 10개) ──
  SELECT 'P9_same_grammar', round(34 + least(tw.gap,60)/4.0),
    CASE WHEN tw.gap >= 10 THEN
      format((ARRAY[
        '%1$s and %2$s (%3$s, %4$s) — %5$s years apart — obey the same grammar: %6$s''s '%7$s'.',
        '%1$s and %2$s (%4$s) were made %5$s years apart, yet both answer to %6$s''s '%7$s'.'
      ])[1 + (('x'||substr(md5(b.title||tw.c||tw.ot||'p9'),1,8))::bit(32)::int & 2147483647) % 2],
      b.title, tw.ot, tw.od, tw.oy, tw.gap, tw.th, tw.c)
    ELSE
      format('%1$s and %2$s (%3$s, %4$s) keep the same counsel: %6$s''s '%7$s'.',
      b.title, tw.ot, tw.od, tw.oy, tw.gap, tw.th, tw.c)
    END
  FROM twins tw CROSS JOIN base b
  WHERE tw.cfn BETWEEN 13 AND 40 AND tw.wr <= 10
  UNION ALL
  -- ── P10: 넓은 대화 (팬아웃 > 40 → N개 쌍 문장이 아닌 메타 문장 하나) ──
  SELECT 'P10_wide_conversation', 30,
    format((ARRAY[
      '%1$s (%2$s) enters one of the catalog''s widest conversations — %3$s films read through %4$s''s '%5$s' — by its own door: '%6$s'.',
      '%1$s (%2$s) joins a %3$s-film lineage under %4$s''s '%5$s', and stakes its own claim through '%6$s'.'
    ])[1 + (('x'||substr(md5(b.title||rc.th||rc.c||'p10'),1,8))::bit(32)::int & 2147483647) % 2],
    b.title, b.year, rc.cfn, rc.th, rc.c, coalesce(re.label, 'the film as a whole'))
  FROM rconcepts rc LEFT JOIN relem re ON re.th=rc.th AND re.c=rc.c CROSS JOIN base b
  WHERE rc.cfn > 40
  UNION ALL
  -- ── P12: 렌즈 계보 (카탈로그 최초 보유자 ≥15년 이상 오래됨, 팬아웃 ≥3) ──
  SELECT 'P12_lens_lineage', round(55 + least(b.year - e.ey, 60)/2.0),
    format((ARRAY[
      '%1$s (%2$s) works a lens first ground in the catalog by %3$s (%4$s): %5$s''s '%6$s'.',
      '%1$s (%2$s) stands in a lineage that opens with %3$s (%4$s): the catalog''s films read through %5$s''s '%6$s'.'
    ])[1 + (('x'||substr(md5(b.title||e.th||e.c||'p12'),1,8))::bit(32)::int & 2147483647) % 2],
    b.title, b.year, e.et, e.ey, e.th, e.c)
  FROM earliest e CROSS JOIN base b
  WHERE e.et <> b.title AND e.ey <= b.year - 15 AND e.cfn >= 3
)
SELECT DISTINCT pattern, wow, sentence FROM gen ORDER BY wow DESC, pattern, sentence;
```

## 7. 검증 로그
- 2026-07-10, *기생충* 대상 쌍 패밀리: 14개 문장, 라우팅 + 변형 + 와우 순서 확인.
- 2026-07-10, *기생충* 대상 렌즈 패밀리: 27개 문장; P6 "its 'The…'" 충돌과 P12 생략 변형 발견 및 수정.
- 2026-07-10, *페르소나* 대상 전체 엔진: 39개 문장; 방향 반전, P11 발화, 적응성 확인.
- 2026-07-10, *페르소나* 쌍 패밀리에서 드라마 게이트 + 접미사 패러프레이즈 재검증 (P4 11→3개 진짜 충돌; 밀려난 쌍들이 더 나은 P3 문장 생성).
