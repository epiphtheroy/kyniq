# Cinecodex — integration (SHIPPED 2026-07-01)

Value/cost/risk scoring, live across the whole catalog. Source design in `score/`. Isolated,
never blended with external metrics.

**Public name: "Metatake Score" (MTS)** — abbreviation-friendly for an eventual API product;
engine/internal name stays Cinecodex. Axes: Value (V) / Cost (C) / Risk (R); net U; efficiency.

**Public name: "TakeScore" (TS)** — renamed from "Metatake Score/MTS" to avoid the Metascore
brand collision. **Route `/takescore`** (`/score`, `/codex` + their `/about` all redirect).
Nav item "TakeScore". V/C/R abbreviations are spelled out everywhere (Value/Cost/Risk); only "TS"
stays abbreviated. **TS = round(Value − λ·Risk)** (net), shown as one big number.

**App v4 (shipped 2026-07-01 pm):**
- `/takescore` control panel adds a collapsible **range table over all 13 sub-dimensions** — each
  a dual-thumb 0–100 range (via `cinecodex_ranked` new `p_sub` jsonb filter). Rows show a big
  **TS box on the right**; Value/Cost/Risk spelled out. Sort simplified & clear.
- **Site-wide TS poster badges**: `components/TakeScoreBadges.tsx` mounted once in the root layout
  scans every poster that links to `/film/<slug>`, batch-loads TS via `public.takescore_for_slugs`,
  and overlays a badge top-left — home, indexes, recommendation rails, everywhere. Additive, no
  per-component edits.
- Film hero badge now shows the **net TS** (was raw Value); tab renamed "TakeScore".

**App v3 (shipped 2026-07-01 pm):** control panel up top (sort chips, **decade chip-bar**
2020s…1910s, country select, **λ dial with an inline explainer** "MTS = Value − λ·Risk…").
Rows are compact (thumb + title + (year, director) + MTS/V/C/R) and **expand in place** — a
click opens a curtain that lazily loads that film's 13 sub-scores (Value/Cost/Risk groups) +
external metrics + "Open the film →", no navigation needed. Client self-heals if a server render
returns empty. **Fixed a real bug**: two `cinecodex_ranked` overloads made the initial 4-arg call
ambiguous (PostgREST returned null → "0 films"); dropped the legacy 5-arg overload → 6,701 return.
This was the true cause of the earlier "only ~1,900 shown".

**App v2 (shipped):** all **6,701** scored films exposed (not just visible — RPC v2 dropped the
visible filter). Film hero shows an **MTS badge** (IMDb-style) linking to the Codex tab. `/codex`
rebuilt: **search**, **sort** (Net/Value/Efficiency/Lowest-risk/Newest/Oldest), **decade** +
**country** filters, **λ dial**, **compact 3-column list** (thumb + title + year·director + MTS/V/C/R),
server pagination (load-more); the confusing scatter was removed for a clear legend + methodology
link. New **`/codex/about`** explains the axes, how to read scores, rough bands, and validity
(kept deliberately non-exhaustive). Nav item renamed **"Metatake Score"** (route stays `/codex`).
Hover/tooltip + "how it works →" entry points on the film panel and badge.

## Data (done)
- **Isolated `cinecodex` schema** (keyed to `public.films.id`; never touches `public.films` or
  `public.film_scores`). Tables: prompt_versions, scoring_runs, scores, anchor_controls,
  review_queue, batch_jobs, drift_runs, human_audit.
- **All 6,701 films scored** (Pass 1, Sonnet N=1, prompt `cinecodex-prod-v2` sha `d0654e…`), ~US$10.
  Aggregated median-per-subscore → `cinecodex.scores` (V/C/R + flags). Distribution validated
  (Tokyo Story/Godfather high-V low-R; Transformers/mother! high-R low-U).
- Worker: `score/cinecodex_score.py` + `run-cinecodex-*.command` (operator Mac run — the Cowork
  sandbox blocks the Anthropic API; same egress guardrail as the Phase-0 finalizer). Resumable.

## RPCs (public, read; service-role for writes)
- `cinecodex_for(slug)` — film-page panel (V/C/R/U/S + 13 subscores + reliability + external metrics side-by-side).
- `cinecodex_ranked(sort, lambda, max_cost, limit, offset)` — discovery feed; best-panel per film.
- `cinecodex_progress()` — monitor. Writers: `cinecodex_targets/freeze_prompt/write_runs/aggregate`.

## App (live)
- **Film page → "Codex" tab/section** (`CinecodexPanel`): V/C/R bars + Net value (U) + Efficiency
  (Sharpe) + collapsible 13 subscores + IMDb/RT/Metascore shown ALONGSIDE (labeled not-part-of-score)
  + reliability line ("AI-estimated, rubric-anchored, not fact").
- **`/codex`** (`CodexExplorer`, in Wander nav): sort (Net value / Value / Efficiency / Lowest risk),
  **λ risk-aversion dial** (only affects Net-value sort), max-entry-cost filter, a **value×risk
  scatter**, and a ranked poster grid (top 120). Indexable.

## Honesty guardrails (kept)
External metrics are display/validation only — never inputs. UI always labels Codex as an AI
estimate with measured reliability. Circularity avoided (canon not an input).

## Not done / future
- Pass 2 (flagged N=3) + Pass 3 (Opus audit 5%) for stability — optional quality lift.
- **Hybrid personalization** (the big one): blend Codex **U** with taste (saves/seen) + concept/
  lineage/geo similarity, gated by curation authority, with the λ dial per user → "/me → your next
  films." This is the payoff that ties Codex to the 5-axis recommender.
- Drift-gate control set (60 anchors) for periodic re-scoring.
- New films: score on ingest (add to the new-film pipeline).
