# HANDOFF — Metatake 안드로이드 출시 작업지시서 v1.0 (2026-07-20)

> **이 문서의 용도:** 안드로이드 앱 출시를 **다른 AI(또는 사람)에게 그대로 넘겨도 시행착오 없이 실행되도록** 쓴 작업지시서다. iOS 출시(2026-07-19~20, TestFlight 빌드 9)에서 겪은 모든 함정을 반영했다. 코드는 **한 줄도 새로 쓸 필요 없다** — 앱은 처음부터 크로스플랫폼으로 만들어졌고, 안드로이드 경로(웹뷰 맵 등)는 이미 Expo Go에서 검증됐다(2026-07-17).
> 관련 정본: `HANDOFF-모바일앱-프리워치.md`(앱 기획·AS-BUILT), `mobile/LAUNCH-RUNBOOK.md`(오너 런북), `mobile/store/`(리스팅·자산).
> **선행 조건 단 1개:** 오너의 Google Play 개발자 계정 (§2, $25 1회).

---

## §0 30초 요약 — 순서와 담당

| 순서 | 일 | 담당 | 소요 |
|---|---|---|---|
| 1 | Play 개발자 계정 등록($25) + 신원확인 | **오너** | 15분 + 심사 수일 |
| 2 | 키스토어 생성 (`eas credentials` 1회) | 오너 `!` 실행 (대화형) | 5분 |
| 3 | `eas build -p android` → .aab | AI | 명령 1개, ~20분 |
| 4 | Play Console 앱 생성 + **첫 .aab 수동 업로드**(내부 테스트) | **오너** (콘솔) | 20분 |
| 5 | 데이터 보안 양식·콘텐츠 등급·리스팅 | **오너** (콘솔, §6에 답 전부 준비됨) | 30분 |
| 6 | assetlinks.json SHA256 교체 (딥링크) | AI (오너 릴리즈 1회) | 10분 |
| 7 | 서비스계정 JSON → 이후 제출 자동화 | 오너 (콘솔) + AI | 20분 |
| 8 | (선택) FCM 푸시 | 오너 (Firebase) + AI | 30분 |

내부 테스트 트랙은 **구글 심사 없이 즉시 배포**된다(iOS 외부 테스터의 베타 심사 대기 같은 게 없음). 테스터 이메일만 등록하면 바로 설치 가능.

---

## §1 현재 상태 실사 (2026-07-20 — 전부 이미 되어 있는 것)

**코드/설정 — 완료 ✅ (건드리지 말 것):**

| 항목 | 상태 | 위치 |
|---|---|---|
| 패키지명 | `net.metatake.app` | `mobile/app.json` android.package |
| 어댑티브 아이콘 4종 | foreground/background/monochrome ✅ | `mobile/assets/images/android-icon-*.png` |
| 앱링크 인텐트 필터 | metatake.net `/film` `/director` `/what-to-watch`, autoVerify ✅ | app.json android.intentFilters |
| 커스텀 스킴 | `metatake://` (OAuth 콜백·딥링크) | app.json scheme |
| 빌드 타입 | app-bundle(.aab), versionCode 자동증가(remote) | `mobile/eas.json` |
| 제출 트랙 | `submit.production.android.track: "internal"` | eas.json |
| **서명 소스** | ⚠️ 2026-07-20 수정됨: `credentialsSource:"local"`은 **ios 블록에만** 있음. 안드로이드는 EAS 원격 키스토어를 쓴다. **이 상태를 절대 되돌리지 말 것** — 프로필 전역에 local이 있으면 안드로이드 빌드가 키스토어를 못 찾고 죽는다 | eas.json build.production |
| OTA 채널 | production 채널이 **iOS와 공유** — 지금까지의 모든 `eas update`가 이미 Android 번들도 발행함(runtime 1.0.0). 첫 빌드 설치 즉시 최신 JS 수신 | app.json updates.url |
| 맵 | **웹뷰 렌더러(MapWebView)가 곧 안드로이드 경로** — 위성지도+포스터 핀 전부 작동. MapLibre GL Native는 iOS 스토어 빌드를 즉사시켜 벤치됨(빌드 8 실증). **안드로이드에서도 네이티브 맵 재활성화 금지** | `mobile/src/screens/MapWebView.tsx` |
| 로그인 | 이메일 6자리 코드 ✅(템플릿 2026-07-20 교체) · Google OAuth ✅(PKCE + Supabase redirect `metatake://**` 허용됨) · Apple 버튼은 `Platform.OS==="ios"` 게이트라 안드로이드에 안 뜸 ✅ | — |
| 스토어 리스팅 텍스트 | 영/한 완성 | `mobile/store/listing-en.md` `listing-ko.md` |
| Play 자산 | 아이콘 512(`play-icon-512.png`)·피처 그래픽 1024×500(`play-feature-graphic.png`)·스크린샷 | `mobile/store/shots/` |
| 개인정보 매핑 | 수집 항목 정리본 (§6 답안의 근거) | `mobile/store/PRIVACY-LABELS.md` |
| assetlinks.json | 파일 존재, **SHA256 지문만 플레이스홀더** (§7에서 교체) | `public/.well-known/assetlinks.json` |

**식별자 모음 (명령에 그대로 쓰는 값):**

```
EAS 프로젝트: 5f5d3978-00e0-4e1b-8111-6618fac80f12 (owner: wonwoometatakes-team, slug: wonwoometatake)
패키지: net.metatake.app  ·  버전: 1.0.0 (runtimeVersion policy: appVersion)
코드 정본: github.com/epiphtheroy/kyniq 의 mobile/ (main 브랜치이 최신 릴리즈)
Supabase: jvgarcqrtsmgfimdcwgo (도쿄)  ·  프로덕션: https://metatake.net
EAS 로그인 계정: wonwoo_metatake (오너 로컬에 로그인돼 있음)
node 경로: PATH에 없음 → `export PATH="$HOME/.local/node/bin:$PATH"` 선행 필수
```

**없는 것 (이 문서가 만드는 것):** Play 계정, 키스토어, google-services.json(푸시, 선택), assetlinks 실지문, 서비스계정 JSON.

---

## §2 [오너] Google Play 개발자 계정

1. https://play.google.com/console → **계정 만들기(개인)** — $25 1회 결제 (연회비 없음).
2. 신원확인(신분증) 요구될 수 있음 — **승인까지 수일 걸릴 수 있으니 가장 먼저 시작**할 것.
3. 승인 후 → **앱 만들기**: 이름 `Metatake` · 기본 언어 `English (US)` · 앱 · **무료**. (한국어 리스팅은 나중에 번역 추가로 넣는다 — listing-ko.md 준비돼 있음)
4. ⚠️ **개인 계정은 2023년 이후 규정상 "20명 테스터 × 14일 비공개 테스트" 후에만 프로덕션(공개) 출시 가능.** 내부 테스트·비공개 테스트는 즉시 가능하므로 초기엔 문제 없지만, **공개 출시 계획이 서면 테스터 20명 모집이 필요**하다는 걸 미리 알아둘 것.

---

## §3 키스토어 (서명) — 오너 터미널 1회

EAS가 만들고 보관하는 **원격 키스토어**를 쓴다(분실 위험 0, 권장). `eas build`의 키스토어 생성 확인은 **대화형**이라 오너 터미널이 필요하다 — iOS 때 "비대화형 TTY 없음" 함정과 동일 계열. 오너에게 이 한 줄을 `!`로 실행시켜라:

```bash
export PATH="$HOME/.local/node/bin:$PATH" && cd <repo>/mobile && eas credentials -p android
```

프롬프트 응답: `production` 선택 → `Keystore: Set up a new keystore` → 기본값 Enter 연타 → "Generate new keystore?" **Yes**. 끝나면 EAS 서버에 저장된다(로컬 파일 없음).

- **함정:** `eas build --non-interactive`를 키스토어 없이 먼저 돌리면 "Generating a new Keystore is not supported in --non-interactive mode" 로 실패한다. 반드시 §3을 먼저.
- 대안(오너 터미널이 안 될 때): `keytool`로 로컬 키스토어를 만들어 `credentials.json`에 배선하는 경로도 있으나(iOS 때 썼던 로컬 서명의 안드로이드판), **원격 키스토어가 되면 쓰지 말 것** — 관리 부담만 늘어난다.

---

## §4 [AI] 빌드

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd <repo>/mobile
eas build --platform android --profile production --non-interactive --no-wait
```

- 기대 출력: `Using remote Android credentials (Expo server)` → `Uploaded to EAS` → 빌드 URL. 클라우드 ~15-25분.
- 상태 확인: `eas build:view <빌드ID>` → `Status finished` + **Application Archive URL(.aab)**.
- versionCode는 EAS가 자동 증가(appVersionSource remote). 손대지 말 것.
- ⚠️ 워크트리가 더티면 커밋 먼저(EAS는 git 상태를 업로드함). ⚠️ `credentials/`·`credentials.json`(iOS 로컬서명)은 gitignore돼 있어야 정상 — 절대 커밋 금지.

---

## §5 [오너] 첫 업로드 + 내부 테스트 (구글 심사 없음)

**첫 .aab는 Play Console UI로 수동 업로드해야 한다** (앱 레코드에 서명키를 등록하는 과정이라 API로 불가 — iOS에서 앱 레코드를 웹으로 만들었던 것과 동일 계열).

1. .aab 다운로드: §4의 Application Archive URL (AI가 `curl -L -o metatake.aab <URL>`로 받아 오너에게 경로 전달).
2. Play Console → Metatake → **테스트 → 내부 테스트** → **새 버전 만들기**.
3. "Google에서 앱 서명 키 관리"(Play App Signing) **동의** (기본값. 이걸 써야 §7 지문도 여기서 나옴).
4. .aab 드래그 업로드 → 버전 이름 자동 → **저장 후 검토 → 내부 테스트로 출시**.
5. **테스터 탭** → 이메일 목록 만들기: `wonjah@gmail.com`, 오너 지메일 등 → 저장 → **참여 링크 복사**해서 테스터에게 전달 (테스터는 링크 열고 "참여" → Play 스토어에서 설치).

---

## §6 [오너] Play 필수 양식 — 답안지 (콘솔 → 앱 콘텐츠)

| 양식 | 답 |
|---|---|
| **개인정보처리방침 URL** | `https://metatake.net/privacy` |
| **광고** | 광고 없음 |
| **앱 액세스 권한** | 전체 기능에 로그인 불필요(탐색 가능). 판단 저장만 로그인 — "일부 기능 제한" 선택 시 데모 계정 불필요 사유: 이메일 OTP 즉시 가입 가능 |
| **콘텐츠 등급 설문** | 카테고리: 유틸리티/생산성 아님 → **"기타"**. 폭력·성적 콘텐츠·도박 등 전부 "아니오". 사용자 생성 콘텐츠 "아니오"(개인 기록만, 공유·노출 없음). 영화 **정보** 앱이므로 등급은 보통 "전체이용가"로 나옴 |
| **타겟층** | 18세 이상 (아동 대상 아님 → 아동 관련 규정 회피) |
| **데이터 보안(Data safety)** | 근거는 `mobile/store/PRIVACY-LABELS.md`. 요약: **수집** ①이메일 주소(계정 기능, 필수 아님) ②앱 내 활동=시청기록·평점·찜(계정 기능, 필수 아님). **미수집**: 위치(지도 "내 주변"은 기기에서만 사용, 서버 전송 없음), 연락처, 사진, 광고 ID. **전송 중 암호화**: 예. **삭제 요청 가능**: 예(앱 내 계정 삭제 → `/api/v1/app/account-delete`). **제3자 공유**: 없음 |
| **정부 앱/금융 앱/뉴스 앱** | 전부 아니오 |
| **스토어 리스팅** | `mobile/store/listing-en.md`에서 복붙: 앱 이름 `Metatake — Film Judgment`(30자 내) · 짧은 설명(80자) · 전체 설명(4000자). 그래픽: 아이콘 `mobile/store/shots/play-icon-512.png`, 피처 그래픽 `play-feature-graphic.png`(1024×500), 폰 스크린샷 `shots/` 2장 이상 |

---

## §7 [AI+오너] 딥링크 지문 (assetlinks.json)

앱링크(https://metatake.net/film/... → 앱 열림)는 서버의 지문 파일이 실서명 지문과 일치해야 작동한다.

1. **지문 얻기** (§5-3에서 Play App Signing을 켰으므로): Play Console → 설정 → **앱 무결성** → 앱 서명 키 인증서 → **SHA-256 지문 복사** (오너가 복사해 AI에게 전달, 또는 AI가 오너 브라우저로 읽음).
   - EAS 업로드 키 지문도 필요: `eas credentials -p android` 출력의 SHA256 — **두 지문 모두** 넣는 게 안전(업로드키로 서명된 내부테스트 설치 + Play 재서명 프로덕션 둘 다 커버).
2. **파일 교체**: `public/.well-known/assetlinks.json`의 `sha256_cert_fingerprints` 배열에 두 지문 기입. 형식:
```json
[{"relation": ["delegate_permission/common.handle_all_urls"],
  "target": {"namespace": "android_app", "package_name": "net.metatake.app",
             "sha256_cert_fingerprints": ["AA:BB:...", "CC:DD:..."]}}]
```
3. **배포**: ⚠️ `public/`은 워처 자동배포 대상이 아니다 — **수동 커밋 → staging → 오너 릴리즈** 경로 필수 ([[crawler-handshake-referrer]] 규칙과 동일).
4. **검증**: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://metatake.net&relation=delegate_permission/common.handle_all_urls` 가 앱 패키지를 반환하면 성공.

---

## §8 [선택] 푸시 알림 (FCM) — 첫 출시에 필수 아님

미설정 시 앱은 우아하게 무시한다(푸시 등록만 실패, 다른 기능 무관). 켜려면:

1. [오너] https://console.firebase.google.com → 프로젝트 추가(`metatake`) → 안드로이드 앱 추가(패키지 `net.metatake.app`) → **google-services.json 다운로드**.
2. [AI] 파일을 `mobile/google-services.json`에 두고 `app.json` android에 `"googleServicesFile": "./google-services.json"` 추가 → **재빌드 필요**(네이티브 설정).
3. [오너 `!`] FCM V1 서비스계정 키를 EAS에 등록: Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 → `eas credentials -p android` → `Google Service Account` → 업로드.
4. 서버 쪽 푸시 워커는 Expo Push Service를 쓰므로 **변경 불필요**.

---

## §9 [AI] 이후 제출 자동화 (두 번째 빌드부터)

1. [오너] Play Console → 설정 → **API 액세스** → Google Cloud 프로젝트 연결 → 서비스 계정 만들기(권한: **출시 관리자**) → JSON 키 다운로드 → 파일을 AI에게 전달 (예: `~/Downloads/play-service-account.json`).
2. [AI] `eas.json` submit 블록에 명시 (⚠️ iOS의 교훈: **환경변수만으론 비대화형 제출 실패** — 반드시 eas.json에 경로를 적는다):
```json
"submit": { "production": { "android": {
  "track": "internal",
  "serviceAccountKeyPath": "/Users/jerryje/Downloads/play-service-account.json"
} } }
```
3. 이후 루틴: `eas build -p android --profile production --non-interactive --no-wait` → 완료 시 `eas submit -p android --profile production --latest --non-interactive`.

---

## §10 iOS에서 배운 함정 → 안드로이드 재발 방지 체크리스트

| # | 함정 (iOS 실증) | 안드로이드 규칙 |
|---|---|---|
| 1 | MapLibre GL Native가 스토어 빌드 즉사 (빌드 8) | **네이티브 맵 재활성화 금지.** map.tsx/FilmMiniMap의 웹뷰 분기 유지 |
| 2 | QA 에이전트 API 폭주 → 자사 WAF가 홈 IP /24 30일 차단 (오너 폰까지 403) | 프로덕션 API 검증은 **10분당 수십 회 이하로 스로틀**. 증상(전면 403 "Forbidden") 나오면 `bot_blocks` 먼저 확인 |
| 3 | 비대화형 제출 실패 ("API Keys cannot be set up in --non-interactive") | 제출 자격증명은 **eas.json에 명시** (§9-2) |
| 4 | 자격증명 생성은 TTY 필요 | 키스토어 생성(§3)은 **오너 `!` 1회** 선행 |
| 5 | OTA는 재실행 2회에 적용 | 테스터 안내문에 "앱 껐다 두 번 켜기" 포함 |
| 6 | 프로필 전역 `credentialsSource:local` | **ios 블록에만** 두기 (2026-07-20 수정됨 — 되돌리지 말 것) |
| 7 | Management/외부 API 403 ≠ 권한 부족일 수 있음 | UA 헤더부터 의심 (Cloudflare 1010) |
| 8 | 첫 앱 레코드/업로드는 콘솔 수동 | §5는 오너 UI 작업으로 계획 (API 시도로 시간 낭비 금지) |

---

## §11 인수 기준 (내부 테스트 설치 후 전부 통과해야 완료)

- [ ] 홈 덱 로드·판단 3버튼(♥/✕/✓) 작동, 로그아웃 상태에서 판단 탭 → **로그인 폼 직행**(country 스텝 아님)
- [ ] 영화 상세: 헤더 스와이프(스틸+포스터)·본문 이미지 2장·미니맵(위성)·Honors는 계보 있는 영화만
- [ ] 맵 탭: 위성지도+포스터 핀+말풍선(TS 배지·영화 열기)·"영화로 돌아가기" 칩
- [ ] 로그인: 이메일 6자리 코드 ✦ Google (Apple 버튼은 안 보여야 정상)
- [ ] 검색: 장르×연대×TS하한×정렬 조합
- [ ] 커넥트: 파일 임포트(Letterboxd CSV) 동작, OAuth 3종은 "coming soon" 정상
- [ ] 딥링크: 크롬에서 metatake.net/film/parasite-2019 → 앱 열림 (§7 후)
- [ ] OTA: `eas update` 발행 → 재실행 2회 → 반영
- [ ] 국가 한국 선택 → 한국어 UI + 왓챠/티빙/wavve 가용성

---

## §12 다른 AI에게 넘길 때

이 문서 경로만 주면 된다:
> "Metatake 안드로이드 출시를 진행해줘. 작업지시서는 리포지토리 루트 `HANDOFF-안드로이드-출시.md`이고, §0의 순서대로, 오너 액션(§2·§5·§6)과 AI 액션을 구분해서 진행해. §10의 함정 체크리스트를 어기지 마."
