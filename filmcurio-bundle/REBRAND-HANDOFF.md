# FilmCurio Rebrand & Design Handoff (Kyniq → FilmCurio)

**For:** the next AI/engineer working on this product.
**What happened:** the product was renamed **Kyniq → FilmCurio**. That rename triggered a full
visual rebrand — new logo, palette, and typeface — and a sweep across every spec, reference
screen, and content/pipeline string, including a finished `/about` page.

**This bundle (the spec/handoff folder) is already fully migrated and is the source of truth.**
Your job is to apply the *same* change everywhere it is not yet applied — chiefly the Next.js
codebase — and to verify nothing from the old identity survives. **Apply the look, not just the
name.** When in doubt, mirror the reference screens and `globals.css`; never reintroduce the old
tokens.

---

## 1. The change at a glance (old → new)

| Thing | Old (Kyniq) | New (FilmCurio) |
|---|---|---|
| Product name | Kyniq | **FilmCurio** |
| Wordmark (lowercase) | kyniq | **filmcurio** |
| Domain | kyniq.io | **filmcurio.com** (on Vercel; NS1/NS2.VERCEL-DNS.COM) |
| Contact email | contact.kyniq@gmail.com | **wonwoo@metatake.net** |
| AI byline (published answers) | "Kyniq Editorial" | **"FilmCurio Editorial"** |
| Media bot (stills + YouTube) | "Kyniqbot" | **"Curiobot"** |
| Lockup descriptor | "FILM INTERPRETATION COMMUNITY" | **"FILM Q&A COMMUNITY"** |
| Voice/tagline | "Read films closely." | "Read films closely." *(unchanged)* |
| Etymology | Kino + IQ + Unique | **film + curio** — a cabinet of cinema's curiosities; the "?" is the question |
| Logo | geometric "Kyniq" wordmark with a Q | **film-frame "?" mark** (navy tile, marigold film-cell dot) **+ lowercase Reddit Sans 700 "filmcurio" wordmark** |
| Typeface | Fraunces + Newsreader + Hanken Grotesk | **Reddit Sans** (one family, weight hierarchy) |
| Palette | navy / cream / oxblood | **navy ink #16233F + bright ivory #FBF8F1 + marigold #E0922A + teal #159A92** |
| Location | — | Seoul, Republic of Korea |
| Copyright | © 2026 Kyniq | **© 2026 FilmCurio** |

---

## 2. Canonical assets to copy into the app

- **`/brand/`** — the full logo + favicon set and `brand-guide.md` (palette, type, logo usage,
  clear-space/min-size, `<head>` snippet). Copy these into the app's `/public/` (icons at root or
  under `/public/brand/`; keep paths consistent with §5.1).
  Key files: `wordmark.svg` (+ `-dark`), `mark.svg`, `lockup-horizontal.svg` (+ `-dark`),
  `lockup-stacked.svg`, `favicon.svg`, `favicon.ico`, `favicon-16/32/48.png`,
  `apple-touch-icon.png` (180), `icon-192/512.png`, `icon-maskable-512.png`,
  `og-image.png` (1200×630), `site.webmanifest`.
- **`globals.css`** — design tokens (`:root` + dark-mode) and component classes. Copy as the base
  layer; **do not** redefine colors, fonts, or radii, and never add drop shadows.
- **`ref-*.html`** — the visual targets. Render them and reproduce layout/proportion (not the
  placeholder sample copy).

The authoritative design spec lives in **`globals.css`**, **SPEC §2.1/§2.2**, and
**`/brand/brand-guide.md`**. Use those values verbatim.

---

## 3. Design system you must apply (so the look lands, not just the name)

**Color tokens — light ("paper", default):**
```
--bg #FBF8F1   --surface #FFFFFF   --surface-2 #F3EEE3
--ink #16233F  --muted #5B6473     --hairline rgba(22,35,63,.12)
--accent #E0922A (marigold; buttons, mark dot)   --accent-text #B5701A (readable amber for text/links)
--accent-2 #159A92 (teal; interactive/curiosity) --accent-2-text #0F7A73
```
**Dark ("ink"):**
```
--bg #11161F   --surface #18222F   --surface-2 #1F2A3A
--ink #ECE7DB  --muted #9AA1AD     --hairline rgba(236,231,219,.14)
--accent #EDA23A   --accent-2 #2BB3AA
```
**Type — Reddit Sans only**, weight hierarchy **700** display/wordmark · **600** UI/buttons/labels
· **400** reading. Import:
```
@import url('https://fonts.googleapis.com/css2?family=Reddit+Sans:wght@400;500;600;700&display=swap');
```
**Logo usage:** header/footer = mark + wordmark lockup. Either reference `/brand/wordmark.svg`
(+ `-dark` swap) beside `/brand/mark.svg`, or inline the lockup SVG with the **wordmark path
`fill="var(--ink)"`** (so it flips in dark mode) and the **mark colors fixed** (navy tile, paper
"?", marigold dot). Lowercase wordmark; never restyle or capitalise it. Favicon = the "?" tile.
Min wordmark height ~18px; below that use the mark alone. Clear space ≈ the mark's corner radius.
**Accessibility:** marigold buttons take **navy** text; teal/amber used *as text* take the darker
`-text` variants.

---

## 4. Already migrated in THIS folder (canonical mirrors — mirror, don't redo)

- **Source of truth:** `SPEC.md` (§1.1 brand, §2.1 tokens, §2.2 type), `AGENTS.md`
  (palette/fonts/standing rules), `00-INDEX.md` (globals description).
- **Design:** `globals.css`; `/brand/*` + `/brand/brand-guide.md`.
- **Reference screens (all 13 `ref-*.html`):** brand lockup logo, new tokens, "FilmCurio
  Editorial" byline, "Curiobot", curio about copy, `wonwoo@metatake.net`, © FilmCurio.
  `ref-about.html` carries the **finished `/about` copy** (incl. the honest AI disclosure).
  `ref-chrome.html` is the canonical global header/footer.
- **Content / pipeline docs:** `content-engine-overview.md`, `editorial-voices.md`,
  `pipeline-prompts.md`, `prompt-design-changelog.md`, `redesign-home-and-question.md`,
  every `mission-*-kickoff.md`, `pre-launch-checklist.md` — byline, bot, domain, email, descriptor,
  and etymology all unified.

> Verified state of this folder: **zero** "kyniq" (any case); **zero** legacy design tokens
> (oxblood / Fraunces / Newsreader / Hanken / #1A2740 / #FAF7F0 / #8A2A21 / #5E6675).

---

## 5. Codebase touchpoints — where the rebrand must land (the worklist)

The app may be built incrementally per the missions; apply each item as that area is built.

### 5.1 App metadata & `<head>` (`app/layout.tsx` / `metadata`)
- `title` template `"%s · FilmCurio"`, default `"FilmCurio — Film Q&A Community"`.
- `description` = the curio descriptor (e.g. "A cabinet of cinema's curiosities — a global
  film-interpretation circle.").
- `metadataBase = https://filmcurio.com`; canonical/alternates on filmcurio.com.
- `openGraph`: `siteName "FilmCurio"`, title/description, `images: ['/og-image.png']` (1200×630),
  `url` filmcurio.com. `twitter`: `summary_large_image`, same image.
- `themeColor #16233F`.
- `icons`: `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` (180), `icon-192.png`,
  `icon-512.png`, mask/maskable; link `site.webmanifest`. (Snippet in `/brand/brand-guide.md`.)

### 5.2 `site.webmanifest` (`/public`)
- Use `/brand/site.webmanifest`: `name "FilmCurio"`, `short_name "FilmCurio"`,
  `theme_color #16233F`, `background_color` per brand-guide, icons → the PWA set incl. maskable.

### 5.3 Structured data — Organization JSON-LD (§8)
- `name "FilmCurio"`, `url https://filmcurio.com`, `logo` = absolute URL to `icon-512.png`
  (or the lockup), `sameAs` = socials once they exist. WebSite/Org name updated. Published-answer
  `author`/publisher byline = **"FilmCurio Editorial"**.

### 5.4 `globals.css` + Tailwind theme
- Import this folder's `globals.css` as the base layer; map the tokens into `tailwind.config`
  (`ink, bg, surface, surface-2, accent, accent-text, accent-2, accent-2-text` + dark). Load Reddit
  Sans. Do not reintroduce old tokens or fonts.

### 5.5 Header / footer (global chrome — see `ref-chrome.html`)
- Logo = FilmCurio mark + wordmark lockup (links home; wordmark `var(--ink)` for dark flip).
- Footer: brand "FilmCurio", "Seoul, Republic of Korea", contact `wonwoo@metatake.net`, TMDB
  attribution, © 2026 FilmCurio, tagline "Read films closely.", descriptor "FILM Q&A COMMUNITY".

### 5.6 Email (transactional + sender identity)
- Sender display name "FilmCurio"; `from` on filmcurio.com (e.g. `no-reply@filmcurio.com`) once
  domain email + SPF/DKIM/DMARC are set; reply-to / published contact `wonwoo@metatake.net`.
- Template logo, colors, and footer brand → FilmCurio.

### 5.7 Content pipeline (workers — see `content-engine-overview.md`, `pipeline-prompts.md`)
- The byline string stamped on published answers = **"FilmCurio Editorial"** (DB default + any
  hardcoded constant).
- Media-bot identity in code, logs, and UI = **"Curiobot"**.
- Any prompt text / system string naming the brand → FilmCurio (the prompt pack here is already
  updated; mirror it into the code's prompt constants).

### 5.8 Admin console / page  ← **explicit requirement**
- **The admin logo must change to the FilmCurio mark + wordmark** (it was the old Kyniq logo).
  Update: the admin header/sidebar brand, the admin login screen logo, the page `<title>`/tab
  title, and any remaining "Kyniq" strings. Reuse the same lockup + tokens as the public chrome and
  inherit the app favicon. Do not leave the admin on the old identity.

### 5.9 Repo / config / env
- `package.json` `"name": "filmcurio"`; repo name; README title/links → FilmCurio + filmcurio.com.
- env: `NEXT_PUBLIC_SITE_URL=https://filmcurio.com`; rename any `KYNIQ_*` keys → `FILMCURIO_*` and
  update references; email/SMTP sender vars.
- Supabase: any **seeded brand strings** (e.g. a settings row, the editorial author name) →
  "FilmCurio" / "FilmCurio Editorial". Table/column names need not change.

### 5.10 SEO plumbing — sitemap / robots / llms.txt / feeds (§8)
- `robots.txt` + `sitemap.xml` host → filmcurio.com.
- `llms.txt` (if used): brand name + description → FilmCurio + curio descriptor.
- RSS/Atom feed title + author → FilmCurio / FilmCurio Editorial.

### 5.11 Redirects & hosting (only if kyniq.io was ever live)
- Host-level **301** `kyniq.io/*` → `filmcurio.com/*`, preserving paths. If kyniq.io was never
  public, skip. Point the Vercel project's production domain at filmcurio.com.

---

## 6. The `/about` page (built — mirror `ref-about.html`)

Finished copy lives in `ref-about.html`, in this order: standfirst → what FilmCurio is → **the
name** (film + curio) → **how a reading is built** (one canonical answer + merged community
readings, no downvotes) → **how our interpretations are written** (the honest AI disclosure) → who's
behind it (Seoul) → contact.

**HARD RULE — keep the AI disclosure honest.** Answers are written by *FilmCurio Editorial* (an AI
system), pass an automated multi-model accuracy/sourcing check before publishing, and are audited
and corrected post-publish; **do not** rewrite this to claim that a human reviews every item.
Media (stills, related videos) is attached by *Curiobot* (images from TMDB). Build `/about` from
this, plus the sibling institutional pages per SPEC §6.9: `/contact`, `/guidelines`, `/terms`
(**must include the contribution content license**), `/privacy`.

---

## 7. Verification (run after applying)

- `grep -ri 'kyniq' .` → **empty** (code, content, config, env, comments, commit templates).
- `grep -riE 'oxblood|Fraunces|Newsreader|Hanken|1A2740|FAF7F0|8A2A21|5E6675' .` → **empty**.
- Favicon/OG render: the "?" tile mark shows; `og-image.png` is the FilmCurio lockup.
- Schema / Rich Results test: `Organization.name = FilmCurio`, `logo` URL resolves.
- Contrast/Lighthouse: marigold buttons (navy text) and teal/amber text pass AA.
- Manifest: installable; `name` FilmCurio; `theme_color` #16233F.
- Email: sender shows FilmCurio; all links resolve to filmcurio.com.
- **Admin UI:** logo + title are FilmCurio; no "Kyniq" anywhere in the admin.

---

## 8. Reference index (where each spec lives in this bundle)

- **Brand:** `SPEC.md` §1.1 + `/brand/brand-guide.md`
- **Color tokens:** `SPEC.md` §2.1 + `globals.css` (`:root` + dark)
- **Type:** `SPEC.md` §2.2 + `globals.css` (`@import` + `--font-*`)
- **Logo / favicon files:** `/brand/*`
- **Global chrome:** `ref-chrome.html` · **Pages:** `ref-*.html` · **/about copy:** `ref-about.html`
- **Pipeline byline / bot identity:** `content-engine-overview.md`, `pipeline-prompts.md`
- **Standing build rules:** `AGENTS.md` · **Doc map:** `00-INDEX.md`
- **Contact:** wonwoo@metatake.net
