# START HERE — FilmCurio bundle

Everything for the FilmCurio build, in one place. Read top to bottom; you rarely need every file
at once. (Full detail map: `00-INDEX.md`.)

---

## 1) Read first
- **`00-INDEX.md`** — the complete map of every file.
- **`SPEC.md`** — the single source of truth (product, design system §2, pages, schema/SEO).
- **`AGENTS.md`** — standing rules for whoever/whatever builds it.
- **`REBRAND-HANDOFF.md`** — if handing the rename to another AI: old→new mapping + every codebase
  touchpoint (incl. the admin logo) + verification.

## 2) Brand & design (copy these into the app)
- **`brand/`** — the logo + favicon set and **`brand/brand-guide.md`** (palette, type, logo usage).
  Start by opening **`brand/contact-sheet.png`** to see the identity at a glance.
- **`globals.css`** — design tokens + component classes. The reference screens link to this; copy
  it into the app as the base layer.

## 3) Reference screens — how it should look (open alongside `globals.css`)
**Use these two as the canonical redesigns:**
- **`ref-home-v2.html`** — home.
- **`ref-question-v2.html`** — question page.

**Global chrome + the finished About page:**
- **`ref-chrome.html`** — the shared header & footer.
- **`ref-about.html`** — the finished `/about` copy (incl. the honest AI disclosure).

**Supporting screens** (same system): `ref-home.html`, `ref-film-page.html`,
`ref-question-page.html`, `ref-director.html`, `ref-profile.html`, `ref-ask-flow.html`,
`ref-signup.html`, `ref-settings.html`, `ref-question-media.html`.

> Tip: open any `ref-*.html` from this folder so it can load `globals.css`. The logos and image
> placeholders are built in, so no other files are needed to preview.

## 4) Content engine & editorial (how answers get made)
- **`content-engine-overview.md`** — the 3 worker loops + lifecycle.
- **`pipeline-prompts.md`** — the prompt pack.
- **`editorial-voices.md`** — the anonymized writing voices.
- **`prompt-design-changelog.md`**, **`redesign-home-and-question.md`** — supporting notes.

## 5) Build missions (do in order)
- **`mission-00-kickoff.md`** → **`mission-10-kickoff.md`** (plus `06b`, `08b`, `09b`).
- Named tracks: **`mission-home-redesign-kickoff.md`**, **`mission-media-embed-kickoff.md`**,
  **`mission-pipeline-worker-kickoff.md`**, **`mission-qa-kickoff.md`**.
- **`pre-launch-checklist.md`** — run before going live.

---

### One-line status
Brand, design tokens, all reference screens, the `/about` page, and every spec/mission/doc are on
the FilmCurio system (navy + ivory, marigold/teal, Reddit Sans; mark + wordmark). Contact email:
**wonwoo@metatake.net**. Domain: **filmcurio.com**.
