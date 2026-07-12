-- 0087_pack_download_claim.sql — 다운로드 쿼터를 원자적으로 청구 (경합 방지 + 재다운로드 무료)
-- 정본: HANDOFF-컨텍스트팩-실행.md §7. 리뷰 확정 2건 수정:
--   ① TOCTOU 경합(동시 요청이 10/월 상한 초과) → 사용자별 advisory lock으로 직렬화.
--   ② 재다운로드 무료를 '이번 달'이 아니라 '전 기간(ever)'으로 → 라이브러리의 "항상 무료" 약속과 일치.
-- 쿼터는 '이번 달에 처음 받은 서로 다른 영화' 수만 센다(재다운로드는 미차감).

-- 이번 달 '신규' 영화 수: 그 영화의 최초 다운로드가 이번 달인 것만.
create or replace function public.pack_new_films_this_month(p_user uuid)
returns int
language sql stable security definer set search_path to 'public'
set statement_timeout to '6s' as $$
  select count(*)::int from (
    select film_id from public.pack_downloads
    where user_id = p_user
    group by film_id
    having min(created_at) >= date_trunc('month', now())
  ) s;
$$;
revoke execute on function public.pack_new_films_this_month(uuid) from public, anon, authenticated;
grant  execute on function public.pack_new_films_this_month(uuid) to service_role;

-- 이 사용자가 이 영화를 (전 기간) 받은 적이 있는가 → 재다운로드 무료 판정.
create or replace function public.pack_downloaded_film_ever(p_user uuid, p_film uuid)
returns boolean
language sql stable security definer set search_path to 'public'
set statement_timeout to '6s' as $$
  select exists(select 1 from public.pack_downloads where user_id = p_user and film_id = p_film);
$$;
revoke execute on function public.pack_downloaded_film_ever(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.pack_downloaded_film_ever(uuid, uuid) to service_role;

-- 원자적 청구: 한 사용자의 동시 요청을 advisory lock으로 직렬화하고, 신규 영화가
-- 상한(10) 미만일 때만 원장에 기록한다. 이미 받은 영화(ever)는 무료로 통과.
-- 반환: true=허용(기록됨) / false=상한 초과(미기록).
create or replace function public.pack_download_claim(
  p_user uuid, p_film uuid, p_slug text, p_sections text[], p_fmt text)
returns boolean
language plpgsql security definer set search_path to 'public'
set statement_timeout to '8s' as $$
declare v_ever boolean; v_cnt int;
begin
  perform pg_advisory_xact_lock(hashtext('pack_dl:' || p_user::text));
  select exists(select 1 from public.pack_downloads where user_id = p_user and film_id = p_film) into v_ever;
  if not v_ever then
    select count(*) into v_cnt from (
      select film_id from public.pack_downloads
      where user_id = p_user
      group by film_id
      having min(created_at) >= date_trunc('month', now())
    ) s;
    if v_cnt >= 10 then
      return false;
    end if;
  end if;
  insert into public.pack_downloads(user_id, film_id, slug, sections, fmt)
    values (p_user, p_film, p_slug, coalesce(p_sections, '{}'), coalesce(p_fmt, 'md'));
  return true;
end $$;
revoke execute on function public.pack_download_claim(uuid, uuid, text, text[], text) from public, anon, authenticated;
grant  execute on function public.pack_download_claim(uuid, uuid, text, text[], text) to service_role;

-- 구 함수 정리(미사용 — 라우트/룸은 위 함수 + RLS 행으로 대체).
drop function if exists public.pack_downloads_this_month(uuid);
drop function if exists public.pack_downloaded_film_this_month(uuid, uuid);
