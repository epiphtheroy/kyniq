-- 0045 — My Room v3 §8 optional RPCs (R1–R8), spec: HANDOFF-마이룸-v3-redesign.md.
-- All auth.uid()-scoped SECURITY DEFINER; no uid parameters (house invariant).
-- Corrections vs the spec sketches: lineage_lists.id is uuid (not bigint);
-- film_locations.country / country_continents.country join on full English
-- names; avail JSON replicates me_recommend_wwi's exact shape (0029:95-99).

-- ── R1. me_dismissed — browse the "Not interested" history (was invisible) ──
create or replace function public.me_dismissed(p_limit int default 50, p_offset int default 0)
returns table(slug text, title text, year int, poster_path text, added_at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select f.slug, f.title, f.year, f.poster_path, um.added_at
  from user_movies um
  join films f on f.id = um.film_id
  where um.user_id = auth.uid() and um.dismissed
  order by um.added_at desc, f.slug
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

-- ── R2. me_undismiss — clean single-call restore (replaces the documented
--        two-call me_set_watchlist(on)→(off) sequence in useRoomActions) ──
create or replace function public.me_undismiss(p_slug text)
returns table(slug text, dismissed boolean)
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
  update user_movies um set dismissed = false
  from films f
  where f.id = um.film_id and um.user_id = auth.uid() and f.slug = p_slug
  returning f.slug, um.dismissed;
end;
$$;
revoke all on function public.me_undismiss(text) from public;
grant execute on function public.me_undismiss(text) to authenticated;

-- ── R3. me_library v2 — poster_path for film/figure pins (Shelf poster cards).
--        Return type gains a column → drop first. Signature stays (); paging
--        continues via PostgREST .range() over the deterministic order. ──
drop function if exists public.me_library();
create function public.me_library()
returns table(entity_type text, slug text, film_slug text, title text, sub text, def text,
              film_count integer, maturity text, prestige numeric, rating numeric,
              seen boolean, fav boolean, visibility text, created_at timestamptz,
              poster_path text)
language sql stable security definer
set search_path = public
as $$
  with pins as (
    select
      p.entity_type,
      p.entity_id,
      bool_or(p.kind = 'like') as fav,
      bool_or(p.visibility = 'public') as pub,
      max(p.created_at)        as created_at
    from user_pins p
    where p.user_id = auth.uid()
    group by p.entity_type, p.entity_id
  )
  select
    case
      when pn.entity_type = 'film' then 'film'
      when pn.entity_type = 'figure' then 'figure'
      when pn.entity_type = 'meta_take' and m.kind = 'figure_type' then 'trope'
      when pn.entity_type = 'meta_take' then 'misreading'
      else pn.entity_type
    end as entity_type,
    case pn.entity_type
      when 'film' then f.slug
      when 'meta_take' then m.slug
      when 'figure' then fig.slug
    end as slug,
    case pn.entity_type when 'figure' then ff.slug end as film_slug,
    case pn.entity_type
      when 'film' then f.title
      when 'meta_take' then m.title
      when 'figure' then fig.label
    end as title,
    case pn.entity_type
      when 'film' then f.year::text
      when 'meta_take' then m.laconic
      when 'figure' then ff.title
    end as sub,
    case pn.entity_type
      when 'meta_take' then coalesce(m.thesis, m.laconic)
      when 'figure' then fig.description
    end as def,
    case pn.entity_type
      when 'meta_take' then m.film_count
      when 'figure' then 1
    end as film_count,
    case pn.entity_type when 'meta_take' then m.maturity end as maturity,
    fs.prestige_score as prestige,
    um.rating,
    um.seen,
    pn.fav,
    case when pn.pub then 'public' else 'private' end as visibility,
    pn.created_at,
    case pn.entity_type
      when 'film' then f.poster_path
      when 'figure' then ff.poster_path
    end as poster_path
  from pins pn
  left join films f        on pn.entity_type='film'      and f.id  = pn.entity_id
  left join user_movies um on pn.entity_type='film'      and um.film_id = pn.entity_id and um.user_id = auth.uid()
  left join film_scores fs on pn.entity_type='film'      and fs.film_id = pn.entity_id
  left join meta_takes m   on pn.entity_type='meta_take' and m.id   = pn.entity_id
  left join figures fig    on pn.entity_type='figure'    and fig.id = pn.entity_id
  left join films ff       on pn.entity_type='figure'    and ff.id  = fig.film_id
  order by pn.created_at desc, pn.entity_type, pn.entity_id;
$$;

-- ── R4. me_lineage_candidates — the precise "Fill this gap": unseen members
--        of one lineage, best standing first (Coverage inspector). ──
create or replace function public.me_lineage_candidates(p_list_id uuid, p_limit int default 8)
returns table(slug text, title text, year int, poster_path text, director text, prestige numeric)
language sql stable security definer
set search_path = public
as $$
  select f.slug, f.title, f.year, f.poster_path, f.director, fs.prestige_score
  from film_lineage fl
  join films f on f.id = fl.film_id and f.visible
  left join film_scores fs on fs.film_id = fl.film_id
  where fl.list_id = p_list_id
    and not exists (select 1 from user_movies um
                    where um.user_id = auth.uid() and um.film_id = fl.film_id and um.seen)
  group by f.id, f.slug, f.title, f.year, f.poster_path, f.director, fs.prestige_score
  order by fs.prestige_score desc nulls last, f.slug
  limit greatest(p_limit, 1);
$$;

-- ── R5a. me_unpin — remove every pin row for an entity (Shelf Unpin). ──
create or replace function public.me_unpin(p_entity_type text, p_slug text)
returns table(slug text, pinned boolean)
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_type text; v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select o_type, o_id into v_type, v_id from public._pin_entity_id(p_entity_type, p_slug);
  delete from user_pins where user_id = v_uid and entity_type = v_type and entity_id = v_id;
  return query select p_slug, false;
end;
$$;
revoke all on function public.me_unpin(text, text) from public;
grant execute on function public.me_unpin(text, text) to authenticated;

-- ── R5b. delete_take — hard delete of my own human take (Takes screen).
--        Archive (unpublish) remains the soft path via save_take. ──
create or replace function public.delete_take(p_take_id uuid)
returns table(take_id uuid)
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
  delete from takes t
  where t.id = p_take_id and t.author_id = auth.uid() and t.source = 'human'
  returning t.id;
end;
$$;
revoke all on function public.delete_take(uuid) from public;
grant execute on function public.delete_take(uuid) to authenticated;

-- ── R6. me_watchlist_scored v2 — attach the KR-flatrate avail JSON exactly as
--        me_recommend_wwi builds it (0029), so the Slate can say "streaming
--        now" honestly. Return type gains a column → drop first. ──
drop function if exists public.me_watchlist_scored();
create function public.me_watchlist_scored()
returns table(slug text, title text, year integer, poster_path text, director text,
              rating numeric, added_at timestamptz, v numeric, c numeric, r numeric,
              avail json)
language sql stable security definer
set search_path to public, cinecodex
as $$
  with best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.c_cost, s.r_risk
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  )
  select f.slug, f.title, f.year, f.poster_path, f.director,
         um.rating, um.added_at,
         round(b.v_value,1) v, round(b.c_cost,1) c, round(b.r_risk,1) r,
         (select case
            when jsonb_typeof(wp.results #> '{KR,flatrate}') = 'array' and jsonb_array_length(wp.results #> '{KR,flatrate}') > 0
              then json_build_object('state','on','provider', wp.results #>> '{KR,flatrate,0,provider_name}')
            else json_build_object('state','unk') end
          from film_watch_providers wp where wp.film_id = um.film_id) avail
  from user_movies um
  join films f on f.id = um.film_id
  left join best b on b.film_id = um.film_id
  where um.user_id = auth.uid() and um.watchlist = true
  order by um.added_at desc, f.slug;
$$;

-- ── R7. me_geo_gap_candidates — best unseen films located in a blind
--        continent (Atlas blind-continent card gets a door). ──
create or replace function public.me_geo_gap_candidates(p_continent text, p_limit int default 8)
returns table(slug text, title text, year int, poster_path text, director text,
              prestige numeric, country text)
language sql stable security definer
set search_path = public
as $$
  select f.slug, f.title, f.year, f.poster_path, f.director,
         fs.prestige_score, min(fl.country) as country
  from film_locations fl
  join country_continents cc on cc.country = fl.country and cc.continent = p_continent
  join films f on f.id = fl.film_id and f.visible
  left join film_scores fs on fs.film_id = fl.film_id
  where not exists (select 1 from user_movies um
                    where um.user_id = auth.uid() and um.film_id = fl.film_id and um.seen)
  group by f.id, f.slug, f.title, f.year, f.poster_path, f.director, fs.prestige_score
  order by fs.prestige_score desc nulls last, f.slug
  limit greatest(p_limit, 1);
$$;

-- ── R8. me_takes_stats — header counts without paging the whole list. ──
create or replace function public.me_takes_stats()
returns table(published int, drafts int, upvotes int)
language sql stable security definer
set search_path = public
as $$
  select count(*) filter (where status = 'published')::int,
         count(*) filter (where status <> 'published')::int,
         coalesce(sum(upvotes), 0)::int
  from takes
  where author_id = auth.uid() and source = 'human';
$$;
