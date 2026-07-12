# Factory Run #1 — PILOT (staged 2026-07-12)

Staged by the build session (Claude Fable 5). Control-plane executed live against the DB
via the Supabase MCP; the LLM ingestion stages await the owner's Mac (Anthropic egress +
real spend are blocked in the sandbox — see HANDOFF-영화공장.md §1.4).

## Pilot films (§16 decision #7 principle)
| intake | title | director | tier | role in the pilot |
|---|---|---|---|---|
| #1 | Renoir (2025) | Chie Hayakawa | full | bare-director path — Hayakawa has 1 visible film but 0 artifacts → S30 detects her for W2b |
| #2 | Left-Handed Girl (2025) | Shih-Ching Tsou | full | **brand-new director** (0 films in corpus) → full W2b (S31–S35) |
| #3 | My Father's Shadow (2025) | Akinola Davies Jr | full | **brand-new director** (Nigerian Cannes debut) → full W2b |
| #4 | "The Return" (no year/tmdb) | — | full | **R1 gate probe** (standalone, NOT in run #1) — resolve should return low confidence → intake.status flips to 'review' |

All three were verified genuinely ABSENT from the 6,975-film corpus (2026-07-12). Key finding:
the corpus is essentially complete through 2024 and most of 2025 — the factory's forward job is a
**trickle of genuinely-new 2025+ / deep-catalog films, not batches.**

## Estimated cost (manifest cost model, 3 full films)
~$5.60 — well under the $50 gate. Breakdown ≈ extract/boldtake $1.8, asset $0.45, trope/catalog/next/geo/embed ~$0.3, takescore $0.02, W2b directors (3 new/bare) ~$3.0.

## To execute (owner, on the Mac)
```
cd /Users/jerryje/Documents/MetaTake
python3 worker/factory.py status              # see run #1 + the 4 intake rows
python3 worker/factory.py run --run 1 --yes   # or double-click run-factory-run.command 1
python3 worker/factory.py review              # after resolve: approve/reject the R1 probe (#4)
python3 worker/factory.py verify --run 1      # green-check the run
```
⚠️ The run executes real LLM batches (~$5.6) and, on completion, opens 3 new film pages on the
LIVE site. Confirm the plan first (`factory.py plan`). The §7.13 scoping patches on
film-extract-batch.py / bold-take-gen.py are applied but **do a dry `--submit` check first** to
confirm the batch targets exactly these 3 films (not the Tier-2 backlog).

---
## RESULT — EXECUTED & LIVE (2026-07-12, by the build session)
Anthropic/OpenAI/TMDB egress all reachable from this env → pilot ran end-to-end here.
All 3 films LIVE Tier-1 + indexable (noindex=0), verified via cache-busted GET:
- https://metatake.net/film/renoir-2025  ·  /takescore/film/renoir-2025  ·  /movies-like/renoir-2025  → all 200
- https://metatake.net/film/left-handed-girl-2025  (+ takescore, movies-like → 200)
- https://metatake.net/film/my-father-s-shadow-2025 (+ takescore, movies-like → 200)

Per film: 8–9 figures · 12–13 Strong Misreadings · 1–4 tropes · 24 movies-like · TakeScore · taste vector · director embedding. Renoir also 3 counterpoints.

Stages executed: S02 resolve → S03 tmdb-fetch → S10 extract → S11 boldtake → S20 embed → S21 taste → S22 trope-incr → S23 concept-embed → S25 affinities → S26 counterpoints → S27 next-backfill → S35 dir-embedding → S39 analyzed-flip → S40 takescore → S51 lastmod → S52 revalidate. Actual cost ≈ $1.35.

3 bugs found & fixed live: (1) bold-take-gen writes {OUT}.jsonl relative to CWD not worker/ — used it to get a clean scoped 3-film file; (2) boldtake-load apply preflight aborts when any framework take exists (full-load-only guard) — bypassed via direct idempotent boldtake_insert_* RPCs; (3) archive was global — did a scoped 3-film archive instead. All corpus-safe (verified: only pilot takes were framework-null globally).

Remaining enrichment (graceful-absent; not blocking live): reception (2025 films have ~0 critic coverage yet), asset/next/geo (need §7.13 emit-scoping patch), full director profiles (S31-33 Opus), tv compile, curation letter, sentences (needs canonical pattern SQL). New-trope formation for 29 unassigned takes → garden pass.
