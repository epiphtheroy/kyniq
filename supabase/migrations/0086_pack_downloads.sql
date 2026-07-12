-- 0086_pack_downloads.sql — 로그인 사용자의 팩 다운로드 원장 + 월 쿼터 (데이터 상품 W1.5)
-- 정본: HANDOFF-컨텍스트팩-실행.md §7. 다운로드(.md 파일)만 로그인+월10 게이트;
-- 복사(클립보드)는 무료(§오너결정: 게이트=편의, 콘텐츠 아님).

create table if not exists public.pack_downloads (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  film_id    uuid not null references public.films(id) on delete cascade,
  slug       text not null,
  sections   text[] not null default '{}',
  fmt        text not null default 'md',
  created_at timestamptz not null default now()
);
create index if not exists pack_downloads_user_month on public.pack_downloads (user_id, created_at desc);

alter table public.pack_downloads enable row level security;

-- 본인 다운로드만 조회(/room/packs). 삽입은 service_role(다운로드 라우트) 전용 — insert 정책 없음.
drop policy if exists pack_downloads_own_select on public.pack_downloads;
create policy pack_downloads_own_select on public.pack_downloads
  for select using (auth.uid() = user_id);

-- 이번 달(달력 월) 다운로드한 '서로 다른 영화' 수. 같은 영화 재다운로드는 쿼터 미차감(관대·단순).
create or replace function public.pack_downloads_this_month(p_user uuid)
returns int
language sql stable security definer set search_path to 'public'
set statement_timeout to '6s' as $$
  select count(distinct film_id)::int
  from public.pack_downloads
  where user_id = p_user and created_at >= date_trunc('month', now());
$$;
-- ⚠️ Supabase auto-grants EXECUTE on new functions to anon/authenticated via default
-- privileges, so revoking from PUBLIC alone leaves those. Revoke explicitly: only the
-- download route (service_role) may read another user's count. /room/packs derives its
-- own quota from RLS'd rows, so authenticated does not need this.
revoke execute on function public.pack_downloads_this_month(uuid) from public, anon, authenticated;
grant  execute on function public.pack_downloads_this_month(uuid) to service_role;

-- 이번 달 특정 영화를 이미 받았는지(재다운로드 무료 판정용).
create or replace function public.pack_downloaded_film_this_month(p_user uuid, p_film uuid)
returns boolean
language sql stable security definer set search_path to 'public'
set statement_timeout to '6s' as $$
  select exists(
    select 1 from public.pack_downloads
    where user_id = p_user and film_id = p_film and created_at >= date_trunc('month', now())
  );
$$;
revoke execute on function public.pack_downloaded_film_this_month(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.pack_downloaded_film_this_month(uuid, uuid) to service_role;
