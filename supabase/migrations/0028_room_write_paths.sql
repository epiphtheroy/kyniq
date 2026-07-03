-- 0028 — /room 쓰기(write) 경로 배선 (ROOM-HANDOVER-MASTER §8 P0-4, P1-8)
-- 현재 담기/봤어요/관심없음/서재 공개토글/노트가 전부 로컬 세션 상태(새로고침 소실)인 것을
-- auth.uid() 스코프 SECURITY DEFINER mutation RPC로 영구화한다. 전부 additive:
--   user_movies.dismissed(관심없음) · user_pins.visibility(서재 공개토글) 컬럼 신설,
--   takes.figure_id NOT NULL 완화(자유글 human take 저장 허용 — 기존 행·조인 무영향).

alter table public.user_movies
  add column if not exists dismissed boolean not null default false;

alter table public.user_pins
  add column if not exists visibility text not null default 'private'
  check (visibility in ('private','public'));

alter table public.takes alter column figure_id drop not null;

-- ── 담기 = 워치리스트 추가/해제 (S8: 제자리 마킹, 이동 없음) ──
create or replace function public.me_set_watchlist(p_slug text, p_on boolean default true)
returns table(slug text, watchlist boolean)
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_film uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select id into v_film from films f where f.slug = p_slug;
  if v_film is null then raise exception 'film not found: %', p_slug; end if;
  insert into user_movies (user_id, film_id, watchlist, added_at)
  values (v_uid, v_film, p_on, now())
  on conflict (user_id, film_id) do update
    set watchlist = excluded.watchlist,
        dismissed = case when excluded.watchlist then false else user_movies.dismissed end,
        added_at = now();
  return query select p_slug, p_on;
end;
$$;

-- ── 봤어요 (평점 없이 관람 기록; NAV 스냅샷 적재는 0030에서 rate_film과 함께 배선) ──
create or replace function public.me_mark_seen(p_slug text)
returns table(slug text, seen boolean)
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_film uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select id into v_film from films f where f.slug = p_slug;
  if v_film is null then raise exception 'film not found: %', p_slug; end if;
  insert into user_movies (user_id, film_id, seen, watched_at, added_at)
  values (v_uid, v_film, true, current_date, now())
  on conflict (user_id, film_id) do update
    set seen = true,
        watched_at = coalesce(user_movies.watched_at, current_date),
        dismissed = false;
  return query select p_slug, true;
end;
$$;

-- ── 관심없음 (추천 후보에서 영구 제외; 워치리스트에서도 내림) ──
create or replace function public.me_dismiss(p_slug text)
returns table(slug text, dismissed boolean)
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_film uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select id into v_film from films f where f.slug = p_slug;
  if v_film is null then raise exception 'film not found: %', p_slug; end if;
  insert into user_movies (user_id, film_id, dismissed, watchlist, added_at)
  values (v_uid, v_film, true, false, now())
  on conflict (user_id, film_id) do update
    set dismissed = true, watchlist = false;
  return query select p_slug, true;
end;
$$;

-- ── 서재: 엔티티 slug → user_pins 해석 헬퍼 (film/meta_take(trope·misreading)/figure) ──
create or replace function public._pin_entity_id(p_entity_type text, p_slug text, out o_type text, out o_id uuid)
language plpgsql stable security definer
set search_path = public
as $$
begin
  o_type := case
    when p_entity_type in ('trope','misreading','meta_take') then 'meta_take'
    when p_entity_type in ('film','figure','take') then p_entity_type
    else null end;
  if o_type is null then raise exception 'unsupported entity_type: %', p_entity_type; end if;
  if o_type = 'film' then select id into o_id from films where films.slug = p_slug;
  elsif o_type = 'meta_take' then select id into o_id from meta_takes where meta_takes.slug = p_slug;
  elsif o_type = 'figure' then select id into o_id from figures where figures.slug = p_slug limit 1;
  end if;
  if o_id is null then raise exception 'entity not found: % %', p_entity_type, p_slug; end if;
end;
$$;

-- ── 서재 공개토글 (S9) — 해당 엔티티의 내 핀 전부에 적용 ──
create or replace function public.set_pin_visibility(p_entity_type text, p_slug text, p_public boolean)
returns table(slug text, visibility text)
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_type text; v_id uuid; v_vis text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select o_type, o_id into v_type, v_id from public._pin_entity_id(p_entity_type, p_slug);
  v_vis := case when p_public then 'public' else 'private' end;
  update user_pins set visibility = v_vis
  where user_id = v_uid and entity_type = v_type and entity_id = v_id;
  if not found then raise exception 'pin not found: % %', p_entity_type, p_slug; end if;
  return query select p_slug, v_vis;
end;
$$;

-- ── 서재 즐겨찾기 토글 (kind='like' 핀 생성/삭제) ──
create or replace function public.me_toggle_fav(p_entity_type text, p_slug text)
returns table(slug text, fav boolean)
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_type text; v_id uuid; v_vis text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select o_type, o_id into v_type, v_id from public._pin_entity_id(p_entity_type, p_slug);
  if exists (select 1 from user_pins where user_id = v_uid and entity_type = v_type and entity_id = v_id and kind = 'like') then
    delete from user_pins where user_id = v_uid and entity_type = v_type and entity_id = v_id and kind = 'like';
    return query select p_slug, false;
  else
    select up.visibility into v_vis from user_pins up
    where up.user_id = v_uid and up.entity_type = v_type and up.entity_id = v_id limit 1;
    insert into user_pins (user_id, entity_type, entity_id, kind, visibility)
    values (v_uid, v_type, v_id, 'like', coalesce(v_vis, 'private'))
    on conflict do nothing;
    return query select p_slug, true;
  end if;
end;
$$;

-- ── HTML 화이트리스트 새니타이저 (노트 게시용 — 서버측 강제, 프론트 신뢰 금지) ──
-- 허용: b i em strong u h2 h3 blockquote p br ul ol li + a[href=http(s)].
-- 방식: 플레이스홀더 보호 → 위험블록 제거 → 완결 태그 전부 제거 → 잔여 <> 이스케이프 → 복원.
create or replace function public.sanitize_user_html(p_html text)
returns text
language plpgsql immutable
as $$
declare t text := p_html;
begin
  if t is null then return null; end if;
  -- 입력에 섞인 플레이스홀더 제어문자 제거(주입 방지)
  t := replace(replace(t, chr(1), ''), chr(2), '');
  -- 주석·위험 블록(내용 포함) 제거
  t := regexp_replace(t, '<!--.*?-->', '', 'g');
  t := regexp_replace(t, '<(script|style|iframe|object|embed|form|svg|math)[^>]*>.*?</\1[^>]*>', '', 'gi');
  t := regexp_replace(t, '</?(script|style|iframe|object|embed|form|svg|math)[^>]*>', '', 'gi');
  -- 허용 태그 → 플레이스홀더(속성 전부 폐기)
  t := regexp_replace(t, '<(/?)(b|i|em|strong|u|h2|h3|blockquote|p|br|ul|ol|li)(\s[^>]*)?/?\s*>',
                      chr(1) || '\1\2' || chr(2), 'gi');
  -- 앵커: http(s) href만 보존
  t := regexp_replace(t, '<a\s[^>]*href\s*=\s*"(https?://[^"<>]*)"[^>]*>',
                      chr(1) || 'a href="\1" rel="nofollow noopener" target="_blank"' || chr(2), 'gi');
  t := regexp_replace(t, '</a[^>]*>', chr(1) || '/a' || chr(2), 'gi');
  -- 남은 완결 태그 전부 제거 → 잔여 홑 <, > 이스케이프(불완전 태그 무력화)
  t := regexp_replace(t, '<[^>]*>', '', 'g');
  t := replace(replace(t, '<', '&lt;'), '>', '&gt;');
  -- 플레이스홀더 복원
  t := replace(replace(t, chr(1), '<'), chr(2), '>');
  return t;
end;
$$;

-- ── 노트 저장/게시 (author_id=auth.uid() · source='human' 강제, RLS 정합) ──
create or replace function public.save_take(
  p_take_id uuid default null,
  p_title text default null,
  p_body_html text default null,
  p_framework text default null,
  p_publish boolean default false
)
returns table(take_id uuid, status text)
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_body text; v_status text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_body := public.sanitize_user_html(p_body_html);
  if v_body is not null and length(v_body) > 60000 then raise exception 'body too long'; end if;
  v_status := case when p_publish then 'published' else 'draft' end;
  if p_take_id is not null then
    update takes set take_title = nullif(p_title, ''),
                     rationale  = v_body,
                     framework  = nullif(p_framework, ''),
                     status     = v_status
    where id = p_take_id and author_id = v_uid and source = 'human'
    returning id into v_id;
    if v_id is null then raise exception 'take not found or not yours'; end if;
  else
    insert into takes (figure_id, rationale, take_title, framework, status, source, author_id)
    values (null, v_body, nullif(p_title, ''), nullif(p_framework, ''), v_status, 'human', v_uid)
    returning id into v_id;
  end if;
  return query select v_id, v_status;
end;
$$;

-- ── me_library 재생성: visibility 반환 추가(반환 타입 변경 → drop 필요) ──
drop function if exists public.me_library();

create function public.me_library()
returns table(entity_type text, slug text, film_slug text, title text, sub text, def text,
              film_count integer, maturity text, prestige numeric, rating numeric,
              seen boolean, fav boolean, visibility text, created_at timestamp with time zone)
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
    pn.created_at
  from pins pn
  left join films f        on pn.entity_type='film'      and f.id  = pn.entity_id
  left join user_movies um on pn.entity_type='film'      and um.film_id = pn.entity_id and um.user_id = auth.uid()
  left join film_scores fs on pn.entity_type='film'      and fs.film_id = pn.entity_id
  left join meta_takes m   on pn.entity_type='meta_take' and m.id   = pn.entity_id
  left join figures fig    on pn.entity_type='figure'    and fig.id = pn.entity_id
  left join films ff       on pn.entity_type='figure'    and ff.id  = fig.film_id
  order by pn.created_at desc;
$$;

-- (추가 적용 2026-07-03) advisor WARN 해소 — sanitize_user_html search_path 고정
alter function public.sanitize_user_html(text) set search_path = public;
