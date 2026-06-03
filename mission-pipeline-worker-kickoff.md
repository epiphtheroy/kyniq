# Mission — AI content pipeline worker (multi-model, separate service)

> Enhancement pack, part 1 of 3. **Supersedes `mission-09b-kickoff.md`** (the simple pipeline) —
> build this instead. Paste **after Missions 6b + 7** (admin queue + GEO revalidate/sitemap) and
> with the TMDB cache (M2) available. The worker uses the Supabase **service role** and external
> model-provider keys — build it and run the first production batch in **approval mode**; review
> the gate threshold and the model-routing config before enabling auto-publish.

---

## Intent (read this first — it explains *why*)
Kyniq's content is mostly AI-authored, and the value is not volume — it's **genuinely important
questions answered with real critical depth**, the kind a thoughtful film critic would write
(precise scene observation first, theory second, productive uncertainty over forced
conclusions). That editorial standard is the **moat**; the model is just a tool. So we want a
*smart* pipeline, not a content farm:
- **A separate worker, not the website.** Multi-model batch generation takes minutes and many
  calls — that doesn't fit serverless request timeouts. The clean seam is the **database/queue**:
  the worker writes drafts to Supabase; the site only ever reads published rows. This also means
  any agent/framework can do the job — it doesn't "attach to the web," it writes to the data.
- **Mix providers and models by role.** Different models are good at different things, and —
  critically — running **verification on a different provider/family than generation** reduces
  shared blind spots (the honest weakness of self-checking AI). Model↔role mapping must be
  **config the admin can tune**, not hard-coded.
- **A few disclosed editorial voices**, modulated for tone — never fabricated "organic" users,
  never fake upvotes/reactions (that's astroturfing and would trigger the exact search/AI spam
  penalties our whole GEO strategy depends on avoiding).
- **Publish safely, monitored.** A rate governor paces publishing so we never look like a spam
  farm; low-confidence work goes to the human admin, not the public.

## Context
Read `AGENTS.md` and `SPEC.md` §3.2 (lifecycle + pipeline + **runtime topology**), §3.3 (media
curator handoff), §6.1 (answer shape), §8 (GEO + revalidate/sitemap), §10 (TMDB for
verification), §4 (`content_events`, `media`, status/provenance), §6.13 (admin control plane +
review queue). Hold the **no-sockpuppet / no-fake-engagement** hard rule throughout.

## Do
1. **Job queue (Supabase).** A `jobs` table — `id`, `film_id`, `question_types text[]`,
   `target_count int default 10`, `status` (queued / running / done / failed), `params jsonb`,
   `error text`, timestamps. The admin enqueues jobs from the §6.13 **Pipeline controls**;
   the worker claims and processes them (with safe claim/lock so two workers don't double-run).
2. **Separate worker service.** A standalone Node/TS service (own folder or repo) deployable to
   an always-on / scheduled host (Railway / Render / Fly / cron) — **never** the Vercel request
   path. It authenticates to Supabase with the **service role** and processes the queue.
3. **Provider-abstraction / model router.** A thin layer (OpenRouter / LiteLLM / Vercel AI SDK
   or a small internal adapter) so any provider's model is swappable. **Model↔role mapping is
   config** (a `pipeline_config` table or config file the admin can edit): which model runs the
   Planner, each persona's Drafter, the Verifier (a *different family*), and the Tone reviewer.
4. **The per-film graph** (one job = one film → `target_count` (10) Q&A):
   - **Selector / Planner** — from the curated film list, prioritize the film (interpretive
     richness, search demand, gaps), then plan the **10 genuinely important questions** using the
     `question_type` vocabulary (§6.11). Avoid duplicating existing questions on that film
     (dedup check).
   - **Drafter ×N** — write each question + canonical answer in the **answer-first TL;DR** shape
     (§6.1, §8.7), in the voice of an assigned **editorial persona**.
   - **Verifier ×N (검산)** — a *different provider/family* fact-checks the checkable claims
     (title, year, director, cast, plot facts) against the cached TMDB data / sources, scores a
     `confidence` (0–1), and logs `content_events` `verified` with `meta`. Interpretation is
     **not** "verified" — facts + coherence only.
   - **Tone / appropriateness review** — confirm the voice/register fits, flag sensitive content
     or spoilers handled badly.
   - **Media curator handoff** — call the §3.3 / Mission-media curator for each item (TMDB image
     + YouTube embed).
   - **Gate** — `confidence ≥ threshold` AND clean → publish; else leave `in_review` for the
     admin queue. Threshold is config; default conservative.
   - **Publish** — set `status='published'`, `published_at`, `reviewed_by`; ISR-revalidate the
     film + question pages; update the sitemap (§8). Log `content_events` `published`.
5. **Editorial voices (personas).** Seed a small, fixed, **disclosed** set (≈3–5) of
   `system`-role profiles, each with a defined register; the persona's voice lives in an
   **editable prompt/config** (not hard-coded). All carry the AI-assisted/human-reviewed
   disclosure. **No fake engagement** — the worker never writes `votes`, comments-as-users, or
   reputation.
6. **GEO output contract.** Bake §8 into the Drafter's required output: answer-first TL;DR,
   the question phrased as a real long-tail query, relevant entity mentions, internal-link hooks,
   schema-ready structure.
7. **Rate governor + monitoring.** Caps per run / per day / per film; ramp-up; **dedup &
   thin-content checks**; **cost tracking** per run (multi-model = real token spend); admin
   **pause/resume** and threshold controls in §6.13. Surface confidence + cost + counts in the
   admin.
8. **Encode the critical framework (the moat).** Put the editorial standard into the Planner /
   Drafter system prompts as **editable files/config**: build from precise scene observation
   before theory, prefer productive uncertainty to tidy conclusions, target the
   Korean-criticism × international-cinephile register, and (optionally) use a rubric + a
   theorist-selection step to pick the strongest lens per question. Treat these prompts as the
   product, iterated over time.
9. **Config schema deliverable.** Document the admin-tunable config: `{ role → provider/model }`
   map, persona definitions, gate threshold, and rate limits — readable + editable from `/admin`.

## Verify (all must pass)
- Enqueuing a film job runs the worker through plan → draft×10 → verify → tone → gate; 10 items
  appear as `draft`/`in_review`, attributed to editorial voices (not fake users).
- Verification demonstrably runs on a **different provider/family** than generation; swapping a
  model in config changes which model runs that role (no code change).
- A **low-confidence** item stays `in_review` and lands in the admin queue — **not** public; a
  high-confidence item publishes and triggers revalidate + sitemap update.
- Each stage wrote `content_events`; the rate governor enforces the per-day/film caps; cost is
  recorded per run.
- A run creates **zero** rows in `votes` and **zero** human-looking profiles; published items
  show the editorial byline + disclosure.
- Heavy generation runs in the worker, never in a Vercel function; provider keys + service role
  are server-only (grep the client bundle).

## Do not
Run heavy generation in the Vercel request path; fabricate personas, users, upvotes, or
reactions; auto-publish low-confidence items; hard-code model choices; commit provider keys.

*Next:* the media curator (part 2) and the home redesign (part 3).
