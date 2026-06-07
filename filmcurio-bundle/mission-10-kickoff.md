# Mission 10 — Seed content (run the pipeline)

> Paste **after Mission 9b.** This produces public content — run it in **approval mode** with a
> conservative publish gate, and review a sample before scaling.

---

**Context.** Read `AGENTS.md` and `SPEC.md` §3.2 (pipeline + quality guardrails), §6.13 (admin
review), §1 (strategic principle). Mission 10 from §13. **Scope = cold-start content via the
Mission 9b pipeline — not a separate generator.** Pages must not be empty when crawlers arrive.

**Do:**
1. Pick an **initial curated film set** (start small — a few dozen well-known interpretation-
   rich films); questions emerge from each film (no categories, §3.2).
2. Run the **Mission 9b pipeline** (generate → verify → gate → publish) across them, attributed
   to **FilmCurio Editorial**, with the disclosure rendered. Respect the publish **rate limit**.
3. The **admin reviews a representative sample** for quality before letting the batch publish
   widely — depth and uniqueness over volume (scaled-content guardrail, §3.2). Low-confidence
   items wait in the review queue (§6.13).
4. After publishing, confirm the GEO surfaces populate: sitemap, JSON-LD, related/discovery
   modules, and the director hubs.

**Verify (all must pass):**
- Each seeded film has **≥3 published questions** with non-empty canonical answers, all
  attributed to the editorial identity and audited in `content_events`.
- All seeded content is `status='published'`, anon-readable, and in the sitemap; nothing
  low-confidence was auto-published (those sit in the admin queue).
- No fabricated users, no AI upvotes (§3.2) were created by the run.
- Spot-checked answers are factually clean (per the verify pass) and read as genuine criticism,
  not thin/duplicative filler.

**Do not:** mass-publish unreviewed low-confidence content; fabricate engagement; turn on ads.

---

*After this:* the core build is complete. **Deferred (build only when you choose):** Mission 11
(ads — after real traffic) and Mission 12 (@-mentions, actor pages, the tagged director layer).
Also deferred: pgvector semantic relatedness (v2) and co-engagement (v3).
