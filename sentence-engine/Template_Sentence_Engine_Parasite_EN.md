# LLM-Free Sentence Generation Engine — Templates × SQL Operations (demo: *Parasite*)

## Overview

This method generates a large volume of factual sentences about a single film using **sentence patterns (templates) + database operations (SQL)** only — **no LLM at any step**. The sentences are written entirely by Postgres `format()`; nothing here is model-generated. The principle is the same as a "mail merge": the blanks (slots) of pre-written sentence frames are filled with the results of DB joins and aggregations. The only cost is Postgres compute, so it is effectively $0, fully deterministic (reproducible), and the sentence count grows the moment you change a rule.

**Result: from the single film *Parasite* (2019), 6 patterns produced 238 distinct sentences.** This engine is deliberately scoped to the **interpretation / connection graph** — how a film ties to interpretations, theorists, and other films. Plain non-interpretive facts (awards, rating rank, runtime comparison) are intentionally excluded.

Every sentence begins with the target film's title.

## Pattern catalog (what each sentence carries)

| Pattern | Elements the sentence carries | 2 films? | Numbers | *Parasite* count |
|---|---|:--:|---|--:|
| A_affinity | base film + neighbor film + # shared interpretations + shared-node list | ✅ | N shared | 14 |
| B_bridge | base film + neighbor film + one shared node (+ gloss) | ✅ | — | 14 |
| C_reading | film detail (scene) + theorist + concept + intensity | | intensity x/5 | 6 |
| G_theorist_twin | base film + another film read through the same theorist·concept | ✅ | — | 95 |
| H_dense | base film (+ Metascore·RT) + neighbor film + # shared + key node | ✅ | Meta·RT·N | 14 |
| I_lens_twin | base film scene + theorist·concept·intensity + another film under the same lens | ✅ | intensity x/5 | 95 |

The densest are **H_dense** (two films + Metascore·RT·# shared interpretations + a named connecting node in one sentence) and **A_affinity**. The sentence count explodes on **G/I** (one theorist·concept node fans out to dozens of films).

## Generated sentence samples (actual SQL output, unedited)

**H_dense — highest density (2 films + numbers + connecting node):**
- Parasite (2019, Bong Joon Ho · Metascore 97 · RT 99%) shares 1 interpretation with Juzo Itami's Tampopo (1985); ‘The Meal As The Film's Whole Argument’ is the key link.
- Parasite (2019, Bong Joon Ho · Metascore 97 · RT 99%) shares 1 interpretation with Franklin J. Schaffner's Planet of the Apes (1968); ‘The Built Set Is The Buried Argument’ is the key link.
- Parasite (2019, Bong Joon Ho · Metascore 97 · RT 99%) shares 1 interpretation with Darren Aronofsky's Pi (1998); ‘Inertia As The Strenuous Refusal’ is the key link.

**A_affinity — neighbor film + shared interpretation:**
- Parasite (2019) shares 1 interpretation with Bong Joon Ho's Barking Dogs Never Bite (2000): ‘The Anywhere-Korea Stitched From Elsewhere’.
- Parasite (2019) shares 1 interpretation with Juzo Itami's Tampopo (1985): ‘The Meal As The Film's Whole Argument’.
- Parasite (2019) shares 1 interpretation with Franklin J. Schaffner's Planet of the Apes (1968): ‘The Built Set Is The Buried Argument’.

**B_bridge — one node links two films (fan-out):**
- Parasite (2019) is linked to Bong Joon Ho's Barking Dogs Never Bite (2000) by the interpretation ‘The Anywhere-Korea Stitched From Elsewhere’ — Generic or composite spaces standing in for a placeless, everywhere-Seoul.
- Parasite (2019) is linked to Darren Aronofsky's Pi (1998) by the interpretation ‘Inertia As The Strenuous Refusal’ — Stillness, no-plan, doing nothing reread as active, deliberate withholding.
- Parasite (2019) is linked to Juzo Itami's Tampopo (1985) by the interpretation ‘The Meal As The Film's Whole Argument’ — A single dish or table condenses the entire work's meaning.

**C_reading — scene + theorist + intensity:**
- Parasite's ‘The film as a whole’ is read through Karl Marx's ‘lumpenproletariat / reserve army of labour’ at intensity 5/5 — A Closed System In Which The Poor Devour The Poor To Spare The Rich.
- Parasite's ‘The recurring motif of the 'subway smell'’ is read through Pierre Bourdieu's ‘habitus’ at intensity 5/5 — The Odor Is The Body Of Class, Which No Performance Can Launder.
- Parasite's ‘The secret bunker beneath the Park house’ is read through Sigmund Freud's ‘the return of the repressed’ at intensity 5/5 — The Bunker Is The Architectural Unconscious Of Capital.

**G_theorist_twin — pairs under the same theoretical lens:**
- Parasite and (500) Days of Summer (Marc Webb, 2009) are both read through Karl Marx's ‘commodity fetishism’.
- Parasite and 8 Women (François Ozon, 2002) are both read through Sigmund Freud's ‘the return of the repressed’.
- Parasite and Ju Dou (Zhang Yimou, 1990) are both read through Karl Marx's ‘commodity fetishism’.

**I_lens_twin — same-lens twin (scene · intensity included):**
- Parasite's ‘The recurring motif of the 'subway smell'’ (Pierre Bourdieu's ‘habitus’, intensity 5/5) shares its reading lens with The Exterminating Angel (1962, Luis Bunuel).
- Parasite's ‘The secret bunker beneath the Park house’ (Sigmund Freud's ‘the return of the repressed’, intensity 5/5) shares its reading lens with 8 Women (2002, François Ozon).

## Scaling — batch generation for every film

In the `base` CTE of the engine below, changing `WHERE id='...'` to `WHERE visible` (or any predicate) produces sentences for the whole catalog in a **single SQL statement** (each join keys on `b.id`, so it fans out automatically). At an average of a couple hundred sentences per film, 6,700 films × hundreds = **hundreds of thousands to a million sentences**, generated inside Postgres at $0 LLM cost and loaded into a `film_sentences` table.

```sql
CREATE TABLE film_sentences AS
WITH base AS (SELECT id,title,year,runtime,director,director_slug FROM films WHERE visible),
     ... (same gen CTE, but add `b.id AS film_id` to each SELECT) ...
SELECT DISTINCT film_id, pattern, sentence FROM gen;
```

## Quality / caveat notes

- **Quality gate**: `cardinality(shared_meta_take_ids) >= 1` filters out empty sentences. A film with 0 takes yields no C/G/I; a film with no affinities yields no A/B/H.
- **Singular/plural**: A_affinity and H_dense switch `interpretation` ↔ `interpretations` on the count so grammar stays clean.
- **Gloss punctuation**: B_bridge glosses (`meta_takes.laconic`) already end in a period, so the trailing period is stripped with `rtrim(..., '.')` to avoid `..`.
- **Live data note**: `film_affinities.score` is currently `0.0` due to a pipeline recompute, so **# shared interpretations** is used as the number in A/H instead of the score. When the score is restored, the affinity value can be reinstated.
- **Title localization**: DB titles are in English, so output is English. Adding an `original_title` / localized-title column would produce sentences in that language directly.
- **Deduplication**: the same node can appear under multiple alias meta_takes, so `SELECT DISTINCT` cleans up duplicates.

## Reusable SQL engine (parameter: swap the film id in one place)

Change only the film id in the `base` CTE and the engine produces the same sentence set for any film.

```sql
WITH base AS (
  SELECT id,title,year,runtime,director,director_slug
  FROM films WHERE id='8092e77c-ce4d-4eca-b2ff-6625a714d29e'  -- ← swap here only
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
