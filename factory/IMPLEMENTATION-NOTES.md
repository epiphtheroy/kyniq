# 영화공장 — IMPLEMENTATION NOTES for `factory.py run` (the automated executor)

> ## ✅ BUILT 2026-07-12 — `worker/factory.py run` now implements everything below.
> Dry-run verified end-to-end against the pig film's run #3 (47 stages plan + substitute + verify-bar
> report). Pieces shipped this session:
> - **`factory.py run`** — full executor: manifest-driven stage loop, per-runner-type dispatch
>   (internal/shell/shell_seq/worker_batch/worker_batch_chain/sql_file→RPC/rpc/rpc_loop/http/
>   shell_node/shell_conditional/shell_then_rpc), **ledger** (`factory.stage_runs` status+cost+verify),
>   **verify gate at completion**, **failure_policy** (abort_run/park/retry), **cost gate** (>$50→--yes),
>   **W0 resolve + exists-stub promotion** (fills intake.film_id, flags `source='promotion'`),
>   **batch-vs-sync** (submit→poll-fetch loop), **parallelism** (per-film HTTP fan-out pool of 6;
>   batch-combine + corpus-once inherent), **`--dry-run` / --from / --only / --films / --with-corpus**,
>   and a per-film **quality-bar report** → `runs.report_md` + `factory/logs/run-N.md`.
> - **`factory.py queue`** + **`factory_queue_run()` RPC** (mig 0084) + **`/admin/factory` "▶ Queue a run"
>   button** — status-only trigger; the Mac watcher executes (plane separation preserved).
> - **`worker/factory-watch.sh`** — polls `factory.runs` for `status='queued'` (mig 0083 added the status),
>   claims (queued→running), runs the executor. This is the "put it in admin → it runs" enabler.
> - **Zero Claude tokens**: the executor is plain Python; only the worker scripts spend, on their own keys.
> The sections below are the design record the build followed (kept for the next coder / Sentinel).

**Purpose.** The pilot (2026-07-12) was driven **by hand** through `factory/RUN-PLAYBOOK.md` and
worked (3 films → live Tier-1). This file records what the *automated* executor must do so a future
coder can build `factory.py run` — so pasting **dozens of films at once** runs them **in parallel** at
the same quality, with no babysitting. Written while observing real runs; append lessons as they land.

---

## A. The two entry stages the owner flagged as essential (get these right first)

### A1 · RESOLVE (title → the right film) — the single highest-leverage step
A wrong resolve attaches the ENTIRE downstream graph (figures, takes, tropes, connections, TakeScore,
sentences) to the wrong film. It is the one step that must never "guess silently." `tmdb-resolve.py`
already returns a **confidence** (`high | medium | low | given`) and a **status**, and the executor must
branch on BOTH:

| status | confidence | executor action |
|---|---|---|
| `new` | high / given | auto-approve → create film → proceed |
| `new` | medium | proceed but **flag for a quick human glance** (usually a title/year match without a director confirm) |
| `new` | low | **R1 REVIEW GATE** — do NOT ingest; queue to `factory.intake status='review'`, surface in `/admin/factory`, wait for owner approve/reject |
| `unmatched` | — | R1 review (bad title, ambiguous, non-film) |
| **`exists`** | any | ⚠️ **the film already exists** — do NOT create a duplicate. See A3 (promotion). |

**Coder requirements:**
1. Resolve must be **batchable**: feed the whole titles list into one `tmdb-resolve` invocation, parse
   the OUT csv, and fan the per-film decisions out. Don't loop one title at a time.
2. Capture `confidence`, `status`, `note`, and the resolved `tmdb_id`/`film_id` back into `factory.intake`
   (the executor's memory), keyed to the intake row. The playbook does this by hand today.
3. The R1 gate is a **pause point** — a bulk run of 50 films may have 3 low-confidence ones; the run should
   process the 47 clear ones and *hold* the 3 for review, not block the whole batch.
4. ⚠️ Never let a low/unmatched row slip through silently — that is the documented #1 corruption source.

### A2 · TIER (full vs catalog) — decides the whole cost + surface envelope
Tier is not cosmetic — it selects which stages run and what the film becomes:
- **full** → the whole W1–W4 chain (figures, misreadings, TakeScore, TV, ~$1/film), opens a Tier-1
  indexable page.
- **catalog** → W0 + TakeScore(optional) + curation + a Tier-2 noindex digest record (~$0).
- **auto** → **currently banned** (owner decision #1): downgrade to catalog + review. When re-enabled,
  the rule is data-driven (e.g. lineage-attached OR IMDb-votes ≥ threshold → full).

**Coder requirements:** tier is resolved at intake and **frozen for the run** (it changes the stage set,
so it can't flip mid-flight). A bulk paste of mixed titles must let the owner set tier per-row or per-run,
default `full` unless a promotion policy says otherwise. Cost-estimate + the $50 gate keys off the tier
mix (full films dominate cost).

### A3 · ⚠️ The EXISTS-STUB case (observed live 2026-07-12 on *The Day a Pig Fell Into the Well* 1997)
A big fraction of "new" titles are **already in the DB as `hold=true`, `is_analyzed=false` Tier-2 stubs**
(created by the 06-25 catalogue/lineage seed — 4,760 hold stubs exist). Resolve returns `status='exists'`.
The executor must have a distinct **PROMOTION path** for these, NOT create-new:
1. **Clear `hold` FIRST.** The visible trigger is `(approved figures ≥ 3) AND NOT hold` — if `hold` stays
   true, the film never opens even after extract gives it 9 figures. This bit the pilot's mental model and
   is the top thing the playbook under-specifies.
2. Then run the *content* stages (extract → boldtake → embed → trope → …) exactly like a new film — the
   `films` row already exists, so skip resolve-create + (if metadata present) skip tmdb-fetch, but DO
   verify genres/overview/poster are present (old stubs sometimes have them, sometimes not).
3. Old stubs may carry **stale partial data** (e.g. the pig film already has 29 `film_sentences` + a
   TakeScore but 0 figures/takes). The executor should treat pre-existing sentences/scores as safe to
   keep (idempotent) but must still generate the missing figures/takes and then **re-run S28 sentences**
   so the connection sentences (A/B/C/G/I — which need takes) get added on top of the old D/E ones.
4. End with `factory_analyzed_flip` (is_analyzed=true + hold clear + visible recompute) like any full film.

**→ Add an `intake.kind` of `promote` vs `new` so the executor picks the path. This is a real gap the
playbook only hints at.**

---

## B. PARALLELISM — the model for "dozens at once" (owner's explicit requirement)

The unit of parallelism is the **film** for per-film stages, and the **batch** for LLM stages. The
executor is a staged pipeline with barriers, not a per-film sequential loop.

### B1 · Stage classes decide how they parallelize
- **PER-FILM, independent** (resolve, tmdb-fetch, external, geo, trope-tag, reception): fan out with a
  **bounded worker pool** (6–8 concurrent — the workers already thread internally; the cap protects TMDB/
  OMDb/Brave rate limits). Each film flows through these independently.
- **PER-FILM, but LLM → COMBINE INTO ONE BATCH** (extract, boldtake, asset, next, catalog-map, takescore):
  do NOT run per-film sync when N is large. Emit ONE Batch-API request set across ALL the run's films per
  stage (the 50% discount + throughput; RUNBOOK §6.E). For **N ≤ ~50** the pilot used SYNC per-film (fine,
  simpler); for **N > 50** switch to Batch (submit once, poll, fetch, load). The executor should pick
  sync-vs-batch off N automatically.
- **CORPUS-WIDE, run ONCE after a barrier** (embed, affinities/mt-recommend, counterpoints, sentence
  node/concept stats): these re-touch the whole graph. Run them a **single time after all films' content
  has landed**, never per-film. embed is null-only (safe); affinities/counterpoints are atomic swaps.
- **PER-DIRECTOR, dedup across the batch** (W2b): dozens of films may share directors, and many share none.
  Collect the **distinct new directors** across the whole run, then process each unique director once
  (facts sync + profile batch). Don't regenerate a director per film.

### B2 · The barrier graph (what must finish before what)
```
[W0 resolve+tmdb-fetch+external]  — per-film pool, all films
        ↓ (barrier: every film has ≥ metadata + a films.id)
[W1 content]  — extract → boldtake (per-film order!) → trope-tag → catalog → asset → next → geo
        ↓ one combined BATCH per stage across all films; boldtake AFTER extract PER FILM
        ↓ (barrier: all films have figures+takes)
[S20 embed]   — corpus null-only, ONCE
        ↓
[W2 vectors]  — taste(per-film RPC) → trope-incr(per-film) → affinities(ONCE) → counterpoints(ONCE)
        ↓                                                     → sentences: stats ONCE, patterns per-film
[W2b directors] — distinct new directors, once each (can run parallel to W2)
        ↓
[W3] — analyzed-flip(per-film) → takescore(batch) → curation(per-film) → tv(per-film)
        ↓
[W4] — lastmod+revalidate(per-film) → verify(per-film)
```
Key ordering invariants the parallel scheduler MUST preserve (from RUNBOOK §5 + pilot):
tmdb-fetch **before** extract; extract **before** boldtake (per film); boldtake/asset figure-creates
**before** embed; embed **before** taste/trope/affinities; **S22 trope-incr before S25 affinities**
(TF-IDF leg reads figure_type_members); **S39 analyzed-flip before TV/home/misreadings open**.

### B3 · Concurrency knobs to expose
- worker-pool size for per-film http stages (default 6–8).
- batch chunk size + the N-threshold for sync↔batch.
- max concurrent Batch submissions (Anthropic side handles parallelism; the executor just submits all).
- the cost gate ($50 default) evaluated on the **whole run's** estimate before any paid stage fires.

---

## C. The gotchas the executor must AUTOMATE (today they're manual file-swaps)

These are the workarounds the playbook does by hand; the executor should encapsulate them so bulk runs
don't need a human doing `cp`:
1. **Hardcoded-path loaders** — `boldtake-load` reads `worker/bold-take-full.jsonl`; `asset-load` reads
   `asset-all.jsonl`; `next-resolve`/`next-load` read `next-all[.resolved].jsonl`. And **`bold-take-gen`
   writes `{OUT}.jsonl` relative to CWD, not `worker/`.** The executor must either (a) patch these to
   accept `--in`, or (b) do the backup→swap→restore atomically per run. **Preferred fix: add `--in/--out`
   to the four loaders** (a small, real §7.13 follow-up) so no swapping is needed.
2. **boldtake-load `--apply` preflight guard** (`new_takes>0 → ABORT`) is a one-time-full-load guard that
   is wrong for incremental. Either add an `--incremental` flag that skips the guard, or (pilot's method)
   call `boldtake_insert_figures`/`boldtake_insert_takes` RPCs directly with the plan, then a **film-scoped**
   `boldtake_archive_old` (the stock one is GLOBAL — retires all framework-null takes; scope it to the run).
3. **§7.13 emit scoping** — `film-extract-batch`, `bold-take-gen`, `asset-gen`, `next-gen`,
   `director-profile-gen` emit paths were patched to honor `--films`/`--dirs` (done). Still unpatched:
   `catalog-map-run/char`, `release-events`, `wd-honors` (they run corpus-cohorts; add `--films`).
4. **geo uses `--films`, NOT `GEO_FILMS` env** (env is ignored → processes the whole corpus, ~$1 wasted).
   Manifest S19 corrected. The executor must pass `--films`.
5. **theorist_id resolution** — boldtake writes `theorist_name` but not `theorist_id`; the executor must
   run the name→id match (all 20 pilot theorists matched existing rows) so `/theorist` pages link.
6. **is_analyzed flip (`factory_analyzed_flip`)** — the single most important "open the film" step; without
   it the film renders Tier-2 even when visible. Must run per full film at end of W1/start of W3.
7. **Fantasia (S28)** — the generator SQL now lives in `factory/sql/sentence_*.sql` (reconstructed
   2026-07-12); `sentence-refresh.py --films` runs it. kin value is an approximate reconstruction (map
   weight only). D/E/F/H/J patterns need lineage/ratings/filmed-locations to produce rows.
8. **to.W comment** — no DB builder; the executor assembles `curation.film_comment` from grades (festival
   films with no lineage → authority=C/entry=festival/verdict=deep_cut). Port the verdict-v2 rules.
9. **Mgmt-API needs a browser User-Agent** (Cloudflare 1010) — already in factory.py/sentence-refresh.py.

---

## D. Ledger, resume, failure (so a 50-film run is observable + restartable)
- Every stage → `factory.stage_runs(run_id, film_id, stage_id, status, batch_id, cost_usd, verify_result)`.
  Corpus stages log `film_id=null`. Re-attempt = new row (`attempt+1`), never mutate.
- **Resume** = on re-run, each stage's `verify_sql` decides "already satisfied → skip". The pilot proved
  every stage is idempotent (skip-if-exists / null-only / ON CONFLICT / derived-swap). So `factory.py run
  --run N` must be safe to re-run after any failure and pick up where it stopped.
- **Failure policy per stage** (`park` vs `abort_run`): a single film that extracts < 3 figures should
  `park` (drop from the run, alert at the end) — not abort the other 49. Corpus stages (`embed`,
  `affinities`) `abort_run` on failure (they gate everyone downstream).
- **Cost/usage** → append per-batch usage to `factory/logs/usage.jsonl`; sum into `factory.runs.actual_cost_usd`.
- **Verify at the end** = the "quality bar" SELECT (figures/misreadings/theorist/tropes/movies-like/
  fantasia/locations/watch-next/why-watch/takescore/tow/portrait/live-Tier-1). Report per-film pass/park.

---

## E. Live-observation log (append what real runs teach)
- **2026-07-12** — *The Day a Pig Fell Into the Well* (1997, Hong Sang-soo) observed as an **exists-stub**
  (`hold=true`, 0 figures, but 29 stale sentences + a TakeScore). Confirms §A3: the executor needs a
  `promote` path distinct from `new`, and MUST clear `hold` before figures can open the film. Also confirms
  a large share of "new" titles will actually be stub-promotions, so the resolve→exists→promote branch is
  a first-class flow, not an edge case.
- **2026-07-12 (same film, run watched LIVE in another panel — an executor being built + tested):** the
  run used the **factory ledger** (`factory.runs #3`, `factory.intake #5`) and **correctly stamped the film
  `source='promotion'`** — so §A3 (a distinct promote path) is already being implemented by whoever is
  coding the executor. It also added a custom **`S27b_theory_link`** stage (fixing the theorist gap I flagged).
  The film **opened to Tier-1** at analyzed-flip and reached **essentially the full quality bar**:
  9 figures · 15 misreadings · **theorist 6/6 linked** · 5 tropes · 24 movies-like · **Fantasia 88 sentences
  (A/B/C/G/I/L/M/N via the reconstructed `factory/sql/sentence_patterns.sql`)** · 1 location · **watch-next 9**
  · **why-watch ✓** · TakeScore · to.W · director portrait · lineage 2 (canon → D_award + real verdict).
  - ⚠️ **CRITICAL OBSERVATION-METHOD LESSON (I got this wrong first):** I checked the quality bar **mid-run**
    (~05:20) and wrongly concluded the run had "skipped 4 stages" (theorist_id=0, sentences=29, watch_next=0,
    why_watch=false). By 05:36 those stages had run and everything landed. **A mid-run snapshot yields
    false-negative "missing stage" verdicts.** → The executor's `verify` gate MUST run **at run COMPLETION**
    (status flips to done), never against an in-flight run; and an observer must key off `factory.runs.status`
    before judging completeness. This false alarm is itself the lesson: *stage-in-progress looks identical to
    stage-skipped from a single DB snapshot.* The ledger `stage_runs.status` + `verify_result` is the only
    reliable "is this stage really done + correct" signal — which is exactly why every stage must write it.
  - This run also confirms the reconstructed sentence engine works on a real film with lineage (D_award
    fires) and different theorists — 88 sentences, all patterns except E_rank/F_compare (see below).
- **Pattern-coverage note:** the old sentence build has **F_compare** (runtime-vs-same-director) — present
  on this film (27 old rows) — which the 2026-07-12 reconstruction (`factory/sql/sentence_patterns.sql`) does
  NOT yet include; it did A/B/C/G/H/I/D/L/M/N (10) and skipped **E_rank + F_compare**. Add those two for full
  Fantasia parity (E_rank needs `film_ratings`; F_compare needs same-director runtimes).
