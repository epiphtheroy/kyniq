> 📍 **정본 인덱스: [`HANDOFF-now-플레잉.md`](../../HANDOFF-now-플레잉.md)** — Now Playing 전체 체계·불변식·결정 로그. 작업 전 먼저 읽으세요.

# Now Playing — running the machine

All stdlib Python 3; no pip installs. Everything reads creds from the repo's `.env.local`. The Claude Code sandbox has no network — these run on the Mac directly (cron/launchd) or with sandbox disabled.

## The three commands

```bash
cd /Users/jerryje/Documents/MetaTake/hourly

# 1. Entity cache (daily) — films/directors/theorists for the beat gate
python3 poller/sync_entities.py

# 2. Detection only (Phase 0 dry run) — signals/ snapshot + poller/dryrun.log.md
python3 poller/poller.py

# 3. Full hourly production — detect → select → write → gate → publish
python3 pipeline/produce.py          # real run (auto-publishes!)
python3 pipeline/produce.py --dry    # stops before publish; draft JSON into drafts/
```

## Phase 0 protocol (start here — no LLM cost, no publishing)

Run `poller.py` hourly for 3–5 days (cron below). Then read `poller/dryrun.log.md`: it shows, per hour, what the machine *would have chased* (mechanical scores: spike + corroboration + beat). Tune `config.json` thresholds against it. Only then switch the cron to `produce.py`.

## Cron (simplest)

`crontab -e`:

```cron
# Now Playing — Phase 0 (detection only)
0 * * * * cd /Users/jerryje/Documents/MetaTake/hourly && /usr/bin/python3 poller/poller.py >> poller/cron.log 2>&1
15 6 * * * cd /Users/jerryje/Documents/MetaTake/hourly && /usr/bin/python3 poller/sync_entities.py >> poller/cron.log 2>&1

# Phase 2 — swap the first line for full production:
# 0 * * * * cd /Users/jerryje/Documents/MetaTake/hourly && /usr/bin/python3 pipeline/produce.py >> poller/cron.log 2>&1
```

(macOS: grant `cron` Full Disk Access in System Settings → Privacy, or use launchd. The Mac must be awake — consider `caffeinate` or Amphetamine for 24/7 operation, or move the cron to a small VPS later; the scripts only need the repo folder + `.env.local`.)

## Kill switch & knobs

- **`touch hourly/HOLD`** — stops all publishing instantly (delete to resume).
- Daily cap: `DAILY_CAP` in `pipeline/produce.py` (hold rule: stays 4 until FORECAST §4 conditions met).
- Publish threshold: `MIN_MECH` / `MIN_CORR` in `produce.py`; feed list + geos in `poller/config.json`.
- The exception lane (figure-rhyme on off-beat news) is **manual by design** — the automated path only runs the direct beat.

## Env contract (`.env.local` — present ✓ / needed ○)

| Var | Status | Used for |
| :-- | :-- | :-- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | reads (entities, data packs) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | insert into `now_articles` |
| `ANTHROPIC_API_KEY` | ✓ | selector (sonnet) · writer (opus-4-8 + web search) · gate (sonnet) |
| `NEXT_PUBLIC_SITE_URL` | ✓ | links, revalidate, IndexNow |
| `REVALIDATION_SECRET` | ○ optional | instant ISR refresh after publish (without it, pages refresh within ~2 min anyway) |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL` | ○ optional | auto-post per piece |
| `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD` | ○ optional | auto-post per piece |

## Where things land

- `signals/YYYY-MM-DD-HHMM.json` — every detection snapshot (velocity memory)
- `poller/dryrun.log.md` — human-readable per-run candidate log
- `ledger.md` — PUBLISHED / PASS / KILLED, one line per hour slot
- `drafts/dry-*.json` — output of `--dry` runs
- live: `metatake.net/now` · `/now/feed.xml` · `/news-sitemap.xml` · `/sitemaps/now.xml`
