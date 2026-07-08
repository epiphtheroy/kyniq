-- 0051: Now Playing v3 — the editor's-letter format. The dateline (region ·
-- date of the NEWS, not of our publish) leads every piece: speed made visible.

alter table public.now_articles
  add column if not exists dateline text;
