-- 0044 — me_toggle_fav reports whether the entity is still pinned after the
-- toggle. Unfavoriting deletes the kind='like' row; for a like-only pin that
-- was the entity's last user_pins row, so me_library() stops returning it. The
-- Shelf needs still_pinned to drop the card honestly instead of resurrecting a
-- ghost until reload. Return type changes → drop first (single caller:
-- components/room/ShelfWorkspace.tsx).
drop function if exists public.me_toggle_fav(text, text);
create function public.me_toggle_fav(p_entity_type text, p_slug text)
returns table(slug text, fav boolean, still_pinned boolean)
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_type text; v_id uuid; v_vis text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select o_type, o_id into v_type, v_id from public._pin_entity_id(p_entity_type, p_slug);
  if exists (select 1 from user_pins where user_id = v_uid and entity_type = v_type and entity_id = v_id and kind = 'like') then
    delete from user_pins where user_id = v_uid and entity_type = v_type and entity_id = v_id and kind = 'like';
    return query select p_slug, false,
      exists (select 1 from user_pins where user_id = v_uid and entity_type = v_type and entity_id = v_id);
  else
    select up.visibility into v_vis from user_pins up
    where up.user_id = v_uid and up.entity_type = v_type and up.entity_id = v_id limit 1;
    insert into user_pins (user_id, entity_type, entity_id, kind, visibility)
    values (v_uid, v_type, v_id, 'like', coalesce(v_vis, 'private'))
    on conflict do nothing;
    return query select p_slug, true, true;
  end if;
end;
$$;

revoke all on function public.me_toggle_fav(text, text) from public;
grant execute on function public.me_toggle_fav(text, text) to authenticated;
