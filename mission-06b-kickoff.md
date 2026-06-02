# Mission 6b — Admin console & roles

> Paste **after Mission 6 verifies** (needs auth from M3, profiles/roles + status from M1, and
> the revision history from M5 for rollback). Admin write paths use elevated privilege — build
> the server routes/RPCs and assign the **first admin in approval mode**.

---

**Context.** Read `AGENTS.md` and `SPEC.md` §6.13 (admin console), §4 (roles, `status`,
`content_events`, RLS), §3.2 (content lifecycle + no-sockpuppet rule), §7.4 (governance). This
is Mission 6b from §13. **Scope = the `/admin` console + role gating + status management +
audit.** The AI-generated review-queue *content* arrives with Mission 9b — here, test the queue
with a manually-inserted `in_review` row.

**Do:**
1. **Role gating.** `/admin` requires login **and** `profiles.role = 'admin'`; everyone else
   (anon or normal user) gets 404/forbidden. `noindex`, never linked in public chrome, excluded
   from the sitemap. Set the **first admin via a secure manual step** (SQL/console), never a
   public route.
2. **Server-side authority.** All admin mutations go through server routes / `SECURITY DEFINER`
   functions that verify `role='admin'` (or service role) — never client-side. **Every mutation
   writes a `content_events` row** (`actor_id`, `actor_kind='human'`, `event`, `meta`).
3. **Surfaces** (§6.13) — same design tokens; utilitarian density (tables, dense rows) is fine:
   - **Review queue** — items in `status='in_review'`, each showing the AI verification
     notes/confidence from `content_events`; actions: approve & publish, edit then publish,
     reject (→ `rejected`).
   - **Content management** — search any question / canonical answer / contribution at any
     status; edit; unpublish (→ `hidden`); delete (anonymize author + body); roll back a
     canonical answer to any `answer_revisions` entry.
   - **Members** — list users; suspend/reactivate (`account_status`); anonymize; adjust
     `reputation`; grant/revoke `role`.
   - **Flags** — the `flags` queue; resolve → hide content / keep / suspend author.
   - **Audit log** — the `content_events` stream, filterable by entity / actor / event.
   - **Pipeline controls** — leave a clearly-marked stub section; it gets wired to the
     generator in Mission 9b.
4. **Status machine.** Enforce the §3.2 transitions (draft / in_review / published / rejected /
   hidden) server-side. Publishing sets `published_at` and triggers ISR revalidate + sitemap
   update.

**Verify (all must pass):**
- A non-admin (anon **and** a normal logged-in user) gets 404/forbidden at `/admin`; `/admin`
  is `noindex` and absent from the sitemap.
- The admin can take a manually-inserted `in_review` item → `published` (it becomes
  anon-readable) and → `hidden` (it disappears from public); each action wrote a
  `content_events` row.
- Suspending a member blocks their posting; anonymize blanks authored content without deleting
  rows others built on; rolling back a canonical answer restores a prior revision.
- Resolving a flag updates its status and (if chosen) hides the target.

**Do not:** build the AI generator/verifier (Mission 9b), fabricate any users or engagement,
ads, or @-mentions.

---

*Next:* **Mission 7 (GEO)** if not already done, then **Mission 9b — AI content pipeline.**
