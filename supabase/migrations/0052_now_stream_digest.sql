-- 0052: Now Playing — the wire we watched (hourly reviewed candidates) and
-- the daily digest. Stream rows accumulate under films/directors ("In the
-- news"); the digest is the day's editor note over the stream.

create table if not exists public.now_stream (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  keyword text not null,
  title text,                    -- best news headline we saw
  url text,                      -- source article
  outlet text,
  region text,
  news_date text,                -- the story's reported date (not our clock)
  anchor_type text,
  anchor_slug text,
  anchor_label text,
  film_slug text,                -- for the film page module
  director_slug text,            -- for the director page module
  scores jsonb,
  value_point text,              -- editor's one line: why this was worth watching
  related_links jsonb not null default '[]'::jsonb,  -- [{label,href,note}]
  published boolean not null default false,
  piece_slug text,               -- when it became a Now Playing piece
  created_at timestamptz not null default now()
);
create index if not exists now_stream_at_idx on public.now_stream (at desc);
create index if not exists now_stream_film_idx on public.now_stream (film_slug, at desc);
create index if not exists now_stream_dir_idx on public.now_stream (director_slug, at desc);

alter table public.now_stream enable row level security;
drop policy if exists now_stream_public_read on public.now_stream;
create policy now_stream_public_read on public.now_stream for select using (true);

create table if not exists public.now_digests (
  id uuid primary key default gen_random_uuid(),
  digest_date date not null unique,
  headline text not null,
  dek text,
  intro_html text not null,      -- the editor's note over the day
  items jsonb not null default '[]'::jsonb,  -- assembled from now_stream
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.now_digests enable row level security;
drop policy if exists now_digests_public_read on public.now_digests;
create policy now_digests_public_read on public.now_digests for select using (true);
