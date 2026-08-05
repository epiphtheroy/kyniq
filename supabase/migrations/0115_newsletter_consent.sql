-- 0115_newsletter_consent.sql
-- Account-level marketing consent, so a signed-in member can opt into the weekly
-- digest from Settings (kept separate from the auth email; explicit opt-in only).
-- See HANDOFF-회원가입-전환-설계.md §8.
--
-- NOTE: one-click unsubscribe needs NO schema — /api/newsletter/unsub uses a
-- stateless HMAC token and flips the existing newsletter_subscribers.status.
-- Apply: python3 worker/apply-sql.py supabase/migrations/0115_newsletter_consent.sql (owner `!`).

alter table if exists public.profiles
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists email_optin_at timestamptz;
