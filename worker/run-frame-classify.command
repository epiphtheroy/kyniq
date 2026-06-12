#!/bin/zsh
# FilmCurio — Frame classification, Loop 5 (IA §8-3). Double-click to run.
# Classifies unclassified published questions into the frame ontology.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ -x /usr/bin/python3 ] && xcode-select -p >/dev/null 2>&1; then
  /usr/bin/python3 frame-classify.py "$@" 2>&1 | tee frame-classify.log
else
  python3 frame-classify.py "$@" 2>&1 | tee frame-classify.log
fi
echo; echo "Press Enter to close..."; read -r _
