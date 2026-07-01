# WORK ORDER — Cinecodex scoring run (for an AI/engineer with the Anthropic API)

**Goal:** score Metatake's catalog with the **Cinecodex** rubric (13 sub-scores → V value / C cost /
R risk) via the Anthropic **Batch API**, writing results into the **isolated `cinecodex` schema**
already created in Supabase. Resumable, cost ~US$11–20 total. Read the source design first, then
execute — this order adapts it to the live Metatake DB.

**Read these (in `/Users/jerryje/Documents/MetaTake/score/`):**
`Cinecodex_HANDOFF.md` (overview), `Cinecodex_RUNBOOK.md` (implementation detail — authoritative),
`Cinecodex_Execution_Strategy.md` (pipeline + cost), `PROMPT_PRODUCTION_v2.txt` (the frozen scoring
prompt), `Cinecodex_Anchor_Bank_v2.md` (offline control set). Unified settings: **temp=0.6 · B=8 ·
N=1 full → N=3 flagged · Sonnet primary / Opus audit / Haiku forbidden.**

---

## 0. What's already done (don't redo)
- **Isolated schema `cinecodex`** exists in Supabase project `jvgarcqrtsmgfimdcwgo`:
  `prompt_versions`, `scoring_runs`, `scores`, `anchor_controls`, `review_queue`, `batch_jobs`,
  `drift_runs`, `human_audit`. **All keyed by `film_id uuid → public.films(id)`.** (NOT the doc's
  bigserial `films`/`film_scores` — those names are taken in `public` and must never be touched.)
- Monitor RPC `public.cinecodex_progress()` (read-only) for live watching.
- External metrics are **already** in `public.film_ratings` (imdb/rt/metascore) — do NOT fetch OMDb;
  they're for side-by-side display only, never an input.

## 1. Access & env
- Supabase: MCP `execute_sql` (project `jvgarcqrtsmgfimdcwgo`) **or** PostgREST + `SUPABASE_SERVICE_ROLE_KEY`
  (`cinecodex` schema is not exposed to anon — use service role / MCP).
- Anthropic: `ANTHROPIC_API_KEY` (in `MetaTake/.env.local`). Batch API + prompt caching.
- Corpus & metadata already in `public.films` (id, tmdb_id, title, year, director). No TMDB needed.

## 2. Freeze the prompt (once)
Read `score/PROMPT_PRODUCTION_v2.txt`. Verify SHA-256 = `d0654eaa203cee5e54101e4424b8e5649bceb46ce958a1445c5322e247bc538e`
(if the file changed, recompute and use the new hash). Upsert into `cinecodex.prompt_versions`:
`prompt_version='cinecodex-prod-v2'`, `prompt_sha256=<hash>`, `prompt_text=<full file text>`.
(The note-enabled audit variant, if used, is a **separate** version `cinecodex-prod-v2-note` with its
own SHA — see RUNBOOK §9.)

## 3. Corpus & order
```sql
-- Phase A (do first): the live/visible catalog for immediate site value
select id as film_id, title, year, director from public.films where visible order by random();
-- Phase B (after A is validated): the rest
select id as film_id, title, year, director from public.films where not visible order by random();
```
Score each film INDEPENDENTLY; batch order is random (position-bias defense).

## 4. Pipeline (tiered — from Execution_Strategy §3 + RUNBOOK)
1. **Confirm model snapshots** via `/v1/models`; pin `claude-sonnet-4-6` (primary) / `claude-opus-4-8`
   (audit). Log exact `model_id`; never auto-upgrade.
2. **Plumbing check — 1 batch of 8–16 films** (~US$0.02) FIRST: confirm the batch submits, the
   parser + `custom_id` reverse-mapping work, prompt-cache hits register, and token/cost logging is
   correct. Cost/time are negligible (Pass 1 ≈ $0.001/film; Batch API parallelizes server-side, so
   no parallel-agent orchestration is needed — Batch + caching is cheaper and more consistent).
   Then **run Pass 1 on ALL visible films (~1,935, ≈ US$2, ~1–2 h async)** in one go — a separate
   300-film pilot is unnecessary at this cost. **Then STOP at a distribution review gate:** query
   ~40 well-known titles from the results and sanity-check (Tokyo Story/Parasite high-V/low-R;
   Transformers low-V/high-R; anime/chamber films sensible; parser/median/cost all clean). Only
   after the operator OKs the distribution: continue to Pass 2/3, the drift gate, and Phase B.
3. **Pass 1 — Sonnet N=1**, Batch API, B=8, temp 0.6, system block cached
   (`cache_control:{type:"ephemeral"}`), `custom_id="{film_id}__cinecodex-prod-v2__{model_id}__s1"`.
   Write every result to `cinecodex.scoring_runs` (13 raw scores + model_id/temp/sample/prompt_version
   + tokens/cost + raw_json). Parse per RUNBOOK §5 (strip fences, match n/title, validate 13 ints
   0–100; retry singl­y ×2; else `parse_ok=false` + `review_queue(parse_fail)`).
4. **Aggregate** (RUNBOOK §3): per film, **median of EACH of the 13 sub-scores** across its samples,
   THEN V=(COG+AFF+FORM+MORAL+DUR)/5, C=(ITX+FR+ETX+CTX)/4, R=0.6·(BANK+INSINCERE+COWARD)/3+0.4·POLAR.
   Upsert `cinecodex.scores` (medians + V/C/R + n_samples + sd_v/sd_r + panel='sonnet-n1'). Do NOT
   store U/S (they depend on user λ). Flag per RUNBOOK §4 (near band-edge, high_sd, high_risk R≥60,
   parse_fail) → set `flagged` + `review_queue`.
5. **Pass 2 — Sonnet N=3** on flagged (~15%) → re-aggregate (panel='sonnet-n3'), median absorbs noise.
6. **Pass 3 — Opus N=3** audit on random 5% + high-risk/panel-disagree → panel='opus+sonnet'; if still
   split, leave in `review_queue` for human.
7. **Drift gate** (RUNBOOK §6): build a 60-film control set from strong-consensus anchors in
   `Cinecodex_Anchor_Bank_v2.md` (populate `cinecodex.anchor_controls` with expected_band = nearest
   0/25/50/75/100, tol ±12). Re-score the control set before each ~1,000-film chunk and on any model/
   prompt change; if >10% of (film,dimension) fall outside tolerance → `gate_passed=false`, PAUSE,
   investigate, recalibrate, resume. Log each check to `cinecodex.drift_runs`.
8. **Resume** (RUNBOOK §7): idempotent via `scoring_runs` unique key; the "remaining" query left-joins
   `scoring_runs`. Poll `cinecodex.batch_jobs` for async batches.

## 5. Monitoring (operator/assistant watches)
```sql
select public.cinecodex_progress();
-- films_total, pass1_scored, aggregated, flagged, review_open, batches_open, last_drift_pass, runs_total
```
Spot-check quality any time:
```sql
select fm.title, fm.year, s.v_value, s.c_cost, s.r_risk, s.flagged
from cinecodex.scores s join public.films fm on fm.id=s.film_id
order by s.scored_at desc limit 30;
```

## 6. Cost & guardrails
- ~US$11 tiered (Execution_Strategy Appendix A). Levers: prompt caching (−90% input), Batch (−50%),
  Sonnet primary, tiered N, note omitted in production.
- **Never** blend IMDb/RT/metascore/canon into the score — they are display/validation only.
- Anchors: put only the **8 reference anchors** (already in the prompt) in requests; the 520-anchor
  bank stays OFFLINE (control set + public defense doc), never in the prompt.

## 7. Done / handback
- `cinecodex_progress()` → `aggregated` ≈ `films_total`; `last_drift_pass=true`; `review_open` triaged.
- Report final counts + a 20-film spot-check to the operator. The Metatake assistant then wires the
  app surfaces (film-page Cinecodex panel shown *alongside* external ratings; U-ranked discovery;
  the λ risk-aversion dial in personalization) reading `cinecodex.scores` via a security-definer RPC.
