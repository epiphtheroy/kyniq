-- 0113: The Navigator — resume wiring (HANDOFF §8/§9 P5-③). Builds on 0112_nav_drives.
-- Adds a cached dest_label (so the "Resume" card names the destination without a lookup)
-- and the two writer RPCs. INVARIANT (§10-1) still holds: only WHICH destination + pref
-- (+ optional skipped) are stored — never the chevron position or progress, which stay
-- derived from user_movies ∩ destination. Additive + idempotent.

alter table public.nav_drives add column if not exists dest_label text;

-- Start / touch the single active drive. One active row per member (partial unique index
-- nav_drives_one_active): repoint it to this destination on a switch, keep started_at when
-- it's the same destination. SECURITY DEFINER + scoped to auth.uid().
create or replace function public.me_nav_start(
  p_dest_kind text, p_dest_key text, p_dest_label text, p_route_pref text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.nav_drives (user_id, dest_kind, dest_key, dest_label, route_pref)
  values (auth.uid(), p_dest_kind, p_dest_key, p_dest_label, coalesce(nullif(p_route_pref, ''), 'fewest'))
  on conflict (user_id) where arrived_at is null
  do update set
    started_at = case
      when public.nav_drives.dest_kind = excluded.dest_kind and public.nav_drives.dest_key = excluded.dest_key
      then public.nav_drives.started_at else now() end,
    dest_kind  = excluded.dest_kind,
    dest_key   = excluded.dest_key,
    dest_label = excluded.dest_label,
    route_pref = excluded.route_pref;
end;
$$;

-- Mark the active drive for this destination arrived (drops it out of "Resume"). Idempotent.
create or replace function public.me_nav_arrive(p_dest_kind text, p_dest_key text)
returns void
language sql security definer set search_path = public
as $$
  update public.nav_drives set arrived_at = now()
  where user_id = auth.uid() and arrived_at is null
    and dest_kind = p_dest_kind and dest_key = p_dest_key;
$$;

-- me_nav_active now also returns dest_label so the caller can build the Resume card + link.
-- Return type changes (5→6 OUT cols) require a drop first; nothing calls it yet (inert since 0112).
drop function if exists public.me_nav_active();
create or replace function public.me_nav_active()
returns table (
  dest_kind text, dest_key text, dest_label text, route_pref text, started_at timestamptz, skipped jsonb
)
language sql security definer set search_path = public stable
as $$
  select dest_kind, dest_key, dest_label, route_pref, started_at, skipped
  from public.nav_drives
  where user_id = auth.uid() and arrived_at is null
  order by started_at desc
  limit 1;
$$;

revoke all on function public.me_nav_start(text, text, text, text) from public;
revoke execute on function public.me_nav_start(text, text, text, text) from anon;
grant  execute on function public.me_nav_start(text, text, text, text) to authenticated;

revoke all on function public.me_nav_arrive(text, text) from public;
revoke execute on function public.me_nav_arrive(text, text) from anon;
grant  execute on function public.me_nav_arrive(text, text) to authenticated;

revoke execute on function public.me_nav_active() from anon;
grant  execute on function public.me_nav_active() to authenticated;
