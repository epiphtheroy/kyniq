#!/bin/zsh
# ============================================================
# FilmCurio — Frame discovery (IA §8-1)
# Double-click to run. Embeds all published questions, clusters
# them, and writes frame-candidates.md / .json to the repo root.
# Read-only: NO database writes.
# ============================================================
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "▶ $(pwd)"
if [ -x /usr/bin/python3 ] && xcode-select -p >/dev/null 2>&1; then
  /usr/bin/python3 frame-discovery.py "$@" 2>&1 | tee frame-discovery.log
elif command -v python3 >/dev/null 2>&1; then
  python3 frame-discovery.py "$@" 2>&1 | tee frame-discovery.log
else
  echo "❌ python3 not found."
fi

echo
echo "✅ Done. See frame-candidates.md in the repo root."
read -r -p "Press Enter to close..."
