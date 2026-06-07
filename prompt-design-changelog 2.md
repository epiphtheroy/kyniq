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
  fact-checked to Kyniq's editorial standards, with human oversight by sampling").

## 2. Positioning standard: "deepest insight" + the facts→insight arc
**What changed.** Codified that every Q&A must **climb from rich, verified facts/context (the
on-ramp) to an insightful interpretive conclusion (the destination)**; fragmentary information
alone is a failure.
**Why.** Kyniq's differentiation and AI-citability come from depth, not summary.
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

## 9. Still in force (unchanged — do not drop)
No sockpuppets / no fake engagement; `published_at` never backdated; published-gate RLS (only
`published` is public/in sitemap/JSON-LD); decoupled generate↔publish with jittered, independent
per-entity scheduling + ordering (question before its answers); Kyniqbot media (TMDB images +
YouTube bottom module); **verifier on a different model provider/family from the drafter**;
multi-provider router with model↔role mapping as admin config.
