# Metatake — BIG-BANG RUNBOOK (+405 films)

*Authoritative, mistake-proof procedure for adding the films in `metatake_films_expansion_405.csv` and running the full data pipeline. Written 2026-06-17 from a live inventory of the workers, the docs, and the database. Follow top to bottom. Do the DRY version of every writer first.*

Live DB: **`jvgarcqrtsmgfimdcwgo`** (verified). Workers' `worker/.env.local` `NEXT_PUBLIC_SUPABASE_URL` already points here — so the batch writes to the live site's DB. Current state (verified 2026-06-17): **films 565 · figures 4,626 · takes 18,004 · published readings 274 · published tropes 439 · candidate meta-takes 3,868 · figure_tags 12,898 · theory_canon 2,587.**

---

## §0 — DECIDE THESE THREE THINGS BEFORE YOU START

These are real blockers found in the inventory. The pipeline below assumes they're resolved.

### 🔴 A. How do the 405 new films get their FIGURES and TAKES?
`metatake_films_expansion_405.csv` has only `Film_TMDB_ID, Film_Title, Film_Director_Name` — and **`Film_TMDB_ID` is empty for all 405 rows.** The original 567 films were loaded *with* their figures+takes from a pre-made CSV (`data/seed/metatake_figures_takes_4662.csv`) via `mt-import.py`. **There is no script today that creates figures/takes for a brand-new film.** Key facts:
- `tmdb-fetch.py` only touches films where `tmdb_id IS NOT NULL` → does nothing for these until tmdb_ids exist.
- `figure-enrich.py` only ENRICHES films that **already have figures** (`figures!inner`, status=approved) — it adds takes to reach ≥3 registers; it does **not** create the figures. A brand-new film with no figures is invisible to it.

**Two options — pick one (this sets Step 1):**
- **Option 1 — supply a figures/takes CSV** for the 405 (same shape as `metatake_figures_takes_4662.csv`), produced offline like the original. Then we load it with a small generalization of `mt-import.py` (its seed path is currently hard-coded). Lowest new code; depends on you having/producing the CSV.
- **Option 2 — build two new workers** (recommended for a self-contained pipeline): `tmdb-resolve.py` (search TMDB by title+director → fill `Film_TMDB_ID` + insert bare `films` rows) and `film-extract.py` (one LLM call per film → generate its figures + seed takes, the raw material `figure-enrich` then enriches). I will write + DRY-test both before the run.

→ **Tell me which option.** Until this is decided, the run cannot begin.

### 🟠 B. Migration drift — repo has SQL through `0025`, live DB has `0048`.
Every pipeline RPC/table (`bulk_set_embeddings`, `hub_dup_pairs`, `hubs_to_author`, `tag_sim_pairs`, `figure_tags`, `figure_type_members`, `theory_canon`, tradition columns, `ask_retrieve`, `home_*`, the graph seeds) lives **only in the live DB**, not in committed `.sql`. The big-bang re-run targets the *existing* live DB, so it works — but source control can't rebuild it. **Recommended insurance before the run:** dump the live functions/migrations into `supabase/migrations/` (I can generate these). Not strictly required to run; required for disaster recovery.

### 🟠 C. The theory "tradition backfill" (theory-match) has no script.
`theory-import.py` loads the canon, then prints "tell Claude to run the tradition backfill." That backfill (match each reading's `raw_concept`/embedding → nearest canon → set tradition/theory family + flag misattribution) was done once via ad-hoc SQL (migrations 0038/0039). For the +405 run it must be re-applied to the new readings. **I will either write `theory-match.py` or provide the exact SQL** as Step 13.

---

## §1 — PRE-FLIGHT CHECKLIST (do all, in order)

1. **Keys present** in `worker/.env.local` (names only): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `TMDB_READ_TOKEN`. (The batch LLM steps default to **Claude Opus 4.8** → need `ANTHROPIC_API_KEY`; embeddings → `OPENAI_API_KEY`.)
2. **Snapshot the DB** (Supabase dashboard → Database → Backups, or a manual export). Non-negotiable before a 405-film write.
3. **Record the start timestamp** (UTC) — the rollback recipe keys off it:
   `select now();`  → write it down.
4. **Record baseline counts** (compare after each step):
   `select (select count(*) from films) f,(select count(*) from figures) fg,(select count(*) from takes) t,(select count(*) from meta_takes where status='published' and kind='reading') r,(select count(*) from meta_takes where status='published' and kind='figure_type') tr;`
5. **Confirm worker DB target** = `https://jvgarcqrtsmgfimdcwgo.supabase.co` (already verified, but re-check you didn't switch envs).
6. **Decide §0.A** and have its inputs ready (CSV, or the two new scripts DRY-tested).

---

## §2 — SAFETY RULES (absolute)

1. **DRY first, always.** Every writer defaults to DRY; run the `*-dry.command`, eyeball the bundle, *then* `--persist`.
2. **Stage small first.** Before the full 405, run one stage with `--limit 5` (or a few `--film` slugs) → verify in DB → then full.
3. **One step at a time.** Every step is idempotent or resumable; if a step fails, fix and re-run just that step.
4. **Verify after every step** with the gate SQL in §4. Counts must move the way you expect.
5. **Rollback recipe** (AI takes from this batch):
   `delete from takes where source='ai' and register is not null and created_at > '<start ts>';`
   New figures/films/meta_takes from the batch can be removed by `created_at > '<start ts>'` filters too — but prefer restoring the snapshot for a clean rollback.
6. **Destructive rebuilds run LAST + verify counts after:** `mt-rank` deletes ALL rankings, `mt-recommend` deletes ALL affinities, `theory-import` deletes ALL canon, `trope-build --reset` deletes ALL trope hubs+members. If one fails mid-write the table is briefly empty until the re-run completes.

---

## §3 — THE PIPELINE (exact order)

> Models are pinned: Opus = `claude-opus-4-8` (max_tokens set, **temperature deliberately omitted — Opus 4.8 rejects it**); Gemini = `gemini-3.1-pro-preview`; embeddings = OpenAI `text-embedding-3-small` (1536-dim); Ask answering = `gpt-4o-mini`. If a model string is retired, every LLM worker breaks at once — change it at the `--model` flag.

**Step 1 — Load the 405 films (per §0.A decision).**
- *Option 1:* generalize `mt-import.py` to read the new figures/takes CSV → DRY → `--persist` (staged 5 first).
- *Option 2:* `tmdb-resolve.py` (fill tmdb_id + insert films) → `film-extract.py --persist` (figures + seed takes).
- **Verify:** `select count(*) from films;` rose by ~405; `select count(*) from figures fg join films fl on fl.id=fg.film_id where fl.created_at > '<ts>';` > 0.

**Step 2 — TMDB metadata + media.** `worker/run-tmdb-fetch-all.command` (persists all; idempotent; needs tmdb_id).
- **Verify:** new films have `overview`/`genres`/`backdrop_path`; `select count(*) from films where genres is null or array_length(genres,1) is null;` → 0.

**Step 3 — figure-enrich (takes generator).** DRY `run-figure-enrich-dry.command` first; full `run-figure-enrich-all.command` (`--model claude-opus-4-8 --persist`). Idempotent (`need_enrich` skips figures already ≥3 registers). If it prints `⚠ slug: X/Y figures matched`, **re-run once** to fill the rest (chunking + label-fallback fix).
- **Verify:** `select count(*) from takes where source='ai' and created_at > '<ts>';` > 0; spot-check a new film page has ≥3 takes/figure.

**Step 4 — Embeddings.** `run-mt-embed.command` (null-only; retries on transient errors). Must precede consolidate/rank/Ask.
- **Verify:** `select count(*) from takes where status='published' and embedding is null;` → 0.

**Step 5 — Consolidate v2.** DRY `run-mt-consolidate-dry.command`; then `run-mt-consolidate.command` (`--persist`, cap 70, thresh 0.86, gate 5). Dedups hubs + splits oversized. Re-runnable.
- **Verify:** no hub > ~70 figures; dedup/split summary printed; candidates count changed sensibly.

**Step 6 — Author.** `run-mt-finish.command` runs author→rank→recommend; OR author alone. Author publishes ≥5-film candidate hubs (Opus). Re-runnable (un-authored only).
- **Verify:** `select count(*) from meta_takes where status='published' and kind='reading';` rose.

**Step 7 — Rank** (inside run-mt-finish). Deletes+rebuilds `meta_take_rankings`.
- **Verify:** `select count(*) from meta_take_rankings;` > 0.

**Step 8 — Recommend** (inside run-mt-finish). Deletes+rebuilds `film_affinities`.
- **Verify:** `select count(*) from film_affinities;` > 0.

**Step 9 — Retitle split families (only if splits made same-named siblings).** DRY `run-mt-retitle-dry.command`; then `run-mt-retitle.command` (`--persist --essays`). Idempotent.
- **Verify:** `select title, count(*) from meta_takes where status='published' and kind='reading' group by title having count(*)>1;` → no unintended dups.

**Step 10 — trope-tag (stage 1).** DRY `run-trope-tag-dry.command`; full `run-trope-tag.command` (`--persist`). Figures identified by **integer index, not UUID**. Idempotent (untagged only). Max 3 tags/figure, 1 call/film.
- **Verify:** `select count(*) from figure_tags;` rose.

**Step 11 — trope-build (stage 2).** DRY `run-trope-build-dry.command`; then `run-trope-build.command` (`--persist --reset`). ⚠ `--reset` wipes ALL figure_type hubs+members and rebuilds. **Note the gate:** script default `--gate 3` (the dry `.command` comment says "≥5" but the code default is 3 — pass `--gate` explicitly to the value you want, e.g. `--gate 3` to match the current live policy). Clusters tags (thresh 0.75, k 3, maxtags 50), names with Opus.
- **Verify:** `select count(*) from meta_takes where status='published' and kind='figure_type';` sensible; `select count(*) from figure_type_members;` > 0.

**Step 12 — theory-import.** `run-theory-import.command` (clean reload of `theory_canon`; idempotent).
- **Verify:** `select count(*) from theory_canon;` ≈ 2,587.

**Step 13 — theory-match / tradition backfill (per §0.C).** Apply the theorist-anchored + title-similarity match to set `meta_takes.tradition`/theory family on the NEW readings (script or SQL — to be provided). 
- **Verify:** `select count(*) filter (where tradition is not null), count(*) from meta_takes where status='published' and kind='reading';`

**Step 14 — Mandatory data-integrity post-steps** (the regressions §8 of MASTER was written to prevent):
- Figure slug backfill (SQL in `MASTER.md §8.1`): `select count(*) from figures where slug is null;` → must be 0.
- `run-tmdb-fetch-all.command` already covered genres/overview in Step 2 — re-confirm 0 null genres.

**Step 15 — Final verification + deploy.** Run the §4 gates; spot-check 3 new film pages, 3 new readings, 3 new tropes, the homepage random wall, /ask. Then deploy (push) — production is already launched (`SITE_INDEXABLE=true`), so a normal deploy + later submit the refreshed sitemap in Search Console.

---

## §4 — VERIFICATION GATES (run after the relevant step; all should pass)

```sql
-- integrity
select count(*) from figures where slug is null;                              -- expect 0
select count(*) from films where genres is null or array_length(genres,1) is null; -- expect 0
select count(*) from takes where status='published' and embedding is null;    -- expect 0
-- growth (compare to baseline §1.4)
select (select count(*) from films) films,
       (select count(*) from figures) figures,
       (select count(*) from takes) takes,
       (select count(*) from meta_takes where status='published' and kind='reading') readings,
       (select count(*) from meta_takes where status='published' and kind='figure_type') tropes;
-- no empty published hubs (would render thin)
select count(*) from meta_takes m where m.status='published' and m.kind='reading'
  and not exists (select 1 from takes t where t.meta_take_id=m.id);            -- expect 0
select count(*) from meta_takes m where m.status='published' and m.kind='figure_type'
  and not exists (select 1 from figure_type_members fm where fm.meta_take_id=m.id); -- expect 0
```

---

## §5 — COST / TIME (≈, for ~405 films at 3 takes/figure)

- figure-enrich (Opus, 1 call/film, chunked): the dominant cost — budget on the order of tens of dollars (KEPT §G baseline: ~$60–130 for 1,000 films at standard rates; ~half that for 405). Consider OpenAI/Anthropic batch (50% off) overnight.
- mt-author (Opus, ~few hundred new hubs): ~$3–6.
- embeddings (3-small): <$1.
- trope-tag (Opus, 1 call/film): ~$3–5.
- consolidate / rank / recommend: local compute, ~$0.
- **Rule of thumb: incremental ≈ $0.10–0.15 per film.**

---

## §6 — GOTCHAS INDEX (learned the hard way; don't relearn them)

- **Opus rejects `temperature`** — workers omit it; keep it omitted.
- **LLMs mangle long UUIDs** → figure-enrich + trope-tag identify figures by **integer index / echoed id with label fallback**, never raw UUID round-trip. Don't "simplify" this.
- **8s statement_timeout** on PostgREST RPCs → heavy ANN/cluster queries are **chunked** (`tag_sim_pairs` 1000/chunk; volatile fns `set local statement_timeout`). Don't un-chunk.
- **hnsw index builds time out via the API** → use **ivfflat** (fast build) for big vector tables, or build hnsw from a worker/dashboard with raised timeout. `takes.embedding` has ivfflat (0044).
- **Bulk-insert vectors BEFORE building the index**; building an index then inserting times out.
- **figure-enrich 16K output truncation** → CHUNK=6 figures/call (already applied). Watch trope-build naming batches on huge clusters.
- **Hub-list prompt injection** in figure-enrich injects the published-hub list (~274 now) — fine under ~1–2K; if published readings ever exceed that, switch to top-K-by-embedding injection (KEPT §G).
- **Destructive rebuilds** (rank/recommend/theory-import/trope-build --reset) — run last, verify counts after.
- **Retry set** in newer workers: transient 5xx `{500,502,503,504,520–525,529}` + `URLError`/`OSError`. Keep it.
- **Never write API keys into files** — set them in `worker/.env.local` (local) and Vercel env (prod, e.g. `OPENAI_API_KEY` for /api/ask).

---

## §7 — ROLLBACK

1. Best: **restore the pre-run snapshot** (§1.2).
2. Surgical (AI takes only): `delete from takes where source='ai' and register is not null and created_at > '<start ts>';`
3. New trope hubs from a bad run: `run-trope-build.command --reset` rebuilds cleanly from `figure_tags`.
4. Rankings/affinities/canon: just re-run their step (each is a full rebuild).
