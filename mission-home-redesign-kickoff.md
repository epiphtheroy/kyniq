# Mission — Home & page redesign (media + activity density)

> Enhancement pack, part 3 of 3. Paste **after the media curator (part 2)** has populated media.
> Frontend/design work — no schema changes.

---

## Intent (read this first)
The current home is flat: no imagery, simple layout. Compare a dense, dynamic reference like
Genius — its energy comes not just from *having* images but from **layout density, visual
anchoring, and a sense of live activity**. We now have the raw material (TMDB imagery + YouTube
embeds from part 2 + real questions/answers/activity). This mission turns that material into a
**vivid, alive home** — **without** drifting into a generic template look and **without**
breaking the editorial design system or performance (which protects GEO). Two modules are both
in scope: a **media module** (visual anchoring) and an **activity module** (Genius-style
liveliness).

## Context
Read `AGENTS.md` and `SPEC.md` §6.2 (home), §2.1–§2.2 (the editorial design system + component
inventory), §3.3 (media), §8 (SSR/ISR + performance + schema). Evolve from `ref-home.html` as the
starting point, but make it markedly richer. Keep the **navy/paper/oxblood** palette, **Fraunces
/ Newsreader / Hanken**, hairlines + whitespace — *density, not clutter*; never a stocky AI
look.

## Do
1. **Media module (visual anchoring).** Use the part-2 media as the visual spine of the home: a
   featured hero (a strong film backdrop/still behind an editorial question), film cards carrying
   poster/backdrop imagery, and question cards that show their attached image/video thumbnail.
   All imagery is **published TMDB media** only; YouTube as click-to-load facade thumbnails.
2. **Activity module (liveliness).** Genius-style density with real, server-rendered data:
   **Recently improved** (canonical answers just edited/published), **Active now**, **Questions
   needing a reading**, **Trending films**, and **Notable readings / contributors**. Make the
   site feel like something is happening.
3. **Carry the treatment through.** Apply a backdrop hero to film pages (§6.3) and the media
   gallery to question pages (§6.1), consistent with part 2's rendering — so the vitality isn't
   only on the home.
4. **Design discipline.** Strong typographic hierarchy, generous but purposeful whitespace,
   hairline dividers, accent (oxblood) used sparingly. Dark mode (incl. the logo swap). Responsive
   / mobile-first. Distinctive and editorial, not a dashboard template.
5. **Performance & a11y (non-negotiable — protects GEO).** SSR/ISR intact (view-source shows real
   content); lazy-load + sized images; YouTube facade only (no eager iframes); no layout shift
   (reserve image dimensions); Core Web Vitals green under real seeded data. Alt text from media
   captions/attribution; color contrast; keyboard navigation; one `<h1>` per page.

## Verify (all must pass)
- The home is visibly **dynamic** — real TMDB imagery anchors it and the activity modules show
  live, real data (no placeholders) — yet still reads as the Kyniq editorial brand, not a generic
  template.
- Film pages have an image hero; question pages show the media gallery; treatment is consistent.
- SSR confirmed (primary content in view-source); **Core Web Vitals green** under seeded data;
  no CLS from images/embeds.
- Only **published** media/content appears (no drafts); dark mode + mobile both correct.
- A11y pass: alt text present, contrast OK, keyboard navigable, single H1.

## Do not
Use non-TMDB images or web-scraped imagery; eager-load YouTube iframes; break the editorial
design system, SSR, or GEO; ship a generic/templated look; show unpublished media.
