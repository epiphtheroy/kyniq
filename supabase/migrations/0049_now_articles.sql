-- 0049: Now Playing (/now) — the live layer.
-- One row = one trend-chased, data-deep piece anchored on a corpus entity.
-- Written by the pipeline (service role); public reads published rows only.

create table if not exists public.now_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  headline text not null,
  dek text,
  summary text,                                   -- bolded one-line thesis
  keyword text,                                   -- the trending query chased
  lane text not null default 'direct'
    check (lane in ('direct','adjacent','exception')),
  anchor_type text not null
    check (anchor_type in ('film','person','theorist')),
  anchor_slug text,
  anchor_label text not null,
  film_slug text,                                 -- primary film link
  facts_html text not null,                       -- The facts (verified, sourced)
  reading_html text not null,                     -- The reading
  bottom_html text,                               -- Bottom line
  deposit text,                                   -- "In Metatake:" line
  modules jsonb not null default '[]'::jsonb,     -- data layer: [{type,title,columns?,rows?,items?}]
  sources jsonb not null default '[]'::jsonb,     -- [{outlet,title,url}]
  scores jsonb,                                   -- selection rubric snapshot
  status text not null default 'published'
    check (status in ('published','pulled')),
  update_note text,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists now_articles_pub_idx
  on public.now_articles (status, published_at desc);

alter table public.now_articles enable row level security;

drop policy if exists now_articles_public_read on public.now_articles;
create policy now_articles_public_read
  on public.now_articles for select
  using (status = 'published');
