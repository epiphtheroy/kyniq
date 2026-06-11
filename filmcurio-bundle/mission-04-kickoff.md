# Mission 4 — Answers, contributions, voting, ranking

> Paste **after Mission 3 verifies.**

---

**Context.** Read `AGENTS.md` and `SPEC.md` §6.1 (question page), §3 (canonical answer +
contributions), §3.1 (upvote-only), §7.1 (`sort_score`), and match `ref-question-page.html`.
Mission 4 from §13. **Scope = the question page: canonical answer + contributions + upvoting +
ranking.**

**Do:**
1. **Question page `/film/[slug]/q/[question-slug]`** — server-rendered, matching
   `ref-question-page.html` + §6.1: film context strip; question title; the **canonical
   answer** (answer-first TL;DR + body + "last updated by … · read by N"); actions "Share your
   reading" / "Suggest an edit"; then the **contributions** stream with Top / Newest tabs.
2. **Contributions** — authenticated users post a reading (`status='published'`,
   `source='human'`, as self). One-level **comments** on contributions.
3. **Voting — upvote-only.** A row in `votes` = one upvote (UNIQUE `user_id`,`contribution_id`);
   toggling removes it. Recompute `contributions.sort_score` per §7.1 on each vote (trigger or
   server). **No downvote control anywhere — UI, API, or schema.**
4. **Ranking** — Top tab sorts by `sort_score`, Newest by `created_at`. A merged contribution
   shows the "merged into the canonical answer" marker (the merge action itself is M5).

**Verify (all must pass):**
- Upvoting reorders the Top tab by `sort_score` (not raw count); removing the upvote reverts.
- There is **no downvote** anywhere; `grep -i downvote` stays empty.
- A logged-out user can read everything but cannot post or vote; a logged-in user posts as
  themselves only.
- The page is server-rendered (view-source shows the canonical answer text).

**Do not:** build canonical editing/governance (M5), profiles/badges (M6), or the admin console.

---

*Next:* **Mission 5 — Edit governance.**
