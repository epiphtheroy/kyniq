# Mission — Curiobot: media auto-embedding (TMDB images + YouTube)

> Enhancement pack, part 2 of 3. Paste after the TMDB cache (M2) exists; **Curiobot is a third
> worker loop** (with the generator + publisher, part 1) — the pipeline calls it at generation
> and it also sweeps on its own. Feeds the home redesign (part 3). The migration + the YouTube API
> key are **approval mode**.

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
4. **Relevance + spoiler/appropriateness filter (automated, STRICT).** The live build attached
   completely off-topic clips (e.g. an asteroid-impact video on *Stalker*) — that bug is what this
   step exists to prevent. Concrete rules:
   - **Query with film identity, not loose keywords.** Search the **exact title + year** (and the
     director name for video essays), e.g. `"Stalker" 1979 Tarkovsky analysis`. Never search bare
     fragments of the question text (that's how "the Zone" → space/asteroid junk happens).
   - **Hard match gate (a candidate must pass to be eligible):** the video **title or channel/
     description must contain the film title** (allowing known localized/alternate titles) **and**
     be consistent with the year/director. Reject anything that only matches a generic word from
     the question ("zone", "room", "space"). Optionally confirm with a cheap LLM check: *"Is this
     video about the film {title} ({year}, dir. {director})? yes/no + why"* — `no` → reject.
   - **Type allowlist:** trailer, video essay/analysis, interview, scene/clip from a reputable
     channel. **Reject** reaction, clickbait/shorts farms, news, and unrelated viral clips.
   - **Channel quality heuristic:** prefer official (studio/distributor) and established
     film-essay channels; down-rank tiny/anonymous channels; an emoji-laden clickbait title is a
     reject signal.
   - **Spoiler screen:** scan title/thumbnail text for ending/twist spoilers; reject on risk.
   - **Confidence + fail-safe:** score `confidence`; **below threshold → attach NOTHING.**
     *Junk media is worse than no media* — empty is fine, off-topic is not. No human gate.
   - **Post-attach audit:** the ~3-hour sweep (and a periodic re-check) re-validates already-
     attached media against these rules and **detaches** anything that no longer passes. Log every
     attach/reject/detach to `content_events`.
5. **Curiobot — a third decoupled worker loop** ("it's just another queue", part 1's
   architecture). Two attach paths: (a) **at generation** — runs as a step in the pipeline worker
   for AI-authored Q&A so media is live when the question publishes; (b) **a ~3-hour sweep** —
   Curiobot scans **published questions still lacking media** (esp. human-submitted, + any AI
   gaps) and enriches them. Every published question ends up with media; the sweep naturally
   staggers when media appears. Write an `agent_activity` heartbeat ("Curiobot: enriching N
   questions") + `content_events`, surfaced in the §6.13 Activity Log.
6. **Rendering — the design.** Build a **"Related on YouTube" module at the bottom of the question
   page** (below the question and its readings), §6.1: a labeled section ("Related on YouTube" /
   "관련 영상") holding **1–2 YouTube embeds via a click-to-load facade** (poster-frame thumbnail +
   play button → loads the iframe on click), each with **video title + channel attribution**.
   Editorial design tokens (navy/paper, hairline divider, generous whitespace) — a quiet module,
   not a heavy widget. Film **imagery** (TMDB stills/backdrop) anchors the film hero/gallery
   (§6.3) and a small gallery near the top of the question. Lazy-load everything; **reserve
   dimensions to avoid layout shift**; never eager-load iframes.
7. **Schema (GEO).** Emit **ImageObject** and **VideoObject** JSON-LD for attached media (§8) so
   it can surface in image/video search.
8. **Admin moderation (post-hoc).** In `/admin` content management (§6.13): list a question's
   media; **hide / replace / reorder / remove** any item; each action writes `content_events`.
9. **Performance budget.** Core Web Vitals must not regress — measure before/after; the YouTube
   facade and image sizing are mandatory, not optional.

## Verify (all must pass)
- Every **published** question shows ≥1 TMDB image and (when a good match exists) a **"Related on
  YouTube" module at the bottom** of the question, each with visible attribution.
- The **~3-hour sweep** picks up a published question that lacked media and enriches it on its own
  (no manual trigger); Curiobot's heartbeat + events appear in the §6.13 Activity Log.
- `media` is **published-gated**: a `draft`/`hidden` media row is invisible to the anon key and
  absent from JSON-LD/sitemap.
- A deliberately spoiler-y or irrelevant video is **filtered out** (not attached); only relevant
  media attaches. **Specifically: a video that matches only a generic word from the question
  (e.g. "zone", "space") but is not about the film is rejected**, and an already-attached video
  that fails re-validation on the sweep is **detached** (each logged).
- YouTube loads **only on click** (facade); images are lazy-loaded + sized; **no layout shift**;
  Core Web Vitals stay green.
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
