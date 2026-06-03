# Mission 8b — Related & discovery + director hub (v1)

> Paste **after Mission 8.**

---

**Context.** Read `AGENTS.md` and `SPEC.md` §6.11 (related & discovery), §6.12 (director hub),
§8.8 (hub-spoke schema), and match `ref-director.html`. Mission 8b from §13. **Scope = the v1
discovery engine (metadata-only) + the v1 director hub.** No @-mentions, no pgvector.

**Do:**
1. **Question page modules** (§6.11): **"More about {film}"** (other questions on the same
   film) and **"Related readings"** — same `question_type` and/or similar films, across the
   catalogue. Cap ~5–6 each, editorial and quiet, published-only.
2. **Film page module:** **"Related films"** — scored by shared director / genre+keyword
   overlap / era proximity (v1 = pure SQL on the cached TMDB data).
3. **Director hub `/director/[slug]`** (§6.12), keyed on `films.director_slug`, matching
   `ref-director.html`: header (director + film count) → directed films (each linking to its
   film page, with question counts) → a roll-up of notable questions across those films. **No
   @-mention/tagged layer** (that's Mission 12). Add its `CollectionPage`/`ItemList` schema and
   include it in the sitemap (§8.8).

**Verify (all must pass):**
- A question page surfaces same-film questions and same-`question_type` cross-film "Related
  readings" (published-only).
- A film page surfaces related films (shared director/genre/keyword/era).
- `/director/[slug]` lists that director's films + their questions, server-rendered with
  `CollectionPage` JSON-LD, and appears in the sitemap.

**Do not:** build @-mentions, actor pages, the tagged layer (M12), pgvector (v2), or
co-engagement (v3).

---

*Next:* **Mission 9 — i18n scaffolding.**
