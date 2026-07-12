# The Film Factory — operator quickstart

Canonical design + rationale: **`../HANDOFF-영화공장.md`**. This is the how-to-run card.

The factory turns a title (or a CSV of titles) into fully-integrated metatake.net pages with
minimal human touch. It runs **on the Mac** (Terminal) — the sandbox blocks Anthropic egress and
git push, which is why everything is `.command`/`python3` you run yourself.

## Layout
```
factory/manifest.json      the process definition (47 stages) — machine canonical
factory/coupling-map.json  Sentinel's path→stage reverse index
factory/sql/*.sql          stage SQL (assertions applied as migrations 0081/0082; curation/sentence = source)
factory/intake/            drop titles.csv here
factory/logs/              run reports + usage ledger
factory/HOLD               create this file to stop the watchers
worker/factory.py          the orchestrator CLI
worker/factory-sentinel.py the self-updating sentinel (§11)
worker/sentence-refresh.py worker/tv-build-playlists.py   stage runners
run-factory-{plan,run,status}.command   double-click launchers
factory-watch.sh factory-sentinel.sh restart-watchers.command   nohup loops
```

## Add films
```
python3 worker/factory.py add "Renoir (2025)" --director "Chie Hayakawa" --tier full
python3 worker/factory.py enqueue factory/intake/titles.csv         # cols: title,year,director,tmdb_id?,tier?
```

## Run
```
python3 worker/factory.py plan            # DRY: cost estimate + stage plan + R1/cost-gate warnings
python3 worker/factory.py run --run <id>  # executes the manifest (LLM batches + publish)
python3 worker/factory.py review          # R1: approve/reject low-confidence resolves
python3 worker/factory.py status          # run + intake + stage matrix
python3 worker/factory.py verify --run <id>
python3 worker/factory.py gaps            # data-drift: films missing expected outputs
python3 worker/factory.py garden-queue    # what to hand the quarterly garden pass
python3 worker/factory.py lint            # manifest structural check (also run by the sentinel)
```
Admin view: **`/admin/factory`** (read-only + approve/reject buttons; execution stays on the Mac).

## After a reboot
```
./restart-watchers.command    # re-nohups every watcher (launchd is TCC-blocked from ~/Documents)
```

## Decisions in force (HANDOFF §16): auto-tier banned · Tier-2 IS scored · quarterly garden ·
Sentinel auto-applies only low-risk · film-features off · $50 cost gate · Q&A register-only · clips in-factory.

## ⚠️ Before the first real run — read HANDOFF §17.4 "잔여" + the BUILD STATUS block: the sentence
pattern SQL and the to.W comment builder are documented gaps (safe no-ops until their canonical SQL
is extracted); the remaining §7.13 worker scoping patches (asset/next/catalog/release/wd-honors) are
still needed for a clean bulk run.
