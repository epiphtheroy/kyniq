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
