# Metatake — SEO / Structured-Data Spec: Lineage & Film-Honors Pages

Author: Metatake Editorial (spec compiled for the Next.js dev)
Date compiled: 2026-07-06
Scope: `/film/[slug]`, `/film/lineage/[slug]` (the "honors/awards" tab), `/lineage/[award-or-canon-slug]` (a single list), and `/lineage` (the index).
Verification: JSON-LD read live from production on 2026-07-06 via `document.querySelectorAll('script[type="application/ld+json"]')`. QIDs verified live against the Wikidata API (`wbsearchentities` / `wbgetentities`).

> **Headline:** The site is in far better structured-data shape than assumed. Movie, ItemList, CollectionPage, and BreadcrumbList JSON-LD **already ship** on the film, honors, and single-list pages. The real work is (a) filling gaps in the schema that exists, (b) fixing the bare-`wikidata.org` citation bug, (c) adding structured data + a "resolved vs. true count" note to the **index**, and (d) reconciling two conflicting `Movie` nodes for the same film.

---

## 1. Structured-data audit result (verified live)

### 1a. What is ALREADY present (good news)

| Page type | URL tested | JSON-LD blocks present |
|---|---|---|
| Film (base) | `/film/anora-2024` | `Organization`, `WebSite`, **`Movie`**, **`BreadcrumbList`**, `WebPage` |
| Film honors/awards | `/film/lineage/anora-2024` | `Organization`, `WebSite`, **`Movie`**, **`ItemList`**, **`BreadcrumbList`**, `WebPage` |
| Single lineage list | `/lineage/wga-best-original-screenplay` | `Organization`, `WebSite`, **`ItemList`**, **`BreadcrumbList`**, **`CollectionPage`** |
| Lineage index | `/lineage` | `Organization`, `WebSite` **only** |

Confirmed strengths:
- **BreadcrumbList already matches the visible trail** on all three content page types (Home › Films › Anora (2024) › Awards & honors, and Home › Lineage › WGA Best Original Screenplay). No breadcrumb work needed except the index (see below).
- The single-list **`ItemList` is complete**: `/lineage/wga-best-original-screenplay` emits `numberOfItems: 72` with **all 72** `itemListElement` entries (position 1 = Sinners 2025 … position 72 = Butch Cassidy and the Sundance Kid 1969), each an inline `Movie` with `name`, `datePublished`, `url`. Ranked position is present.
- `CollectionPage` carries `about` (with `sameAs → Q8038461` on WGA), `author`, `editor` (Wonwoo Yoon), `publisher`, and `dateModified: "2026-06-25"` — strong E-E-A-T signals already in place.
- Meta/OG/Twitter/canonical are present and well-written on every page.

### 1b. What is MISSING or broken (the actual to-do list)

1. **The `/lineage` index has NO list-level structured data.** Only `Organization` + `WebSite`. No `Dataset`, no `CollectionPage`, no `ItemList` for the five groups (National cinemas 41 / Movements 34 / Awards 55 / Canons 15 / Auteur lines 160). This is the single biggest gap. (Also: the index has no visible `BreadcrumbList` JSON-LD.)

2. **Two conflicting `Movie` nodes for the same film.** Same `@id` (`https://metatake.net/film/anora-2024`), different content:
   - `/film/anora-2024` Movie: rich — `datePublished:"2024-10-14"` (full ISO), `genre`, `duration:"PT139M"`, `actor[]`, `description`, `review`/`reviewRating` (TakeScore 41), `sameAs:["https://www.imdb.com/title/tt28607951/"]` — but **no `award[]`** and **no Wikidata/TMDb in `sameAs`**.
   - `/film/lineage/anora-2024` Movie: thinner — has `award[]` (11 entries as text) but `datePublished:"2024"` (year only, downgraded), and **`sameAs` entirely absent**.
   - Because they share one `@id`, Google may merge them and see contradictory `datePublished`. **Fix: make both nodes emit the same core fields from one shared builder** (full ISO date, full `sameAs`), and let the honors node add `award[]` on top.

3. **`sameAs` on Movie is incomplete everywhere.** IMDb is present on the base page only; **Wikidata QID and TMDb URL are never emitted**, even though the site clearly holds TMDb data (poster path `…/cgXk2tNYhJZLXdBDO5DidAVzQ82.jpg` and Wikidata-sourced award data). Adding both strengthens entity reconciliation. (Verified real IDs for Anora: Wikidata **Q123185887**, TMDb **1064213**, IMDb **tt28607951**.)

4. **Bare-`wikidata.org` citation bug — confirmed, and worse in JSON-LD on some pages.**
   - On `/lineage/wga-best-original-screenplay` the visible citation renders **two** "Wikidata ↗" links: the first `href="https://www.wikidata.org/"` (bare, no QID — broken), the second correctly `…/wiki/Q8038461`. The `CollectionPage.about.sameAs` here is correct (`Q8038461`).
   - On `/lineage/critics-choice-best-picture` it is worse: the **only** visible Wikidata link is bare `https://www.wikidata.org/`, **and** `CollectionPage.about` has **no `sameAs` at all**. So for lists whose award QID was never resolved, both the visible link and the structured data are empty.

5. **`ItemList` member movies carry no `sameAs`.** Minor, but adding Wikidata/TMDb to each inline `Movie` in the list would help entity linking on high-value canon pages.

6. **The "resolved count < true length" discrepancy is unexplained on-page** and appears nowhere in structured data (`numberOfItems` reflects the true list length on WGA — 72 — which is correct; the shortfall shows up as the grid rendering fewer poster cards than `numberOfItems`, with no note). See §3.

---

## 2. Ready-to-paste JSON-LD templates (schema.org)

All templates use **real, verified** Anora / WGA values. Ship each as `<script type="application/ld+json">{…}</script>` in the page `<head>` (in Next.js App Router: render the `<script>` in the route's `page.tsx`/`layout.tsx`, or via `next/script` with `strategy="beforeInteractive"`; `dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}` is the standard pattern). Prefer **one shared `Movie` builder** so the base and honors pages never disagree.

### 2a. `Movie` — for `/film/[slug]` AND `/film/lineage/[slug]`

Single source of truth. The honors page passes `awards` in; the base page passes it empty (or omits `award`). Note `datePublished` is **full ISO** in both.

```json
{
  "@context": "https://schema.org",
  "@type": "Movie",
  "@id": "https://metatake.net/film/anora-2024",
  "url": "https://metatake.net/film/anora-2024",
  "name": "Anora",
  "datePublished": "2024-10-14",
  "genre": ["Drama", "Comedy", "Romance"],
  "duration": "PT139M",
  "director": { "@type": "Person", "name": "Sean Baker" },
  "image": "https://image.tmdb.org/t/p/w500/cgXk2tNYhJZLXdBDO5DidAVzQ82.jpg",
  "description": "A young sex worker from Brooklyn gets her chance at a Cinderella story when she meets and impulsively marries the son of an oligarch…",
  "sameAs": [
    "https://www.wikidata.org/wiki/Q123185887",
    "https://www.themoviedb.org/movie/1064213",
    "https://www.imdb.com/title/tt28607951/"
  ],
  "award": [
    "Academy Award for Best Picture (2025)",
    "Academy Award for Best Director (2025)",
    "Academy Award for Best Actress (2025)",
    "Academy Award for Best Original Screenplay (2025)",
    "Palme d'Or (2024)",
    "Los Angeles Film Critics Association Award for Best Picture (2024)",
    "Critics' Choice Award for Best Picture (2024)",
    "Independent Spirit Award for Best Feature (2024)",
    "Producers Guild of America Award for Best Theatrical Motion Picture (2024)",
    "Directors Guild of America Award for Outstanding Directing – Feature Film (2024)",
    "Writers Guild of America Award for Best Original Screenplay (2024)"
  ]
}
```

Notes:
- `sameAs` gains **Wikidata + TMDb** (previously IMDb-only on base, empty on honors).
- On the **base** `/film` page you may keep `actor[]` and the `review`/`reviewRating` (TakeScore) block that already ships — those are legitimately yours and add a rating signal. Keep `award[]` on both pages so the film's honors are machine-readable from either URL.
- Keep the full `award` names (spell out "Academy Award for Best Picture", not "Best Picture") so the text is unambiguous to search engines. The site's visible labels can stay short.

### 2b. `CollectionPage` + embedded `ItemList` — for `/lineage/{slug}`

This already ships and is close to ideal. Two changes: (i) always populate `about.sameAs` with the award QID (never omit), (ii) add `sameAs` to member movies. `numberOfItems` = the **true** list length. Use `position` for ranked canons (TSPDT, 1001 Movies); award lists are chronological, which is also a valid ordering.

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "url": "https://metatake.net/lineage/wga-best-original-screenplay",
  "name": "WGA Best Original Screenplay Winners — the Complete List (1969–2025)",
  "description": "Every winner of the Writers Guild of America Award for Best Original Screenplay, 1969–2025, compiled from Wikidata.",
  "isPartOf": { "@id": "https://metatake.net/lineage#dataset" },
  "about": {
    "@type": "Thing",
    "name": "Writers Guild of America Award for Best Original Screenplay",
    "sameAs": ["https://www.wikidata.org/wiki/Q8038461"]
  },
  "author":    { "@type": "Organization", "@id": "https://metatake.net/#org", "name": "Metatake" },
  "editor":    { "@type": "Person", "@id": "https://metatake.net/editor#person", "name": "Wonwoo Yoon", "url": "https://metatake.net/editor" },
  "publisher": { "@type": "Organization", "@id": "https://metatake.net/#org", "name": "Metatake" },
  "dateModified": "2026-06-25",
  "mainEntity": {
    "@type": "ItemList",
    "name": "WGA Best Original Screenplay Winners — the Complete List (1969–2025)",
    "numberOfItems": 72,
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "item": {
          "@type": "Movie",
          "name": "Sinners",
          "datePublished": "2025",
          "url": "https://metatake.net/film/sinners-2025",
          "sameAs": ["https://www.themoviedb.org/movie/…", "https://www.wikidata.org/wiki/…"]
        }
      },
      {
        "@type": "ListItem",
        "position": 2,
        "item": {
          "@type": "Movie",
          "name": "Anora",
          "datePublished": "2024",
          "url": "https://metatake.net/film/anora-2024",
          "sameAs": [
            "https://www.wikidata.org/wiki/Q123185887",
            "https://www.themoviedb.org/movie/1064213"
          ]
        }
      }
      // … positions 3–72 (all present today; keep them all)
    ]
  }
}
```

Notes:
- Today the site emits `ItemList` and `CollectionPage` as **separate** top-level blocks. Either keep them separate (both valid) or nest `ItemList` under `CollectionPage.mainEntity` as above (cleaner graph). If kept separate, still add `about.sameAs` and member `sameAs`.
- For **ranked canons** (TSPDT #1…#1000, 1001 Movies) set `position` to the rank and use `"itemListOrder": "https://schema.org/ItemListOrderAscending"`. For chronological award lists, `ItemListOrderDescending` (newest first) matches the visible grid.
- `numberOfItems` must equal the **true** list length (72), not the TMDb-resolved subset. See §3/§4 for how to communicate the shortfall.

### 2c. `BreadcrumbList` — matches the visible trail

Already correct on film/honors/list pages. **Add it to the index.** Templates:

Honors page (`/film/lineage/anora-2024`) — already shipping, keep as-is:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home",              "item": "https://metatake.net" },
    { "@type": "ListItem", "position": 2, "name": "Films",             "item": "https://metatake.net/film" },
    { "@type": "ListItem", "position": 3, "name": "Anora (2024)",      "item": "https://metatake.net/film/anora-2024" },
    { "@type": "ListItem", "position": 4, "name": "Awards & honors",   "item": "https://metatake.net/film/lineage/anora-2024" }
  ]
}
```

> Note: the visible on-page breadcrumb reads **Films › Sean Baker › Anora › Honors** (it includes the director). Consider adding the director crumb to the JSON-LD too, so the structured trail matches what the user sees:
> `{ "position": 3, "name": "Sean Baker", "item": "https://metatake.net/director/sean-baker" }`, pushing Anora to position 4 and Honors to 5.

Index page (`/lineage`) — **new**:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home",    "item": "https://metatake.net" },
    { "@type": "ListItem", "position": 2, "name": "Lineage", "item": "https://metatake.net/lineage" }
  ]
}
```

### 2d. `Dataset` — for the `/lineage` index (E-E-A-T + freshness)

New. Frame the whole lineage corpus as one curated dataset of film-lineage memberships. This is the strongest E-E-A-T move available and gives the index a reason to rank as a hub.

```json
{
  "@context": "https://schema.org",
  "@type": "Dataset",
  "@id": "https://metatake.net/lineage#dataset",
  "name": "Metatake Film Lineage Dataset",
  "description": "A curated dataset of film-lineage memberships: which films belong to which national cinemas, movements, awards, and canons. 305 lineages spanning national cinemas, movements, awards, canons, and auteur lines, each membership compiled from public records (primarily Wikidata) and linked to a Metatake film page.",
  "url": "https://metatake.net/lineage",
  "keywords": ["film awards", "film canons", "national cinema", "film movements", "auteur", "cinema lineage"],
  "license": "https://metatake.net/terms",
  "isAccessibleForFree": true,
  "creator":   { "@type": "Organization", "@id": "https://metatake.net/#org", "name": "Metatake" },
  "editor":    { "@type": "Person", "@id": "https://metatake.net/editor#person", "name": "Wonwoo Yoon", "url": "https://metatake.net/editor" },
  "publisher": { "@type": "Organization", "@id": "https://metatake.net/#org", "name": "Metatake" },
  "dateModified": "2026-06-25",
  "isBasedOn": "https://www.wikidata.org/",
  "measurementTechnique": "Membership compiled from Wikidata and public records; each film matched to a TMDb-backed Metatake film page.",
  "hasPart": [
    { "@type": "Dataset", "name": "National cinemas", "description": "41 national-cinema lineages" },
    { "@type": "Dataset", "name": "Movements",        "description": "34 film-movement lineages" },
    { "@type": "Dataset", "name": "Awards",           "description": "55 award lineages" },
    { "@type": "Dataset", "name": "Canons",           "description": "15 canon lineages" },
    { "@type": "Dataset", "name": "Auteur lines",     "description": "160 auteur-line lineages" }
  ]
}
```

Optionally also emit a `CollectionPage` on the index with an `ItemList` of the five groups (each `ListItem` → a group anchor or a "browse Awards" view), to mirror the visible grouping. The `Dataset` is the priority.

> The group counts (41 / 34 / 55 / 15 / 160 → 305 total) are read live from the index on 2026-07-06. Keep the `Dataset.description` count in sync with the visible totals via the same data source.

---

## 3. Completeness & transparency microcopy (SEO + trust)

Two problems to solve with copy: (a) reassure searchers the list is **complete** ("complete list" intent), and (b) honestly explain why the poster grid shows fewer films than the stated total.

### 3a. List subhead (single lineage page)

Current visible header reads: `72 FILMS` and `Compiled from Wikidata ↗ · Wikidata ↗ · 32 of 72 read closely on Metatake`. Tighten to a single transparent line. Exact copy (WGA example, all values from the page):

> **Complete winners, 1969–2025 · all 72 winners · 32 read closely · 72 of 72 matched to a film page**

Template (fill from data):

> **Complete {winners|selections}, {firstYear}–{lastYear} · all {trueCount} {items} · {readCount} read closely · {resolvedCount} of {trueCount} matched to a film page**

Where `resolvedCount` = films that resolved to a Metatake film page (the poster cards), `trueCount` = `numberOfItems`, `readCount` = films with a close reading.

### 3b. On-page note when `resolvedCount < trueCount` (the flagship-canon case)

Show this **only** when the grid is short of the true length. Exact copy for the three flagship canons named in the brief:

- TSPDT 1,000 (994 resolved):
  > **994 of 1,000 films resolved to a film page.** The remaining 6 are on the list but not yet matched to a Metatake film page — usually a title/year mismatch we're still reconciling. The count above reflects the full published list.

- National Film Registry (914 of 925):
  > **914 of 925 films resolved to a film page.** 11 titles on the Registry aren't yet matched to a Metatake film page. The count above reflects the full Registry.

- 1001 Movies You Must See Before You Die (159 resolved):
  > **159 of the list matched to a film page so far.** This canon is still being ingested — more titles are matched with each data update. The count above reflects the films matched to date.

Generic template:

> **{resolvedCount} of {trueCount} films resolved to a film page.** The remaining {trueCount − resolvedCount} are on the list but not yet matched to a Metatake film page. The count above reflects the full published list.

Placement: directly under the subhead, small/muted, above the poster grid. Rationale: turns a silent discrepancy into a visible integrity signal, and matches Google's E-E-A-T preference for transparent data provenance.

### 3c. Honors-page subhead (film → its honors)

Current meta is good ("Anora (2024) carries 12 entries…"). Add a one-line on-page completeness reassurance:

> **11 award results and 1 canon appearance on record — every entry links to the complete list it belongs to and the source it was compiled from.**

---

## 4. Trust fixes

### 4a. Citation-QID gaps — enumerate and fill

**Root cause:** when an award/list's Wikidata QID isn't resolved, the template renders the citation as a bare `https://www.wikidata.org/` link (no `/wiki/Qxxxxx`) **and** omits `about.sameAs` from the `CollectionPage` JSON-LD. Both the visible link and the machine-readable citation are then empty.

**Rule to implement:** never render a Wikidata citation link, and never emit `about.sameAs`, unless a QID is present. If no QID, either (i) suppress the link entirely and show plain text "Compiled from public records", or (ii) surface the resolved-source that IS known (e.g. TSPDT's own site) — never a bare `wikidata.org` link.

**Verified QIDs to backfill** (checked live against the Wikidata API on 2026-07-06; use these to replace bare links / fill `about.sameAs`):

| Lineage (as seen on site) | Correct Wikidata QID | Verified label |
|---|---|---|
| WGA Best Original Screenplay | **Q8038461** | Writers Guild of America Award for Best Original Screenplay *(already correct on site)* |
| Academy Award — Best Picture | **Q102427** | Academy Award for Best Picture |
| Academy Award — Best Director | **Q103360** | Academy Award for Best Director |
| Academy Award — Best Actress | **Q103618** | Academy Award for Best Actress |
| Academy Award — Best Original Screenplay | **Q41417** | Academy Award for Best Writing, Original Screenplay |
| Palme d'Or | **Q179808** | Palme d'Or |
| Golden Bear | **Q154590** | Golden Bear |
| Golden Lion | **Q209459** | Golden Lion |
| Independent Spirit — Best Feature/Film | **Q2544844** | Independent Spirit Award for Best Film |
| Producers Guild — Best Theatrical Motion Picture | **Q5569374** | Producers Guild of America Award for Best Theatrical Motion Picture |
| Directors Guild — Feature Film | **Q5280675** | Directors Guild of America Award for Outstanding Directing – Feature Film |
| Los Angeles Film Critics — Best Film | **Q952914** | Los Angeles Film Critics Association Award for Best Film |
| National Board of Review — Top Ten Films | **Q1966965** | National Board of Review: Top Ten Films |
| National Film Registry | **Q823422** | National Film Registry |
| 1001 Movies You Must See Before You Die | **Q929091** | 1001 Movies You Must See Before You Die (book) |

**Two important corrections / caveats — do NOT ship blindly:**

1. **Critics' Choice Best Picture — the QID suggested in the brief (Q1195678) is WRONG.** I verified `Q1195678` live: it is **"Ursa Major Moving Group"** (an astronomy object), not a film award. Do not use it.
   - The correct target is the Broadcast Film Critics Association (which runs the Critics' Choice Awards). The best-film category resolves to **Q922299 — "Broadcast Film Critics Association Award for Best Film."** Umbrella award family = **Q7585305 — "Critics' Choice Awards."** Recommendation: use **Q922299** for the Best-Picture list's `about.sameAs`, but have the editor confirm Metatake's item maps to the BFCA "Best Film" node (Q922299) rather than the umbrella (Q7585305) before publishing. This is the one QID I could not pin to a single unambiguous "Best Picture" node via search.

2. **TSPDT (They Shoot Pictures, Don't They?) has no clean Wikidata award/list entity** — a `wbsearchentities` query returns nothing usable. So the bare-`wikidata.org` link on TSPDT is not fixable by adding a QID; **suppress the Wikidata link there** and cite TSPDT's own source instead (its site / the "1,000 Greatest Films" list), which is the true provenance anyway. This is more honest than pointing at Wikidata for a list Wikidata doesn't host.

### 4b. "N of M resolved" display + recovering unresolved films

- **Display:** implement the `{resolvedCount} of {trueCount}` note from §3b wherever `resolvedCount < numberOfItems`. Keep `numberOfItems` in JSON-LD at the true length; the note explains the gap. This converts the "unexplained shortfall" (994/1000, 914/925, 159/list) into a trust signal.
- **Recover the small tails for flagship canons.** The gaps are small and finite — 6 films for TSPDT, 11 for the National Film Registry. These are worth a manual reconciliation pass because the flagship canons are the highest-traffic, highest-authority lineage pages:
  - Pull the unresolved titles from the source list, match each against TMDb by title+year (the usual failure is an alternate/original-language title or an off-by-one release year), and either link the existing film page or create the missing one.
  - Once resolved, both the poster grid and the `ItemList` fill out to the true length and the §3b note disappears automatically.
  - The 1001 Movies list (159 resolved) is a larger ingestion job; frame it as "still being ingested" (§3b copy) rather than as an error.

---

## 5. SEO wins summary + honest "what we don't have"

### Why each change helps

| Change | SEO mechanism | Payoff |
|---|---|---|
| `Movie` with `award[]`, `director`, `datePublished` (full ISO), `sameAs` → Wikidata + TMDb + IMDb | Entity reconciliation in Google's Knowledge Graph; Movie rich-result eligibility | Film pages get linked to the canonical film entity; richer SERP treatment; disambiguation from same-title films |
| Reconcile the two conflicting `Movie` nodes (shared `@id`, same fields) | Removes contradictory `datePublished` that can suppress rich results | Consistent, trusted entity across base + honors URLs |
| `CollectionPage` + complete `ItemList` (`numberOfItems`, `position`) | Carousel/list eligibility; satisfies **"complete list" search intent** ("WGA best original screenplay winners list") | The exact query these pages are built to win; ranked canons expose position |
| `about.sameAs` = correct award QID (no bare links) | Cites an authoritative external entity → provenance signal | E-E-A-T; kills a visible broken-link trust hit |
| `Dataset` on `/lineage` index | Curated-dataset framing + `editor`/`publisher`/`dateModified` | Strongest E-E-A-T signal available; positions the index as an authoritative hub |
| `BreadcrumbList` everywhere (incl. index + director crumb) | Breadcrumb rich result; site-structure clarity | Cleaner SERP breadcrumbs; better crawl of the hub→list→film hierarchy |
| `dateModified` / "Data updated 2026-06-25" surfaced in schema | **Freshness** signal | Rewards the site's real update cadence; helps recency-sensitive queries |
| "N of M resolved" + "all X winners" microcopy | Matches completeness intent; transparent provenance | Trust + reduced pogo-sticking on "is this the full list?" queries |

### Honest "what we don't have" (do NOT overpromise in schema)

State these plainly so no template claims data the site lacks:

- **No nominee slates** — the lists are **winners/members only**. Do not emit `award` as "nominated for"; do not imply full nomination coverage. Schema should say only what won / what's a member.
- **No box office / gross** — do not add `Movie` fields implying revenue.
- **No third-party aggregate ratings** — the only rating is Metatake's own **TakeScore** (correctly modeled as a first-party `Review`/`reviewRating` authored by Metatake). Do **not** dress it up as an `aggregateRating` from external critics.
- **No runtime/genre for every title** — those are populated where TMDb supplies them (present for Anora); don't assume they exist for the whole corpus, so keep them optional in the builder.
- **Some lineages have no Wikidata QID** (e.g. TSPDT) — for those, cite the real source, and never fall back to a bare `wikidata.org` link.
- **Resolved count can be < true list length** — the site should show the true `numberOfItems` and *disclose* the resolved subset (§3b), not silently pad or hide it.

---

## Implementation checklist (for the Next.js dev)

- [ ] Create one shared `buildMovieJsonLd(film, { awards })` and emit it on **both** `/film/[slug]` and `/film/lineage/[slug]` so the two `Movie` nodes never diverge. Full ISO `datePublished`; `sameAs` = [Wikidata, TMDb, IMDb].
- [ ] Add Wikidata + TMDb to `sameAs` on all `Movie` nodes (base, honors, and list members).
- [ ] Gate the Wikidata citation link + `about.sameAs`: render **only** when a QID exists; otherwise plain-text provenance or the real source.
- [ ] Backfill award QIDs from the §4a table. Flag Critics' Choice (use **Q922299**, editor to confirm) and TSPDT (no QID — cite source directly).
- [ ] Add `Dataset` + `BreadcrumbList` JSON-LD to `/lineage`.
- [ ] Add the "N of M resolved" note (§3b) where `resolvedCount < numberOfItems`; keep `numberOfItems` at true length.
- [ ] Add director crumb to film-page `BreadcrumbList` to match the visible trail.
- [ ] Manual reconciliation pass for the flagship-canon tails (TSPDT +6, National Film Registry +11).
- [ ] Validate every template in Google Rich Results Test and schema.org validator before shipping.
