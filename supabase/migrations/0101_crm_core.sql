-- 0101: CRM ("Touchpoint Engine") core schema — /crm 오너 전용 아웃리치 CRM.
-- 정본: HANDOFF-CRM-비즈니스접점엔진.md §4.
--
-- 하우스 규약: 전 테이블 RLS on + 정책 0 = service-role 전용(서버 컴포넌트/액션/크론만
-- createAdminClient()로 접근). 신규 RPC는 security definer + service_role grant +
-- set statement_timeout '8s'. pg_trgm는 기존 확장(0019/0040/0054)이라 재설치 불필요.
--
-- ⚠️ 마이그레이션 번호는 supabase/migrations · worker/*.sql · radar/*.sql 세 곳의
-- 최대값+1로 구현 시점 재확인(main이 0100_ai_usage_meter를 선점해 0100→0101로 리넘버).

-- ── 조직(outlet/기관) — allowlist 시드, 컨택 dedup 앵커 ────────────────────────
create table if not exists crm_orgs (
  id bigint generated always as identity primary key,
  name text not null,
  domain text,
  kind text,
  country text, region text,
  homepage_url text, meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create unique index if not exists crm_orgs_domain_uq on crm_orgs (lower(domain)) where domain is not null;

-- ── 세그먼트 = 터치포인트 맵 클러스터·그룹 트리(A–N) ──────────────────────────
create table if not exists crm_segments (
  code text primary key,
  parent_code text references crm_segments(code),
  name_ko text not null, name_en text,
  rationale text,
  touch_types int[] default '{}',
  priority int default 100,
  status text not null default 'active' check (status in ('active','retired')),
  notes text
);

-- ── 컨택 본체 — 운영설계 §5 필드 + 동의(옵트인) 필드 ─────────────────────────
create table if not exists crm_contacts (
  id bigint generated always as identity primary key,
  org_id bigint references crm_orgs(id),
  segment_code text references crm_segments(code),
  name text,
  org_name text not null,
  role_title text,
  country text,
  jurisdiction text not null default 'OTHER' check (jurisdiction in ('EU','UK','US','CA','KR','OTHER')),
  kr_law_flag boolean not null default false,
  email text,
  alt_emails text[] default '{}',
  channel_type text not null default 'email' check (channel_type in ('email','form','dm')),
  contact_url text,
  metatake_url text,
  source_url text,
  collected_at date,
  legal_basis text,
  consent_status text not null default 'none' check (consent_status in ('none','requested','granted','denied')),
  consent_at timestamptz, consent_evidence_url text,
  verify_status text not null default 'unverified' check (verify_status in ('unverified','valid','risky','bounced')),
  email_verified_at timestamptz,
  stage text not null default 'none' check (stage in
    ('none','first_sent','followup','replied','negotiating','won','parked','unsubscribed','bounced')),
  parked_reason text check (parked_reason in ('owner','negative_reply')),
  last_touch_at timestamptz,
  next_action_at timestamptz,
  tags text[] default '{}',
  score int default 0,
  owner_notes text,
  import_batch_id bigint,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create unique index if not exists crm_contacts_email_uq on crm_contacts (lower(email)) where email is not null;
create index if not exists crm_contacts_seg_stage on crm_contacts (segment_code, stage);
create index if not exists crm_contacts_next_action on crm_contacts (next_action_at) where next_action_at is not null;
create index if not exists crm_contacts_org_name_trgm on crm_contacts using gin (org_name gin_trgm_ops);

-- ── 오퍼 라이브러리 — §6-b 시드 ──────────────────────────────────────────────
create table if not exists crm_offers (
  id bigint generated always as identity primary key,
  segment_code text not null references crm_segments(code),
  title text not null,
  coupling text not null,
  depth text not null default 'mid' check (depth in ('deep','mid','light')),
  status text not null default 'active' check (status in ('active','draft','retired')),
  sort int default 100
);

-- ── 이메일 템플릿 — 렌더러가 푸터·(광고) 강제 ─────────────────────────────────
create table if not exists crm_templates (
  id bigint generated always as identity primary key,
  name text not null,
  segment_code text references crm_segments(code),
  offer_id bigint references crm_offers(id),
  language text not null default 'en' check (language in ('en','ko')),
  subject_tpl text not null,
  body_tpl text not null,
  kind text not null default 'first' check (kind in ('first','followup','reply')),
  non_commercial boolean not null default false,
  created_at timestamptz default now()
);

-- ── 스케줄링 룰 — 크론이 평가해 초안 생성(§5-5) ───────────────────────────────
create table if not exists crm_rules (
  id bigint generated always as identity primary key,
  name text not null,
  enabled boolean not null default false,
  match jsonb not null default '{}'::jsonb,
  trigger jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb,
  caps jsonb not null default '{"per_run":10,"per_day":20}'::jsonb,
  priority int default 100,
  last_run_at timestamptz, notes text
);

create table if not exists crm_rule_runs (
  id bigint generated always as identity primary key,
  rule_id bigint references crm_rules(id),
  started_at timestamptz default now(),
  matched int default 0, drafted int default 0, skipped_suppressed int default 0,
  skipped_capped int default 0, errors text
);

-- ── 접촉 원장 — 시스템의 심장 ─────────────────────────────────────────────────
create table if not exists crm_touches (
  id bigint generated always as identity primary key,
  contact_id bigint not null references crm_contacts(id),
  direction text not null check (direction in ('out','in')),
  channel text not null check (channel in ('gmail','form','dm','manual','import','system')),
  kind text not null check (kind in ('first','followup','reply_in','reply_out','auto_reply_in','bounce','unsub','note')),
  rule_id bigint references crm_rules(id),
  offer_id bigint references crm_offers(id),
  draft_id bigint,
  subject text, snippet text,
  gmail_message_id text, gmail_thread_id text,
  happened_at timestamptz not null default now(),
  meta jsonb default '{}'::jsonb
);
create index if not exists crm_touches_contact on crm_touches (contact_id, happened_at desc);
create index if not exists crm_touches_thread on crm_touches (gmail_thread_id) where gmail_thread_id is not null;

-- ── 발송 초안(아웃박스) ───────────────────────────────────────────────────────
-- proposed --승인(P2)--> approved(Gmail 초안 생성, 오너가 Gmail서 전송)
-- proposed --승인·발송(P3)--> queued --크론 잡⑤--> sent | failed
-- proposed --> rejected
create table if not exists crm_drafts (
  id bigint generated always as identity primary key,
  contact_id bigint not null references crm_contacts(id),
  rule_id bigint references crm_rules(id),
  offer_id bigint references crm_offers(id),
  template_id bigint references crm_templates(id),
  kind text not null default 'first' check (kind in ('first','followup','reply')),
  subject text not null, body text not null,
  status text not null default 'proposed' check (status in ('proposed','approved','queued','sent','rejected','failed')),
  created_by text not null default 'rule' check (created_by in ('rule','manual','ai')),
  scheduled_for timestamptz,
  gmail_draft_id text, sent_message_id text, gmail_thread_id text,
  error text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists crm_drafts_status on crm_drafts (status, created_at desc);

-- ── 수신 메시지(인박스) ───────────────────────────────────────────────────────
create table if not exists crm_inbound (
  id bigint generated always as identity primary key,
  contact_id bigint references crm_contacts(id),
  gmail_message_id text not null unique, gmail_thread_id text,
  from_email text not null, subject text, snippet text,
  classified_as text check (classified_as in ('positive','question','negative','unsubscribe','bounce','auto_ooo','unmatched')),
  auto_draft_id bigint,
  handled boolean not null default false,
  received_at timestamptz not null, created_at timestamptz default now()
);

-- ── 수신거부·차단 목록 — 발송 경로의 하드 게이트. 절대 삭제하지 않는다 ──────────
create table if not exists crm_suppression (
  id bigint generated always as identity primary key,
  email text, domain text,
  reason text not null check (reason in ('unsubscribe','bounce','complaint','manual','legal')),
  source text,
  added_at timestamptz default now()
);
create unique index if not exists crm_suppression_email_uq on crm_suppression (lower(email)) where email is not null;
create unique index if not exists crm_suppression_domain_uq on crm_suppression (lower(domain)) where domain is not null;

-- ── 서치 봇 후보 큐 ───────────────────────────────────────────────────────────
create table if not exists crm_candidates (
  id bigint generated always as identity primary key,
  source text not null check (source in ('scout','radar','research','manual')),
  segment_guess text references crm_segments(code),
  name text, org_name text not null, country text,
  email_found text, contact_url text,
  evidence_url text not null,
  evidence_snippet text,
  status text not null default 'new' check (status in ('new','approved','rejected','merged')),
  promoted_contact_id bigint references crm_contacts(id),
  found_at timestamptz default now(),
  dedup_key text
);
create index if not exists crm_candidates_status on crm_candidates (status, found_at desc);

-- ── scout 소스 레지스트리 — 공식 Contact/Press 페이지만 ───────────────────────
create table if not exists crm_sources (
  id bigint generated always as identity primary key,
  url text not null unique, org_name text, segment_code text references crm_segments(code),
  country text, is_kr boolean not null default false,
  robots_ok boolean, last_scanned_at timestamptz, next_scan_at timestamptz,
  fail_count int default 0, status text not null default 'active' check (status in ('active','paused','dead')),
  notes text
);

-- ── 설정 싱글턴 — 발송 규율의 데이터화(§5-9) ─────────────────────────────────
create table if not exists crm_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ── 임포트 배치 원장 ──────────────────────────────────────────────────────────
create table if not exists crm_import_batches (
  id bigint generated always as identity primary key,
  filename text not null, source_kind text,
  rows_total int, rows_imported int, rows_deduped int, rows_skipped int,
  mapping jsonb, created_at timestamptz default now()
);

-- ── RLS: 전 테이블 service-role 전용(정책 0개) ────────────────────────────────
alter table crm_orgs           enable row level security;
alter table crm_segments       enable row level security;
alter table crm_contacts       enable row level security;
alter table crm_offers         enable row level security;
alter table crm_templates      enable row level security;
alter table crm_rules          enable row level security;
alter table crm_rule_runs      enable row level security;
alter table crm_touches        enable row level security;
alter table crm_drafts         enable row level security;
alter table crm_inbound        enable row level security;
alter table crm_suppression    enable row level security;
alter table crm_candidates     enable row level security;
alter table crm_sources        enable row level security;
alter table crm_settings       enable row level security;
alter table crm_import_batches enable row level security;

-- ── RPC 1: 대시보드 집계 1콜 (반환 jsonb 계약은 §5-1) ────────────────────────
create or replace function crm_dashboard_stats()
returns jsonb
language sql stable security definer
set search_path to 'public' set statement_timeout to '8s'
as $$
  select jsonb_build_object(
    'queues', jsonb_build_object(
      'proposed',          (select count(*) from crm_drafts   where status = 'proposed'),
      'unhandled_inbound', (select count(*) from crm_inbound  where handled = false),
      'new_candidates',    (select count(*) from crm_candidates where status = 'new'),
      'due_actions',       (select count(*) from crm_contacts where next_action_at is not null and next_action_at <= now())
    ),
    'funnel', (
      select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb)
      from (select stage, count(*) n from crm_contacts group by stage) s
    ),
    'clusters', (
      select coalesce(jsonb_agg(row_to_json(c) order by c.code), '[]'::jsonb)
      from (
        select seg.code,
               seg.name_ko,
               count(ct.id)                                                     as contacts,
               count(ct.id) filter (where ct.stage <> 'none')                   as sent,
               count(ct.id) filter (where ct.stage in ('replied','negotiating','won')) as replied
        from crm_segments seg
        left join crm_contacts ct
          on (ct.segment_code = seg.code or left(ct.segment_code, 1) = seg.code)
        where seg.parent_code is null
        group by seg.code, seg.name_ko
      ) c
    ),
    'hygiene', jsonb_build_object(
      'unsubs',      (select count(*) from crm_suppression where reason = 'unsubscribe'),
      'suppression', (select count(*) from crm_suppression),
      'bounced',     (select count(*) from crm_contacts where stage = 'bounced'),
      'sent_7d',     (select count(*) from crm_touches where direction = 'out'
                        and kind in ('first','followup') and happened_at >= now() - interval '7 days')
    )
  );
$$;

-- ── RPC 2: 후보 승격(원자화) ──────────────────────────────────────────────────
-- email이 suppression에 있으면 예외를 던진다(승격 거부).
-- lower(email)이 기존 컨택과 충돌하면 insert하지 않고 기존 id 반환 + 후보 merged.
create or replace function crm_promote_candidate(p_id bigint, p_segment text)
returns bigint
language plpgsql security definer
set search_path to 'public' set statement_timeout to '8s'
as $$
declare
  cand crm_candidates%rowtype;
  existing_id bigint;
  new_id bigint;
begin
  select * into cand from crm_candidates where id = p_id for update;
  if not found then raise exception 'candidate % not found', p_id; end if;
  if cand.status <> 'new' then raise exception 'candidate % already %', p_id, cand.status; end if;

  if cand.email_found is not null then
    if exists (select 1 from crm_suppression
               where lower(email) = lower(cand.email_found)
                  or lower(domain) = lower(split_part(cand.email_found, '@', 2))) then
      raise exception 'candidate email is suppressed';
    end if;
    select id into existing_id from crm_contacts where lower(email) = lower(cand.email_found) limit 1;
    if existing_id is not null then
      update crm_candidates set status = 'merged', promoted_contact_id = existing_id where id = p_id;
      return existing_id;
    end if;
  end if;

  insert into crm_contacts (segment_code, name, org_name, country, email, channel_type,
                            contact_url, source_url, legal_basis, collected_at)
  values (p_segment, cand.name, cand.org_name, cand.country,
          lower(cand.email_found), case when cand.email_found is not null then 'email' else 'form' end,
          cand.contact_url, cand.evidence_url, '문의용', current_date)
  returning id into new_id;

  update crm_candidates set status = 'approved', promoted_contact_id = new_id where id = p_id;
  return new_id;
end;
$$;

-- service-role 전용 grant (하우스 규약: anon/authenticated 실행 금지)
do $$
begin
  execute 'revoke execute on function crm_dashboard_stats() from public, anon, authenticated';
  execute 'grant  execute on function crm_dashboard_stats() to service_role';
  execute 'revoke execute on function crm_promote_candidate(bigint, text) from public, anon, authenticated';
  execute 'grant  execute on function crm_promote_candidate(bigint, text) to service_role';
end $$;
