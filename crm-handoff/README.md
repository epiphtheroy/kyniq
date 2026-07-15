# CRM (Touchpoint Engine) — 인수인계 마스터 (여기부터 읽으세요)

> **이 문서 하나만 읽고 링크를 따라가면 CRM의 모든 것을 이해할 수 있습니다.**
> metatake.net/crm = 오너(channel.wonwoo@gmail.com) 전용 아웃리치 CRM. `/admin`과 분리된 표면, 같은 admin 게이트.
> 최종 갱신: 2026-07-15. 작업 브랜치: `claude/metatake-crm-system-iwcmzq` · PR **#5**(draft, CI green).

## ⛔ 오너 절대 원칙 (위반 금지)
1. **실제 이메일 발송 금지.** 초안(draft) 생성까지만. `crm_settings.system_send_enabled`는 항상 `false` 유지. 룰(`crm_rules.enabled`)도 전부 `false` 유지. Gmail 발송 버튼을 누르는 자동화를 켜지 말 것.
2. 오너에게 "이거 누르세요"를 최소화. 에이전트가 할 수 있는 건 에이전트가 끝낸다.

---

## 1. 지금까지 한 것 (DONE)

### 1-A. 설계 지시서 (정본)
- **`../HANDOFF-CRM-비즈니스접점엔진.md`** — 단일 정본. 5개 관점(요구충족·구축가능성·컴플라이언스·사실검증·오퍼포지셔닝) 적대 검증을 거친 전체 설계. DDL·룰 계약·Gmail 연동·분류 규칙·임포트 프리셋·불변식 17조·구축 순서 P0~P6. **막히면 이 문서가 최종 근거.**
- 컴플라이언스 캐논: **`../Metatake_아웃리치_운영설계.md`** (GDPR/CAN-SPAM/CASL/정보통신망법). 이 시스템의 "헌법".
- 세그먼트·명분 원본: **`../lib/admindocs/content/business-touchpoints.ts`** (터치포인트 맵 A–M).

### 1-B. 코드 구축 (P0–P5, 브랜치에 커밋·푸시 완료)
전부 `claude/metatake-crm-system-iwcmzq` 브랜치에 있고 `tsc` 신규 에러 0, `next build` 컴파일 성공, Vercel 프리뷰 배포 성공.

| 층 | 파일 |
|---|---|
| DB 마이그레이션 | `../supabase/migrations/0101_crm_core.sql` (테이블 15·RPC 2), `../supabase/migrations/0102_crm_seed.sql` (시드) — main이 0100_ai_usage_meter를 선점해 0100/0101→0101/0102로 리넘버 |
| 게이트·셸 | `../middleware.ts`(`/crm` 블록), `../app/crm/layout.tsx` |
| 페이지 12개 | `../app/crm/` — page(대시보드)·contacts(+[id])·segments(+[code])·offers·rules·outbox·inbox·research·import·settings |
| API 3개 | `../app/api/crm/cron/route.ts`·`../app/api/crm/import/route.ts`·`../app/api/crm/unsub/route.ts` |
| 로직 lib | `../lib/crm/` — gmail·rules·render·classify·importPresets·settings·types·ui |
| 워커(Mac) | `../worker/crm-scout.py`·`../worker/gmail-auth.py`·`../run-crm-scout.command` |
| 크론 배선 | `../vercel.json` (`/api/crm/cron` 매시) |

### 1-C. 프로덕션 DB 반영 (kyniq · ref `jvgarcqrtsmgfimdcwgo`) — **이미 적용됨**
Supabase MCP로 라이브 DB에 적용 완료(2026-07-15). 실측:
- crm_ 테이블 **15개** 생성 (RLS on, 정책 0 = service-role 전용)
- 세그먼트 **66** (클러스터 14 + 그룹 52), 오퍼 **41**, 템플릿 **7**, 룰 **3(전부 off)**, 설정 1행
- `gmail_account = channel.wonwoo@gmail.com`, `system_send_enabled = false`, `physical_address = null`
- **`crm_contacts` = 0행 (임포트 미완 — 아래 TODO 1)**

> ⚠️ 프리뷰/프로덕션 사이트는 같은 이 DB를 씁니다. `/crm` UI 코드는 아직 **브랜치에만** 있으므로 PR 머지 전까지 라이브 `metatake.net/crm`에는 안 뜨고, **프리뷰 URL**(PR #5의 Vercel Preview)에서는 바로 사용 가능.

---

## 2. 앞으로 할 것 (TODO — 다른 에이전트가 완료)

우선순위 순. 상세는 각 링크 문서에.

1. **컨택 임포트 (2,318행 적재)** → **[IMPORT-RUNBOOK.md](./IMPORT-RUNBOOK.md)**
   4개 소스 파일(총 2,384행 → 이메일 dedup 후 2,318)을 `crm_contacts`에 적재. 파싱·매핑·dedup 스크립트 준비됨(`scripts/parse_contacts.py`). Supabase MCP `execute_sql` 배치 방식. ⚠️ **anon 권한 부여 금지**(보안 게이트가 막음) — service-role/execute_sql 채널만.
2. **Gmail OAuth 토큰** → **[GO-LIVE.md](./GO-LIVE.md) §1**
   오너가 클라이언트 시크릿 JSON을 `worker/`에 넣어둠. `worker/gmail-auth.py`를 **오너 Mac에서 1회 실행**(브라우저 구글 동의는 구글이 강제 — 유일한 인간 단계) → `GMAIL_REFRESH_TOKEN` 발급 → `.env.local` + Vercel env에 저장. (에이전트가 대신 브라우저 동의를 할 수는 없음.)
3. **물리 주소 (CAN-SPAM 푸터)** → **[GO-LIVE.md](./GO-LIVE.md) §2**
   오너가 우편 주소 제공 → `/crm/settings` 또는 `crm_settings.data.physical_address`에 저장.
4. **LIA 문서 커밋** → **[LIA.md](./LIA.md)** (초안 작성됨)
   오너가 발신자 신원·주소 빈칸만 채워 확정 → 경로를 `crm_settings.data.lia_doc_path`에 저장.
5. **PR #5 머지** → 머지되면 `metatake.net/crm` 라이브. (마이그레이션은 이미 프로덕션 DB에 적용돼 있으므로 코드만 머지되면 됨.)

> **발송은 하지 않는다.** 위가 다 되어도 `system_send_enabled`/룰은 계속 off. 오너가 `/crm/outbox`에서 초안을 눈으로 보고, 필요 시 **오너 본인이 Gmail 앱에서** 직접 보내는 것까지가 허용 범위.

---

## 3. 전체 링크 지도

**설계·근거**
- 설계 정본: [`../HANDOFF-CRM-비즈니스접점엔진.md`](../HANDOFF-CRM-비즈니스접점엔진.md)
- 컴플라이언스 캐논: [`../Metatake_아웃리치_운영설계.md`](../Metatake_아웃리치_운영설계.md)
- 터치포인트 맵(세그먼트 원본): [`../lib/admindocs/content/business-touchpoints.ts`](../lib/admindocs/content/business-touchpoints.ts)

**이 폴더의 실행 문서**
- 임포트 런북: [IMPORT-RUNBOOK.md](./IMPORT-RUNBOOK.md)
- 발송 준비(고라이브): [GO-LIVE.md](./GO-LIVE.md)
- LIA 문서(작성해서 커밋): [LIA.md](./LIA.md)
- 스크립트: [scripts/parse_contacts.py](./scripts/parse_contacts.py) · [scripts/emit_batches.py](./scripts/emit_batches.py)

**소스 데이터 (임포트 입력)**
- `../Metatake_학계_평론가_DB.xlsx` (시트 `학계_평론가_개인`, 1,394행)
- `../Metatake_트레이드매체_DB.xlsx` (시트 `트레이드매체`, 641행)
- `../data/sources/magazine-contacts.csv` (288행)
- `../Metatake_컨택DB_템플릿.xlsx` (시트 `컨택DB`, 61행)

**코드**
- 스키마: [`../supabase/migrations/0101_crm_core.sql`](../supabase/migrations/0101_crm_core.sql) · 시드: [`../supabase/migrations/0102_crm_seed.sql`](../supabase/migrations/0102_crm_seed.sql)
- 페이지: [`../app/crm/`](../app/crm/) · API: [`../app/api/crm/`](../app/api/crm/) · 로직: [`../lib/crm/`](../lib/crm/)
- 워커: [`../worker/crm-scout.py`](../worker/crm-scout.py) · [`../worker/gmail-auth.py`](../worker/gmail-auth.py)

---

## 4. 핵심 불변식 (건드리면 시스템 존재이유가 무너짐 — 상세는 설계 정본 §10)
- 사람 승인 없는 발송 제로. 룰·AI·자동응답은 `status='proposed'` 초안까지만.
- crm_* 전 테이블 service-role 전용(RLS on·정책 0). **anon/authenticated에 쓰기 권한 부여 금지.**
- suppression은 영구·발송 시점 재검사. KR/CA는 동의 게이트, 학계(E*)·교육(G*)은 비상업 템플릿만.
- LIA 3필드(source_url·collected_at·legal_basis) 없으면 초안 생성 불가.
- Gmail은 fetch 직접 호출(googleapis 의존성 추가 금지). Resend는 뉴스레터 전용(콜드 금지).
- 마이그레이션 번호는 3곳(supabase/·worker/·radar/) 최대+1.
