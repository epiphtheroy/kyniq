# PLAN — Phase 2: "Movements" (the origin & tradition browse axis)

**Part of** `PLAN-curation-integration.md`. Depends on the Phase 1 bridge (`public.film_curation`)
and the Phase 0 origin finalizer. This is the **"World Cinema Atlas"** idea from the curation
HANDOVER (§2.5, §5.4, §6.6) — redesigned and **renamed**.

---

## 1. Name & scope (DECIDED)

- **Name: "Movements"** · route `/movements`. ("Atlas" was rejected — it already means the
  geographic map at `/atlas`, and this layer is a *curated directory*, not a map.)
- **Scope (decided): unified.** One section holds **both** kinds of tradition, shown as two
  groups:
  - **National cinemas** — Korean, Iranian, Japanese, Taiwanese… (film-studies "national cinema").
  - **Waves & movements** — Italian Neorealism, the Nouvelle Vague, New German Cinema, Dogme 95,
    Hong Kong New Wave…
- Rationale: the data naturally carries both (`lineage_lists`: **movement 67, national 47**), and
  a cinephile browses history through both lenses. One nav entry, two clearly-labeled groups.

## 2. Relationship to Lineage (no duplication)

Same lineage data, split by **user intent**:
- **Lineage** (`/lineage`, exists) = a film's **record**: awards, canons, festival selections,
  auteur line. The completist "every list" index.
- **Movements** (`/movements`, new) = a film's **origin & tradition**: its national cinema and
  its wave/movement. The marquee front door for the *where-from / what-tradition* axis.

Data underneath: `lineage_lists` (facets `national`, `movement`) for film membership +
`curation.hub` / `curation.film_hub` for **editorial policy** (which nations are standalone vs
region-grouped, the 12-film floor, strategic tier) + the Phase-0 origin `country_code` from the
`film_curation` bridge. Rule: **lineage = data, curation = policy.**

## 3. User perspective (the HANDOVER's four goals, made concrete — §5.4)

A cinephile thinks *"I want to dig into Korean cinema / the French New Wave / Iranian film."*
1. **Exploration path** — a beautiful directory to wander by nation and by movement.
2. **Topic authority (GEO/SEO)** — `/movements/korea` answers "best Korean films";
   completeness itself is the citation authority.
3. **No orphan thin-pages** — every obscure film gets a *parent tradition* with context + links.
4. **Operational unit** — publish a hub early, analyze its films by priority.

## 4. IA & pages

**`/movements` (index).** A curated **directory, not a map**, with real wayfinding (the index
can hold 22+ national cinemas + region hubs + 67 movement lists, so it MUST be filterable):
- **Group toggle** — National cinemas ↔ Waves & movements (or "All").
- **Search box** — type-ahead over hub names ("Iran" → Iranian cinema; "dogme" → Dogme 95).
- **Region facets** — Asia · Europe · Africa · Americas · Middle East · Oceania (for the national
  group); Era facets (Silent · Classical · 1960s–70s waves · Contemporary) for movements.
- **Sort** — Most covered (analyzed film_count) · Alphabetical · By era. Default: most covered.
- **National cinemas** — depth-weighted, poster-tiled grid (sized by how much of that cinema we
  cover); sub-floor nations fold into **region** groupings (West Africa, the Maghreb, the Balkans…).
- **Waves & movements** — the aesthetic movements/waves strip.
- Cross-link: "Prefer the map? See every film on the **Atlas** →."
- *Reuse the existing facet + search-feed pattern already built for `/strong-misreadings/[fw]`
  (task #186) and the meta-takes index facets/sorts — same components, consistent UX.*

**`/movements/[slug]` (one tradition — nation, region, or movement; one template).** e.g.
*Korean cinema* or *Dogme 95*. A rich hub can list dozens of films, so it needs in-page
navigation and filtering:
- **Sticky sub-tab bar** (reuse the film page's `FilmTabBar` — horizontal-scroll on mobile):
  Overview · Start here · The canon · Auteurs · Related · Deep cuts · On the map. Clicking scrolls
  to the section.
- **In-hub film filter/sort** on the canon list: filter by **decade/era**, by **auteur**, by
  **Seen / Watchlist** (for logged-in users), and sort by demand · prestige · year. Essential for
  big national cinemas (Korean, French, Japanese) with many films.
- Sections: **Curator intro** (short LLM-authored orientation; data-built stub until authored) ·
  **Start here** (3–5 gateway films, high authority × accessible demand, with a reading hook) ·
  **The canon we hold** (list ∩ analyzed films, ranked by demand; poster cards + one-line
  Strong-Misreading hook; this is the filterable list) · **Key auteurs** · **Related traditions**
  (a national hub ↔ its waves/movements) · **Deep cuts** (high-authority / low-demand, quadrant B)
  · **On the map** (link to the geographic **Atlas** filtered to this country).

**Gating (thin-content discipline):** a hub goes live only when it clears the **12-film floor
with *analyzed* films**. Below floor → fold into a region hub, or "coming soon" + `noindex`.
Indexability derives from the Phase-1 `should_index` logic.

**On each film page (reciprocal link — YES, every film joins this axis).** A film must show which
traditions it belongs to, so the graph is walkable both ways (film → its cinema/movement →
sibling films). Add a compact **Movements** line near the top metadata (it already shows
director · country · year): chips like `🇰🇷 Korean cinema · Korean New Wave`, each linking to its
`/movements/[slug]` hub. Lightweight chips (not a whole new film-page tab) keep the tab bar
uncluttered; this mirrors the existing Catalog "Classified as" chip and the Lineage tab. Films
below a tradition's floor still get their chip — that parent hub is exactly what rescues them from
being orphan thin-pages (HANDOVER goal §3).

## 5. Backend (additive; reads curation)

- **Both groups now source from `curation.hub`** (single source): national/region hubs
  (`hub_type in country/region`) and movement hubs (`hub_type='movement'`), membership via
  `curation.film_hub` → `public.films` (visible only). *(v1 read movements from `lineage_lists`,
  but those definitions had 0 film links; the movement-linking pass materialized memberships into
  `curation.film_hub`, so v2 reads there.)*
- `movements_index()` — two groups, each hub with visible film_count, tier, region, poster thumbs.
- `movement_detail(slug)` — resolves any `curation.hub` slug; `kind` derived from `hub_type`;
  returns hub meta + films (ordered by demand) + auteurs. Page slices Start-here / Deep-cuts.
- Reuse `/atlas` with a `?country=` filter for the "On the map" link (national hubs).
- No new content tables; optional `curation.hub.description` for authored blurbs.

**Status (movement linking, done by the movement pass):** 27 movement hubs live · 324 film↔
movement links, auto-derived from the `director` field + year windows (no external data).
Top: Iranian New Wave 26 · Japanese Golden Age 23 · French New Wave 22 · New Hollywood 21 · New
German Cinema 20 · Korean New Wave 15… **Style-based movements** (Film Noir, Classical Hollywood,
Direct Cinema, Essay Film, Giallo) aren't director-defined — per operator decision they are **not
pursued** (left unlinked / not shown). See WORKORDER-style-movements.md (WITHDRAWN).

## 6. Nav placement

Add **Movements** to the **Watch** group (Films · Directors · **Movements** · Latest · Trending)
— a core way to browse *into* films. (Alternative: the Wander group, beside Atlas.)

## 7. Personalization hook (feeds Phase 3)

A user's saved/seen films reveal which traditions they gravitate to → the **origin/tradition
recommendation axis**: *"You keep exploring Korean & Japanese cinema — try Taiwanese New Cinema
(Hou, Yang)."* `/me` can show **"Your movements"** — a personal world of what they've watched and
the next tradition to open. Movements is thus both a browse axis and a taste dimension.

## 8. Sequence

1. ~~Name & scope~~ — DECIDED (§1: "Movements", unified).
2. Phase 0 finalizer done → origins trustworthy, `rebuild_country_hubs()` sets live hubs.
   *(National hubs must wait for this; movement hubs do not — they aren't origin-gated.)*
3. `movements_index()` + `movement_detail()` RPCs over the bridge.
4. `/movements` index + `/movements/[slug]` template + `?country=` Atlas filter + nav + CSS.
5. Deep-cut & cross-link polish; then authored curator intros (LLM worker).
6. (Phase 3) "Your movements" on `/me`.

## 9. Concerns

- **Accuracy gate:** no national hub before Phase-0 origins are final (avoid "Gran Torino = Japan").
  Movement hubs can ship earlier.
- **Thin pages:** enforce the analyzed-film floor + `should_index`.
- **Don't split-brain with Lineage:** Movements owns national + movement (origin/tradition);
  Lineage keeps awards + canons + festivals + auteur (record/honors). Cross-link, don't duplicate.
- **Atlas vs Movements:** distinct and cross-linked — map vs directory. Never reuse "Atlas" here.
- **Label clarity:** because the section spans nations *and* movements, the two on-page groups
  must be explicitly labeled ("National cinemas" / "Waves & movements") so "Korean cinema" never
  looks mislabeled as a "movement."
