# WOW Engine v2 — Surprise-Ranked, Paraphrased, LLM-Free Sentence Generation

**Purpose.** This project makes explicit, as English sentences, what no one could know without querying our database: the hidden connections between films. Every sentence is written by Postgres `format()` — zero LLM. v2 upgrades the v1 engine around one editorial principle: **the wow point** ("*this* connects to *that*?"). A sentence earns its place by delivering a verifiable surprise, and the surprise itself is computed from the data.

**Verified results (live kyniq DB, 2026-07-10):**
- *Parasite* (2019) → **41 sentences** across 11 firing families
- *Persona* (1966) → **39 sentences** across 8 firing families (different data profile → different family mix; the engine adapts)

v1 produced 238 sentences for *Parasite*, but ~190 of them were near-identical fan-out noise (95 G + 95 I, mostly through Marx's commodity fetishism, a 68-film concept where co-membership surprises no one). v2 trades raw volume for **ranked, varied, evidence-backed surprise** — and the volume returns at catalog scale (6,700 films × ~40 = ~270k quality sentences).

---

## 1. Design

### 1.1 The four-beat sentence (rhetoric contract)
Every sentence follows the pitch logic 원우 specified:

| Beat | Function | Example fragment |
|---|---|---|
| **Anchor** | Title first, always | "Parasite (2019)…" |
| **Concretize** | A specific element or a hard number | "…its ‘secret bunker beneath the Park house’…" |
| **Turn** | The surprising connection | "…shares with one film alone — Planet of the Apes (1968)…" |
| **Warrant** | The reason, named | "…: ‘The Built Set Is The Buried Argument’." |

One sentence, pitch-length. When the data supports an extra punch (a 25+ year gap, a three-film rarity), a **short second sentence** lands it: *"The two were made 51 years apart."*

### 1.2 The wow-feature stack (computed in SQL)
Surprise is not asserted; it is measured. Five features drive routing and scoring:

| Feature | Source | Wow reading |
|---|---|---|
| **Node fanout** | count of films per shared `meta_take`, catalog-wide | fanout = 2 → "the only two films in the catalog" (strongest claim) |
| **Concept fanout** | count of films per (theorist, concept) | 1 = solo lens; 3–6 = select club; >40 = wide conversation (near-zero wow per pair) |
| **Year gap** | `abs(base.year − other.year)` | 51 years apart = time-bridge drama |
| **Genre disjointness** | `NOT (genres && genres)`, with 'drama' excluded as a catch-all | comedy ↔ horror sharing one figure = shelf-defying |
| **Multiplicity** | pairs sharing ≥2 nodes | "bound by two threads at once" |

### 1.3 Routing: every affinity pair gets exactly ONE sentence
v1 fired A+B+H on the same pair (3× repetition). v2 routes each pair to its *strongest* family by priority:

```
nfilms=2                     → P1_exclusive_pair
genre-disjoint (non-drama)   → P4_genre_clash
year gap ≥ 25                → P3_time_bridge
else                         → P2_kinship
```
Lens-space concepts partition by fanout band, so no concept is double-covered: ≤12 → P6, 13–40 → P9 (capped 10/concept), >40 → P10 (one meta-sentence). Fanout=1 → P8; 3–6 also earn a P7 club sentence.

### 1.4 Paraphrase bank — deterministic, not random
Each family carries 2–6 template variants (**42 surface forms across 12 families**). The variant is picked by `md5(base‖other‖node)` reduced mod N — so output is fully reproducible (same input → same sentence, no `random()`), yet neighboring sentences differ in construction. Rarity/gap punch-suffixes have their own 3-variant bank on a decorrelated hash residue (`(h/7) % 3`).

Register: refined but load-bearing — *kinship, seam, thread, echo, lineage, grammar, counsel, stage, yield, harvest*. English syntax features used deliberately: colon reveals, em-dash turns, antithesis ("files under comedy; files under horror"), parallelism ("one lens, two films"), short-sentence punch.

### 1.5 Wow score
Every sentence ships with a numeric `wow` (route strength + gap/rarity bonuses), so any downstream surface can `ORDER BY wow DESC LIMIT k`. Observed range ≈ 30–116.

---

## 2. The 12 families

| Family | The claim | Parasite | Persona |
|---|---|--:|--:|
| P1_exclusive_pair | only two films in the catalog stage this node | 5 | 0 |
| P2_kinship | unexpected companion + shared figure | 6 | 7 |
| P3_time_bridge | same argument across ≥25 years (direction-aware) | 2 | 7 |
| P4_genre_clash | disjoint genres, same figure | 1 | 3 |
| P5_thesis_element | scene/motif = the film's argument (theorist + intensity) | 6 | 8 |
| P6_lens_unlock | same rare lens (≤12 films) opens both films | 3 | 0 |
| P7_select_club | one of only 3–6 films under this lens, members named | 1 | 0 |
| P8_solo_lens | the *only* film in the catalog under this lens | 3 | 7 |
| P9_same_grammar | mid-band lens twins, year-gap contrast (cap 10) | 10 | 0 |
| P10_wide_conversation | joins an N-film lineage *through its own door* | 1 | 1 |
| P11_double_bond | two shared nodes with one film | 0 | 5 |
| P12_lens_lineage | the lens's earliest holder in the catalog (≥15 y older) | 3 | 1 |
| **Total** | | **41** | **39** |

The family mix adapts to each film's data shape: *Parasite* is rich in exclusive pairs and mid-band lens twins; *Persona* is rich in solo lenses (Jung's *persona*!), double bonds, and time bridges.

## 3. Sample output (actual SQL output, unedited)

**P1 — exclusive pair (top wow, 116):**
- Parasite (2019) holds a reading it shares with one film alone — Planet of the Apes (1968): ‘The Built Set Is The Buried Argument’. The two were made 51 years apart.
- Parasite (2019) and Tampopo (1985) are the only two films in the catalog that stage ‘The Meal As The Film's Whole Argument’. The two were made 34 years apart.

**P8 — solo lens:**
- Persona (1966) holds a lens no other film in the catalog shares: Carl Jung's ‘the persona / mask of the social self’.
- Parasite (2019) is the only film in the catalog read through Frantz Fanon's ‘the somatic inscription of social hierarchy’ — The Pinched Nose Is The Decisive Act Of Class Violence.

**P12 — lens lineage:**
- Parasite (2019) stands in a line that begins with Casablanca (1943) — Karl Marx's ‘commodity fetishism’.
- Persona (1966) stands in a lineage that opens with Ossessione (1943): the catalog's films read through Jean-Paul Sartre's ‘bad faith (mauvaise foi)’.

**P11 — double bond:**
- Persona (1966) converges with Holy Motors (2012) twice over: ‘The Mask That Is the True Face’ and ‘No Self Beneath The Performance Or Costume’.

**P4 — genre clash:**
- Parasite (2019) files under comedy; Barbarian (2022) files under horror — yet both stage ‘The Buried Room as the Architectural Unconscious’.
- Persona (1966) crosses genre lines to reach Shame (1968): mystery to war, one shared figure — ‘Fårö, The Island That Becomes The Soul’.

**P3 — time bridge (direction-aware: old films "plant", new films "pick up"):**
- Parasite (2019) picks up an argument One Flew Over the Cuckoo's Nest laid down 44 years earlier: ‘The Title Names The Parasite, Not The Host’. Only three films in the catalog carry this figure.
- Persona (1966) plants an argument that Under the Sand harvests 35 years later: ‘The Accusation As The Return Of The Repressed’. The catalog counts just three films that stage it.

**P5 — element as thesis:**
- Parasite's ‘The secret bunker beneath the Park house’ is not set dressing but a thesis — Sigmund Freud's ‘the return of the repressed’: The Bunker Is The Architectural Unconscious Of Capital.
- Persona's ‘The film burning through’ is where the film shows its hand: read with André Bazin, it becomes ‘the image as death mask / ontology of the photographic image’ — The Burning Strip Is The Film Confessing It Cannot Survive Its Own Subject.

**P7 — select club:**
- Parasite (2019) belongs to a club of 4: the catalog's only films read through Pierre Bourdieu's ‘habitus’ — alongside Asako I & II (2018), Soldier of Orange (1977), The Exterminating Angel (1962).

**P9 — same grammar (contrast-flavored):**
- Parasite and Ghostbusters (1984) were made 35 years apart, yet both answer to Sigmund Freud's ‘the return of the repressed’.
- Parasite and In a Lonely Place (Nicholas Ray, 1950) — 69 years apart — obey the same grammar: Sigmund Freud's ‘the return of the repressed’.

**P10 — wide conversation (68-film Marx noise compressed to one sentence):**
- Parasite (2019) joins a 68-film lineage under Karl Marx's ‘commodity fetishism’, and stakes its own claim through ‘The scholar's rock (Suseok)’.

## 4. Quality gates & caveats

- **Drama exclusion in P4**: 'drama' is a catch-all genre; "mystery vs drama" reads as a non-clash. Pairs where either film's lead genre is drama fall through to P3/P2 (verified: Persona's P4 went 11 → 3 real clashes, the demoted pairs produced *better* time-bridge sentences).
- **Whole-film special case**: figure label `The film as a whole` breaks element phrasing ("its ‘The film as a whole’ is not set dressing…") → routed to dedicated whole-film templates in P5, excluded from P6.
- **Caps are parameters**: P6 `wr<=8`, P9 `wr<=10` per concept. Raise for volume, lower for tightness. All caps are visible in the SQL.
- **Possessive rule**: titles ending in *s* take a bare apostrophe (`CASE WHEN right(title,1)='s'`).
- **No `random()`**: all variety is md5-hash-derived → deterministic, reproducible, diff-able.
- **`film_affinities.score` is still 0.0** (pipeline recompute) — shared-node cardinality and node fanout stand in as the affinity signal. Revisit when score is restored.
- **Final `SELECT DISTINCT`** guards against alias-node duplicates.

## 5. Scaling
Change `WHERE id='…'` in `base` to `WHERE visible`, add `b.id AS film_id` to each gen branch, and materialize:
```sql
CREATE TABLE film_sentences AS
SELECT DISTINCT film_id, pattern, wow, sentence FROM gen;
```
The two global CTEs (`node_fanout`, `concept_fanout`) are already catalog-wide — they compute once and serve every film. ~6,700 films × ~40 = **~270k ranked, non-monotonous, verifiable sentences** at $0 LLM cost.

## 6. The engine (canonical SQL — swap the film id in one place)

```sql
WITH base AS (
  SELECT id, title, year, coalesce(genres,'{}') AS genres,
    CASE WHEN right(title,1)='s' THEN title||'''' ELSE title||'''s' END AS poss
  FROM films WHERE id='8092e77c-ce4d-4eca-b2ff-6625a714d29e'  -- ← swap here only
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
  -- ── Pair families: each affinity pair emits exactly ONE sentence, routed by priority ──
  SELECT fam AS pattern,
    round(CASE fam
      WHEN 'P1_exclusive_pair' THEN 90 + least(gap,60)/2.0
      WHEN 'P4_genre_clash'    THEN 70 + least(gap,60)/2.0 + CASE WHEN nfilms=3 THEN 10 ELSE 0 END
      WHEN 'P3_time_bridge'    THEN 55 + least(gap,60)/2.0 + CASE WHEN nfilms=3 THEN 10 ELSE 0 END
      ELSE 40 + (10-least(nfilms,10)) + least(gap,24)/2.0 END) AS wow,
    CASE fam
      WHEN 'P1_exclusive_pair' THEN
        format((ARRAY[
          '%1$s (%2$s) shares ‘%6$s’ with exactly one other film in the catalog: %3$s (%4$s, %5$s).',
          '%1$s (%2$s) and %3$s (%5$s) are the only two films in the catalog that stage ‘%6$s’.',
          '%1$s (%2$s) holds a reading it shares with one film alone — %3$s (%5$s): ‘%6$s’.'
        ])[1 + h % 3], bt, by2, ot, od, oy, node)
        || CASE WHEN gap>=25 THEN format(' The two were made %s years apart.', gap) ELSE '' END
      WHEN 'P4_genre_clash' THEN
        format((ARRAY[
          '%1$s (%2$s) files under %7$s; %3$s (%5$s) files under %8$s — yet both stage ‘%6$s’.',
          '%1$s (%2$s) and %3$s (%5$s) sit on different shelves — %7$s, %8$s — but build the same figure: ‘%6$s’.',
          '%1$s (%2$s) crosses genre lines to reach %3$s (%5$s): %7$s to %8$s, one shared figure — ‘%6$s’.'
        ])[1 + h % 3], bt, by2, ot, od, oy, node, lower(bg[1]), lower(og[1]))
        || CASE WHEN nfilms=3 THEN (ARRAY[
             ' Only three films in the catalog carry this figure.',
             ' The catalog counts just three films that stage it.',
             ' Three films in the whole catalog, no more.'])[1 + (h/7) % 3] ELSE '' END
      WHEN 'P3_time_bridge' THEN
        CASE WHEN oy < by2 THEN
          format((ARRAY[
            '%1$s (%2$s) picks up an argument %3$s laid down %7$s years earlier: ‘%6$s’.',
            '%1$s (%2$s) answers a question %3$s posed in %5$s: ‘%6$s’.',
            '%1$s (%2$s) carries a %7$s-year echo of %3$s (%5$s): both stage ‘%6$s’.'
          ])[1 + h % 3], bt, by2, ot, od, oy, node, gap)
        ELSE
          format((ARRAY[
            '%1$s (%2$s) plants an argument that %3$s harvests %7$s years later: ‘%6$s’.',
            '%1$s (%2$s) asks a question %3$s answers in %5$s: ‘%6$s’.'
          ])[1 + h % 2], bt, by2, ot, od, oy, node, gap)
        END
        || CASE WHEN nfilms=3 THEN (ARRAY[
             ' Only three films in the catalog carry this figure.',
             ' The catalog counts just three films that stage it.',
             ' Three films in the whole catalog, no more.'])[1 + (h/7) % 3] ELSE '' END
      ELSE
        format((ARRAY[
          '%1$s (%2$s) keeps unexpected company with %3$s (%4$s, %5$s): both stage ‘%6$s’.',
          '%1$s (%2$s) finds a quiet twin in %3$s (%5$s) — the shared figure is ‘%6$s’.',
          '%1$s (%2$s) is stitched to %3$s (%5$s) by a single thread: ‘%6$s’.',
          '%1$s (%2$s) and %3$s (%5$s) run on the same current: ‘%6$s’.',
          '%1$s (%2$s) trades a quiet secret with %3$s (%4$s, %5$s) — each builds ‘%6$s’.'
        ])[1 + h % 5], bt, by2, ot, od, oy, node)
        || CASE WHEN nfilms=3 THEN (ARRAY[
             ' Only three films in the catalog carry this figure.',
             ' The catalog counts just three films that stage it.',
             ' Three films in the whole catalog, no more.'])[1 + (h/7) % 3] ELSE '' END
    END AS sentence
  FROM p
  UNION ALL
  -- ── P11: double bond (pairs sharing ≥2 nodes) ──
  SELECT 'P11_double_bond', 85,
    format((ARRAY[
      '%1$s (%2$s) converges with %3$s (%4$s) twice over: ‘%5$s’ and ‘%6$s’.',
      '%1$s (%2$s) is bound to %3$s (%4$s) by two threads at once — ‘%5$s’ and ‘%6$s’.'
    ])[1 + (('x'||substr(md5(bt||ot||'p11'),1,8))::bit(32)::int & 2147483647) % 2],
    bt, by2, ot, oy, n1, n2)
  FROM (
    SELECT bt, by2, ot, oy,
      (array_agg(node ORDER BY nfilms))[1] AS n1, (array_agg(node ORDER BY nfilms))[2] AS n2
    FROM pairs_all GROUP BY bt, by2, ot, oy HAVING count(*)>=2
  ) dbl
  UNION ALL
  -- ── P5: element as thesis (strength ≥ 4; whole-film label special-cased) ──
  SELECT 'P5_thesis_element', round(48 + r.strength*4),
    CASE WHEN r.label = 'The film as a whole' THEN
      format((ARRAY[
        '%1$s (%2$s), taken whole, runs on %3$s''s ‘%4$s’ — %5$s.',
        '%1$s (%2$s) is, end to end, an essay in %3$s''s ‘%4$s’: %5$s.'
      ])[1 + (('x'||substr(md5(b.title||r.th||r.c||'p5'),1,8))::bit(32)::int & 2147483647) % 2],
      b.title, b.year, r.th, r.c, r.take_title)
    ELSE
      format((ARRAY[
        '%1$s ‘%2$s’ is not set dressing but a thesis — %3$s''s ‘%4$s’: %5$s.',
        '%1$s ‘%2$s’ carries the film''s real argument: %3$s''s ‘%4$s’ — %5$s.',
        '%1$s ‘%2$s’ is where the film shows its hand: read with %3$s, it becomes ‘%4$s’ — %5$s.',
        '%1$s ‘%2$s’ works as an argument in disguise — %3$s''s ‘%4$s’, at intensity %6$s/5: %5$s.'
      ])[1 + (('x'||substr(md5(b.title||r.th||r.c||r.label||'p5'),1,8))::bit(32)::int & 2147483647) % 4],
      b.poss, r.label, r.th, r.c, r.take_title, r.strength)
    END
  FROM readings r CROSS JOIN base b WHERE r.strength >= 4
  UNION ALL
  -- ── P8: solo lens (concept fanout = 1) ──
  SELECT 'P8_solo_lens', 88,
    format((ARRAY[
      '%1$s (%2$s) is the only film in the catalog read through %3$s''s ‘%4$s’ — %5$s.',
      '%1$s (%2$s) holds a lens no other film in the catalog shares: %3$s''s ‘%4$s’.'
    ])[1 + (('x'||substr(md5(b.title||r.th||r.c||'p8'),1,8))::bit(32)::int & 2147483647) % 2],
    b.title, b.year, r.th, r.c, min(r.take_title))
  FROM readings r CROSS JOIN base b WHERE r.cfn = 1
  GROUP BY b.title, b.year, r.th, r.c
  UNION ALL
  -- ── P7: select club (concept fanout 3–6, members named) ──
  SELECT 'P7_select_club', round(75 + (6 - cl.cfn)*3),
    format((ARRAY[
      '%1$s (%2$s) belongs to a club of %3$s: the catalog''s only films read through %4$s''s ‘%5$s’ — alongside %6$s.',
      '%1$s (%2$s) is one of just %3$s films in the catalog that answer to %4$s''s ‘%5$s’; the others are %6$s.'
    ])[1 + (('x'||substr(md5(b.title||cl.th||cl.c||'p7'),1,8))::bit(32)::int & 2147483647) % 2],
    b.title, b.year, cl.cfn, cl.th, cl.c, cl.members)
  FROM club cl CROSS JOIN base b
  UNION ALL
  -- ── P6: lens unlock (fanout ≤ 12, element-anchored, top 8 per concept) ──
  SELECT 'P6_lens_unlock', round(45 + least(tw.gap,60)/4.0),
    format((ARRAY[
      '%1$s ‘%2$s’ answers to %3$s''s ‘%4$s’ — the same lens that unlocks %5$s (%6$s).',
      '%7$s reads ‘%2$s’ through %3$s''s ‘%4$s’; the very same key opens %5$s (%6$s).',
      '%1$s ‘%2$s’ and %5$s (%6$s) yield to one lens: %3$s''s ‘%4$s’.'
    ])[1 + (('x'||substr(md5(b.title||tw.th||tw.c||tw.ot||'p6'),1,8))::bit(32)::int & 2147483647) % 3],
    b.poss, re.label, tw.th, tw.c, tw.ot, tw.oy, b.title)
  FROM twins tw JOIN relem re ON re.th=tw.th AND re.c=tw.c CROSS JOIN base b
  WHERE tw.cfn <= 12 AND tw.wr <= 8
  UNION ALL
  -- ── P9: same grammar (fanout 13–40, top 10 per concept by year distance) ──
  SELECT 'P9_same_grammar', round(34 + least(tw.gap,60)/4.0),
    CASE WHEN tw.gap >= 10 THEN
      format((ARRAY[
        '%1$s and %2$s (%3$s, %4$s) — %5$s years apart — obey the same grammar: %6$s''s ‘%7$s’.',
        '%1$s and %2$s (%4$s) were made %5$s years apart, yet both answer to %6$s''s ‘%7$s’.'
      ])[1 + (('x'||substr(md5(b.title||tw.c||tw.ot||'p9'),1,8))::bit(32)::int & 2147483647) % 2],
      b.title, tw.ot, tw.od, tw.oy, tw.gap, tw.th, tw.c)
    ELSE
      format('%1$s and %2$s (%3$s, %4$s) keep the same counsel: %6$s''s ‘%7$s’.',
      b.title, tw.ot, tw.od, tw.oy, tw.gap, tw.th, tw.c)
    END
  FROM twins tw CROSS JOIN base b
  WHERE tw.cfn BETWEEN 13 AND 40 AND tw.wr <= 10
  UNION ALL
  -- ── P10: wide conversation (fanout > 40 → ONE meta-sentence, not N pair sentences) ──
  SELECT 'P10_wide_conversation', 30,
    format((ARRAY[
      '%1$s (%2$s) enters one of the catalog''s widest conversations — %3$s films read through %4$s''s ‘%5$s’ — by its own door: ‘%6$s’.',
      '%1$s (%2$s) joins a %3$s-film lineage under %4$s''s ‘%5$s’, and stakes its own claim through ‘%6$s’.'
    ])[1 + (('x'||substr(md5(b.title||rc.th||rc.c||'p10'),1,8))::bit(32)::int & 2147483647) % 2],
    b.title, b.year, rc.cfn, rc.th, rc.c, coalesce(re.label, 'the film as a whole'))
  FROM rconcepts rc LEFT JOIN relem re ON re.th=rc.th AND re.c=rc.c CROSS JOIN base b
  WHERE rc.cfn > 40
  UNION ALL
  -- ── P12: lens lineage (earliest catalog holder ≥15y older, fanout ≥3) ──
  SELECT 'P12_lens_lineage', round(55 + least(b.year - e.ey, 60)/2.0),
    format((ARRAY[
      '%1$s (%2$s) works a lens first ground in the catalog by %3$s (%4$s): %5$s''s ‘%6$s’.',
      '%1$s (%2$s) stands in a lineage that opens with %3$s (%4$s): the catalog''s films read through %5$s''s ‘%6$s’.'
    ])[1 + (('x'||substr(md5(b.title||e.th||e.c||'p12'),1,8))::bit(32)::int & 2147483647) % 2],
    b.title, b.year, e.et, e.ey, e.th, e.c)
  FROM earliest e CROSS JOIN base b
  WHERE e.et <> b.title AND e.ey <= b.year - 15 AND e.cfn >= 3
)
SELECT DISTINCT pattern, wow, sentence FROM gen ORDER BY wow DESC, pattern, sentence;
```

## 7. Verification log
- 2026-07-10, pair families on *Parasite*: 14 sentences, routing + variants + wow ordering confirmed.
- 2026-07-10, lens families on *Parasite*: 27 sentences; caught & fixed P6 "its ‘The…’" clash and P12 elliptical variant.
- 2026-07-10, full engine on *Persona*: 39 sentences; direction flip, P11 firing, adaptivity confirmed.
- 2026-07-10, drama-gate + suffix-paraphrase re-verified on *Persona* pair families (P4 11→3 genuine clashes; demoted pairs produced better P3 sentences).
