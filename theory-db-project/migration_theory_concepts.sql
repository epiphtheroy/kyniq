-- =====================================================================
-- Theory Concept DB — 마이그레이션 초안 (DRAFT, 미적용)
-- 대상: MetaTake DB (kyniq / jvgarcqrtsmgfimdcwgo)
-- 주의: 운영 DB에 직접 적용 금지. 반드시 Supabase 브랜치에서 검토 후 머지.
--       (Supabase MCP: create_branch → apply → 확인 → merge_branch)
-- =====================================================================

-- 1) Canonical 개념 테이블 -------------------------------------------------
create table if not exists public.theory_concepts (
  id            bigserial primary key,
  concept       text not null,
  concept_slug  text unique,
  native        text,                 -- 원어 (sm_concepts에서 백필 가능)
  one_liner     text,                 -- 한 줄 정의
  part          text,
  major         text,
  sub           text,
  taxonomy_node_id uuid,              -- (선택) taxonomy_nodes 연결
  sm_concept_id uuid references public.sm_concepts(id),  -- 기존 개념층 연결
  source        text default 'metatake-unified-v1',
  created_at    timestamptz default now()
);

-- 2) 이론가 ↔ 개념 (M:N) --------------------------------------------------
create table if not exists public.theorist_concepts (
  id           bigserial primary key,
  concept_id   bigint references public.theory_concepts(id) on delete cascade,
  theorist_id  uuid   references public.theorists(id),     -- 매칭되면 연결
  theorist_name text not null,                              -- 원본 표기(매칭 실패 대비)
  role         text default 'primary',                      -- primary / co
  confidence   text,                                         -- high / med
  source       text,                                         -- DB / Knowledge / Web
  created_at   timestamptz default now()
);
create index if not exists idx_tc_concept on public.theorist_concepts(concept_id);
create index if not exists idx_tc_theorist on public.theorist_concepts(theorist_id);

-- 3) 적재 가이드 ---------------------------------------------------------
--  a. theory_concepts ← concepts/theory_concepts.csv
--       (concept, native, one_liner, part, major, sub)  // concept_slug = slugify(concept)
--  b. theorist_concepts ← concepts/theorist_concepts.csv
--       (theorist_name, concept→concept_id, confidence, source)
--  Supabase Studio의 CSV import 또는 staging 테이블 + insert ... select 사용.

-- 4) 이론가 ID 매칭 (이름 정확일치) --------------------------------------
update public.theorist_concepts tcp
set theorist_id = t.id
from public.theorists t
where tcp.theorist_id is null
  and lower(btrim(t.name)) = lower(btrim(tcp.theorist_name));

-- 5) 신규 이론가(95명, DB 부재) insert 후 재매칭 --------------------------
--   insert into public.theorists (id, slug, name)
--   select gen_random_uuid(), slugify(x.name), x.name
--   from (select distinct theorist_name name from public.theorist_concepts tcp
--         where tcp.theorist_id is null) x;
--   그런 다음 (4) update를 1회 더 실행.

-- 6) 원어(native) 백필 — 기존 sm_concepts와 이름 매칭 ---------------------
update public.theory_concepts tc
set native = sc.native
from public.sm_concepts sc
where (tc.native is null or tc.native = '')
  and sc.native is not null and sc.native <> ''
  and regexp_replace(lower(tc.concept), '[^a-z0-9]', '', 'g')
    = regexp_replace(lower(split_part(sc.name, '(', 1)), '[^a-z0-9]', '', 'g');

-- 7) sm_concepts 연결(있으면) -------------------------------------------
update public.theory_concepts tc
set sm_concept_id = sc.id
from public.sm_concepts sc
where tc.sm_concept_id is null
  and regexp_replace(lower(tc.concept), '[^a-z0-9]', '', 'g')
    = regexp_replace(lower(split_part(sc.name, '(', 1)), '[^a-z0-9]', '', 'g');

-- 8) (선택) 통합 택소노미를 taxonomy_nodes에 추가 ------------------------
--   기존 영화-내용 taxonomy_nodes 패턴(kind/label/code/parent_id) 재사용:
--   kind='theory_part'(13) → 'theory_major'(171) → 'theory_sub'(543) 트리 삽입,
--   이후 theory_concepts.taxonomy_node_id 백필.
--   * 기존 theory_canon.part/major_category/sub_category는 보존(요청사항).

-- 검증 쿼리 예시:
--   select count(*) from theory_concepts;                 -- ~3,927
--   select count(*) from theorist_concepts;               -- ~4,525
--   select count(*) from theorist_concepts where theorist_id is null;  -- 매칭 실패 = 신규/표기차
--   select count(*) from theory_concepts where native is not null;     -- 원어 보유
