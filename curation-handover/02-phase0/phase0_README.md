# Phase 0 — origin country (DONE in-DB; TMDB finalizer ready)

## What ran (live, in the curation schema — no external calls)
`curation.film.country_code` now means **film origin**, derived from the cleanest in-DB signals
only — **director nationality (auteur lists) + own-country national canons** — with festival-host
and international critics'-poll lists *excluded*, plus a language-consistency guard
(an English film can't originate from a non-anglophone hub).

`origin_confidence` values: `confident` (single-country agreement) · `resolved` (co-production,
director-first) · `language` (original_language fallback) · `unknown` (no clean in-DB signal) ·
`api` (set by the finalizer below).

**Result:** ~2,600 films placed cleanly across **68 origin countries**; **22 live + 14 planned**
country hubs. QC-verified hubs read correctly (Korean = Parasite/Oldboy/Snowpiercer/Train to
Busan; German = Lives of Others/Das Boot/Run Lola Run; Taiwanese = The Assassin/A Sun/City of
Sadness). The rest (~4,000, mostly English-language titles on country-less global canons, and
atlas films with no language to guard) are `unknown` and need the authoritative source.

New DB objects: `curation.rebuild_country_hubs()` (idempotent: create/promote/demote hubs at the
12-film floor + rebuild memberships) and rules `origin_confidence`, `hub.membership`.

## The finalizer (run once on your machine) — `phase0_origin_backfill.py`
Why a script: the sandbox has **no internet** (TMDB unreachable here), and it's ~6.7k per-film
calls. TMDB `production_countries` is the authoritative origin and also corrects the few in-DB
leaks (e.g., Gran Torino still in `jp`).

```
pip install psycopg2-binary requests
# reads TMDB_READ_TOKEN from MetaTake/.env.local automatically; set the DB URL:
export SUPABASE_DB_URL="postgresql://...kyniq..."   # Supabase > Settings > Database > URI
python3 phase0_origin_backfill.py
```
It sets `country_code` from `production_countries`, marks `origin_confidence='api'`, and calls
`curation.rebuild_country_hubs()`. Expect Taiwan, Netherlands, Czech, Greece, Portugal, Turkey
etc. to fill out and (re)promote to live as their co-productions resolve.

After it runs, re-export `curation_hub.csv` (or read the table) for the final atlas.
