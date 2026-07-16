# Locale projection — AS-BUILT (feat/locale-projection)

Implements `HANDOFF-KO프로젝션-한국어사이트.md` v4 (PR #9). Korean = wave 1.
Branch: `feat/locale-projection` off `main`. Written 2026-07-16.

## What shipped (code complete, owner steps pending)

### Phase 0 — i18n core ✅
- `lib/i18n/locales.ts` — registry. en·ko `live`, ja/fr/es `live:false` reserved.
- `lib/i18n/index.ts` — `t()` (English-string keys P4, English fallback P2, optional
  context for homographs), `locPath`/`stripLocale`/`locTwin` (dual URL space:
  `/{locale}` prefix + legacy `/film/x/{desk}/ko` suffix).
- `lib/i18n/values.ts` — `locVal`/`hasLocVal` over `_<loc>` columns, locale-generic.
- `lib/i18n/genres.ts` — TMDB's official ko genre names (fetched, not translated;
  19 English keys verified === the 19 distinct values in films.genres).
- `lib/i18n/dict/ko.ts` — core vocabulary (owner-approval gate) + 94 render keys.
- `lib/i18n/seo.ts` — `localeAlternates` (conditional hreflang), `indexableLocales`.
- `components/i18n/{LocaleProvider,SetHtmlLang,EnglishOriginalLabel}.tsx`.
- `scripts/i18n-audit.mjs` — coverage / key-parity / DB queue / shell thickness.
- **37/37 unit tests pass** (t, locPath, stripLocale, locTwin, locVal, genreName,
  indexableLocales, localeAlternates). Caught + fixed a real locTwin bug.

### Phase 2 — /ko/film/[slug] ✅
- `app/film/[slug]/_shared.tsx` — the whole page, extracted by a **pure move**
  (diff = 5 plumbing lines), rendered identically per locale.
- `app/film/[slug]/page.tsx` (EN shell) + `app/ko/film/[slug]/page.tsx` (KO shell),
  both ≤20 lines (P1).
- Metadata localized: title/description/og:locale; **conditional hreflang**
  (EN advertises ko only when the film clears the gate); robots gate hardened to
  `title_ko AND overview_ko` per locale.
- Both render branches (Tier-2 catalog + Tier-1 full) localized: ~120 chrome
  strings through `t()`. DB-verbatim prose (takes, figures, reception, sentences)
  stays English (§1.1).
- **Embedding Fantasia not rendered outside EN** (§1.1 ①) — fetch skipped too.
- **English-original prose marked** (§1.1 ②): DB-prose containers carry `lang="en"`,
  section headers carry a "영어 원문" chip; EN DOM byte-identical.
- `app/ko/layout.tsx` (LocaleProvider + SetHtmlLang).
- `films-ko.xml` sitemap shard (§6.2 gate ∩ EN roster, §6.5 ordering, cap 300),
  registered in the index. Self-empty pre-migration.
- `tsc`: no new errors (baseline 23 pre-existing, all unrelated).

## Owner steps (blocked in this sandbox — same convention as migration 0104)

1. **Apply migration `0105_locale_projection_ko.sql`** — additive nullable
   columns only (P3). Applying migrations to prod is the owner's step here
   (the MCP apply was correctly blocked; 0104 is likewise owner-pending).
2. **Run the backfill**: `python3 worker/tmdb-i18n-backfill.py --locale ko --persist`.
   ⚠️ Requests carrying the **service-role secret key are blocked in this
   sandbox** (credential-egress guard), so the worker must run in the owner's
   environment. Same for any service-role read.
3. **Core-vocabulary sign-off**: the CORE VOCABULARY block at the top of
   `lib/i18n/dict/ko.ts` is the §2.2.1 approval gate — review before /ko goes wide.
4. After deploy: bust ISR cache (`?v=<ts>`), confirm EN pages unchanged and a
   representative /ko film renders Korean title/synopsis or English fallback +
   `lang="en"` on the prose blocks.

## Corrections to the work order (found during implementation)

- **§3.3 place-name volume is ~10× the estimate.** `film_locations` has **28,412
  rows / 26,001 distinct names** (verified on prod), not ~2,500. Phase 3 is a
  large batch job (its own session), not an in-session translation. `name_ko`
  column is ready; the loader script is not yet written.
- **The film page is 1,969 lines** (not 1,929) with **two render branches**
  (Tier-2 minimal + Tier-1 full) — both localized.
- **`revalidate = 300`** on the film page (work order examples said 3600); shells
  preserve the real value.
- Nav has **three** callers (SiteNav server, SiteNavClient client ×8 surfaces,
  HomeV2) — why LocaleProvider falls back to the pathname.

## Phase 4 — switcher, banner, director ✅ (added same session)

- `components/i18n/LocaleSwitcher.tsx` — replaces the dead `EN ▾` nav placeholder
  with a working EN↔KO control (locTwin, hides on page types with no twin). This
  is both what philosopher-panel E6 wanted (kill the placeholder) and what §7
  wanted (a real switcher) — one change, no conflict.
- `components/i18n/LocaleSuggestBanner.tsx` — browser-language reader on an English
  page with a Korean twin gets a slim top-bar suggestion. Never a redirect;
  middleware untouched; dismissed → remembered. Mounted in the root layout.
- `/ko/director/[slug]` — same extract-shell pattern as the film page (~50 chrome
  strings). Name/bio stay English; ko director hubs are **noindex** (§6.5:
  mostly-English-under-Korean-shell) but reachable via switcher/banner.

## Shared components ✅ (added same session)

- `AccessSummary` (where-to-watch) — locale prop; country names via
  Intl.DisplayNames(ko), ~10 headline/fingerprint templates + tier words through
  t(). Closes the film page's last chrome gap.
- `FilmReceptionSection` — chrome localized; critic quotes stay English with
  lang="en" + "영어 원문" chip.

## Phase 3 — data foundation ✅ (added same session); page shells remaining

- `lib/i18n/cities/ko.json` — all **511** atlas cities in Korean (외래어 표기법) +
  55-country map. `lib/i18n/cities.ts` cityName()/cityCountry() with fallback.
  (Adversarially verified by a 6-agent review pass.)
- `scripts/load-locations-i18n.mjs` — ready loader for the film_locations
  `name_<loc>` CSV.
- **Remaining**: the atlas/locations ko PAGE shells (`/ko/atlas`, `/ko/locations/*`,
  `/film/locations/[slug]` ko — 5–7 routes with heavy assembled prose) and the
  ~26,001 film_locations name translations (an incremental CSV batch per §3.3;
  the loader above applies it). The film page's own inline atlas section (df-atlas)
  is already localized (Phase 2).

## Still remaining

- Phase 3 atlas/locations page shells + 26k location-name batch (above).
- Phase 4: home ko (owner said "light version, owner judgment"), catalog ko.
- Phase 5 finish (IndexNow ping, GSC watch). Naver is already verified in the root
  layout, and films-ko.xml is in the sitemap index, so Naver picks it up.
- Owner steps (migration 0105 + backfill) still gate everything going live.
