# FRONTEND / DISCOVERY LAYER — architecture & final decisions

**Owns:** everything the visitor *navigates* with — the home page, The Map, "Surprise me", the embedded entity-maps, the blog/newsletter surfaces — plus the cross-cutting front-end conventions and the UX decisions we locked in across the June 2026 sessions.

**Companion to:** `STATE.md` (counts/model), `RUNBOOK-new-film-ingestion.md` (data pipeline + what a new film needs to light these surfaces up), `BACKLOG.md` (undone work).

**Last updated:** 2026-06-27.

---

## 0. One-paragraph mental model

The *content* layer (`film → figure → take`, tropes, ideas, theorists, catalog) is built by the worker pipeline. On top of it sits a **discovery layer** that is almost entirely **read-only and derived**: it re-presents the same corpus as (a) a force-directed **graph** you can wander, (b) a **random draw** that surprises you with one lens at a time, and (c) **daily editions** (blog/newsletter). Because it is derived, *most* of it lights up automatically when new films land — the few exceptions (director-level generation, the director embedding) are listed in §7 and in the RUNBOOK.

---

## 1. The Map

A single graph engine, three surfaces.

### Engine — `components/EntityGraph.tsx`
Custom force-directed renderer (no library). Key facts:
- **Node id scheme:** `type:key[/key2]` → `film:slug`, `fig:filmslug/figslug`, `trope:slug`, `idea:slug`, `dir:slug`, `theo:slug`, `read:slug`. This scheme is what makes recenter possible (parse id → fetch that node's ego).
- **Node visuals:** poster image (film, w big48/else36 ×1.45), round face (director/theorist), or a colored dot. Inline year after the label in faint type. A tiny inline `↗` after the label opens the entity page (`onOpen`). COLORS: film `#3a3a3a`, figure `#1F6FB2`, reading `#C0392B`, trope `#0F6E56`, idea `#6D4AAE`, director `#B5642A`, theorist `#B23A8F`.
- **Interaction:** single click on a node (or on its name/year label) = recenter via `onNodeClick`; drag only engages after >8px of movement (so a click is never mistaken for a drag); the `↗` = open page via `onOpen`. If `onNodeClick` is absent, a click falls back to `router.push(href)`.
- **GOTCHA (do not remove):** the global `img{max-width:100%}` reset in globals.css collapses absolutely-positioned node images to width 0. Every node `<img>` sets `max-width:none` inline. If posters/faces ever vanish from the graph, this is why.

### Surface A — full explorer `/map` (`components/MapExplorer.tsx`)
Full-screen. Three tab **modes**: **Films** (default), **Directors**, **Grouped** (the whole critical web). Per-mode filters (Year / IMDb / RT) with an **Apply** button; an in-map **fuzzy search** box (top-left) → **unified `/api/search`** (`mode=lex&kinds=film,director,trope,idea,theorist,figure`, catalog films excluded) → click a hit to jump; a breadcrumb stack of where you've been. Deep-linkable: `?m=&t=&k=&k2=` focuses the map on load. Nav "The Map" points here. *(2026-07-06: was `/api/map/search`+`map_search` RPC, retired for the unified engine — see `HANDOFF-검색엔진-통합.md`.)*

### Surface B — embedded map `components/EntityMap.tsx`
The same engine dropped into a page as a section/tab. Props `{ api, full, height }`.
- Fetches the ego payload from `api` (a `/api/map?…` URL), renders `<EntityGraph>`.
- **Clicking any node RECENTERS in place** (fetches that node's ego, pushes a breadcrumb) instead of navigating away — the `↗` still opens the page. Breadcrumb chips step back. (`egoUrl(id)` reproduces MapExplorer's id→`/api/map?type=&key=&key2=` mapping.) — *added 2026-06-27.*
- Returns `null` if the root payload has ≤1 node (so empty maps don't render a dead box).
- "Open in the full map ↗" → the `full` URL (`/map?…`).

Embedded on every entity page **and** inside the home Surprise panel (map modes).

### Backend RPCs (Supabase, applied directly to live DB — see schema-capture gap)
| RPC | Returns |
|---|---|
| `map_overview()` | the Grouped hub cloud (~95 nodes) |
| `map_ego(p_type, p_key, p_key2)` | depth-3 ego for film / figure / trope / idea / director / theorist. Figure branch already surfaces films (figure→trope→film). |
| `map_film_overview(min_year,min_imdb,min_rt)` / `map_film_ego(slug)` | Films-mode cloud / a film's next·recby·like neighborhood (3 levels) |
| `map_director_overview(min_year)` / `map_director_ego(slug)` | Directors-mode cloud / a director's who's-next + embedding-similar + ring2 |
| ~~`map_search(q,n)`~~ | **RETIRED 2026-07-06** — map search now calls unified `/api/search`; RPC still in DB but unused (`HANDOFF-검색엔진-통합.md`) |
| `director_embedding` (table: slug, embedding vector(1536), nfig + HNSW) | powers director similarity in the director map. **Must be (re)built when directors are added.** |

`enrich()` in `app/api/map/route.ts` post-processes payloads: for `film:` nodes it attaches `poster_path` (w185) + year; for `dir:` nodes it attaches `profile_path` (w185) + birth year.

**Routes:** `app/api/map/route.ts` (GET `mode=films|directors` overview/ego, else `map_ego`/`map_overview`). *(In-map search: unified `app/api/search/route.ts`; the old `app/api/map/search/route.ts` was deleted 2026-07-06.)*

---

## 2. "Surprise me" (home hero)

Two independent systems share the *idea* but not the code:
- **`/random`** (full page, `app/random/page.tsx`) — the original Surprise with Film/Reading/Idea/Director toggles + a 30-card wall. Uses RPC `surprise(p_kind)` and `surprise_set()`. **Left untouched** by the home redesign.
- **Home hero** (`components/home2/HeroSurprise.tsx`) — a richer, film-anchored draw. Uses **`surprise_home()`** via **`/api/surprise/home`**.

### `surprise_home()` — how a card is chosen
1. Pick a random visible film that has ≥1 Strong Misreading (guarantees the misreading fallback always exists).
2. Roll the lens:
   - **~18%** → a rare **chip-cloud** card: one of `film_tropes`, `film_ideas`, `director_tropes`, `director_ideas` (≈ **1 in 20** each).
   - **~82%** → the common pool of 14 slots: **misreading ×6**, `film_map`, `director_map`, `figure_links`, `watch_next`, `recommended_by`, `why_watch`, `where_to_start`, `director_next`.
3. If the chosen lens has no data for that film (e.g. no `film_next` rows, no director), it **falls back to `misreading`**.
Net effect: **Strong Misreading appears at least ~1 in 3** (the user requirement) — 6/14×0.82 ≈ 0.35 baseline, pushed higher by fallbacks. Concept/Idea-only cards (the old `surprise()` idea kind) are **removed** here.

### The modes (payload → how the right panel renders)
| mode | data source | right panel |
|---|---|---|
| `misreading` | `takes` (title, rationale=**body shown in full above** the leap, leap, framework, theorist) | chip + title + via + body + "The leap" + open |
| `film_map` | `/api/map?type=film` | embedded `<EntityMap>` |
| `director_map` | `/api/map?mode=directors` | embedded `<EntityMap>` |
| `figure_links` | `/api/map?type=figure` (a random figure of the film) | embedded `<EntityMap>` |
| `watch_next` | `film_next` (source=film) | list w/ **poster** + year + reason |
| `recommended_by` | `film_next` (target=film) | list w/ poster + year + reason |
| `where_to_start` | `director_picks` | numbered list w/ poster + year + reason |
| `director_next` | `director_next` | list w/ **round face** (profile_path) + reason |
| `why_watch` | `film_asset.lenses` | list of label+text points |
| `film_tropes` | archetypes (`figure_taxonomy`+`taxonomy_nodes`) + tropes (`takes.trope_id`→`meta_takes`), shuffled | rounded **chips** (mixed) |
| `film_ideas` | `takes.concept`→`sm_concepts` | rounded chips |
| `director_tropes` | same, aggregated across the director's films | **two separate groups** (Archetypes / Tropes) of chips |
| `director_ideas` | ideas across the director's films | rounded chips |

Every card also carries the film identity (title, year, slug, director, director_slug, backdrop, **clip** = trailer id) used by the hero shell.

### HeroSurprise shell (the layout we settled on)
- **No badge** in the video's top-left corner (removed).
- **Left column = one card:** the trailer/backdrop **video** on top, with a **caption** flush beneath it (`{film} ({year}) · dir. {director}` + `THIS SURPRISE — {label}: {subject}`), so the video and its meaning read as one unit. Below that, a **long red "Surprise me — Space" bar** with small `‹ ›` prev/next arrows at its ends.
- **Right column = the lens panel** (red top-accent to pair it with the bar), rendered per the table above.
- **Behaviour:** Space or the red bar = new random draw; `‹` = back through history, `›` = forward/new; gentle auto-rotate every ~14s that **pauses on hover**. The 30-rotation idea is preserved as "you never know what's next" — candidates are deliberately *not* previewed on the home.

---

## 3. Home page (`app/page.tsx` → `components/home2/HomeV2.tsx`)

v7 design, scoped under `.mthome` (CSS in `app/home2.css`). 16 sections in band rhythm (paper / dark / paper-2). The ones that changed in these sessions:
- **§2 Hero → `HeroSurprise`** (was "Today's Feature").
- **§8b `HomeMap`** (new) — the living map embedded mid-page, **contained to max-width 840px, centered with generous side margins** (not full-bleed), draggable/zoomable, with "Open full map".
- **§13 `BlogGraph`** — the daily column. **Left** = the latest real editions rendered as specific cards (headline = `entries[0].ehead`, the event→film it turns on, excerpt, still, date — *not* the repeated "Between Film and the World"). **Right** = `NewsletterCard`.
- **`NewsletterCard`** (`components/home2/NewsletterCard.tsx`) — "Today's newsletter · {date}" framing, latest edition's specific headline + excerpt + thumbnail + the subscribe input. Compact (`align-self:start`, left padding) so there's no dead vertical space.

Both `BlogGraph` and `NewsletterCard` fetch `posts` client-side (latest published, by `edition_date`).

---

## 4. Embedded "connection map" on entity pages

Every entity page renders a `<EntityMap>` section with an SEO heading + stat line + intro (server-rendered above the map) so the page reads well for crawlers and humans:

| Page | section | api | placement |
|---|---|---|---|
| `film/[slug]` | `#df-map` "{film} — connection map" + Map tab | `?type=film&key=slug` | after tropes |
| `director/[slug]` | `#dr-map` "{director} — director map" + Map tab | `?mode=directors&key=slug` | before Filmography |
| `film/[slug]/figure/[figureSlug]` | `#fg-map` "{figure} — connection map" | `?type=figure&key=film&key2=fig` | replaces old neighbourhood |
| `trope/[slug]` | `#tp-map` | `?type=trope&key=slug` | above members |
| `idea/[slug]` | `#idea-map` | `?type=idea&key=slug` | bottom (before foot) |
| `theorist/[slug]` | `#theorist-map` | `?type=theorist&key=slug` | **TOP** (right under H1) — by request |

All of these now recenter-in-place on node click (§1, EntityMap).

---

## 5. Cross-cutting conventions & hard-won lessons

- **Auto-deploy pipeline.** I edit files; a macOS watcher (`auto-deploy-watch.sh`, run via nohup from Terminal) auto-commits/pushes `app components lib` after ~20s of quiet → Vercel auto-builds (~40s). I verify with the Vercel API (`get_deployment` READY) + Chrome DOM checks. No user clicks. (macOS TCC blocks a LaunchAgent from ~/Documents, hence nohup-from-Terminal; after a reboot the user re-runs the one-liner.)
- **DB changes** go straight to the live DB via Supabase `apply_migration` (instant). **Schema-capture gap:** most discovery RPCs (`map_*`, `surprise_home`, `director_embedding`) live only in the live DB, not in `supabase/migrations/`. (BACKLOG.)
- **Scoped CSS.** The whole v7 home + the `SiteNav` are under `.mthome` (`app/home2.css`); the rest of the site uses `app/globals.css`. Custom props (`--ink`, `--paper`, `--dark`, `--red`, `--ui`, `--serif`, `--text-serif`…) are defined on `.mthome`.
- **CSS namespace collision — the `sm-` lesson.** The "Strong Misreading" cards (`.sm-card/.sm-leap/.sm-meta…` on film/figure/`/strong-misreadings`) and the `/random` "Surprise" page accidentally shared the `sm-` prefix, so the dark surprise styles clobbered the misreading cards (black box, invisible text). Fix: the `/random` surprise CSS is **scoped under `.sm-page`**. Lesson: never reuse a class prefix across two unrelated component families.
- **Sticky top nav via `display:contents`.** `SiteNav` wraps the nav alone in a `.mthome` div, so `position:sticky` had only a nav-tall box to stick within and scrolled away. Fix: the wrapper is `.mthome--bare { display:contents }`, so the nav's containing block becomes the page (`.mt`) and it stays pinned. `FilmTabBar` measures the nav height dynamically and sticks the tab bar right below it — so they never overlap.
- **No `localStorage` in artifacts**; in-app client state only.
- **Verification discipline.** Background-tab `window.scrollTo` is throttled in the Chrome MCP, so scroll-based checks fall back to computed-style assertions; node graphs are verified by counting rendered `<img>`/`<svg>` children and reading DOM text, not just screenshots.

---

## 6. Final UX decisions (locked, from user feedback)

- Trope/"Trops" lens dropped from the map toggles; map modes are Films / Directors / Grouped only.
- Year shown inline, **no parentheses-on-newline**, faint color, right after the title.
- One **tiny** `↗` after the year for "open page"; everything else is single-click recenter.
- Posters ~10% smaller than the first cut; film nodes are posters, director/theorist nodes are round faces.
- Apply button is small/outline, beside the filter selects (not a big banner).
- Surprise: body text **above** "The leap" must show in full for Strong Misreadings.
- Newsletter/blog titles must be **specific** (date + event + film + excerpt), never the repeated series name.
- Keep verification waits short (~8s); notify with a clear final "알림" when results are ready; reply in Korean; concise.

---

## 7. What a NEW film needs to fully light up the discovery layer

(Full pipeline in `RUNBOOK-new-film-ingestion.md`. This is the discovery-specific view.)

**Lights up automatically** (derived, no per-film step) once the film has figures/takes/tropes/ideas + TMDB media:
- The Map (all modes), the film/figure/trope/idea connection maps, and **unified site search** (`search_all` picks up new films automatically; semantic once their embeddings land).
- Surprise modes: `misreading`, `film_map`, `figure_links`, `film_tropes`, `film_ideas` (and `watch_next`/`recommended_by`/`why_watch` once those per-film tables are filled by the pipeline).
- Home middle map, latest-editions cards (if a blog edition references it).

**Needs a step:**
- **`why_watch` / `watch_next` / `recommended_by`** cards need `film_asset` / `film_next` populated (pipeline Stages 12–13).
- **Director surfaces** (`director_map`, `where_to_start`, `director_next`, `director_tropes`, `director_ideas`) need the **director generation layer** for any *new* director: `director_portrait`, `director_picks`, `director_facts`, `director_next` (RUNBOOK Stage 15) **and** a refresh of the **`director_embedding`** table (RUNBOOK Stage 16) — otherwise the director map's similarity ring and the who's-next card are empty.
- The blog/newsletter surfaces need a published `posts` edition (separate daily content stream).
