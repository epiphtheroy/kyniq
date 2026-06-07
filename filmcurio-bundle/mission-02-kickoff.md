# Mission 2 — TMDB + film pages

> Paste into the Antigravity Manager **after Mission 1 verifies green.** The `TMDB_READ_TOKEN`
> is a **server-only secret** — set it in **approval mode** (env), never in the client bundle.

---

**Context.** Read `AGENTS.md` and `SPEC.md` §10 (TMDB integration), §6.3 (film page), §6.11
(similarity data), §8.8 (entity linking), §2.1–§2.2 (design system), and match
`ref-film-page.html`. This is Mission 2 from §13. **Scope = TMDB fetch + caching + the film
page.** No auth, no ask flow (Mission 3), no question/answer UI beyond listing.

**Do:**
1. **TMDB integration (server-side).** A server module that, for a given TMDB movie, fetches
   `/movie/{id}`, `/movie/{id}/credits` (director), `/movie/{id}/keywords`, and
   `/movie/{id}/external_ids` (imdb_id, wikidata_id), then upserts a `films` row:
   `tmdb_id`, `title`, `original_title`, `year`, `director`, `director_slug` (slugify the
   director name), `poster_path`, `overview`, `slug` = `title-year`, `genres text[]`,
   `keywords text[]`, `imdb_id`, `wikidata_id` (when present). **Cache aggressively** — never
   call TMDB on a normal page view; refresh lazily.
2. **Film search** — a server action/route over TMDB `/search/movie` returning candidates.
   (The ask flow consumes this in Mission 3; here, expose it for seeding/testing.)
3. **`/film/[slug]` page — server-rendered (SSR/ISR)**, matching `ref-film-page.html` + §6.3:
   breadcrumb; desaturated poster + title + "{year} · dir. {director} · {N} questions"; short
   synopsis; a **"Most-read interpretation"** teaser (top question + canonical TL;DR, or a
   clean empty state if none yet); an **"Ask a question about this film"** CTA (links
   `/ask?film=…`, non-functional until M3); and an **"All questions"** list with
   Most-discussed / Newest tabs. Must render gracefully with **zero questions** (the M1 seed
   films have none yet) — no blank page.
4. Build poster URLs as `https://image.tmdb.org/t/p/w500{poster_path}`; lazy-load below the
   fold; keep Core Web Vitals green.
5. Keep the TMDB attribution in the footer (from M0). Slugs are permanent; if a title changes,
   keep the old slug as a 301 (§6).

**Verify (all must pass):**
- Referencing a TMDB film creates/updates a `films` row with poster/year/director, cached
  `genres`/`keywords`, `imdb_id`/`wikidata_id` when available, and a `director_slug`.
- `/film/[slug]` for a seed film renders **server-side** (view-source shows the film header) in
  the editorial design, matching `ref-film-page.html`, with a clean "no questions yet" state.
- `TMDB_READ_TOKEN` never appears in the client bundle (grep the build output); a cache hit
  makes **no** TMDB call.
- Lighthouse SEO/perf stays green; posters lazy-load.

**Do not:** build auth, the ask flow, voting, or the question page (Missions 3–4); do not show
any unpublished content.

---

*Next:* **Mission 3 — Auth + ask flow.**
