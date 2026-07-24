# Metatake 앱 — 오너 착수 런북 (2026-07-18 · **상태 갱신 2026-07-20**)

> **✅ 2026-07-20 현재: iOS TestFlight 라이브(빌드 9) — 내부(오너)+외부(Friends·베타심사 대기) 테스트 중. OTA 파이프라인 개통.** 전체 경위·경로·함정은 정본 `HANDOFF-모바일앱-프리워치.md` **§−1 출시 실록**. 안드로이드는 **`HANDOFF-안드로이드-출시.md`**(AI 위임 가능한 작업지시서).

> 코드·기획·자산·리스팅·스토어 킷은 **전부 완성**돼 있습니다(정본: 루트 `HANDOFF-모바일앱-프리워치.md` v4.0 + `HANDOFF-커넥트-기록이관.md`). 이 문서는 **오직 오너만 할 수 있는 계정·콘솔 작업**을, Apple 계정을 만든 순간부터 **순서대로** 모은 단일 체크리스트입니다. 각 항목의 상세 근거는 괄호의 정본 절 참조.

---

## 0. 지금 당장(계정 없이도 가능) — 완료해두면 좋은 것

- [ ] **`CONNECT_TOKEN_KEY` 생성·등록** — 커넥트 OAuth 토큰 암호화 키. 터미널: `openssl rand -hex 32` → 나온 64자를 Vercel 프로젝트 환경변수에 `CONNECT_TOKEN_KEY`로 등록. (이거 없으면 커넥트 자동연동 타일이 전부 "Coming soon"으로 표시 — 앱은 정상 동작)
- [ ] **Supabase Auth 콘솔**:
  - [ ] Apple provider 활성화(Sign in with Apple) + authorized client `net.metatake.app` — **공개심사 전 유일한 잔여 항목** (TestFlight엔 불필요)
  - [x] **Google provider** ✅ 작동 (redirect `metatake://**` 허용 2026-07-20, 앱 PKCE 배선 빌드7)
  - [x] 이메일 OTP 템플릿 `{{ .Token }}` ✅ 2026-07-20 교체(가입확인+매직링크 둘 다, Management API — UA 헤더 필수)
- [ ] **커넥트 프로바이더 등록** (전부 무료·즉시, 정본 커넥트 §7.2):
  - Trakt: trakt.tv/oauth/applications → `TRAKT_CLIENT_ID`·`TRAKT_CLIENT_SECRET`를 Vercel env로. Redirect URI에 `metatake://connect-callback` + `exp://<맥 LAN IP>:8081/--/connect-callback`
  - Simkl: simkl.com/settings/developer → `SIMKL_CLIENT_ID`·`SIMKL_CLIENT_SECRET` + 같은 redirect
  - TMDB: `TMDB_READ_TOKEN`은 이미 설정됨 — v4 앱 설정에서 위 redirect만 허용
- [ ] **`/privacy` 법적 검토** — 스토어 제출 전 필수. 프라이버시 정책 초안은 라이브(`https://metatake.net/privacy`)이나 counsel 사인오프 필요(GDPR/CCPA 문구·물리주소 표기 여부). 앱 계정삭제/웹 삭제 경로 비대칭도 확인(정본 웹레인 open_issue).
- [x] **Letterboxd API 신청** — ✅발송 완료 2026-07-18(wonwoo@metatake.net). 무응답 시 2026-09-01 재신청(커넥트 §8).

---

## 1. Apple Developer 등록 직후 (iOS 경로 개시)

> ✅ **Apple Developer Program 승인 완료 2026-07-19. Team ID = `AYDX65J9H4`.** AASA·eas.json 반영 완료(에이전트, 커밋 아래). 상세 등록 절차는 `APPLE-DEVELOPER-등록가이드.md`.

- [x] **Apple Developer Program 등록** — $99/년. Team ID `AYDX65J9H4`.
- [x] **`public/.well-known/apple-app-site-association`의 `TEAMID` 교체** → `AYDX65J9H4.net.metatake.app` (webcredentials 포함). ⚠️딥링크가 실제로 작동하려면 이 파일이 **`https://metatake.net/.well-known/apple-app-site-association`로 라이브 배포**돼야 함 — PR #7 머지·prod 배포 시점에 반영(오너).
- [x] **`eas init`** ✅ 2026-07-19 — projectId `5f5d3978-00e0-4e1b-8111-6618fac80f12`.
- [x] **App Store Connect 앱 레코드** ✅ 2026-07-19 (ascAppId `6792487455`, eas.json 반영).
- [x] **iOS 빌드·TestFlight** ✅ 빌드 6~9. ⚠️실전 경로는 기존 안내와 다름: ASC API 키는 생성계열 403 → **웹 콘솔 수동(번들ID·인증서·프로파일) + EAS 로컬 서명**. 상세=프리워치 §−1.
- [ ] **APNs 자격증명** — 푸시 켤 때 `eas credentials -p ios`(오너 `!`, 대화형). 미설정이어도 앱 정상(푸시 등록만 무시).

---

## 2. TestFlight 게이트 (정본 §9 — D1: 판단 기능 포함된 상태로 개시)

- [x] TestFlight 업로드 ✅(빌드 9) · 외부그룹 Friends 개설·wonjah@gmail.com 초대(베타심사 `WAITING_FOR_REVIEW`).
- [ ] **외부 테스터 ≥30명 모집** (4주). TestFlight/조기접근 문의는 wonwoo@metatake.net으로 옴 — 그 발신자들을 테스터 목록에 추가.
- [ ] **판정일 = 개시 +35일.** KPI 4개: ① D30 리텐션 ≥20% ② 푸시 옵트인 ≥40% ③ 세션당 결정율 ≥25%(판단=볼래∪패스∪봤어∪Watch탭아웃) ④ 주간 찜 추가 ≥3/활성. 보조지표: 판단 처리량·찜→Seen 전환율·Stale 비율·회고 Find 비율.
- [ ] 미달 시 스토어 출시 보류·재검토. Go면 §3.

---

## 3. App Store 공개 제출 (P4)

- [ ] **리스팅 입력** — `mobile/store/listing-en.md`(미국·기본) + `mobile/store/listing-ko.md`(한국 스토어프론트) 붙여넣기. 부제·키워드·설명 전부 글자수 실측 완료.
- [ ] **스크린샷 업로드** — `mobile/store/shots/01~06.png`(1320×2868, 6.9" 규격). 캡션은 `mobile/store/ASSETS.md`.
- [ ] **연령등급 설문 제출** — 예상 12+(Apple). 다르게 계산되면 재검토.
- [ ] **심사 노트** — `mobile/store/REVIEW-NOTES.md`(무계정 브라우징·4.2 웹뷰 방어·권한 사유·계정삭제·데모 경로).
- [ ] **개인정보 라벨** — `mobile/store/PRIVACY-LABELS.md` 그대로.
- [ ] URL 필드: 지원=`/about`, 마케팅=`/app`, 개인정보=`/privacy`.
- [ ] 출시 후 `/app` 페이지의 "Coming soon" 블록을 실제 배지 링크로 교체(정본 웹레인 TODO).

---

## 4. Android (Play, iOS와 독립 — 언제든)

> **정본 이관: 루트 `HANDOFF-안드로이드-출시.md`** — 순서·오너/AI 역할 분담·함정 체크리스트·인수 기준까지 다른 AI에게 그대로 위임 가능한 작업지시서. (여기 있던 5줄 체크리스트는 그 문서 §0~§9로 흡수·확장됨 — 중복 관리 금지)

---

## 5. (선택) 커넥트 자동연동 켜기 이후

- [ ] 위 프로바이더 env가 다 들어가면, 앱 커넥트 허브의 Trakt/TMDB/Simkl 타일이 "Coming soon" → "Connect"로 바뀜. **첫 실기 연결에서 확인할 것**: OAuth 왕복(pending blob)·Trakt refresh(redirect_uri를 scope 컬럼 JSON에 저장하는 방식)·Simkl 증분(activities+date_from).
- [ ] **`CRON_SECRET` 등록 (커넥트 일1회 자동동기화에 필수)** — `openssl rand -hex 24`. sync-cron은 **fail-closed**라 이 값이 없으면 매일 동기화가 401로 안 돎(수동 "Sync now"는 정상). Vercel이 스케줄 호출에 자동 주입. 푸시 크론과 공유.

---

## 검증 상태 (2026-07-18, 코드 쪽은 전부 그린)

mobile tsc 0 · web tsc 0 신규(베이스라인 20 불변) · **expo-doctor 18/18** · iOS+웹 번들 · **런타임 콘솔 스모크 5라우트 에러 0** · 커넥트 라우트 503 게이트 정상. 마이그 0106(푸시)·0109(커넥트) 프로덕션 적용 완료.

**2026-07-20 추가:** 실기기 QA 2라운드(45 에이전트) 수정 전부 반영 — 크래시 0(네이티브 맵 벤치·WebView 렌더러), 버튼 기대동작 14건, 맵 v2(위성+포스터 핀), 서버 `images[]`+`ts_min` 라이브 검증, 이메일 코드 로그인·Google 로그인 실작동. OTA(`eas update`)로 JS 수정은 재빌드 없이 배포.
