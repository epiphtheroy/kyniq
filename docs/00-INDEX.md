# Metatake — docs index (start here)

**The site:** metatake.net — an AI "critical map of cinema." Next.js (App Router) + Supabase + Vercel.

**The model in 3 lines:**
1. `film → figure → take`; each take has a **framework** (one of 14 "Strong Misreadings", `lib/frameworks.ts`) and a **trope** (`meta_takes.kind='figure_type'`).
2. Figures are classified into the **Catalog/Archetype** taxonomy (`taxonomy_nodes` + `figure_taxonomy`).
3. The old **meta-take / register / reading-hub** model is **retired** — don't rebuild it.

---

## The 4 docs that matter (keep these current)

| Doc | Owns |
|---|---|
| **[STATE.md](./STATE.md)** | Where we are now: model, live counts, site map, data model, shipped/pending. *Update every session.* |
| **[RUNBOOK-new-film-ingestion.md](./RUNBOOK-new-film-ingestion.md)** | How a new film becomes live pages: full ordered pipeline, batch/parallel/gate, fragilities, and the path to full automation. |
| **[BACKLOG.md](./BACKLOG.md)** | Everything not done yet: ingestion automation, pipeline gaps, SEO, quality (aliases, node-graph), features, doc hygiene, decisions, open questions. |
| **[CONCEPT-tropes-and-strong-misreadings.md](./CONCEPT-tropes-and-strong-misreadings.md)** | The conceptual canon + About/manifesto copy. Definitions of Figure / Strong Misreading / Trope / Catalog. |
| **[FRONTEND-DISCOVERY-AND-DECISIONS.md](./FRONTEND-DISCOVERY-AND-DECISIONS.md)** | The discovery/front-end layer: The Map (engine + 3 surfaces + recenter), home "Surprise me" (`surprise_home` modes), home v7, newsletter/editions, sticky nav, CSS conventions + hard-won lessons, locked UX decisions, and what a new film needs to light it all up. |

## Active design plans (in-flight features)
- `docs/PLAN-cinecodex-integration.md` — **Cinecodex value/cost/risk index (SHIPPED)**: all 6,701 films scored in isolated `cinecodex` schema; film-page **Codex** panel + **`/codex`** discovery (λ risk-aversion dial, value×risk scatter). Next: Pass 2/3 + hybrid `/me` recommender.
- `docs/WORKORDER-cinecodex-scoring.md` — **Cinecodex** value/cost/risk scoring (V/C/R/U/S, 13 sub-scores) via Anthropic Batch API into the **isolated `cinecodex` schema** (keyed to `public.films.id`; external metrics reused from `film_ratings`, never blended). Source design in `score/`. The "quality axis" for personalized recommendation (λ risk-aversion dial). Monitor: `cinecodex_progress()`.
- `docs/PLAN-cinemas-phase2.md` — Phase 2: **"Movements"** (`/movements`), the origin & tradition browse axis — unified: **National cinemas** + **Waves & movements** groups, powered by lineage data + curation hub policy. Renames the HANDOVER's "World Cinema Atlas" (Atlas = the geographic map). Feeds personalization.
- `docs/PLAN-curation-integration.md` — the **curation editorial brain** (authority×demand quadrants, country/region hubs, `should_index`) → live site + 5-axis personalization. Bridge (`public.film_curation` view + `curation_drift()`) live; phased plan + operator Phase-0 finalizer. Deeply tied to lineage.
- `docs/PLAN-geographic-atlas.md` — the geographic **Atlas** (FilmAtlas): `film_locations` + geocoding + MapLibre `/atlas`, film/director Atlas tabs, the `geo-extract`/`geo-code` workers. (Distinct from the node "Connections" map.)
- `docs/PLAN-taxonomy.md` — Catalog/Archetype layer
- `docs/PLAN-personalization-portfolio.md` — `/me` film-asset terminal
- `docs/PLAN-trope-reformation.md` — trope pipeline detail
- `영화사이트_구조_고민과_해법.md` — 2-tier catalog (watchlists) strategy

## Scoped sub-projects (self-contained bundles)
- `handoff/` — Lineage (계보) tag layer (canon/awards/festivals)
- `magazine research agent/` — reception research sub-agent

## Operational scratch (lives with code, not "project docs")
- `worker/*.md` (DRY-run samples), `substack/` (publishing log), `Element/` + `Asset/` (catalog/recommendation design), various `*/README.md`.

## Legacy / superseded → to be archived
Pre-migration docs still teaching the old model (root `MASTER.md`, `meta-take-architecture.md`, `START-HERE.md`, `SPEC.md`, all `mission-*.md`, root `HANDOFF-*.md`, `docs/STATE-2026-06-17.md`, `docs/RUNBOOK-bigbang.md`, and the entire **duplicate `filmcurio-bundle/`**). Pending your OK to move into `archive/` (BACKLOG §F).
