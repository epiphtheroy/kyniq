#!/usr/bin/env bash
# ============================================================
# Metatake — Trope consolidation: app redirects + home repoint.
#   DB is already migrated: 935 reading meta-takes folded into the figure_type trope
#   layer (now 1,421 tropes), readings retired with merged_into, and home_bundle()
#   rewritten to build the home from tropes (so the home no longer 500s).
#   This commit ships the matching app changes:
#     • app/take/[slug]/page.tsx      — /take/* permanently redirects to its /trope/*
#     • app/meta-takes/page.tsx       — temporary redirect to /tropes (layer rebuilt later by bold-takes)
#     • app/random/meta-take/page.tsx — fallback now /tropes
#     • components/HomeClient.tsx      — hero pair links /take → /trope ("Open this trope")
#     • components/HomeConstellation.tsx — map node links /take → /trope
#     • components/MetatakeNav.tsx     — drop the now-empty "Meta takes" nav item
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

if [ -f .git/index.lock ]; then echo "▶ Removing stale .git/index.lock"; rm -f .git/index.lock; fi

for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  nvmbin="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$nvmbin" ] && PATH="$nvmbin:$PATH"
fi
export PATH

git add "app/take/[slug]/page.tsx" "app/meta-takes/page.tsx" "app/random/meta-take/page.tsx" \
        "components/HomeClient.tsx" "components/HomeConstellation.tsx" "components/MetatakeNav.tsx"
echo "▶ Staged:"; git diff --cached --name-only

git commit -m "Trope consolidation: fold readings into tropes — /take→/trope 301, /meta-takes→/tropes, home repointed to tropes"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~2 min). Then hard-refresh metatake.net (Cmd+Shift+R)."
echo "   Home shows trope pairs; old /take/* reading URLs 301 to their /trope/*."
echo "Press Enter to close..."; read -r _
