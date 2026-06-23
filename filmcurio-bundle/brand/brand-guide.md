# FilmCurio — brand guide (logo + identity v2)

Service: **FilmCurio** · domain: **filmcurio.com** · tagline: **Film Q&A Community** ·
descriptor: *A cabinet of cinema's curiosities — a global film-interpretation circle.*

The mark is a **film-frame question mark**: a clean "?" whose dot is a **marigold film cell**
(film + question + *curio*). Flat, two-colour, scalable to a 16px favicon. The wordmark is set in **Reddit Sans** (700) — the practical, accessible sans used across Reddit —
for a clean, friendly, highly legible feel. Supersedes the earlier identity.

## Palette
| Role | Token | Light | Dark |
|---|---|---|---|
| Ink (primary) | `--ink` | `#16233F` | `#E8E4DA` (text) |
| Paper (bg) | `--bg` | `#F4F0E7` | `#11161F` |
| Surface | `--surface` | `#FFFFFF` | `#161C26` |
| **Accent — marigold** | `--accent` | `#E0922A` | `#EDA23A` |
| **Secondary — teal** | `--accent-2` | `#159A92` | `#2BB3AA` |
| Muted | `--muted` | `#5B6473` | `#9AA1AD` |
| Hairline | `--hairline` | `#E6DED0` | `#283040` |

Evolution from v1: the muted brass felt sedate, so the accent is now a livelier **marigold**, and
a **teal** secondary adds a warm/cool contrast that reads "curious / active." Use **marigold** for
the primary action and the mark's dot; use **teal sparingly** for interactive / curiosity cues
("what does it mean?", related-question links, hover states). Navy + paper stay the foundation.

## Typography
- **Everything — wordmark, headings, UI, reading: Reddit Sans.** One practical, accessible
  family (the typeface Reddit uses), with a weight-based hierarchy: **700** for the wordmark and
  display headings, **600** for UI labels/buttons, **400** for body/reading.
- The wordmark ships as **outlines** (font-independent), lowercase `filmcurio` in Reddit Sans 700.
  Never reset it in another font or capitalise it.

## Logo files (in this folder)
**Vector (use these in product):**
- `lockup-horizontal.svg` / `lockup-horizontal-dark.svg` — primary header lockup (light / on-dark)
- `lockup-stacked.svg` — square/centered placements
- `wordmark.svg` / `wordmark-dark.svg` — wordmark only (outlined Reddit Sans 700)
- `mark.svg` — the icon (rounded navy tile, marigold dot); same art as `favicon.svg`
- `app-icon.svg` — full-bleed square (OS icons) · `icon-maskable.svg` — extra safe-zone padding
- `favicon.svg` — browser favicon
**Raster:** `favicon-16/32/48.png`, `favicon.ico`, `apple-touch-icon.png` (180), `icon-192.png`,
`icon-512.png`, `icon-maskable-512.png`, `lockup-horizontal.png` (preview), `og-image.png`
(1200×630), `contact-sheet.png` (overview), `site.webmanifest`.

## Usage
- **Clear space:** keep padding ≥ the height of the "?" bar around the lockup. Min wordmark
  height ~18px on screen; below that use the mark only.
- **Mark on dark:** the navy tile is self-contained, so `mark.svg` works on light or dark. For a
  full lockup on dark, use `lockup-horizontal-dark.svg` (paper wordmark + brighter marigold).
- **Don't:** re-add glows/shadows/emboss, recolour the wordmark, stretch, or put the film-strip
  texture back inside the letters — the system is intentionally flat.

## Web integration (`<head>`)
```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#16233F">
<meta property="og:image" content="https://filmcurio.com/og-image.png">
```
Place the icons, `og-image.png`, and `site.webmanifest` in the app's `/public`.

## Status
Design tokens (`globals.css`), all reference screens (`ref-*`), and every spec/doc are now on the
FilmCurio system — Reddit Sans + marigold/teal on ivory, mark + wordmark, "FilmCurio Editorial"
byline, "Curiobot" media bot. Remaining build tasks:
1. Build the `/about` page copy from the curio meaning above (Mission 08).
2. Wire the favicons + `site.webmanifest` into the app `<head>` / `/public` (snippet above).
3. Confirm the contact email (placeholder `wonwoo@metatake.net`).
