-- 0073 · METATAKE TV personal lists (YouTube-style "Save to playlist")
--
-- 1) tv_user_lists / tv_user_list_items — a signed-in user's own watch lists,
--    RLS owner-only (browser client CRUDs them directly; no API route needed).
--    Saving one of the 5,559 CURATED lists needs no table at all: that reuses
--    user_saves (entity_type='tv_list', entity_ref=list slug) via SaveButton.
-- 2) tv_watch_films(p_slugs) — plays an arbitrary ordered set of programs (a
--    user list's items) through the same entry shape tv_watch produces, so the
--    front end feeds it straight into TVProgramPlayer.

create table if not exists public.tv_user_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tv_user_lists_user_idx
  on public.tv_user_lists(user_id, created_at desc);

create table if not exists public.tv_user_list_items (
  list_id uuid not null references public.tv_user_lists(id) on delete cascade,
  program_slug text not null,
  pos int not null default 0,
  added_at timestamptz not null default now(),
  primary key (list_id, program_slug)
);

alter table public.tv_user_lists enable row level security;
alter table public.tv_user_list_items enable row level security;

drop policy if exists tv_user_lists_owner on public.tv_user_lists;
create policy tv_user_lists_owner on public.tv_user_lists
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists tv_user_list_items_owner on public.tv_user_list_items;
create policy tv_user_list_items_owner on public.tv_user_list_items
  for all to authenticated
  using (exists (select 1 from public.tv_user_lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.tv_user_lists l where l.id = list_id and l.user_id = auth.uid()));

-- ── tv_watch_films: entries for an ordered set of program slugs ─────────────
-- Mirrors tv_watch's per-program entry JSON exactly. security definer (tv_* RLS
-- exposes only published rows anyway); the function-level statement_timeout
-- clears the anon role's 3s default on cold beats reads.
create or replace function public.tv_watch_films(p_slugs text[], p_cap int default 60)
returns jsonb language sql stable security definer set search_path to 'public'
set statement_timeout to '12s' as $$
with wanted as (
  select w.slug, w.ord
  from unnest(p_slugs[1:coalesce(p_cap, 60)]) with ordinality w(slug, ord)
),
film_j as (
  select p.id pid, p.slug, p.title, p.dek, w.ord,
    jsonb_build_object(
      'title', f.title, 'year', f.year, 'slug', f.slug, 'director', f.director,
      'director_slug', f.director_slug, 'poster', f.poster_path, 'backdrop', f.backdrop_path,
      'clip', p.meta->'clips'->>0, 'clips', coalesce(p.meta->'clips','[]'::jsonb)) film
  from wanted w
  join tv_programs p on p.slug = w.slug and p.status = 'published'
  join films f on f.id = p.film_id
)
select jsonb_build_object('entries', coalesce((select jsonb_agg(jsonb_build_object(
  'slug', fj.slug, 'title', fj.title, 'dek', fj.dek, 'film', fj.film,
  'segments', (select jsonb_agg(jsonb_build_object('id',s.id,'topic',s.topic,'seq',s.seq,'title',s.title,
                 'kicker',s.kicker,'accent',s.accent,'beats',s.beats,'duration_ms',s.duration_ms) order by s.seq)
               from tv_segments s where s.program_id = fj.pid)) order by fj.ord)
  from film_j fj), '[]'::jsonb))
$$;

grant execute on function public.tv_watch_films(text[], int) to anon, authenticated;
