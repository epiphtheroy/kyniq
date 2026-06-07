# Redesign brief — Home + Question pages (for the implementing AI)

I visited the live site (home + a Stalker question page) and found both pages strategically weak.
This brief + the two mockups (`ref-home-v2.html`, `ref-question-v2.html`) define the redesign.
It **supersedes the relevant parts** of `mission-home-redesign-kickoff.md` and SPEC §6.1
(question page) / §6.11 (discovery). Match the existing design system (`globals.css`).

> **Now reflected in the canonical spec:** SPEC **§6.1** (question page — big film banner, boxed
> related modules, trending feed, sticky rail, never-a-dead-end), SPEC **§6.2** (home — real
> search + nav, hero, collections, directors, latest feed, rankings; duplicate feeds removed),
> SPEC **§6.11** (retention engine). The **Curiobot relevance fix (bug #4)** is written into
> `mission-media-embed-kickoff.md` step 4 + SPEC §3.3. This brief stays as the human-readable
> rationale + the mockups.

---

## A. What's wrong now (observed live)

**Home**
- "Trending Films" is a row of generic box-office posters (Whiplash, The Godfather, Forrest Gump…)
  — unrelated to the interpretation mission, decorative, meaningless as a first impression.
- **"Active now" and "Recently improved" render the *same* questions** (the same 4 Stalker items)
  — redundant, mirror-symmetric, and looks broken.
- No browsable structure — no collections/topics, no directors, no rankings, no image-rich feed.
  Static and thin; nothing invites scrolling.

**Question page**
- **No related-questions module at all.** With no canonical answer yet and no related links, the
  page is a **dead end** — terrible for dwell time, internal linking, and GEO.
- The film context (thumbnail + title + director) at the very top is **too small** — the "what
  film is this about" anchor doesn't land.
- Media exists (stills + YouTube) but is under-used and (see bugs) mis-targeted.

## B. Strategy (the "why" — design every module to serve this)
1. **Dwell + depth of crawl.** Pages must keep a reader (and an AI crawler) moving to the next
   relevant page. That means **lots of high-quality internal links**, surfaced as image-rich,
   boxed modules that continue down the page.
2. **Mission legibility.** The home page should say "this is the place films get *interpreted*,"
   not "here are popular movie posters." Curate to ambiguity/auteurs/meaning, not box office.
3. **Abundance / aliveness.** Image-led, asymmetric, editorial density (the Genius reference) —
   not a static, mirror-symmetric two-column list.
4. **Discoverability.** Search must work; directors and collections must be reachable from the nav.

---

## C. HOME — redesign (modules top to bottom; see `ref-home-v2.html`)
1. **Header with a REAL search.** Replace the "Search a film…" link with a working
   **typeahead input** (films + directors + questions). Add nav: **Films · Directors ·
   Collections**. (Directors must be reachable here — see bug #2.)
2. **Hero — one featured interpretation, cinematic.** A wide unit: backdrop image + "Featured
   reading" label + the question + a 1–2 line teaser of the reading + a film chip (poster +
   title + director, both linked) + "Read the interpretation →". One strong hero, not two
   competing boxes + a dead search.
3. **Collections (themes).** A horizontally-scrollable row of image cards: e.g. "Endings,
   explained", "Dreams & the unreal", "What the symbol means", "Auteur signatures", "Unreliable
   narrators". Each → a curated list page. This is the topic/category browse.
4. **Browse by director.** A row of director cards (representative backdrop + name + film/Q count)
   → the **director hub** (§6.12). Fixes discoverability and adds authority surface.
5. **Latest interpretations (the alive feed).** Recently *published* Q&A as image cards: still +
   question + film chip + reading teaser + read count + voice byline. This is the scrolling feed.
6. **Rankings.** "Most-read this week" / "Most-debated" — a numbered list with small stills.
   Creates a sense of activity and gives AI/readers ranked entry points.
7. **Films to decode.** A curated poster grid (ambiguous/auteur films worth interpreting, NOT
   generic blockbusters) → film pages.
8. **DELETE** the duplicate "Active now / Recently improved" pair. If kept at all, they must show
   **distinct** data (e.g. "Just answered" vs "Most-read today") and never the same rows.

## D. QUESTION page — redesign (top to bottom; see `ref-question-v2.html`)
1. **Big film banner (fix "too small").** A cinematic strip: backdrop image as the background,
   a larger poster, **STALKER (1979) · dir. Andrei Tarkovsky** (film title → film page; director
   → director hub), plus "▸ 12 questions on this film". Unmistakable "what film is this about".
   **It must be real, crawlable HTML text + links (not baked into an image)** — it doubles as the
   visible film-entity subhead for SEO/AI (§8.2). The answer also names the film once, and that
   mention + comparison films are rendered as internal links by the linkifier (§3.2).
2. **Breadcrumb** (Films › Stalker › this question) for orientation + crawlable links + JSON-LD.
3. **Question + pitch** (the pitch as a standfirst), then **the reading** (canonical answer) as
   the hero, with the FilmCurio Editorial byline. If no answer yet, show a graceful prompt — but the
   page must **never be a dead end** (the related boxes below carry it).
4. **Media** — stills strip near the top; the "Related on YouTube" module lower down (it exists,
   but see bug #4: the relevance filter is broken).
5. **The dwell engine — boxed, image-led related modules** (this is the core of the ask):
   - **"More questions about Stalker"** — a bordered box listing other questions on the *same
     film* (small stills + read counts). Keeps the reader on the film.
   - **"More from Andrei Tarkovsky" / "Films like this"** — related-film questions (posters +
     question), driving cross-film discovery.
   - **"Trending interpretations"** — a feed that **continues down the page** so there is always
     a next thing to scroll to.
6. **Desktop layout: a sticky right rail** holding the film context + "More on this film" so
   related questions stay visible while reading; the main column (question + reading) scrolls.
   Mobile: stack, with the related boxes below the reading and the trending feed last.
7. **Community readings** (Top / Newest) below the canonical answer, as today.

---

## E. Bugs found (fix these — separate from design)
1. **Dead search.** The header "Search a film…" is a link to `/film`, not a search input. Build a
   real search (typeahead over films/directors/questions). High priority — it reads as broken.
2. **Director hub unreachable.** The §6.12 director pages exist (or are planned) but nothing links
   to them. Add to nav + the home "Browse by director" + the question-page director link.
3. **Duplicate feeds.** "Active now" and "Recently improved" query/return the same rows. Either
   make them genuinely distinct or remove (see C8).
4. **Curiobot YouTube relevance is broken.** The Stalker page shows completely unrelated clips
   (an asteroid-impact video; a space "knocking" short). The relevance/appropriateness filter
   (§3.3) is not actually gating — tighten matching (require the film title/known associations;
   reject generic keyword hits) and re-audit attached media. Until fixed, prefer attaching
   *nothing* over attaching junk (junk media hurts trust + GEO).
5. **Dead-end pages.** A question can publish before its answer (ordering rule), but it must never
   publish without the related-questions modules — otherwise it's an empty dead end.

## F. Data / component notes (reuse existing tables)
- Related-on-same-film box → `questions where film_id = current and status='published' order by
  read/sort_score`, excluding current. Cheap, high-value.
- Related-film / director box → questions on other films by the same director, or same
  collection/theme. (Director from the film's crew; "films like this" can start as same-director
  / same-decade until pgvector co-engagement lands.)
- Collections → a lightweight `collection` concept (curated lists of films/questions); can start
  as admin-curated tags before anything automated.
- Latest feed / rankings → `published` questions by `published_at` / read count / sort_score.
- All modules render **only `published`** rows (RLS) and add internal links + appropriate
  JSON-LD (ItemList) for the GEO surface.

## G. Priority order
1. Fix the **search** (broken-feeling) and **director nav link** (both quick, high-impact).
2. Add the **question-page related boxes + bigger film banner** (the dwell engine + the "too
   small" fix). Biggest strategic win.
3. Fix **Curiobot relevance** + remove **duplicate home feeds**.
4. Rebuild the **home modules** (hero → collections → directors → latest → rankings → films).
