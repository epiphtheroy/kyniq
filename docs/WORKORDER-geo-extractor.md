# WORK ORDER — Geographic Atlas extractor (run on the full film corpus)

**For:** the AI/agent that will fill Metatake's geographic **Atlas** with location pins.
**Outcome:** every film's real-world places (the places it is *set in* / *names*) become map pins, written **directly to Supabase**, so the live `/atlas`, film "Atlas" tab, and director "Atlas" tab fill automatically.
**Do exactly what this says.** Accuracy over coverage. Never invent coordinates.

---

## 0. TL;DR

For each remaining film: read its in-world **location figures** + **overview** + a few **takes** → decide which correspond to a **real, mappable place** → assign **lat/lng from your own geographic knowledge** → INSERT into `film_locations` → record the film in `geo_progress`. Run **~12 agents in parallel**, each owning a hash partition, fully resumable. Write directly to Supabase with `ON CONFLICT DO NOTHING`.

~1,431 films remain (469 are already seeded and pre-marked in `geo_progress`, so you will skip them). Expect roughly 25–35% of films to yield ≥1 real place; the rest are fictional/interior-only — that's expected.

---

## 1. Database (Supabase)

- Project ref: `jvgarcqrtsmgfimdcwgo` · REST base: `https://jvgarcqrtsmgfimdcwgo.supabase.co/rest/v1`
- Access: use whatever Supabase access you have — the **Supabase MCP `execute_sql`** (project_id `jvgarcqrtsmgfimdcwgo`), **PostgREST with the `service_role` key** (the operator will give it to you; send headers `apikey` + `Authorization: Bearer <key>`), or a direct `psql` connection. The tables below have **RLS on with no public policy**, so you MUST use the service role / MCP (not the anon key).

**Write target — `film_locations`:**
| column | value |
|---|---|
| `film_id` | uuid of the film (from the read query) |
| `layer` | `'setting'` |
| `name` | the **real place** ("Sacré-Cœur, Paris", "Devils Tower, Wyoming", "Nova Scotia") |
| `narrative_setting` | the in-film figure label/role (or how it appears in the film) |
| `kind` | one of `city｜region｜country｜landmark｜venue｜area` |
| `lat`,`lng` | decimal degrees (your knowledge) |
| `precision` | `exact｜venue｜city｜area｜region｜country` |
| `country` | plain English country name |
| `figure_id` | the location figure's uuid if the place came from a figure, else `null` |
| `source` | `'agent'` |
| `confidence` | `0.6` (use `0.5` for region-level guesses) |

Unique key: `(film_id, layer, name)` → always insert with **`ON CONFLICT (film_id, layer, name) DO NOTHING`**.

**Progress/resume — `geo_progress`:** upsert ONE row per film after processing it (even if it produced 0 places):
`film_id` (PK), `n_places` (int), `status` (`'done'` or `'error'`), `agent` (your id, e.g. `'gpt5-geo-3'`), `note` (optional), `processed_at` (default now). Upsert with `ON CONFLICT (film_id) DO UPDATE`.

---

## 2. Parallelism — 12 agents, stable hash partitions (resumable)

Launch **12 parallel workers** (or 8–16; pick N and keep it fixed for the run). Worker *K* (0…N-1) owns the films whose id hashes to K. This needs no offsets, never double-processes, and any worker can be restarted safely (it skips films already in `geo_progress`).

**Each worker's read query** (substitute N and K):
```sql
select f.id as film_id, f.slug, f.title, f.year, f.director, f.overview
from films f
where f.visible
  and (abs(hashtext(f.id::text)) % 12) = K          -- K = this worker's index (0..11)
  and not exists (select 1 from geo_progress gp where gp.film_id = f.id)
order by f.id;
```
Process that list one film at a time (you may also thread within a worker). After each film, write its `geo_progress` row so a restart resumes mid-partition.

**Per film, also fetch its inputs:**
```sql
-- location figures (the in-world places)
select id as figure_id, label, description
from figures
where film_id = '<film_id>' and kind='location' and status='approved';

-- a few critical takes for extra geographic hints (optional, helps recall)
select take_title, leap from takes
where status='published' and figure_id in (<those figure ids>) limit 6;
```
A film may have **zero** location figures — still check the overview for a named real setting; if none, record `geo_progress` with `n_places=0` and move on.

---

## 3. Extraction rules (the judgment — follow precisely)

For each candidate place from {figure label+description, overview, takes}:

**SKIP** (no pin):
- Fictional / invented places: planets, realms, invented towns/cities (Exegol, Cloud City, Wakanda, Rock Ridge, Gotham, Arendelle, Itomori…).
- Generic interiors / sets with no real geography: a kitchen, a courtroom or Senate set, an office, a prison block, "the red interiors", a spaceship.
- Pure abstractions ("the threshold", "limbo"), or anything you **cannot confidently place**.

**ACCEPT** (make a pin) only for a **real, locatable** place: a real city, region, country, landmark, natural feature, or neighborhood. **Read the description** — the real place is often named there even when the label is descriptive (e.g. "The 222 steps of Sacré-Cœur" → Sacré-Cœur, Paris; "Devils Tower" (descr: Wyoming) → Devils Tower, Wyoming; "The Hong Kong hotel room" → Hong Kong; "The abandoned house in Jeongneung" → Jeongneung, Seoul).

One pin per real place (a film usually yields 0–4). The same city across different films is fine (the unique key is per-film).

---

## 4. Geocoding (inline, from your knowledge)

For each ACCEPTED place, assign coordinates **from your own geographic knowledge** (this is how the existing 489 pins were made):
- Famous landmark/building → its exact point, `precision='exact'` or `'venue'`.
- Town/city → city center, `precision='city'`.
- Neighborhood → `'area'`; province/state → `'region'`; nation → `'country'`.
- **If you are not reasonably confident of the coordinates, SKIP the place** — do not guess wildly. Region/country centroids are acceptable when that's the real granularity.
- `country` = the country the coordinates fall in.

(Optional precision upgrade, later, by the operator: a Google Geocoding pass via `worker/geo-code.py` will refine these — you do **not** need a geocoding API; knowledge-based coords are the deliverable.)

---

## 5. Exact write (per film)

```sql
-- 1) the pins (batch all of one film's accepted places in one statement)
insert into film_locations
  (film_id, layer, name, narrative_setting, scene_role, kind, lat, lng, precision, country, figure_id, source, confidence)
values
  ('<film_id>','setting','<real place>','<figure label / in-film role>',null,'<kind>',<lat>,<lng>,'<precision>','<country>',<'<figure_id>' or null>,'agent',0.6)
  -- , …more places for this film…
on conflict (film_id, layer, name) do nothing;

-- 2) mark the film processed (always, even with 0 places)
insert into geo_progress (film_id, n_places, status, agent)
values ('<film_id>', <count>, 'done', '<your-agent-id>')
on conflict (film_id) do update set n_places=excluded.n_places, status=excluded.status, agent=excluded.agent, processed_at=now();
```
Escape apostrophes in text by doubling them (`O''Hare`). Put the real uuids in the right slots — **`film_id` is the film, `figure_id` is the figure; never swap them** (a swap trips the foreign key).

---

## 6. Why write directly to Supabase (decision)

**Yes — write directly.** It is safe and preferred here because: (a) it's **idempotent** — `geo_progress` skips done films and `ON CONFLICT DO NOTHING` prevents duplicate pins, so restarts/parallel workers can't corrupt data; (b) the map **fills live** as you go (no import step); (c) it's **monitorable** in real time (below). Do **not** drop/alter/delete any table or any other film's rows. Only INSERT into `film_locations` and UPSERT into `geo_progress`.

---

## 7. Monitoring (so the operator/Claude can watch)

Anyone can watch progress live with one call (read-only, safe):
```sql
select geo_progress_stats();
-- → { films_total, films_with_loc_figs, films_processed, films_errored,
--     pins_total, pins_with_coords, films_with_pins, geo_cache_rows, last_processed_at }
```
`films_processed` should climb from 469 toward ~1,900. Watch `films_errored` stays ~0. Claude will poll `geo_progress_stats()` periodically and flag anomalies (e.g., a worker stalling, error spikes, or implausible coords).

Spot-check quality any time:
```sql
select fm.title, l.name, l.precision, l.lat, l.lng
from film_locations l join films fm on fm.id=l.film_id
where l.source='agent' order by l.created_at desc limit 30;
```

---

## 8. Done / verification checklist

- `films_processed` ≈ all visible films with content (the rest legitimately have no real places).
- `pins_with_coords` = `pins_total` (no null coords from this run).
- No row has `lat` outside −90..90 or `lng` outside −180..180.
- `figure_id` (when set) belongs to that `film_id`.
- Spot-check 20 random pins for plausible coordinates.

When done, tell the operator the final `geo_progress_stats()`. The live Atlas (`/atlas`, film & director "Atlas" tabs) will already reflect everything.
