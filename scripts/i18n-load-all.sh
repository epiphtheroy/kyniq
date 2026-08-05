#!/bin/zsh
# i18n-load-all — upsert every finished Korean batch into content_i18n.
#
# OWNER-RUN. Service-role writes are blocked in the agent sandbox, so this is the
# one step a session cannot do for itself. Idempotent (upsert by PK): safe to
# re-run, safe to run while later corpora are still translating.
#
#   ! zsh scripts/i18n-load-all.sh            # load
#   ! zsh scripts/i18n-load-all.sh --dry      # count only, no writes
#   ! zsh scripts/i18n-load-all.sh --gentle   # 250-row chunks, 1.5s apart
#
# ⚠️ After the 2026-08-06 saturation incident: use --gentle on a database that is
# still recovering. ~22,500 rows then take about 2.5 minutes instead of seconds,
# which is the right trade when the site has just been down.
set -u
export PATH="$HOME/.local/node/bin:$PATH"
cd /Users/jerryje/Developer/MetaTake
DRY=${1:-}

# tow_segments are BUILD MATERIAL — the reader never sees them; tow_assembled is
# the 6,837 finished rows built from them. Loading segments too would be dead
# weight in the table, so it is deliberately excluded.
CORPORA=(
  tow_assembled
  repolish_laconic
  repolish_trope_title
  dfacts_items
  dfacts_intro
  dfacts_meaning
  portrait
  repolish_invitation
)

for c in $CORPORA; do
  d="data/i18n/out/$c"
  if [ ! -d "$d" ]; then echo "· $c — not translated yet, skipping"; continue; fi
  echo "\n── $c ──"
  node scripts/load-content-i18n.mjs --locale ko --dir "$d" $DRY 2>&1 | tail -3
done

echo "\n── verify ──"
echo "Not run automatically — it costs ~16 count queries."
echo "When the database is healthy: node scripts/i18n-verify.mjs --confirm"
