-- 0139 — Talk layer walking skeleton (0137/0138 are reserved by the poster-localization work, see MIGRATE-0137-0138.sql) (canonical plan: /admin/docs/talk-layer).
--
-- The address is the world (film · figure · director · score · site); our own
-- texts never become addresses — they ride along as frozen-quote refs. One
-- thread per address; figure/score posts roll up to their film via film_key.
-- Humans write via RLS as themselves; the resident cast (Draft/Prism/Tray,
-- P0.5) writes via service_role with author_app set. Publish-then-audit (0017).

-- ── talk_posts ──────────────────────────────────────────────────────────────
create table if not exists public.talk_posts (
  id         uuid primary key default gen_random_uuid(),
  addr_type  text not null check (addr_type in ('film','figure','director','score','site')),
  addr_key   text not null,
  film_key   text,
  refs       jsonb not null default '[]'::jsonb,
  parent_id  uuid references public.talk_posts(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete cascade,
  author_app text check (author_app in ('draft','prism','tray','jab')),
  body       text not null check (char_length(body) between 1 and 2000),
  status     text not null default 'published'
             check (status in ('published','held','hidden','deleted')),
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  check (author_id is not null or author_app is not null)
);

create index if not exists idx_talk_posts_addr
  on public.talk_posts (addr_type, addr_key, status, created_at desc);
create index if not exists idx_talk_posts_film
  on public.talk_posts (film_key, created_at desc) where film_key is not null;
create index if not exists idx_talk_posts_parent on public.talk_posts (parent_id);
create index if not exists idx_talk_posts_author
  on public.talk_posts (author_id, created_at desc);

-- ── guard trigger — thread shape + human write rules ────────────────────────
-- One reply level (replies-to-replies flatten onto the root), address inherited
-- from the thread root, per-author rate limit, links auto-held, 15-minute edit
-- window, author status changes limited to soft delete. service_role
-- (auth.uid() is null) bypasses the human rules but not the shape rules.
create or replace function public.talk_posts_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  root   public.talk_posts%rowtype;
  recent int;
  joined timestamptz;
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      select * into root from public.talk_posts where id = new.parent_id;
      if not found then raise exception 'talk: parent not found'; end if;
      if root.parent_id is not null then
        new.parent_id := root.parent_id;
        select * into root from public.talk_posts where id = new.parent_id;
      end if;
      new.addr_type := root.addr_type;
      new.addr_key  := root.addr_key;
      new.film_key  := root.film_key;
    end if;
    if new.addr_type in ('figure','score') and new.film_key is null then
      raise exception 'talk: figure/score posts need film_key';
    end if;
    if auth.uid() is not null then
      -- human path (RLS already forces author_id = auth.uid(), author_app null)
      select count(*) into recent from public.talk_posts
        where author_id = new.author_id
          and created_at > now() - interval '1 hour';
      select created_at into joined from public.profiles where id = new.author_id;
      if joined > now() - interval '24 hours' and recent >= 2 then
        raise exception 'talk: new accounts are limited to 2 notes per hour';
      end if;
      if recent >= 5 then
        raise exception 'talk: rate limit — 5 notes per hour';
      end if;
      if new.body ~* 'https?://' then
        new.status := 'held';
      end if;
    end if;
  elsif tg_op = 'UPDATE' then
    if auth.uid() is not null then
      if old.author_id is distinct from auth.uid() then
        raise exception 'talk: not yours';
      end if;
      if new.status is distinct from old.status and new.status <> 'deleted' then
        raise exception 'talk: status is managed by the site';
      end if;
      if new.body is distinct from old.body then
        if old.created_at < now() - interval '15 minutes' then
          raise exception 'talk: the edit window is 15 minutes';
        end if;
        new.edited_at := now();
      end if;
      -- freeze everything an author must not move
      new.addr_type  := old.addr_type;
      new.addr_key   := old.addr_key;
      new.film_key   := old.film_key;
      new.refs       := old.refs;
      new.parent_id  := old.parent_id;
      new.author_id  := old.author_id;
      new.author_app := old.author_app;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists talk_posts_guard on public.talk_posts;
create trigger talk_posts_guard
  before insert or update on public.talk_posts
  for each row execute function public.talk_posts_guard();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.talk_posts enable row level security;

drop policy if exists "talk: read published" on public.talk_posts;
create policy "talk: read published" on public.talk_posts for select
  using (status = 'published' or author_id = auth.uid());

drop policy if exists "talk: insert as self" on public.talk_posts;
create policy "talk: insert as self" on public.talk_posts for insert
  with check (
    auth.uid() is not null
    and author_id = auth.uid()
    and author_app is null
    and status in ('published','held')
  );

drop policy if exists "talk: update own" on public.talk_posts;
create policy "talk: update own" on public.talk_posts for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
-- no delete policy: soft delete only (status='deleted'); purge is a service job

-- ── talk_likes — hearts are a human-issued currency (0020 pattern) ──────────
create table if not exists public.talk_likes (
  post_id    uuid not null references public.talk_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.talk_likes enable row level security;
drop policy if exists "talk_likes: rw own" on public.talk_likes;
create policy "talk_likes: rw own" on public.talk_likes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace view public.talk_like_counts as
  select post_id, count(*)::int as likes
  from public.talk_likes group by post_id;
grant select on public.talk_like_counts to anon, authenticated;

-- ── profiles — the public face (§2.6; bio/avatar_url already exist in 0001) ─
alter table public.profiles add column if not exists first_love_key text;
