# Metatake 앱 — 오너 착수 런북 (2026-07-18)

> 코드·기획·자산·리스팅·스토어 킷은 **전부 완성**돼 있습니다(정본: 루트 `HANDOFF-모바일앱-프리워치.md` v4.0 + `HANDOFF-커넥트-기록이관.md`). 이 문서는 **오직 오너만 할 수 있는 계정·콘솔 작업**을, Apple 계정을 만든 순간부터 **순서대로** 모은 단일 체크리스트입니다. 각 항목의 상세 근거는 괄호의 정본 절 참조.

---

## 0. 지금 당장(계정 없이도 가능) — 완료해두면 좋은 것

- [ ] **`CONNECT_TOKEN_KEY` 생성·등록** — 커넥트 OAuth 토큰 암호화 키. 터미널: `openssl rand -hex 32` → 나온 64자를 Vercel 프로젝트 환경변수에 `CONNECT_TOKEN_KEY`로 등록. (이거 없으면 커넥트 자동연동 타일이 전부 "Coming soon"으로 표시 — 앱은 정상 동작)
- [ ] **Supabase Auth 콘솔** (계정 불요):
  - Apple provider 활성화(Sign in with Apple) — Apple 계정 생기면 완성
  - **Google provider 활성화** — Google Cloud OAuth 클라이언트 생성 후 client id/secret 입력. Redirect URL 화이트리스트에 `metatake://auth-callback` + 개발용 `exp://<맥 LAN IP>:8081/--/auth-callback`
  - 이메일 OTP 템플릿에 `{{ .Token }}` 추가 (앱 로그인·심사 데모가 이것에 의존)
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
- [ ] **`eas init`** (mobile/ 디렉터리에서) — 푸시 projectId 발급. (Expo 계정 로그인 필요·무료 — 에이전트가 대신 못 함)
- [ ] **App Store Connect에서 앱 레코드 생성** — §5 프리필값(이름 Metatake·번들 net.metatake.app·SKU metatake-app·English US). 생성 후 그 **ascAppId**를 `eas.json` submit.production.ios에 추가하면 제출 자동화(현재 appleTeamId는 이미 채움).
- [ ] **`eas build --platform ios`** — dev client 빌드. ⚠️이 빌드가 구워지는 순간 SDK 54 제약(Expo Go 상한)이 풀리므로, 원하면 `npx expo install --fix`로 최신 SDK 승격 가능. 단 **그 시점부터 Expo Go 검토 경로는 끝남**(테스터 전원이 dev/TestFlight 빌드 필요) — 순서를 뒤집지 말 것(정본 §13-13, §15.4).
- [ ] **APNs 자격증명** — EAS가 Apple 계정에서 자동 생성(`eas credentials`).

---

## 2. TestFlight 게이트 (정본 §9 — D1: 판단 기능 포함된 상태로 개시)

- [ ] **TestFlight 빌드 업로드 + 외부 테스터 ≥30명 모집** (4주). TestFlight/조기접근 문의는 wonwoo@metatake.net으로 옴 — 그 발신자들을 테스터 목록에 추가.
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

- [ ] **Google Play 등록** — $25 **1회**(연회비 없음, 전 세계 커버).
- [ ] **`eas build --profile production --platform android`** (AAB). 내부 테스트 APK는 `--profile preview`로 계정 전에도 가능.
- [ ] **`public/.well-known/assetlinks.json`의 SHA256**을 Play 앱서명 지문으로 교체(수동 커밋).
- [ ] **FCM v1 서비스계정 키** — Firebase 콘솔 → `eas credentials` 업로드.
- [ ] 리스팅: `listing-ko.md`/`listing-en.md` + Play 피처 그래픽 `mobile/store/shots/play-feature-graphic.png`(1024×500) + 아이콘 `play-icon-512.png`.

---

## 5. (선택) 커넥트 자동연동 켜기 이후

- [ ] 위 프로바이더 env가 다 들어가면, 앱 커넥트 허브의 Trakt/TMDB/Simkl 타일이 "Coming soon" → "Connect"로 바뀜. **첫 실기 연결에서 확인할 것**: OAuth 왕복(pending blob)·Trakt refresh(redirect_uri를 scope 컬럼 JSON에 저장하는 방식)·Simkl 증분(activities+date_from).
- [ ] **`CRON_SECRET` 등록 (커넥트 일1회 자동동기화에 필수)** — `openssl rand -hex 24`. sync-cron은 **fail-closed**라 이 값이 없으면 매일 동기화가 401로 안 돎(수동 "Sync now"는 정상). Vercel이 스케줄 호출에 자동 주입. 푸시 크론과 공유.

---

## 검증 상태 (2026-07-18, 코드 쪽은 전부 그린)

mobile tsc 0 · web tsc 0 신규(베이스라인 20 불변) · **expo-doctor 18/18** · iOS+웹 번들 · **런타임 콘솔 스모크 5라우트 에러 0** · 커넥트 라우트 503 게이트 정상. 마이그 0106(푸시)·0109(커넥트) 프로덕션 적용 완료.
