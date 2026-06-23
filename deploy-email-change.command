#!/usr/bin/env bash
# Metatake — change contact email channel.wonwoo@gmail.com → wonwoo@metatake.net
# Site: footer, About, Contact, Privacy, llms.txt.
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add components/Footer.tsx app/about/page.tsx app/contact/page.tsx app/privacy/page.tsx app/llms.txt/route.ts
git commit -m "Change contact email to wonwoo@metatake.net (footer, about, contact, privacy, llms.txt)"
git push origin main
echo "✅ Pushed. Vercel rebuilds (~1-2 min)."
echo "Press Enter to close..."; read -r _
