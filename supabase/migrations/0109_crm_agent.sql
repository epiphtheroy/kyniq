-- 0109_crm_agent.sql — CRM 에이전트(총괄비서) core.
-- Mode B channel registry + daily briefing objects + learning loop.
-- 정본: HANDOFF-CRM에이전트-총괄비서.md §4 / HANDOFF-CRM-비즈니스접점엔진.md §-1.4.
-- House rule: every table RLS on + 0 policies = service-role only.

-- ── Mode B: 초대된 창구 레지스트리 (한 행 = 상대가 연 문 하나) ───────────────
create table if not exists crm_channels (
  id bigint generated always as identity primary key,
  segment_code text references crm_segments(code),
  name text not null,
  industry_family text,
  channel_url text not null,
  channel_type text not null default 'web_form' check (channel_type in
    ('web_form','email','portal','submission','api_application','registry','grant','accreditation')),
  their_benefit text,                      -- 그들이 문 연 이유
  screening_policy text,                   -- 정독한 심사 기준(§-1.2 1단계 산출)
  our_fit text,                            -- 우리 실제 상황(§-1.2 2단계, 과장 금지)
  depth text not null default 'mid' check (depth in ('deep','mid','light')),
  grade text check (grade in ('AAA','AA','A')),   -- ★★★/★★/★
  status text not null default 'discovered' check (status in
    ('discovered','studying','drafted','submitted','under_review','accepted','rejected','maintaining','closed')),
  score numeric default 0,
  decided_at timestamptz,
  reapply_allowed boolean not null default false,  -- 정책이 재신청 명시 허용 시만(불변식 B4)
  evidence_url text,
  owner_notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create unique index if not exists crm_channels_url_uq on crm_channels (lower(channel_url));
create index if not exists crm_channels_status on crm_channels (status, grade);

-- ── 일일 브리핑 헤더 (하루 1~2회 워커가 1행) ─────────────────────────────────
create table if not exists crm_briefings (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('proposals','replies')),
  run_at timestamptz default now(),
  status text not null default 'open' check (status in ('open','partly_acted','closed')),
  summary_ko text,
  meta jsonb default '{}'::jsonb
);

-- ── 브리핑 항목 = 초안(인라인) + 한국어 근거 + 결재 상태 ─────────────────────
-- 초안을 인라인으로 보관해 컨택 없는 모드 B 창구 지원도 표현 가능.
create table if not exists crm_briefing_items (
  id bigint generated always as identity primary key,
  briefing_id bigint not null references crm_briefings(id),
  item_type text not null default 'channel' check (item_type in ('channel','contact','reply')),
  channel_id bigint references crm_channels(id),
  contact_id bigint references crm_contacts(id),
  submit_target text,                      -- 제출 지점: 웹폼 URL 또는 이메일 주소
  draft_subject text,
  draft_body text not null,
  score numeric,
  score_breakdown jsonb default '{}'::jsonb,
  structure_ko text,                       -- (a) 초안 주요 구조
  rationale_ko text not null,              -- (b) 왜 우리에게 중요한가
  why_today_ko text not null,              -- (c) 여러 후보 중 왜 오늘 이것
  owner_decision text not null default 'pending' check (owner_decision in ('pending','ok','revise','skip')),
  owner_comment text,                      -- 수정의견 원문(학습 입력)
  decided_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists crm_briefing_items_open on crm_briefing_items (owner_decision) where owner_decision='pending';

-- ── 학습 루프: 오너 코멘트 → 구조화된 선호 ───────────────────────────────────
create table if not exists crm_feedback (
  id bigint generated always as identity primary key,
  source_item_id bigint references crm_briefing_items(id),
  scope text not null check (scope in ('global','segment','channel','contact','offer','tone')),
  scope_key text,
  signal text not null,
  weight numeric default 1,
  created_at timestamptz default now()
);

alter table crm_channels enable row level security;
alter table crm_briefings enable row level security;
alter table crm_briefing_items enable row level security;
alter table crm_feedback enable row level security;
