# Mission 9 — i18n scaffolding

> Paste **after Mission 8b.**

---

**Context.** Read `AGENTS.md` and `SPEC.md` §12 (i18n). Mission 9 from §13. **Scope = locale
routing + the translation scaffold, with English live.** Don't translate content yet — just
make the structure correct so locales can be added without rework.

**Do:**
1. **Locale routing** — locale-prefixed routes (e.g. `/en/...`) with English as the default,
   using the App Router i18n pattern; a messages/catalog structure for UI strings.
2. **`hreflang`** alternates + a self-referential canonical on each page; reflect locales in the
   sitemap.
3. Keep the data model language-agnostic; UI strings come from the catalog (no hard-coded copy
   in components where avoidable).

**Verify (all must pass):**
- `/en/...` resolves and renders; the default locale redirects/serves correctly.
- `hreflang` + canonical tags are present and correct in view-source.
- No regression to SSR, schema, or Core Web Vitals.

**Do not:** add a second language's content, ads, or @-mentions.

---

*Next:* **Mission 9b — AI content pipeline** (prompt already written), then **Mission 10 — Seed
content.**
