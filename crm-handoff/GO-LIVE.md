# 고라이브 준비 — 발송 "직전"까지의 전제조건

> **재확인: 실제 발송은 하지 않는다.** 이 문서는 시스템을 "언제든 오너가 초안을 검토·수동 발송할 수 있는 상태"로 만드는 것까지다. `system_send_enabled`와 룰은 계속 `false`.

## §1. Gmail OAuth 토큰 (오너 Mac 1회)

**왜**: `/crm/outbox`에서 초안을 "승인"하면 시스템이 오너 Gmail 계정(`channel.wonwoo@gmail.com`)에 **Gmail 초안**을 만든다(발송 아님). 이를 위해 Gmail API refresh token이 필요.

**상태**: 오너가 GCP OAuth 클라이언트(데스크톱 앱)를 만들고, 다운로드한 client-secret JSON을 `worker/`에 넣어 둠.

**남은 단 하나의 인간 단계 (구글이 강제 — 에이전트가 대신 못 함)**: 오너가 자기 Mac에서 브라우저로 구글 로그인·동의. 나머지는 스크립트가 처리.

**실행(오너 Mac 터미널)**:
```bash
cd /Users/jerryje/Documents/MetaTake
python3 worker/gmail-auth.py           # worker/의 client-secret*.json을 자동 인식
# → 브라우저가 열림 → channel.wonwoo@gmail.com으로 로그인·허용
# → 터미널에 GMAIL_REFRESH_TOKEN=... 이 출력됨
```
> ⚠️ GCP OAuth 동의화면은 반드시 **"PUBLISH APP"(In production)** 상태여야 함. Testing 상태면 refresh token이 **7일 만료**되어 주 1회 파이프라인이 죽는다(설계 §5-6-A / §10-17).

**출력 토큰 저장(2곳)**:
- `.env.local`(Mac 리포 루트)에 `GMAIL_REFRESH_TOKEN=...`, `GMAIL_CLIENT_ID=...`, `GMAIL_CLIENT_SECRET=...` 추가.
- Vercel 프로젝트(kyniq) 환경변수에 동일 3개 추가(서버 크론·아웃박스가 사용).

**확인**: `/crm/settings`의 "Gmail 연결 상태"가 정상으로 표시되면 됨. `gmail_token_error`가 뜨면 토큰 재발급.

> 클라이언트 시크릿 JSON은 **절대 커밋 금지**. `.gitignore`에 `worker/client_secret*.json`·`worker/*oauth*.json`을 추가해 둘 것(안 돼 있으면 추가).

## §2. 물리 주소 (CAN-SPAM 필수 푸터)

**왜**: 렌더러(`lib/crm/render.ts`)가 모든 아웃바운드 본문 하단에 우편 주소를 자동 부착. 없으면 미국 수신자 대상 메일이 법적으로 불완전.

**무엇**: 우편물 수취 가능한 실제 주소(집·사무실 또는 가상 오피스/사서함).

**어떻게**: `/crm/settings`의 "물리 주소" 칸에 입력·저장. 또는 SQL:
```sql
update crm_settings set data = jsonb_set(data,'{physical_address}','"<주소 문자열>"') where id=1;
```

## §3. LIA 문서 확정·경로 등록

**왜**: EU/영국 콜드 아웃리치의 GDPR 법적 근거. 사전 문서화 필수(제출 아님, 보관용).

**무엇/어떻게**: [LIA.md](./LIA.md) 초안의 빈칸(발신 신원·주소·서명일)을 채워 확정 → 경로를 등록:
```sql
update crm_settings set data = jsonb_set(data,'{lia_doc_path}','"crm-handoff/LIA.md"') where id=1;
```

## §4. PR 머지 → 라이브

- **CRM 마이그레이션(파일명 `0101_crm_core`·`0102_crm_seed`로 리넘버, 적용 당시엔 0100/0101)은 이미 프로덕션 DB에 적용됨** → 코드만 머지하면 됨(마이그레이션 재적용 불필요, IF NOT EXISTS라 재적용해도 안전).
- PR **#5** 머지 시 `metatake.net/crm` 라이브. 크론 `/api/crm/cron`(매시)도 활성 — 단 룰이 전부 off라 초안을 만들지 않음(안전). Gmail 미설정 시 동기화 잡은 무해하게 스킵.

## §5. 최종 점검 (발송 없이)
- `/crm` 대시보드: 컨택 수·세그먼트 현황 표시.
- `/crm/contacts`: 임포트된 컨택 필터·검색.
- `/crm/contacts/[id]`: 오퍼 패널에서 초안 컴포저 → 초안이 `/crm/outbox`에 `proposed`로 뜨는지.
- `/crm/outbox`: 초안 "승인" → Gmail 초안 생성(발송 아님) → 오너가 Gmail 앱에서 눈으로 확인.
- 룰·`system_send_enabled`는 계속 off로 둘 것.
