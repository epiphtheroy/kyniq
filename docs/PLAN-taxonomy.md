# Taxonomy / Catalog layer — design proposal

Proposed 2026-06-23. A new top-level layer that **classifies** figures (objects, characters, later
locations & theory) against an a-priori controlled vocabulary. Distinct from the Trope layer.

## The core distinction (keep these separate)
- **Trope layer (built)** — *interpretive*: what a figure **means**. Bottom-up, embedding-clustered from
  Strong Misreadings, critic-gated. "The Object That Will Not Be Mourned."
- **Taxonomy layer (new)** — *ontological / descriptive*: what a figure **is**. Top-down controlled
  vocabulary, authored a priori. "The Coveted Jewel" / "Mother" / "The Mask-Wearer."

A single figure can carry BOTH: it *is* a coveted jewel (taxonomy) and it *means* the-object-that-will-not-
be-mourned (trope). Two tables, two UXs, cross-linked.

## What the two catalogs are (from the xlsx)
**Object_Catalog** — 583 object-archetypes, each a NAMED class with facets:
- Object Type (23 codes, T01 Timepiece … T00 Symbolic), Primary/Secondary Function (I–VII), and a
  "Playwright's-Tool" literary definition. Plus split-out sheets: 21 "craft devices" → belong to a METHOD
  vocabulary; 147 "abstractions" → belong to the theme/trope layer (NOT objects). 65 proposed gaps.
- So: objects = named archetypes + (type × function) facets.

**Character_Catalog** — a 3-axis faceted model (no single name per row; archetype emerges):
- Axis1 Objective Identity (903 roles: Mother, Doctor, Widow…), MANY per character, faceted by area.
- Axis2 Narrative Function (57: Protagonist, Antagonist, Foil…), FEW per character, plot-defined.
- Axis3 Internal Complex (146: "Authenticity vs The Mask" → designation "The Mask-Wearer"), 1–3 per character.
- Key insight: **Trope/Archetype = Role (Axis1/2) × Complex (Axis3)** — e.g. Femme Fatale = Seductress +
  "Sexual Desire vs Emotional Distance".

Asymmetry to accommodate: objects are named archetypes w/ facets; characters are pure facets whose product
is the archetype. (Location, Theory catalogs to follow.)

## Why it's a good idea
- Complements tropes: stable, browsable, SEO-friendly *classification* on top of the interpretive layer.
- Gives the ~reading-less ("hidden") figures a purpose — every figure can be classified even with no Strong
  Misreading yet (18,168 figures all approved; only those with readings currently surface).
- Cross-cutting discovery: "all femme fatales", "all coveted-jewel objects", "all Mask-Wearer characters",
  "all Antagonists" — none of which the trope layer gives.

## Risks / things to get right
1. **Mapping figures → vocabulary is the hard 80%.** 1,777 object-figures + 3,100 character-figures are
   film-specific free text ("Queen Anne's 17 rabbits"); the catalog is general ("The Pet/Animal Companion").
   Instance→class, many-to-one, some map to several, some to none. Needs a pipeline + an "unclassified" state.
2. **Don't double-file.** Object catalog itself says 147 entries are abstractions (theme/trope layer) and 21
   are methods. Route: perceptible object → Object catalog; abstraction → theme/trope; method → method vocab.
3. **Overlap with figure.kind.** figures already have kind (object/character/location/…); taxonomy refines
   WITHIN a kind, not replaces it.
4. **Vocabulary governance.** A controlled vocabulary drifts as films are added (the "Proposed gaps" +
   "Contemporary audit" sheets already anticipate this). Need an add-to-vocabulary workflow.
5. **Thin content / SEO.** Surfacing reading-less figures via catalog pages is good for browsing but keep
   figure pages with 0 readings noindex (the thin-content guard already exists).
6. **Scale of IA.** 903 + 583 + 146 nodes → must group by facet/area, not flat lists of 900 pages.
7. **Public name.** "Taxonomy" is fine internally; folder is "Element". Public label TBD (Catalog / Elements
   / Encyclopedia / Index).

## Proposed implementation

### Data model
- `taxonomy_nodes` (the vocabulary): id, kind ('object'|'char_identity'|'char_function'|'char_complex'|
  'location'|'theory'), code, label, slug, definition, parent_id (type→archetype, area→complex),
  facet cols (object: type_code, function_code; complex: designation_alt, area), embedding, status.
  One table, `kind`-discriminated, holds all catalogs.
- `figure_taxonomy` (the mapping): figure_id → node_id, axis, confidence, source (llm|embed|manual).
  Many-to-many. Kept separate from meta_takes/tropes; cross-linked in the UI.

### Pipelines (reuse the disciplined DRY→review→persist pattern)
- **Import** xlsx → taxonomy_nodes (+ embed label+definition for matching). One loader.
- **Map figures → nodes**: (a) embedding kNN proposes candidates (figures already embedded); (b) LLM batch
  picks archetype + facets with abstention; characters get Axis1[] + Axis2 + Axis3[]. DRY → review → persist.
  Objects first (1,777), then characters (3,100), then locations.

### UX (new top-level "Catalog")
- Hub: Objects / Characters / Locations / Theory, each showing its facet structure.
- Object archetype page: definition + type/function + every film figure classified as it (thumbnail grid) +
  related tropes.
- Character: browse by Axis1 (identity), Axis2 (function), Axis3 (complex); a "Femme Fatale" page = the
  Role×Complex intersection.
- Figure page: add a "Classified as" chip line (links to catalog) alongside Tropes + Strong Misreadings.

### Phasing
- v0: DB model + import both catalogs + embeddings.
- v1: figure→taxonomy mapping pipeline (objects → characters), DRY→persist.
- v2: catalog hub + archetype/facet pages + figure-page chips.
- v3: location + theory catalogs; taxonomy↔trope cross-links; search integration.

## Decisions (locked 2026-06-23)
- **Status: design only** — do NOT build yet; build after the big task.
- **Mapping: hybrid** (embedding kNN proposes → LLM batch confirms, with **abstention** — partial coverage
  is intended; noisy figure.kind means many figures route to theme/trope or stay unclassified).
- **Objects: two-tier** — always assign Type + Function; named archetype only on a confident match.
- **Characters: Axis2 (narrative function) deferred** — v1 tags Axis1 (identity) + Axis3 (complex) only.
- **Theory: reuse the existing canon** — no parallel store.

### Naming (locked)
- Top-nav category: **Catalog**. Sections: **Objects · Characters · Themes · Theory · Locations** (Locations later).
  Routes: `/catalog`, `/catalog/object/{slug}`, `/catalog/character/...`, `/catalog/theme/...`, `/catalog/theory`, `/catalog/location/...`.
  (Nav uses short section nouns; page H1 may read "Object Catalog" etc.)
- Three distinct words, three meanings — never blur:
  - **Catalog** = the classification system (this category).
  - **Archetype** = a *named type* inside the Catalog (esp. Characters: Femme Fatale = Role × Complex; and the
    named object types like "The Coveted Jewel"). Item-level term only — NOT in the category name.
  - **Trope** = a recurring *reading* (the existing Strong-Misreading cluster layer). Reserved for readings.
- **Concepts → absorbed into Catalog/Theory.** The existing `theory_canon` (2,587) + `/concept` pages BECOME
  the Catalog's Theory section. At build: drop the standalone "Concepts" nav item; `/concept` and
  `/concept/{slug}` 301-redirect into `/catalog/theory/...` (keep the slugs). One mental model, one nav slot.
- Figure page shows all layers without collision, e.g.:
  `Catalog: Object → The Coveted Jewel · Type Jewelry · Function Aspiration` /
  `Trope: The Object That Will Not Be Mourned` / `Strong Misreadings: …`.

### Theme axis — added 2026-06-23 (Theme Catalog / "UCN")
A 5th Catalog axis: **536 themes** (the abstract subject a work is *about* — Being-towards-Death, Crisis of
Faith, Class Conflict, Structural Violence, Flow, Animism), each with a paragraph definition, faceted by
**Facet F1–F6** (F1 Existential/Ontological · F2 Dramatic theme/Human conflict · F3 Sociopolitical/Critical-
theory · F4 Mode/Genre/Register · F5 Formal/Aesthetic strategy · F6 Affirmative/comic pole) and grouped by
**Cluster C01–C21** (21 theme families). Loaded as `kind='theme'` (+ `kind='theme_cluster'` parents). This is
exactly the abstraction layer the Object catalog deferred (its "→ Theme layer" of 147 abstractions), now
formalized + deduped (28 merged) + gap-filled (the affirmative/comic pole corrects the dark-theory bias —
same anti-bias value as the trope work).

Distinctions to hold (overlap risks):
- **Theme ≠ Trope ≠ Concept/Theory.** Theme = what it's *about* (a stable subject); Trope = a recurring
  *reading*; Theory/Concept = the *theorist's named idea*. Keep all three as separate layers, cross-linked.
- **F3 (critical-theory, theorist-named) overlaps the Theory canon.** Boundary: Theme holds the *subject*
  ("Structural Violence" as a theme); Theory holds the *theorist/concept* (Galtung). Link F3 themes to canon
  rather than duplicating.
- **F5 (formal/aesthetic) overlaps the Process framework + form-kind figures** — the sheet's per-facet
  membership tests already separate them; honor those tests at mapping time.
- **Theme is the densest axis** — nearly every figure/film is "about" something, so figure→theme mapping will
  return many candidates. Cap to top-N per figure by confidence to avoid noise.
- **Attachment**: tag figures (figure_taxonomy axis='theme'); a film's themes roll up as the union of its
  figures' themes (optionally curate a few film-level "primary themes" later).

Import status: `catalog-load.py` now loads all axes — **2,928 nodes** total (object_type 23, function 7,
object 645, char_identity 903, char_function 57, char_complex 146, char_archetype 16, theme_cluster 18,
theme 536, **location_category 7, location_group 38, location 532**). Place_Catalog.xlsx added 2026-06-23.

### Location axis — added 2026-06-23 (Place Catalog)
3-tier, mirrors the Object two-tier design: **Category (7, I–VII)** → **Place Type / group (38, e.g. The
Metropolis · The Forest · The Prison · The Road)** → **named Place archetype (532, e.g. The Noir City)**.
Mapping (`catalog-map.py --kind location`): always assign the coarse **category + type** codes if the
figure IS a place; assign a named **archetype** only on a confident kNN match; abstain when the `location`
figure is really a journey/duration/action/person (figure.kind is noisy — same abstention rule as objects).
The shared `catalog_candidates(figure, n_arch, n_theme, arch_kind)` RPC serves both kinds.

## Refinements from a real-figure sample (important)
- **figure.kind is noisy → mapping MUST abstain.** Sampled `object` figures include true props ("Arati's
  lipstick", "Mapache's red touring car", "The bomb suit") AND non-props/motifs ("The recurring motif of
  missed connections", "The Pink Opaque"). Sampled `location` figures include real places ("The Subarnarekha
  River") AND situations/actions ("The 90-minute commute", "Ada's final walk into the city"). So Catalog
  coverage is **partial by design**: the LLM step classifies a prop/character/place when it is one, else
  routes to theme/trope or leaves "unclassified". Don't force-fit.
- **Objects → two tiers.** Always assign Type + Function (coarse, near-universal); assign a NAMED archetype
  ("The Coveted Jewel") only on a confident match. Every prop is at least type/function-browsable; the 583
  archetypes become curated "feature" pages.
- **Characters.** Sampled `character` figures are whole characters (Grainier, Captain Yonoi, Edward Snowden)
  — Axis1 (identity) + Axis3 (complex) are reliably taggable from figure description + film; **Axis2
  (narrative function) needs plot context** (tag with lower confidence / optional). Note: real people among
  characters (Snowden, Harry Gulkin) bridge to the existing **Persona-Parallel / "Counterpart"** framework.
- **Naming collision: "Archetype" ≠ "Trope".** The Character catalog's product (Femme Fatale = Role × Complex)
  is a CLASS — call it **Archetype / character-type** in the app, and reserve **Trope** for the reading layer.
  Consider NOT materializing every Role×Complex: expose the 3 axes + let intersections be dynamic, and feature
  the ~17 canonical archetypes as curated pages.
- **Theory axis = reuse, don't duplicate.** `theory_canon` already holds **2,587** rows
  (part / major_category / sub_category / title / theorist / embedding) and powers `/concept`. The Catalog's
  "theory" tab should surface that canon (linked to figures via `takes.theorist_name` / `takes.concept`),
  not a parallel store.
- **User-facing layer model (avoid overload):** Figure = what's on screen → **Catalog** = what it *is* →
  **Trope** = the recurring reading it carries → **Strong Misreading** = the individual reading. The figure
  page is the hub that ties all three.
