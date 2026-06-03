# Mission 7 — GEO layer

> Paste **after Mission 6b** (so all core pages + statuses exist). The `robots.txt` change is
> approval-mode (§15). This is the product's strategic priority — don't cut corners.

---

**Context.** Read `AGENTS.md` and `SPEC.md` §8 (full GEO section) + §8.8 (hub & spoke + entity
linking). Mission 7 from §13. **Scope = make every public page maximally citable by AI engines
and search.**

**Do:**
1. **SSR/SSG + ISR** on all public pages (home, film, question, director hub, profile); no
   client-only rendering of primary content.
2. **Structured data (JSON-LD):** `QAPage` on question pages; `Movie` + `CollectionPage`/
   `ItemList` on film hubs and the director hub (enumerating their children); `BreadcrumbList`
   site-wide (Home › Film › Question). **Entity linking:** `sameAs` to IMDb + Wikidata on films
   (from cached `imdb_id`/`wikidata_id`).
3. **robots.txt** (`app/robots.ts`, §8.3) — allow AI retrieval/training bots (OAI-SearchBot,
   ChatGPT-User, PerplexityBot, Claude-SearchBot/Claude-User, Google-Extended, etc.); reference
   `https://kyniq.io/sitemap.xml`. Ensure the host/CDN (e.g. Cloudflare) isn't blocking them.
4. **Dynamic sitemap** (`app/sitemap.ts`, §8.5) — **only `status='published'` rows**
   (film/question/director-hub/public-profile URLs) with `lastmod`; regenerate on publish.
   Submit to Google **and Bing** (Bing powers ChatGPT search).
5. **llms.txt** (§8.6); **answer-first TL;DR** shape on canonical answers (§8.7); on-demand
   **ISR revalidate** when a canonical answer is edited/published, updating `dateModified`.

**Verify (all must pass):**
- View-source shows valid `QAPage` + `BreadcrumbList` + film/director `ItemList` JSON-LD; a
  Rich Results / schema validator passes.
- `sameAs` IMDb/Wikidata present on film pages.
- `/robots.txt` allows the AI bots and points to the sitemap; `/sitemap.xml` lists **only
  published** URLs (no drafts).
- Editing a canonical answer updates that page's `dateModified` within minutes.

**Do not:** include unpublished content anywhere public; build ads or @-mentions.

---

*Next:* **Mission 8 — Home, chrome & institutional pages.**
