# LLM 없는 문장 생성 엔진 — 템플릿 × SQL 연산 (시연: 〈Drive My Car〉)

## 개요

LLM을 전혀 쓰지 않고, **문장 패턴(템플릿) + DB 연산(SQL)** 만으로 한 영화에서 대량의 사실 문장을 생성하는 방식이다. 원리는 "메일 머지"와 같다 — 미리 만든 문장 틀의 빈칸(slot)에 DB 조인·집계 결과를 `format()`으로 채워 넣는다. 비용은 Postgres 연산뿐이라 사실상 0원, 재현 가능(deterministic)하고, 규칙만 바꾸면 문장 수가 곧바로 늘어난다.

**결과: 〈Drive My Car〉(2021) 한 편에서 9개 패턴으로 258개의 서로 다른 문장이 생성됨.** connection(연결망)에 국한하지 않고, 평점·런타임·수상·백분위 같은 **DB 연산값**도 문장으로 뽑았다.

## 패턴 카탈로그 (각 문장이 담는 것)

| 패턴 | 문장이 담는 요소 | 2영화? | 수치 | 〈DMC〉 생성수 |
|---|---|:--:|---|--:|
| A_affinity | 기준영화 + 이웃영화 + 공유해석 수 + 공유노드 목록 | ✅ | 공유 N개 | ~15 |
| B_bridge | 공유노드(+뉘앙스) + 기준영화 + 이웃영화 | ✅ | — | ~16 |
| C_reading | 영화 세부요소(장면) + 이론가 + 개념 + 강도 | | 강도 x/5 | 6 |
| D_award | 영화 + 수상연도 + 국가 + 상 이름 + 결과 | | 연도 | 8 |
| E_rank | 영화 + 메타스코어 + DB 백분위 + 감독 내 순위 | | 91·상위9%·1/6위 | 1+ |
| F_compare | 기준영화 + 감독 다른작품 + 런타임 분 차이 | ✅ | 분 차이 | 5 |
| G_theorist_twin | 기준영화 + 같은 이론가·개념으로 읽힌 다른 영화 | ✅ | — | ~96 |
| H_dense | 기준영화(+메타·RT) + 이웃영화 + 공유해석 수 + 핵심노드 | ✅ | 메타·RT·공유N | ~15 |
| I_lens_twin | 기준영화 장면 + 이론가·개념·강도 + 같은 렌즈의 다른 영화 | ✅ | 강도 x/5 | ~96 |

가장 밀도가 높은 것은 **H_dense**(한 문장에 두 영화 + 메타스코어·RT·공유해석 수 + 명명된 연결노드)와 **A_affinity**다. 문장 수가 폭발하는 것은 **G/I**(하나의 이론가·개념 노드가 수십 편으로 팬아웃).

## 생성 문장 샘플 (실제 SQL 출력, 무편집)

**H_dense — 최고 밀도(2영화+수치+연결노드):**
- 〈Drive My Car〉(2021, Ryusuke Hamaguchi · 메타스코어 91 · RT 97%)는 Ryusuke Hamaguchi의 〈Wheel of Fortune and Fantasy〉(2021)와 해석 2개를 공유하며 ‘The Flattened Voice That Releases Feeling’가 핵심 연결점이다.
- 〈Drive My Car〉(2021, Ryusuke Hamaguchi · 메타스코어 91 · RT 97%)는 Damien Chazelle의 〈Babylon〉(2022)와 해석 1개를 공유하며 ‘Glenn Gould Flees Into The Instrument’가 핵심 연결점이다.
- 〈Drive My Car〉(2021, Ryusuke Hamaguchi · 메타스코어 91 · RT 97%)는 Akira Kurosawa의 〈Ikiru〉(1952)와 해석 1개를 공유하며 ‘Desire As The Death Drive In Disguise’가 핵심 연결점이다.

**A_affinity — 이웃영화 + 공유해석:**
- 〈Drive My Car〉(2021)는 Isshin Inudo의 〈Josee, the Tiger and the Fish〉(2003)와 해석 1개를 공유한다: ‘The Coward As The Truer Moralist’.
- 〈Drive My Car〉(2021)는 Naomi Kawase의 〈Sweet Bean〉(2015)와 해석 1개를 공유한다: ‘The Recorder That Holds What No Person Can’.
- 〈Drive My Car〉(2021)는 Nicolas Winding Refn의 〈Drive〉(2011)와 해석 1개를 공유한다: ‘Drive Names The Compulsion, Not The Profession’.

**B_bridge — 하나의 노드가 두 영화를 잇는다(팬아웃):**
- ‘Glenn Gould Flees Into The Instrument’(Retreat from live performance into mediated, machine-bounded musical communion.)라는 해석은 〈Drive My Car〉를 Kiyoshi Kurosawa의 〈Tokyo Sonata〉(2008)와 잇는다.
- ‘The Voiceless Heroine Cast As A Body’(Speech withheld; meaning carried by the casting and the body.)라는 해석은 〈Drive My Car〉를 Zhang Yimou의 〈The Road Home〉(1999)와 잇는다.

**C_reading — 장면 + 이론가 + 강도:**
- 〈Drive My Car〉의 ‘The film as a whole’은(는) Mikhail Bakhtin의 ‘dialogism / the unfinalizable utterance’(으)로 강도 5/5로 읽힌다 — A Film Built On The Ontology Of The Unfinished Utterance.
- 〈Drive My Car〉의 ‘Lee Yoo-na communicating through Korean Sign Language (KSL)’은(는) Emmanuel Levinas의 ‘the face-to-face / saying before the said’(으)로 강도 4/5로 읽힌다 — Silent Hands As The Body Of Pure Communion.

**E_rank — 순수 DB 연산(백분위·순위):**
- 〈Drive My Car〉의 메타스코어 91는 DB 평점 수록 3,247편 중 상위 9%이며, Ryusuke Hamaguchi의 작품 중 1/6위다.

**F_compare — 감독 필모 내 수치 비교:**
- 〈Drive My Car〉(179분)은 Ryusuke Hamaguchi의 〈Happy Hour〉(317분)보다 138분 짧다.
- 〈Drive My Car〉(179분)은 Ryusuke Hamaguchi의 〈Evil Does Not Exist〉(106분)보다 73분 길다.

**G_theorist_twin — 같은 이론 렌즈의 쌍:**
- 〈Drive My Car〉와 〈Birdman or (The Unexpected Virtue of Ignorance)〉(Alejandro G. Iñárritu, 2014)은 둘 다 Jean-Paul Sartre의 ‘bad faith (mauvaise foi)’으로 읽힌다.
- 〈Drive My Car〉와 〈Claire's Camera〉(Hong Sang-soo, 2018)은 둘 다 Edmund Husserl의 ‘epoché (phenomenological reduction)’으로 읽힌다.

**D_award — 수상 사실:**
- 〈Drive My Car〉는 2022년 US ‘Best International Feature Film’에서 수상했다.
- 〈Drive My Car〉는 2021년 FR ‘Best Screenplay’에서 수상했다.

## 스케일링 — 전 영화 일괄 생성

위 엔진의 `base` CTE에서 `WHERE id='...'`만 `WHERE visible` 등으로 바꾸면, **단 한 개의 SQL 문**으로 전 영화의 문장을 한꺼번에 만들 수 있다(각 조인이 `b.id` 기준이므로 자동 확장). 영화당 평균 수백 문장이면 6,700편 × 수백 = **수십만~백만 문장**을, LLM 비용 0원으로 Postgres 안에서 생성해 `film_sentences` 테이블에 적재하면 된다.

```sql
CREATE TABLE film_sentences AS
WITH base AS (SELECT id,title,year,runtime,director,director_slug FROM films WHERE visible),
     ... (동일한 gen CTE, 단 각 SELECT에 b.id AS film_id 추가) ...
SELECT DISTINCT film_id, pattern, sentence FROM gen;
```

## 품질·주의 노트

- **품질 게이트**: `cardinality(shared_meta_take_ids) >= 1`로 빈 문장을 걸렀다. take가 0인 영화(예: 〈In Front of Your Face〉)는 C/G/I가 안 나오므로 A/D/E/F만 생성된다.
- **라이브 데이터 이슈**: 현재 `film_affinities.score`가 파이프라인 재계산으로 0.0이라 점수 대신 **공유해석 수**를 수치로 썼다. score가 복구되면 A/H에 친연도 값을 되살리면 된다.
- **한국어 조사**: `은(는)`·`(으)로`는 양형 병기로 처리했고 `와/과`는 고정값을 썼다. 프로덕션에서는 받침 판별 조사 함수(예: `josa(word,'을/를')`)를 Postgres에 만들어 붙이면 자연스러워진다.
- **제목 현지화**: DB 제목이 영어라 영어로 출력된다. `original_title`/한글 제목 컬럼을 확보하면 그대로 한국어 문장이 된다.
- **중복 제거**: 같은 노드가 여러 alias meta_take로 중복될 수 있어 `SELECT DISTINCT`로 정리했다.

## 재사용 SQL 엔진 (파라미터: 영화 id 1곳만 교체)

아래 쿼리의 `base` CTE에 있는 영화 id만 바꾸면 어떤 영화든 동일하게 문장을 생성한다.

```sql
WITH base AS (
  SELECT id,title,year,runtime,director,director_slug
  FROM films WHERE id='ce762723-af01-48c9-867c-7d2c05f5a9a3'  -- ← 여기만 교체
),
allr AS (
  SELECT film_id, metascore,
    round((percent_rank() OVER (ORDER BY metascore))*100)::int AS ms_pct,
    count(*) OVER () AS n
  FROM film_ratings WHERE metascore IS NOT NULL
),
drank AS (
  SELECT f.id, rank() OVER (PARTITION BY f.director_slug ORDER BY r.metascore DESC) AS rk,
         count(*) OVER (PARTITION BY f.director_slug) AS total
  FROM films f JOIN film_ratings r ON r.film_id=f.id
  WHERE f.director_slug=(SELECT director_slug FROM base) AND r.metascore IS NOT NULL
),
gen AS (
  -- A. 친연 페어링
  SELECT 'A_affinity' AS pattern,
    format('〈%s〉(%s)는 %s의 〈%s〉(%s)와 해석 %s개를 공유한다: %s.',
      b.title,b.year,rf.director,rf.title,rf.year,cardinality(fa.shared_meta_take_ids),
      (SELECT string_agg(DISTINCT '‘'||mt.title||'’',', ') FROM meta_takes mt WHERE mt.id=ANY(fa.shared_meta_take_ids))) AS sentence
  FROM film_affinities fa JOIN films rf ON rf.id=fa.related_film_id CROSS JOIN base b
  WHERE fa.film_id=b.id AND cardinality(fa.shared_meta_take_ids)>=1
  UNION ALL
  -- H. 최고 밀도
  SELECT 'H_dense',
    format('〈%s〉(%s, %s · 메타스코어 %s · RT %s%%)는 %s의 〈%s〉(%s)와 해석 %s개를 공유하며 ‘%s’가 핵심 연결점이다.',
      b.title,b.year,b.director,br.metascore,br.rt_tomatometer,rf.director,rf.title,rf.year,
      cardinality(fa.shared_meta_take_ids),(SELECT min(mt.title) FROM meta_takes mt WHERE mt.id=ANY(fa.shared_meta_take_ids)))
  FROM film_affinities fa JOIN films rf ON rf.id=fa.related_film_id CROSS JOIN base b
    LEFT JOIN film_ratings br ON br.film_id=b.id WHERE fa.film_id=b.id AND cardinality(fa.shared_meta_take_ids)>=1
  UNION ALL
  -- B. 노드 브리징
  SELECT 'B_bridge',
    format('‘%s’(%s)라는 해석은 〈%s〉를 %s의 〈%s〉(%s)와 잇는다.',
      mt.title,coalesce(mt.laconic,''),b.title,rf.director,rf.title,rf.year)
  FROM film_affinities fa JOIN films rf ON rf.id=fa.related_film_id
    JOIN LATERAL unnest(fa.shared_meta_take_ids) s(id) ON true JOIN meta_takes mt ON mt.id=s.id
    CROSS JOIN base b WHERE fa.film_id=b.id
  UNION ALL
  -- C. 이론가 독해
  SELECT 'C_reading',
    format('〈%s〉의 ‘%s’은(는) %s의 ‘%s’(으)로 강도 %s/5로 읽힌다 — %s.',
      b.title,f.label,t.theorist_name,t.concept,t.strength,t.take_title)
  FROM figures f JOIN takes t ON t.figure_id=f.id CROSS JOIN base b
  WHERE f.film_id=b.id AND t.theorist_name IS NOT NULL AND t.take_title IS NOT NULL
  UNION ALL
  -- D. 수상/계보
  SELECT 'D_award',
    format('〈%s〉는 %s년 %s ‘%s’에서 %s했다.', b.title,le.year,upper(coalesce(ll.country,'')),ll.label,
      CASE WHEN fl.result='won' THEN '수상' ELSE fl.result END)
  FROM film_lineage fl JOIN lineage_lists ll ON ll.id=fl.list_id
    LEFT JOIN lineage_editions le ON le.id=fl.edition_id CROSS JOIN base b WHERE fl.film_id=b.id AND fl.result IS NOT NULL
  UNION ALL
  -- E. DB 연산: 백분위·감독내 순위
  SELECT 'E_rank',
    format('〈%s〉의 메타스코어 %s는 DB 평점 수록 %s편 중 상위 %s%%이며, %s의 작품 중 %s/%s위다.',
      b.title,a.metascore,a.n,100-a.ms_pct,b.director,dr.rk,dr.total)
  FROM allr a JOIN base b ON a.film_id=b.id JOIN drank dr ON dr.id=b.id
  UNION ALL
  -- F. 런타임 비교
  SELECT 'F_compare',
    format('〈%s〉(%s분)은 %s의 〈%s〉(%s분)보다 %s분 %s.',
      b.title,b.runtime,o.director,o.title,o.runtime,abs(b.runtime-o.runtime),
      CASE WHEN b.runtime>o.runtime THEN '길다' ELSE '짧다' END)
  FROM films o CROSS JOIN base b
  WHERE o.director_slug=b.director_slug AND o.id<>b.id AND o.runtime IS NOT NULL AND b.runtime IS NOT NULL
  UNION ALL
  -- I. 같은 렌즈 쌍(장면·강도 포함)
  SELECT 'I_lens_twin',
    format('〈%s〉의 ‘%s’(%s ‘%s’, 강도 %s/5)와 같은 렌즈로 읽힌 영화로 〈%s〉(%s, %s)가 있다.',
      b.title,f1.label,t1.theorist_name,t1.concept,t1.strength,of.title,of.year,of.director)
  FROM figures f1 JOIN takes t1 ON t1.figure_id=f1.id
    JOIN takes t2 ON t2.theorist_name=t1.theorist_name AND t2.concept=t1.concept AND t2.id<>t1.id
    JOIN figures f2 ON f2.id=t2.figure_id JOIN films of ON of.id=f2.film_id CROSS JOIN base b
  WHERE f1.film_id=b.id AND f2.film_id<>b.id AND t1.theorist_name IS NOT NULL AND t1.take_title IS NOT NULL
  UNION ALL
  -- G. 같은 이론가·개념 쌍
  SELECT 'G_theorist_twin',
    format('〈%s〉와 〈%s〉(%s, %s)은 둘 다 %s의 ‘%s’(으)로 읽힌다.',
      b.title,of.title,of.director,of.year,t1.theorist_name,t1.concept)
  FROM takes t1 JOIN figures f1 ON f1.id=t1.figure_id
    JOIN takes t2 ON t2.theorist_name=t1.theorist_name AND t2.concept=t1.concept
    JOIN figures f2 ON f2.id=t2.figure_id JOIN films of ON of.id=f2.film_id CROSS JOIN base b
  WHERE f1.film_id=b.id AND f2.film_id<>b.id AND t1.theorist_name IS NOT NULL AND t1.concept IS NOT NULL
)
SELECT DISTINCT pattern, sentence FROM gen ORDER BY pattern;
```
