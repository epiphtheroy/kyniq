# Mission — AI content pipeline worker (autonomous, single-call generator)

> Enhancement pack, part 1 of 3. **Supersedes `mission-09b-kickoff.md`** — build this instead.
> Paste **after Missions 6b + 7** (admin console + GEO revalidate/sitemap) with the TMDB cache
> (M2) available. The worker uses the Supabase **service role** + a model-provider key — build it
> and run the first batches in **approval mode**; review the daily rate/ramp and the model config
> before enabling autonomous publishing.

---

## Intent (read this first — it explains *why*)
The operator already has a **curated list of ~1,000 films**. The goal: for each film, build **~10
featured Q&A — the questions people most want answered after watching it** — and keep doing it
**automatically, every day, with no hand-holding**. Three things define the design:

- **Upload once, then it runs itself.** The admin uploads the film list a single time; a **daily
  scheduler** works through the list on its own — **no per-film manual trigger, no category to
  pick**.
- **One call per film.** A film's Q&A are produced in a **single model call**
  (`prompt-featured-qa.md`), **not** a multi-stage graph. Quality is enforced **inside the call**
  (the model self-checks, drops/rewrites weak items, and reports a `self_confidence`) and by a
  **deterministic validator** — there is **no separate verifier/scorer and no review queue.** This
  is ~an order of magnitude cheaper (≈**1,000 calls for ~10k posts**) and removes the old
  planner-parse failure mode (there is no planner).
- **Conversational, but deep.** Q&A read like **people talking** — a sharp friend who watched
  closely — not an academic paper. The optional question **body** adds a natural elaboration.
  (This also matches how people query AI engines — a GEO win.)

**Honest constraint:** ~1,000 films × ~10 ≈ **10,000+ pages**. Publishing that autonomously without
pacing is textbook **scaled-content abuse**. The **rate governor, slow ramp, dedup, and
post-publish spot-audit are core requirements, not nice-to-haves.** Quality and uniqueness over
volume, always.

## Context
Read `AGENTS.md` and `SPEC.md` §3.2 (**single-call** lifecycle + pipeline + voice + autonomous
operation), §3.3 (**per-film** media curator handoff), §6.1 (answer shape), §8 (GEO +
revalidate/sitemap), §10 (TMDB), §4 (`content_events`, `media`, status/provenance — **no
`question_type`**, and **no `in_review`** state), §6.13 (admin control plane). **The generation
prompt is `prompt-featured-qa.md`** (10 asker + 10 answerer lenses embedded). Hold the
**no-sockpuppet / no-fake-engagement** hard rule throughout.

## Do
1. **Film-list ingestion (upload once).** In `/admin` Pipeline controls, accept a **list upload**
   (CSV/paste: title, optional year). An importer **resolves each to TMDB** (disambiguate by
   year), upserts into `films`, marks membership (`in_pipeline=true` + progress fields:
   `questions_target` default 10, `questions_published int`, `last_processed_at`,
   `pipeline_status` queued/in_progress/done). Report unmatched titles for the admin to fix.
2. **Autonomous daily scheduler.** A **cron in the worker** runs daily with **no manual trigger**:
   pick the next batch of films (queued / under target) within the daily rate cap, and process
   each. Work through the whole list over days; when all reach target, it may **refresh** stale
   ones. Safe claim/lock so runs don't overlap.
3. **Separate worker service.** Standalone Node/TS service (own folder/repo) on an always-on /
   scheduled host (Railway / Render / Fly / cron) — **never** the Vercel request path. Auth to
   Supabase via the **service role**.
4. **Model config (one generator).** A thin provider layer so the model is swappable. **Model is
   admin config** (`pipeline_config`): the **generator model** for the single call, plus an
   **optional post-publish auditor model** (ideally a *different family*). Default to a capable
   model — **Gemini 2.5 Flash** is the cost/quality sweet spot, **2.5 Pro** for higher quality —
   and run the bulk job via the **Batch API** with the **system/persona block context-cached**
   (it's identical across films). There is **no per-role Planner/Drafter/Verifier mapping** — it's
   one call.
5. **Per-film flow (the prompt is `prompt-featured-qa.md`).**
   - **Generate — one call.** Pass the film (title, year, director, TMDB overview, optional extra
     context). The prompt returns **up to 10 Q&A as strict JSON**: each item = `question` +
     optional `question_body` + `answer` (answer-first, leads on the crux, one **aha**) +
     `asker_lens` + `answerer_lens` + `aha` + `self_confidence` + `claims_sourced`. The model
     **self-checks and drops/rewrites weak items in-call.**
   - **Validate — deterministic, no LLM.** Parse the JSON; require valid schema, **≥8 items**,
     each with question+answer (body optional), film title echoed, **`self_confidence` ≥ 0.75**,
     `claims_sourced = true`, intra-film dedupe, a banned-term/safety regex, length sanity. Pass →
     write `draft` rows. Hard parse/format failure → **one retry of the call**, then **skip + log**.
     **This is the whole gate — no LLM gate, no human queue.**
   - **Linkify — deterministic, no LLM.** Extract the film/director names the answers mention,
     resolve them to catalogue slugs, and wrap the **first mention** of each catalogue entity in
     `/film/{slug}` or `/director/{slug}`; store body text + a **links map**. (The model only names
     films; it never writes URLs.)
   - **Media handoff — per film.** Call **Curiobot once per film** to attach **one media set**
     shared by the film's questions (§3.3).
   - **Schedule** — assign each item its own **`scheduled_for`** (see the publisher).
   - **Post-publish re-audit** — periodically re-run an accuracy check (**optionally a different
     model family**) on a **random sample** of live items; the admin can hide anything. This is the
     safety net given there is no per-item review.
   - **Re-link sweep (background)** — periodically re-run the linkifier over *published* answers to
     add links to films that have since entered the catalogue.
6. **Publisher (separate, decoupled loop — the cadence engine).** A **light, frequent, jittered**
   job (distinct from the generator) releases buffered `approved` items to `published` when
   `scheduled_for <= now`: set `published_at` (the **real** release time — **never backdated**),
   ISR-revalidate the film + question pages, update the sitemap (§8), log `content_events`. **Each
   entity publishes on its own timing** — the question, the canonical answer, and each contribution
   have **independent** `scheduled_for`. **Ordering: the question goes live first, then (after a
   gap) its canonical answer, then its readings** — never simultaneously. Spread releases across
   active hours with **random gaps, no identical timestamps, no bursts**; daily volume ±jitter
   under a **daily cap + slow ramp**. The lens byline is **fixed at creation** (provenance).
7. **Editorial lenses (voices).** The **10 asker + 10 answerer lenses are defined in
   `prompt-featured-qa.md`** — transparent editorial voices under **FilmCurio Editorial**, openly
   AI, **never a real critic, never a fake user**. The chosen lens is stored as provenance
   (`answerer_lens`/`asker_lens`). **No fake engagement** — the worker never writes votes,
   comments-as-users, or reputation. Carry the **honest AI-written / post-publish-audit disclosure.**
8. **GEO output contract.** The prompt already bakes in §8: answer-first, the question as a real
   long-tail query (+ optional body), relevant entity mentions, internal-link hooks, schema-ready
   structure.
9. **Rate governor + monitoring (core).** Daily cap + **slow ramp-up**; per-film cap;
   **dedup/thin-content checks**; **cost tracking** per run; **admin pause/resume + rate + validator
   thresholds** controls. Surface progress (films done/remaining, questions/film, today's output,
   cost, **mean `self_confidence`**) in `/admin`.
10. **Encode the standard (the moat).** The editorial standard lives in the single-call prompt
    (`prompt-featured-qa.md`): pick the questions people actually ask, **answer the exact crux**,
    land one **aha**, stay **film-specific and accurate** (E-E-A-T top grade). Treat the prompt as
    the product, iterated over time.
11. **Config schema deliverable.** Document the admin-tunable config: generator model, optional
    auditor model, **daily rate + ramp**, and **validator thresholds** (min items, `self_confidence`
    floor) — readable/editable from `/admin`.
12. **Observability.** Write a per-film **`jobs`** row (status + `current_step` + counts + cost +
    timestamps), an **`agent_activity`** heartbeat (state + "what it's doing now" + today's counts),
    and timestamped **`content_events`** at every step. `/admin` Activity Log (§6.13) renders **Now
    / Timeline / Latest outputs** from these.

## Verify (all must pass)
- Uploading the film list resolves titles to TMDB, flags them `in_pipeline`, reports unmatched —
  **no further manual input required**.
- The **daily scheduler** processes a batch **on its own**; over runs, coverage increases and each
  processed film reaches ~10 published Q&A (**≥8** minimum).
- Generation is a **single call per film** returning **valid JSON**; items are **film-specific and
  category-free** (no `question_type`), read **conversational + deep**, and **some carry an
  optional body, some don't**.
- The **deterministic validator** rejects malformed / low-confidence output; a hard failure
  triggers **exactly one retry then skip+log**. **There is no `in_review` state and no review
  queue.**
- Swapping the generator model in config changes which model runs (no code change); the bulk run
  uses **Batch + context caching**.
- A valid item lands in the **`approved` buffer** (not public); the **publisher** releases it
  **jittered**; an answer never publishes before its question; a film's items are **staggered**;
  `published_at` is real (**no backdating**).
- A run creates **zero** `votes` rows and **zero** human-looking profiles; published items show the
  **FilmCurio Editorial** byline + a **lens** label + the honest disclosure.
- The **post-publish re-audit** runs on a sample and the admin can hide items.
- The **Activity Log** shows **Now / Timeline / Latest outputs**.
- The single call runs in the **worker**, never a Vercel function; provider keys + service role are
  server-only.

## Do not
Require per-film manual triggering; use a `question_type` taxonomy; add a separate verifier/scorer
stage or an `in_review` / human review queue; claim per-item human review; write in a stiff
academic voice; run generation in the Vercel request path; fabricate personas-as-users, votes, or
reactions; publish output that failed validation; firehose-publish without the ramp; hard-code the
model; commit provider keys.

*Next:* the media curator (part 2) and the home redesign (part 3).
