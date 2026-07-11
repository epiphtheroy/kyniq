# LLM-무료 문장 생성 엔진 — 템플릿 × SQL 연산 (*기생충* 사례)

> ⚠️ **이 문서는 v1 기록입니다 (2026-07-10 v2로 대체됨).** 현재 정본은 **`WOW_Engine_v2_EN.md`** — 와우 포인트(검증된 놀라움) 중심으로 재설계: 12 패밀리 × 42 구문 변형(패라프레이즈 뱅크, md5 결정론적 선택), 와우 점수 랭킹, 쌍당 1문장 라우팅, 4박자 수사(앵커→구체화→반전→근거). *Parasite* 41문장 · *Persona* 39문장 검증 완료. v1(아래)은 단순 6패턴 시절의 역사 기록으로 보존.

> 이 문서는 영어 정본의 한국어 미러입니다. 결과물(생성 문장)은 영어로 출력됩니다.

## 개요

이 방식은 **문장 패턴(템플릿) + 데이터베이스 연산(SQL)**만 사용하여 한 편의 영화에 관한 대량의 사실 기반 문장을 생성합니다. **모든 단계에서 LLM을 사용하지 않습니다.** 문장은 전부 Postgres `format()`이 작성하며, 모델이 생성한 문장은 하나도 없습니다. 원리는 "메일 병합(mail merge)"과 같습니다 — 미리 작성된 문장 틀의 빈칸(슬롯)을 DB 조인·집계 결과로 채웁니다. 유일한 비용은 Postgres 계산이므로 실질적으로 무료이며, 완벽하게 결정론적(재현 가능)이고, 규칙을 바꾸는 순간 문장 수가 증가합니다.

**결과: 한 편의 영화 *기생충*(2019)에서 6개 패턴이 238개의 서로 다른 문장을 생성했습니다.** 이 엔진은 의도적으로 **해석·연결 그래프**(영화가 해석·이론가·다른 영화와 어떻게 엮이는가)에 한정합니다. 단순 비해석 사실(수상, 평점 순위, 러닝타임 비교)은 의도적으로 제외했습니다.

모든 문장은 대상 영화의 제목으로 시작합니다.

## 패턴 카탈로그 (각 문장이 담는 요소)

| 패턴 | 문장이 담는 요소 | 2개 영화? | 수치 | *기생충* 개수 |
|---|---|:--:|---|--:|
| A_affinity | 기본 영화 + 이웃 영화 + 공유 해석 개수 + 공유 노드 목록 | ✅ | 공유 수 | 14 |
| B_bridge | 기본 영화 + 이웃 영화 + 하나의 공유 노드 (+ 설명) | ✅ | — | 14 |
| C_reading | 영화 세부정보 (장면) + 이론가 + 개념 + 강도 | | 강도 x/5 | 6 |
| G_theorist_twin | 기본 영화 + 같은 이론가·개념으로 읽은 다른 영화 | ✅ | — | 95 |
| H_dense | 기본 영화 (+ Metascore·RT) + 이웃 영화 + 공유 수 + 핵심 노드 | ✅ | Meta·RT·N | 14 |
| I_lens_twin | 기본 영화 장면 + 이론가·개념·강도 + 같은 렌즈로 읽은 다른 영화 | ✅ | 강도 x/5 | 95 |

가장 밀도가 높은 패턴은 **H_dense** (한 문장에 두 영화 + Metascore·RT·공유 해석 수 + 명시된 연결 노드)와 **A_affinity**입니다. 문장 개수는 **G/I** (하나의 이론가·개념 노드가 수십 개 영화로 확장)에서 폭발합니다.

## 생성된 문장 샘플 (실제 SQL 출력, 편집 없음)

**H_dense — 최고 밀도 (2개 영화 + 수치 + 연결 노드):**
- Parasite (2019, Bong Joon Ho · Metascore 97 · RT 99%) shares 1 interpretation with Juzo Itami's Tampopo (1985); ‘The Meal As The Film's Whole Argument’ is the key link.
- Parasite (2019, Bong Joon Ho · Metascore 97 · RT 99%) shares 1 interpretation with Franklin J. Schaffner's Planet of the Apes (1968); ‘The Built Set Is The Buried Argument’ is the key link.
- Parasite (2019, Bong Joon Ho · Metascore 97 · RT 99%) shares 1 interpretation with Darren Aronofsky's Pi (1998); ‘Inertia As The Strenuous Refusal’ is the key link.

**A_affinity — 이웃 영화 + 공유 해석:**
- Parasite (2019) shares 1 interpretation with Bong Joon Ho's Barking Dogs Never Bite (2000): ‘The Anywhere-Korea Stitched From Elsewhere’.
- Parasite (2019) shares 1 interpretation with Juzo Itami's Tampopo (1985): ‘The Meal As The Film's Whole Argument’.
- Parasite (2019) shares 1 interpretation with Franklin J. Schaffner's Planet of the Apes (1968): ‘The Built Set Is The Buried Argument’.

**B_bridge — 하나의 노드가 두 영화를 연결 (확산):**
- Parasite (2019) is linked to Bong Joon Ho's Barking Dogs Never Bite (2000) by the interpretation ‘The Anywhere-Korea Stitched From Elsewhere’ — Generic or composite spaces standing in for a placeless, everywhere-Seoul.
- Parasite (2019) is linked to Darren Aronofsky's Pi (1998) by the interpretation ‘Inertia As The Strenuous Refusal’ — Stillness, no-plan, doing nothing reread as active, deliberate withholding.
- Parasite (2019) is linked to Juzo Itami's Tampopo (1985) by the interpretation ‘The Meal As The Film's Whole Argument’ — A single dish or table condenses the entire work's meaning.

**C_reading — 장면 + 이론가 + 강도:**
- Parasite's ‘The film as a whole’ is read through Karl Marx's ‘lumpenproletariat / reserve army of labour’ at intensity 5/5 — A Closed System In Which The Poor Devour The Poor To Spare The Rich.
- Parasite's ‘The recurring motif of the 'subway smell'’ is read through Pierre Bourdieu's ‘habitus’ at intensity 5/5 — The Odor Is The Body Of Class, Which No Performance Can Launder.
- Parasite's ‘The secret bunker beneath the Park house’ is read through Sigmund Freud's ‘the return of the repressed’ at intensity 5/5 — The Bunker Is The Architectural Unconscious Of Capital.

**G_theorist_twin — 같은 이론적 렌즈로 읽은 쌍:**
- Parasite and (500) Days of Summer (Marc Webb, 2009) are both read through Karl Marx's ‘commodity fetishism’.
- Parasite and 8 Women (François Ozon, 2002) are both read through Sigmund Freud's ‘the return of the repressed’.
- Parasite and Ju Dou (Zhang Yimou, 1990) are both read through Karl Marx's ‘commodity fetishism’.

**I_lens_twin — 같은 렌즈 쌍 (장면 · 강도 포함):**
- Parasite's ‘The recurring motif of the 'subway smell'’ (Pierre Bourdieu's ‘habitus’, intensity 5/5) shares its reading lens with The Exterminating Angel (1962, Luis Bunuel).
- Parasite's ‘The secret bunker beneath the Park house’ (Sigmund Freud's ‘the return of the repressed’, intensity 5/5) shares its reading lens with 8 Women (2002, François Ozon).

> 제거된 카테고리(원우 지시, 2026-07-09): **D_award**(수상/리스트), **E_rank**(평점 백분위·감독 내 순위), **F_compare**(같은 감독 작품과 러닝타임 비교). 단순 비해석 사실이라 카테고리 자체를 삭제했습니다.

## 확장 — 모든 영화에 대한 배치 생성

아래 엔진의 `base` CTE에서 `WHERE id='...'`를 `WHERE visible` (또는 다른 조건)으로 변경하면 **하나의 SQL 문**으로 전체 카탈로그에 대한 문장을 생성합니다 (각 조인이 `b.id`를 기준으로 하므로 자동으로 확산됩니다). 영화당 평균 수백 개 문장이므로, 6,700개 영화 × 수백 = **수십만~백만 개의 문장**을 LLM 비용 없이 Postgres 내부에서 생성해 `film_sentences` 테이블에 로드할 수 있습니다.

```sql
CREATE TABLE film_sentences AS
WITH base AS (SELECT id,title,year,runtime,director,director_slug FROM films WHERE visible),
     ... (동일한 gen CTE이지만 각 SELECT에 `b.id AS film_id` 추가) ...
SELECT DISTINCT film_id, pattern, sentence FROM gen;
```

## 품질 / 주의 사항

- **품질 게이트**: `cardinality(shared_meta_take_ids) >= 1`은 빈 문장을 필터링합니다. 해석(take)이 0개인 영화는 C/G/I를 생성하지 않고, 친화도(affinity)가 없는 영화는 A/B/H를 생성하지 않습니다.
- **단수/복수**: A_affinity와 H_dense는 개수에 따라 `interpretation` ↔ `interpretations`을 전환하여 문법을 정확하게 유지합니다.
- **설명 구두점**: B_bridge의 설명 (`meta_takes.laconic`)은 이미 마침표로 끝나므로, `rtrim(..., '.')`로 후행 마침표를 제거하여 `..`을 피합니다.
- **라이브 데이터 주의**: 파이프라인 재계산으로 인해 `film_affinities.score`는 현재 `0.0`입니다. 따라서 **공유 해석 수**를 A/H의 점수 대신 사용합니다. 점수가 복구되면 친화도 값으로 복원할 수 있습니다.
- **제목 지역화**: DB 제목은 영어이므로 출력은 영어입니다. `original_title` / 지역화된 제목 열을 추가하면 해당 언어로 직접 문장을 생성할 수 있습니다.
- **중복 제거**: 같은 노드가 여러 별칭 meta_takes 아래에 나타날 수 있으므로, `SELECT DISTINCT`가 중복을 제거합니다.

## 재사용 가능한 SQL 엔진 (매개변수: 한 곳에서 영화 id만 교환)

`base` CTE에서 영화 id만 교환하면 엔진이 모든 영화에 대해 동일한 문장 집합을 생성합니다.

```sql
WITH base AS (
  SELECT id,title,year,runtime,director,director_slug
  FROM films WHERE id='8092e77c-ce4d-4eca-b2ff-6625a714d29e'  -- ← 여기서만 교환
),
gen AS (
  -- A. Affinity pairing
  SELECT 'A_affinity' AS pattern,
    format('%s (%s) shares %s interpretation%s with %s''s %s (%s): %s.',
      b.title,b.year,cardinality(fa.shared_meta_take_ids),
      CASE WHEN cardinality(fa.shared_meta_take_ids)=1 THEN '' ELSE 's' END,
      rf.director,rf.title,rf.year,
      (SELECT string_agg(DISTINCT '‘'||mt.title||'’',', ') FROM meta_takes mt WHERE mt.id=ANY(fa.shared_meta_take_ids))) AS sentence
  FROM film_affinities fa JOIN films rf ON rf.id=fa.related_film_id CROSS JOIN base b
  WHERE fa.film_id=b.id AND cardinality(fa.shared_meta_take_ids)>=1
  UNION ALL
  -- H. Highest density
  SELECT 'H_dense',
    format('%s (%s, %s · Metascore %s · RT %s%%) shares %s interpretation%s with %s''s %s (%s); ‘%s’ is the key link.',
      b.title,b.year,b.director,br.metascore,br.rt_tomatometer,cardinality(fa.shared_meta_take_ids),
      CASE WHEN cardinality(fa.shared_meta_take_ids)=1 THEN '' ELSE 's' END,
      rf.director,rf.title,rf.year,
      (SELECT min(mt.title) FROM meta_takes mt WHERE mt.id=ANY(fa.shared_meta_take_ids)))
  FROM film_affinities fa JOIN films rf ON rf.id=fa.related_film_id CROSS JOIN base b
    LEFT JOIN film_ratings br ON br.film_id=b.id
  WHERE fa.film_id=b.id AND cardinality(fa.shared_meta_take_ids)>=1
  UNION ALL
  -- B. Node bridging (title-first)
  SELECT 'B_bridge',
    format('%s (%s) is linked to %s''s %s (%s) by the interpretation ‘%s’%s.',
      b.title,b.year,rf.director,rf.title,rf.year,mt.title,
      CASE WHEN coalesce(mt.laconic,'')<>'' THEN ' — '||rtrim(mt.laconic,'.') ELSE '' END)
  FROM film_affinities fa JOIN films rf ON rf.id=fa.related_film_id
    JOIN LATERAL unnest(fa.shared_meta_take_ids) s(id) ON true JOIN meta_takes mt ON mt.id=s.id
    CROSS JOIN base b WHERE fa.film_id=b.id
  UNION ALL
  -- C. Theorist reading (scene + concept + intensity)
  SELECT 'C_reading',
    format('%s''s ‘%s’ is read through %s''s ‘%s’ at intensity %s/5 — %s.',
      b.title,f.label,t.theorist_name,t.concept,t.strength,t.take_title)
  FROM figures f JOIN takes t ON t.figure_id=f.id CROSS JOIN base b
  WHERE f.film_id=b.id AND t.theorist_name IS NOT NULL AND t.take_title IS NOT NULL
  UNION ALL
  -- I. Same-lens twin (scene + intensity)
  SELECT 'I_lens_twin',
    format('%s''s ‘%s’ (%s''s ‘%s’, intensity %s/5) shares its reading lens with %s (%s, %s).',
      b.title,f1.label,t1.theorist_name,t1.concept,t1.strength,of.title,of.year,of.director)
  FROM figures f1 JOIN takes t1 ON t1.figure_id=f1.id
    JOIN takes t2 ON t2.theorist_name=t1.theorist_name AND t2.concept=t1.concept AND t2.id<>t1.id
    JOIN figures f2 ON f2.id=t2.figure_id JOIN films of ON of.id=f2.film_id CROSS JOIN base b
  WHERE f1.film_id=b.id AND f2.film_id<>b.id AND t1.theorist_name IS NOT NULL AND t1.take_title IS NOT NULL
  UNION ALL
  -- G. Same theorist + concept twin
  SELECT 'G_theorist_twin',
    format('%s and %s (%s, %s) are both read through %s''s ‘%s’.',
      b.title,of.title,of.director,of.year,t1.theorist_name,t1.concept)
  FROM takes t1 JOIN figures f1 ON f1.id=t1.figure_id
    JOIN takes t2 ON t2.theorist_name=t1.theorist_name AND t2.concept=t1.concept
    JOIN figures f2 ON f2.id=t2.figure_id JOIN films of ON of.id=f2.film_id CROSS JOIN base b
  WHERE f1.film_id=b.id AND f2.film_id<>b.id AND t1.theorist_name IS NOT NULL AND t1.concept IS NOT NULL
)
SELECT DISTINCT pattern, sentence FROM gen ORDER BY pattern;
```
