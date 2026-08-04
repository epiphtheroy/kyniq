# HANDOFF — iOS·Android 공동 관리 아키텍처 v2.0 (2026-08-04)

> **이 문서를 받은 사람(또는 AI)에게:** 이건 "지난 작업 보고서"가 아니라 **여기서 이어서 일하기 위한 문서**다. §0을 읽고 §2의 큐 맨 위부터 집어라. 손대기 전에 §6 불변식과 §7 함정 목록은 반드시 읽어라 — §7은 "고쳐야 할 것처럼 보이지만 이미 확인 결과 멀쩡한 것들"이고, 여기 적힌 걸 다시 고치면 순수한 낭비다.
>
> **관련 정본**
> - `mobile/RUNBOOK-android.md` — **에뮬레이터로 앱 띄우고 보는 법.** 화면을 봐야 하면 여기부터.
> - `HANDOFF-모바일앱-프리워치.md` — 앱 기획·AS-BUILT 정본. §13 불변식 1~18조(이 문서가 19~23조를 더한다).
> - `HANDOFF-안드로이드-출시.md` — 스토어 출시 런북(§2 Play 계정 · §5 콘솔 · §6 양식 답안). 절차는 유효하나 **§0의 "코드는 한 줄도 새로 쓸 필요 없다"는 폐기**됐다.
> - `mobile/store/shots-android/` — Play용 안드로이드 스크린샷 4장(9:16).

---

## §0 다음 AI에게 — 30초 오리엔테이션

**한 줄:** 앱은 안드로이드에서 **돌아간다**(실기 확인). 구조·검증장치·핵심 결함 수정은 끝났고, 남은 건 마감(P1 폴리시)과 오너 손이 필요한 스토어 작업이다.

**이 저장소가 이 작업에 대해 정한 것 셋:**

1. **`mobile/src/platform/`이 `Platform.OS`가 허용되는 유일한 곳이다.** 다른 21,000줄은 플랫폼을 모른다. (현재 seam 밖 위반 **0건**)
2. **모든 플랫폼 발산은 `capabilities.ts`(발산 원장)에 항목이 있어야 한다.** 항목 없는 분기는 버그이고 CI가 막는다.
3. **규칙은 `scripts/check-platform.mjs`가 검사한다.** 사람이 눈으로 지키는 규칙은 안 쓴다.

**바로 할 수 있는 검증:**

```bash
cd mobile
npx tsc --noEmit && node scripts/check-platform.mjs
npx expo export --platform android --output-dir /tmp/x
```

셋 다 지금 통과한다. 하나라도 깨진 채로 커밋하지 마라.

**화면을 보려면** `mobile/RUNBOOK-android.md`. 에뮬레이터는 이 머신에 설치돼 있고 AVD 이름은 `Metatake_Pixel`이다.

**⚠️ 가장 중요한 교훈 하나:** 이 앱의 안드로이드 지도는 **문자열로 조립되는 WebView 페이지 안의 문법 오류** 때문에 통째로 죽어 있었다. `tsc`도 린트도 `expo export`도 전부 통과했다. **생성 코드는 정적 검사의 사각지대다.** 그 영역을 건드리면 반드시 실행해서 확인해라(§4).

---

## §1 지금 상태 — AS-BUILT

### 1.1 구조 (P0, 완료)

| 항목 | 상태 |
|---|---|
| **`src/platform/` seam** — `capabilities` `tokens` `back` `haptics` `keyboard` `notifications` `auth-providers` `env` `map/` | ✅ 9모듈 |
| **기존 `Platform.OS` 분기 10곳 전량 이관** | ✅ seam 밖 잔여 **0** |
| **발산 원장** `capabilities.ts` — 9항목 + `qaMatrix()` + `debts()` | ✅ |
| **`scripts/check-platform.mjs`** — 하드 6규칙 + 래칫 5개(`platform-baseline.json`) | ✅ |
| **`.github/workflows/mobile.yml`** — tsc · 플랫폼규칙 · **양 플랫폼 번들** | ✅ mobile 최초 CI |
| 벤치 모듈 **삭제** — `@maplibre/maplibre-react-native`(deps+plugin) · `MapNative.tsx`(503줄) · `FilmMiniMap`의 `NativeMini` · `expo-symbols` | ✅ |
| `app.config.js` 안드로이드 Maps 키 주입 삭제 (+ 재발 방지 하드룰 R5) | ✅ |
| `allowBackup: false` (`expo-build-properties`) — refresh token이 Google Drive로 백업되던 문제 | ✅ |

### 1.2 안드로이드 동작 수정 (실기 확인)

| 항목 | 상태 |
|---|---|
| **지도 전 경로** — 위성·클러스터·17,337핀·핀탭 말풍선·영화 열기 | ✅ §4 |
| 지도 **실패 채널** — `window.onerror`·스크립트 onerror·엔진 부재 가드·15초 워치독·`onError`/`onHttpError`/`onRenderProcessGone`·사유 표시+재시도 | ✅ |
| 지도 **리사이즈** — `ResizeObserver`→`map.resize()` (분할화면·폴더블·회전) | ✅ |
| **온보딩 안드로이드 백** = 스텝 되돌리기 · **리더 백** = 페이지 되돌리기 | ✅ |
| **탭바 불투명 크롬** (72% 반투명+blur없음 결함 해소) | ✅ |
| **Android 리플** + 시스템 클릭음 억제 (`Tactile`) | ✅ |
| **뒤로가기/공유 글리프 토큰** — 셰브론→화살표 12곳 | ✅ |
| **모달 계약** — 4곳 전부 `statusBarTranslucent`+`navigationBarTranslucent` | ✅ |
| **햅틱 드래그 스로틀** — 별점 트랙 연속 진동 방지(`haptic.step`) | ✅ |
| **알림 아이콘** — monochrome + 브랜드 색 (안드로이드는 실루엣으로 그림) | ✅ |

### 1.3 검증 사실

- `tsc` PASS · `check-platform` PASS · **`expo export --platform android` 성공(7.43MB)** — 이 저장소에서 안드로이드 모듈 그래프가 검증된 첫 사례. iOS 번들 회귀 없음(7.44MB).
- **에뮬레이터 실기 QA 2회** — 온보딩→탭→영화상세→지도 완주. 원장 항목 `systemBack`·`appleSignIn`·`chromeSurface` 육안 확인.
- **iOS 빌드 17** store 배포 2026-07-31 성공 → iOS 서명은 EAS 원격으로 정상. 새 iOS 네이티브 빌드는 **막혀 있지 않다**.

### 1.4 아직 아닌 것

- **안드로이드 네이티브 빌드 0회** — 키스토어가 없다(오너 액션, §9).
- **실기기 검증 0회** — 오너가 기기 구입 예정. 에뮬레이터가 못 잡는 것은 `RUNBOOK-android.md` 말미 표 참조.
- P1 폴리시 잔여 — §2.

---

## §2 다음 작업 큐 — 위에서부터

각 항목은 **왜 · 어디 · 종료 시험**을 갖는다. 종료 시험을 통과하지 못하면 끝난 게 아니다.

### Q1. 덱 스와이프를 UI 스레드로 (P1, 가장 큼)

- **왜** 앱의 대표 제스처가 유일하게 `useNativeDriver:false`라 매 프레임 JS 브리지를 건넌다. 안드로이드 최대 성능 리스크이고 **iOS에도 이득**이다. 앱의 나머지 95%는 이미 Reanimated다.
- **어디** `app/(tabs)/index.tsx:874` 부근, `app/navigator/drive.tsx`도 같은 패턴.
- **종료 시험** 실기기에서 덱 스와이프가 60fps로 붙어 움직인다. 에뮬레이터로는 판정 불가(소프트웨어 GPU).

### Q2. `elevation()` 토큰 배선

- **왜** 안드로이드는 `shadowRadius`/`Offset`/`Opacity`를 전부 무시하고 `elevation`만 본다. 지금은 `theme.ts`의 `shadow.card`/`float`를 화면들이 그대로 펼쳐 쓴다.
- **어디** `src/platform/tokens.ts`에 `elevation(level)`이 **이미 있다**. `theme.ts`의 `shadow`를 그걸로 대체하고 호출부를 옮겨라.
- **종료 시험** 래칫 `rawShadowLiterals`가 1→0. 에뮬레이터에서 카드 그림자가 남아 있다.

### Q3. `useBottomClearance()` 배선

- **왜** 탭바 하단 여백이 8곳에 흩어진 매직넘버(120·96·76)다. iOS 바 기하학에 맞춰져 있다.
- **어디** `src/platform/insets.ts`를 **새로 만들고**(`useBottomTabBarHeight` + `insets.bottom`) 8곳을 갈아라.
- **종료 시험** 래칫 `magicClearance`가 9→0. 3버튼 내비 에뮬레이터에서 마지막 항목이 안 가린다.

### Q4. `<Sheet>` 하나로 통합

- **왜** Modal이 4곳이고 계약(translucent·scrim·radius)이 손으로 복제된다. 방금 `statusBarTranslucent` 누락 비대칭을 고쳤지만 **구조가 그대로면 다시 갈라진다**.
- **어디** `ui.tsx`에 `<Sheet>`를 만들고 `RateSheet`·`ui.tsx` PickerSheet·`my.tsx` 설정·`connect.tsx`를 태워라.
- **종료 시험** 래칫 `modalConstructions` 4→1. 네 시트 전부 에뮬레이터에서 전체화면 스크림.

### Q5. 자잘한 안드로이드 정확도 (한 묶음)

| 무엇 | 어디 |
|---|---|
| `selectionColor` 4개 입력에 누락(Material 기본 파랑 캐럿) | `SignInPanel.tsx:39` 외 |
| shimmer 전역 sweep이 영구 실행 (스켈레톤 0개여도) | `motion.tsx:73` |
| shimmer가 `Dimensions`를 1회 스냅샷 (앱 전체는 `useWindowDimensions`) | `motion.tsx:109` |
| `ProgressBar`가 width 애니메이션(프레임마다 레이아웃) | `motion.tsx:551` |
| 미니맵이 안드로이드에서 `interactive` prop 무시 (죽은 사진) | `FilmMiniMap.tsx` WebViewMini |
| 웹뷰 CSS `-apple-system` → 안드로이드에서 Roboto 폴백 (지도 UI만 다른 폰트) | `MapWebView.tsx:73` |
| 직접 `expo-haptics` 임포트 2곳(seam 우회) | `connect.tsx` `film/[slug].tsx` — 래칫 `directHapticImports` |
| 안드로이드 위치 권한 rationale 없음 (차가운 시스템 프롬프트) | "Near me" 흐름 · i18n 키 신설 필요 |
| 임포트 파일명에 확장자 없으면 CSV 판정 실패 | `lib/connect.ts` 파서 |

### Q6. 지도 엔진 벤더링 (강건성)

- **왜** ⚠️ **이건 검은 지도의 원인이 아니었다**(§4). 그러나 unpkg **5.6.0** vs `package.json` **5.24.0** 버전 이중화와 제3자 CDN 의존은 사실이다.
- **선택지** ①앱에 인라인(번들 +1MB·OTA마다) ②`metatake.net`에서 서빙(번들 0·오너 릴리즈 1회 필요·`public/`은 수동 커밋) ③현행 유지. **②를 권하나 오너 판단이 필요하다.**
- **종료 시험** 래칫 `cdnUrls` 4→0.

### Q7. 부채 2건 (원장이 세고 있음)

- `pushDelivery` — FCM 미설정이라 안드로이드 푸시 토글이 혼자 되돌아간다. **Expo Go로는 검증 불가**(SDK 53에서 원격 푸시 제거). 개발 빌드 필요.
- `mapFeatureDelta` — **iOS에 위성·클러스터링이 없고**, 08-03 오너 지시 2건도 iOS 렌더러에만 들어갔다. 안드로이드 작업이 아니라 **iOS 쪽 결손**이다.

---

## §3 설계 = 이 작업의 헌법

### 3.1 원칙

> **플랫폼을 아는 코드는 적을수록 좋은 게 아니라, 한 곳에 모여 있을수록 좋다.**

분기 개수를 줄이는 게 목표가 아니다. `HANDOFF-모바일앱-프리워치.md` §8이 이미 "분기 추가 0 목표"를 **선언**했고 지도에서 실패했다. 선언은 드리프트를 막지 못한다. 목표는 **"안드로이드가 iOS와 뭐가 다른가?"에 코드가 대답하게** 만드는 것이다.

### 3.2 층

```
층 3  app/**                     화면       플랫폼 무지 — Platform 금지
층 1½ src/components/ui.tsx      프리미티브  Ui·Serif·Tactile — platform/tokens 소비
층 1  src/theme.ts               토큰       platform/tokens 재수출 (불변식 14 = SSOT)
층 2  src/platform/**            seam       ★ 유일하게 Platform.OS 허용
층 0  src/lib · state · i18n     코어       플랫폼 무지 — Platform 금지
```

**핵심 구분: 값의 차이는 토큰, 구현의 차이는 모듈.** 탭바 blur/solid는 값이라 토큰으로 충분하다(SDK 55에서 한 줄로 뒤집힌다). 지도 렌더러는 구현이라 모듈이 필요하다. **값 차이를 모듈로 만들면 과설계고, 구현 차이를 값으로 만들면 인라인 분기로 샌다.**

`theme.ts`가 `Platform`을 직접 알지 않는 이유: 그러면 허용 목록이 둘이 되고 grep 규칙이 흐려진다. `platform/tokens.ts`가 만들고 `theme.ts`가 재수출한다.

### 3.3 발산 원장 — 설계의 심장

`src/platform/capabilities.ts`. 현재 9항목:

`mapEngine` · `mapFeatureDelta`(debt) · `appleSignIn` · `chromeSurface` · `pressFeedback` · `hapticVocabulary` · `systemBack` · `swipeBackGesture` · `pushDelivery`(debt)

각 항목은 `ios` / `android` / `why` / `parity`(acceptable·temporary·debt) / `files` / `qa`를 갖는다. 여기서 셋이 파생된다:

1. **QA 매트릭스** (`qaMatrix()`) — "안드로이드에서 뭘 봐야 하나"의 완전한 목록. 실기기가 오는 날의 첫날 할 일.
2. **부채 카운트** (`debts()`) — `parity:"debt"`가 늘지 않는지.
3. **리뷰 질문** — PR에서 분기가 늘면 "원장에 항목을 추가했는가?"만 물으면 된다. 추가했으면 결정, 안 했으면 버그.

🚨 **원장은 코드보다 먼저 거짓말할 수 있다.** 실제로 `pressFeedback`이 "안드로이드는 리플을 받는다"고 선언해놓고 코드는 안 하고 있었다. **원장에 뭘 쓰면 같은 커밋에서 구현하거나, 구현 안 했다고 쓰라.**

### 3.4 게이트 — `scripts/check-platform.mjs`

**하드(0이어야 함)**

| # | 규칙 |
|---|---|
| R1 | `Platform.OS/select/Version`은 `src/platform/**`에서만 |
| R2 | `@divergence <key>` 태그의 key가 `capabilities.ts`에 존재 |
| R3 | `app/**`에 `.ios./.android./.native.` 형제 파일 금지(라우트는 분기하지 않는다) |
| R4 | 금지 모듈(`@maplibre/maplibre-react-native`·`expo-symbols`)이 deps·plugins에 없음 |
| R5 | iOS Maps 키가 안드로이드 config로 새지 않음 |
| R6 | `UI_LOCALE === "en"` (오너 불변식: UI 영어 전용) |

**래칫(늘면 실패)** — `directHapticImports=2` · `modalConstructions=4` · `cdnUrls=4` · `rawShadowLiterals=1` · `magicClearance=9`

고칠 때마다 `node scripts/check-platform.mjs --update-baseline`으로 낮춰라. **절대 올리지 마라.**

⚠️ **게이트도 틀릴 수 있다.** 이 파일에서 두 번 실증됐다: ①한글 코드포인트 규칙은 UI 문자열을 하나도 못 잡고 주석만 잡아서 폐기했다 ②`<Modal` 정규식이 줄 단위라 여러 줄 선언을 놓쳐 "3→1 개선"이라는 거짓 신호를 냈다(실제 4곳). **규칙을 추가하면 그 규칙이 정말 의도한 걸 세는지 먼저 확인하라.**

---

## §4 지도 — 전말 (가장 중요한 사례)

### 4.1 무슨 일이 있었나

안드로이드 지도가 **빈 검은 사각형 + "Loading…" 영구 정지**였다. 에러도 재시도도 없었다.

6축 정적 감사와 129건 적대적 검증은 원인을 **CDN 실패**로 지목했다. **틀렸다.**

에러 채널(`window.onerror` → `postMessage`)을 신설하자 첫 실행에서 즉시:

```
Uncaught SyntaxError: Unexpected string @120
```

**`MapWebView.tsx:170` 이중 이스케이프.** 웹뷰 페이지 전체가 TypeScript 템플릿 리터럴 안에 있는데, *브라우저*를 위해 쓴 `\'`의 백슬래시를 **TypeScript가 먼저 소비**했다. 생성된 페이지엔 슬러그 자리에 빈 문자열 둘이 찍힌 `__openFilm('' + esc(slug) + '')`가 남았고, 이는 문법 오류다. **문법 오류는 스크립트 전체를 실행 불가로 만든다** — 지도도, 핀도, `ready`도 없다.

### 4.2 어떻게 고쳤나

인라인 `onclick` 문자열 조립을 폐기하고 `data-slug` + 위임 클릭 리스너 하나로 교체했다. **이스케이프를 더 조심하는 게 아니라 이스케이프할 따옴표를 없애는 것**이 수정이다.

(초고 주석이 깨진 줄을 **백틱으로 인용**하다 템플릿 리터럴을 다시 닫아버렸다. 그만큼 잘 미끄러진다 — 이 파일을 편집할 땐 백틱·백슬래시·`${`를 조심하라.)

### 4.3 남긴 방어

- `window.onerror` → `{type:"fatal", reason}` 로 사유를 앱에 보낸다
- 엔진 스크립트 태그 `onerror`
- `typeof maplibregl === "undefined"` 가드
- **15초 워치독** — `ready`가 안 오면 `timeout`
- `onError`/`onHttpError`/`onRenderProcessGone`
- **실패 사유를 화면에 그대로 표시**(i18n 아님 — 진단 문자열이지 카피가 아니다) + 재시도

### 4.4 교훈

**정적 감사가 못 찾았다. 한 번 실행하니 한 방에 나왔다.** 문자열로 조립되는 코드는 tsc도 린트도 닿지 않는다. 유일한 방어는 ①실행 ②런타임 에러 채널이며 둘 다 이제 있다.

### 4.5 지도 아키텍처 결정

**두 엔진을 의도적으로 유지한다.** iOS=react-native-maps(바이너리 내장·키 불필요·즉시), Android=MapLibre GL JS in WebView(키 불필요·위성+클러스터+포스터핀).

**Google Maps 안드로이드 키는 도입하지 않는다** — 지도 로드는 무료지만 키+SHA-1 2종 관리가 늘고, 무엇보다 **안드로이드가 지금 가진 위성·클러스터링·포스터핀을 잃는다**(react-native-maps엔 클러스터링이 없다). 하향 평준화다.

---

## §5 검증 — 3단 사다리

| 단 | 잡는 것 | **못 잡는 것** |
|---|---|---|
| **1. 기계** `tsc` · `check-platform` · `expo export --platform android` | 안드로이드에 없는 임포트, resolve 실패, 규칙 위반, 타입 오류 | **생성 코드 내부의 버그**(§4가 실증) · 보이는 것 전부 |
| **2. 에뮬레이터** (설치돼 있음 — `RUNBOOK-android.md`) | 레이아웃·인셋·백·키보드·리플·글리프·딥링크·다크모드·**JS가 실제로 도는지** | 햅틱 · 프레임레이트 · 푸시 · GPS |
| **3. 실기기** (미보유) | 나머지 전부 | — |

---

## §6 불변식 19~23 (`HANDOFF-모바일앱-프리워치.md` §13의 1~18조에 이어짐)

19. **`Platform.OS`는 `src/platform/**` 밖에서 금지.** (R1)
20. **모든 플랫폼 발산은 `capabilities.ts`에 항목이 있어야 한다.** 항목 없는 발산은 버그다. (R2)
21. **벤치된 네이티브 모듈은 의존성에서 삭제한다** — 주석으로 벤치하지 않는다. (R4)
22. **런타임 CDN 페치 금지** — 앱이 쓰는 자산은 바이너리 안이나 우리 도메인에서 온다. (래칫)
23. **딥링크 경로는 단일 소스에서** app.json intentFilters와 웹 AASA/assetlinks 양쪽으로 파생·검사된다. *(미구현 — `scripts/sync-deeplinks.mjs` 신설 대기. 현재 AASA만 `/whereto/*`를 주장하는 비대칭이 있다.)*

---

## §7 🛑 손대지 말 것 — 확인 끝난 오탐

**적대적 검증(129건 중 8건 기각·32건 부분정정)과 실기 확인으로 걸러진 것들.** 여기 있는 걸 "발견"해서 고치면 순수한 낭비다.

| 안 고쳐도 되는 것 | 왜 |
|---|---|
| `includeFontPadding` 미해제 | RN 0.81 `CustomLineHeightSpan.kt:41-52`가 명시 `lineHeight`로 라인박스를 재중심화해 상쇄한다. 이 앱은 프리미티브에서 항상 lineHeight를 준다 |
| PT Serif 행간이 좁다 | 실측 글리프 bbox 1.275em으로 앱이 쓰는 배수(1.20~1.28)보다 **작다**. 안 눌린다 |
| 비대칭 라운드 시트에서 elevation 그림자 소실 | RN 0.81 `CompositeBackgroundDrawable.getOutline`이 처리한다 |
| 배경 없는 뷰의 elevation 누출 | 지목된 두 사례 모두 실제로는 배경이 있다 |
| 적응형 아이콘 배경 `#E6F4FE`가 Expo 템플릿 기본값 | 맞지만 **렌더되지 않는 죽은 설정**이다 — `backgroundImage`가 있으면 `withAndroidIcons.js:232`가 그걸 쓴다. 아이콘은 이미 브랜드대로 나온다 |
| `transparent` 페이드의 회색 헤일로 | 해당 그라디언트 2곳뿐이고 실제 문제 안 됨 |
| 국기 이모지가 Inter로 강제됨 | 에뮬레이터에서 정상 렌더 확인 |
| RN Modal 인셋 이중 패딩 · RateSheet 하단 여백 | RN 0.81 edge-to-edge가 모달을 자동 translucent 처리한다 |
| `connect.tsx`의 AppState 가정 | 안드로이드에서도 성립 |
| 지도 저작권 링크 차단 | 그 앵커가 애초에 없다 |
| **Expo Go의 `expo-notifications` 경고 토스트** | **우리 버그가 아니다.** SDK 53에서 원격 푸시가 Expo Go에서 제거됐다. 설정과 무관하게 뜬다 |

**이미 옳게 돼 있어 건드리면 안 되는 것:** 폰트 굵기=패밀리명 방식(`theme.ts:96`, 안드로이드 최대 폰트 함정 원천 봉쇄) · `userInterfaceStyle:"automatic"`(없으면 전 기기 라이트 고정) · Modal 4곳 `onRequestClose` · `credentialsSource`가 `eas.json`의 **ios 블록에만**(프로필 루트로 올리면 안드로이드 빌드가 죽는다) · `expo-location` 플러그인이 안드로이드 권한 2종 자동 선언.

---

## §8 하지 않는 것 (그리고 이유)

| 안 하는 것 | 이유 |
|---|---|
| Google Maps 안드로이드 키 도입 | 안드로이드가 위성·클러스터·포스터핀을 잃는다. 하향 평준화 (§4.5) |
| 플랫폼별 OTA 채널 분리 | 솔로 오너에게 상태 축 추가 비용 > 이득 |
| `runtimeVersion`을 지금 `fingerprint`로 전환 | 정답이지만 기존 iOS 빌드(runtime 1.0.0)가 OTA에서 끊긴다. **양 플랫폼 네이티브 빌드를 같이 내는 시점에** 전환. 그전까지 규칙: 네이티브 모듈 그래프를 바꾸는 변경은 양 플랫폼 동시 빌드 |
| `expo prebuild` / 네이티브 폴더 커밋 | CNG가 두 플랫폼을 한 소스에서 생성하는 게 이 설계의 전제 |
| `react-native-gesture-handler` 도입 | 미설치이고 RateSheet의 PanResponder는 양 플랫폼 동일 동작으로 검증됐다 |
| SDK 55 승격(안드로이드 blur 안정화) | 불변식 13 — 프로젝트 SDK ≤ Expo Go SDK |
| 안드로이드용 화면 재작성 | 필요 없다. 발산은 원장이 허용한 지점에만 |

---

## §9 오너 액션 (이것 없이는 못 나감)

| # | 무엇 | 비고 |
|---|---|---|
| 1 | **Play 개발자 계정** 등록 $25 | 개인 계정은 공개 출시 전 **테스터 12명 × 14일** 필요(내부 테스트는 무관). 조직 계정은 그 요건이 없으나 D-U-N-S 필요. **계정 유형은 나중에 못 바꾼다** |
| 2 | **키스토어 생성** — `eas credentials -p android` (대화형이라 오너 `!` 1회) | **Play 계정 승인 전에도 된다.** 이거 하나로 빌드 경로가 열린다 |
| 3 | 첫 `.aab` **수동 업로드** (Play Console) | 서명키 등록 과정이라 API 불가 |
| 4 | **assetlinks 실지문** — Play App Signing SHA-256 | 현재 `REPLACE_WITH_PLAY_SIGNING_SHA256`이라 앱링크 영구 실패 중. `public/`은 수동 커밋 |
| 5 | 서비스계정 JSON → 제출 자동화 | `eas.json`에 경로 명시 필수(환경변수만으론 실패) |
| 6 | (선택) FCM google-services.json | 없으면 푸시만 조용히 안 됨 |

절차 상세는 `HANDOFF-안드로이드-출시.md` §2·§5~§9.

---

## §10 진단 이력 (참고용 압축)

**방법:** 6축 병렬 감사 → 축마다 적대적 검증(주장을 기각하도록 지시받은 별도 에이전트가 소스·`node_modules`·RN 코틀린 원본까지 대조). **주장 129건 — 확정 89 · 부분 32 · 기각 8.**

**드리프트 실증 2건** (이 설계가 존재하는 이유):

1. **지도가 두 플랫폼에서 다른 제품이 됐다.** Android=Esri 위성+클러스터+포스터핀 / iOS=애플 기본지도·클러스터 없음·마커 300 상한. **안드로이드가 더 풍부하다.**
2. **오너 지시가 한 플랫폼에만 도달했다.** 2026-08-03 지도 손질 2건(`map.onlyThisFilm` 액션, 월드뷰 타이틀 필 제거)이 `MapExpoGo.tsx`(iOS)에만 들어가고 `MapWebView.tsx`엔 grep 0건. **그리고 아무것도 실패하지 않았다** — 타입 오류도 테스트도 경고도 없었다.

---

## §11 개정 이력

- v1.0 (2026-08-03): 최초 설계 — 4층 + 발산 원장 + 기계 검사.
- v1.1: 디자인 시스템 패리티 축 반영, seam 모듈 9→12안, 프리미티브층 추가.
- v1.2: **적대적 검증이 §5 초안 6건을 기각** → 문서에서 제거하고 "손대지 말 것"으로 명시.
- **v2.0 (2026-08-04): 다음 AI 인수인계용 전면 재구성.** 작업 로그(§-1.x)를 상태(§1)·큐(§2)·헌법(§3)·사례(§4)·오탐(§7)으로 재편. P0 완료·P1 일부 완료 반영. 지도 실제 원인(이중 이스케이프)과 리사이즈 버그 기록. 운영 절차는 `mobile/RUNBOOK-android.md`로 분리.
