-- 0081_factory_schema.sql — The Film Factory (영화공장) ledger + helper RPCs
-- Canonical design: HANDOFF-영화공장.md §4 / §7. Applied to live 2026-07-12.
-- ADDITIVE ONLY: new isolated `factory` schema + new public helper/wrapper functions.
-- Touches NO existing table, RPC, or behaviour. Safe to apply on a live DB.
--
-- The `films.visible` trigger is captured here for VCS reproducibility (it lived
-- only in the live DB — BACKLOG §B). The function body below is identical to the
-- live definition; the trigger DDL is recorded in a comment so a fresh restore can
-- recreate it without this migration having to lock `public.figures`.
--
--   CREATE TRIGGER trg_films_refresh_visible
--     AFTER INSERT OR DELETE OR UPDATE ON public.figures
--     FOR EACH ROW EXECUTE FUNCTION public.films_refresh_visible();

-- =========================================================================
-- 0. Capture the visible trigger's function (idempotent, no table lock)
-- =========================================================================
create or replace function public.films_refresh_visible()
returns trigger language plpgsql as $function$
declare fid uuid;
begin
  fid := coalesce(NEW.film_id, OLD.film_id);
  if fid is not null then
    update films set visible = (
      ((select count(*) from figures g where g.film_id = fid and g.status='approved') >= 3)
      and not coalesce(hold, false)
    ) where id = fid;
  end if;
  return null;
end $function$;

-- =========================================================================
-- 1. factory schema (PostgREST-unexposed; access via SD wrappers or Mgmt API)
-- =========================================================================
create schema if not exists factory;
revoke all on schema factory from anon, authenticated;

create table if not exists factory.runs (
  id bigserial primary key,
  mode text not null check (mode in ('single','bulk','backfill','sentinel')),
  film_count int, est_cost_usd numeric, actual_cost_usd numeric,
  status text not null default 'planning'
    check (status in ('planning','awaiting_review','running','paused','done','failed','aborted')),
  manifest_sha text,
  started_at timestamptz default now(), finished_at timestamptz, report_md text
);

create table if not exists factory.intake (
  id bigserial primary key,
  source text not null check (source in ('csv','cli','admin','sentinel','promotion')),
  raw_title text, year_hint int, director_hint text,
  tmdb_id int, film_id uuid references public.films(id),
  tier text not null default 'full' check (tier in ('full','catalog','auto')),
  status text not null default 'queued'
    check (status in ('queued','resolving','review','approved','rejected','ingesting','done','failed')),
  confidence text, resolve_note text,
  run_id bigint references factory.runs(id),
  requested_by text, created_at timestamptz default now(), decided_at timestamptz
);
create index if not exists intake_status_idx on factory.intake (status);

create table if not exists factory.stage_runs (
  id bigserial primary key,
  run_id bigint references factory.runs(id),
  film_id uuid references public.films(id),
  stage_id text not null,
  status text not null default 'pending'
    check (status in ('pending','submitted','running','done','failed','skipped','parked')),
  attempt int not null default 1,
  batch_id text, cost_usd numeric,
  started_at timestamptz, finished_at timestamptz,
  error text, verify_result jsonb,
  -- expression can't live in a table UNIQUE constraint; PG15 NULLS NOT DISTINCT
  -- treats null film_id (corpus/publication stages) as equal so re-attempts collide correctly.
  unique nulls not distinct (run_id, film_id, stage_id, attempt)
);
create index if not exists stage_runs_run_stage_idx on factory.stage_runs (run_id, stage_id, status);
create index if not exists stage_runs_film_idx on factory.stage_runs (film_id);

create table if not exists factory.change_orders (
  id bigserial primary key,
  kind text not null check (kind in ('code_drift','data_drift','schema_drift','new_surface','stage_broken','manual')),
  title text not null, evidence jsonb not null default '{}'::jsonb,
  affected_stages text[], proposal_md text,
  risk text not null default 'review' check (risk in ('auto_ok','review','blocked')),
  status text not null default 'open' check (status in ('open','proposed','approved','applied','dismissed')),
  created_at timestamptz default now(), decided_at timestamptz
);
create index if not exists change_orders_status_idx on factory.change_orders (status);

-- =========================================================================
-- 2. Pipeline helper RPCs (public; the two Stage-16/taste gaps the doc flagged)
--    Both are additive/null-only-by-default and never delete outside their scope.
-- =========================================================================

-- film_taste_vector = l2_normalize(avg(takes.embedding)); matches the LIVE definition
-- (no status filter — same as the existing 1,941 rows). Targeted films are refreshed;
-- with no arg, only films MISSING a vector are added (null-only).
create or replace function public.refresh_film_taste_vector(p_film_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_film_ids is not null then
    delete from public.film_taste_vector where film_id = any(p_film_ids);
  end if;
  insert into public.film_taste_vector(film_id, embedding, n_takes, built_at)
  select fg.film_id, l2_normalize(avg(tk.embedding))::vector(1536), count(*), now()
  from public.takes tk join public.figures fg on fg.id = tk.figure_id
  where tk.embedding is not null and fg.film_id is not null
    and ( (p_film_ids is not null and fg.film_id = any(p_film_ids))
       or (p_film_ids is null and not exists
             (select 1 from public.film_taste_vector v where v.film_id = fg.film_id)) )
  group by fg.film_id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.refresh_film_taste_vector(uuid[]) from anon, authenticated;

-- director_embedding = avg of the director's (visible-film) figure embeddings. Stage 16 gap.
create or replace function public.refresh_director_embeddings(p_slugs text[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_slugs is not null then
    delete from public.director_embedding where slug = any(p_slugs);
  end if;
  insert into public.director_embedding(slug, embedding, nfig, updated_at)
  select f.director_slug, l2_normalize(avg(fg.embedding))::vector(1536), count(*), now()
  from public.figures fg join public.films f on f.id = fg.film_id
  where fg.embedding is not null and f.director_slug is not null and f.visible
    and ( (p_slugs is not null and f.director_slug = any(p_slugs))
       or (p_slugs is null and not exists
             (select 1 from public.director_embedding d where d.slug = f.director_slug)) )
  group by f.director_slug;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.refresh_director_embeddings(text[]) from anon, authenticated;

-- =========================================================================
-- 3. Admin wrapper RPCs (public SD; only service_role calls — admin page is
--    already middleware-gated; revoke from anon/authenticated).
-- =========================================================================

-- Per-film × per-stage matrix for the most recent runs (jsonb single row = 1000-cap bypass).
create or replace function public.factory_matrix_json(p_limit int default 50)
returns jsonb language sql security definer set search_path = public, factory as $$
  select jsonb_build_object(
    'runs', coalesce((select jsonb_agg(to_jsonb(r) order by r.id desc)
                      from (select id, mode, film_count, est_cost_usd, actual_cost_usd, status,
                                   started_at, finished_at from factory.runs order by id desc limit 20) r), '[]'::jsonb),
    'intake', coalesce((select jsonb_agg(to_jsonb(i) order by i.id desc)
                        from (select id, source, raw_title, year_hint, tmdb_id, film_id, tier, status,
                                     confidence, resolve_note, run_id, created_at
                              from factory.intake order by id desc limit p_limit) i), '[]'::jsonb),
    'stages', coalesce((select jsonb_agg(jsonb_build_object(
                          'run_id', s.run_id, 'film_id', s.film_id, 'stage_id', s.stage_id,
                          'status', s.status, 'attempt', s.attempt, 'batch_id', s.batch_id,
                          'cost_usd', s.cost_usd, 'error', left(s.error, 240)) order by s.id desc)
                        from (select * from factory.stage_runs order by id desc limit 2000) s), '[]'::jsonb)
  );
$$;
revoke all on function public.factory_matrix_json(int) from anon, authenticated;

-- Data-drift probe: deficits among films created in the last N days (the sentinel's heart).
create or replace function public.factory_gaps_json(p_days int default 30)
returns jsonb language sql security definer set search_path = public, factory as $$
  with recent as (
    select f.id, f.slug, f.title, f.visible, f.is_analyzed, coalesce(f.hold,false) as hold, f.created_at
    from public.films f
    where f.created_at > now() - make_interval(days => p_days)
  ),
  scored as (
    select r.*,
      (select count(*) from public.figures g where g.film_id=r.id and g.status='approved') as figs,
      exists(select 1 from cinecodex.scores s where s.film_id=r.id) as has_ts,
      exists(select 1 from public.film_taste_vector v where v.film_id=r.id) as has_taste,
      exists(select 1 from public.film_affinities a where a.film_id=r.id) as has_aff,
      exists(select 1 from public.film_sentences x where x.film_id=r.id) as has_sent,
      exists(select 1 from public.film_watch_providers p where p.film_id=r.id) as has_prov,
      exists(select 1 from public.film_next fn where fn.source_film_id=r.id) as has_next
    from recent r
  )
  select jsonb_build_object(
    'days', p_days,
    'total_recent', (select count(*) from recent),
    'deficits', jsonb_build_object(
       'full_under_3_figs', (select count(*) from scored where not is_analyzed and figs<3 and not hold),
       'figs_ok_not_analyzed', (select count(*) from scored where figs>=3 and not is_analyzed),
       'held', (select count(*) from scored where hold),
       'unscored', (select count(*) from scored where not has_ts),
       'no_taste', (select count(*) from scored where figs>=3 and not has_taste),
       'no_affinities', (select count(*) from scored where figs>=3 and not has_aff),
       'no_sentences', (select count(*) from scored where figs>=3 and not has_sent),
       'no_providers', (select count(*) from scored where not has_prov),
       'no_next', (select count(*) from scored where figs>=3 and not has_next)
    ),
    'sample', coalesce((select jsonb_agg(jsonb_build_object(
                 'slug',slug,'title',title,'figs',figs,'visible',visible,
                 'analyzed',is_analyzed,'hold',hold,'ts',has_ts) order by created_at desc)
               from (select * from scored order by created_at desc limit 40) s), '[]'::jsonb)
  );
$$;
revoke all on function public.factory_gaps_json(int) from anon, authenticated;

create or replace function public.factory_change_orders_json()
returns jsonb language sql security definer set search_path = public, factory as $$
  select coalesce((select jsonb_agg(to_jsonb(c) order by c.id desc)
    from (select id, kind, title, evidence, affected_stages, risk, status, created_at
          from factory.change_orders where status <> 'dismissed' order by id desc limit 100) c), '[]'::jsonb);
$$;
revoke all on function public.factory_change_orders_json() from anon, authenticated;

-- Admin write buttons (status-only mutations; execution is Mac-side).
create or replace function public.factory_intake_add(
  p_source text, p_title text, p_year int default null, p_director text default null,
  p_tmdb_id int default null, p_tier text default 'full', p_requested_by text default 'admin')
returns bigint language plpgsql security definer set search_path = public, factory as $$
declare new_id bigint; eff_tier text; eff_status text;
begin
  -- 원우 결정 №1: auto is banned — downgrade to catalog + review.
  if p_tier = 'auto' then eff_tier := 'catalog'; eff_status := 'review';
  else eff_tier := p_tier; eff_status := 'queued'; end if;
  insert into factory.intake(source, raw_title, year_hint, director_hint, tmdb_id, tier, status, requested_by)
  values (p_source, p_title, p_year, p_director, p_tmdb_id, eff_tier, eff_status, p_requested_by)
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.factory_intake_add(text,text,int,text,int,text,text) from anon, authenticated;

create or replace function public.factory_intake_decide(p_id bigint, p_action text)
returns void language sql security definer set search_path = public, factory as $$
  update factory.intake
     set status = case when p_action='approve' then 'approved' when p_action='reject' then 'rejected' else status end,
         decided_at = now()
   where id = p_id;
$$;
revoke all on function public.factory_intake_decide(bigint,text) from anon, authenticated;

create or replace function public.factory_co_decide(p_id bigint, p_action text)
returns void language sql security definer set search_path = public, factory as $$
  update factory.change_orders
     set status = case when p_action='approve' then 'approved'
                       when p_action='dismiss' then 'dismissed'
                       when p_action='apply'   then 'applied' else status end,
         decided_at = now()
   where id = p_id;
$$;
revoke all on function public.factory_co_decide(bigint,text) from anon, authenticated;
