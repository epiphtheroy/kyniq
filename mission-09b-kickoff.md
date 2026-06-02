# Mission 9b — AI content pipeline (generate → verify → publish)

> Paste **after Mission 7** (GEO revalidate + sitemap) **and Mission 6b** (admin review queue),
> with Mission 2's TMDB cache available. The pipeline runs with the **service role**
> (elevated) — build it and run the first production batch in **approval mode**, and review the
> publish-gate threshold before enabling auto-publish.

---

**Context.** Read `AGENTS.md` and `SPEC.md` §3.2 (lifecycle, provenance, the pipeline, and the
**no-sockpuppet hard rule**), §6.1 (answer shape), §8 (revalidate + sitemap), §10 (TMDB for
verification), §4 (`content_events`), §6.13 (admin queue). This is Mission 9b from §13.
**Scope = the server-side generate→verify→publish service + its admin-triggered entry point.**

**Do:**
1. **Server-side only.** A service (route/job + `SECURITY DEFINER` RPCs) authenticated with the
   Supabase **service role** — never the public client. Wire it to the §6.13 "Pipeline
   controls" so the admin can trigger a run for a target **film + `question_type`**.
2. **Generate (draft).** AI writes a question + a canonical answer (and optionally 1–2
   contributions) for the target as `status='draft'`, `source='ai'`, `generated_by={model}`,
   authored by the **"Kyniq Editorial"** `system` profile (or a disclosed editorial voice).
   Use the answer-first TL;DR shape (§6.1). Log `content_events` `event='generated'`.
3. **Verify (검산).** A **separate** AI pass fact-checks the *checkable* claims (title, year,
   director, cast, plot facts) against the cached TMDB data / sources, scores a `confidence`
   (0–1), and writes `content_events` `event='verified'` with `meta = { confidence, checks,
   sources, notes }`. Interpretive claims are **not** "verified" — check facts + coherence only.
4. **Gate.** `confidence ≥ threshold` AND no factual conflict → publish. Otherwise leave
   `status='in_review'` for the admin queue (§6.13). The threshold is configurable; default
   conservative.
5. **Publish.** Set `status='published'`, `published_at`, and `reviewed_by`; trigger ISR
   revalidate for the affected film + question pages; update the sitemap. Log `content_events`
   `event='published'`.
6. **No-sockpuppet / no fake engagement (hard rule, §3.2).** Never create human-looking
   accounts, AI upvotes, fabricated "other readers," or fake reputation/badges. AI content
   carries the transparent editorial byline only; upvotes/contributions/reputation stay
   real-user-only. Render the disclosure ("Drafted with AI, reviewed by the Kyniq editorial
   team").
7. **Rate limit.** Cap publishes per run/day (the scaled-content guardrail); the admin can
   pause/resume from the console.

**Verify (all must pass):**
- A freshly generated item exists as `draft`, is **invisible to the anon key**, and is **absent
  from the sitemap**.
- After verify+publish it is anon-readable and in the sitemap, and its question page exposes
  valid `QAPage` JSON-LD with `dateModified`/`published_at` set.
- A deliberately **low-confidence** item stays `in_review` and shows in the admin queue —
  **not** public.
- Each stage wrote a `content_events` row (generated / verified / published) with
  `actor_kind` 'ai'/'system'.
- A run creates **no** rows in `votes` and **no** new human-looking `profiles`; the published
  item shows the **editorial byline + disclosure**, not a fake human author.

**Do not:** fabricate personas or engagement; auto-publish low-confidence items (they go to the
human gate); or invoke the pipeline from the public client.

---

*Next:* **Mission 10 — Seed content** = run this pipeline across the initial curated film set,
with the admin reviewing a sample for quality (guard the scaled-content risk, §3.2).
