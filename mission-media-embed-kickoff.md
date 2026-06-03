# Mission — Media auto-embedding (TMDB images + YouTube)

> Enhancement pack, part 2 of 3. Paste after the TMDB cache (M2) exists; pairs with the pipeline
> worker (part 1 calls this curator) and feeds the home redesign (part 3). The migration + the
> YouTube API key are **approval mode**.

---

## Intent (read this first)
A film site should *look* like one. Right now the pages are text-only and flat. Attaching
**relevant imagery and video to every question** gives the site visual life (the Genius
reference) and opens an extra GEO surface (image/video search via schema). Two hard decisions are
already made and must be honored:
- **Images: TMDB only.** No "Google Images" / web scraping and **no user uploads** — both carry
  copyright/DMCA risk that would undermine a trust-based criticism brand. TMDB is already
  integrated and licensed (with attribution).
- **Auto-attach to every question, no admin pre-approval** — but through an **automated relevance
  + spoiler/appropriateness filter**, because wrong or spoiler-laden media is worse than none on
  an interpretation site. The admin moderates **after the fact**.
Video uses **YouTube's official embed** (the intended, low-risk path — we never host video) plus
the **YouTube Data API** to find relevant clips.

## Context
Read `AGENTS.md` and `SPEC.md` §3.3 (media auto-embedding — the rules), §4 (`media` table + RLS),
§10 (TMDB), §8 (Image/VideoObject JSON-LD + performance), §6.1 / §6.3 (where media renders),
§6.13 (post-hoc admin moderation).

## Do
1. **Migration (approval).** Create the `media` table per §4 with RLS: public read only where
   `status='published'`; **not client-writable** (service-role / curator writes only); admin may
   update status.
2. **TMDB image curator.** For a film, pull backdrops + stills (+ the existing poster) from TMDB;
   store as `media` rows (`kind='image'`, `source='tmdb'`, `external_id`=file_path,
   `thumbnail_url`, `attribution`, `position`). Sized via the TMDB CDN.
3. **YouTube video curator.** With a **server-only** YouTube Data API key, search for videos
   relevant to the film/question (trailer, video essay, interview, key scene); **drop
   embed-disabled videos**; prefer official / reputable channels; store `media` rows
   (`kind='video'`, `source='youtube'`, `external_id`=video id, `thumbnail_url`, channel
   `attribution`).
4. **Relevance + spoiler/appropriateness filter (automated).** Match media to the right film /
   question; score `confidence`; **screen video titles/thumbnails for spoilers** and obvious junk
   (reaction/clickbait); below threshold → **skip** (never attach filler). Above → attach
   automatically (no human gate). Log to `content_events`.
5. **Two run paths:** (a) as a **step in the pipeline worker** (part 1) for AI-authored Q&A;
   (b) as a **background enrichment job** that fires when a human question is published (enqueue
   → curate → attach). Every published question ends up with media.
6. **Rendering.** On the question page (§6.1) and film page (§6.3): a small **image gallery**
   (TMDB stills/backdrop) + **YouTube embeds via a click-to-load facade** (thumbnail → loads the
   iframe on click). Render **attribution** (TMDB + YouTube channel) always. Lazy-load
   everything; never eager-load iframes.
7. **Schema (GEO).** Emit **ImageObject** and **VideoObject** JSON-LD for attached media (§8) so
   it can surface in image/video search.
8. **Admin moderation (post-hoc).** In `/admin` content management (§6.13): list a question's
   media; **hide / replace / reorder / remove** any item; each action writes `content_events`.
9. **Performance budget.** Core Web Vitals must not regress — measure before/after; the YouTube
   facade and image sizing are mandatory, not optional.

## Verify (all must pass)
- Every **published** question shows ≥1 TMDB image and (when a good match exists) ≥1 YouTube
  embed, each with visible attribution.
- `media` is **published-gated**: a `draft`/`hidden` media row is invisible to the anon key and
  absent from JSON-LD/sitemap.
- A deliberately spoiler-y or irrelevant video is **filtered out** (not attached); only relevant
  media attaches.
- YouTube loads **only on click** (facade); images are lazy-loaded + sized; Core Web Vitals stay
  green.
- `ImageObject` / `VideoObject` JSON-LD validate in the Rich Results test.
- Hiding a media item in `/admin` removes it from the public page and logs a `content_events`
  row.
- TMDB + YouTube keys are server-only (grep the client bundle); no web-scraped images and **no
  user-upload path** exist.

## Do not
Scrape web images or use "Google Images"; allow user image uploads; host video; eager-load
embeds; attach spoiler-y/irrelevant/low-confidence media; expose draft/hidden media; commit API
keys.

*Next:* the home & page redesign (part 3) uses this media.
