# PLAN — Geographic Atlas (FilmAtlas) : the real-world map of cinema

> ⚠️ **Renamed 2026-07-12: "Atlas" → "Locations"** (`/atlas`→`/locations`, `/room/atlas`→`/room/locations`; old paths 308). This doc also decided "The Map"→"Connections" for the graph — that graph's route is now `/network` (label still "Connections"). DB-coupled names kept. Mapping: `docs/RENAME-atlas-locations-map-network.md`.

**Decided 2026-06-28.** A second kind of map for Metatake: a **geographic** one (lat/lng on a real map), distinct from the existing **node/critical graph** ("The map" → renamed **Connections**). Approach chosen: **FilmAtlas** = the *narrative geography* of films (the places a film is *about* / set in / names), built from our existing content. Real *filming locations* (production geography, the `movie-locations-project` agent) are a **later, second layer** ("Filmed").

Source handoffs studied: `Google map/HANDOFF-맵프로젝트-AI인수인계.md` (map impl + 3 PoCs), `movie-locations-project/HANDOVER.md` (legally-safe location-fact extraction). Companion: `FRONTEND-DISCOVERY-AND-DECISIONS.md`, `RUNBOOK-new-film-ingestion.md`.

---

## 1. The two geographies (do not conflate)

| Layer | Meaning | Source |
|---|---|---|
| **setting** (Phase 1, this plan) | places the film is *about* / set in / names | our `figures.kind='location'` (1,849) + film overview + take text |
| **filmed** (Phase 4, later) | where it was physically shot | `movie-locations-project` LLM+search agent (verified/tiered/legal) |

One map, two toggleable layers, different colors. Phase 1 ships **setting** only.

## 2. The location LENS stays — it becomes the map's content

We keep `figures.kind='location'` (the critical "what the place *means*" layer). Geocodable real places among them become **setting pins**; clicking a pin opens that location figure's page (its Strong Misreadings) — the handoff's "navigate map → read" UX. Fictional/abstract places stay lens-only (no pin). "Any place name can go on the map" = exactly this.

## 3. Naming (collision fix)

- **Geographic map = "Atlas"** — nav route `/atlas`; film/director tab "Atlas"; section ids `#df-atlas` / `#dr-atlas`.
- **Node/critical graph = "Connections"** — rename the old "The map" nav item + `/map` stays the route, EntityMap tabs read "Connections map".

## 4. Data model

```
film_locations(
  id, film_id FK, layer text default 'setting',     -- 'setting' | 'filmed'
  name text,                 -- the place string (real-world)
  narrative_setting text,    -- how it appears in the film (optional)
  scene_role text,           -- short self-worded role (optional)
  kind text,                 -- city|region|country|landmark|venue|area
  lat double precision, lng double precision,
  precision text,            -- exact|venue|city|area|region|country|approx
  country text,
  built_set bool default false, set_host text,       -- for 'filmed' layer
  figure_id uuid,            -- ↔ the location figure (setting layer)
  source text,               -- 'figure'|'overview'|'take'|'agent'
  tier text, sources jsonb,  -- for 'filmed' layer (legal provenance)
  confidence numeric, created_at)

geo_cache(name text PK-normalized, lat, lng, precision, country, source, created_at)
```
`geo_cache` dedupes place strings (Paris/NYC/Tokyo recur across films) so we geocode each distinct name **once** and reuse. RPCs: `film_geo(slug)`, `director_geo(slug)`, `geo_overview(bbox?)` → GeoJSON-ready rows. RLS: public read.

## 5. Map frontend (keyless, swappable)

**MapLibre GL JS via CDN** (no npm dep, no API key) + **OpenFreeMap** vector tiles + **Esri World Imagery** satellite (toggle). Component `components/FilmMap.tsx` (client, dynamically loads MapLibre from cdnjs). Data via `/api/geo?film=|director=|overview` → GeoJSON. **Data/presentation separated** → can swap to Google Maps JS later with zero data change. Left list reflects what's in view; click pin/list → read.

## 6. Extraction + geocode pipeline (the repeatable engine)

Two workers, both DRY→apply, parallel/batch, resumable — designed so **re-running on new films is one command** and **quality is reviewable before it lands**.

1. **`worker/geo-extract.py`** — per film, one LLM call (Batch API, cheap model) over {location figures + overview + take rationale/leap} → place names with `kind/scale/scene_role` + the `figure_id` each ties to. Emits a DRY JSON for review; `--apply` writes `film_locations` rows (lat/lng null). Idempotent (skips films already done). Parallel = one combined Batch across all films.
2. **`worker/geo-code.py`** — collects distinct `name`s with null coords → geocodes (Google Geocoding default; Nominatim free fallback) → fills `geo_cache` → joins back to `film_locations`. Resumable (checkpoint), rate-limited, caches so re-runs cost ~0. DRY prints a yield/precision histogram.
3. `.command` runners: `run-geo-extract-dry/apply.command`, `run-geo-code.command`.

**Geocoder economics (2026):** Google Geocoding = 10,000 free/month, then $5/1k (→~$4/1k at volume). With dedupe+cache (distinct names ≪ films) our one-time cost is ~free–tens of dollars; per new film ≈ free. Nominatim = free, 1 req/s (overnight batch).

**Seed (done by Claude now, no keys):** knowledge-based coordinates for the distinct location-figure labels (the PoC method) → immediate live pins for evaluation; the Google pass later refines `precision`.

## 7. New-film integration (RUNBOOK stage)

Add **Stage 17 — Geographic Atlas** to `RUNBOOK-new-film-ingestion.md`: after figures exist, run `geo-extract` (place names + figure links) → `geo-code` (new distinct names only). Cheap, additive, never touches other films. The Atlas tab/`/atlas` then light up automatically. (Filming-location "filmed" layer = optional Phase 4 agent.)

## 8. Phasing

- **P1 (now):** schema → knowledge-based geocode seed → `/api/geo` → `FilmMap` → film page **Atlas tab** → nav rename → deploy/verify.
- **P2:** full LLM extraction from text (richer than figure labels) + **director Atlas tab**.
- **P3:** global **`/atlas`** nav map (move map → left list → read) + home placement.
- **P4 (optional):** real **filming locations** via the `movie-locations-project` agent as a second "Filmed" layer (legal guardrails ON: multi-source, rephrase, quarantine protected-DB-only, store source URLs).

## 9. Risks / watch-items

Geocode yield is low for vague places (skip, honest) · don't conflate setting vs filmed (color/toggle) · MapLibre now, Google Maps later if wanted · knowledge-based seed coords are approximate (`precision='approx'`) until the Google pass · keep the legal guardrails for the future filmed layer.
