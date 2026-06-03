# Mission — AI content pipeline worker (autonomous, multi-model)

> Enhancement pack, part 1 of 3. **Supersedes `mission-09b-kickoff.md`** — build this instead.
> Paste **after Missions 6b + 7** (admin queue + GEO revalidate/sitemap) with the TMDB cache
> (M2) available. The worker uses the Supabase **service role** + external model-provider keys —
> build it and run the first batches in **approval mode**; review the gate threshold, the daily
> rate/ramp, and the model-routing config before enabling autonomous publishing.

---

## Intent (read this first — it explains *why*)
The operator already has a **curated list of ~1,000 films**. The goal: for each film, build
**≥10 questions and answers that arise from the film itself**, and keep doing it **automatically,
every day, with no hand-holding**. Three things define the design:

- **Upload once, then it runs itself.** The admin uploads the film list a single time; a **daily
  scheduler** works through the list on its own — selecting films, generating, verifying, gating,
  publishing — with **no per-film manual trigger and no per-question category to pick**. The
  earlier "enqueue one film + a question_type" model is gone.
- **No categories. Questions come from the film.** Forcing questions into a fixed taxonomy is
  artificial — real questions emerge from *this* film, and several may cluster on one theme. The
  planner generates the questions a real viewer would actually ask; there is **no `question_type`
  field anywhere** (§3.2).
- **Conversational, but deep.** Q&A should read like **people talking** — a sharp friend who
  watched closely and thought hard — not an academic paper. Theory and a real critical framework
  inform the *thinking*; the *voice* is plain-spoken and warm. (This also matches how people ask
  AI engines — a GEO win.)

**Honest constraint you must build around:** ~1,000 films × ~10 Q&A ≈ **10,000+ pages**.
Publishing that autonomously without pacing is textbook **scaled-content abuse** — it would
trigger the exact search/AI spam penalties our whole GEO strategy depends on avoiding. So the
rate governor, slow ramp, dedup, and periodic human spot-check are **core requirements, not
nice-to-haves**. Quality and uniqueness over volume, always.

## Context
Read `AGENTS.md` and `SPEC.md` §3.2 (lifecycle + pipeline + **voice** + **autonomous
operation**), §3.3 (media curator handoff), §6.1 (answer shape), §8 (GEO + revalidate/sitemap),
§10 (TMDB for verification), §4 (`content_events`, `media`, status/provenance — note **no
`question_type`**), §6.13 (admin control plane). Hold the **no-sockpuppet / no-fake-engagement**
hard rule throughout.

## Do
1. **Film-list ingestion (upload once).** In `/admin` Pipeline controls, accept a **list upload**
   (CSV/paste: title, optional year). An importer **resolves each to TMDB** (disambiguate by
   year), upserts into `films`, and marks membership (`in_pipeline=true` + progress fields:
   `questions_target` default 10, `questions_published int`, `last_processed_at`,
   `pipeline_status` queued/in_progress/done). Report unmatched titles for the admin to fix.
2. **Autonomous daily scheduler.** A **cron in the worker** runs daily with **no manual
   trigger**: pick the next batch of films (those `queued` / under target), within the daily
   rate cap, and process each. Work through the whole list over days; when all reach target, it
   may **deepen** (more questions) or **refresh** stale ones. Safe claim/lock so runs don't
   overlap.
3. **Separate worker service.** Standalone Node/TS service (own folder/repo) on an always-on /
   scheduled host (Railway / Render / Fly / cron) — **never** the Vercel request path. Auth to
   Supabase via the **service role**.
4. **Provider-abstraction / model router.** A thin layer (OpenRouter / LiteLLM / Vercel AI SDK
   or a small adapter) so any provider's model is swappable. **Model↔role mapping is admin
   config** (`pipeline_config` table/file): Planner, each persona's Drafter, the Verifier (a
   **different family**), the Tone reviewer.
5. **Per-film graph (no categories):**
   - **Planner** — generate the **≥10 questions that emerge from the film itself** (what a real
     viewer wonders about), phrased the way someone would actually ask. Dedup against existing
     questions on that film. No taxonomy, no `question_type`.
   - **Drafter ×N** — write each question + answer in the **answer-first TL;DR** shape (§6.1,
     §8.7), in a **conversational, deep** voice, as an assigned editorial persona.
   - **Verifier ×N (검산)** — a *different provider/family* fact-checks checkable claims (title,
     year, director, cast, plot) vs cached TMDB / sources, scores `confidence`, logs
     `content_events`. Interpretation is **not** "verified" — facts + coherence only.
   - **Tone / appropriateness** — confirm the conversational-but-deep register; flag spoilers /
     sensitive handling.
   - **Media curator handoff** — call the §3.3 curator per item (TMDB image + YouTube embed).
   - **Gate** — `confidence ≥ threshold` AND clean → publish; else `in_review` → admin queue.
   - **Publish** — `status='published'`, `published_at`, `reviewed_by`; ISR-revalidate the film
     + question pages; update the sitemap (§8). Log `content_events`.
6. **Editorial voices (personas).** A small, fixed, **disclosed** set (≈3–5) of `system`-role
   profiles, each a distinct conversational register, defined in **editable prompt config**. All
   carry the AI-assisted/human-reviewed disclosure. **No fake engagement** — the worker never
   writes votes, comments-as-users, or reputation.
7. **GEO output contract.** Bake §8 into the Drafter output: answer-first TL;DR, the question as
   a real long-tail query, relevant entity mentions, internal-link hooks, schema-ready structure.
8. **Rate governor + monitoring (core).** Daily cap + **slow ramp-up**; per-film cap;
   **dedup/thin-content checks**; **cost tracking** per run; **admin pause/resume + rate +
   threshold** controls. Surface progress (films done/remaining, questions/film, today's output,
   cost, confidence) in `/admin`.
9. **Encode the critical framework (the moat).** Put the editorial standard into the Planner /
   Drafter system prompts as **editable files/config**: observe the film closely before reaching
   for theory, prefer productive uncertainty to tidy conclusions, keep the depth but say it like
   a person talking. Treat these prompts as the product, iterated over time.
10. **Config schema deliverable.** Document the admin-tunable config: `{ role → provider/model }`
    map, persona/voice definitions, gate threshold, and **daily rate + ramp** — readable/editable
    from `/admin`.
11. **Editorial voices.** Load the voice definitions from `editorial-voices.md` (the source of
    truth): a small, disclosed, **anonymized & original** set (≈5) of conversational voices with
    different temperaments and **length bands**, all **claim-first / citation-friendly**. Each
    Drafter call = shared rules + the assigned voice block; per film, vary the voice/length mix.
    **Never** name or imitate a real critic.
12. **Observability (so the run is watchable).** Write a per-film **`jobs`** row (status +
    `current_step` + counts + cost + timestamps) and a **`agent_activity`** heartbeat (state +
    "what it's doing now" message + today's counts), and the timestamped **`content_events`** at
    every step. The `/admin` Activity Log (§6.13) renders **Now / Timeline / Latest outputs** from
    these.

## Verify (all must pass)
- Uploading the film list resolves titles to TMDB, flags them `in_pipeline`, and reports
  unmatched ones — with **no further manual input required**.
- The **daily scheduler** processes a batch **on its own** (no per-film trigger); over successive
  runs, coverage of the list increases and each processed film reaches ≥10 published Q&A.
- Generated questions are **film-specific and category-free** (there is **no `question_type`**
  in the schema or UI), and read as **conversational + deep**, not academic.
- Verification demonstrably runs on a **different provider/family**; swapping a model in config
  changes which model runs that role (no code change).
- A **low-confidence** item stays `in_review` (admin queue), not public; a high-confidence item
  publishes + revalidates + enters the sitemap.
- The **rate cap + ramp** are enforced (no firehose); cost + progress are tracked in `/admin`;
  dedup prevents near-duplicate questions.
- A run creates **zero** `votes` rows and **zero** human-looking profiles; published items show
  the editorial byline + disclosure.
- The **Activity Log** in `/admin` shows **Now** (heartbeat: current step/film, today's count +
  cost), a **timestamped Timeline** of events with links, and **Latest outputs** (newest drafts +
  published) — i.e. you can always tell what it's doing, did, and where the results are.
- Answers vary in **voice and length** across a film's 10 (per `editorial-voices.md`), each opens
  with a citable claim, and **no real critic is named or imitated**.
- Heavy generation runs in the worker, never a Vercel function; provider keys + service role are
  server-only.

## Do not
Require per-film manual triggering; use a category/`question_type` taxonomy; write in a stiff
academic voice; run heavy generation in the Vercel request path; fabricate personas, users,
upvotes, or reactions; auto-publish low-confidence items; firehose-publish without the ramp;
hard-code model choices; commit provider keys.

*Next:* the media curator (part 2) and the home redesign (part 3).
