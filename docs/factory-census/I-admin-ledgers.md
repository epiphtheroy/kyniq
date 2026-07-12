# RECON REPORT — TASK I: Admin, Ledgers & Precedents for the Film Importer Factory

## 1. `/app/admin/` — existing admin surface

Routes (all under `/Users/jerryje/Documents/MetaTake/app/admin/`, one `page.tsx` each):

| Route | Reads | Status |
|---|---|---|
| `/admin` (page.tsx, "Control Center") | `content_events`, `meta_take_film_counts`, `meta_takes` | partially LEGACY (meta-take spine) |
| `/admin/metrics` | `mt_insights` table; RPCs `mt_generate_insights`, `mt_gsc_overview_json`, `mt_live_json`, `mt_overview_json`, `mt_page_json` | CURRENT (first-party analytics) |
| `/admin/pipeline` | `films(pipeline_status, in_pipeline, questions_published, questions_target, last_processed_at)`, `jobs`, `pipeline_config` (keys `model_router`, `gate_threshold`, `rate_limits`, `worker_state`), `questions` | **LEGACY** — this is the retired FilmCurio Q&A job-queue pipeline (SPEC.md era), NOT today's worker pipeline. Do not extend; but the `pipeline_config`/`jobs` table shape is a usable precedent for a factory job queue. |
| `/admin/review` | `questions`, `canonical_answers`, `contributions`, `content_events` | LEGACY |
| `/admin/content` | `questions`, `canonical_answers`, `contributions` | LEGACY |
| `/admin/activity` | `agent_activity`, `content_events`, `films`, `jobs`, `questions` | LEGACY-ish |
| `/admin/members` | `profiles` | current |
| `/admin/flags` | `flags` | LEGACY |
| `/admin/audit` | `content_events` | current-ish (audit log helper still used) |
| `/admin/login` | — | current |

**Auth mechanism** (fully reusable for `/admin/factory`):
- `middleware.ts` (repo root, lines ~110–128): every `/admin/*` except `/admin/login` → `supabase.auth.getUser()`; then `profiles.role === 'admin'` check; non-admin gets `NextResponse.rewrite('/_not-found')` (stealth 404), unauthenticated gets redirect to `/admin/login`. ⚠️ `middleware.ts` is a ROOT file — the auto-deploy watcher only stages `app/ components/ lib/`, so middleware changes require **manual commit**.
- `lib/admin.ts`: `getAdminUser(): Promise<AdminUser|null>` (server-only; queries `profiles.id,role,display_name`); `logContentEvent()` writes audit rows to `content_events` (entity_type/entity_id/event/actor_id/actor_kind/meta).
- `app/admin/layout.tsx`: `metadata.robots = {index:false, follow:false}`; NAV_ITEMS array — add `/admin/factory` here. ⚠️ Layout deliberately does NOT redirect on `!admin` (renders children bare) — middleware gates; a layout redirect caused ERR_TOO_MANY_REDIRECTS loops with the login page.
- Pages use `createAdminClient()` from `lib/supabase/admin` (service role) + `export const dynamic = "force-dynamic"`.
- **Verdict: yes, an `/admin/factory` page can follow the metrics-page pattern exactly** (server component + service-role client + force-dynamic; middleware auth is automatic for any `/admin/*` path).

## 2. Ledger / state patterns in existing systems

**A. Hourly news system** (most mature autonomous-loop precedent):
- `hourly/ledger.md` — append-only, one line per hour slot: `TIMESTAMP · PUBLISHED|PASS|KILLED|PASS-CAND · kw: … · anchor: slug · lane · modules · /now/slug · dist: revalidate,indexnow:200,bluesky:200`. Machine-read back by the pipeline itself: 48h story-cluster dedupe + 7-day film-reuse check parse this file. Written via `ledger_append()` in `hourly/pipeline/common.py`, called from `hourly/pipeline/produce.py`.
- `hourly/poller/state/seen.json` — dict keyed by keyword: `{first_seen, last_traffic, last_seen}`; pruned by cutoff on each run (`poller.py` lines ~236–283); rewritten wholesale each cycle.
- `hourly/poller/usage.jsonl` — append-only per-LLM-call cost ledger: `{at, model, in, out, cache_read, cache_write, searches, cost_usd}`.
- Kill switch: a file named `HOLD` in `hourly/` stops publishing (checked in both `now-playing-watch.sh` and inside `produce.py`); daily cap (`DAILY_CAP`=4) re-checked at publish moment to prevent races.

**B. Phase-0 backfill** (`curation-handover/02-phase0/phase0_origin_backfill.py`): DB-column-as-ledger pattern — targets selected by `WHERE origin_confidence IS DISTINCT FROM 'api' AND coalesce(manual_override,false)=false`; sets `origin_confidence='api'` on success → idempotent/resumable with zero external state. Respects `manual_override`. Direct psycopg2 via `SUPABASE_DB_URL`; commits every 200 rows; finishes with `curation.rebuild_country_hubs()`.

**C. Worker batch runs** (`worker/`): per-run file trios — `<name>.requests.jsonl` (built requests), `<name>.batchids.txt` (one `msgbatch_…` id per line), `<name>.results.jsonl` (fetched), plus `.submitted.txt` / `.clean.jsonl` / `.verdicts.jsonl` for the engine waves; wave manifests `wave-w{1..4}-{a..g}.json`. `worker/film-extract-batch.py` stores its batch id in `worker/film-extract-batch.json` (`{batch_id, count, submitted_at}`). `Outputs/figure_seo/batch_id.txt` holds a single batch id. Catalog batches store ids as `Element/*.batch`, checked by root `check-batches.command` (read-only status poller).

**D. Idempotence-by-query** is the dominant pattern everywhere: film-extract skips films that already have figures; `mt-embed.py` is null-only unless `--force`; sentence layer uses `ON CONFLICT DO NOTHING`; `mt-seo-batch.py` null-only.

## 3. CineCodex scoring progress tracking

`score/cinecodex_score.py` (+ `run-cinecodex-{plumbing,visible,all}.command`):
- Stdlib-only, synchronous Messages API + prompt caching, ThreadPoolExecutor (THREADS=6, B=8 films/request), model `claude-sonnet-4-6`, temp 0.6.
- Progress = **DB-side RPCs**, not files: `cinecodex_freeze_prompt(p_version,p_sha,p_text)` (prompt SHA-256 pinning), `cinecodex_targets(p_scope,p_limit)` (returns only not-yet-scored films → resume = just re-run), `cinecodex_write_runs(p_rows)` (buffered writes), `cinecodex_aggregate(p_prompt_version,p_panel)`. Exit message: "Re-run to resume".
- `cinecodex_progress()` — **UNKNOWN/VERIFY**: not found anywhere in repo (`score/`, `supabase/migrations/`); if it exists it was applied directly to the live DB (the `cinecodex` schema functions are not in `score/cinecodex_schema.sql` either). The resumability mechanism is `cinecodex_targets`.
- Reads env from `~/Documents/MetaTake/.env.local` via an inline `load_env()`; needs `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Runs on the Mac because the Cowork sandbox blocks Anthropic API egress (⚠️ noted in the script docstring).

## 4. Anthropic Batch API pattern

Canonical implementation: `worker/film-extract-batch.py` — two phases `--submit` / `--fetch [--dry] [--batch msgbatch_xxx] [--limit N]`; endpoint `https://api.anthropic.com/v1/messages/batches`; headers `x-api-key` + `anthropic-version: 2023-06-01`; `custom_id` = the film's DB `id`; model `claude-opus-4-8`. Same shape in `bold-take-batch.py`, `asset-batch.py`, `next-batch.py`, `mt-seo-batch.py`, `catalog-map-run.py`/`catalog-map-char.py`, `trope-gate-batch.py`, `director-{profile,picks}-batch.py`. Runner buttons: `run-*-batch-submit.command` / `run-*-batch-fetch.command`.
- ⚠️ Constraints (from auto-memory `engine-wave-ops-lessons`, not codified in a repo doc — VERIFY in `docs/` if a written source is required): **custom_id ≤64 chars, no colons**; **90-min stall rule** — a batch showing no progress for ~90 min should be cancelled and resubmitted; slug-restoration regex needed when custom_ids were mangled.
- ⚠️ Small runs (≲50 films): use **synchronous parallel calls, not Batch** (auto-memory `small-tests-sync-not-batch`; also demonstrated by `Outputs/figure_seo/pilot_run.py` sync pilot vs batch, and the figure-SEO batch that expired 24h/0-results — batches can stall for a day). RUNBOOK-new-film-ingestion §6.E: the factory should submit **one combined batch per stage across all new films**, not per-film, to maximize the 50% discount.
- ⚠️ Subscription/Claude-Code sessions cannot bulk-run Opus (throttle + session limits) — bulk generation goes through the Batch API (auto-memory `film-naming-batch-pipeline`).

## 5. Env / secrets

- **Single source: `/Users/jerryje/Documents/MetaTake/.env.local`** (repo root; `worker/.env.local` does NOT exist despite some script docstrings saying so — scripts fall back to root/`~/Documents/MetaTake/.env.local` via their inline `load_env()` copies). Key names present: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `VOYAGE_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN` (the `sbp_` Management-API token), `TMDB_READ_TOKEN`, `OMDB_API_KEY`, `GOOGLE_MAPS_KEY`, `BRAVE_API_KEY`, `TAVILY_API_KEY`, `YOUTUBE_API_KEY`, `YOUTUBE_DATA_API_KEY`, `RESEND_API_KEY`, `REVALIDATION_SECRET`, `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`, `NEXT_PUBLIC_SITE_URL`. (`SUPABASE_DB_URL` used by phase0 script is NOT in the key list — VERIFY whether it's set in shell env or was added transiently.)
- **`worker/apply-sql.py <file.sql|->`** — runs arbitrary SQL via Supabase Management API `POST https://api.supabase.com/v1/projects/jvgarcqrtsmgfimdcwgo/database/query`, auth `Bearer $SUPABASE_ACCESS_TOKEN` (sbp_). This is the factory's DDL/SQL escape hatch when the Supabase MCP is unavailable. ⚠️ Per auto-memory: the owner (원우) runs it with `!` (bang) execution — the sandbox may prompt.
- **Node**: `~/.local/node/bin/node` exists (v22), NOT in PATH; dev/build must run outside the sandbox with a clean `.next` (auto-memory `no-local-node-verify-via-vercel`). Watcher scripts prepend `/opt/homebrew/bin:/usr/local/bin` and nvm/volta paths manually.
- Anthropic API egress is **blocked in the Cowork sandbox** — LLM-calling workers run on the Mac directly (cinecodex docstring; consistent with all `.command` double-click runners).

## 6. Repo-level agent instructions

- **`AGENTS.md` (root) is LEGACY** — it is the standing brief for the retired "FilmCurio" frames/Q&A product (SPEC.md, filmcurio.com branding, `jobs`/`pipeline_config` worker, design system v2 "Reading Instrument"). `00-INDEX.md` explicitly lists `SPEC.md`, `AGENTS.md`, `content-engine-overview.md`, `RUNBOOK-metatake.md`, `mission-*.md` under "Legacy / historical — do NOT treat as current; don't build from them." ⚠️ A factory orchestrator must NOT follow AGENTS.md's stack/design/table directives; the durable ideas it contains (generate→verify→publish with confidence gate, HOLD-don't-publish when uncertain, no sockpuppets, publish rate-limits, `content_events` audit logging) survive in spirit but the authoritative docs are elsewhere.
- **`00-INDEX.md` (root) is CURRENT and is the doc router**: authoritative-now = `docs/STATE-2026-06-17.md`, `docs/RUNBOOK-bigbang.md`, `MASTER.md`, `docs/PLAN-tier2-almanac.md`; plus per-layer HANDOFF-*.md files (28 at root). Convention it declares: `deploy-*.command` = web deploy (git push → Vercel), `run-*.command` = pipeline runner against live DB; `.command` files are double-click runners because the sandbox can't push. Also carries the ⚠️ Atlas→Locations / map→Network terminology header.
- **The factory's true master doc is `docs/RUNBOOK-new-film-ingestion.md`** ("I have a list of titles → fully integrated pages", 18 stages + §3b discovery matrix + §4 mandatory backfills + §5 ordering hazards + §6 automation plan + §7 verification checklist). Key invariants from it: per-film stages (1–3, 10–13, 15, 17) are parallel-safe; corpus-wide stages (4–9) can rename/re-link live entities and must stay supervised or run additive-only (`worker/trope-incremental.py` + RPC `trope_match_takes`, threshold 0.72, is the DONE additive example); ⚠️ Stage 2 (tmdb-fetch) before Stage 3 (extract) always; embed before consolidate/rank/tropes; bold-take loads before embed; SEO after any hub rename; `trope-build --reset` and `trope-persist --apply` are corpus-destructive; a film with <3 approved figures stays silently noindexed (`films.visible` flips via a live DB trigger at ≥3 approved figures — ⚠️ trigger NOT in `supabase/migrations/`, live-DB only, uncaptured); noindex gate in `app/film/[slug]/page.tsx` = `figures>=3 && visible`; sitemap filters `visible=true`.

## 7. "Watch for changes" tooling precedents (for a Factory Sentinel)

All long-running loops are **nohup'd while-loop shell scripts started from a Terminal-context shell** — ⚠️ **launchd/cron are TCC-blocked from reading `~/Documents`** ("Operation not permitted", observed 2026-07-09), so do NOT build the sentinel on launchd or crontab.

| Script | Pattern | Details |
|---|---|---|
| `auto-deploy-watch.sh` (root) | 5s poll of `git status --porcelain -- app components lib`, 20s debounce, then add/commit/push to main | ⚠️ only stages `app components lib` — root files (middleware.ts, next.config, public/) need manual commit. ⚠️ deletes others' `.git/index.lock` (race hazard, auto-memory `autodeploy-watcher-race`). Pause file: `.autodeploy-off` (⚠️ another session may delete it). Log: `.autodeploy.log`. |
| `hourly/now-playing-watch.sh` | single-instance guard via PIDFILE (`hourly/.watch.pid` + `kill -0`), one catch-up run at start, then sleeps to the next :00; calls `/usr/bin/python3 hourly/pipeline/produce.py`; HOLD-file kill switch; restart line documented in header (`nohup … &`) | ⚠️ bash parses `run_once` once at startup — logic that must be editable at runtime belongs in the re-read Python (this is why the daily digest trigger moved INTO `produce.py` `_maybe_run_digest`). |
| `worker/gsc-daily-watch.sh` | PIDFILE `worker/.gsc-watch.pid`; `python3 worker/gsc-pull.py --persist --days 3`; `sleep 86400` | logs to `worker/gsc-pull.log`; must be re-nohup'd after reboot. |
| Bot Sentinel | NOT a shell loop — DB function `public.mt_detect_bots()` (in `worker/0078_bot_sentinel.sql`, `revoke execute from anon,authenticated,public`) piggybacks the **only Vercel cron**: `vercel.json` `crons: [{path:"/api/metrics/insights", schedule:"*/30 * * * *"}]`; enforcement in root `middleware.ts` (fail-open, GOOD_BOT exceptions, 24h TTL). | Precedent for factory server-side periodic checks: piggyback `/api/metrics/insights` or add a second Vercel cron path. |
| Git hooks | none found (no custom `.git/hooks` tooling reported by conventions; VERIFY if needed) | — |

⚠️ Auto-memory `verify-task-notifications-on-disk`: background "done" notifications have been forged before — a factory sentinel must verify completion via journal counts + file existence + timestamp coherence, never trust the notification alone.

## 8. Ingest CSV / queue convention

- **`ingest-new.command` and `titles.csv` DO NOT EXIST yet** — they are the planned wrapper, specified in `docs/RUNBOOK-new-film-ingestion.md` §6.A (Stages 1→2→3→10→11→12→13 fan-out, parallel batches, resolve-confidence review gate surfaced) and tracked in `docs/BACKLOG.md` line 15 ("One ingest wrapper `ingest-new.command <titles.csv>`", low–medium effort). The factory IS this wrapper plus §6.B–E.
- Existing seed-list precedents: `metatake_films_expansion_405.csv` (root; titles only, no tmdb_id — resolved via RUNBOOK-bigbang §0.A), `data/seed/metatake_figures_takes_4662.csv`, `worker/theory_canon.csv`, `handoff/mappings/film_lineage.csv` + `films_master.csv`.
- Per-film incremental geo pipeline already documented as a paste-and-run doc: `GEO_운영-신규영화-증분처리.md` (root) — `GEO_FILMS=<slug> run-geo-extract-apply.command` → `run-geo-code.command --apply`, cache-backed, additive.
- Post-ingest connection refresh recipe: `HANDOFF-연결엔진-커넥션.md` §4.3 / RUNBOOK §4.3 (`worker/mt-recommend.py`, counterpoint SQL in `supabase/rpc/counterpoints.sql` header, `worker/concept-embed.py --write 0.70`, `film_next.target_film_id` one-liner backfill; ⚠️ `worker/galaxy-build.py` only ~quarterly — full rebuild moves ALL coordinates).
- Newer stages a factory must also cover beyond RUNBOOK-new-film-ingestion (per 00-INDEX/auto-memory, post-dating that runbook): TakeScore scoring (`score/cinecodex_score.py`), sentence layer Stage 18 (`sentence-engine/MASS-PRODUCTION.md` recipe), reception 4-source pipeline (`magazine research agent/` + film-afterlife layer), to.W curation comments (`HANDOFF-투두블유-큐레이션코멘트.md`, rules in DB table `curation.rule`), i18n reconciler (`content_i18n` + `source_sha256` → cron auto-retranslation), TV broadcast/playlists, IndexNow/sitemap pings (`lib/sitemap-data.ts`, 17/20-way split).

## Cross-cutting ⚠️ list (factory design constraints)

1. launchd/cron TCC-blocked in `~/Documents` → nohup while-loops only.
2. Auto-deploy watcher scope = `app components lib`; it may race concurrent git sessions and deletes index.lock; pause via `.autodeploy-off` is not durable.
3. `films.visible` trigger (≥3 approved figures) exists only in the live DB — uncaptured in migrations; <3-figure films silently noindex with no alert.
4. Corpus-wide stages rename live URLs; only additive modes (`trope-incremental.py`) belong in an automated ingest; full reclustering = supervised monthly "garden" pass with `slug_history`/`merged_into` redirects.
5. Batch API: custom_id ≤64 chars/no colons; 90-min stall → cancel+resubmit; ≲50 items → sync parallel; one combined batch per stage.
6. Sandbox blocks Anthropic egress and git push → LLM workers and deploys run on the Mac (`run-*.command`/`deploy-*.command`).
7. PostgREST caps every response (RPCs included) at 1000 rows → bulk reads need `jsonb_agg` single-row RPCs.
8. `lib/slug.ts` is the ONLY slug generator; TakeScore numeric scores are paid LLM output (never regenerate casually — page prose is rule-based LLM-0).
9. ISR pages need `generateStaticParams(){return[]}` + `unstable_cache`; ⚠️ never put time seeds in cache keys; unstable_cache can null-poison 404s (throw on error); live-HTML audits right after deploy hit stale cache — verify code first + cache-buster.
10. AGENTS.md/SPEC.md and the `jobs`/`questions`/`pipeline_config` admin pages are LEGACY — reuse the auth/layout pattern and `content_events` audit logging, not the data model.

Key files: `docs/RUNBOOK-new-film-ingestion.md`, `docs/BACKLOG.md`, `docs/RUNBOOK-bigbang.md`, `00-INDEX.md`, `middleware.ts`, `lib/admin.ts`, `app/admin/layout.tsx`, `app/admin/metrics/page.tsx`, `hourly/now-playing-watch.sh`, `hourly/pipeline/produce.py`, `hourly/ledger.md`, `hourly/poller/state/seen.json`, `worker/gsc-daily-watch.sh`, `auto-deploy-watch.sh`, `worker/film-extract-batch.py`, `worker/trope-incremental.py`, `worker/apply-sql.py`, `score/cinecodex_score.py`, `curation-handover/02-phase0/phase0_origin_backfill.py`, `Outputs/figure_seo/RUNBOOK.md`, `check-batches.command`, `vercel.json`, `.env.local`.