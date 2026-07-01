-- ============================================================
-- MetaTake — 계보(Lineage) 레이어 마이그레이션
-- 프로젝트: kyniq (jvgarcqrtsmgfimdcwgo)
-- 원칙: 기존 컬럼/값 불변. 신규 테이블 + film_affinities 에 additive nullable 컬럼만.
-- 안전: 적용 전 staging/branch 에서 먼저 검증 권장.
-- ============================================================

-- 0) 확장 (이미 사용 중이면 무시됨)
create extension if not exists pgcrypto;   -- gen_random_uuid()
-- create extension if not exists vector;  -- 이미 활성. embedding 사용 시 필요.

-- ============================================================
-- 1) lineage_lists : 계보 어휘 (정전/수상/영화제/사조/국가/시대)
-- ============================================================
create table if not exists public.lineage_lists (
  id               uuid primary key default gen_random_uuid(),
  facet            text not null
                   check (facet in ('canon','award','festival','movement','national','era')),
  slug             text not null unique,
  label            text not null,
  label_ko         text,
  parent_id        uuid references public.lineage_lists(id) on delete set null,
  authority_weight numeric,                      -- 0~1, 수작업 튜닝
  selectivity      numeric,                      -- 파생(IDF), 적재 후 계산
  film_count       integer default 0,            -- 파생
  external_ref     jsonb  not null default '{}', -- {"wikidata":"Q...","url":"..."}
  source           text,                         -- 'tspdt' | 'wikidata' | 'bfi' ...
  description      text,
  -- embedding     vector,                       -- optional: 차원을 기존 모델에 맞춰 활성화
  status           text not null default 'active',
  merged_into      uuid references public.lineage_lists(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists lineage_lists_facet_idx  on public.lineage_lists(facet);
create index if not exists lineage_lists_parent_idx on public.lineage_lists(parent_id);

-- ============================================================
-- 2) film_lineage : 영화 ↔ 리스트 (별자리 직물)
-- ============================================================
create table if not exists public.film_lineage (
  film_id    uuid not null references public.films(id)         on delete cascade,
  list_id    uuid not null references public.lineage_lists(id) on delete cascade,
  facet      text not null,                 -- 비정규화 (빠른 필터)
  value      jsonb not null default '{}',   -- canon:{"rank":5} award:{"result":"won","year":2019} ...
  confidence numeric,
  source     text,
  created_at timestamptz not null default now(),
  primary key (film_id, list_id)
);

create index if not exists film_lineage_list_idx  on public.film_lineage(list_id);
create index if not exists film_lineage_facet_idx on public.film_lineage(facet);
create index if not exists film_lineage_film_idx  on public.film_lineage(film_id);

-- ============================================================
-- 3) lineage_list_aliases : 리스트 별칭 (선택)
-- ============================================================
create table if not exists public.lineage_list_aliases (
  alias      text primary key,
  list_id    uuid not null references public.lineage_lists(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4) lineage_sources : 공개 크레딧용 출처 메타 (선택)
-- ============================================================
create table if not exists public.lineage_sources (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  url            text,
  type           text,   -- aggregator | structured_db | api | official_archive | community
  license        text,
  access         text,
  cadence        text,
  credit_string  text,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- 5) film_affinities 확장 (ADDITIVE ONLY — 기존 컬럼 불변)
-- ============================================================
alter table public.film_affinities
  add column if not exists shared_list_ids uuid[],
  add column if not exists lineage_score   numeric;

create index if not exists film_affinities_shared_list_ids_idx
  on public.film_affinities using gin (shared_list_ids);

-- ============================================================
-- 6) RLS (기존 테이블이 모두 RLS 사용 중 → 동일 정책)
--    공개 읽기 허용, 쓰기는 service_role 만(정책 없음 = 차단, service_role 은 RLS 우회)
-- ============================================================
alter table public.lineage_lists        enable row level security;
alter table public.film_lineage         enable row level security;
alter table public.lineage_list_aliases enable row level security;
alter table public.lineage_sources      enable row level security;

create policy "public read lineage_lists"
  on public.lineage_lists for select using (true);
create policy "public read film_lineage"
  on public.film_lineage for select using (true);
create policy "public read lineage_list_aliases"
  on public.lineage_list_aliases for select using (true);
create policy "public read lineage_sources"
  on public.lineage_sources for select using (true);

-- ============================================================
-- 7) selectivity / film_count 재계산 헬퍼 (적재 후 실행)
-- ============================================================
-- update public.lineage_lists ll set
--   film_count = sub.cnt,
--   selectivity = ln( (select count(*) from public.films) :: numeric / greatest(sub.cnt,1) )
-- from (select list_id, count(*) cnt from public.film_lineage group by list_id) sub
-- where ll.id = sub.list_id;
