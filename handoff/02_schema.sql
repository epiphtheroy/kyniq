-- ============================================================
-- MetaTake — 계보(Lineage) 레이어 마이그레이션  v3 (에디션 3층 모델)
-- 프로젝트: kyniq (jvgarcqrtsmgfimdcwgo)
-- 원칙: 기존 컬럼/값 불변. 신규 테이블 + film_affinities 에 additive nullable 컬럼만.
-- 모델: lineage_lists(시리즈) → lineage_editions(연도판) → film_lineage(소속/결과)
-- 안전: 적용 전 staging/branch 에서 먼저 검증 권장.
-- ============================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
-- create extension if not exists vector;  -- embedding 사용 시

-- ============================================================
-- 1) lineage_lists : 시리즈/권위 (안정 어휘)
--    예: 황금종려상, 칸 경쟁부문, S&S 비평가폴, 누벨바그
-- ============================================================
create table if not exists public.lineage_lists (
  id               uuid primary key default gen_random_uuid(),
  facet            text not null
                   check (facet in ('festival','section','award','canon','movement','national','auteur','style')),
  slug             text not null unique,            -- kebab, 전역 UNIQUE
  label            text not null,
  parent_id        uuid references public.lineage_lists(id) on delete set null, -- award/section → festival, 하위사조 → 사조
  country          text,                             -- iso2. '국가 라인' 그룹핑 (national/auteur 채움; 영화제·정전은 국제이므로 보통 비움)
  has_editions     boolean not null default false,  -- 연도판을 갖는가 (award/section/canon=true, movement=false)
  tier             text check (tier in ('T1','T2','T3','T4')),  -- 권위 등급 (T1 정점 ~ T4 맥락)
  strategic_tier   text check (strategic_tier in ('S1','S2','S3','S4')), -- 전략 축(직교): S1 정점/S2 전위/S3 프론티어/S4 전문가 (영화제·섹션)
  authority_weight numeric,                          -- 0~1, tier 밴드 내 값 (T1 .90-1.0 / T2 .70-.88 / T3 .50-.68 / T4 .30-.45)
  selectivity      numeric,                          -- 파생(IDF)
  film_count       integer not null default 0,       -- 파생
  external_ref     jsonb  not null default '{}',     -- {"wikidata":"Q179808","url":"..."}
  source           text,
  description      text,
  -- embedding     vector,                           -- optional
  status           text not null default 'active',
  merged_into      uuid references public.lineage_lists(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists lineage_lists_facet_idx  on public.lineage_lists(facet);
create index if not exists lineage_lists_parent_idx on public.lineage_lists(parent_id);

-- ============================================================
-- 2) lineage_editions : 리스트의 연도판/인스턴스
--    연도(year)는 '항상' 여기 산다.
-- ============================================================
create table if not exists public.lineage_editions (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references public.lineage_lists(id) on delete cascade,
  year          integer not null,
  edition_label text,                               -- "72nd", "21st" 등 (선택)
  slug          text not null unique,               -- 예: cannes-palme-dor-2019
  rank_max      integer,                            -- 정전 리스트 크기 (예: 1000)
  external_ref  jsonb not null default '{}',
  source        text,
  created_at    timestamptz not null default now(),
  unique (list_id, year)
);
create index if not exists lineage_editions_list_idx on public.lineage_editions(list_id);

-- ============================================================
-- 3) film_lineage : 영화 ↔ 리스트(+에디션) 소속/결과 (별자리 직물)
--    edition_id 는 nullable: 사조 등 연도없는 소속은 list 직접 연결.
-- ============================================================
create table if not exists public.film_lineage (
  id          bigint generated always as identity primary key,
  film_id     uuid not null references public.films(id)            on delete cascade,
  list_id     uuid not null references public.lineage_lists(id)    on delete cascade,
  edition_id  uuid references public.lineage_editions(id)          on delete cascade, -- nullable
  facet       text not null,                        -- 비정규화(빠른 필터)
  result      text,                                 -- won | nominated | selected | null
  rank        integer,                              -- 정전 에디션 내 순위
  value       jsonb not null default '{}',          -- 그 외 보조 (예: {"section_note":"..."} )
  confidence  numeric,                              -- 퍼지 매칭일수록 낮춤
  source      text,
  created_at  timestamptz not null default now()
);
-- 중복 방지: (film, list, edition) 유일 (null edition 은 0-uuid 로 치환 비교)
create unique index if not exists film_lineage_uniq
  on public.film_lineage (film_id, list_id, coalesce(edition_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists film_lineage_film_idx    on public.film_lineage(film_id);
create index if not exists film_lineage_list_idx    on public.film_lineage(list_id);
create index if not exists film_lineage_edition_idx on public.film_lineage(edition_id);
create index if not exists film_lineage_facet_idx   on public.film_lineage(facet);

-- ============================================================
-- 4) lineage_list_aliases : 리스트 별칭 (선택)
-- ============================================================
create table if not exists public.lineage_list_aliases (
  alias      text primary key,
  list_id    uuid not null references public.lineage_lists(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5) lineage_sources : 공개 크레딧용 출처 메타 (선택)
-- ============================================================
create table if not exists public.lineage_sources (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  url           text,
  type          text,   -- aggregator | structured_db | api | official_archive | community
  license       text,
  access        text,
  cadence       text,
  credit_string text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 6) film_affinities 확장 (ADDITIVE ONLY — 기존 컬럼 불변)
-- ============================================================
alter table public.film_affinities
  add column if not exists shared_list_ids uuid[],
  add column if not exists lineage_score   numeric;
create index if not exists film_affinities_shared_list_ids_idx
  on public.film_affinities using gin (shared_list_ids);

-- ============================================================
-- 6b) films '정전 완전성' 플래그 (ADDITIVE ONLY)
--     정전은 TMDB 기준으로 완전하게 채운다. 로컬 ~1,900 카탈로그는 참고일 뿐.
--     DB 존재 유무는 게이트가 아니라 '별도 체크 항목'으로만 기록.
-- ============================================================
alter table public.films
  add column if not exists in_seed_catalog boolean not null default true;
-- 신규 정전 영화(stub) 적재 시 false 로 넣는다. 기존 1,957행은 default true 로 backfill.
-- (대량 정전 영화가 들어오므로 films 가 크게 확장됨. visible=false/hold=true 로 스테이징.)

-- ============================================================
-- 7) RLS (기존 테이블과 동일: 공개 읽기, 쓰기는 service_role)
-- ============================================================
alter table public.lineage_lists        enable row level security;
alter table public.lineage_editions     enable row level security;
alter table public.film_lineage         enable row level security;
alter table public.lineage_list_aliases enable row level security;
alter table public.lineage_sources      enable row level security;

create policy "public read lineage_lists"        on public.lineage_lists        for select using (true);
create policy "public read lineage_editions"     on public.lineage_editions     for select using (true);
create policy "public read film_lineage"         on public.film_lineage         for select using (true);
create policy "public read lineage_list_aliases" on public.lineage_list_aliases for select using (true);
create policy "public read lineage_sources"      on public.lineage_sources      for select using (true);

-- ============================================================
-- 8) 파생값 재계산 (적재 후 실행)
-- ============================================================
-- update public.lineage_lists ll set
--   film_count  = sub.cnt,
--   selectivity = ln( (select count(*) from public.films)::numeric / greatest(sub.cnt,1) )
-- from (select list_id, count(distinct film_id) cnt from public.film_lineage group by list_id) sub
-- where ll.id = sub.list_id;
