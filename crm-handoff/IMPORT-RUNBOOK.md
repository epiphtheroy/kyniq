# 임포트 런북 — 컨택 2,318행 적재

목표: 4개 소스 파일을 `crm_contacts`에 적재. 현재 `crm_contacts` = **0행**. 완료 후 ≈ **2,318행**.

## 입력 (실측)
| 소스 | 행 | 검증 이메일 | 시트 |
|---|---|---|---|
| `../Metatake_학계_평론가_DB.xlsx` | 1,394 | 1,238 | `학계_평론가_개인` |
| `../Metatake_트레이드매체_DB.xlsx` | 641 | 420 | `트레이드매체` |
| `../data/sources/magazine-contacts.csv` | 288 | 143 | — |
| `../Metatake_컨택DB_템플릿.xlsx` | 61 | 61 | `컨택DB` |
| **합계** | **2,384** | | 이메일 dedup 후 **2,318** (중복 이메일 66 제거) |

매핑·세그먼트 규칙은 설계 정본 §5-4-B 및 `../lib/crm/importPresets.ts`와 동일하게 `scripts/parse_contacts.py`에 구현돼 있다(카테고리→세그먼트 전수 매핑, 관할권 정규화, KR 플래그, 프리메일 처리, 이메일 dedup). 검증 결과: unsegmented 0, 전 행 세그먼트 배정됨.

## ⚠️ 금지
- **anon/authenticated 역할에 crm_* 쓰기 권한(정책·GRANT)을 주지 말 것.** 보안 게이트가 막고, 설계 불변식(§10-7) 위반이다. 로더 함수를 anon에 grant하는 우회도 금지.
- service-role 채널(**Supabase MCP `execute_sql`**, 또는 배포된 사이트의 `/api/crm/import`가 쓰는 service key)로만 적재.

## 방법 A — Supabase MCP `execute_sql` 배치 (헤드리스 에이전트 권장)

1. **파싱**: `python3 crm-handoff/scripts/parse_contacts.py` → `contacts.json`(2,318행) 생성 + 요약 출력. (openpyxl 필요: `pip install openpyxl --quiet`.)
2. **배치 SQL 생성**: `python3 crm-handoff/scripts/emit_batches.py` → `crm-handoff/_batches/batch_001.sql … batch_00N.sql` (각 파일 = 완결된 `INSERT ... jsonb_to_recordset(...)` 문, 400행/배치, `lower(email)` 기존행 NOT EXISTS 가드로 재실행 안전).
3. **적재**: 각 배치 파일 내용을 Supabase MCP `execute_sql`(project_id `jvgarcqrtsmgfimdcwgo`)로 실행. 배치마다 반환된 삽입 수를 확인.
4. **검증**:
```sql
select count(*) as contacts,
       count(*) filter (where email is not null) as with_email,
       count(*) filter (where jurisdiction='KR') as kr,
       count(*) filter (where segment_code is null) as unsegmented
from crm_contacts;
-- 기대: contacts ≈ 2318, with_email ≈ 1796, unsegmented = 0
select segment_code, count(*) from crm_contacts group by 1 order by 2 desc limit 12;
select public.crm_dashboard_stats();  -- 대시보드 집계 정상 확인
```
5. **임포트 배치 기록**(선택): `insert into crm_import_batches(filename, source_kind, rows_total, rows_imported) values ('4-source seed','mixed',2384,<적재수>);`

### execute_sql 문 형태(참고 — emit_batches.py가 생성)
```sql
insert into crm_contacts (name, org_name, role_title, country, jurisdiction, kr_law_flag,
  email, alt_emails, channel_type, contact_url, source_url, collected_at, legal_basis, segment_code)
select nullif(x.name,''), x.org_name, nullif(x.role_title,''), nullif(x.country,''),
       coalesce(nullif(x.jurisdiction,''),'OTHER'), coalesce(x.kr_law_flag,false),
       nullif(lower(x.email),''), coalesce(x.alt_emails,'{}'::text[]), coalesce(nullif(x.channel_type,''),'email'),
       nullif(x.contact_url,''), nullif(x.source_url,''), x.collected_at, nullif(x.legal_basis,''), x.segment_code
from jsonb_to_recordset('[ … 400 rows … ]'::jsonb) as x(
  name text, org_name text, role_title text, country text, jurisdiction text, kr_law_flag boolean,
  email text, alt_emails text[], channel_type text, contact_url text, source_url text,
  collected_at date, legal_basis text, segment_code text)
where x.org_name is not null
  and (x.email is null or not exists (select 1 from crm_contacts c where lower(c.email)=lower(x.email)));
```

## 방법 B — 배포된 사이트의 임포트 마법사 (사람이 직접 할 때)
PR 머지(또는 프리뷰) 후 admin으로 로그인 → `/crm/import` → 프리셋 선택 → 파일 업로드 → **Dry-run**으로 new/merged/held 확인 → **적재 실행**. 서버가 service key로 처리(`/api/crm/import`), 컨텍스트·권한 문제 없음. 단 오너가 클릭해야 함(오너는 이걸 원치 않음 → 방법 A 우선).

## 주의점
- 조직(crm_orgs) 링크는 이 시드 적재에서 생략(`org_id` null). UI는 `org_name`으로 표시하므로 사용에 지장 없음. 필요 시 나중에 도메인 기준으로 backfill.
- 소스리스트 111행·allowlist 150행(scout 소스/orgs)은 이 적재 범위 밖 — 별도(설계 §5-4-E).
- 재실행 안전: NOT EXISTS(lower email) 가드로 이메일 있는 행은 중복 안 됨. **이메일 없는 행은 재실행 시 중복될 수 있으니** 방법 A는 1회만 완주하거나, 중간 실패 시 `crm_contacts` 카운트로 진척 확인 후 남은 배치만.
