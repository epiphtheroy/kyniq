#!/bin/zsh
# ============================================================
# FilmCurio — Spoiler-guard backfill (re-audit loop)
# Double-click to run. Grades the newest 10 published Q&A with
# the Spoiler-gate rules and fills spoiler_level / title_spoiler
# / display_title / safe_hook. Never touches status or content.
# Output is shown here AND saved to worker/spoiler-backfill.log
# ============================================================
cd "$(dirname "$0")"

# Find node — double-click launches don't load the login shell PATH
export PATH="$HOME/.volta/bin:$HOME/.asdf/shims:$HOME/.local/share/mise/shims:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi
if ! command -v node >/dev/null 2>&1 && [ -f "$HOME/.zshrc" ]; then
  source "$HOME/.zshrc" >/dev/null 2>&1 || true
fi

echo "▶ $(pwd)"
if command -v node >/dev/null 2>&1; then
  echo "▶ runtime: node ($(command -v node))"
  node spoiler-backfill.mjs --limit 200 "$@" 2>&1 | tee spoiler-backfill.log
elif [ -x /usr/bin/python3 ] && xcode-select -p >/dev/null 2>&1; then
  echo "▶ runtime: python3 (/usr/bin/python3 — node not installed)"
  /usr/bin/python3 spoiler-backfill.py --limit 200 "$@" 2>&1 | tee spoiler-backfill.log
elif command -v python3 >/dev/null 2>&1 && python3 -c 'import sys' >/dev/null 2>&1; then
  echo "▶ runtime: python3 ($(command -v python3) — node not installed)"
  python3 spoiler-backfill.py --limit 200 "$@" 2>&1 | tee spoiler-backfill.log
else
  echo "❌ Neither node nor a working python3 found. Install Node.js (https://nodejs.org) and re-run."
fi

echo
echo "✅ Done. Log saved to worker/spoiler-backfill.log"
