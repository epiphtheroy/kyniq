# Metatake brand

Source files from the designer (delivered 2026-09-04) and the rules that came with
them. Everything the site and the apps show is derived from here — regenerate from
these, never redraw.

## Files

| File | What |
|---|---|
| `metatake-logo-set.ai` | Master vector set, 15 artboards: stacked wordmark (colour / mono), symbol (colour / mono), guide sheet with the outlined "Metatake" wordtext, app-icon artboards (iOS light / dark / tinted, Android foreground / background / mono, splash light / dark), white knockouts |
| `metatake-favicon.ai` | Simplified symbol for 16px: frame + M + dot, the *t* dropped |
| `metatake.icon/` | Icon Composer bundle (Liquid Glass source). Dot corrected to `#E3120B` here; the designer's copy still carried `#F50001` |
| `metatake-logo-guide-ko.pdf` | The designer's one-page usage guide (Korean) |

Derived assets live in `public/` (favicons, PWA icons, OG image, `public/brand/*.svg`)
and `mobile/assets/images/` (store icons, splash). The inline React marks are in
`components/Brand.tsx`; the app's are in `mobile/src/components/ui.tsx`.

## Rules (from the guide)

- **Spelling:** `Metatake`. Not `metatake`, not `META TAKE`.
- **Red:** `#E3120B`, the site's existing `--accent`. One value everywhere; the
  earlier files drifted (`#F70000`, `#F50001`, `#DA3225`) in transit.
- **Ink:** `#1F1F1F` on light; white knockout on dark (`#0D0D0D`, `#1F1F1F`, gradients).
- **Typeface:** Indivisible, SemiBold, tracking 26 (≈ 0.026em). Size is free; keep
  weight and tracking. The font is not licensed for the web build, so the wordtext
  ships as outlines (`public/brand/wordtext.svg`, `BrandWordtext`).
- **Minimum size:** stacked wordmark 80px, symbol 60px. The nav uses the symbol at
  22px because the designer's small-size test cleared it; below ~36px use the
  simplified favicon mark instead.
- **Header:** symbol + plain-text "Metatake", not symbol + stacked wordmark (the boxed
  M would repeat). Gap 0.3em measured from the symbol's right edge, vertically
  centred. The designer recommends keeping the name beside the mark while the brand is
  new.
- **App icons:** flat, square, no alpha (Apple masks the corners itself). iOS light /
  dark / tinted; Android adaptive foreground inside the 66% safe circle + white
  background + white mono silhouette.
