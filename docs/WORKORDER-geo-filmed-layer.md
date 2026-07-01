# WORK ORDER — Filming-locations layer (multi-source, web-search, legally clean)

> **Read this top to bottom before doing anything.** It is written so an AI seeing the
> Metatake project for the first time can execute it correctly and fast. Do exactly what
> it says. **Accuracy over coverage. Never invent a place or a coordinate.**

You are building the **"Filmed" layer** of Metatake's geographic Atlas — the *real, physical
places each film was shot* (e.g. "Battersea Power Station, London") — with a short in-film
role, a set/real flag, source URLs, and a confidence tier. This is **separate** from the
already-built **"Setting" layer** (where a film is *set* / what it names). You only ever
write `layer='filmed'`.

A 30-film pilot already produced 182 high-quality filmed pins; this run extends it to the
rest of the corpus. Match that bar.

---

## 0. What you need (tools) + the model

You need three capabilities in this chat. Confirm you have them before starting:
1. **Web search** — to research filming locations across multiple independent sources.
2. **Supabase access** — the **Supabase MCP** (`execute_sql`, project ref `jvgarcqrtsmgfimdcwgo`)
   **or** PostgREST with the **service_role** key. The tables have **RLS on with no public
   policy**, so the anon key cannot write — you must use the MCP or service role.
3. **Subagents** — the ability to spawn parallel worker agents (a "Task"/agent tool). This
   is how you go fast. If you cannot spawn subagents, you can still run serially, just slower.

**Model: Sonnet is the intended model and is sufficient.** This is a structured
extraction-and-verification task, not an open-ended reasoning task. Quality comes from
following the procedure and the worked example below *exactly* — not from model size. Do not
improvise methodology; execute the steps.

---

## 1. Database (write target)

Project ref `jvgarcqrtsmgfimdcwgo` · REST base `https://jvgarcqrtsmgfimdcwgo.supabase.co/rest/v1`.

**Write rows into `film_locations` (always `layer='filmed'`):**

| column | value |
|---|---|
| `film_id` | the film's uuid (from the read query — **the film, never a figure id**) |
| `layer` | `'filmed'` (literal) |
| `name` | the **real filming place**, as specific as the sources support ("Hatfield House, Hertfordshire, England", "Jeonju Film Studio, South Korea") |
| `narrative_setting` | what it portrays in the film, your words ("1920s Los Angeles", "Wayne Manor") |
| `scene_role` | a short role **in your own words** ("the climactic rooftop chase") — never copied from a source |
| `kind` | one of `city｜region｜country｜landmark｜venue｜area｜studio` |
| `built_set` | `true` only if it is a studio/backlot/soundstage/CGI set (not a visitable real location) |
| `set_host` | when `built_set=true`, the studio/stage name ("Pinewood Studios"); else `null` |
| `lat`,`lng` | decimal degrees (your geographic knowledge) |
| `precision` | `exact｜venue｜city｜area｜region｜country` |
| `country` | plain English country name where the coordinates fall |
| `tier` | `'verified'｜'probable'｜'weak'` (see §4) |
| `sources` | **jsonb array of the source URLs you used** — **independent domains only** (see §5) |
| `source` | `'agent-filmed'` (literal) |
| `confidence` | `0.85` verified · `0.65` probable · `0.45` weak |

Unique key `(film_id, layer, name)` → always insert with **`ON CONFLICT (film_id, layer, name) DO NOTHING`**.
Never write `layer='setting'`. Never UPDATE/DELETE existing rows. Only INSERT filmed rows and UPSERT progress.

**Progress / resume — `geo_filmed_progress`** (one row per film, written even when a film
yields 0 places):
`film_id` (PK), `n_places` (published count), `n_quarantined` (count excluded for being
protected-DB-only), `status` (`'done'｜'error'`), `agent` (your worker id), `note` (optional).
Upsert with `ON CONFLICT (film_id) DO UPDATE`.

---

## 2. Fast, resumable parallelism — orchestrator + parallel subagents

This is the design that makes it fast in a chat. **One orchestrator** (you) repeatedly pulls
a batch of unprocessed films and **fans them out to parallel subagents**; each subagent does
the real per-film work and writes directly to the DB. The `geo_filmed_progress` guard makes
the whole thing auto-resume — already-done films are skipped, so re-running never duplicates.

**Wave loop (orchestrator):**

1. **Pull the next wave** of unprocessed films (tune `LIMIT`; 160 = 8 subagents × 20 films):
   ```sql
   select f.id as film_id, f.slug, f.title, f.year, f.director
   from films f
   where f.visible
     and not exists (select 1 from geo_filmed_progress gp where gp.film_id = f.id)
   order by f.id
   limit 160;
   ```
   If this returns 0 rows, **you are done** — go to §8.

2. **Split** the returned films into N equal chunks (e.g. 8 chunks of ~20).

3. **Launch N subagents in a single message** (so they run concurrently). Give each subagent:
   its explicit chunk (the list of `film_id`+`slug`+`title`+`year`+`director`), a unique
   `agent` id (e.g. `filmed-w1`…`filmed-w8`), and **the full text of §1, §3, §4, §5, §6,
   and the §7 worked example** so it has the complete contract. (Copy those sections into the
   subagent prompt — do not assume the subagent can see this file.)

4. **Wait** for all subagents to finish, then **poll** `select geo_progress_stats();` and
   spot-check a few new rows (§6 monitoring).

5. **Repeat from step 1.** Each wave processes the next ~160 films. Stop when step 1 returns 0.

**Why explicit ID batches (not hash partitions):** it lets you control exactly how many films
each subagent handles, so no subagent overflows its context, and the orchestrator stays light
(it only launches + polls). ~1,905 films ÷ 160 ≈ **12 waves**.

**Resuming after a stop / new session:** just start at step 1 again. The `not exists
geo_filmed_progress` guard skips everything already done. No bookkeeping needed.

**Each subagent**, for its assigned films, runs §3 per film, writes rows + the
`geo_filmed_progress` row per film (§5), and returns a one-line-per-film summary
(`title — n published, n quarantined`).

---

## 3. Per-film procedure — 6 steps (this is the quality core)

For each film `(title, year, director)`:

1. **SEARCH** — run ~3 independent web searches and collect results from **multiple
   independent domains**:
   - `"<title>" <year> filming locations`
   - `"<title>" <year> where was it filmed set vs real location`
   - `"<title>" <year> studio backlot built set` (to catch sets/CGI)
   Add a director/title-disambiguating term if the title is common.

2. **EXTRACT** — for each candidate location, capture: the **real place** (as specific as
   supported — venue/address/area), the **in-film** place (`narrative_setting`), a short
   **`scene_role` in your own words**, whether it is a **`built_set`** (studio/backlot/CGI)
   and its `set_host`, and the **exact source URL(s)** that support it. A film usually yields
   **0–8** real places; obscure films often yield 0 — that is expected and fine.

3. **VERIFY (adversarial — try to disprove each candidate):**
   - Is it actually a **set or CGI** mistaken for a real place? → mark `built_set=true`, not a visitable location.
   - Is it a **background plate / stock shot / second-unit** rather than a real shooting location? → drop or downgrade.
   - Is it a **same-named but wrong place**, or a location from a **different film/version**? → drop.
   - Does any *independent* source corroborate it? If only one shaky blog says so → `weak`.
   *(Pilot example of this step working: a source claimed The Godfather Part II shot its
   Ellis Island scenes at Ellis Island; cross-checking showed the period immigration
   sequences were actually shot in **Trieste, Italy** — the wrong claim was dropped.)*

4. **GRADE by source authority** — classify every supporting domain:
   - **A** (authoritative; one A source ⇒ may publish as `probable`): wikipedia, imdb, major
     press (bbc, nyt, guardian, variety, npr, cnn…), official tourism/film-commission/studio
     sites, `.gov`/`.go.kr`/`.or.kr`.
   - **B** (editorial filming-location blogs: giggster, screenrant, almostginger,
     legendarytrips, etc.) — single B ⇒ `weak`.
   - **C** (obscure / SNS / AI-generated wikis) — ⇒ `weak`.
   - **X — PROTECTED DBs: `movie-locations.com`, `atlasofwonders.com`.** Use these **only to
     cross-check**, **never as a stored source**. If a location's **only** support is an X
     source → **QUARANTINE** it: do not write it; add it to the film's `n_quarantined` count.

5. **GEOCODE** — assign `lat`/`lng` from your geographic knowledge and set `precision`:
   exact point of a famous landmark/building → `exact` or `venue`; town/city → city centre,
   `city`; neighbourhood → `area`; province/state → `region`; nation centroid → `country`.
   **If you are not reasonably confident of the coordinates, drop the location.** `country` =
   the country the coordinates fall in.

6. **SELF-CHECK then WRITE** (§5 self-check list, then §5 SQL). Always upsert the
   `geo_filmed_progress` row, even for `n_places=0`.

**Disposition table:**

| condition | tier | publish? |
|---|---|---|
| ≥2 independent sources agree | `verified` | yes (conf 0.85) |
| one **A** source + plausible | `probable` | yes (conf 0.65) |
| only **B/C** source | `weak` | yes, `tier='weak'` (conf 0.45) |
| confirmed studio/backlot/CGI | `verified` or `probable` | yes, `built_set=true` + `set_host` |
| only an **X** (protected DB) source | — | **NO — quarantine, count in `n_quarantined`** |
| you cannot confidently geocode it | — | no (drop) |

---

## 4. Legal guardrails (keep ON — non-negotiable)

Facts (where a film was shot) are not copyrightable, but *expression* is. So:
- **Rephrase everything.** Never copy a sentence or description from any source. `scene_role`
  and `narrative_setting` are always your own short wording.
- **Prefer ≥2 independent domains** per location — this breaks any "derived from one database" claim.
- **`sources` stores independent domains ONLY.** Never store a protected-DB URL
  (`movie-locations.com`, `atlasofwonders.com`) in `sources`, **even as one of several**.
  Use those sites only privately to cross-check. *(Pilot finding: a few agents stored them and
  they had to be stripped afterward — don't store them in the first place.)*
- **Quarantine** any location whose only support is a protected DB (count in `n_quarantined`,
  do not publish).
- **No images, no verbatim copy, ever.**

---

## 5. Exact write + self-check (per film)

**Self-check before writing each film** (silently confirm all true; fix or drop otherwise):
- [ ] Every row is `layer='filmed'`, `source='agent-filmed'`.
- [ ] `film_id` is the film uuid (not a figure id).
- [ ] `scene_role` / `narrative_setting` are your own words (no copied sentences).
- [ ] `sources` is a non-empty array of **independent** URLs (no movie-locations.com / atlasofwonders.com).
- [ ] `tier` ∈ {verified, probable, weak} and matches the disposition table; `confidence` matches the tier.
- [ ] `lat` ∈ [−90, 90], `lng` ∈ [−180, 180]; `precision` and `country` are consistent with the coords.
- [ ] `built_set=true` rows have a `set_host`; visitable real places have `built_set=false`.

**SQL:**
```sql
insert into film_locations
  (film_id, layer, name, narrative_setting, scene_role, kind, built_set, set_host,
   lat, lng, precision, country, tier, sources, source, confidence)
values
  ('<film_id>','filmed','<real place>','<in-film place>','<your short role>','<kind>',<bool>,<'<studio>' or null>,
   <lat>,<lng>,'<precision>','<country>','<tier>','["https://…","https://…"]'::jsonb,'agent-filmed',<conf>)
  -- , …one tuple per published location for THIS film…
on conflict (film_id, layer, name) do nothing;

insert into geo_filmed_progress (film_id, n_places, n_quarantined, status, agent)
values ('<film_id>', <published_count>, <quarantined_count>, 'done', '<your-agent-id>')
on conflict (film_id) do update set
  n_places=excluded.n_places, n_quarantined=excluded.n_quarantined,
  status=excluded.status, agent=excluded.agent, processed_at=now();
```
Double any apostrophes in text (`O''Hare`). On an unrecoverable error for a film, write its
`geo_filmed_progress` with `status='error'` and a short `note`, then continue.

---

## 6. Direct-to-Supabase + monitoring (decision: write directly — yes)

Write directly. It is idempotent (`geo_filmed_progress` guard + `ON CONFLICT`), fills the live
Atlas immediately, and is monitorable. The orchestrator (and the human operator) watch with:
```sql
select geo_progress_stats();
-- filmed_films_processed climbs from 30 toward ~1,935; watch filmed_films_errored stays 0.
-- also returns filmed_pins, filmed_quarantined.
```
Quality spot-check any time (the orchestrator should eyeball ~10 rows per wave):
```sql
select fm.title, l.name, l.tier, l.built_set, l.sources, l.lat, l.lng
from film_locations l join films fm on fm.id = l.film_id
where l.layer='filmed' and l.source='agent-filmed'
order by l.created_at desc limit 20;
```
Red flags to catch: any `sources` containing `movie-locations.com`/`atlasofwonders.com`;
empty `sources`; coords obviously off (sea, wrong continent); a film with implausibly many
rows. If found, fix those rows and tighten the subagent prompt for the next wave.

---

## 7. WORKED EXAMPLE (follow this shape exactly)

These are **real published pilot rows** — reproduce this style and rigor.

**Example A — The Dark Knight (2008), Nolan** → searches surfaced wikipedia + imdb +
legendarytrips (all independent). Published 7 rows; here are three:

| name | narrative_setting | scene_role | kind | built_set | tier | sources |
|---|---|---|---|---|---|---|
| Old Chicago Main Post Office, Chicago, Illinois | Gotham National Bank | Opening heist where the Joker's masked crew robs a mob-controlled bank | venue | false | verified | wikipedia + imdb + legendarytrips |
| Battersea Power Station, London, England | Gotham warehouse / chemical plant | Explosion sequence at a riverside industrial building (a false explosive-lined wall was built to protect the listed structure) | venue | false | verified | wikipedia + legendarytrips |
| Two International Finance Centre, Hong Kong | Lau's skyscraper | Building from which Batman extracts the financier Lau and base-jumps | venue | false | verified | wikipedia + legendarytrips |

```sql
insert into film_locations
  (film_id, layer, name, narrative_setting, scene_role, kind, built_set, set_host,
   lat, lng, precision, country, tier, sources, source, confidence)
values
  ('<dark_knight_id>','filmed','Old Chicago Main Post Office, Chicago, Illinois','Gotham National Bank',
   'Opening heist where the Joker''s masked crew robs a mob-controlled bank','venue',false,null,
   41.8757,-87.6396,'venue','United States','verified',
   '["https://en.wikipedia.org/wiki/The_Dark_Knight","https://www.imdb.com/title/tt0468569/locations/"]'::jsonb,
   'agent-filmed',0.85)
on conflict (film_id, layer, name) do nothing;
```

**Example B — a built set** (The Shawshank Redemption): the prison cellblock *interior* was a
full-scale replica built in a former Westinghouse warehouse in Mansfield, Ohio →
`name='Former Westinghouse warehouse, Mansfield, Ohio'`, `narrative_setting='Shawshank
cellblock interior'`, `kind='studio'`, `built_set=true`,
`set_host='Westinghouse warehouse (production-built set)'`, `tier='verified'`.

**Example C — a quarantine**: if the *only* place that mentions some alley scene is
movie-locations.com, **do not write it** — increment `n_quarantined` and move on. (The pilot
quarantined 6 such finds across 30 films.)

**Example D — zero places**: a fully studio-bound or fictional/animated film with no
documented real locations → write nothing to `film_locations`, just
`geo_filmed_progress(n_places=0, n_quarantined=0, status='done')`.

---

## 8. Done / verification checklist

- `select geo_progress_stats();` → `filmed_films_processed` ≈ `films_total` (~1,935);
  `filmed_films_errored` ≈ 0.
- No published `filmed` row has `sources` containing `movie-locations.com` or
  `atlasofwonders.com`; none has empty `sources`.
- No row has `lat` outside [−90,90] or `lng` outside [−180,180].
- Spot-check 20 random filmed pins against their cited sources for plausibility.
- Report the final `geo_progress_stats()` to the operator. The live Atlas (`/atlas` with the
  "Filmed at" toggle, and each film's & director's "Atlas" tab) reflects everything
  automatically — no deploy or import step needed.
