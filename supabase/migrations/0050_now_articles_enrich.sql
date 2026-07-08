-- 0050: Now Playing enrichment — a hero image, the editor's cutting-room floor,
-- and a collected block of the anchor's other pages in the archive.

alter table public.now_articles
  add column if not exists image_path text,          -- TMDB backdrop/poster path of the anchor film
  add column if not exists image_alt text,
  add column if not exists cut_floor jsonb not null default '[]'::jsonb,   -- [{keyword,url,comment}]
  add column if not exists archive_links jsonb not null default '[]'::jsonb; -- [{label,href,note}]
