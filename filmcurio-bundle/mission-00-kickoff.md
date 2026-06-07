# Mission 0 — Scaffold & deploy

> Paste this into the Antigravity Manager to dispatch the first mission. Run the deploy and any
> secret/env step in **approval mode**.

---

**Context.** Read `AGENTS.md` and `SPEC.md` (especially §0, §2, §2.1–§2.2, §8, §13, §14) before
starting. This is Mission 0 from SPEC §13. **Scope is scaffolding only — build no features
yet** (no DB tables, no auth, no ask flow; those are Missions 1+).

The design files are provided in the repo: `globals.css`, the `ref-*.html` reference screens,
and the brand assets (`filmcurio-*.svg/.png`, `favicon.*`, `apple-touch-icon.png`,
`icon-192.png`, `icon-512.png`). Use them; do not invent styling.

**Do:**
1. Initialize a **Next.js** app — App Router, **TypeScript**, ESLint — with **Tailwind CSS**,
   using the `/app` directory. Keep Server Components as the default; no SPA patterns.
2. Add the Supabase client (`@supabase/supabase-js` + `@supabase/ssr`) with server and browser
   helpers. **Do not create any tables yet** (Mission 1).
3. **Design system:**
   - Bring `globals.css` in as the base layer (tokens + component classes).
   - Load **Reddit Sans** (via `next/font` or the Google Fonts
     link already in globals.css).
   - Extend the Tailwind theme so utilities map to the tokens (`--bg --surface --ink --muted
     --hairline --accent`) and the three font families.
   - Build a **root layout** with the global header + footer exactly per `ref-chrome.html`:
     header logo = `filmcurio-wordmark.svg` (links home); footer = About / Contact / Community
     guidelines / Terms / Privacy links, company line (FilmCurio · address placeholder ·
     channel.wonwoo@gmail.com), the **TMDB attribution** sentence, and "© 2026 FilmCurio."
4. **Brand assets:** copy every `filmcurio-*` and `favicon.*` / `apple-touch-icon.png` /
   `icon-192.png` / `icon-512.png` into `/public`. Create `site.webmanifest` (name "FilmCurio",
   icons 192 + 512, `theme_color #16233F`, `background_color #FBF8F1`). Wire all icon `<link>`s
   + the manifest in the root `<head>`, plus default Open Graph / Twitter tags using
   `filmcurio-logo-paper.png`.
5. **Placeholder home (`/`)** that renders **server-side** and shows the FilmCurio masthead +
   "Read films closely." — enough to prove SSR and the design system. (Real home = Mission 8.)
6. **Config & hygiene:**
   - `.gitignore` includes `.env*`; commit a `.env.local.example` listing the §14 variables.
   - Baseline `app/robots.ts` (or `/public/robots.txt`) per §8.3 — allow the AI retrieval bots
     and reference `https://filmcurio.com/sitemap.xml`.
   - `app/sitemap.ts` per §8.5 (may return just `/` for now).
   - Set `NEXT_PUBLIC_SITE_URL=https://filmcurio.com`.
7. **Deploy to Vercel** (approval mode for deploy + env).

**Verify (all must pass before closing the mission):**
- `view-source` of the deployed `/` shows real server-rendered HTML — the masthead text is in
  the initial HTML, not injected by client JS.
- The page renders in the editorial design (navy `#16233F` on bright ivory; Reddit Sans + marigold/teal accents) and the header + footer match `ref-chrome.html`.
- The favicon appears in the browser tab; `/favicon.svg`, `/favicon.ico`,
  `/apple-touch-icon.png`, `/icon-512.png`, `/site.webmanifest`, `/robots.txt`, `/sitemap.xml`
  all resolve.
- `npm run build` succeeds with no type errors; `.env*` is gitignored (no secrets committed).

**Do not:** create database tables, auth, or any feature beyond the above.

---

*Next:* once Mission 0 verifies green, dispatch **Mission 1 — Data layer** (SPEC §13), then
proceed in order (2 → 3 → 4 → 5 → 6 → 7 → 8 → 8b → 9 → 10). Missions 11 (ads) and 12
(@-mentions / actor pages) are deferred.
