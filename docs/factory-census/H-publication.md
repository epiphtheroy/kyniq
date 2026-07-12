# TASK H — PUBLICATION & FRESHNESS LAYER (metatake.net)

## 1. Sitemaps

**Architecture.** `app/sitemap.xml/route.ts` = sitemapindex (`revalidate = 3600`, `dynamic = "force-static"`) listing ~40 SECTIONS as `/sitemaps/{section}.xml`. Each child is a tiny route in `app/sitemaps/*.xml/route.ts` (`revalidate = 3600; dynamic = "force-static"`) calling one exported function from `lib/sitemap-data.ts` (1,011 lines). Master kill-switch: `SITE_INDEXABLE` (`lib/seo.ts`, currently `true`) — when false, index serves only `core` and every entry function returns `[]`. `pageRobots(meetsBar)` in `lib/seo.ts` is the on-page noindex mirror of every sitemap gate.

**⚠️ lastmod discipline** (file header): lastmod is emitted ONLY where an accurate content-event date exists; a lastmod that changes every build "teaches Google to distrust the field sitewide". Films use `max(last_processed_at, created_at)` — **content pipelines MUST bump `films.last_processed_at`** or enriched pages never earn a recrawl. Provider/locations/lineage data omit lastmod (wholesale refresh would churn it).

**⚠️ PostgREST 1,000-row cap**: `fetchAll()` pages every table query in 1,000-row chunks; a build-time DB failure is swallowed (`try/catch break`) so `next build` degrades to partial sitemaps instead of crashing — next hourly revalidation heals. `theoristEntries()` has an explicit code warning: `theorist_index` RPC is unpaged; roster near 1,000 silently drops URLs (~898 today).

**Cohorts** (`lib/seo.ts`, scaled-content-abuse guard): oldest-first, deterministic, raising a cap only APPENDS. `INDEX_COHORT_READINGS=2000`, `MISREADINGS=2000`, `FILM_CREDITS=1000`, `TROPES=1500`, `FIGURES=2000`, `CREW=1500`, `CATALOG=500`, `FILM_LOCATIONS=1000`, `FILM_HONORS=500`, `ESSAYS=300`, `ESSAYS_KO=300`. ⚠️ Release-log rule: raise ~weekly ×1.5–2 only on GSC evidence; cohort freeze until 2026-07-16 noted. Pages outside the cohort stay indexable — just unadvertised.

**Film-derived children — table/gate/behavior:**

| Child (fn in lib/sitemap-data.ts) | Source | Gate | lastmod |
|---|---|---|---|
| films.xml (`filmEntries`) | `films` | `visible=true` | max(last_processed_at, created_at) |
| movies-like.xml (`moviesLikeEntries`) | `films` | `visible=true` | none |
| qa.xml (`qaEntries`) | `questions` join films | `status='published'` + `film.visible` | published_at |
| figures.xml (`figureEntries`) | `figures`+`takes` | `figures.status='approved'`, ≥3 published takes, visible film, cohort | updated_at |
| essays.xml / essays-ko.xml (`essaysEntries`/`essaysKoEntries`) | `essays` join films | `lang`, `status='verified'`, `film.visible`, cohort 300 | published_at/created_at |
| misreadings.xml (`misreadingsEntries`) | `films` × `misreadingsEligibleSlugs()` | `visible` + `is_analyzed` + ≥1 published non-invitation take; eligibility `unstable_cache ["misreadings-eligible-1"]` **revalidate 86400** | last_processed_at |
| film-credits.xml (`filmCreditsEntries`) | `films` | `visible` + `tmdb_id not null`, cohort 1000 | last_processed_at |
| film-reception.xml (`filmReceptionEntries`) | `film_reception`, `film_wd_honors` | ≥1 reception row OR ≥3 honors — **any visibility (Tier-2 qualifies)** | latest reception created_at |
| locations.xml (`filmLocationsEntries`) | `loadLocationsEligibility()` (lib/locations.ts) | ≥3 merged pins (mirrors page 404 gate), cohort 1000 | none |
| honors.xml (`honorsEntries`) → /film/lineage/[slug] | `cachedLineageEligibility()` (lib/lineage.ts) | ≥3 `film_lineage` rows, any visibility, cohort 500 | none |
| takescore-films.xml (`sitemapTakescoreFilms`) | RPC `cinecodex_ranked` (p_limit 500 paging) | scored films only (roster = the RPC) | none |
| tv-programs.xml (`tvProgramEntries` + video variant `tvProgramVideoEntries`) | `tv_programs` (join films) | `status='published'`; video entry additionally needs thumbnail + `meta.clips[0]` | built_at |
| tv-lists.xml (`tvListEntries`) | `tv_playlists` | all rows | none |
| whereto.xml (`whereToEntries`) | `films`+`film_watch_providers`+`lib/access_enrichment.json` | visible + has provider row OR enrichment (keyed by tmdb_id) | none |
| directors.xml (`directorEntries`) | `films.director_slug` (visible) + `director_facts` | hub: any visible film; /life: ≥4 facts AND slug ∈ current visible-director set (orphaned facts from slug merges must never emit) | none |
| director-{start,next}.xml | `director_picks`/`director_next` | ≥3 rows per director | none |
| director-{takescore,honors,reception,theory,misreadings}.xml | `directorLayerEligibility` `unstable_cache ["director-layer-eligibility-2"]` **revalidate 86400** | ≥3/≥3/≥3/≥5/≥5 per director aggregated from film tables | none |
| genres.xml (`genreEntries`) | `films.genres` labels (no genres table) | ≥5 visible films per slug | none |
| now.xml (`nowEntries`) | `now_articles`/`now_digests` | `status='published'` | updated_at (content events only) |

Non-film-driven-but-frozen-artifact children: cities.xml ← `lib/atlas_cities.json` (**manual rebuild** `worker/atlas-cities-build.py`); credits.xml ← `lib/crew_index.json` (rebuild `worker/crew-index-build.py`, ≥3 catalog films). Movements gate ≥8 films (RPC `movements_index`); concepts via RPC `concept_index` + `sm_concept_index` (SM ≥3 readings); catalog via RPC `catalog_browse` ≥3 members; lineage lists ≥3 members; frames: `frames.status='approved'` + ≥1 primary published question; concept-domains via RPC `concept_domain_live` non-empty.

**How a new film enters/updates:** children are force-static ISR (3600s) — a newly `visible=true` film appears in films.xml/movies-like.xml within ≤1h (or next deploy build). Sub-surface entries lag by their eligibility caches (misreadings/director-layer = up to **24h**) and cohort caps (a new film created LAST sorts to the END of oldest-first cohorts — if the cohort cap is below the eligible count, the new film's misreadings/credits/essays URLs are NOT advertised until caps are raised; the pages are still indexable on-page if they clear the bar).

**news-sitemap.xml** (`app/news-sitemap.xml/route.ts`, revalidate 300): ONLY `now_articles` + `now_digests` from the last 48h. A new film enters news only if a Now Playing piece covers it.

## 2. IndexNow

- Doc: `docs/INDEXNOW.md`. Key `72623852f17d4eb341d4cd3755d3ba64`; key file `public/72623852f17d4eb341d4cd3755d3ba64.txt` (verified present). ⚠️ file must stay at site root; delete/move → all submissions rejected. ⚠️ `public/` is OUTSIDE the auto-deploy watcher — key file changes need manual commit.
- Script: `scripts/indexnow-ping.mjs` (`npm run indexnow -- --sitemap` | explicit URLs | `--dry-run`). Recursively expands the sitemapindex → all child `<loc>`s, dedupes, filters to host metatake.net, POSTs batches of 500 to `https://api.indexnow.org/indexnow` (200/202 = OK).
- Manual only — **no cron/hook fires IndexNow after a data load**. The factory needs an explicit post-publish ping step (GEO incremental doc `GEO_운영-신규영화-증분처리.md` step 2 codifies exactly this).
- **"405 issue" clarification**: no HTTP-405 error exists in the repo/docs. Memory's "IndexNow 405" = **405 URLs pinged** (director-start.xml 205 + director-next.xml ~199, per `~/.claude/.../memory/director-article-layer.md`); also `metatake_films_expansion_405.csv` = +405 films. Do not design around an HTTP 405.
- ⚠️ Don't re-submit unchanged URLs repeatedly (spam signal, per docs/INDEXNOW.md).

## 3. ISR / Caching

**Repo convention** ([[isr-caching-pattern]] confirmed in code): every dynamic `[slug]` page exports BOTH `export async function generateStaticParams() { return []; }` AND `export const revalidate = N`, with the heavy load wrapped in `unstable_cache`. New film pages are generated **on-demand at first request** (blocking render), then edge-cached for the revalidate window — no build/backfill step needed; GET-warming is the practice for bulk cohorts ([[tier2-bare-digest-backfill]]: "ISR 5분 자연갱신·시크릿 없어 GET 워밍").

**Revalidate windows (verified):**
- `/film/[slug]` (`app/film/[slug]/page.tsx`): `revalidate = 300`; loads under `unstable_cache(..., ["film-load7", slug], { revalidate: 300 })`, related `["film-t2-related", slug]`, plus tag `film:${slug}` on some caches.
- `/movies-like/[slug]`: 300. `/takescore/film/[slug]`: 300. `/film/[slug]/misreadings`: 3600. `/film/[slug]/[desk]` (+/ko): 3600 (inner caches 3600/86400). `/film/lineage/[slug]`: 86400. Sitemap children: 3600.
- `/api/map` (`app/api/map/route.ts`): response header `cache-control: public, max-age=120, s-maxage=600, stale-while-revalidate=3600`. `/api/search`: `s-maxage=300, swr=3600`. `/search` page: `unstable_cache(["omni-payload-1", term], { revalidate: 600 })`.

**Cache-key bump convention**: version suffix embedded in the key array — `"film-load7"` (7th shape), `"omni-payload-1"`, `"misreadings-eligible-1"`, `"director-layer-eligibility-2"`. Code comment at `app/film/[slug]/page.tsx:432`: *the Data Cache outlives deploys, so any payload-shape change requires bumping the key* ("v7: Tier-2 minimal payload adds afterlifeTab/afterlifeHonors"). ⚠️ Invariant ([[tier2-free-enrichment]]): changing the minimal payload shape without a key bump serves stale-shaped objects → runtime errors.

**⚠️ Cache hazards (all documented):**
- `unstable_cache` **null-poison 404**: a transient DB error cached as null 404s the page for the whole window — loaders must THROW on error, never cache null ([[live-audit-isr-cache-trap]], [[live-html-grep-and-cache-traps]]).
- **No time seeds in cache keys** (docs/PLAN-home-v8-rotation.md): hourly-changing keys = cold stampede; fetch retries ≤2 (3×400ms tripled a stampede; Supabase restarted twice 2026-07-11).
- **Live-audit trap**: auditing live HTML right after deploy hits the old cache → false diagnosis; check code first + cache-buster query.
- Maps can't be serialized into the Data Cache (film page comment) — convert to arrays.

**Latency to aggregate surfaces for a new film**: film page ≤5 min; hub/aggregate `unstable_cache` windows 300s–3600s; eligibility rosters (misreadings, director-layer, lineage/locations eligibility) up to 24h (86400); frozen JSON artifacts (atlas_cities.json, crew_index.json, access_enrichment.json) **never** without a manual worker rerun + commit.

## 4. i18n / content_i18n reconciler

**STATUS: PLANNED, NOT IMPLEMENTED.** Zero code references to `content_i18n` or `source_sha256` in app/lib/worker/supabase (grep verified). Canonical plan: root `HANDOFF-한국어화-i18n-마스터.md` — §6.4 reconciler query (detect `source_sha256` mismatch → stale), §6.5 workers: **cron-A** (collect+submit, every N hours; recommended 6–12h), **cron-B** (poll/harvest batches, hourly), **cron-C** (QA: 5% Opus sample, misses → `status='stale'` for re-processing). Cost lever = `effort=low` on the translation batches (~$220 full-corpus Opus estimate). Wave ⓪ (glossary — brand names stay English) is flagged 최우선.

**What IS live**: `/film/[slug]/[desk]/ko` pages served from `essays` table (`lang='ko'`, `status='verified'`); bidirectional hreflang via `alternates.languages { en, ko }` in both `app/film/[slug]/[desk]/page.tsx:187-190` and `.../ko/page.tsx:157-159`; sitemap child essays-ko.xml (cohort 300). **A new film gets NO Korean page automatically today** — requires a manual translation batch (worker/engine-translate.py exists for the essay pipeline) until the reconciler ships. Factory design should either implement the reconciler or add the plan's optional "generate ko immediately after en" hook (§ 'hourly/daily 즉시성' note: <1¢/item incremental).

## 5. search_aliases

- Builder: `worker/ko-aliases.py` — LLM-free, free-data. Films: `films.wikidata_id` → Wikidata `rdfs:label@ko` + `skos:altLabel@ko`; directors: `directors.tmdb_person_id` → Wikidata P4985 reverse → labels. Upsert-ignore on unique `(kind, slug, alias)` — **idempotent, safe to re-run wholesale**. Flags: `--dry`, `--limit N`. Feeds `search_all` v4 / `film_search` v3 (migration 0053).
- **New-film behavior**: lexical search reads `films` directly (English title + `word_similarity`), so a new film is searchable as soon as its row exists + search-RPC visibility filters pass — no alias step required for EN. Korean-title search ("기생충"→Parasite) requires (a) `films.wikidata_id` backfilled (worker/external-data.py per [[tier2-bare-digest-backfill]]) then (b) `ko-aliases.py` rerun. So the factory needs an alias step per batch, not per surface.
- ⚠️ Search invariants ([[unified-hybrid-search-live]]): adding a new `kind` requires frontend + RPC deployed together (`hrefOf undefined` → 500); room search filters `is_catalog`; semantic floors 0.35/0.27; IME guard. VERIFY whether the search RPC still excludes Tier-2 films ([[tier2-almanac-plan]] flagged "검색 RPC가 Tier-2 제외 중").

## 6. OG cards

- Single renderer `lib/og-template.tsx`: `ogCard({eyebrow,title,subtitle,backdropPath,posterPath,badges})` → 1200×630 `ImageResponse` (system fonts only, TMDB `image.tmdb.org/t/p` backdrop w1280/poster w500 behind gradient); `ogFallback()` (line 92) for missing art; constants `OG_SIZE`, `OG_CONTENT_TYPE`.
- Per-route `opengraph-image.tsx` files exist for `/film/[slug]` plus subpages (`[desk]`, misreadings, reception, `film/lineage/[slug]`, movies-like, takescore/film, theorist, catalog, blog, movements, ...). **Fully automatic per film** — driven by `films.backdrop_path`/`poster_path`; a film missing TMDB art gets `ogFallback()`, never a broken card ([[share-save-system]]: "OG 카드 미리보기 무결"). No factory step needed beyond ensuring poster/backdrop paths land on the films row.

## 7. robots.ts / llms.txt / feed.xml / /rag

- `app/robots.ts`: default-allow (Googlebot/Bingbot), explicit-allow AI answer/retrieval bots (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Claude-User), disallow-all for 17 TRAINING_BOTS (GPTBot, ClaudeBot, CCBot, Bytespider...). NOINDEX_PATHS = `/admin`, `/api`, `/search?*`, `/ask-ai` (repeated per group — robots groups are exclusive). Advertises `sitemap.xml` + `news-sitemap.xml`. No film dependency.
- `app/llms.txt/route.ts`: **hard-coded static string describing the RETIRED canonical-answer/community-readings model** ("One canonical answer per question", upvotes, /u/[username]) — **LEGACY content, no DB dependency**; should be rewritten by the factory era but has zero freshness coupling.
- `app/feed.xml/route.ts`: blog RSS only (`posts` table, `status='published'`, latest 50, revalidate 600). No film dependency.
- `app/rag/` + `app/api/rag/route.ts`: grounded RAG over the close-readings corpus; a new film surfaces once its takes/readings exist (retrieval-time, no publish step). Env: `OPENAI_API_KEY` (required), `ASK_MODEL`, `RERANK_PROVIDER`/`COHERE_API_KEY`/`VOYAGE_API_KEY`, `ACADEMIC_FURTHER_READING=1`+`ACADEMIC_MAILTO` (optional).

## 8. Deploy mechanics

- `auto-deploy-watch.sh` (repo root): polls `git status --porcelain -- app components lib` every 5s; after 20s quiet, `git add -- app components lib`, commit `"auto-deploy <ts>"`, push origin main → Vercel builds. Pause file: `.autodeploy-off` (repo root). Log: `.autodeploy.log`.
- **⚠️ Watcher scope = app/ components/ lib/ ONLY.** Manual commit required for: `middleware.ts` (bot sentinel — explicitly noted), `public/` (IndexNow key, TV prototype), `next.config.*`, `vercel.json`, `worker/`, `scripts/`, `hourly/`, migrations, root docs.
- **⚠️ Watcher races** ([[autodeploy-watcher-race]]): it deletes any `.git/index.lock` (clobbers other sessions' in-flight git ops); `.autodeploy-off` can be removed by other agents; after a git timeout, verify with `git log`. ⚠️ New CSS file + page must land in ONE commit or the watcher may push a half-state ([[takescore-screener-plan]]).
- **⚠️ Deploy-churn → sitemap DB overload** (docs/HANDOFF-SEO-마스터.md §19, verbatim mechanism): watcher commits per-file-burst → multiple deploys within ~2 min → each build concurrently prerenders all force-static `/sitemaps/*.xml` from the DB → overload → some builds fail with `Export encountered an error on /sitemaps/*.xml`; **if the LAST deploy is ERROR, changes never go live.** Remedy: after a wave, check Vercel `list_deployments` latest state; if ERROR, push an empty commit for a single clean build. Also: local builds don't render dynamic routes (`generateStaticParams()→[]`), so runtime verification must be live `curl`.
- `deploy-*.command` culture (~40 files at repo root): one-shot double-clickable scripts that `git add` an explicit file list + descriptive commit message + push — used for multi-file features, non-watched paths, and to avoid the watcher's generic message. Pattern per `deploy-connections.command`: `set -uo pipefail; git add <paths>; git commit -m "<feature>"; git push origin main`.
- Vercel: `vercel.json` pins `"regions": ["hnd1"]` (Tokyo, matches Supabase — the biggest latency fix). Build = plain push-to-main.

## 9. Cron / scheduled jobs inventory

| Job | Where defined | Cadence | Does |
|---|---|---|---|
| `/api/metrics/insights` | `vercel.json` crons | `*/30 * * * *` | metrics insights; calls RPC **`mt_detect_bots`** (line 50) = the Bot Sentinel 30-min detection → `bot_blocks` (24h TTL), consumed by `middleware.ts` (fail-open) |
| `net.metatake.nowplaying` | `~/Library/LaunchAgents/net.metatake.nowplaying.plist` | hourly :00 | `hourly/pipeline/produce.py` |
| `net.metatake.filmclips` | `~/Library/LaunchAgents/net.metatake.filmclips.plist` | daily 11:00 | `worker/film-clips-daily.sh` → `film-clips.py --persist --limit 70` (YouTube clips; live data, no deploy) |
| `hourly/now-playing-watch.sh` | repo, nohup loop | hourly | `produce.py`; PID `hourly/.watch.pid`, skip-file `HOLD`, single-instance guard |
| `worker/gsc-daily-watch.sh` | repo, nohup loop | `sleep 86400` | `worker/gsc-pull.py --persist --days 3` → `mt_gsc_daily`; PID `worker/.gsc-watch.pid` |
| `auto-deploy-watch.sh` | repo, nohup loop | 5s poll | deploy watcher (above) |
| system `crontab` | — | — | **empty** (verified) |

**⚠️ launchd/cron are TCC-blocked from reading ~/Documents** (observed 2026-07-09, documented in `hourly/now-playing-watch.sh` header — "Operation not permitted every hour"). The two launchd plists therefore likely fail or run degraded; the operative mechanism is the nohup-loop watchers started from a Terminal-context shell, which **do not survive reboot** (manual restart lines documented in each script). VERIFY filmclips plist actually succeeds (it writes `worker/film-clips-launchd.log`). No cron exists for: IndexNow, i18n reconciler (unbuilt), sitemap pings, atlas-cities/crew-index artifact rebuilds — all manual, all candidates for the factory's post-publish stage.

## Factory-relevant gap summary (post-data-landing checklist implied by this layer)

1. Flip/ensure `films.visible=true` and bump `films.last_processed_at` (sitemap lastmod + recrawl signal).
2. Wait/warm: film + movies-like + takescore pages self-generate on-demand (ISR ≤5 min); optionally GET-warm.
3. Rebuild frozen artifacts if thresholds crossed: `worker/atlas-cities-build.py` (cities), `worker/crew-index-build.py` (credits), `worker/access-enrich-build.py` (whereto enrichment) — these are lib/ JSONs so the watcher auto-deploys them.
4. Re-run `worker/ko-aliases.py` after `wikidata_id` backfill (Korean search).
5. Sitemaps self-update within 1h; eligibility caches up to 24h; cohort caps may hide new-film sub-URLs (oldest-first ordering) — raising caps is a deliberate weekly GSC-evidence decision, ⚠️ frozen until 2026-07-16.
6. `npm run indexnow -- <new URLs>` (manual; batch after publish, never re-ping unchanged URLs).
7. Korean content: no automation until the content_i18n reconciler (HANDOFF-한국어화-i18n-마스터.md §6) is built.
8. After any bulk wave: check Vercel deployment state for sitemap-export ERROR; empty-commit repush if the last build failed.