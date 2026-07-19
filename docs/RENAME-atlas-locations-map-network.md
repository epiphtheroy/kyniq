# Terminology rename — `atlas`→**Locations**, `map`→**Network** (2026-07-12)

**Canonical record of the sitewide terminology cleanup.** If a doc, comment, or
your memory still says "Atlas" (for the geographic map) or "the Map" / `/map`
(for the connection graph), this is the mapping. Shipped & live-verified on
metatake.net (commit `c4e23be`).

> ⚠️ **다음 개명 때 추가로 볼 곳 (2026-07-17 신설):** 이 개명(07-12) 당시엔 모바일 앱이 없었다. 지금은 앱이 읽기 표면 경로를 하드코딩한다 — `mobile/app/film/[slug].tsx`·`mobile/app/director/[slug].tsx`(각 readMore 목록)·`mobile/app/read.tsx`(허브 딥링크 정규식). 웹 라우트를 옮기면 이 3파일도 함께 고칠 것. 정본: `HANDOFF-모바일앱-프리워치.md` §16.5(유일한 수동 결합점).

## Why
Two words each meant something other than they said, and collided in the UI:
- **"Atlas"** = the geographic filming map. Confusable with "map".
- **"Map" / `/map`** = the node **connection graph** (its visible label was
  already "Connections"). Confusable with the geographic Atlas.

The codebase was also half-migrated: read-pages already used `locations`
(`/film/[slug]/locations`, `/director/[slug]/locations`, `/curious/locations`)
while the hub still used `atlas`. Now unified: **geographic = Locations,
graph = Network (label "Connections")**.

## URL map (every old path 308/307-redirects to the new one)
| Old | New | Redirect |
|---|---|---|
| `/atlas` | `/locations` | 308 |
| `/atlas/[country]` | `/locations/[country]` | 308 |
| `/atlas/[country]/[city]` | `/locations/[country]/[city]` | 308 |
| `/film/atlas/[slug]` | `/film/locations/[slug]` | 308 (~1,000 URLs) |
| `/room/atlas` | `/room/locations` | 307 (internal, behind auth) |
| `/map` | `/network` | 308, **query-preserving** (`?m=&t=&k=` transfer) |

`/film/[slug]/locations` and `/director/[slug]/locations` were already the
"locations" convention and are unchanged (the film one still 308s to
`/film/locations/[slug]`).

## Code identifiers renamed
- `lib/atlas.ts` → `lib/locations.ts`; `AtlasWorkspace`→`LocationsWorkspace`,
  `HomeAtlas`→`HomeLocations`, `cachedAtlas*`/`loadAtlas*`/`AtlasCity`/
  `AtlasCountry`/`AtlasMeta`/etc → `*Locations*`/`Location*`.
- `MapExplorer`→`NetworkExplorer`, `EntityMap`→`EntityNetwork`,
  `GalaxyMap`→`GalaxyView`, `HomeMap`→`HomeNetwork`,
  `TakeMapToggle`→`TakeNetworkToggle`.
- Tab ids `df-map`/`dr-map`/`theorist-map`/`concept-map`/`tp-map` → `*-network`.
- Sitemap section `sitemaps/atlas.xml` → `sitemaps/location-hubs.xml`
  (`atlasEntries`→`locationHubEntries`). CSS `sv2-atlas`→`sv2-locations`,
  `sv2-map`→`sv2-network`, `homeatlas-sec`→`homelocations-sec`. Cache keys
  `atlas-*`→`locations-*`.
- Nav / Cmd-K / film & director tab **labels** "Atlas" → "Locations". The
  **connection graph's visible label stays "Connections"** (only its URL and
  internal `map` identifiers became `network`).
- Director page's duplicate "Atlas" + "Locations" tabs merged into one
  "Locations" tab (read article linked from inside, mirroring the film page).

## KEPT ON PURPOSE — do NOT "fix" these (DB-coupled / data layer)
These are emitted verbatim by SQL RPCs (migrations `0049`–`0058`) or are data
artifacts; renaming them needs a live-DB change (out of scope), and the
redirects/keys below already make everything resolve:
- **`/api/map` endpoint** (+ `/api/map/galaxy`) — DB emits `/api/map?…` as
  `mapApi` values; the endpoint keeps its name.
- **`mapApi` / `mapFull` beat keys** and **`zone:"map"` / `zone:"atlas"`**
  strings — read straight from RPC jsonb.
- **`#df-atlas` / `#dr-atlas` anchor ids** — surprise/TV cards deep-link to
  `/film/{slug}#df-atlas`. (Visible tab *label* changed; the *id* stayed.)
- **`atlas_country_json` / `atlas_eligibility_json` / `atlas_meta_json` /
  `atlas_city_candidates_json` RPCs**, **`lib/atlas_cities.json`** +
  `worker/atlas-cities-build.py`, **`mt-atlas-lang`** localStorage key.

## Not renamed (correctly still "map")
- `FilmMap` (the MapLibre geographic renderer) — it *is* a map.
- `sitemap` / `sitemap-data.ts`, `EntityGraph` — unrelated to the two features.
- CSS class families `emap-` / `cmap-` (60 files, invisible presentational
  hooks) — deliberately left; renaming was disproportionate risk/no user
  benefit. Easy follow-up if ever wanted.

## Verification
`tsc --noEmit` clean for all touched files; Vercel production build READY;
live `curl` confirmed every redirect (incl. query preservation) + new pages
200 + `sitemaps/atlas.xml` 404 + index points to `location-hubs.xml`. IndexNow
re-submitted (38k URLs). GSC: resubmit `https://metatake.net/sitemap.xml`.

See also: `docs/STATE.md` (easily-confused pairs), `docs/PLAN-geographic-atlas.md`
& `HANDOFF-아틀라스-SEO-읽는층.md` (Locations feature), `HANDOFF-연결엔진-커넥션.md`
& `docs/PLAN-connections-overhaul.md` (Network/Connections feature).
