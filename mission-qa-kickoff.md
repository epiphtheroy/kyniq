# Mission QA — End-to-end QA & repair (self-directed)

> Paste into the Antigravity Manager. This is **not** a feature build — it is a diagnose-and-
> repair pass over the whole app. Code/DB fixes you make directly (migrations in **approval
> mode**). Anything that lives in an external dashboard (Supabase Auth config, email templates,
> Google Cloud OAuth, Vercel env, DNS) you **cannot** change — document those as a precise
> "Human action required" list instead.

---

## Goal
Walk the **entire user experience** as a real user would, find everything that's broken or
rough, **diagnose the root cause**, and **fix it** — then re-verify. Known symptoms to start
from (not the whole list): film **search doesn't work**, **question submission stalls**, the
**login/verification flow** fails, and **`/admin` 404s**. Discover the rest yourself.

## Operating rules (read before touching anything)
- **Reproduce empirically — don't guess.** Use the **browser agent** to actually click through
  flows like a user; capture **console errors, failed network requests, and server/Supabase
  Auth logs**; use the **terminal** to read the relevant code, the build output, and the DB
  state (Supabase). Confirm each bug before and after the fix.
- **Fix root causes holistically, never symptom-by-symptom.** When you find a failure: trace it
  to its true cause, **map the blast radius** (every flow/route/component that shares that
  cause), and fix them **together in one change** — then re-test all the flows that touch it.
  Many failures share one root (e.g. a missing/incorrect Supabase **session-refresh
  middleware** can break login *and* posting *and* voting *and* `/admin` at once; a misset
  Site URL breaks email confirm *and* OAuth). Look for the shared cause before editing.
- **Hold all invariants** (AGENTS.md / SPEC): SSR/ISR + GEO intact; **upvote-only, no
  downvotes**; **public read gated to `status='published'`** (no draft leaks); **no sockpuppets
  / no fake engagement** — when you need test data, use clearly-disposable test accounts you
  create through the real signup flow, never fabricated "organic" users or AI upvotes; design
  system unchanged.
- **Approval mode** for: SQL migrations/RLS, secrets/env, auth config, robots, deploy.
- **No regressions.** After each fix, re-run the adjacent flows. Keep changes minimal but
  complete.
- Keep a running **QA report** (see Deliverable).

## Method — for each issue
1. **Reproduce** in the browser; record the exact step, the URL it lands on, console/network
   errors, and any server/Supabase log lines.
2. **Root-cause** by reading the code path end to end (client → server action/route → Supabase
   → RLS → response) and the DB/RLS state. State the cause, not the symptom.
3. **Blast radius** — list every other place with the same cause or pattern.
4. **Fix** all of them in one coherent change. If the real fix is dashboard config you can't
   reach, write the exact human steps instead.
5. **Re-verify** the original flow *and* the adjacent ones; confirm no regression.
6. **Log** it in the report.

## Flows to walk (priority order)
**A. Blockers first**
1. **Auth & session.** Signup → verification email → confirm link → session set → logged-in
   redirect; login; password reset; **Google OAuth** round-trip; **session persists across
   navigation and server components** (check the `@supabase/ssr` middleware that refreshes the
   auth cookie — a frequent culprit). Note: the email link must hit a **`/auth/confirm`**
   route (`verifyOtp` with `token_hash`), distinct from the OAuth **`/auth/callback`**
   (`exchangeCodeForSession`); the email template + Supabase Site URL / Redirect URLs must
   match. Fix routes/middleware in code; flag template/Site-URL/OAuth-console items as human
   actions.
2. **Film search.** Home + ask-flow search returns results, handles no-result/empty, navigates
   to the right film; confirm the TMDB token is server-only and the search action/route works
   (check the failing network call).
3. **Ask flow.** Pick film (search) → title + `question_type` → optional reading → auth gate
   **preserves the draft** → submit → question appears under its film as `status='published'`,
   `author_id = auth.uid()`. Find where it **stalls** (server action error? RLS reject? missing
   await/redirect? draft restore?).
4. **`/admin`.** Currently 404. Determine why: is the route/console **not built** (it's
   Mission 6b — build it per SPEC §6.13 if missing), or is it the **role gate**? Get it
   working: a non-admin (anon + normal user) gets 404/forbidden; an `admin` sees the console
   (review queue, content management edit/unpublish/delete/rollback, members, flags, audit
   log); status transitions write `content_events`; `/admin` is `noindex` and out of the
   sitemap. Document the **first-admin SQL** for the human
   (`update public.profiles set role='admin' where id = (select id from auth.users where email='…')`).

**B. Core loop & the rest**
5. **Question page** — SSR canonical answer + contributions; **upvote toggle** re-sorts Top by
   `sort_score`; comments; **no downvote anywhere**.
6. **Edit governance** — suggest (sub-250) vs edit (Editor/admin) → revision created; rollback;
   promote/merge; reputation events fire correctly (real users only).
7. **Profiles & settings** — public profile; `/settings`; `is_public=false` hides the public
   profile; account delete **anonymizes** rather than deletes.
8. **Discovery & hubs** — related questions / related films / director hub render and link
   correctly (published-only).
9. **Cross-cutting** — only published content is publicly visible (no draft leak); 404/error
   pages; loading & empty states (never blank); dark-mode logo swap; responsive/mobile;
   broken links; obvious a11y (focus, alt, contrast); console clean; Core Web Vitals not
   regressed; JSON-LD/robots/sitemap still valid.

## Deliverable
- All code/DB fixes committed (small, reviewable commits referencing the flow).
- A **QA report** (`docs/qa-report.md`): for each issue — symptom, root cause, blast radius,
  the fix (or human step), and the re-verification result. End with two lists: **Fixed in
  code** and **Human action required** (each dashboard step spelled out exactly — Supabase Site
  URL/Redirect URLs/email template, Google OAuth console, Vercel env, first-admin SQL, etc.).

## Verify (QA is done when)
- Each flow in A and B can be walked **start to finish with no console/network errors**, or any
  remaining failure is clearly attributed to a documented human-config step.
- The four flagged issues (search, ask-submission, login/verification, `/admin`) are resolved
  or precisely attributed; `/admin` works for an admin and 404s for everyone else.
- No regressions; all invariants intact (`grep -i downvote` empty; no draft visible to anon; no
  fabricated users/upvotes created beyond clearly-disposable test accounts).

## Do not
Band-aid symptoms; break SSR/GEO/RLS/upvote-only/design invariants; fabricate personas or
engagement; commit secrets; change auth providers' behavior without flagging the dashboard step.
