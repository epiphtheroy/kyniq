# Mission 6 — Profiles, account, badges

> Paste **after Mission 5 verifies.**

---

**Context.** Read `AGENTS.md` and `SPEC.md` §6.4 (public profile), §6.8 (my page / settings),
§11 (badges), and match `ref-profile.html` + `ref-settings.html`. Mission 6 from §13.
**Scope = the public profile, the account/settings page, and the badge engine.**

**Do:**
1. **Public profile `/u/[username]`** — matching `ref-profile.html` + §6.4: avatar, name,
   impact line ("merged into N canonical answers · read by … · reputation …"), bio, badges,
   and tabs for the user's Readings / Questions. Read-only to others; when you view your own,
   show edit affordances linking to settings. Respect `is_public` (hidden when false).
2. **My page `/settings`** (login-required) — matching `ref-settings.html` + §6.8: Profile
   (display name, username, bio, avatar, `is_public` toggle); Account (email/password via
   Supabase, Google link, sign out); Notifications (stub: "notify me when my reading is
   promoted"); **Danger zone** — delete account → **anonymize** authored questions/contributions
   ("[deleted]") rather than removing rows others built on (§6.8).
3. **Badge engine** (§11, ≤6 badges, impact-forward) — award server-side on the defined events
   (e.g. "First Reading" on first contribution). Real users only — never mint badges for AI/
   editorial identities (§3.2).

**Verify (all must pass):**
- First reading awards the "First Reading" badge; the profile shows
  readings/questions/badges/reputation.
- `is_public=false` hides the public profile; viewing your own profile shows edit links.
- Deleting an account anonymizes its authored content (rows others built on remain intact).
- Settings changes (bio, username, privacy toggle) persist and reflect on the public profile.

**Do not:** build the admin console (6b) or GEO schema (M7).

---

*Next:* **Mission 6b — Admin console & roles** (prompt already written), then **Mission 7 — GEO
layer.**
