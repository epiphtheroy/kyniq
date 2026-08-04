# HANDOFF — CRM 에이전트 (총괄비서) · 구성계획 (단일 정본)

> 🔀 **2026-08-04 방향 전환 — 이 기계가 지금 무엇을 향해 도는지는
> `HANDOFF-크리에이터-아웃리치.md`에 있다.** 오너 지시로 아웃리치 주 대상이
> 기관·제휴에서 **개인 크리에이터(유튜버·리뷰어·시네필)**로 옮겨졌다.
> 목적도 사업 제휴가 아니라 **오가닉 트래픽**이다.
> **이 문서는 기계(어떻게 도는가), 저 문서는 캠페인(무엇을 향해 도는가).**
> 아웃리치 작업을 이어받는다면 **저기부터 읽을 것.** 아래 §12 불변식은 그대로 상속된다.

> **기획 정본 (2026-07-18, 구현 대기).** 오너의 최종 비전을 코드화하기 위한 컨셉·구성계획 문서. 이 프로젝트는 **신규 플랫폼 구축이 아니라 조립**이다 — 이미 라이브인 CRM 파이프([[crm-touchpoint-engine]]), 모드 B 초대된 창구(`HANDOFF-CRM-비즈니스접점엔진.md` §-1), 모바일 앱([[mobile-app-prewatch-plan]]), `claude -p` 워처 패턴([[exec-org-project]]), AI 사용미터([[ai-usage-admin-plan]])를 하나의 목적으로 수렴시킨다. **회사임원만들기 프로젝트는 이 문서로 흡수된다**(§9). 섹션마다 **의도**를 명시했다 — 의도와 충돌하는 구현 편의는 의도가 이긴다. 오너 확정 대기 결정은 §13.

---

## §0. 한 문장 정의 + 오너 비전

**CRM 에이전트(총괄비서) = 매일 스스로 리서치·우선순위·점수화·초안 작성을 끝내고, 오너에게 한국어 브리핑 2종을 올리는 상시 지능. 오너는 읽고 OK/수정만 한다. OK를 누르면 적절한 구조로 발송되고, 오너의 코멘트는 기록되어 다음 리서치·초안에 반영된다.**

오너 비전 원문 요지(2026-07-18):
> "나는 이제 **매일 업무 보고를 받고 컨펌을 하는 사람**이고자 한다. 지금 CRM은 내가 뒤지고·작성을 지시하고·OK하는 구조다. 나는 **가장 똑똑한 에이전트로부터 매일 10개의 제안 메일 초안**을 받고, **초안의 주요 구조를 한국어로**, **왜 이것이 우리에게 중요한지**, **여러 후보 중 왜 오늘 이것을 골랐는지**를 보고받고 싶다. OK를 누르면 이메일이 날아간다. 보고는 2가지 — ① 새로 보낼 이메일 10개, ② 이전 발송에 대한 회신 검토+회신 초안. 모두 초안이 작성돼 있고 나는 컨펌 또는 수정의견만 준다. 전부 **클라이언트별로 기록**돼 다음 컨택·회신 때 참조된다. 이 비서는 지능을 갖고, 분야별 우선순위를 정해 **하위 에이전트를 만들어 리서치를 시키고**, 기록·점수화해 매일 가장 효과 좋을 것을 제안한다. 내 코멘트를 기록해 다음 리서치에 반영·갱신한다."

**패러다임 전환**: 오너 = 노동자(뒤지고·쓰고·OK) → 오너 = **결재자(읽고·OK)**. 노동은 비서에게, 판단은 오너에게.

---

## §1. 매일의 루프 (오너가 받는 것 = 딱 2개)

| 브리핑 | 내용 (각 건 한국어) | 오너 액션 |
|---|---|---|
| **① 신규 제안 (기본 10건)** | 초안 완성 + (a) 초안의 주요 구조 (b) **왜 우리에게 중요한가** (c) 여러 후보 중 **왜 오늘 이걸 골랐나**(점수·근거) | OK / 수정의견 |
| **② 회신 검토** | 이전 발송에 온 답장 요약 + **회신 초안** 완성 + 브리핑 | OK / 수정의견 |

**기계적 루프**(하루 1~2회 스케줄):
1. **신호 수집** — 신규 회신(Gmail 동기화·`crm_inbound`)·레이더 신호(`radar_items`)·**지난 브리핑의 오너 코멘트**.
2. **학습 반영** — 오너 코멘트를 선호 모델(`crm_feedback`)에 접고 점수 가중치 조정(§7).
3. **리서치 팬아웃** — 필요 시 하위 에이전트를 만들어 창구 정책 정독(모드 B)·컨택 발굴·핏 근거 수집 → `crm_channels`/`crm_candidates`에 근거·점수 기록(§6).
4. **점수·정렬** — 기회 풀(신규 제안)과 회신 큐를 랭크(§5).
5. **초안** — 상위 10건 신규 제안 + 회신 초안을 `crm_drafts(created_by='ai')`로 작성.
6. **브리핑** — 건별 한국어 브리핑을 `crm_briefings`/`crm_briefing_items`에 기록 → 이메일·웹·모바일 동시 렌더.
7. **결재 대기** — 오너가 건별 OK/수정.
8. **집행** — OK → `queued` → 발송 크론이 발송(캡·워밍업·suppression 준수 §8). 수정 → 비서가 개정해 재브리핑.
9. **기록·되먹임** — 전부 `crm_touches`에 클라이언트별 1행. 결과(전송·회신·성사)가 다음 점수의 입력.

---

## §2. 아키텍처 — "어디에 존재하나": 몸과 얼굴 분리

오너의 혼동("워커냐 터미널이냐 모바일이냐")의 해답: **셋 중 하나가 아니라, 몸은 하나·얼굴은 여럿.**

- **몸 (상시 두뇌) = 스케줄된 워커 + CRM DB.** 자율 작업(리서치·점수·초안)은 대화창이 아니라 **타이머로 도는 헤드리스 세션**(`claude -p`/Agent SDK)이 한다. 장기기억은 이미 있는 CRM DB. → 존재 위치의 정답은 "**폴더 워커 + DB**"이지 "터미널 대화창"이 아니다.
- **얼굴 (오너가 닿는 창 — 모두 같은 DB를 봄):**
  - **이메일 다이제스트** — 브리핑이 매일 메일함으로. 오너는 이미 메일에 산다. (MVP 얼굴)
  - **웹** `/crm/briefing` — 카드로 읽고 OK/수정.
  - **모바일 앱** — 기존 앱에 "비서" 탭: 브리핑 읽기·OK·코멘트, 그리고 **대화**.
  - **터미널(현재 창)** — 만들기·디버깅·파워유즈. **작업실**일 뿐 일상 창구 아님.

**핵심 통찰**: 브리핑을 **DB 레코드(`crm_briefings`)로 먼저** 만들면 이메일·웹·모바일이 전부 같은 레코드를 렌더한다 → "하나의 비서, 여러 창문". 얼굴을 늘려도 두뇌는 하나.

---

## §3. 구성 — 재사용 vs 신설 (대부분 조립)

| 부품 | 상태 | 역할 |
|---|---|---|
| 장기기억(컨택·이력·초안·창구) `crm_*` | ✅ 라이브 | 클라이언트별 기록·참조. `crm_drafts.created_by='ai'` 예약됨 |
| 발송 파이프(초안→승인→Gmail) | ✅ 라이브 | OK → 발송. wonwoo@metatake.net 검증 완료(2026-07-18) |
| 회신 동기화·분류 `crm_inbound` | ✅ 설계됨(P4) | 브리핑 ②의 재료 |
| 모드 B 창구 레지스트리 `crm_channels` | 🆕 설계됨(§-1) | 지속가능한 10/일의 대부분(웹폼 지원) |
| 모바일 앱 + BFF | ✅ 라이브 | "비서" 얼굴 |
| `claude -p` 워처 패턴·AI 사용미터·레이더 | ✅ 라이브 | 몸의 골격·비용 계측·웜리드 신호 |
| **점수·우선순위 엔진** | 🆕 | 매일 기회 풀 점수화 → 상위 10(§5) |
| **리서치 팬아웃(하위 에이전트)** | 🆕 | 창구 정독·컨택 발굴·근거 수집(§6) |
| **브리핑 객체** `crm_briefings`/`_items` | 🆕 | 한국어 브리핑 = DB → 3면 렌더(§4) |
| **학습 루프** `crm_feedback` | 🆕 | 오너 코멘트 → 다음 점수·초안(§7) |
| **총괄비서 워커** `worker/crm-agent.py` | 🆕 | 몸. 스케줄 실행·오케스트레이션 |

신설 코드 총량: 워커 1개(+하위에이전트 호출) · 마이그레이션 1개(§4) · `/crm/briefing` 페이지 · 이메일 다이제스트 렌더 · (P2) 모바일 "비서" 탭 + BFF 라우트. **기존 파이프는 무수정 재사용.**

---

## §4. 데이터 모델 증분 (마이그레이션 1개)

번호는 구현 시점 3곳(supabase/·worker/·radar/) 최대+1로 재확인. RLS on·정책 0·service-role 전용(하우스 규약). 스케치:

```sql
-- 일일 브리핑 헤더. 하루 1~2회 워커가 1행 생성.
create table crm_briefings (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('proposals','replies')),  -- ①/②
  run_at timestamptz default now(),
  status text not null default 'open' check (status in ('open','partly_acted','closed')),
  summary_ko text,                       -- 오늘의 총평(한국어)
  meta jsonb default '{}'::jsonb          -- 점수 분포·모드 B/콜드 비율 등
);

-- 브리핑 항목 = 초안 1건 + 한국어 근거 + 결재 상태.
create table crm_briefing_items (
  id bigint generated always as identity primary key,
  briefing_id bigint not null references crm_briefings(id),
  draft_id bigint not null,              -- crm_drafts 논리 참조(신규 제안 or 회신 초안)
  contact_id bigint, channel_id bigint,  -- 클라이언트별 기록 앵커
  score numeric,                         -- 오늘 이걸 고른 점수
  rationale_ko text not null,            -- (b) 왜 우리에게 중요한가
  why_today_ko text not null,            -- (c) 여러 후보 중 왜 오늘 이것
  structure_ko text,                     -- (a) 초안 주요 구조 요약
  owner_decision text not null default 'pending'
    check (owner_decision in ('pending','ok','revise','skip')),
  owner_comment text,                    -- 수정의견 원문(학습 입력)
  decided_at timestamptz
);
create index crm_briefing_items_open on crm_briefing_items (owner_decision) where owner_decision='pending';

-- 학습 루프. 오너 코멘트를 구조화된 선호로 축적.
create table crm_feedback (
  id bigint generated always as identity primary key,
  source_item_id bigint references crm_briefing_items(id),
  scope text not null check (scope in ('global','segment','channel','contact','offer','tone')),
  scope_key text,                        -- 예: segment_code='E', tone='academic'
  signal text not null,                  -- 예: "너무 공격적", "학계엔 비상업 톤", "이 세그먼트 지금 관심없음"
  weight numeric default 1,              -- 점수 엔진이 읽는 가중
  created_at timestamptz default now()
);
```

기회 풀의 점수는 `crm_candidates.score`(이미 존재)와 `crm_channels`(신규 grade)를 갱신하는 방식으로 저장. 감사 로그는 기존 `logContentEvent()` 재사용.

---

## §5. 점수·우선순위 엔진 (매일 상위 10 선정의 근거)

**의도**: "왜 오늘 이걸 골랐나"를 오너에게 **숫자로** 설명할 수 있어야 한다. 점수는 설명가능해야 하고, 블랙박스 금지.

점수 = 가중합(초기 규칙기반, 이후 학습으로 가중 진화):
- **핏 강도** — "당신을 이렇게 읽었다" 자산 존재 여부(figures/readings/metatake_url) + 모드 B 창구 정책 매치도.
- **기대값** — 오퍼 depth(deep>mid>light) × 상대 규모/영향.
- **신선도** — 레이더가 최근 이 기관의 신호를 잡았나(웜리드).
- **채널 용이성** — 모드 B 창구(웹폼) > 콜드 이메일(캡 소모).
- **오너 선호(`crm_feedback`)** — 학습된 가중(§7). 음수 가중이면 강등.

모델 티어링(비용): 벌크 점수·1차 리서치는 저가 모델(Haiku), **최종 판단·초안·브리핑은 Opus**(오너 "가장 똑똑한 에이전트" 요구). Fable 금지([[hourly-model-fable-to-opus]]). 일일 토큰은 [[ai-usage-admin-plan]] 미터로 계측.

---

## §6. 리서치 팬아웃 (하위 에이전트)

총괄비서는 **하위 에이전트를 만들어** 리서치를 시킨다(오너 요구). 용도:
- 모드 B 창구 **정책 정독**(§-1.2 1단계) — 각 창구의 라이브 인테이크·심사기준 확인 → `crm_channels.screening_policy`.
- **컨택 발굴** — 공식 Contact/Press 페이지에서 근거 URL 수집(§5-8 규칙 상속: robots·KR 게이트·evidence 필수·봇→후보까지만).
- **핏 근거** — 상대 조직/인물을 다룬 우리 자산 링크 매칭.

산출은 전부 `crm_candidates`/`crm_channels`에 **근거 URL과 점수**로 기록. 사람 승인 전엔 컨택이 되지 않는다(불변식 상속). 병렬 팬아웃은 워커 안에서 Task/Agent 또는 `claude -p` 하위 프로세스.

---

## §7. 학습 루프 (오너 코멘트 → 다음 리서치·초안)

**의도**: 비서가 오너를 학습해 매일 더 잘 맞힌다. 이게 "총괄비서"의 핵심.

- 브리핑 항목의 `owner_comment`(수정의견)를 워커가 다음 런 선두에서 읽어 `crm_feedback`로 구조화(scope+signal+weight).
- 예: "학계엔 상업 톤 쓰지 마" → `scope='segment',scope_key='E',signal='비상업 톤',weight`. "이 고객 지금 관심 없음" → `scope='contact'` 강등. "너무 공격적" → `scope='tone'` 전역 완화.
- 점수 엔진(§5)과 초안 프롬프트(§1-5)가 매 런 `crm_feedback`를 입력으로 읽는다 → **갱신되는 비서**.

---

## §8. 발송 정책 — "OK가 발송을 트리거" (draft-only 불변식의 재배치)

- 기존 불변식(사람 승인 없는 발송 0)은 **유지되되 위치가 바뀐다**: 발송 승인이 "Gmail 앱 수동 전송"에서 "**브리핑 항목 OK 버튼**"으로 이동. 여전히 **건별 명시적 사람 OK**가 필수 → 불변식 성립.
- OK → 항목의 draft `status='queued'` → 발송 크론이 캡·suppression·(KR)윈도우 재검사 후 발송. `system_send_enabled`는 마스터 스위치로 존치.
- **"매일 10건"의 구성(권장)**: 대부분을 **모드 B 창구 지원**(웹폼·포털 — 이메일 평판 캡 무관)으로, **진짜 콜드 이메일은 워밍업·주간 캡 안에서 소량**. 새 도메인 wonwoo@metatake.net은 평판 워밍업 필요 → 초기엔 창구 지원이 볼륨을 지고 콜드는 천천히 램프. **모드 B가 없으면 "10건/일"은 불가능**(§-1과 이 프로젝트가 맞물리는 지점).
- 캡·워밍업·전용도메인·suppression은 `HANDOFF-CRM-비즈니스접점엔진.md` §10-11·§7에서 상속. 물리주소·LIA는 이미 처리([[crm-touchpoint-engine]]).

---

## §9. 회사임원만들기 흡수 (하나의 비서 = BD/IR/HR 데스크)

[[exec-org-project]]의 "AI 임원 3명"은 **총괄비서 안의 3개 데스크(기능 렌즈)**로 흡수된다 — 오너는 비서 **한 명**과 대화하고, 비서가 내부적으로 기능별 우선순위를 조율. 상속하는 것:
- `claude -p` = 역할 플레이북 + 헤드리스 세션 + CRM DB(장기기억) + 일일 보고서(결재) 아키텍처(§1).
- 데스크: BD(C·D·F·K·M)·IR(A·B)·HR(H·N) = §5 점수의 세그먼트 렌즈.
- 불변식 상속: **가공 인물 발신 금지**(발신=Wonwoo Yoon/wonwoo@metatake.net)·**KPI는 접점/논의**(발송수 금지)·캡 상향 금지.
- 지난 결론(2026-07-18): 목표는 조직 결성이 아니라 **의미 있는 제안·논의**. 딥 오퍼 성공 기준 = "의미 있는 대화 성사"(조직/부서 결성 아님).

`HANDOFF-회사임원만들기.md`는 "이 문서로 흡수·재정의됨" 배너를 달고 아키텍처 상세 참조용으로 보존.

---

## §10. 얼굴들 (인터페이스 상세)

- **이메일 다이제스트(MVP)**: 워커가 브리핑을 HTML 메일로 오너에게. 각 항목에 [OK]/[수정] = `/crm/briefing#item`으로의 서명 링크(웹 한 번 클릭). Resend는 뉴스레터 전용이므로 **오너 개인 발송용은 Gmail compose 재사용 또는 별도 트랜잭션 경로**(아웃리치와 분리).
- **웹 `/crm/briefing`**: `crm_briefing_items` 카드(초안·근거·점수·[OK][수정][건너뜀]). admin 게이트 상속.
- **모바일 "비서" 탭(P2)**: BFF 라우트로 `crm_briefings` 읽기·OK·코멘트. 앱 규칙 상속(`*_mine` 직호출 금지·CORS 확장 금지 [[mobile-app-prewatch-plan]]).
- **모바일 대화(P4)**: 앱 → BFF → 온디맨드 비서 세션 → DB. "왜 이걸 골랐어?"·"이 고객 이력?" 질의응답.

---

## §11. 단계별 구축 (각 독립 배포)

| Phase | 내용 | 완료 기준 |
|---|---|---|
| **P1 (MVP)** | 마이그(§4) · 점수 엔진 v1(규칙기반) · 브리핑 객체 · `worker/crm-agent.py`(스케줄) · **이메일 다이제스트** · `/crm/briefing`(OK→queued) | 매일 브리핑 ①②를 메일로 수신 → 웹에서 OK → 발송 크론이 전송, 클라이언트별 `crm_touches` 기록 |
| **P2** | 모바일 "비서" 탭(읽기·OK·코멘트) + BFF | 손안에서 브리핑 확인·결재 |
| **P3** | 리서치 팬아웃(§6) + 학습 루프(§7) 본격화 | 오너 코멘트가 다음날 점수·톤에 반영됨을 로그로 확인 |
| **P4** | 모바일 대화 + (선택) 클라우드 상시화 | 앱에서 비서와 질의응답 |

각 Phase 후: `tsc --noEmit` 신규 에러 0 → 커밋 → 라이브 검증. 마이그는 코드보다 먼저.

---

## §12. 불변식·함정

1. **사람 승인 없는 발송 0** — 위치만 브리핑 OK로 이동, 건별 명시 OK 필수(§8).
2. **가공 인물 금지** — 발신은 언제나 Wonwoo Yoon/wonwoo@metatake.net. 비서는 도구로서 투명.
3. **KPI = 접점·논의 품질**(발송수·조직 결성 아님). "덜 보내고 더 맞힌다."
4. **캡·워밍업·suppression 상속** — 새 도메인 평판 보호. 콜드 볼륨은 모드 B 뒤에 숨어 천천히.
5. **점수는 설명가능** — "왜 오늘 이것"을 숫자로. 블랙박스 금지.
6. **봇→컨택 직행 금지** — 팬아웃 산출은 `crm_candidates`까지, 승격은 사람.
7. **비용 계측** — 일일 토큰을 AI 사용미터로. Opus는 판단·초안·브리핑에, 벌크는 저가 모델. Fable 금지.
8. **크론/워처 규약 상속** — Mac 워처는 nohup(launchd TCC 차단), 무거운 건 Mac·발송은 Vercel 크론.
9. **모바일 규칙 상속** — `*_mine` 직호출 금지·API CORS 확장 금지.

---

## §13. 오픈 결정 (오너 확정 대기 — 권장 기본값으로 P1 설계)

| 결정 | 권장 기본값 | 대안 |
|---|---|---|
| 1. 몸(compute) 위치 | **Mac 워처 시작 + DB-큐 기반으로 클라우드 이전 대비(하이브리드)** | 처음부터 클라우드 cron(상시·유비용) |
| 2. MVP 얼굴 | **이메일 다이제스트**(구축 최소·오너 이미 메일에 삼) | 웹 우선 / 모바일 우선 |
| 3. "10건/일" 구성 | **창구 지원 다수 + 콜드 소량(캡·워밍업 준수)** | 콜드 볼륨 우선(도메인 평판 리스크) / 비서 자율 배분 |
| 4. 발송 이메일 얼굴 | 오너 개인 발송은 Gmail compose 재사용(아웃리치와 분리) | 별도 트랜잭션 경로 |
| 5. 브리핑 시각·횟수 | 1일 1회(아침) 시작, 회신 급증 시 2회 | 실시간 |

---

## §14. 먼저 읽을 파일

`HANDOFF-CRM-비즈니스접점엔진.md`(§-1 모드 B·엔진 전체) · `HANDOFF-회사임원만들기.md`(흡수 대상 — `claude -p` 아키텍처·§5 결재 루프·§6 자율권 매트릭스·§8 데스크) · [[crm-touchpoint-engine]]([[]] 라이브 상태·Gmail 검증) · [[mobile-app-prewatch-plan]](앱·BFF) · [[ai-usage-admin-plan]](비용 계측) · `worker/factory-watch.sh`(Mac 큐 클레임) · `hourly/pipeline/common.py`(워커 헬퍼) · 이 문서.

---

## §15. 실행 로그 (AS-BUILT / 시도 / TODO) — 2026-07-18

**구축됨**: 마이그0109(crm_channels/briefings/briefing_items/feedback) · `worker/crm-agent.py`(점수→Opus 초안+한국어근거→브리핑 발송·`--reply` 회신반영·`--redraft` 과거자료·`research_context()`) · 첫 브리핑 실발송+회신반영 루프 검증 · HF write토큰 `.env.local` 저장(fineGrained·계정 wonwooyoon).

**창구 조사 결론 (재조사 금지 — crm_channels.owner_notes에도 축적):**
- **RT**: 신청창 닫힘(2027-03 개방)+자격(승인크리틱3·2년·200만방문/6mo)+AI집필 vs 인간크리틱 충돌 → 대기.
- **Metacritic**: `editorial@metacritic.com`(연중 롤링 재평가·폼 없음). AI집필 구조충돌 → 저확률. 초안=임시보관함.
- **Perplexity**: 파트너 창구=`publishers@perplexity.ai`(대형 퍼블리셔 큐레이션·저확률). 무료 실개통=robots.txt에 PerplexityBot/Perplexity-User 허용(코드). **발송됨→auto-ack(publishers+noreply@perplexity.ai) 수신**.
- **TMDB**: 촬영지 필드 자체 없음·벌크임포트 '의사 없음'(공식)·API write 불가 → **드롭**. 좌표 홈=Wikidata.
- **Wikidata**: P915(촬영)/P840(설정)=Item값(좌표는 place 리컨실용). QuickStatements API/OpenRefine(본인계정, autoconfirmed=4일+50편집). 라이선스 OK(소유자→CC0). 1차=films(id보유)×이미 Q-id 있는 place. → 프로젝트.
- **HF**: 토큰기반(브라우저=토큰생성 1회만). CLI `hf upload`로 카드 metadata_update + TakeScore 2번째 데이터셋 + Collection. → 다음.
- **LibGuides**: 각 대학 영화 서브젝트 사서 개인 이메일(중앙폼 없음). 준중앙=ACRL/EBSS `peace@oxy.edu`. **16명 검증·crm_contacts(E2) 축적**(8신규+8기존=학계 임포트와 중복). ⚠️SEO 링크빌더 오인 주의→개인화 필수.
- **Google Dataset Search**: schema.org/Dataset 코드(폼 아님). → 다음.

**발송됨(오너 수동)**: Protagonist Pictures·Goodfellas(콜드) · Perplexity·ACRL/EBSS(창구). **임시보관함 대기**: Metacritic + 사서 6명(NYU·Columbia·UCLA·Michigan·Wesleyan·Warwick).

**TODO(우선순위)**: ①Google Dataset Search 코드 ②Perplexity robots.txt 코드 ③HF 업로드(huggingface_hub 설치 후) ④사서 나머지 10명 배치(도메인 워밍업 준수) ⑤**인바운드 회신 처리(브리핑②)** ⑥**일일 스케줄(아침 6시 KST)**.

## §16. 운영 모델 요구 (오너 2026-07-18)

- **근무시간 정의(24/7 금지)**: 한국시간 **06:00 브리핑을 위해 04:00~06:00 KST에 작업 세션**. 상시 폴링 아님. (24/7 회신 폴러는 이 지시로 중단함 — 향후 스케줄된 아침 세션으로 대체.)
- **인바운드 회신 끝까지 처리**: 발송 outreach에 온 답장(예: Perplexity auto-ack)을 아침 세션에 Gmail 동기화→분류→필요시 회신 초안→브리핑② 포함. (crm_inbound + 분류기 = 미구축, 다음.)
- **도메인 워밍업 규율**: 새 도메인 wonwoo@metatake.net은 하루 소수만. **첫날(2026-07-18) 이미 4발송+7드래프트로 과다 → 추가 발송 자제·나머지 배치는 며칠에 나눠서.**
