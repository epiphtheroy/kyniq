# Redesign — Execution Plan (from HANDOFF-MASTER-redesign.md)

Spec = `docs/HANDOFF-MASTER-redesign.md`. Mockups (source of truth for layout/interaction):
`index-redesign-finals/01-home … 06-latest-trending.html` + `blog-design/07…09` (also in repo root as `blog-index/post/subscribe.html`).

## Non-negotiable rules (apply to every wave)
- Tokens from `app/globals.css` only. **One red `#E3120B`**; trope areas teal `#167C6B`; no new accent colors.
- **Images in COLOR** — remove any grayscale (reverses the earlier b/w thumbnail guidance; e.g. RandomWall).
- **`via [figure]` and all titles/laconic/thesis/definition = REAL data** (no invention). Layout is real; placeholder copy/numbers get replaced by live RPC/query.
- Masthead = `components/MetatakeNav.tsx` (already correct); add **Blog** only in the blog wave.
- register badges → spec §7 mapping; entity colors (Latest/Trending) → §8.
- Keep mechanisms: rotating deck (7s rotate / 5min newBatch / hover-pause), catalogue (A–Z default, article-insensitive, sticky jumpbar, 3-col, row-click), Latest masonry + infinite scroll, home pair-hero + 10-gallery + counters + constellation.
- Messaging: **AI = measure/connect tool; reading = criticism. Never "AI wrote it / generated films."**

## Coordination with the in-flight big bang
Redesign is front-end (reads existing RPCs) → safe to build in PARALLEL with extraction. Data-heavy pieces
(home 10 pairs, trending ranks, director signatures) stay sparse until consolidation runs at ~1,957 films, then fill in.
Thin-content gate keeps figure-less films hidden. No conflict.

## Waves (each ends in a deploy)
- **W0 — Foundation:** color thumbnails (drop grayscale); confirm tokens. (quick)
- **W1 — Shared index pattern:** reusable `CardDeck` + `Catalogue` (A–Z/jumpbar/3-col/sort/row-click) components, applied to **Meta takes** (`/meta-takes`), wired to `meta_takes` + `meta_take_rankings` with real via-figure. Establishes the pattern.
- **W2 — Replicate index:** **Films** (`/film`), **Tropes** (`/tropes`, teal), **Directors** (`/director`, signature = ≥2-film recurring). Reuse W1 components.
- **W3 — Latest / Trending:** entity color-box masonry + infinite scroll (Latest); 4-area ranking + "more →" (Trending), ranks = films·via-figure (Takes shows 2-line snippet).
- **W4 — Home v6 "The Pair":** method bar (`.basis`), pair hero (2 unlike films + red line + shared meta-take via figure, 9s auto-rotate), 10-pair gallery, concept chain (Film→Figure→Take→Meta-take), 6 gauges (count-up), living constellation (Films⇄Figures), doors + Just-added + manifesto. Pairs from nearest-neighbour / `meta_take_rankings` defining cases.
- **W5 — Blog (`/blog`):** `posts` + `newsletter_subscribers` tables; `/blog`, `/blog/[slug]`, `/blog/subscribe`; post format (event→film·★, news para, red-left reading, "In Metatake" deposit, cutting-room floor, "Retrieved, not remembered"); internal=red / external=↗; email subscribe (index hero + mid-post + end + dedicated page, no popups); daily-send email HTML template; add **Blog** to nav. Email provider: TBD (see decision).

## Acceptance = spec §12 checklist.
