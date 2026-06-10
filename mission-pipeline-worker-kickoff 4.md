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
   **different family**), the Tone reviewer. **Quality-first:** default the core stages to the
   **newest, most capable models** (validate a new model on a small batch before a full switch).
   **Expect slow generation** — newest/reasoning models + the corrective loops take seconds–
   minutes per film; that's fine because this worker is **async/background and not user-facing**
   (throughput is governed by the rate-limiter/ramp, never by request-path speed).
5. **Per-film graph (no categories; prompts in `pipeline-prompts.md`).** The standard: build from
   rich **verified** facts/context up to an **insightful conclusion** — depth is the bar,
   fragmentary info is failure.
   - **Dossier** (once/film, cached) — gather verified facts + context/trivia + interpretive
     threads; mark fact (sourced) vs reading. **Resolve the current film + every comparison film
     (title+year) to `tmdb_id`/`slug`** and cache them (for the linkifier).
   - **Planner** — the **≥10 questions that emerge from the film**, favoring those that **lead to
     insight**; conversational phrasing; dedup. No taxonomy/`question_type`. Each gets a pitch.
   - **Drafter ×N** — answer in the **answer-first TL;DR** shape, voiced; structured as
     facts/context on-ramp → **insightful conclusion**. Uses only dossier facts; reads framed as
     readings. **Names the film once, naturally** (no URLs — the linkifier handles links).
   - **Verifier ×N (검산) — corrective, DIFFERENT provider/family** — fact-checks every claim +
     **every real-person statement** vs TMDB/sources, flags spoilers, emits **targeted fixes**;
     fixable → apply fix / re-draft flagged spans → **re-verify** (bounded retries).
   - **Rubric scorer** — depth/insight, facts→insight arc, grounding, voice (some dims = code
     checks); `revise` → re-draft with notes → re-score (bounded retries).
   - **Linkify (deterministic, no LLM)** — wrap the **first mention** of the current film, any
     comparison films, and the director in internal links (`/film/{slug}`, `/director/{slug}`)
     using the dossier-resolved ids; only catalogue entities, else plain text; match only the
     answer's known referenced set (no whole-catalogue matching → no common-word mislinks). Store
     body as text + a **links map** (offsets→url).
   - **Media curator handoff** — call the §3.3 Curiobot per item.
   - **Gate (no human review)** — facts supported + no real-person risk + no spoiler + confidence
     ≥ threshold + scorer `publish` → **`approved`** (buffer). Fixable → the loops above.
     Otherwise → **HOLD** (kept out of `published`, logged) — **no human queue**; *when uncertain,
     hold, don't publish.* Generation never publishes directly.
   - **Schedule** — assign each approved item a **`scheduled_for`** time (see the publisher).
   - **Post-publish re-audit** — periodically re-run the verifier on a random sample of live items;
     the admin can hide anything. (This is the safety net given no per-item review.)
   - **Re-link sweep (background)** — periodically re-run the linkifier over *published* answers to
     add links to films that have since entered the catalogue (like the Curiobot media sweep).
6. **Publisher (separate, decoupled loop — the cadence engine).** A **light, frequent, jittered**
   job (can be a simple cron, distinct from the heavy generator) that releases buffered
   `approved` items to `published` when `scheduled_for <= now`: set `published_at` (the **real**
   release time — never backdated), ISR-revalidate the film + question pages, update the sitemap
   (§8), log `content_events`. **Each entity publishes on its own timing** — the question, the
   canonical answer, and each contribution have **independent** `scheduled_for`. **Ordering rule:
   a question goes live first, then (after a gap) its canonical answer, then its readings spaced
   over hours/days** — never simultaneously. Scheduling: spread releases across active hours with
   **random gaps (not fixed ticks), no identical timestamps, no bursts**; daily volume with
   ±jitter under a **daily cap + slow ramp**. The **author/voice byline is already fixed from
   creation** (provenance), not chosen at publish. This keeps publishing from looking like a bot
   burst (§3.2) — while staying transparently editorial (no fake history).
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
- **Generation and publishing are decoupled:** gated items land in the **`approved` buffer**
  (not public); the **publisher** releases them on a **jittered** schedule. The question, its
  canonical answer, and each reading publish on **independent** `scheduled_for` times — an answer
  never publishes before its question, a film's questions are **staggered**, released
  `published_at` times are **distinct and spread out** (no simultaneous burst), and `published_at`
  is the real release time (no backdating). The voice byline is fixed from creation. A backlog can
  build up and the publisher keeps the site live without the generator running.
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
