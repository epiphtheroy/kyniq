-- 0140_film_leads — the app-parity lead layer
-- 정본: HANDOFF-앱패리티-공장.md §3.1
--
-- The app renders an Invitation for a film when the BFF hands it one. Tier-1 films
-- get theirs from a published `takes` row; Tier-2 films have none, so the section
-- disappears and the deck card loses its serif line.
--
-- This table fills that gap WITHOUT pretending to be Tier-1. The tempting shortcut —
-- writing a figure plus an invitation take — was rejected: `figures` rows mint
-- /film/[slug]/figure/[figureSlug] pages (five thousand new crawl surfaces on the
-- exact route that saturated this database on 2026-08-06), they trip the
-- films.visible trigger at three approved rows, and misreadings, tropes and the
-- catalog map all derive from them. A parallel, additive table costs one LEFT JOIN
-- and is a `drop table` away from never having happened.
--
-- Precedence is resolved in the BFF, not here:
--     published invitation take  →  film_leads  →  film_sentences (EN)  →  nothing
-- so a film promoted to Tier-1 later simply shadows its lead. No cleanup, no conflict.

create table if not exists public.film_leads (
  film_id       uuid primary key references public.films(id) on delete cascade,
  lead          text not null check (length(btrim(lead)) between 200 and 2000),
  model         text not null,
  source_sha256 text not null,   -- hash of the fact block the writer was given
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.film_leads is
  'App-parity Invitation prose for films without a published invitation take. '
  'Additive: never read when a Tier-1 invitation exists. See HANDOFF-앱패리티-공장.md.';
comment on column public.film_leads.source_sha256 is
  'sha256 of the fact block supplied to the writer. Regenerate when it changes; '
  'this is how we tell a stale lead from a current one without re-reading the prose.';

alter table public.film_leads enable row level security;

-- Read-only to the world; writes are service-role only (no policy = no access).
drop policy if exists film_leads_read on public.film_leads;
create policy film_leads_read on public.film_leads
  for select to anon, authenticated using (true);

grant select on public.film_leads to anon, authenticated;
