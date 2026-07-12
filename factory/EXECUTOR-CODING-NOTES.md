# 영화공장 — Executor coding notes (observed from real runs, for hardening `factory.py run`)

> **STATUS 2026-07-12 (commit 2094e9a): patterns 1,2,5,6 CODED INTO THE ENGINE.**
> ① figure≥3 hard gate after S10 (scoped `--reset` re-extract top-up; still-short films parked out
> of the run, per-film) ② S15/S16 unblocked — asset-load/next-resolve/next-load now honor `--out`
> (the run-#6 root cause was TWO-layer: stale manifest block AND hardcoded loader paths)
> ⑤ `LAST_ERR` → `stage_runs.error` on failed/parked/partial + `"retries": N` manifest support
> (S20-embed retries=2) ⑥ partial now carries verify bad_slugs as its error; report prints the
> exact `--adhoc` repair command. ③ **root cause was NOT batch latency** — the S31/S32 manifest
> steps ran the gens without `--emit-requests`/`--out` (no requests file → submit died every run);
> fixed a125577 + picks-gen emit now honors `--dirs` (was corpus-unscoped, §7.13 class).
> ④ (theorist create-missing) NOT done — S27b links exact-match only, by design (theorists table
> has composite pollution; auto-create is an owner decision). Observed residual: real-but-absent
> figures like René Magritte, Andreas Werckmeister (1/film). `--only` accepts a comma list.
> Repair mode = `factory.py run --adhoc slug1,slug2 --only S15,S16 --yes` (mig 0089/0090).
>
> **LATER ADDITIONS (same day): realtime sync mode** (`--sync`, auto ≤5 films, worker/realtime-batch.py
> — owner rule: tests never wait on the Batch API) · **single-run lock + 60s liveness heartbeat**
> (finished_at doubles as heartbeat; stale >30min self-releases) after two concurrent runs exhausted
> the disk-IO burst (2026-07-13 incident: bulk_set_embeddings 11-18s, checkpoint 214s, REST 522) ·
> **PROMOTE-path parity**: held stubs get hold=false+visible=true at the S10 figure gate (visible
> trigger is on FIGURES — a films.hold change never fires it), else S25 affinities skips them (mother
> ended 0 movies-like until rerun).

**What this is:** field notes recorded while observing the first real bulk runs (2026-07-12). The
executor (`worker/factory.py run`) was built and driven on real film lists. It **works** — but the runs
exposed concrete failure patterns worth coding around before scaling to hundreds. This is the
"나중에 코딩할 때 필요한 점" list, backed by ledger evidence.

## Evidence (factory.runs / stage_runs, live DB)
| run | mode | films | result | cost | note |
|---|---|---|---|---|---|
| #1 | bulk | 3 | done | $1.25 | the original pilot (manual drive) |
| #3 | single | 1 | done | $0.37 | executor smoke test |
| #5 | bulk | 4 | **aborted** | — | early executor abort |
| **#6** | bulk | **20** | **done** | **$20.12** | the real proof — heavy arthouse canon (Béla Tarr, Pedro Costa, Lav Diaz, Wang Bing, Apichatpong, Sokurov, Puiu…) |
| #8 | repair | 24 | **aborted** | — | repair pass |
| #9 | repair | 24 | **failed** | — | repair pass; S20-embed failed |

**Run #6 rollup (the headline): 19/20 films fully Tier-1**, 20/20 scored, 20/20 framework takes,
20/20 sentences, 19/20 affinities. ~$1/film. **The parallelism model works at 20 films** — this is the
answer to "수십 편이 한꺼번에 가면 병렬로?": yes, it held.

## ✅ What the design got right (keep it)
- **Parallelism shape is correct.** Batch-API stages (extract, boldtake, catalog, takescore) combine ALL
  the run's films into ONE job (50% off, ~constant latency for 3 or 20). Corpus stages (embed, affinities,
  sentence-stats) run ONCE and amortize. Per-film HTTP stages (tmdb-fetch, geo) fan out on a pool. Net:
  20 films ≈ same wall-clock shape as 3, per-film cost DROPS at scale. Wall-clock ~5h (dominated by Batch
  processing latency, not linear compute).
- **Resolve + tier are the essential front gate** (owner's read is right). The executor's TMDB-id-first
  intake (`Title 496243` trailing number = tmdb id) is the single biggest reliability win — it skips fuzzy
  title matching entirely. Keep pushing users toward pasting tmdb ids.
- **Ledger-per-stage → resumable.** stage_runs status/cost makes `--from Sxx` re-runs idempotent. The
  S59 report_md (quality table per film + parked list) is exactly the right artifact.

## 🔴 Failure patterns to code around (each cost real quality on run #6)

1. **Existing <3-figure stubs never re-extract → never go Tier-1.**
   `mother-2009` (Bong Joon Ho; an existing 2026-06-25 catalog stub, 2 approved figures) was in run #6.
   `film-extract.py` SKIPS films that already have figures, so it kept the 2 old figures, boldtake anchored
   14 framework takes to them, but 2 < 3 → visible trigger never fired → **not Tier-1** (the run's only miss).
   **Fix:** the executor must GATE on approved-figures ≥ 3 *before* declaring a film done. If an existing
   film has 1–2 figures, force a top-up: `film-extract.py --reset --film <slug> --persist` (re-extract), OR
   a figure-enrich pass. The design's "<3-figure alert" (Ω) must be a **hard gate that triggers repair**, not
   a silent skip. This is the #1 edge case for the "existing stub / partial film" path (distinct from new films).

2. **S15-asset / S16-next were SKIPPED for the whole 20-film batch** ("worker-scoping-patch" reason).
   The report's `why` column is `·` and `next` is `0` for ALL 20 films — nobody got why-watch or watch-next.
   The emit-scoping patches for `asset-gen.py`/`next-gen.py` **shipped (commit 7c8cc73)**, but the manifest
   still carries their `needs_scoping_patch`/`blocked_by`, so the executor skips them.
   **Fix:** clear `needs_scoping_patch`/`blocked_by` on S15/S16 in `factory/manifest.json` (the patch is DONE),
   then the executor runs them. Verify the emit `--films` filter targets exactly the run's films first.

3. **Director batch stages park (S31-dir-profile, S32-dir-picks).** Run #6 parked both → the batch's new
   directors got no portrait / "where to start". Likely the Batch-API job didn't finish inside the wait
   window, or the parking heuristic fires too early. (facts S33 + embedding S35 succeeded — they're sync.)
   **Fix:** raise/adaptive the batch wait for director stages, or move them to a deferred second pass; poll
   until the batch `ended` (not a fixed timeout) with a longer ceiling. Parked ≠ failed — re-run should pick them up.

4. **theorist link is only partial** (report `thUnlinked` = 5–9 per film). The name→theorist_id match
   leaves many takes unlinked because the cited theorist isn't in `theorists` yet (canon films cite obscurer
   figures; the table also has composite-name pollution). The pilot had 0 unmatched only because it cited
   canonical names that pre-existed.
   **Fix:** in the theory-link step, **create the missing `theorists` row on the fly** (slug from name) when
   no match, then set theorist_id — so the /theorist surface is complete instead of 60% linked.

5. **S20-embed FAILED in the repair run (#9)** with no captured error (`error` was null). Embed is fragile
   under repair/resume.
   **Fix:** capture stage stderr into `stage_runs.error` (most errors are null right now — you cannot debug a
   failed run without the text), and give embed a retry (it's null-only + idempotent, safe to re-run).

6. **partial ≠ handled.** S11-boldtake, S25-affinities, S39-analyzed-flip logged `status='partial'` on run
   #6 with null error. "partial" needs a defined meaning + a follow-up: e.g. S39 partial = "some films <3
   figs, could not flip" → should emit the exact incomplete-film list to the report and queue a repair (this
   is precisely mother-2009).

7. **Repair mode is fragile** (#8 aborted, #9 failed). The repair/resume path — re-running only the
   incomplete stages/films — is where the executor breaks. Harden it: repair should (a) recompute the
   incomplete set from the quality-bar SELECT, (b) run only the missing per-film stages scoped by `--films`,
   (c) never re-run destructive/global stages, (d) capture errors. It's the most-used path at scale (bulk
   always leaves a tail).

## Parallelism spec (validated — write it this way)
- **Unit = the film.** Each film flows W0→W1 independently; process N concurrently.
- **Batch-combine** the paid LLM stages across ALL run films (one Batch job/stage). Don't loop per film.
- **Barrier before corpus stages:** embed / taste / affinities / counterpoints / sentence-stats run ONCE
  after all films' content lands. embed is null-only (safe global); affinities/counterpoints are atomic
  swaps (safe global); sentences = stats-once + per-film patterns.
- **Dedup directors** across the batch (many films share a director) → one W2b pass per unique new director.
- **Cost gate** pauses the run > $50 (~50 full films) before the paid stages.
- **Per-film independence for the tail:** a film that fails one stage must not block the others — park it,
  finish the batch, report the incomplete set, repair separately.

## Resolve / tier notes (the front gate the owner flagged as essential)
- **Resolve is make-or-break:** a wrong director match attaches the entire downstream graph to the wrong
  film. Keep confidence tiers (high/medium/low/given); low/unmatched → R1 review, never silent.
- **tmdb-id-first** is the reliability lever — the trailing-number parse is the right call; document it loudly.
- **Tier is not enough for existing rows:** a title may already exist as a `hold=true` Tier-2 stub (the pig
  film) or a thin <3-figure stub (mother-2009). The executor needs an explicit **PROMOTE path**: detect
  `status=exists` at resolve → clear `hold`, ensure ≥3 figures (re-extract if short), then W1→W4. Treat
  "new film" and "promote existing stub" as two intake sub-types.

## Immediate cleanups the current corpus needs (from run #6, not yet done)
- `mother-2009`: 2 figures → re-extract (`film-extract.py --reset --film mother-2009 --persist`) → boldtake →
  embed → analyzed-flip, so it crosses Tier-1.
- 20 films (run #6) missing **why-watch + watch-next**: unblock S15/S16 in manifest, run asset/next scoped.
- New directors from run #6: portraits/picks parked → re-run S31/S32.
- theorist backfill: create-missing + relink the ~5–9 unlinked takes/film.
