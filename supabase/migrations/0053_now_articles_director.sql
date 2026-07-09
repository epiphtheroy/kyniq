-- 0053: carry the director slug on Now Playing pieces so a film-anchored piece
-- also surfaces under its director's "In the news" module.
alter table public.now_articles add column if not exists director_slug text;
create index if not exists now_articles_director_idx on public.now_articles (director_slug, published_at desc);
