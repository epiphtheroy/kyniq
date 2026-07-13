# Metatake TakeScore — browser extension

Overlays Metatake's **TakeScore** + a link to the full criticism on film pages at
**Letterboxd, IMDb, TMDB, Rotten Tomatoes, and Wikipedia**. Read-only, no keys, no
tracking — it just calls the free public API (`metatake.net/api/v1`). "Meet the
user where they already are."

## How it works
1. `content.js` detects the film on the page (JSON-LD `@type: Movie` first, then
   per-site fallbacks + `og:title`).
2. Calls `GET /api/v1/films?q=<title>&year=<year>` and picks the best match.
3. Floats a small badge (bottom-right) with the TakeScore, linking to
   `/film/<slug>?utm_source=extension`. Dismissable per page.

## Try it now (unpacked, no store needed)
1. Chrome → `chrome://extensions` → toggle **Developer mode** (top-right).
2. **Load unpacked** → select this `extension/` folder.
3. Visit e.g. `https://letterboxd.com/film/mulholland-drive/` — the badge appears.

## Owner action — publish to the Chrome Web Store
- One-time **$5** developer registration: https://chrome.google.com/webstore/devconsole
- **Package**: zip the *contents* of `extension/` (manifest at the zip root):
  ```bash
  cd extension && zip -r ../metatake-extension.zip . -x '*.DS_Store' && cd ..
  ```
- **Before submitting**: replace `icons/icon{16,48,128}.png` (currently plain teal
  placeholders) with the real Metatake wordmark, and add 1–3 screenshots (1280×800).
- **Privacy**: the extension collects nothing. In the store's Privacy tab declare
  "does not collect user data"; host permission is only `https://metatake.net/*`.
- Firefox (optional): the same MV3 works via addons.mozilla.org with minor manifest
  tweaks (`browser_specific_settings`).

## Store listing copy (paste)
**Name:** Metatake TakeScore — film criticism overlay
**Summary (132 max):** See Metatake's TakeScore and critical take on any film — right on Letterboxd, IMDb, TMDB, Wikipedia and Rotten Tomatoes.
**Description:**
> Metatake reads films closely. This extension puts its TakeScore — a 13-dimension
> critical assessment (Value / Cost / Risk) — and a link to the full human-curated
> criticism on the film pages you already browse: Letterboxd, IMDb, TMDB, Rotten
> Tomatoes, Wikipedia. No account, no key, no tracking. One click takes you to the
> readings, kindred films, and filming locations on metatake.net. Free, CC BY-NC 4.0.
**Category:** Fun / News (choose "Entertainment")

## Notes
- If Metatake has no page for a film, nothing shows (fail-quiet).
- Matching favours an exact title + year, then analyzed films.
- The badge is throttled by the same per-/24 guard as the rest of the API; normal
  browsing never trips it.
