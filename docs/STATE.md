# STATE — Metatake (living snapshot)

**Last verified:** 2026-06-24 (counts) · **2026-06-27** (discovery layer added: The Map, home "Surprise me", home v2, newsletter/editions — see `FRONTEND-DISCOVERY-AND-DECISIONS.md`). This is the single "where are we" file; update it in place each session. Replaces `docs/STATE-2026-06-17.md` (kept only as history).

---

## 1. The model (current, canonical)

`film → figure → take`. Each **take** carries:
- a **framework** = one of **14 "Strong Misreadings"** (SSOT: `lib/frameworks.ts`; stored in `takes.framework`), and
- a link to a **trope** hub (`meta_takes.kind='figure_type'`, via `figure_type_members`).

Figures are also classified into the **Catalog / Archetype** taxonomy (`taxonomy_nodes` + `figure_taxonomy`, 5 sections: objects, characters, locations, themes, theory).

**Retired layer:** the old "meta-take / reading hub / register" model is gone. `meta_takes.kind='reading'` hubs survive only as *unpublished candidates* — do not surface them. Every published hub today is a trope.

### Terminology (old → new)
| Old | New |
|---|---|
| meta-take / reading hub | retired → **Trope** hub + **Strong-Misreading** framework |
| register (10) | **framework** (14 Strong Misreadings) |
| "Frames" (Q&A) | *separate system*, not frameworks — community Q&A taxonomy |
| "films like" / 인근값 | `film_affinities` |

> ⚠️ Two easily-confused systems: **frameworks** (14 strong-misreading angles, `lib/frameworks.ts`) vs **frames** (community-Q&A classification, `frames`/`question_frames` tables). And `meta_takes` is **polymorphic** via `kind` (it backs trope hubs *and* the legacy reading hubs).

---

## 2. Live counts (2026-06-24)

| Entity | Count | Note |
|---|---|---|
| films | **1,957** | visible **1,935** · 22 hidden (thin-content <3 figures) · is_analyzed all 1,957 (Tier-1) |
| figures | **18,168** | all approved |
| takes | 73,478 total · **26,975 published** | rest retired/candidate |
| hubs published | **4,710** | **all `kind=figure_type` (tropes)** |
| reading-kind hubs | 4,883 candidate | legacy, unpublished — not surfaced |
| retired hubs | 1,446 figure_type + 935 reading | from re-form/consolidation |
| figure_type_members | 19,186 | figure ↔ trope |
| figure_tags | 39,944 | trope-tag output |
| taxonomy_nodes | 2,928 | Catalog archetypes |
| figure_taxonomy | 42,958 | figure ↔ archetype |
| theory_canon | 2,587 | concepts |
| film_affinities | 38,800 | "films like" |
| film_reception | **8,884** | Reception tab (critics) |
| film_next | 17,095 | Watch next (+ reverse = Recommended-by) |
| **film_asset** | **1,957** | Why-watch — now LOADED (live) |
| director_picks | 1,019 | "Where to start" (Surprise + director page) |
| director_next | 1,011 | "Who's next" (Surprise + director page) |
| director_embedding | 873 | director-similarity for the director map |
| film_features | 59 | LLM reception/pitch essays |
| magazine_passages | 80 | RAG sources |
| user_movies | 0 | watchlists just shipped |
| user_pins | 4 | follow/like |

---

## 3. Site map (routes → data)

- **Home/discovery:** `/` (home v7 = `components/home2/HomeV2.tsx`; **Surprise me hero** `HeroSurprise` ← `surprise_home()` via `/api/surprise/home`; mid-page **HomeMap**; **NewsletterCard** + editions `BlogGraph` ← `posts`), `/latest`, `/trending`, `/random/*` (legacy Surprise, `surprise()`/`surprise_set()`).
- **The Map:** `/map` (`MapExplorer`, 3 modes) + embedded `EntityMap` on every entity page & in the Surprise panel. Engine `components/EntityGraph.tsx`; routes `/api/map`, `/api/map/search`. See `FRONTEND-DISCOVERY-AND-DECISIONS.md`.
- **Film:** `/film` (index), `/film/[slug]` (hub: figures/takes, tropes, reception, why-watch, watch-next, affinities — via `film_catalog`, `film_reception`, `film_asset`, `film_next(_reverse)`, `film_affinities`), `/film/[slug]/figure/[figureSlug]`, `/film/[slug]/q/[q-slug]` (Q&A), `/genre[/slug]`.
- **Director:** `/director` (`directors_catalogue/_featured`), `/director/[slug]`.
- **Strong Misreadings:** `/strong-misreadings` (`frameworks_overview`), `/strong-misreadings/[fw]` (`readings_by_framework`, `framework_facets`).
- **Tropes:** `/tropes` (`tropes_catalogue/_featured`), `/trope/[slug]` (`trope_related`).
- **Catalog/Archetype:** `/catalog` (`catalog_kind_counts`, `catalog_top_nodes`, `concept_index`), `/catalog/[seg]`, `/catalog/[seg]/[slug]`.
- **Concept/theory:** `/concept`, `/concept/[slug]`.
- **Search/Ask/RAG:** `/search` (`search_site`), `/ask`,`/chat`,`/rag` → `api/ask*`,`api/rag` (`ask_retrieve`, `magazine_retrieve`).
- **Account:** `/me` (`get_my_pins`, `user_movies`), `/u/[username]`, `/settings`, auth pages.
- **Watchlists (new):** Seen/Watchlist + rating on film pages (`user_movies`), `/me` lists, `/api/tmdb-search` + `/api/track` (lazy Tier-2 import), Tier-2 minimal page `/film/tmdb-<id>` (noindex).
- **Blog/static:** `/blog[/slug]`, `/about`,`/contact`,`/privacy`,`/terms`,`/guidelines`. **Admin:** `/admin/*`, `/editor`.
- **Legacy still mounted:** `/meta-takes`, `/take/[slug]`, `/frames`,`/frame/[slug]` (Q&A frames), `/movies-like/[slug]`.

---

## 4. Data model (core)

- **films** (`id uuid` PK, `slug`/`tmdb_id` unique, year, director(+slug), genres[], poster/backdrop, tmdb_extra, **visible**, **is_analyzed**) → parent of figures, film_features, film_affinities, film_reception/next/asset.
- **figures** (`id uuid`, film_id, kind∈character/object/location/trope/form, label, slug, description, embedding) → parent of takes; linked to trope hubs via `figure_type_members`, to catalog via `figure_taxonomy`.
- **takes** (`id uuid`, figure_id, meta_take_id, **framework**, register, rationale, theorist, embedding, status) — HNSW index in `build-takes-hnsw.sql`.
- **meta_takes** (`id uuid`, slug, title/laconic/thesis/essay, embedding, **kind** [figure_type=trope | reading=legacy], status, merged_into) + `figure_type_members`, `meta_take_rankings`, `meta_take_edges`, `slug_history` (redirects).
- **Catalog:** `taxonomy_nodes` (kind-discriminated) + `figure_taxonomy` (figure↔node). SSOT `lib/catalog.ts`.
- **Per-film extras:** `film_features` (pitch/record/reception/experience), `film_reception` (critics), `film_next`, `film_asset` (why-watch lenses), `film_affinities` (films-like).
- **Users:** `profiles`, `user_pins` (follow/like, polymorphic), `user_movies` (watched/watchlist + rating).
- **RAG/Q&A:** `magazines`/`magazine_passages`, `questions`/`canonical_answers`/`contributions`/`votes`/`flags`, `frames`/`question_frames`.
- **Embeddings** (1536-d, OpenAI) on figures/takes/meta_takes/frames/canonical_tags/magazine_passages. **Search:** pg_trgm GIN; `search_site` via similarity().

> ⚠️ Schema-in-VCS gap: migrations `0001–0026` cover the base. Much of the catalog/trope/strong-misreadings/reception/watch-next/ask layer (incl. `films.visible/is_analyzed`, the visible-trigger, many RPCs) was applied **directly to the live DB** and is **not** in `supabase/migrations/`. See BACKLOG "schema capture".

---

## 5. Shipped vs pending

**Shipped & live:** Strong-Misreadings model + 14 frameworks; tropes (re-formed); Catalog/Archetype; film page tabs (Invitation, Why-watch UI, Recommended-by, Strong Misreadings, Figures, Tropes, Archetype, Reception, Watch-next, Films-like, Information); Reception (8,884); Watch-next (17,095) + Recommended-by; Watchlists Phase 1+2 (Seen/Watchlist/rating, lazy TMDB import, Tier-2 page); Ask/RAG; search; blog; mobile-first.
**Discovery layer (2026-06-27, shipped):** The Map — `/map` explorer (Films/Directors/Grouped) + embedded recenter-in-place `EntityMap` on all 6 entity pages (RPCs `map_overview`/`map_ego`/`map_film_*`/`map_director_*`/`map_search`, `director_embedding`). Home v7 — **Surprise me** hero (`surprise_home()`, ≥⅓ Strong Misreading + film/director map·watch-next·recommended-by·why-watch·where-to-start·who's-next·archetype/trope/idea chip cards), mid-page HomeMap, **Newsletter card + real-edition blog cards**. Sticky top nav. Director layer (portrait/picks/facts/next). See `FRONTEND-DISCOVERY-AND-DECISIONS.md`.

**Pending (see BACKLOG):** Watchlists Phase 3 (promotion); Catalog Concepts→Theory absorption; personalization portfolio `/me`; lineage (계보) tag layer; per-page SEO head-copy; figure aliases; node-graph calc; tradition-match automation; **schema capture (now incl. `map_*`/`surprise_home`/`director_embedding`)**; **`refresh_director_embeddings()` RPC + auto director-generation trigger for new directors**; new-trope formation (gardening); doc archival.
