# Mission 5 — Edit governance

> Paste **after Mission 4 verifies.** The canonical-edit `SECURITY DEFINER` function / RLS
> change is a migration — apply it in **approval mode**.

---

**Context.** Read `AGENTS.md` and `SPEC.md` §7 (ranking & edit-governance), §7.4 (reputation
tiers), §4 (`answer_revisions`, `edit_suggestions`, canonical RLS). Mission 5 from §13.
**Scope = how the canonical answer gets edited, versioned, and rolled back.**

**Do:**
1. **Canonical editing** — gated server-side: only `reputation >= 250` (Editor tier, §7.4) or
   `admin` may edit `canonical_answers` directly, via a server route / `SECURITY DEFINER`
   function (the table stays not-client-writable, M1 RLS). Each edit writes an
   `answer_revisions` row and bumps `revision_count` + "last updated by … on …".
2. **Edit suggestions** — sub-threshold users submit `edit_suggestions` instead of editing;
   an Editor/admin approves (applies it, creating a revision) or declines.
3. **Promotion / merge** — promote a strong contribution into the canonical answer (sets
   `merged_into_canonical=true`, creates a revision). This is the strongest quality signal.
4. **Rollback** — restore any prior `answer_revisions` body (creates a new revision; never
   destroys history). Show the revision history.
5. **Reputation events** (§7) — contribution upvoted +10, promoted +25, suggestion approved
   +15, question upvoted +5 (server-side; real users only — no fake reputation, §3.2).

**Verify (all must pass):**
- A sub-250-rep user can only *suggest*, not directly edit; an Editor/admin edit creates an
  `answer_revisions` row.
- Rollback restores the prior canonical body and adds a revision (history intact).
- Promoting a contribution marks it merged and updates the canonical answer.
- Reputation changes fire on the right events and only for real users.

**Do not:** build profiles/badges UI (M6), the admin console (6b), or any AI write path.

---

*Next:* **Mission 6 — Profiles, account, badges.**
