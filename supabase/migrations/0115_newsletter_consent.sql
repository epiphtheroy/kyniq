-- 0115_newsletter_consent.sql
-- One-click unsubscribe for the consumer newsletter (was reply-"unsubscribe" only)
-- + a marketing-consent flag on the account. See HANDOFF-회원가입-전환-설계.md §8.
--
-- newsletter_subscribers already exists (dashboard-applied: columns email, status,
-- source). This only ADDS a token + a consent flag; it does not recreate anything.
-- Apply: python3 worker/apply-sql.py supabase/migrations/0115_newsletter_consent.sql (owner `!`).

-- one-click unsubscribe token (CRM-style, but scoped to the consumer list)
alter table if exists public.newsletter_subscribers
  add column if not exists unsub_token uuid not null default gen_random_uuid();
create unique index if not exists newsletter_subscribers_unsub_token_idx
  on public.newsletter_subscribers(unsub_token);

-- public, token-authenticated unsubscribe (callable by anon — the token IS the auth)
create or replace function public.newsletter_unsubscribe(p_token uuid)
returns text
language sql volatile security definer set search_path = public as $$
  update public.newsletter_subscribers
     set status = 'unsubscribed'
   where unsub_token = p_token
  returning email;
$$;
grant execute on function public.newsletter_unsubscribe(uuid) to anon, authenticated;

-- account-level marketing consent (kept separate from the auth email; explicit opt-in only)
alter table if exists public.profiles
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists email_optin_at timestamptz;
