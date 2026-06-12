#!/bin/zsh
# FilmCurio — Frame import (IA §8-2). Double-click to run.
# Loads frame-candidates.json into frames/question_frames (candidate status).
# Requires migration 0011_frames_and_tags.sql to be applied first.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ -x /usr/bin/python3 ] && xcode-select -p >/dev/null 2>&1; then
  /usr/bin/python3 frame-import.py "$@" 2>&1 | tee frame-import.log
else
  python3 frame-import.py "$@" 2>&1 | tee frame-import.log
fi
echo; echo "Press Enter to close..."; read -r _
