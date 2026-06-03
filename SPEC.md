# SPEC.md — Kyniq (kyniq.io)

A community Q&A platform for interpreting difficult films. Users pick a film, ask
interpretation questions ("What does X mean?"), and the community builds answers.
Each question has one continuously-improved **canonical answer** plus a stream of
voted **contributions**. Primary strategic goal: **visibility in AI answer engines**
(ChatGPT, Perplexity, Claude, Gemini, Google AI Overviews) and search. Revenue:
display ads, switched on *after* traffic exists.

Brand: **Kyniq** · domain **kyniq.io** · contact **contact.kyniq@gmail.com** (see §1.1).

---

## 0. How to drive this in Antigravity

- Drop this file at the repo root as `SPEC.md`. Also create an `AGENTS.md` that says
  "Read SPEC.md before any task. Follow the tech stack in §2 exactly. Do not switch
  frameworks."
- Dispatch the **missions in §13** one at a time in the Manager surface. Each mission
  lists a Deliverable and Verification steps the browser/terminal agent must complete.
- Use **review-driven (approval) mode** for anything touching auth, secrets, database
  migrations, robots.txt, and deploy. Use **agent-driven mode** for UI scaffolding and
  seed content.
- Antigravity agents run a real terminal and browser. Treat them like a junior engineer
  with a powerful laptop: never paste production secrets into a prompt; put them in
  `.env.local` and Vercel/host env settings, and add `.env*` to `.gitignore` in Mission 0.

---

## 1. Goals & non-goals

### Goals
1. Be **cited by AI answer engines** for film-interpretation queries (the priority).
2. Rank in classic search (SEO) as a secondary, reinforcing channel.
3. Accumulate durable, improving interpretations (a knowledge asset, not a feed).
4. Monetize later with display ads once traffic justifies it.

### Non-goals (v1)
- No paid memberships, no payments, no native mobile app.
- No real-time chat. No video. No DMs.
- Do not build a generic forum; the unit is **a question about one film**.

### Strategic principle (bake into every decision)
AI citation produces **zero-click** outcomes — users may read the synthesized answer and
never visit. This conflicts with ad revenue, which needs page views. Resolve by
**sequencing, not balancing**: phase 1 maximizes authority + citation + traffic; ads come
later. The on-page moat against zero-click is *depth* — multiple evolving interpretations
and the ability to contribute — which a one-paragraph AI summary cannot replace. Design
question pages so the canonical answer is the citable hook, but the full value (alternative
readings, discussion, "add your interpretation") lives on-page to earn the click.

---

## 1.1 Brand — Kyniq

- **Name:** Kyniq. **Domain:** kyniq.io. **Contact:** contact.kyniq@gmail.com.
- **Etymology / meaning (use in `/about`, OG copy, and the masthead tooltip):** Kyniq blends
  *Kino* (German/Russian for "film", a word cinephiles love) + *IQ* + *Unique*. It carries a
  double meaning: **intelligence (IQ) about film, and the question (Q)** at the heart of
  every page.
- **Logo (designed mark, adopted).** The logo is a custom geometric-sans wordmark "Kyniq"
  with an integrated **question mark** formed in the "niq" cluster — it literally encodes the
  "question (Q)" of the etymology, which is the strongest thing about the mark. Sentence case
  "Kyniq"; never restyle per page.
- **Brand palette (driven by the logo).** Logo ink-navy **#1A2740** is the brand's primary
  dark and is now the site `--ink` (§2.1); kept with the warm **cream paper** and the single
  **oxblood #8A2A21** accent → a navy / cream / oxblood editorial palette. (Deliberate: this is
  not generic tech-blue — deep navy on warm cream reads literary. If you ever want warmer body
  text, `--ink` is one token to change.)
- **Logo assets (in this folder; drop into Next.js `/public/`).** Transparent PNGs derived
  from the source:
  - `kyniq-wordmark.png` — wordmark only, navy → **header / nav** (light mode). Reference as
    `/kyniq-wordmark.png`.
  - `kyniq-wordmark-dark.png` — wordmark only, cream → header in **dark mode**.
  - `kyniq-logo.png` — full lockup with the "FILM INTERPRETATION COMMUNITY" descriptor →
    **footer, OG/`twitter:image`, About, auth screens** (light).
  - `kyniq-logo-dark.png` — full lockup, cream → the same, on dark backgrounds.
  - `kyniq-logo-paper.png` — full lockup composited on solid paper → OG/social where
    transparency isn't supported.
  - **Vector wordmark (scalable master):** `kyniq-wordmark.svg` (navy) and
    `kyniq-wordmark-dark.svg` (cream). These use a single traced path of the logotype — prefer
    them over the PNGs for header/footer; globals.css `.logo` loads them with a
    `prefers-color-scheme` swap.
  - **Favicon & app icons (in this folder; copy to `/public/`):** `favicon.svg` (navy tile +
    cream "K"), `favicon.ico` (16/32/48), `favicon-16.png`, `favicon-32.png`,
    `apple-touch-icon.png` (180, opaque square), `icon-192.png`, `icon-512.png` (PWA /
    `Organization.logo`). Wire them in `<head>` and a `site.webmanifest`. The mark is the
    logo's own "K" letterform, so favicon and wordmark stay visually one family.
- **Taglines — two roles, both kept.** "FILM INTERPRETATION COMMUNITY" is the **descriptor**
  baked into the logo lockup (self-explains the brand; good for OG + first-time visitors).
  "Read films closely." is the **editorial voice** line used in UI/footer copy. Don't merge
  them; they do different jobs.
- **Logo placement slots (reflect across the build):** global header (top-left, links home);
  footer; auth screens (centered above the card); favicon; OG/`twitter:image` and the
  `Organization` JSON-LD `name`/`logo` (§8); the email sender name.

---

## 2. Tech stack (do not substitute)

- **Framework:** Next.js (App Router) with **server-side rendering / static generation
  (SSG) + Incremental Static Regeneration (ISR)**. This is non-negotiable: question pages
  must ship full HTML so crawlers and AI fetchers parse them reliably. Do **not** build a
  client-only SPA.
- **Backend / DB / Auth:** Supabase (PostgreSQL + Auth + Row Level Security).
- **Hosting:** Vercel (native Next.js, easy ISR + sitemap + robots).
- **Styling:** Tailwind CSS + a lightweight component set. Keep pages fast and text-first.
- **External data:** TMDB API for film metadata.
- **Ads (later):** Google AdSense first; upgrade to a higher-CPM network after traffic
  thresholds are met.

Rationale the agent should respect: SSR/ISR drives the GEO strategy (§8). ISR also
refreshes a page's `dateModified` whenever the canonical answer is edited, which compounds
AI-citation probability (freshness multiplier).

---

## 2.1 Visual design system — editorial / literary

Direction: a film-journal aesthetic (mood references: Criterion, MUBI Notebook, Sight &
Sound). Refined minimalism executed with precision — the content is the design. Avoid
generic AI/forum aesthetics: no Inter/Roboto/system-font UI, no rounded-everything cards, no
purple-on-white, no drop shadows. Light "paper" is the core identity; ship a warm dark "ink"
mode too.

**Visual source of truth (same folder as this file).** The pixel-level reference is the set
of standalone files shipped alongside SPEC.md — load and match them before building any UI:
- `globals.css` — the tokens + base component classes below. Copy into the app
  (`app/globals.css` + a Tailwind theme extension); do not redefine colors/fonts elsewhere.
- Screen references, each linking `globals.css` — open/render them and match layout,
  proportion, and spacing: `ref-home.html`, `ref-film-page.html`, `ref-question-page.html`,
  `ref-director.html`, `ref-profile.html`, `ref-ask-flow.html`, `ref-chrome.html` (global
  header + footer pattern), `ref-signup.html`, `ref-settings.html`, `ref-about.html`.
The text in §2.1–§2.2 governs the rules; the reference files show the result. They are
hand-built mockups with placeholder copy — reproduce the look, not the sample text.

### Typography (load via Google Fonts)
- **Display** (site title, film & question titles, section headers): **Fraunces** — an
  optical-size old-style serif with character.
- **Reading body** (canonical answers + contributions — they read like essays):
  **Newsreader** — a serif built for on-screen long-form. Serif interpretive text is the
  brand signal: this is criticism, not a forum.
- **UI / chrome** (nav, buttons, metadata, badges, tabs, form labels): **Hanken Grotesk** —
  a quiet neutral grotesque so the serifs lead.
- Reading measure: cap body text at ~68ch. Body 18px / line-height 1.7, generous vertical
  rhythm. Section labels: Hanken Grotesk ~12px, letter-spaced, small-caps feel, above a
  hairline rule (magazine section markers).

### Color tokens (expose as CSS variables + Tailwind theme)
Light ("paper") — the default identity:
- `--bg` #FAF7F0 · `--surface` #FFFFFF · `--ink` #1A2740 (brand ink-navy, matches the logo) ·
  `--muted` #5E6675 · `--hairline` rgba(26,39,64,0.14) · `--accent` #8A2A21 (oxblood — links,
  primary CTA,
  active upvote, "merged" marker; used sparingly).
Dark ("ink") — warm, not blue-black:
- `--bg` #18150F · `--surface` #201C15 · `--ink` #ECE6DA · `--muted` #A39C8D ·
  `--hairline` rgba(236,230,218,0.14) · `--accent` #C8584A (brightened oxblood for AA).

### Components & details
- **Separation:** hairline rules + whitespace, not boxes and shadows. Shadows essentially
  none.
- **Radius:** small (4px). No pill-shaped cards — restraint reads as editorial.
- **Buttons:** understated — text/outline with an accent underline on the primary; no filled
  candy buttons.
- **Canonical answer:** styled like a printed essay — serif body, a thin rule under the
  question, an italic standfirst (the TL;DR), and a magazine-style credit line ("Last updated
  by … · read by N") set small in Hanken Grotesk. This is the one memorable, context-specific
  signature.
- **Badges / impact chips:** small, quiet, sans; the accent is reserved for the marquee
  ("Interpreter", "merged into the canonical answer").
- **Posters:** used sparingly and desaturated/muted to sit inside the palette; never dominate
  the text column.
- **Motion:** minimal — a gentle staggered fade on load, hover underlines. No flashy effects.

Implementation rule: the agent must not introduce off-token colors, extra fonts, or shadows.

---

## 2.2 Component inventory (reuse these — do not reinvent per screen)

Every screen is composed from this fixed set. The agent must not introduce new component
styles, extra fonts, off-token colors, or shadows. All references are to the §2.1 tokens.

**Structure & type**
- `PaperShell` — page container: `--bg`, `--ink`, 1px `--hairline` border, 6px radius,
  generous padding (~30px 34px on desktop). Reading column capped at ~68ch.
- `Rule` — the primary separator: 1px solid `--hairline`, ~18–20px vertical margin. Use rules
  + whitespace instead of boxed cards.
- `SectionLabel` — magazine marker: Hanken 11.5px, letter-spacing .13em, uppercase,
  `--muted`. Primary sections add a short accent tick beneath (34px wide, 2px `--accent`).
- `DisplayHeading` — Fraunces 500. Sizes: film/question title ~30px; in-list question
  17–18px; minor 15px. (The wordmark is the logo asset, §1.1 — not Fraunces text.)
- `ReadingBody` — Newsreader 18px / line-height 1.7 for answers (16–17px for teasers).
- `Standfirst` — the canonical TL;DR: Newsreader italic ~20px / 1.5, `--ink`.
- `CreditLine` — Hanken 12.5px `--muted`: the "Last updated by {user} · {date} · read by N"
  line; username in `--ink`.

**Actions**
- `PrimaryButton` — filled: `--accent` bg, `--bg` (paper) text, 4px radius, ~10px 20px
  padding. For "Ask a question", "Post question". One per screen.
- `PrimaryLink` — inline primary: text in `--accent` with a 1.5px `--accent` underline. For
  "Share your reading".
- `SecondaryAction` — Hanken ~13px `--muted` text ("Suggest an edit", "change", "Sign in").
- `Tabs` — Hanken 12.5px; active = `--ink` with a 1px `--ink` underline; inactive = `--muted`.
  Used for Top/Newest and Readings/Questions.

**Content rows & identity**
- `QuestionRow` — flex, space-between: `DisplayHeading` (17–18px) + status meta (Hanken 12px).
  Status `--muted` normally; `--accent` for invitations ("no reading yet ▸"). Hairline
  between rows.
- `AuthorChip` — initials avatar (circle, 1px `--hairline` border) + username (Hanken) +
  optional `Badge`.
- `Badge` — Hanken 12px, 1px `--hairline` border, 4px radius, `--muted`. Marquee variant
  ("Interpreter") uses `--accent` border + text; locked variant at reduced opacity.
- `MergedMarker` — small Hanken text in `--accent`: "merged into the canonical answer".
- `UpvoteControl` — Hanken; ▲ + count; active state in `--accent`. Upvote only — no downvote
  control exists.

**Inputs & media**
- `Field` — content inputs (question, reading) in Newsreader; search in Hanken. 1px
  `--hairline` border, 4px radius, `--surface` bg, placeholder `--muted`. No heavy chrome.
- `StepMarker` — ask-flow step heading: Fraunces 13px `--accent` ("01 — Pick the film").
- `PosterThumb` — small, 3–4px radius, desaturated/muted; never wider than a small fraction
  of the text column.

**Usage rules**
- One `PrimaryButton`/`PrimaryLink` per screen.
- `--accent` appears only on: the primary action, an active upvote, the merged marker, the
  Interpreter badge, invitation links, and the section accent tick — nowhere else.
- Separate with `Rule` + whitespace, never shadows or filled boxes.

---

## 3. Domain model (the core logic)

Each **Question** is anchored to exactly one **Film** (from TMDB) and has two layers:

1. **Canonical answer** — a single, collaboratively editable, version-controlled answer.
   It renders at the top of the page, is marked up as the accepted answer in structured
   data, and is what AI engines should cite. It is *maintained*, not voted. Because film
   interpretation is subjective, it is a **synthesis of the strongest readings** (multiple
   coexisting interpretations are welcome) — not a single verdict.
2. **Contributions** — individual user interpretations. Low-stakes by design: framed as
   "share your reading," there are **no wrong answers and no downvotes**. Each can be
   upvoted; they are ranked by a simple score (§7). These are the raw material.

**Promotion path:** high-scoring contributions are merged into the canonical answer by
trusted users (reputation-gated) or moderators. Voting decides *what is good*; the
canonical answer is *where good accumulates*. Every canonical edit creates a new revision
and updates `dateModified`.

This reconciles the two requested behaviors — "an algorithm surfaces the best answer" (the
ranking in §7 applied to contributions + the accepted/promoted signal) and "Genius-style
continuous update by the latest editor" (the canonical answer with revision history).

---

## 3.1 User logic & incentive design — READ FIRST (the strategy)

Two product goals: **high participation** and **quality answers**. They normally conflict.
The resolving principle: **participation is frictionless and always safe; quality is
achieved by curation, not by gatekeeping who may contribute.** Treat the *principles* below
as fixed; treat every *number* as a tunable default to adjust with data (over-specifying
numbers pre-launch is itself the complexity to avoid).

1. **Two separated acts.** "Share your reading" (contribute) is low-stakes and cannot be
   "wrong." "Canonical answer" is the clean, curated artifact. Free participation and
   refined quality coexist as layers on one page.
2. **Upvote-only — no downvotes.** Interpretation is subjective; downvotes chill
   participation and read as attacks. One positive signal ("insightful") keeps the UI clean;
   quality surfaces via relative upvotes + promotion. Abuse is handled by a quiet **flag**,
   never a public downvote.
3. **Reputation rewards quality received, not volume posted.** Points come from upvotes
   received and from promotion into the canonical answer — never from merely posting. Keeps
   incentives pointed at quality and prevents grind-spam.
4. **The core motivator is visible impact, not abstract points.** Surface "your reading was
   merged into the canonical answer," "read by N people," and (later) "cited in an AI
   answer." Seeing your interpretation become part of a widely-read, AI-cited definitive
   answer is the reward that fits this domain.
5. **Friction scales with quality stakes.** Read = none; upvote = one click (login);
   contribute = just write; ask = pick a film + a real question (light gate); edit canonical
   = reputation-gated. A simple, legible gradient.
6. **No empty questions.** Invite (don't force) the asker to add their first reading; the
   founder seeds canonical answers early; surface "no readings yet" questions as
   participation invitations.

**Curation sequencing.** v1: the founder/trusted curators maintain canonical answers
(guarantees quality before the community matures). As reputation accrues, editing opens up.
No complex system is needed on day one.

**Deliberately omitted in v1 (complexity guardrail — do not build these):** downvotes;
comment threads deeper than one level; a long reputation-privilege ladder (only four tiers,
§7.4); more than 6 badges; anti-gaming machinery; reputation decay. Add only when a real,
observed problem demands it.

---

## 3.2 Content lifecycle, provenance & the AI authoring pipeline

Operating model: **one human admin**; **AI drafts most questions and answers, runs a
verification pass, and publishes** — with a confidence gate that routes uncertain items to the
admin. The schema supports this via a publish lifecycle + provenance + an audit log (§4); the
admin oversees it from the console (§6.13). This must be designed now because it changes what is
publicly readable (RLS) and crawlable (§8).

**Lifecycle (status state machine)** on questions, canonical_answers, contributions:
`draft → in_review → published`, plus `rejected` and `hidden` (unpublished after the fact). Only
`published` rows are public (§4 RLS) and in the sitemap/JSON-LD (§8). Human-posted content is
created directly as `published` (frictionless, §3.1); AI-authored content enters as `draft`.

**Provenance** on each authored row: `source` (human / ai), `generated_by` (model/agent tag),
`reviewed_by`, `published_at`. AI content is attributed to the **"Kyniq Editorial"** house
identity (a `system`-role profile) — never fabricated human personas.

**The pipeline (server-side only; never the public client).** A job/service authenticated with
the Supabase **service role** (or SECURITY DEFINER RPCs) — bypasses RLS by design:
1. **Generate (draft).** For a target film, AI generates the **questions that emerge from the
   film itself** — the things a real viewer actually wonders about — and writes an answer for
   each, as `draft`, attributed to Kyniq Editorial. **No category/`question_type` taxonomy** —
   questions are not slotted into predefined buckets; several may cluster around one theme and
   that's fine. Reuse the §6.1 answer shape (answer-first TL;DR).
2. **Verify (검산).** A *separate* AI pass fact-checks the checkable claims (title, year,
   director, cast, plot facts) against TMDB / sources, scores a confidence, and writes a
   `content_events` row. Interpretive claims are not "verifiable" — the pass checks facts +
   coherence, not the correctness of a reading.
3. **Gate.** High confidence + clean checks → publish. Low confidence / factual conflict /
   flagged → stays `in_review` and goes to the admin queue (§6.13).
4. **Publish.** Flip to `published`, set `published_at`, trigger ISR revalidate + sitemap
   update (§8). Every step writes `content_events` (actor_kind = ai/system/human).

**Voice (conversational, deep).** Questions and answers read like **people talking** — a
thoughtful friend who has watched closely and thought hard, not an academic. Questions are phrased
the way someone would actually ask ("Why does she open the window at the end?"), not as essay
prompts. Answers are **theory-grounded underneath but plain-spoken on the surface**: depth and a
real critical framework inform the thinking, but the prose is accessible and conversational. (This
also matches how people query AI engines — a GEO advantage.)

**Autonomous operation (the run model).** The admin **uploads a curated film list once** (e.g.
~1,000 titles); an importer resolves each to TMDB and marks it `in_pipeline`. A **daily scheduler
in the worker then runs on its own** — selecting the next batch of unfinished films, generating
≥10 Q&A each, and publishing through the gate — **with no per-film manual trigger**. It works
through the list over days/weeks and can later deepen or refresh. The admin only uploads the
list, sets the **daily rate + ramp**, and reviews the gate queue. Pacing is not optional: see the
scaled-content caveat below. The worker writes a **heartbeat** (`agent_activity`) and a per-film
**run log** (`jobs`) so the admin can always see what it's doing now, what it did, and where the
latest outputs are (§4, §6.13).

**Authorship & attribution — no sockpuppets (hard rule).** AI-authored content must never
masquerade as independent, organic users. Do **not** generate or rotate fabricated human
accounts to make posts look like a crowd of different people — that is astroturfing: it deceives
real visitors, breaks fake-review/endorsement rules (e.g. the US FTC rule), and is exactly the
deceptive, scaled behavior search/AI engines penalize — which would sabotage the GEO goal this
project exists for. Instead, to avoid the "one robotic admin" feel honestly:
- Attribute AI content to a **transparent editorial identity** — never the admin's personal
  account. Simplest and safest: a single **"Kyniq Editorial"** byline. If you want visual
  variety, seed a **small, fixed, disclosed set of editorial voices** (≈3–5 named columns/
  sections), each openly labeled *AI-assisted, human-reviewed* and clearly under Kyniq's
  masthead — none posing as an unaffiliated member of the public, none implying independent
  third-party endorsement.
- **Never fake engagement:** no AI upvotes, no fabricated "other readers said," no invented
  reputation or badges. Upvotes, contributions, and reputation must come from real users only.
- Disclose the stance per page and on `/about` ("Drafted with AI, reviewed by the Kyniq
  editorial team"). The canonical answer is a *collective, openly-edited* artifact anyway — its
  authority comes from the content and the public revision history, not from pretending many
  strangers wrote it. This supports trust + E-E-A-T.

**Honest caveats (must respect):**
- **AI self-verification shares the generator's blind spots.** Keep the gate conservative and
  the human admin as the editorial backstop, especially early. Don't treat full autonomy as a
  given. Mitigation: run verification on a **different model provider/family** than generation.
- **Scaled-content-abuse risk.** Mass low-quality/duplicative AI pages can trigger search/AI
  spam penalties — the opposite of the GEO goal (§1). Prioritize depth, uniqueness, and review
  over volume; rate-limit publishing; spot-check. Quality is the moat.

**Runtime topology (the worker).** The pipeline runs as a **separate, always-on / scheduled
worker service** (e.g. Railway/Render/Fly or a cron job) — **not** inside the Vercel request
lifecycle (serverless time limits don't fit multi-minute, multi-model batch jobs). Integration
seam = the **database/queue**, not the website runtime: the worker reads a Supabase job queue +
the curated film list, runs the generate→verify→gate graph with a **multi-provider model
router** (model↔role mapping is admin-tunable config), writes `draft`/`in_review` rows +
`content_events`, and the existing `/admin` is the control plane (enqueue, status, pause/resume)
and review surface. Any agent/framework can play this role; it only needs to read the queue and
write to Supabase.

---

## 3.3 Media auto-embedding (images + video)

**Intent.** A film site should look like one. The home and question pages are currently flat;
relevant imagery and video give them vitality (the Genius reference) and add image/video search
surface (a GEO upside). A **media curator** — a step in the pipeline worker (§3.2) and a
background enrichment job for human-submitted questions — finds and attaches media to every
question.

Rules:
- **Image source = TMDB only.** Posters / backdrops / stills from the already-integrated TMDB
  data, with attribution. **No web-image scraping (e.g. "Google Images") and no user uploads** —
  both carry copyright/DMCA risk that would undermine a trust-based brand. (Wikimedia Commons
  optional later.)
- **Video = YouTube official embed** (iframe) + **YouTube Data API** search for relevant videos
  (trailers, video essays, interviews, scenes). Prefer official / reputable channels; skip
  embed-disabled videos. Embedding is the intended, low-risk path (no hosting on our side).
- **Auto-attach to every question** (no admin pre-approval), but through an **automated
  relevance + appropriateness filter** — must match the right film/question, and **must guard
  against spoilers** in video titles/thumbnails (critical for an interpretation site). The admin
  can remove/replace media **after the fact** (post-hoc moderation, §6.13).
- **Provenance + gate:** media rows carry `source`, `added_by` (ai/human), `confidence`,
  `status`; only `status='published'` media is public (RLS, §4). Attribution (TMDB, YouTube
  creator) always rendered.
- **Performance (protects GEO):** lazy-load images (TMDB CDN, sized); YouTube via a **lite
  facade** that loads the iframe on click — never eager-load heavy embeds. Add **ImageObject /
  VideoObject JSON-LD** (§8) for the search surface.

---

## 4. Data model (PostgreSQL / Supabase)

Create these tables (column lists are the essentials; add `id uuid pk default gen_random_uuid()`,
`created_at timestamptz default now()` to all).

- **films** — `tmdb_id int unique`, `title text`, `original_title text`, `year int`,
  `director text`, `director_slug text` (keys the v1 director hub, §6.12),
  `poster_path text`, `overview text`, `slug text unique`,
  `genres text[]`, `keywords text[]` (from TMDB — power film similarity, §6.11),
  `imdb_id text`, `wikidata_id text` (for entity `sameAs`, §8.8).
  (Cache TMDB data on first reference; refresh lazily.)
- **profiles** — `id uuid` (FK to auth.users), `username text unique`, `display_name text`,
  `bio text`, `avatar_url text`, `reputation int default 0`, `is_public bool default true`,
  `role text default 'user'` (user / admin / system — one human `admin`; `system` = the AI
  editorial identity, §3.2), `account_status text default 'active'` (active / suspended — for
  member management, §6.13).
- **questions** — `film_id FK films`, `author_id FK profiles`, `title text`, `body text`,
  `slug text unique`, `view_count int default 0`, and the **lifecycle/provenance fields** (§3.2):
  `status text default 'published'` (draft / in_review / published / rejected / hidden),
  `source text default 'human'` (human / ai), `generated_by text` (model/agent tag, null for
  humans), `reviewed_by uuid FK profiles` (null), `published_at timestamptz`. (No
  `question_type` / category taxonomy — §3.2.) Optional later: `embedding vector` (pgvector) for
  semantic relatedness.
- **canonical_answers** — `question_id FK questions unique`, `body text`,
  `updated_by FK profiles`, `updated_at timestamptz`, `revision_count int default 0`, plus the
  **lifecycle/provenance fields** (§3.2): `status text default 'published'`
  (draft / in_review / published / hidden), `source text default 'human'`, `generated_by text`,
  `reviewed_by uuid FK profiles`, `published_at timestamptz`. (Verification detail lives in
  `content_events`, not here.)
- **answer_revisions** — `canonical_answer_id FK`, `body text`, `editor_id FK profiles`,
  `edit_summary text`, `created_at`. (Full history for rollback / anti-vandalism.)
- **contributions** — `question_id FK questions`, `author_id FK profiles`, `body text`,
  `upvotes int default 0`, `sort_score numeric default 0` (recomputed on upvote, §7.1),
  `merged_into_canonical bool default false`. (No downvote column — upvote-only.) Plus the
  **lifecycle/provenance fields** (§3.2): `status text default 'published'`, `source text
  default 'human'`, `generated_by text`, `published_at timestamptz`. (Human posts are created
  `published`; AI-drafted contributions enter as `draft` and go through the pipeline.)
- **comments** — `contribution_id FK contributions`, `author_id FK profiles`, `body text`.
  One level only (no nested threads); not ranked. Backs the §5 #2 / §6.1 comment feature.
- **votes** — `user_id FK profiles`, `contribution_id FK contributions`,
  unique(`user_id`,`contribution_id`). Upvote-only: a row's existence = one upvote;
  deleting it removes the upvote. No value column.
- **flags** — `user_id FK profiles`, `target_type text` (contribution/question),
  `target_id uuid`, `reason text`, `status text default 'open'`. Quiet abuse reporting —
  the replacement for downvotes in moderation.
- **edit_suggestions** — `canonical_answer_id FK`, `author_id FK profiles`,
  `proposed_body text`, `status text default 'pending'` (pending/approved/rejected),
  `reviewed_by FK profiles`.
- **badges** — `key text unique`, `name text`, `description text`, `tier text`.
- **user_badges** — `user_id FK profiles`, `badge_id FK badges`, unique pair.
- **people** *(fast-follow — see §6.12)* — `tmdb_person_id int unique`, `name text`,
  `department text` (Directing/Acting/…), `profile_path text`, `imdb_id text`,
  `wikidata_id text`, `slug text unique`. Cached from TMDB on first mention.
- **mentions** *(fast-follow)* — `source_type text` (question/contribution/comment),
  `source_id uuid`, `target_type text` (film/person), `target_id uuid`. The @-mention / tag
  graph that powers people pages and entity cross-links (§6.12, §8.8).
- **content_events** *(audit log — §3.2)* — `entity_type text` (question/canonical_answer/
  contribution), `entity_id uuid`, `event text` (generated / verified / published / edited /
  rejected / hidden / flag_resolved), `actor_id uuid FK profiles` (null for system),
  `actor_kind text` (human / ai / system), `meta jsonb` (verification confidence, checks,
  sources, model, notes). The trail for the AI generate→verify→publish pipeline and every admin
  action; enables rollback and accountability.
- **media** *(§3.3 — auto-embedded images & video)* — `entity_type text` (question / film),
  `entity_id uuid`, `kind text` (image / video), `source text` (tmdb / youtube), `external_id
  text` (TMDB file_path or YouTube video id), `url text`, `thumbnail_url text`, `caption text`,
  `attribution text`, `position int` (display order), `added_by text` (ai / human),
  `confidence numeric`, `status text default 'published'` (draft / published / hidden),
  `created_at`. Public read gated on `status='published'` (RLS). The curator writes these; the
  admin can hide/replace after the fact.
- **jobs** *(pipeline run log — §3.2)* — `id`, `film_id FK films`, `status text` (queued /
  running / done / failed), `current_step text` (planning / drafting / verifying / publishing),
  `questions_target int default 10`, `questions_done int default 0`, `cost numeric`,
  `error text`, `started_at`, `finished_at`, `created_at`. One row per film run; the timeline of
  what the worker did and is doing.
- **agent_activity** *(heartbeat — §3.2)* — a tiny table (effectively a singleton per worker):
  `worker_id text`, `state text` (idle / running / paused), `current_job_id uuid`,
  `message text` (e.g. "drafting 3/10 for {film}"), `today_published int`, `today_cost numeric`,
  `last_heartbeat_at timestamptz`. Lets the admin see **what the worker is doing right now**,
  even between events.

**Editorial identity (seed):** create one (or a small, fixed, disclosed set of ≈3–5)
`system`-role profile(s) — e.g. `kyniq-editorial` / "Kyniq Editorial" — that author AI-drafted
content, each labeled *AI-assisted, human-reviewed*. Never fabricate independent human personas
or fake engagement for AI output (§3.2).

**Row Level Security (must enable):**
- **Public read is gated on publication.** Anyone (incl. anonymous) may `SELECT` films, and
  questions / canonical_answers / contributions / comments / **media** **only where
  `status = 'published'`**, plus profiles where `is_public`. Draft / in_review / hidden /
  rejected rows are never publicly readable — and never enter the sitemap or JSON-LD (§8). This
  is what keeps unpublished AI drafts off crawlers and AI fetchers.
- `INSERT`/`UPDATE` on questions, contributions, comments, votes, edit_suggestions, flags: only
  authenticated users (`auth.uid() is not null`) and only as themselves. Human-posted
  questions/contributions are created already `published` (frictionless participation, §3.1).
  `media` is not client-writable — the curator (service role) writes it (§3.3).
- Direct `UPDATE` on canonical_answers: not client-writable — no anon/auth UPDATE policy. Edits
  go through a server route / SECURITY DEFINER function gated on `reputation >= 250` or `admin`
  (§7.4); in the early phase, restrict to the founder.
- **Admin & service:** the single `admin` (`role='admin'`) and the **server-side service
  role** may read/write all rows regardless of `status`. The admin console (§6.13) and the AI
  pipeline (§3.2) run with these; the public anon/auth clients never get elevated access.

---

## 5. Feature spec → maps to the 8 requirements

| # | Requirement | Spec | Acceptance (browser-agent verifies) |
|---|---|---|---|
| 1 | Ask by selecting a film | Ask flow opens a TMDB-backed film search; question stores `film_id` | Type "Mulholland", pick film, submit; question appears under that film |
| 2 | Comments | Contributions + one-level comments (no nested threads) | Post a contribution; it renders and is upvotable |
| 3 | All questions per film | `/film/[slug]` lists every question for that film | Film page lists all its questions, paginated |
| 4 | Film DB from TMDB | §10 integration; cache in `films` | New film reference creates a `films` row with poster/year/director |
| 5 | Only authenticated may post | Auth gate on ask/answer/vote/edit | Logged-out user sees "sign in to ask"; cannot POST (RLS blocks) |
| 6 | Home screen | `/` shows trending films, recent/active questions, top contributors | Home renders all three sections with real data |
| 7 | My questions + public profile | `/u/[username]` public; "my activity" view | Profile shows the user's questions, contributions, badges, reputation |
| 8 | Badges | §11 badge + motivation engine | Posting your first reading awards the "First Reading" badge |

---

## 6. URL structure (SEO/GEO-critical — clean, stable, human-readable)

Content:
- `/` — home
- `/film/[slug]` — film page, lists its questions  (slug = `title-year`, e.g. `inception-2010`)
- `/film/[slug]/q/[question-slug]` — the question page (the citable unit)
- `/u/[username]` — public profile (what others see)
- `/director/[slug]` — director hub (v1; directed films + their questions, §6.12)
- `/ask` — ask flow

Account & auth:
- `/signup`, `/login`, `/verify` — auth screens (§6.7)
- `/settings` — my page / account settings (§6.8); requires login

Institutional (footer):
- `/about`, `/contact`, `/terms`, `/privacy`, `/guidelines` (§6.9)

Slugs are permanent. If a title changes, keep the old slug as a 301 redirect. The global
header and footer (§6.6) wrap every page.

---

## 6.1 Question page — information hierarchy (logic, not visual design)

The question page is both the citable unit and the participation surface. Its hierarchy
serves three jobs in priority order: (1) deliver a clean answer instantly to AI/readers,
(2) invite participation, (3) make impact visible. Top to bottom:

1. **Film context strip** — poster, title, year, breadcrumb. Anchors the question to its
   film; doubles as internal-link SEO.
2. **Question** — title + body, asker + date.
3. **Canonical answer (the hero)** — opens with a 2–3 sentence direct answer (TL;DR,
   citation-optimized), then the synthesis of the strongest readings. Meta line beneath:
   "Last updated by {user} · {date} · read by {N}". Always topmost and visually dominant, so
   the page reads as a clean artifact no matter how busy the stream below is.
4. **Single primary CTA — "Share your reading"** — placed immediately after the canonical
   answer (peak-reaction moment). Low-stakes framing ("no right answer"). Logged-out →
   "Sign in to share your reading." Secondary actions (suggest edit / edit) appear here,
   small and privilege-gated.
5. **Contributions stream — "Readings from the community"** — tabs: Top / Newest only. Each
   item: body, author chip (with impact: badge + "merged into N canonical answers"), upvote
   button + count, and a "merged into the canonical answer" marker when promoted.
6. **Other questions about this film** — retention + internal links + more participation.

**Empty-state logic (the page must never look dead):**
- No canonical answer yet → "No synthesis yet — be the first to share a reading"; in the
  early phase show a founder-seeded answer as provisional.
- No contributions yet → the CTA becomes the hero ("Be the first to share a reading").
- Every state has something to *read* or something to *do*, visibly.

**Anti-clutter rules:** one primary CTA per page; the only action verb on a contribution is
upvote (no downvote, no reaction bar); comments one level deep; impact is shown in exactly
two places — the author chip and the canonical meta line.

---

## 6.2 Home page (`/`) — information hierarchy

Jobs in priority order: (1) orient a newcomer in one glance, (2) route participation to
gaps, (3) feed crawlers/AI fresh internal links and show the site is alive. Home is *not*
the main citation surface (question pages are) — keep it light. Top to bottom:

1. **One-line value + film search** — what this is, plus a search box to jump to any film.
   The single primary action is "find a film."
2. **Questions needing a reading** — the most important module: surface open questions with
   no/thin canonical answer as an invitation ("be the first to share a reading"). Converts
   lurkers and defends against cold-start (§3.1 #6).
3. **Active films & questions** — trending / most-discussed, for discovery + internal links.
4. **Recently improved answers** — canonical answers updated lately; shows the site evolving
   and gives crawlers fresh, freshly-dated links (ties to the §8 freshness loop).
5. **Notable contributors** — light recognition (impact, not a volume leaderboard); small.

Empty/early state: lean on a curated set of featured films + founder-seeded questions so
home never looks empty. Anti-clutter: one primary action (film search); at most these five
modules; no infinite feed.

---

## 6.3 Film page (`/film/[slug]`) — information hierarchy

Jobs: (1) be the hub for one film's interpretation and the SEO/AI target for "{film} meaning
/ interpretation" queries, (2) list all its questions (requirement #3), (3) drive asking and
answering. Top to bottom:

1. **Film header** — poster, title, year, director, short synopsis (TMDB). The H1 + metadata
   target the film's interpretation queries; a strong internal-linking node.
2. **Most-read interpretation** (optional highlight) — the film's top canonical answer, for
   immediate value and a citable anchor.
3. **Primary CTA — "Ask a question about this film."** One primary action.
4. **All questions for this film** — the body (requirement #3), sorted Most-discussed /
   Newest. Each row shows answer status (has a canonical answer? N readings) and flags
   unanswered ones as participation opportunities.

Empty state: few/no questions → founder-seeded questions + "ask the first question."
Anti-clutter: the questions list is the body; one ask CTA; movies are the only taxonomy
(no extra tags/categories).

---

## 6.4 Profile page (`/u/[username]`) — information hierarchy

Jobs: (1) make impact visible — the core motivator (§3.1 #4), (2) be the public profile
(requirement #7), (3) light social proof. A recognition surface, not a stats dump or a
volume leaderboard. Top to bottom:

1. **Identity + impact line** — avatar, name, bio, joined date, and in one line the impact
   summary: "merged into N canonical answers · readings read by N people · reputation X."
   Impact leads, not post count.
2. **Badges** — the six milestones (§11), with "Interpreter" as the marquee.
3. **Activity tabs** — "Readings" (their contributions; promoted ones flagged first) and
   "Questions" (their questions — requirement #7).

Privacy: public by default (`is_public`), with a private toggle. Anti-clutter: impact
metrics live only in the header line + badges; don't sprinkle counts elsewhere.

---

## 6.5 Ask flow (`/ask`) — step logic

Jobs: (1) keep asking low-friction to maximize participation, (2) apply a *light* quality
gate (a real film + a real question), (3) never create an empty question. One screen, three
light steps; authentication required.

1. **Pick the film** (TMDB search) — cannot proceed without one; anchors the question to one
   film.
2. **Write the question** — title required, body optional. Light framing nudges quality:
   "ask about meaning, symbolism, or intent — not trivia."
3. **Add your first reading (optional)** — invite, don't force, the asker to seed their own
   interpretation. If added, the question launches with one contribution already, so no page
   is ever empty (§3.1 #6).

Auth gate: must be signed in to submit; if not, prompt sign-in while preserving the draft.
Anti-clutter: minimal fields (film + title required, rest optional); no tags/categories —
movies are the taxonomy. The quality gate stays light; participation takes priority over
hard gatekeeping.

---

## 6.6 Global chrome — header & footer (wrap every page)

**Header (slim, editorial).** Left: the Kyniq wordmark logo asset (links home;
`kyniq-wordmark.png`, with the dark-mode swap, §1.1). Center/left: the film search (same control as home). Right: logged-out → `Sign in`;
logged-in → a small avatar that opens a menu (View profile · My activity · Settings · Sign
out). One row, hairline rule beneath, no nav clutter. The search is the only persistent
primary action in the chrome.

**Footer.** Hanken, muted, hairline rule above; three quiet groups + a baseline:
- **Kyniq** wordmark + tagline ("Read films closely.").
- **Links:** About · Contact · Community guidelines · Terms · Privacy.
- **Company:** legal entity name (placeholder until incorporated, e.g. "Kyniq") + registered
  address (placeholder) + contact email **contact.kyniq@gmail.com**.
- **TMDB attribution (required, §10):** "This product uses the TMDB API but is not endorsed
  or certified by TMDB." with the TMDB logo.
- **Baseline:** copyright line "© {year} Kyniq. All rights reserved." and the locale switcher
  (§12).

---

## 6.7 Auth screens (`/signup`, `/login`, `/verify`)

Small, centered, editorial cards (PaperShell, narrow). Minimal friction.
- **Sign up:** email + password, or Google OAuth. On submit → send verification email →
  land on `/verify` ("Check your inbox"). Username can be chosen here or on first visit to
  `/settings`. A single line links to Terms + Privacy ("By joining you agree to our Terms and
  Privacy Policy"). Note: the Terms include the contribution license in §6.9.
- **Log in:** email + password, or Google; "forgot password" link (Supabase reset flow).
- **Verify / reset:** simple status pages.
- **Draft preservation:** if a user hits a gate mid-action (ask / contribute / upvote),
  bounce them through auth and return them to the exact action with their draft intact.
- Posting requires a verified email (§7.4 Participant tier).

---

## 6.8 My page / account settings (`/settings`) — distinct from the public profile

Two different things, often confused:
- **Public profile** (`/u/[username]`, §6.4) = what *others* see. Read-only to others. When
  *you* view your own, show inline edit affordances that deep-link to settings.
- **My page / `/settings`** = what *you* manage. Login-required. Sections:
  1. **Profile:** display name, username, bio, avatar, and the `is_public` privacy toggle
     (controls whether the public profile is visible at all).
  2. **Account:** email + password (via Supabase Auth), connected Google account, sign out.
  3. **Notifications** (future): email/in-app prefs — ship a stub now (e.g. "notify me when
     my reading is promoted"); full system is deferred (see open edges).
  4. **Danger zone:** delete account. On delete, anonymize authored questions/contributions
     ("[deleted]") rather than hard-removing content others built on — protects the canonical
     answers and the knowledge asset. State this behavior to the user before deletion (and in
     the Privacy Policy).

---

## 6.9 Legal & institutional pages

> **Not legal advice.** This is a content checklist and page structure, not lawyer-drafted
> text. Because the site has user accounts, user-generated content, ads, and a global/EU
> audience, have a lawyer review the final Terms and Privacy Policy before launch.

- **`/terms` — Terms of Service.** Must cover at minimum: eligibility / minimum age (set one,
  e.g. 13+, or 16+ where required); acceptable use (the §6.9 community guidelines by
  reference); **a content license** — the single most design-critical clause: by posting,
  users grant the platform and other users a license to display, store, edit, adapt, and
  incorporate their contributions into canonical answers (our merge model depends on this; a
  copyleft-style attribution license such as CC BY-SA is the well-trodden precedent used by
  Stack Overflow / Wikipedia); moderation & removal rights; disclaimers / limitation of
  liability; governing law & jurisdiction (placeholder); changes-to-terms.
- **`/privacy` — Privacy Policy.** Must cover: what's collected (account email, profile,
  usage, cookies), why, and legal basis; third parties (Supabase, ad network, analytics,
  Google OAuth, TMDB); cookies & tracking; **AI crawler stance** (our robots.txt allows AI
  retrieval/training crawlers per §8 — disclose that public content may be indexed and used
  by AI systems); data-subject rights (access/delete — ties to the §6.8 delete flow) for
  GDPR/CCPA; data retention; contact for privacy requests.
- **Cookie / consent banner.** With ads + analytics + EU users, ship a consent mechanism
  (GDPR/ePrivacy): block non-essential cookies until consent; remember choice. Required
  before turning on ads (Mission 11).
- **`/about`** — what Kyniq is and why (the "read films closely" mission), the name's meaning
  (Kino + IQ + Unique — film intelligence and the question; §1.1), how the canonical-answer
  model works, and who's behind it. Doubles as an authority/E-E-A-T signal for §8.
- **`/contact`** — a simple form or the published email (contact.kyniq@gmail.com) + the
  company address.
- **`/guidelines`** — community standards (interpretive good faith, no spam, no abuse; how
  flagging and moderation work). Keep short.

All institutional pages use the editorial system (§2.1) and are server-rendered (good for
SEO and for AI/E-E-A-T trust signals).

---

## 6.10 System pages

- **404 / not-found** and a generic **error** page, both in the editorial style with a route
  back to search/home.
- **Global empty states** already handled per page (§6.1–§6.3); ensure no page renders blank.

---

## 6.11 Related questions & discovery (retention engine = the SEO/GEO link graph)

Goal: after reading, always offer an obvious next thing — to keep readers on-site *and* to
build the internal link graph crawlers/AI reward. This engine and the §8.8 content
architecture are the same system. Placement:
- **Question page, below the readings:** (a) **More about {film}** — other questions on the
  same film; (b) **Related readings** — questions about *similar films* (and, once embeddings
  land, semantically similar questions) across the catalogue. Cap ~5–6 each, editorial and quiet.
- **Film page:** **Related films** — same director / shared genres + keywords / same era.

Relatedness logic — phased (build v1 now, the rest later). **No question categories/`question_type`**
(§3.2) — questions are not tagged into buckets; relatedness comes from the film and (later) meaning:
- **Film similarity (v1, pure SQL on cached TMDB data).** Score by shared director
  (strongest), genre + keyword overlap, and era proximity; optionally cache TMDB's
  `/movie/{id}/similar`.
- **v1 related questions** = same-film list + questions on film-similar titles, ranked by
  engagement.
- **v2 semantic (pgvector) — the real cross-film engine.** Embed question title + canonical
  answer, store as a `vector` in Supabase; related = nearest neighbours by cosine. Captures
  "about the same idea" across films without any tags — and directly helps GEO by matching AI
  query fan-out (§8). Without categories, this is *the* way to do cross-film relatedness well, so
  prioritize it once there's enough content.
- **v3 co-engagement.** "Readers who explored this also explored…" once traffic exists.

Keep it clean: labelled sections, hard caps, no infinite "you may also like" walls.

---

## 6.12 People pages — directors & actors, and @-mentions (scoped)

The site stays **film-centric** — questions and answers are always anchored to a film. People
pages are *secondary views*, not a parallel Q&A system. Asymmetric by design (matches how film
interpretation actually works — auteur-weighted):
- **Director page (`/director/[slug]`) — IN v1.** A hub keyed on `films.director_slug`:
  header (director name + film count) → the films they directed, each linking to its film page
  with its question count → a roll-up of notable questions across those films. This
  *directed-films* view needs no @-mentions (each film already stores its director), so it
  ships in v1 as a real SEO/GEO pillar (§8.8). The *mention-tagged* layer (questions/answers
  that @-mention the director) is added later with mentions. (Co-directors: store the primary
  director for v1; multi-director handling lands with the `people` entity.)
- **Actor page (`/actor/[slug]`)** — lighter: **only** the questions/answers that @-mention
  them (no auto-filmography). Content-gated: don't publish/index until it has enough tagged
  items, to avoid thin pages (a real SEO negative).
- **@-mentions** — typing `@` in a question, answer, or comment opens a typeahead over films
  (already searchable) and people (TMDB `/search/person`, cached to `people` on first use);
  the chosen entity is stored in `mentions` and rendered as a link. This mechanism fills the
  tagged views and strengthens the entity graph.

**Scoping verdict.** v1 = film-centric **plus the director hub** (the directed-films view
above). The @-mention typeahead + people-entity caching is real added complexity and is **not
needed for the core loop**, so **@-mentions, actor pages, and the mention-tagged director
layer are a fast-follow (v1.5)** — not launch blockers.

---

## 6.13 Admin console (`/admin`) — single admin + content pipeline oversight

Auth-gated to `role='admin'`; `noindex`; never linked in public chrome. With AI producing most
content (§3.2), this console is the editorial backstop, not an afterthought — build it as its
own mission. Surfaces:
- **Review queue** — items in `in_review` (AI low-confidence or flagged). For each: the draft +
  the AI verification notes/confidence from `content_events`; actions = approve & publish, edit
  then publish, or reject. This is where the human gate happens.
- **Content management** — search any question / canonical answer / contribution (any status);
  edit, unpublish (`hidden`), delete (anonymize), and roll back canonical revisions (history
  exists, §7.4).
- **Members** — list users; suspend/reactivate (`account_status`); anonymize; adjust
  reputation; grant/revoke `role`. (One admin in v1; the model already supports more.)
- **Flags** — the user-report queue (`flags`); resolve → hide / keep / suspend author.
- **Pipeline controls** — **upload the curated film list** (once); set the **daily rate + ramp**;
  view progress (films done / remaining, questions per film, today's output, cost, confidence);
  pause/resume. The daily scheduler runs autonomously (§3.2) — no per-film manual trigger.
- **Activity log (observability).** Answers *what is the agent doing now, what did it do, and
  where are the outputs:*
  - **Now** — the `agent_activity` heartbeat: current state (running / idle / paused) and message
    ("drafting 3/10 for {film}"), today's published count + cost, and films done / remaining.
  - **Timeline** — reverse-chronological, **timestamped** stream of `content_events` + `jobs`
    events (generated / verified / published / failed …), each with actor and a **link to the
    item**. Filter by date / film / event / actor.
  - **Latest outputs** — quick links to the most recent **drafts** (review queue) and most recent
    **published** items, so the newest results are one click away.

Uses the same design tokens, but utilitarian density (tables, denser rows) is fine here — it is
a back-office tool, not the editorial reading view.

---

## 7. Ranking & edit-governance logic (write as concrete rules)

Upvote-only model (§3.1). All numeric values below are **tunable defaults** — start here,
adjust with data; do not treat them as fixed.

### 7.1 Contribution sort — "Top" (default)
With no downvotes, rank by upvotes with a mild freshness allowance so good late readings can
still surface and early posts don't ossify at the top:
```
sort_score = upvotes / pow(hours_since_created + 2, 0.4)
```
Recompute `contributions.sort_score` on every upvote (DB trigger or API route). Offer two
tabs only: **Top** (above) and **Newest** (`created_at desc`). No third sort.

### 7.2 Strongest signal = promotion
A contribution merged into the canonical answer is the de-facto best answer. Mark
`merged_into_canonical = true`, credit the author (+reputation, badge), and show a "merged
into the canonical answer" marker on the contribution — this is the key visible-impact
motivator (§3.1 #4).

### 7.3 Reputation — earned from quality received, never from posting
Events (tunable): contribution upvoted **+10**, contribution promoted **+25**, edit
suggestion approved **+15**, question upvoted **+5**. There is **no** point for merely
posting and **no** negative points (no downvotes exist). Reputation only unlocks editing
privileges (§7.4); it is not a public leaderboard that pressures volume.

### 7.4 Privilege ladder — exactly four tiers (keep it this simple)
1. **Participant** (authenticated + email-verified): ask, contribute, upvote, flag, and
   suggest edits to canonical answers (queued as `pending`).
2. **Editor** (`reputation >= 250`): edit canonical answers directly; promote contributions.
3. **Reviewer** (`reputation >= 1000`): approve/reject edit suggestions; roll back revisions.
4. **Moderator** (`is_moderator`, appointed): handle flags, remove abuse.
Early phase: tiers 2–4 are held by the founder/curators regardless of reputation, until the
community matures (§3.1 curation sequencing).

### 7.5 Canonical edit integrity
Every canonical change writes an `answer_revisions` row and updates `updated_at` +
`updated_by`. Show "Last updated by {user} on {date}" on the page (feeds E-E-A-T + the
freshness signal in §8). Provide one-click rollback to any prior revision.

---

## 8. GEO / AI-citation implementation (the priority — make it copy-paste)

Implement ALL of the following. Ordered by impact.

### 8.1 Server render every public page
Question, film, and profile pages must be SSG/ISR (not client-rendered). Use ISR with
on-demand revalidation triggered when a canonical answer is edited, so `dateModified`
updates immediately.

### 8.2 Structured data — `QAPage` JSON-LD on every question page
Inject this (filled with real data) into the page `<head>`:

```json
{
  "@context": "https://schema.org",
  "@type": "QAPage",
  "mainEntity": {
    "@type": "Question",
    "name": "{question.title}",
    "text": "{question.body}",
    "answerCount": "{contribution_count + 1}",
    "dateCreated": "{question.created_at ISO8601}",
    "author": { "@type": "Person", "name": "{author.display_name}" },
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "{canonical_answer.body as plain text}",
      "dateModified": "{canonical_answer.updated_at ISO8601}",
      "url": "{canonical permalink}",
      "author": { "@type": "Person", "name": "{canonical_answer.updated_by}" }
    },
    "suggestedAnswer": [
      {
        "@type": "Answer",
        "text": "{top contribution body}",
        "upvoteCount": "{upvotes}",
        "url": "{contribution anchor url}",
        "author": { "@type": "Person", "name": "{contribution.author}" }
      }
    ]
  },
  "about": { "@type": "Movie", "name": "{film.title}", "dateCreated": "{film.year}" },
  "inLanguage": "en"
}
```
Also add `Organization` and `BreadcrumbList` JSON-LD site-wide.

### 8.3 robots.txt — allow AI crawlers (place at `/public/robots.txt` or generate)
Default posture for this product is **maximize exposure** — allow both retrieval and
training crawlers. (If later you want to protect content from training, switch the GPTBot /
ClaudeBot / Google-Extended / CCBot lines to `Disallow: /`; never block the *retrieval*
bots or you vanish from AI answers.)

```
User-agent: *
Allow: /

# AI retrieval / search bots (must stay allowed)
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: Claude-User
Allow: /

# AI training bots (allow for max exposure; flip to Disallow to opt out of training)
User-agent: GPTBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: CCBot
Allow: /

Sitemap: https://kyniq.io/sitemap.xml
```
**Trap to avoid:** if you put the site behind Cloudflare, disable "Bot Fight Mode" or
allowlist these agents — it blocks PerplexityBot/ClaudeBot before your server sees them.

### 8.4 Bing indexing
ChatGPT's web search is Bing-powered. Submit the sitemap to **Bing Webmaster Tools** as
well as Google Search Console. Most teams forget this; it is required for ChatGPT citations.

### 8.5 Dynamic sitemap.xml
Generate from the DB — **only `status='published'` rows** (film + question + director-hub +
public-profile URLs); never include draft / in_review / hidden / rejected content (§3.2/§4).
Include `<lastmod>` from `updated_at`/`published_at`. Regenerate on publish/content changes.

### 8.6 llms.txt
Add `/public/llms.txt` summarizing the site and linking key sections. Low cost, uncertain
payoff — include it, don't rely on it.

### 8.7 Content shape for citation
- Each canonical answer should open with a 2–3 sentence **direct answer** (TL;DR), then
  detail. AI engines extract direct, well-structured answers.
- Show visible **author + dateCreated + dateModified** on-page.
- Keep pages fast (good Core Web Vitals): compress images, lazy-load below the fold.
- Quarterly: refresh high-value canonical answers (freshness compounds citations).

### 8.8 Content architecture — hub & spoke (topic clusters) + entity linking

AI engines and search reward a clear hub-and-spoke (pillar/cluster) structure with
disciplined internal linking. Build it explicitly (this is the §6.11 engine, viewed as SEO):
- **Hub = film page; spokes = its question pages.** The hub links to every spoke (lists all
  questions, §6.3); each spoke links back to the hub (breadcrumb + film header) and laterally
  to sibling and related spokes (§6.11). Bidirectional + lateral linking is the cluster
  pattern.
- **Higher hubs:** the **director hub (`/director/[slug]`) ships in v1** (§6.12) as a pillar
  aggregating a director's films + questions. Interpretive-type pages (e.g. `/readings/endings`)
  remain a v2 option.
- **Schema that expresses the hierarchy:**
  - Film hub: `Movie` schema + a `CollectionPage` / `ItemList` enumerating its questions, so
    crawlers see the hub's children.
  - Director hub: `CollectionPage` / `ItemList` of the director's films + questions (add
    `Person` + `sameAs` once the `people` entity exists, §6.12).
  - Every page: `BreadcrumbList` (Home › Film › Question).
  - Question page: `QAPage` (§8.2).
- **Entity linking (high-leverage, often missed):** on each film add `sameAs` to its IMDb and
  Wikidata URLs (pull `imdb_id` from TMDB `external_ids`; map to `wikidata_id`). This
  disambiguates the film as a known entity for Google/AI and raises citation / Knowledge-Graph
  odds. When people pages exist (§6.12), do the same for directors/actors (`Person` + `sameAs`
  IMDb/Wikidata) — but `noindex` thin person pages until they have enough content.
- **Heading & extraction hygiene:** one `H1` per page (the question or film title); `H2` for
  "The reading" / "Readings from the community" / related sections; answer-first (TL;DR) body
  (§8.7); concise, dated, semantic HTML.

---

## 9. Auth

Supabase Auth: email/password + at least one OAuth (Google). Require email verification
before a user can post. Gate ask/answer/vote/edit in both UI and RLS. Logged-out users get
full read access (critical for crawlers) and clear "sign in to participate" prompts.

---

## 10. TMDB integration

- Get a TMDB API key/read token; store as `TMDB_READ_TOKEN` (server-side only; never expose
  to the client).
- Endpoints: `/search/movie` (ask-flow film picker), `/movie/{id}` + `/movie/{id}/credits`
  (cache title, year, director, poster, overview into `films` on first reference).
- Build poster URLs as `https://image.tmdb.org/t/p/w500{poster_path}`.
- **Attribution requirement:** display "This product uses the TMDB API but is not endorsed
  or certified by TMDB." with the TMDB logo in the footer.
- Cache aggressively; do not call TMDB on every page view.

---

## 11. Badges & motivation engine

Reputation mechanics live in §7.3 (earned from quality received, never from volume). Badges
are *milestones*, not a grind — keep the set to **six** in v1 and reward quality/impact, not
post count.

- Evaluate badge rules in a Postgres function on relevant events.
- Starter badge set (exactly six):
  - First Reading — your first contribution (onboarding)
  - Interpreter — a reading of yours promoted into a canonical answer (the marquee badge)
  - Curator — an edit suggestion of yours approved
  - Resonant — one of your readings passes N upvotes (tunable)
  - Cinephile — questions/readings across 10 / 25 / 50 distinct films (bronze/silver/gold)
  - Keeper — you maintain a canonical answer that gets cited by an AI engine (add once
    detectable; ties motivation directly to the §8 goal)
- The strongest motivator is **visible impact**, not the badge itself: on the profile and as
  inline author chips, surface "merged into N canonical answers" and "readings read by N
  people." Add the "cited by AI" signal once detectable.
- Keep v1 rules simple; do not add anti-gaming machinery until a real problem appears.

---

## 12. Internationalization

- Next.js i18n routing: `/en/...` default, additional locales as `/{locale}/...`.
- Emit `hreflang` alternates and set `inLanguage` in JSON-LD per locale.
- v1 ships English only. Architect for translation now (locale-prefixed routes, no
  hardcoded UI strings — use a messages catalog). Add machine-translated canonical answers
  later to widen the citation surface in other languages; mark translated pages clearly and
  link back to the English source with hreflang.

---

## 13. Build plan — Antigravity missions

Dispatch in order. Each mission = one agent task with a reviewable Artifact.

- **Mission 0 — Scaffold.** Next.js (App Router) + Tailwind + Supabase client. `.gitignore`
  includes `.env*`. Deploy a hello-world to Vercel. Baseline `robots.txt` + empty
  `sitemap.xml`. *Verify:* live URL renders server-side HTML (view-source shows content).
- **Mission 1 — Data layer.** Create all §4 tables (incl. the lifecycle/provenance fields,
  `profiles.role`, and `content_events`) + RLS policies via SQL migration; the `handle_new_user`
  profile trigger; seed badges, a `system`-role **Kyniq Editorial** profile, and 5 films
  manually. *Verify:* anon `SELECT` returns only `published` rows; anon `INSERT` is rejected;
  draft/in_review/hidden rows are invisible to the anon key; `grep -i downvote` is empty.
- **Mission 2 — TMDB + film pages.** Film search, caching to `films` (incl. `genres`,
  `keywords`, `imdb_id`, `wikidata_id` if resolvable, and `director_slug` — for §6.11
  similarity, §8.8 entity linking, and the §6.12 director hub), `/film/[slug]` listing
  questions. *Verify:* searching a film creates a `films` row with poster/year/director,
  cached genres/keywords, and a `director_slug`.
- **Mission 3 — Auth + ask flow.** Supabase Auth (email verification + Google OAuth) and the
  auth screens `/signup`, `/login`, `/verify` + password reset (§6.7). `/ask` requires login,
  attaches `film_id`, and is kept **light and conversational** — just a title + optional context,
  **no category/type select** (§3.2); preserves drafts through the gate.
  *Verify:* logged-out POST blocked; sign-up sends a verification email; logged-in question
  appears under its film.
- **Mission 4 — Answers, contributions, voting, ranking.** Canonical answer block +
  contributions stream + upvote-only voting + the `sort_score` ranking (§7.1). *Verify:*
  upvotes reorder contributions by `sort_score`; there is no downvote control anywhere.
- **Mission 5 — Edit governance.** Canonical editing, `answer_revisions`, edit suggestions,
  reputation thresholds, rollback, "last updated by … on …". *Verify:* sub-250-rep user can
  only suggest; edit creates a revision; rollback restores prior body.
- **Mission 6 — Profiles, account, badges.** Public profile `/u/[username]` (§6.4), the
  `/settings` my-page (profile/account/privacy toggle/delete-account-with-anonymize, §6.8),
  and the badge engine (§11). *Verify:* first reading awards the "First Reading" badge;
  profile shows readings/questions/badges/reputation; `is_public=false` hides the public
  profile; deleting an account anonymizes its authored content rather than removing it.
- **Mission 6b — Admin console & roles.** The `/admin` console (§6.13), gated to `role='admin'`
  and `noindex`: review queue, content management (edit/unpublish/delete/rollback), members
  (suspend/anonymize/role), flags queue, and the `content_events` audit view. *Verify:* a
  non-admin gets 404/forbidden at `/admin`; the admin can move a `draft` item to `published` and
  back to `hidden`, and every action writes a `content_events` row.
- **Mission 7 — GEO layer.** SSG/ISR on all public pages, QAPage JSON-LD, robots.txt,
  dynamic sitemap, llms.txt, on-demand revalidate on canonical edit; plus the §8.8 content
  architecture — `Movie` + `CollectionPage`/`ItemList` on film and director hubs,
  `BreadcrumbList` site-wide, and `sameAs` to IMDb/Wikidata on films. *Verify:* view-source
  shows valid QAPage + breadcrumb + film/director ItemList JSON-LD; Rich Results / schema
  validator passes; editing a canonical answer updates the page's `dateModified` within
  minutes.
- **Mission 8 — Home, chrome & institutional pages.** Home sections (req. #6); the global
  header + footer (§6.6); the institutional pages `/about`, `/contact`, `/terms`, `/privacy`,
  `/guidelines` (§6.9); a cookie/consent banner; and `404`/error pages (§6.10). Core Web
  Vitals pass; TMDB attribution + copyright + company address in the footer. *Verify:*
  Lighthouse performance/SEO green; footer links resolve to real pages; consent banner gates
  non-essential cookies; a bad URL shows the styled 404.
- **Mission 8b — Related & discovery + director hub (v1).** "More about {film}" + cross-film
  "Related readings" based on **film similarity** (no categories, §3.2) on question pages;
  "Related films" (director / genre+keyword overlap / era) on film pages (§6.11). Plus the **v1
  director hub** `/director/[slug]` keyed on `director_slug` (directed films + their question
  counts + a
  roll-up of notable questions, §6.12) with its `CollectionPage` schema (§8.8). *Verify:* a
  question page surfaces same-film and same-type cross-film questions; a film page surfaces
  related films; `/director/[slug]` lists that director's films and their questions. (v2
  pgvector semantic + v3 co-engagement deferred.)
- **Mission 9 — i18n scaffolding.** Locale routing + hreflang + messages catalog, English
  live. *Verify:* `/en/...` resolves; hreflang present.
- **Mission 9b — AI content pipeline (§3.2).** A server-side service (service role / SECURITY
  DEFINER RPCs, never the public client) that **generates** drafts (question + canonical
  answer, attributed to Kyniq Editorial), **verifies** them (fact-check checkable claims vs
  TMDB/sources, score confidence, log to `content_events`), and **gates**: publish on high
  confidence, else route to the §6.13 review queue. Publishing flips `status='published'`, sets
  `published_at`, and triggers ISR revalidate + sitemap update. Include a publish rate-limit.
  *Verify:* a generated item appears as `draft` (invisible to anon); after verify+publish it is
  anon-readable and in the sitemap; a low-confidence item lands in the admin queue, not public;
  each stage wrote a `content_events` row.
- **Mission 10 — Seed content (run the pipeline).** Cold-start: run Mission 9b across an initial
  curated film set so pages aren't empty when crawlers arrive, with the admin reviewing a sample
  for quality (guard the scaled-content risk, §3.2). *Verify:* each seeded film has ≥3
  *published* questions with non-empty canonical answers, all attributed + audited.
- **Mission 11 — Ads (deferred).** Integrate AdSense only after meaningful traffic. Low ad
  density on question pages; never let ads regress Core Web Vitals. *Verify:* ad slots load
  without layout shift; page speed unchanged.
- **Mission 12 — @-mentions, tagged layer & actor pages (fast-follow, not v1).** `people` +
  `mentions` tables; an `@` typeahead over films + TMDB people; the **mention-tagged layer on
  the existing director hub**; actor page `/actor/[slug]` (tagged only, `noindex` until enough
  content); upgrade director hubs to `Person` + `sameAs` schema (§6.12, §8.8). *Verify:*
  `@`-ing a director in an answer links to their page and the answer appears in their tagged
  list; an actor page shows only its tagged Q&A. (The directed-films director hub itself
  already shipped in Mission 8b.)

---

## 14. Environment variables checklist

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only, never client
TMDB_READ_TOKEN=                  # server only
NEXT_PUBLIC_SITE_URL=https://kyniq.io
# Ads (Mission 11): ADSENSE_CLIENT_ID=
```

## 15. Security guardrails (Antigravity-specific)

- Run auth, RLS, migrations, robots.txt, deploy in **approval mode**; review each diff.
- Service-role key and TMDB token are server-only; never ship to the browser bundle.
- Have the agent run a dependency audit and a basic secret-scan before each deploy.
- Treat agent-generated SQL migrations as code: review before applying to a real DB.

---

## 16. Definition of done (v1)

A logged-out visitor can find a film, read its questions and a clean server-rendered
canonical answer with valid QAPage structured data; a logged-in user can ask, contribute,
vote, suggest/make edits per reputation rules, and earn badges shown on a public profile;
robots.txt allows AI retrieval bots; sitemap is submitted to Google + Bing; and an edit to a
canonical answer measurably updates the page's `dateModified`.
