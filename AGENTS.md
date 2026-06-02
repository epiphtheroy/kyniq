# AGENTS.md

This repository is built by AI agents. **Read `SPEC.md` in full before any task.** SPEC.md is
the single source of truth; this file is the short standing brief that applies to every task.

## Golden rules
1. **Follow SPEC.md.** If a request conflicts with it, stop and flag it instead of guessing.
2. **Do not change the tech stack** (SPEC §2): Next.js App Router (TypeScript) with SSR/SSG +
   ISR, Supabase (Postgres/Auth/RLS), Tailwind, Vercel, TMDB. No client-only SPA, no framework
   swaps, no ORM swaps.
3. **GEO is the product priority** (§8). Every public page is server-rendered. Never weaken
   SSR/ISR, QAPage JSON-LD, robots.txt, or the sitemap to ship a feature faster.
4. **One mission at a time** (§13). Deliver exactly that mission's scope and pass its *Verify*
   steps. Do not scope-creep into later or deferred work.

## Design system (do not improvise)
- All styling comes from `globals.css` (design tokens + component classes, §2.1/§2.2). Copy it
  into the app as the base layer; do **not** redefine colors, fonts, or radii, and never add
  drop shadows.
- Palette: `--ink #1A2740` (brand navy), `--bg #FAF7F0` (warm paper), `--surface #FFFFFF`,
  `--muted #5E6675`, `--hairline rgba(26,39,64,.14)`, single `--accent #8A2A21` (oxblood).
  Dark mode via `prefers-color-scheme`. Accent appears only in the ~6 places SPEC names.
- Fonts: **Fraunces** (display/titles), **Newsreader** (reading body — answers), **Hanken
  Grotesk** (UI).
- **Match the reference screens** — open/render them and reproduce layout & proportion (not the
  placeholder copy): `ref-home`, `ref-film-page`, `ref-question-page`, `ref-director`,
  `ref-profile`, `ref-ask-flow`, `ref-chrome` (global header/footer), `ref-signup`,
  `ref-settings`, `ref-about` (all `.html`).
- Reuse the §2.2 components. One primary action per screen. Separate with hairlines +
  whitespace, never boxes or cards.

## Brand & icons (§1.1)
- Brand: **Kyniq · kyniq.io · contact.kyniq@gmail.com.**
- The logo is the **wordmark asset, never re-set in a font.** Header/footer use
  `kyniq-wordmark.svg` (+ `kyniq-wordmark-dark.svg` for dark mode). Full lockups:
  `kyniq-logo.png` / `-dark.png` / `-paper.png` (OG/social/About).
- Copy all `kyniq-*` and `favicon.*`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`
  into `/public`, and wire them + a `site.webmanifest` in the root `<head>`.

## Domain invariants (§3, §3.1)
- A question belongs to **exactly one film**. Two answer layers: a single editable **canonical
  answer** + a stream of **contributions**.
- **Upvote-only. There is no downvote anywhere** — not in UI, API, schema, or ranking.
- Sort contributions by `sort_score` (§7.1). Promotion (merge into the canonical answer) is the
  strongest quality signal. Participation is frictionless; quality comes from curation, not
  gatekeeping.

## Content lifecycle & roles (§3.2, §4, §6.13)
- **Only `status='published'` rows are public** — RLS, sitemap, and JSON-LD. Draft / in_review /
  hidden / rejected must never reach anon clients or crawlers. Don't add a public read path that
  ignores `status`.
- AI-authored content is **server-side only** (service role / SECURITY DEFINER RPC, never the
  public client), attributed to the **"Kyniq Editorial"** `system` profile (or a small, fixed,
  disclosed set of editorial voices), and follows **generate → verify → publish** with a
  confidence gate that routes uncertain items to the single `admin`. Log every step to
  `content_events`.
- **No sockpuppets (hard rule, §3.2):** never fabricate or rotate human-looking accounts to
  simulate a crowd, and never fake engagement (AI upvotes, invented "other readers," fake
  reputation/badges). AI content carries a transparent editorial byline; upvotes/contributions/
  reputation come from real users only. This is deception and would trigger the search/AI
  penalties the whole GEO strategy depends on avoiding.
- Quality over volume: respect the scaled-content-abuse guardrail (§3.2) — depth, uniqueness,
  review, and a publish rate-limit.

## Security & approval (§0, §15)
- Use **approval mode** for anything touching: auth, secrets/env, SQL migrations, RLS,
  robots.txt, deploy.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `TMDB_READ_TOKEN`) are **server-only** — never in the
  client bundle, never pasted into a prompt. `.env*` is gitignored; commit only
  `.env.local.example`.
- Treat agent-generated SQL as code: review before applying. Run a dependency audit + a basic
  secret scan before each deploy.

## Deferred — do NOT build unless a mission explicitly says so
- Ads (Mission 11).
- @-mentions, actor pages, and the mention-tagged director layer (Mission 12). The **v1
  director hub** (directed films only, no mentions) ships in Mission 8b.
- pgvector semantic relatedness (v2) and co-engagement (v3): v1 relatedness is metadata-only
  (shared director / genres / keywords / era + `question_type`).

## Conventions
- TypeScript throughout. Route and file names follow the §6 URL structure.
- Small, reviewable commits per mission; reference the mission number in the message.
- Never render a blank page: if a TMDB/Supabase call fails or data is missing, surface a clear
  empty/error state (and fail loudly in dev).
