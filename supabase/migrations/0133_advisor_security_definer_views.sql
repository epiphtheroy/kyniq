-- 0133 — Security Advisor: clear the nine ERROR-level `security_definer_view` lints.
--
-- A public view runs with the privileges of its owner (postgres, BYPASSRLS) unless it
-- carries `security_invoker`. Every one of these nine therefore handed anon/authenticated
-- a quiet read path around row level security. This flips all nine, and repairs the two
-- places where the definer property was actually load-bearing.
--
-- Each flip below was checked against the live data first: for the four "RLS-equivalent"
-- views the invoker result set is identical to the definer one, because the view's own
-- WHERE clause already matches the RLS predicate of every table it reads.

begin;

-- ── 1–4. RLS-equivalent aggregates: flip, nothing else to do ─────────────────────────
--   figure_take_counts / figure_register_counts — filter takes.status='published', which
--     is exactly the public branch of `takes: read`. (Both currently return 0 rows.)
--   frame_instance_counts — filters questions.status='published' (== `questions: read`);
--     question_frames is `using (true)`. 25 rows before and after.
--   trope_counts — meta_takes.status='published' (== policy), figure_type_members is
--     `using (true)`, and every figure is 'approved', the public branch of `figures: read`.
--     Verified: zero rows and zero counts differ.
alter view public.figure_take_counts     set (security_invoker = on);
alter view public.figure_register_counts set (security_invoker = on);
alter view public.frame_instance_counts  set (security_invoker = on);
alter view public.trope_counts           set (security_invoker = on);

-- ── 5. meta_take_film_counts / meta_take_register_counts ────────────────────────────
-- These aggregate `takes` rows that are deliberately unpublished — all 43,911 takes
-- carrying a meta_take_id have status <> 'published' — so under RLS an anon caller sees
-- nothing. The *counts* are public (they print on the home page and the catalogue), the
-- take bodies are not, so the exposure moves out of the view and into the four named RPCs
-- that own it explicitly. Direct readers are the /admin page and worker/*.py, both on the
-- service-role key, which keeps its full view because it holds BYPASSRLS.
alter view public.meta_take_film_counts     set (security_invoker = on);
alter view public.meta_take_register_counts set (security_invoker = on);

-- The RPCs over meta_take_film_counts run as their caller today, so the flip above would
-- silently zero their `films` column. Each is a closed projection over published rows with
-- no caller-supplied predicate, so running them as the owner is safe and keeps the view
-- inlined (no per-row function barrier in trending_meta_takes' correlated subquery).
-- trending_meta_takes had no pinned search_path, which a definer function must have.
alter function public.trending_meta_takes(text, integer) security definer set search_path = public;
alter function public.meta_takes_catalogue()             security definer;
alter function public.meta_takes_featured(integer)       security definer;
alter function public.home_payload()                     security definer;

-- ── 6. like_counts — a public counter over private rows ─────────────────────────────
-- user_pins is `user_id = auth.uid()`, so an invoker view would show a logged-out reader
-- zero hearts and a logged-in reader only their own. The ♥ total is public by design
-- (components/EntityActions.tsx reads it with the browser anon key), so the aggregate —
-- and only the aggregate, never user_id — moves into a definer function the view wraps.
create or replace function public.like_counts_all()
returns table (entity_type text, entity_id uuid, likes integer)
language sql
stable
security definer
set search_path = public
as $$
  select up.entity_type, up.entity_id, count(*)::int
  from public.user_pins up
  where up.kind = 'like'
  group by up.entity_type, up.entity_id;
$$;

revoke all on function public.like_counts_all() from public;
grant execute on function public.like_counts_all() to anon, authenticated, service_role;

create or replace view public.like_counts with (security_invoker = on) as
  select entity_type, entity_id, likes from public.like_counts_all();

-- ── 7. film_curation / film_axes_view — the two real leaks ──────────────────────────
-- film_curation joins curation.film, a table that grants nobody; film_axes_view reads
-- film_namings/film_axes, which have RLS enabled and zero policies. Both were reachable by
-- anon purely through the definer property. Nothing in the app reads either; the factory
-- scripts reach film_axes_view on the service-role key and are unaffected.
alter view public.film_curation  set (security_invoker = on);
alter view public.film_axes_view set (security_invoker = on);

revoke select on public.film_curation  from anon, authenticated;
revoke select on public.film_axes_view from anon, authenticated;

-- BYPASSRLS is not a privilege grant, so service_role needs these to keep reading through
-- the documented curation bridge (docs/PLAN-curation-integration.md). The curation schema
-- is not in the PostgREST exposed set, so this adds no public surface.
grant usage on schema curation to service_role;
grant select on curation.film to service_role;

commit;
