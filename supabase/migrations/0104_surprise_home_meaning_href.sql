-- 0104 — surprise_home: point the misreadings_teaser card at the renamed route
-- /film/[slug]/misreadings -> /film/meaning/[slug] (route moved 2026-07-16).
--
-- The old path still 308-redirects, so this is purely to avoid a redirect hop on
-- a hot home-page surface. Rather than re-emit the whole ~200-line SECURITY
-- DEFINER body (transcription risk), we patch the live definition in place: read
-- the current source, replace the single misreadings href, and re-create. This
-- is replay-safe — on a fresh DB the function carries the old href (migration
-- 0055) at this point, so the replace applies; if it were ever already renamed,
-- the replace is a harmless no-op.
do $$
declare src text;
begin
  src := pg_get_functiondef('public.surprise_home()'::regprocedure);
  src := replace(
    src,
    '''/film/''||f.slug||''/misreadings''',  -- 'href','/film/'||f.slug||'/misreadings'
    '''/film/meaning/''||f.slug'             -- 'href','/film/meaning/'||f.slug
  );
  execute src;
end $$;
