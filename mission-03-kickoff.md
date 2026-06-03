# Mission 3 — Auth + ask flow

> Paste **after Mission 2 verifies.** Auth providers + email (OAuth keys, SMTP) are secrets —
> configure them in **approval mode**.

---

**Context.** Read `AGENTS.md` and `SPEC.md` §6.7 (auth screens), §6.5 (ask flow), §6.11
(`question_type`), §3.1 (frictionless participation), and match `ref-signup.html` +
`ref-ask-flow.html`. Mission 3 from §13. **Scope = auth + the ask flow.** No answers/voting
(M4), no profiles page (M6).

**Do:**
1. **Supabase Auth** — email + password with **email verification**, plus **Google OAuth**, and
   a password-reset flow. The `handle_new_user` trigger (M1) creates the profile.
2. **Auth screens** `/signup`, `/login`, `/verify` + reset, matching `ref-signup.html`
   (centered editorial card, logo, "By joining you agree to Terms/Privacy"). Username chosen
   here or on first `/settings` visit.
3. **Ask flow `/ask`** matching `ref-ask-flow.html` + §6.5: step 1 pick film (uses the M2 TMDB
   search; supports `/ask?film=…`), step 2 question title + optional context + a
   **`question_type` select** (the §6.11 vocabulary), step 3 optional first reading. Requires
   login; **preserve the draft through the auth gate** and return to the exact action.
4. Created questions are `status='published'`, `source='human'`, `author_id = auth.uid()`,
   attached to the film (frictionless, §3.1). Posting requires a **verified** email.

**Verify (all must pass):**
- A logged-out POST to create a question is blocked; sign-up sends a verification email; an
  unverified user cannot post.
- A logged-in user's question appears under its film with a stored `question_type` and
  `status='published'`.
- Hitting `/ask` while logged out bounces through login and returns with the draft intact.
- Google OAuth round-trips; password reset works.

**Do not:** build the answer/contribution UI, voting, profiles, or the admin console.

---

*Next:* **Mission 4 — Answers, contributions, voting, ranking.**
