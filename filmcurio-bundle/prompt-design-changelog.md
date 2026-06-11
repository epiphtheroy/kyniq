# Prompt-design update — handoff notes (what changed, why, where, how to implement)

For the next AI/engineer. This documents the recent **prompt-design hardening** of the content
engine across three files — **`pipeline-prompts.md`** (the actual prompts), **`SPEC.md`** (§3.2 +
the positioning standard), **`AGENTS.md`** (standing rules). Read alongside
`content-engine-overview.md`. The pipeline worker mission (`mission-pipeline-worker-kickoff.md`)
was kept in sync with these.

If you implement only one thing from this: **the JSON contracts in `pipeline-prompts.md` changed —
parse/persist the new fields** (listed in §7 below).

---

## 1. No per-item human review → the automated gate is final
**What changed.** Removed the old "low confidence → admin queue / human reviews it" path.
Verification is now **corrective** (it emits targeted fixes → re-checks), the rubric scorer
**triages quality** (revise → re-score), and anything that still can't pass is **HELD — not
published, logged, never queued for a person.** Added a **post-publish random re-audit** + admin
**sampling** as the safety net.
**Why.** Reviewing ~10,000 items by hand is impossible, so the gate must be self-sufficient; the
safe default is *when uncertain, hold rather than publish.*
**Where.** `SPEC.md` §3.2 (verify/score/gate steps + honest caveats); `pipeline-prompts.md` §4
(corrective verifier), §5 (rubric loop), §6 (gate); `AGENTS.md` ("No per-item human review"
bullet).
**Implement.**
- Lifecycle: `draft → in_review/held → approved → published`. `in_review`/held = *waiting for an
  automated retry or permanently held*, **not** a human queue.
- Bounded corrective retry loops (e.g. ≤2) for both verify-fix and score-revise.
- A `held` outcome stays out of `published`, writes a `content_events` row, and is visible to the
  admin only as an aggregate stat — publishing never blocks on a person.
- Add a scheduled **re-audit job** that re-runs the verifier on a random sample of *live* items;
  admin can hide any item anytime.
- Disclosure must be **honest**: do not claim per-item human review (say e.g. "AI-written and
  fact-checked to FilmCurio's editorial standards, with human oversight by sampling").

## 2. Positioning standard: "deepest insight" + the facts→insight arc
**What changed.** Codified that every Q&A must **climb from rich, verified facts/context (the
on-ramp) to an insightful interpretive conclusion (the destination)**; fragmentary information
alone is a failure.
**Why.** FilmCurio's differentiation and AI-citability come from depth, not summary.
**Where.** `pipeline-prompts.md` §0 (THE GOAL + METHOD "arc"); `SPEC.md` §3.2 positioning
standard; `AGENTS.md` positioning bullet; rubric dims `insight_depth`, `fact_to_insight_arc`,
`non_fragmentary`.
**Implement.** Drafter output follows TL;DR → facts/context on-ramp → insight conclusion; the
rubric scores the arc; summary-only output → `revise`.

## 3. Demonstrated, expert viewing (the Experience/Expertise signal)
**What changed.** Added a requirement that the writing **read as genuine, finely-perceived
viewing** — precise grounded details, apt comparisons to *real* films/the director's other work,
and an experiential register.
**Why.** This is the E-E-A-T "Experience/Expertise" signal that builds trust and authority.
**CRITICAL GUARD (do not lose this).** That authority must come **only from dossier-grounded
specifics**. The model must **never invent a detail, scene, line, or comparison to sound
authoritative** — a fabricated specific is worse than a general statement. This matters more
because nothing is human-reviewed.
**Where.** `pipeline-prompts.md` §0 (DEMONSTRATE GENUINE, EXPERT VIEWING block), §1 (dossier now
collects `specifics` + `comparisons`), §3 (drafter uses them + the guard), §4 (verifier checks
they're grounded/accurate), §5 (rubric dim `demonstrated_viewing`); `SPEC.md`/`AGENTS.md`
positioning extended.
**Implement.**
- Dossier must gather and store `specifics` (grounded precise details) and `comparisons` (real
  films + the attribute that's actually true), each with a source/basis.
- Drafter records `specifics_used` / `comparisons_used`.
- Verifier flags `ungrounded_specifics` and inaccurate `comparison_checks` → corrective fix or
  hold.

## 4. Anti-repetition / distinctiveness (across ~10,000 items)
**What changed.** Each answer must be driven by **THIS film's internal elements + THIS question's
essence + the evidence optimized to that question** — **no portable template, stock opening,
habitual structure, or go-to theory move** reused across films. Rule of thumb: if a sentence
could sit unchanged under a different film/question, rewrite it.
**Why.** Running one method across ~10k items breeds sameness, which lowers quality and reads as
templated/scaled content (a search/AI spam risk).
**Where.** `pipeline-prompts.md` §0 (STAY DISTINCT block), §3 (drafter), §5 (rubric dim
`distinctiveness`); `SPEC.md`/`AGENTS.md` positioning extended.
**Implement.** Rubric scores `distinctiveness`; generic/templated → `revise`. Planner dedups
against existing questions on the film.

## 5. "THE GOAL" preamble (holistic understanding)
**What changed.** Added a short THE GOAL statement at the top of the editorial constitution.
**Why.** The model should understand the overall objective so all rules cohere rather than read
as a checklist.
**Where.** `pipeline-prompts.md` §0 (first paragraph of the constitution).
**Implement.** Keep it as the lead of the system prompt that is prepended to **every** stage call.

## 6. Real-person accuracy guardrail (tightened under no-review)
**What changed.** Reinforced: claims about real people (directors/actors/crew) must be **sourced,
non-defamatory facts only** — no rumor/speculation; the verifier checks this explicitly and
**holds** on risk.
**Why.** Autonomous publishing of a false claim about a real person is an accuracy/defamation/
legal risk.
**Where.** `pipeline-prompts.md` §0 (EVIDENCE & TRUTH), §4 (verifier `real_person_risk`);
`SPEC.md` §3.2 caveat.
**Implement.** Verifier `real_person_risk` non-empty → fix or hold.

---

## 7. JSON contract deltas (the part the program parses — implement carefully)
Stage outputs in `pipeline-prompts.md` gained fields:
- **Dossier (§1):** added `"specifics": [{detail, source_or_basis}]` and
  `"comparisons": [{other_film, shared_attribute, source}]`.
- **Drafter (§3):** added `"specifics_used": [...]` and `"comparisons_used": [...]`.
- **Verifier (§4):** added `"ungrounded_specifics": [{detail, issue}]` and
  `"comparison_checks": [{comparison, verdict}]` (alongside existing `fact_checks`,
  `real_person_risk`, `spoiler_risk`, `fixes`, `confidence`).
- **Rubric scorer (§5):** added dimensions `"demonstrated_viewing"` and `"distinctiveness"` to
  `scores`.
Persist these (e.g. on the item's `evidence_refs` / `rubric_scores` and in `content_events.meta`)
so gating and later auditing can use them.

## 8. Model & latency policy (quality-first, async)
**What changed.** Made two things explicit that were only implied before: (a) **prefer the
newest, most capable models** for the core stages (dossier/planner/drafter/verifier) — don't
default the core to old/cheap models; keep them swappable in config and validate a new model on a
small batch before a full switch; and (b) **longer generation latency is expected and
acceptable** — newest/reasoning models (thinking tokens) plus the corrective loops make
generation **seconds–minutes per film**, which is fine because the worker is
**asynchronous/background and not user-facing.**
**Why.** Quality is the moat, so the core stages should run on the best current models even
though they're slower; the decoupled buffer + publisher means per-item speed doesn't matter
(throughput is governed by the rate-limiter/ramp, not latency).
**Where.** `pipeline-prompts.md` (Model assignment + Latency policy); `SPEC.md` §3.2 (Model &
latency policy under Runtime topology); `AGENTS.md` (pipeline runtime bullet);
`mission-pipeline-worker-kickoff.md` (router step).
**Implement.** Default core roles to the newest models in `pipeline_config`; never move
generation onto the Vercel request path; size budgets/timeouts for multi-minute per-film runs.

## 9. Voice, hook & momentum upgrade (de-academize)
**What changed.** The earlier output read too academic and the questions were long, complete,
essay-prompt style. New rules: **(a) Voice** — write like a person talking, not a paper: casual,
fast, short sentences, plain words, no jargon/academic register; depth should land as a punch.
**(b) Questions are bait** — short (≈≤10–12 words), spoken, **provocative/"aggro"** to create
anticipation; a question may even be slightly *wrong/one-sided* (that's good — it's the gun the
answer fires). **(c) Answers have momentum** — open by answering the asker (pick up a word or two
from the question), use a **Chekhov's gun** (plant a detail early, pay it off), and land one real
**"aha"** turn near the end. Depth is kept; only the *delivery* changed.
**Why.** Hooky, human, propulsive writing wins clicks/dwell and reads as genuine — the academic
register was killing engagement.
**Where.** `pipeline-prompts.md` §0 (new VOICE + MOMENTUM blocks), §2 (planner: short aggro
questions, with good/bad examples; "questions can be wrong"), §3 (drafter: answer-the-asker +
Chekhov's gun + aha, anti-academic), §5 (rubric dims + a code pre-check that questions are short).
**Implement / JSON deltas.**
- Planner JSON: `"why_it_matters"` → **`"hook"`** (why it baits a click).
- Rubric `scores`: removed `accessibility`, `non_fragmentary`; **added `aha_momentum`,
  `conversational_responsiveness`, `not_academic`** (kept insight_depth, fact_to_insight_arc,
  evidence_grounding, demonstrated_viewing, distinctiveness, productive_uncertainty, voice_fit,
  citation_readiness). Update any scorer parser/persistence accordingly.
- New code pre-check: reject/revise questions that aren't short (≈≤12 words) / are essay-prompts.

## 10. FINAL consolidation — organic structure + confidence realism (supersedes the JSON deltas in §7 & §9)
**What changed.** The prompt pack was consolidated to address repetition bias and a confidence
deadlock: **(a) Organic structure** — removed the forced "facts→climb→insight" arc and any fixed
intro/body/conclusion; the Prime Directive is now Anti-Template / organic creativity (let THIS
film dictate the shape). The voice (human, non-academic), the aggro-short questions, and the
"aha"/answer-the-asker momentum are KEPT, but momentum is reframed as *qualities achieved
organically*, never a mandatory sequence (a sequence is itself a template). **(b) Confidence
realism** — `confidence` is redefined as **factual-safety certainty** (no hallucination/factual
error), explicitly **NOT interpretive perfection**, with a tunable threshold **~0.85, never 1.0**
(1.0 stalls the pipeline or passes only wiki-flat text). **(c) Verifier scope** — it now polices
ONLY objective flaws (hallucination/fact/real-person/spoiler), not style or interpretation.
**Why.** Micro-managed structure → templated sameness across ~10k items; a 1.0 bar → infinite
loops / bland output. Freedom of structure + hard factual red lines is the right trade.
**Where.** `pipeline-prompts.md` (entire pack rewritten to FINAL).
**FINAL JSON contract (this supersedes the field names in §7 and §9 — implement THESE):**
- **Dossier:** `verified_facts`, `cinematic_evidence` (`{detail, significance}`),
  `thematic_threads`, `comparisons`, `open_ambiguities`.
- **Planner:** `question`, `thematic_focus`, `hook`, `pitch`, `dossier_refs`.
- **Drafter:** `tldr`, `body`, `facts_used`, `evidence_used`, `voice_id`.
- **Verifier:** `critical_errors` (`{claim, issue, fix_suggestion}`), `real_person_risk`,
  `spoiler_risk`, `fixes`, **`confidence_score`** (factual-safety; gate at ~0.85).
- **Rubric `scores`:** `thematic_depth`, `cinematic_grounding`, `anti_template_variance`,
  `voice_and_flow`, `aha_momentum` (+ verdict, revise_notes). Code pre-check: question is short.
**Gate:** `confidence_score ≥ {thr}` (config; start 0.85) + scorer `publish` → approved; else
corrective loop or HOLD.

## 11. Film-entity recognition + internal linking
**What changed.** Two linked upgrades so SEO/AI reliably know a (deliberately terse) Q&A is about
a specific film, and so film mentions become navigation:
- **Entity recognition (the "recommended middle path").** Bind each question page to its film in
  three reinforcing places: (1) **`QAPage.about → Movie` with `sameAs`** (IMDb/Wikidata/Wikipedia)
  + `director` + `url` — the strongest, disambiguating signal; (2) **`<title>` = "{question} —
  {Film} ({Year}) | {brand}"** + film in meta description; (3) a **visible, linked film subhead**
  (the §6.1 banner as real crawlable text, not an image) + the answer naming the film **once,
  naturally** (rendered as an internal link). Rationale: structured data must match visible
  content, and AI engines read prose, not JSON-LD — so JSON-LD alone is the weakest option.
- **Internal linking — "LLM names, system links."** The model never writes URLs (it would
  hallucinate slugs/ids). The **dossier resolves** the current film + every comparison film
  (title+year) to `tmdb_id`/`slug`; a **deterministic linkifier** (pipeline step, post-score /
  pre-gate) wraps the **first mention** of each known entity + the director in `/film/{slug}` /
  `/director/{slug}` — catalogue-only, matching just the answer's known referenced set (no
  whole-catalogue matching → no common-word mislinks). A **background re-link sweep** (Curiobot-
  style) adds links as the catalogue grows.
**Why.** The question is a short hook and the answer names the film only once, so the film
association must be explicit (markup + title + visible subhead) and mentions must become real
internal links to build the SEO/GEO link graph + retention.
**Where.** SPEC §6 (internal-linking URL principle: canonical id = `tmdb_id`, first-mention only,
catalogue-only), §6.1 (banner = real linked text + subhead; answer mention auto-linked), §8.2
(`about → Movie` + `sameAs` + `<title>` + the 3-place entity requirement), §3.2 (dossier
id-resolution → **Linkify** step → **Re-link sweep**); `pipeline-prompts.md` (dossier comparisons
carry title+year; drafter "name the film once, naturally; never write URLs"); `AGENTS.md` (GEO
rule); `mission-pipeline-worker-kickoff.md` (graph: id-resolution, Linkify, Re-link sweep);
`redesign-home-and-question.md` (banner = real text).
**Implement.** `films` rows store `tmdb_id` + `slug` (+ `imdb_id`/`wikidata_id` for `sameAs`,
already in §4). Store answer body as **text + a links map** (offsets→url) so the re-link sweep and
rendering stay clean. Verify on the live page with Google's Rich Results Test (about→Movie) and
view-source for `ld+json`.

## 12. Still in force (unchanged — do not drop)
No sockpuppets / no fake engagement; `published_at` never backdated; published-gate RLS (only
`published` is public/in sitemap/JSON-LD); decoupled generate↔publish with jittered, independent
per-entity scheduling + ordering (question before its answers); Curiobot media (TMDB images +
YouTube bottom module); **verifier on a different model provider/family from the drafter**;
multi-provider router with model↔role mapping as admin config.
