# 00-INDEX — Kyniq handoff (read this first)

Everything needed to build **Kyniq** (kyniq.io) in Google Antigravity. Drop the files into the
repo as laid out below, then dispatch the missions in order.

---

## Repo layout (where each file goes)

```
repo/
├─ SPEC.md                      ← single source of truth (read in full)
├─ AGENTS.md                    ← standing brief the agent reads every task
├─ docs/
│  ├─ 00-INDEX.md               ← this file
│  └─ missions/
│     ├─ mission-00-kickoff.md  ← paste into Antigravity to start
│     └─ mission-01-kickoff.md
├─ design/                      ← VISUAL REFERENCE (not shipped); agents open/render to match
│  ├─ globals.css               ← also copied into app/globals.css by Mission 0
│  ├─ ref-home.html
│  ├─ ref-film-page.html
│  ├─ ref-question-page.html
│  ├─ ref-director.html
│  ├─ ref-profile.html
│  ├─ ref-ask-flow.html
│  ├─ ref-chrome.html           ← global header + footer pattern
│  ├─ ref-signup.html
│  ├─ ref-settings.html
│  ├─ ref-about.html
│  └─ (copy the kyniq-*/favicon* assets here too so the refs render)
└─ public/                      ← SHIPPED static assets (served at site root "/")
   ├─ favicon.svg  favicon.ico  favicon-16.png  favicon-32.png
   ├─ apple-touch-icon.png  icon-192.png  icon-512.png
   ├─ kyniq-wordmark.svg  kyniq-wordmark-dark.svg     ← header/footer logo (preferred)
   ├─ kyniq-wordmark.png  kyniq-wordmark-dark.png     ← raster fallback
   └─ kyniq-logo.png  kyniq-logo-dark.png  kyniq-logo-paper.png  ← full lockups (OG/About)
```

**One wiring note:** in `design/`, `globals.css` loads the logo by relative path so the
references render. When Mission 0 copies it to `app/globals.css`, switch the `.logo` background
URL to the site-root path `/kyniq-wordmark.svg` (and `/kyniq-wordmark-dark.svg`), since the
assets live in `/public`.

---

## File inventory

**Source of truth & agent brief**
- `SPEC.md` — the full product/architecture spec. Everything derives from it.
- `AGENTS.md` — short standing rules (stack locked, GEO-first, design system, domain
  invariants, content lifecycle, no sockpuppets, security/approval, deferred scope).

**Mission prompts** (paste into the Antigravity Manager, one at a time)
- `mission-00-kickoff.md` — Scaffold & deploy.
- `mission-01-kickoff.md` — Data layer (schema + RLS + seed).
- *(2–10, 6b, 9b: generate from SPEC §13 as you go, same format.)*

**Design system + references** (the look; agents reproduce, don't invent)
- `globals.css` — design tokens + component classes (navy `--ink #1A2740`, paper `--bg
  #FAF7F0`, oxblood `--accent #8A2A21`; Fraunces / Newsreader / Hanken).
- `ref-*.html` (10) — the screens: home, film, question, director, profile, ask flow, chrome
  (header/footer), signup, settings, about. Placeholder copy — match the *look*, not the text.

**Brand & icons** (`/public`)
- Wordmark: `kyniq-wordmark.svg` / `-dark.svg` (vector, preferred) + `.png` fallbacks.
- Lockups: `kyniq-logo.png` / `-dark.png` / `-paper.png` (full lockup w/ "Film Interpretation
  Community" descriptor — OG/social/About).
- Favicons/app icons: `favicon.svg`, `favicon.ico`, `favicon-16/32.png`,
  `apple-touch-icon.png`, `icon-192/512.png`. Mark = the logo's own "K".

---

## Content authorship policy (decide before Mission 9b)

AI drafts most questions/answers, verifies, and publishes (SPEC §3.2). To avoid the
"one robotic admin" feel **without deception**:
- AI content carries a **transparent editorial byline** — "Kyniq Editorial" (or a small, fixed,
  *disclosed* set of editorial voices), never the admin's personal account.
- **No sockpuppets, no fake engagement.** Do not fabricate/rotate human-looking accounts to fake
  a crowd; no AI upvotes, no invented "other readers." Upvotes/contributions/reputation are real
  users only. (This is an FTC/Google-spam landmine that would sink the GEO goal — see §3.2.)
- Disclose the AI-assisted, human-reviewed stance on `/about` and per page.

---

## Build order (SPEC §13)

Run in **approval mode** for anything touching auth, secrets/env, SQL migrations, RLS,
robots.txt, or deploy.

`0 Scaffold → 1 Data layer → 2 TMDB+film → 3 Auth+ask → 4 Answers/voting → 5 Edit governance →
6 Profiles/account/badges → 6b Admin console → 7 GEO layer → 8 Home/chrome/institutional →
8b Related+director hub → 9 i18n → 9b AI content pipeline → 10 Seed (run the pipeline)`

Deferred (build only when you choose): `11 Ads`, `12 @-mentions/actor pages`. Also deferred:
pgvector semantic relatedness (v2), co-engagement (v3).

**How to drive:** dispatch each mission as one task; it lists a Deliverable + *Verify* steps the
agent must pass before you close it. Don't let a mission scope-creep into later work.
