-- 0059_tv_read_policies.sql — public read for compiled broadcasts.
-- The tv_* tables were created with RLS ENABLED but NO policies, so anon SELECT
-- returned zero rows. The tv_watch RPC (security definer) was unaffected and the
-- /tv/watch surfaces worked, but direct anon reads silently failed:
--   • film page: filmHasProgram() probe → false → no TV hero / no "TV Broadcast" tab
--   • /tv/[slug]: built_at lookup → null → VideoObject had no uploadDate
-- Expose ONLY public content for SELECT. No write policies are added, so the
-- default anon INSERT/UPDATE/DELETE grants stay blocked by RLS (deny-by-default).
alter table public.tv_programs enable row level security;
drop policy if exists tv_programs_read on public.tv_programs;
create policy tv_programs_read on public.tv_programs for select using (status = 'published');

alter table public.tv_segments enable row level security;
drop policy if exists tv_segments_read on public.tv_segments;
create policy tv_segments_read on public.tv_segments for select using (true);

alter table public.tv_playlists enable row level security;
drop policy if exists tv_playlists_read on public.tv_playlists;
create policy tv_playlists_read on public.tv_playlists for select using (true);

alter table public.tv_playlist_items enable row level security;
drop policy if exists tv_playlist_items_read on public.tv_playlist_items;
create policy tv_playlist_items_read on public.tv_playlist_items for select using (true);
