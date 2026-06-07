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
  reputation come from real users only. Deception here triggers the search/AI penalties the GEO
  strategy depends on avoiding.
- **No per-item human review (§3.2):** the automated gate is final. Verify is **corrective** (a
  different model family fixes → re-checks) and the rubric scorer triages quality;
  **when uncertain, HOLD (don't publish) — there is no human review queue.** Be strict on
  real-person claims (accuracy/defamation). Safety net = post-publish random re-audit + admin
  sampling + hide-any-item. Disclose honestly (no claim of per-item human review).
- **Positioning standard (§3.2):** Kyniq is the **deepest-insight** film resource. Every item
  climbs from rich *verified* facts/context to an **insightful conclusion**; fragmentary info
  alone fails. It must read as **genuine, expert viewing** (grounded specifics + apt *real*
  comparisons — never invented for effect) and stay **distinct per film/question** (no template;
  anti-repetition across ~10k items). The standard + all stage prompts live in
  **`pipeline-prompts.md`** (the moat).
- Quality over volume: respect the scaled-content-abuse guardrail (§3.2) — depth, uniqueness,
  review, and a publish rate-limit.
- **Pipeline runtime (§3.2):** the generator runs as a **separate worker** (not the Vercel
  request path), talks to Supabase via a **job queue**, writes `draft`/`in_review` rows, uses a
  **multi-provider model router** (model↔role mapping = admin config) with verification on a
  **different provider/family**. **Quality-first model policy:** prefer the **newest, most capable
  models** for the core stages (don't default to old/cheap), swappable in config. **Latency is
  expected and acceptable** — newest/reasoning models + the corrective loops make generation slow
  (seconds–minutes/film); the worker is **async/background, not user-facing**, so optimize for
  quality over speed and never put it on the request path. **Autonomous operation:** the admin uploads a curated film list
  once; a **daily scheduler self-feeds** through it (≥10 Q&A/film) with **no per-film manual
  trigger**. **No category/`question_type` taxonomy** — questions emerge from the film. **Voice
  is conversational and deep** — like a thoughtful friend talking, theory-grounded underneath but
  plain-spoken. `/admin` is the control plane (list upload, daily rate/ramp, progress, pause).
  **Voices** = the anonymized, original, conversational, citation-first set in
  `editorial-voices.md` (never name/imitate a real critic). **Observability:** the worker writes
  a `jobs` run log + `agent_activity` heartbeat + `content_events`; `/admin` shows Now / Timeline
  / Latest outputs. **Decoupled publishing:** generation fills an `approved` **buffer**; a
  separate **publisher** drips items to `published` on a **jittered** schedule (`scheduled_for`,
  random gaps, no bursts, daily cap + ramp, a film's questions staggered) — `published_at` is the
  real time, never backdated.
- **Pacing is mandatory (§3.2):** autonomously publishing ~1,000 films × 10 = ~10k pages is a
  scaled-content-abuse risk. Conservative daily cap + slow ramp + dedup/thin-content checks +
  periodic human spot-check. Quality and uniqueness over volume, always.
- **Media / Kyniqbot (§3.3):** images = **TMDB only** (no web scraping, no user uploads); video =
  **YouTube official embed + Data API**. **Kyniqbot** is a third worker loop — it auto-attaches
  media at generation (buffer) **and** on a **~3-hour sweep** of published questions lacking
  media — through an automated relevance + **spoiler/appropriateness** filter; admin moderates
  after the fact. Video renders as a **"Related on YouTube" module at the bottom of the question**
  (click-to-load facade). `media` is published-gated and service-role-written; always render
  attribution; lazy-load + reserve dimensions (no layout shift).

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
  (shared director / genres / keywords / era) — **no question categories** (§3.2); semantic
  embeddings are the cross-film relatedness path once content exists.

## Conventions
- TypeScript throughout. Route and file names follow the §6 URL structure.
- Small, reviewable commits per mission; reference the mission number in the message.
- Never render a blank page: if a TMDB/Supabase call fails or data is missing, surface a clear
  empty/error state (and fail loudly in dev).
