# HANDOFF — 안드로이드 실기 QA 2026-08-04 (에뮬레이터 + 정적 감사)

> 오너 지시: "모든 버튼들 다시 한번 더 테스트하세요. 특히 마이페이지나 세팅들 그리고 임포트 화면들과 같은 기능들, 지도들에서 주의깊게."

> 방법 = ① standalone APK(preview 빌드 `de80efd7`)를 AVD `Metatake_Pixel`에 설치해 직접 조작 ② 26-에이전트 정적 감사(화면별 인터랙티브 요소 전수 → 적대적 검증). **확정 16건 / 기각 4건.**

> 정본: 발산 원장 `mobile/src/platform/capabilities.ts` · 아키텍처 `HANDOFF-안드로이드-패리티-아키텍처.md`


## §1 실기로 통과 확인한 것 (재검증 불필요)

- 다크모드 — 시스템 테마를 따라 iOS와 동일하게 전면 검정 전환 (`cmd uimode night yes`로 실증). 첫 관측의 흰 배경은 에뮬레이터가 라이트 모드였던 것뿐.
- 시스템 백 — 온보딩 1↔2단계를 정확히 걸어감. 앱이 종료되지 않음. (원장 `systemBack`의 기본 계약)
- 지도 — 17,337핀 · Esri 위성 · 클러스터(6.8k/4.7k/2.3k/235/23/3) · 하단 포스터 카드 · 핀 탭 → 말풍선 + 포스터 시트 + Open film. standalone에서는 첫 로드에 타임아웃 없음.
- 위치 권한 — `Near me`가 표준 런타임 다이얼로그를 띄우고, 거부해도 크래시 없이 복귀.
- 로그아웃 판단 버튼 — 로그인 폼으로 **직행**(국가 스텝이 아님). QA 라운드2 수정이 안드로이드에서도 유지됨.
- 국가·서비스 피커 — 칩 선택 후 `Continue`를 누르면 헤더가 `2 services`로 바뀌고 덱이 채워짐.
- 탭바 크롬 — 불투명. 지도·포스터가 비쳐 보이지 않음. (원장 `chromeSurface` 규격 충족)
- 로그인 패널 — Google + 이메일만, Apple 버튼 없음. 죽은 버튼 자리도 없음. (원장 `appleSignIn` 규격 충족)
- 임포트 진입 — 로그아웃 시 JIT 게이트("Sign in first — imports write to your own ledger")로 정상 차단.
- `.aab` 산출물 — 매니페스트에 구글맵 키 0건, Hermes 릴리즈 번들 내장, ABI 4종.

## §2 확정 결함 16건

`AND` = 안드로이드에만 있는 문제. 나머지는 양 플랫폼 공통.


### HIGH

**You → Settings sheet (gear, top right) — "Notifications" push toggle (Switch)** `AND`
`mobile/app/(tabs)/my.tsx:1115`

The push switch cannot be turned on at all on Android, and it says nothing about why. onTogglePush writes pushEnabled:true optimistically, awaits registerPush(), and unconditionally rewrites false when it resolves falsy. On Android registerPush() ALWAYS resolves false: on the emulator Device.isDevice is false (src/lib/push.ts:13, early return false), and on a real device getExpoPushTokenAsync throws because no FCM V1 credential / google-services.json exists (src/lib/push.ts:29-34, caught → return false). So the thumb slides on, then snaps back to off with no error row, no toast, no disabled state. Worse, prefs.set persists to AsyncStorage AND mirrors to the server on both writes (src/state/prefs.tsx:102-118), so every tap fires two syncPrefs calls that end at false. The seam already exports the constant built for exactly this — PUSH_CREDENTIALS_CONFIGURED (src/platform/notifications.ts:40, `Platform.OS !== "android"`, documented as "Callers can use this to explain rather than to fail") — and it has ZERO importers anywhere in the tree. The ledger's pushDelivery entry (parity: "debt") predicts this exact symptom; this confirms it from code and identifies the unused hook meant to soften it. iOS is unaffected: APNs credentials are on EAS and the token mints.

*사용자가 보는 것:* You → gear (top right) → Notifications row. Tap the switch to ON: on the emulator the thumb moves and snaps straight back to OFF; on a real Android device the system notification-permission dialog appears, you grant it, and the switch still lands back on OFF. The row shows no error, no toast, no greyed-out state, and no explanatory text — the subtitle still promises "Notify me when watchlisted films arrive on my services". The setting can never be turned on, and there is nothing on screen telling the user why. Relaunching the app shows it OFF again (AsyncStorage was written false). For a signed-in user each attempt also pushes push_enabled=false to the server twice.

**Locations map — world view (Android) — Floating "Locations · N pins" title pill** `AND`
`src/screens/MapWebView.tsx:628`

LEDGER DEBT CONFIRMED (mapFeatureDelta, 08-03 owner instruction #2). The owner asked for the world-view title pill to be REMOVED. On iOS it was: MapExpoGo.tsx:404 gates the pill behind `{filmSlug ? <pill/> : null}` with the comment "The world view now carries no title at all; film focus keeps a slim pill". On Android the pill at MapWebView.tsx:628-648 is rendered UNCONDITIONALLY — no `filmSlug` guard anywhere in the chrome row — so the world view still shows "Locations" + pin count. `grep -n "map.title"` returns 1 hit in MapWebView.tsx and 0 in MapExpoGo.tsx. It is also the exact wrap-to-two-lines pill the owner objected to: it sits in a flex row alongside up to three chips inside `left: sp.s4 / right: sp.s4`. Not merely cosmetic for this audit — it consumes the top band that the Back and Near-me chips share, and it is the specific chrome change the ledger says never crossed platforms.

*사용자가 보는 것:* Open the Locations tab on Android: a rounded chrome pill reading "Locations 1,234 pins" sits at the top-left over the satellite map on every world-view session. iOS shows no pill there at all — its top band holds only the Back and "Near me" chips. The 08-03 owner instruction to drop this pill therefore visibly did not reach Android. When the map is opened as a pushed screen (from Explore or a film brief) rather than from the tab, the pill shares the row with the Back chip and "Near me"; nothing in that row can shrink, so on a narrow (~360dp) device the "Near me" chip is likely pushed past the right edge.

**Locations map — pin tap card (Android) — "Show only this film's locations" button on the pin card** `AND`
`src/screens/MapWebView.tsx:816`

LEDGER DEBT CONFIRMED (mapFeatureDelta, 08-03 owner instruction #1). The action does not exist on Android. Repo-wide grep for `onlyThisFilm` returns exactly one call site — MapExpoGo.tsx:373 (iOS) — plus the four dictionary entries; MapWebView.tsx has 0. The Android pin card ends at the "Open film" GradientBtn, so from a world-view pin there is NO way to narrow the map to that one film. Android's film-focus mode is fully implemented (it has `map.backToFilm` and `map.showAll` chips, artifact vs. film_geo pin sourcing, camera fitBounds) — it is only unreachable from a pin. The single entry point left on Android is a deep link from the film detail screen (app/film/[slug].tsx:493). The translated string ships in all four dictionaries and renders on zero Android screens.

*사용자가 보는 것:* On Android, tap any pin on the world Locations map. The card that slides up shows the poster, film title, place and country, and exactly one button: "Open film". The iOS card shows a second, ghost-style button underneath it — "Show only this film's locations" — which clears the card and refilters the map to just that film's pins. On Android that button is absent, so from a pin there is no way to narrow the map to that one film. Reaching the same state requires tapping "Open film", scrolling the film page to its locations section, and tapping the map button there. The map's film-focus mode itself works normally once entered that way (the "Back to film" and "Show all" chips both appear and function). The translated string ships in en/ko/es/ja but renders on no Android screen.

**Navigator drive (turn-by-turn flagship) — Map poster info card — the tap card with Open / ✕** `AND`
`/Users/jerryje/Developer/MetaTake/mobile/app/navigator/drive.tsx:1439`

drive.tsx never calls useAndroidBack — `grep -rn useAndroidBack app/ src/` returns only read.tsx, onboarding.tsx and the hook itself. The poster info card is an in-place overlay: tapping any route poster (line 1034), any near-stop poster (1251) or the 🏁 destination (1282) sets `pick`, and the ONLY way to clear it is the 16px ✕ at line 1439 (or the Open button at 1426, which leaves for the film screen). On Android the hardware/gesture back does not dismiss the card — it falls through to react-navigation and pops the whole `navigator/drive` route (registered as a plain push in app/_layout.tsx:96), taking the user out of the drive entirely. That destroys screen-local state with no server copy: the `skipped` set (line 366, written only by onSkip at 667 and explicitly documented at 546 as a local re-order), the pan position, and the expanded sheet. This is exactly the class the divergence ledger's `systemBack` entry names — "Surfaces with internal steps (onboarding, the in-app reader, overlays) must answer it or back destroys work the user is in the middle of" (src/platform/capabilities.ts:123-133) — and the flagship screen is the one surface that owns steps and does not implement it.

*사용자가 보는 것:* On Android, with a poster info card open on the Navigator drive screen (tapped from any route poster, near-stop poster, or the 🏁 destination), pressing the hardware/gesture back button does not close the card — it exits the drive screen entirely and returns to the previous screen. The user must instead find the small ✕ in the card's top-right corner. Re-entering the drive via Resume restores the destination and the fewest/fastest/no-tolls preference, but the user's locally skipped turns are back in their original order and the map pan/zoom and expanded sheet are reset. iOS shows the same state loss via edge-swipe, so the Android-specific fault is the back button overshooting a dismissible overlay.

**Onboarding → step ④ taste calibration → Connect ("Import your history") — Android hardware/gesture back while the Connect screen is open** `AND`
`/Users/jerryje/Developer/MetaTake/mobile/app/onboarding.tsx:150`

OnboardingScreen registers its back interceptor with useAndroidBack() and never gates it on focus, and react-freeze is off in this app (react-native-screens core.ts: `let ENABLE_FREEZE = false`, and enableFreeze() is never called), so the onboarding screen stays mounted with a LIVE BackHandler subscription after it pushes /connect on top of itself (line 931). RN dispatches hardwareBackPress to the most recently registered handler first, and NavigationContainer's own handler (useBackButton.native.tsx) is registered once at container mount, i.e. always last. Result on Android: on the Connect screen the back press is consumed by the hidden onboarding screen — the Connect screen does not close, nothing visibly happens, and underneath the funnel silently rewinds taste → edition → account. Three dead back presses later the handler finally returns false, /connect pops, and the user is dumped on the welcome pitch having lost their place. iOS never sees it (useAndroidBack no-ops off Android and the modal has gestureEnabled:false). Fix belongs in src/platform/back.ts (gate the subscription with useIsFocused/useFocusEffect), not in the call site.

*사용자가 보는 것:* Android, onboarding step 4 (taste calibration): tap "Import your history" to open Connect, then press the system back button on the Connect hub. Nothing happens — three times in a row. On the fourth press Connect finally closes and the user lands on the onboarding WELCOME pitch (step 1) instead of back on the taste grid: the progress track has silently rewound taste -> edition -> account -> welcome behind the hidden screen. Same on the import theater and completion screens, which additionally have no visible back control at all. The tappable back disc on the hub still works, so it is not a permanent trap, but the funnel place is lost. iOS is unaffected (useAndroidBack no-ops off Android). Exception: with the connector guide bottom sheet open, back correctly closes the sheet.

**Tonight (deck) — "Taste" (sparkles) filter chip — and the whole deck it controls**
`app/(tabs)/index.tsx:223`

Sign-out permanently bricks the Tonight tab with no in-app way back. `bold` is now the PERSISTED `taste` pref (line 188), but the sign-out guard still only strips the retired `"bold"` entry out of `presets` — a source swap that no longer exists. So after signing out with Taste on: `fetchDeck()` takes the `if (bold)` branch and calls the auth-scoped `me.recommendCached(0.6, 60)`, which `.catch(() => [])`s to an empty array (src/lib/api.ts:616) → rows=[], total=0, status="idle". The Taste chip that would turn it off is rendered `{session ? <Chip …/> : null}` (line 522), so it is GONE. `needsServices` is also forced false by `&& !bold` (line 210), so the "Pick your services" escape hatch does not render either, and the mood chips are hidden by `{!bold ? … : null}` (line 559). The user sees a blank deck reading "emptyFiltered" and every remaining chip is inert (fetchDeck short-circuits before touching them). `taste` lives in AsyncStorage (src/state/prefs.tsx:44), so this survives every relaunch — the only cures are signing back in or reinstalling. Sign-out is reachable from two places in app/(tabs)/my.tsx (1430, 1454). Not Android-specific, but Android's hardware back gives the user one more way to leave the sign-in sheet without fixing it.

*사용자가 보는 것:* A user who turned on the "My taste" chip and later signs out (You tab) keeps browsing normally at first — the deck still shows the films it had. On the next pull-to-refresh, or the next time the app is opened, the Tonight tab is a blank list reading "Nothing left to show tonight." The sparkles "My taste" chip that would turn it off is gone (signed-out users don't get it), the mood chips are gone, and the "Pick your services" empty screen never appears. Sort, era, "On my services" and country-of-origin chips all still respond but the deck stays empty no matter what is tapped. Because the pref is on disk, force-quitting and relaunching does not help — every launch lands on the same blank Tonight tab. The only ways out are signing back in (You tab → Sign in, which is not signposted from the blank deck) or reinstalling.


### MEDIUM

**You (signed out) → "Sign in" → onboarding account step — Android hardware back on the sign-in page opened from You / Settings** `AND`
`mobile/app/onboarding.tsx:143`

Hardware back on the sign-in page does not close it — it walks the user into the first-run welcome pitch they never asked for. my.tsx:721 (and the settings sheet's sign-in path, and connect.tsx:921) push /onboarding?step=account. In OnboardingScreen, editOne is defined as `entry !== null && entry !== "account"`, which deliberately excludes "account" — correct for the Continue logic it was written for (after signing in you should go on to taste calibration), but the SAME flag is reused as the guard in useAndroidBack. So for a settings-originated account entry editOne is false, the handler falls through to `STEPS.indexOf("account") === 1`, is not <= 0, and consumes the press with setStep("welcome"). An already-onboarded user who signed out, tapped "Sign in" from the You tab, then hit back lands on the "what Metatake is" first-run pitch and must press back a second time (or hunt for ✕) to escape. Entries with step=edition or step=language behave correctly — editOne is true there and back closes the route. iOS never sees this: it has no hardware back and this screen sets gestureEnabled:false (app/_layout.tsx:112), so ✕ is the only exit there and the branch is unreachable. The ledger's systemBack entry (parity: "acceptable") promises back walks a flow's OWN steps; here it walks steps belonging to a funnel the user did not enter.

*사용자가 보는 것:* On Android, a signed-out (already-onboarded) user taps "Sign in" on the You tab and gets the sign-in page. Pressing the hardware/gesture back button does not close it — the page stays open and swaps to the first-run welcome pitch: the Metatake wordmark, the tagline, three "what this app is" rows and a Start button, with the step-progress track dropping back to segment 1. To actually get out they must press back a second time or find the ✕ in the top-left. Same one-press detour from the signed-out judgment prompt on Tonight, film and list pages, the Save button, the navigator, and the Connect screen. Entering the same screen from Settings to change country or content language behaves correctly — one back press closes it.

**Locations map (Android) — Hardware / gesture back while a pin card + map callout are open** `AND`
`src/screens/MapWebView.tsx:523`

The map opens an in-place overlay (the MapLibre popup plus the bottom pin card) and never answers Android's back button, so back navigates away from the map instead of dismissing the overlay — leaving the tab, or exiting the app when the map tab is the stack root. The ledger's `systemBack` entry names this exact class: "Surfaces with internal steps (onboarding, the in-app reader, overlays) must answer it or back destroys work the user is in the middle of." The seam hook that implements the contract exists and is used by exactly two screens — app/read.tsx:92 and app/onboarding.tsx:150 — and `grep -rn useAndroidBack` returns no hit in either map screen. Dismissal is currently only reachable through the 28pt ✕ at MapWebView.tsx:766 or a tap on empty map. Structurally Android-only: iOS has no hardware back, which is why MapExpoGo was never obliged to handle it.

*사용자가 보는 것:* On Android, open a film brief, tap through to its filming-locations map, pan/zoom the world map and tap a pin. A callout appears on the map and a card slides up at the bottom. Press the hardware or gesture back button expecting the card to close — instead the whole map screen pops away and you are back on the film brief (or Explore, if you entered from there). The pin card, the callout, your pan/zoom position, and the in-view film strip are all gone; re-entering the map starts over at the default view. Closing the card without losing the map requires spotting the small 28pt X in the card's top-right corner or tapping bare map.

**Locations map (Android) — "Near me" chip** `AND`
`src/screens/MapWebView.tsx:552`

An iOS permission assumption baked into the Android path. `nearMe` treats any non-granted result as terminal — it sets `locDenied`, and from that point the chip's onPress is permanently swapped from `nearMe` to `Linking.openSettings()` (line 672). That is correct on iOS, where a denial can only be reversed in Settings. On Android the FIRST denial is soft: the OS returns `granted: false` with `canAskAgain: true` and the app is expected to be able to re-prompt. Because `canAskAgain` is never read (it is present on the response — expo-modules-core PermissionsInterface.d.ts:40), one accidental "Don't allow" latches the control into a Settings deep-link for the rest of the session, and the in-app re-prompt Android would have granted is unreachable. Android also gets no visual signal that the chip changed meaning: MapExpoGo.tsx:432 wraps its Near-me chip in `opacity: locDenied ? 0.4 : 1`, MapWebView.tsx:672 has no such wrapper, so the chip looks identical while doing something entirely different.

*사용자가 보는 것:* On Android: tap "Near me" on the Locations map, get the system location dialog, tap "Don't allow" once. Tap "Near me" again — instead of the permission dialog Android would still have shown (first denial is soft, canAskAgain is true), the app throws the user out to the system Settings screen. The chip looks identical before and after, because unlike iOS it is not dimmed, so there is no signal its meaning changed. Worse, if the user grants location in Settings and presses hardware back, "Near me" still opens Settings — the map never flies to their location again. The map is a persistent hidden tab that is never unmounted, so leaving and re-entering does not clear it either: one accidental "Don't allow" disables Near-me for the rest of the app session with no in-app way back.

**Onboarding re-entered as the sign-in sheet (/onboarding?step=account — from the film brief's signed-out judge guard, the You tab, list, navigator/drive, connect) — Android hardware/gesture back on the sign-in sheet** `AND`
`/Users/jerryje/Developer/MetaTake/mobile/app/onboarding.tsx:143`

`editOne` deliberately excludes "account", so a deep-linked ?step=account entry is NOT treated as a dismissible single-step sheet. On Android, back therefore walks the funnel backwards into STEPS[0] = the first-run welcome pitch instead of closing the sheet and returning the user to the film they were judging. The header comment two lines below the close button ("Deep-linked re-entry (?step=) must always be dismissible") states the opposite intent. Worse for the signed-out case the film brief creates (app/film/[slug].tsx:367): the only visible way out of that welcome pitch is the X, which calls finish() → set({onboarded:true}), so the user is silently marked onboarded and never gets asked for country/services/taste. iOS cannot reach this state — the route sets gestureEnabled:false and there is no hardware back.

*사용자가 보는 것:* Android, signed out, on a film brief: tap Want or Pass → the sign-in sheet slides up (app/film/[slug].tsx:367 → /onboarding?step=account). Press the system back button or swipe back. Instead of the sheet closing and returning to the film, the screen becomes the first-run welcome pitch — the Metatake wordmark, the tagline, the three "what this app is" rows and a "Get started" button — with the 4-segment progress track showing segment 1 of 4, over a film the user was in the middle of judging. Pressing back once more does pop back to the film, and the X in the header also closes it, so the user is not stuck; they just get a screen they already passed and an extra press. Same on the You tab, list, navigator/drive and connect sign-in entries. Worse variant: sign in successfully from that sheet and you land on the taste grid; back then walks taste → country/services editor → the sign-in form again → welcome — four presses to leave. On iOS none of this is reachable (fullScreenModal with gestureEnabled:false, no hardware back).

**You → Settings sheet → "Credits & licences" row (bottom card) — Credits / attribution row (TMDB + JustWatch)**
`mobile/app/(tabs)/my.tsx:1316`

Tapping the credits row looks like a dead control: it pushes /read WITHOUT first dismissing the settings sheet. The settings sheet is a React Native <Modal> (my.tsx:1137) — a separate native window on Android (Dialog) and a presented view controller on iOS — so it stays on top of the whole navigator, and the /read screen it just pushed renders underneath, invisible. This file already knows the rule and states it 190 lines earlier: goOnboarding (my.tsx:1128-1132) calls onClose() before router.push with the comment "The modal floats above the navigator — close it before pushing a route." This is the one call site inside the sheet that skips it. Android makes the aftermath stranger than iOS: the user presses hardware back expecting to undo a no-op, onRequestClose fires, the sheet closes, and the About reader they never saw open is suddenly on screen — so back appears to navigate FORWARD. On iOS they must tap ✕ to discover the same thing. TMDB and JustWatch attribution is contractually required, which is why the owner promoted this from a grey 11pt line to a real row on 08-03; as wired it still cannot be reached in one tap.

*사용자가 보는 것:* On Android: You tab → settings gear → scroll to the bottom card → tap "Credits & data sources". Nothing appears to happen — the settings sheet stays exactly where it was, with no transition, no reader. The row reads as a dead control even though the /read reader for /about has in fact been pushed and is rendering invisibly beneath the sheet's dialog window. Press hardware back to undo what looks like a no-op and the sheet slides away to reveal the About reader you never saw open — back appears to navigate forward. Backing out of that reader then returns to the You tab with the settings sheet gone, so the user's place in settings is lost too. TMDB/JustWatch attribution, which the owner promoted to a full row on 08-03 precisely because it was unreachable as grey 11pt text, still cannot be reached in one tap.

**Connect — import theater / completion — the whole import-theater screen (no back, close, or cancel control anywhere on it)**
`/Users/jerryje/Developer/MetaTake/mobile/app/connect.tsx:930`

connect.tsx runs FOUR internal states inside one route (HUB → GUIDE modal → THEATER → COMPLETION) but never calls useAndroidBack — the file has no import of src/platform/back at all (the only two call sites in the app are onboarding.tsx:150 and read.tsx:92). The guide sheet is a Modal so onRequestClose covers it, but the theater and the completion view are plain screens with headerShown:false and no back/cancel affordance, so Android's hardware back falls straight through to the router and pops the entire /connect route. This is exactly what the divergence ledger's `systemBack` entry forbids: "Surfaces with internal steps (onboarding, the in-app reader, overlays) must answer it or back destroys work the user is in the middle of." Two concrete losses: (a) back during the theater abandons a live import — the async runImport promise keeps running against the server while `run` state dies with the component, so the theater can never be re-entered; re-opening /connect then hits the recovery effect at connect.tsx:412-424, which sees status "importing" and rewrites it to "error" even though the import is still succeeding, and because runRef is per-component the "one import at a time" guard at connect.tsx:461 is reset, so the user can start a second concurrent import of the same file from the same sheet. (b) back on the completion view discards `result` permanently — the unmatched list (§6-5's "honest leftovers") lives only in component state; connect.ts persists only its count, so the per-title list the user is meant to tap through to /search is unrecoverable. iOS is affected in principle via the edge swipe (gestureEnabled:true globally, app/_layout.tsx:94), but on Android back is the primary navigation control and a screen with no visible exit is precisely where users press it.

*사용자가 보는 것:* Android user starts a Letterboxd/IMDb import. The theater screen (posters pouring in, counters ticking) has nothing to press — no back arrow, no cancel — and on a multi-thousand-row file it sits there for minutes. The user presses the system back button: the whole Connect screen vanishes instantly with no confirmation, and there is no way back into the progress view (re-opening Connect shows the tile grid, never the running theater). Re-opening Connect while the import is still finishing shows the tile flipped to red "Something went wrong" even though the rows are landing correctly; the guide sheet opens with the red error line and offers "Pick file" again, so a user who retries kicks off a second import of the same file running concurrently with the first. The tile then silently flips back to green "done" when the orphaned first run finishes.

**Connect — OAuth sheet (Trakt / TMDB / Simkl) — "Connect Trakt" / "Connect TMDB" / "Connect Simkl" primary button**
`/Users/jerryje/Developer/MetaTake/mobile/src/lib/api.ts:942`

connectApi.start() is the one remaining unbounded network call in the app. Every other request goes through getJSON (api.ts:105-124, "Bound every request: a stalled mobile connection must reject … not hang a spinner forever with no way back") or carries its own AbortController (parseFile, api.ts:820-821, added by QA 07-29 for exactly this reason). start() uses a bare fetch with no signal and no timeout. Worse, nothing on screen changes while it is in flight: runOAuth awaits start() BEFORE it sets connect state or calls beginRun, so the sheet shows no spinner, the tile subtitle does not change, and there is no run to escape from. On a stalled cellular link the primary CTA of the whole OAuth flow is indistinguishable from a dead button, for as long as the OS keeps the socket open. Android's Doze/背景 socket teardown makes the stall window realistically long on a phone that dims mid-tap.

*사용자가 보는 것:* On Android, open Connect and tap "Connect Trakt" (or TMDB / Simkl) with the network stalled or in airplane mode. The sheet does not change at all — no spinner, the button keeps its full gradient and stays tappable, the tile subtitle behind the modal still reads idle. In airplane mode this is permanent: the request rejects instantly, the catch writes an error state the sheet never renders, and the user is left staring at a button that appears to do nothing. On a stalled (not dropped) connection it is worse on Android than iOS: React Native zeroes all OkHttp timeouts, so the request can hang indefinitely, where the same code on iOS gives up after URLSession's 60s default. The user can escape with the hardware back button or by tapping the scrim (the Modal has onRequestClose), so they are not trapped — but repeated taps each fire another request, and if one of those finally resolves minutes later, a Chrome Custom Tab launches on top of whatever screen the user has since moved to.

**Tonight (deck) — "Hide seen" filter chip**
`app/(tabs)/index.tsx:207`

The toggle writes to storage but its OFF state can never be read back. `hideSeenEff = seenOverride ?? (session ? true : hideSeen)` — for a signed-in user the `session ? true` branch always wins, and `seenOverride` resets to `null` on every mount. The chip only renders when signed in (line 530), so for every user who can see it the persisted `hideSeen: false` is dead: turn it off, relaunch (or just leave and re-enter the tab if the tab remounts), and it is silently ON again, re-hiding films the user asked to see. The write is not wasted globally — other surfaces read the stored pref — which makes it worse: Tonight and the rest of the app disagree about the same setting.

*사용자가 보는 것:* A signed-in Android user opens Tonight, taps the "Hide seen" chip to turn it OFF, and the films they have already marked seen reappear in the deck — correct behaviour, and the choice is written to storage. They press the hardware/gesture back button (which on the root Tonight tab exits the app and destroys the screen), then reopen Metatake. The "Hide seen" chip is rendered filled/active again and their seen films are hidden again, even though storage still holds `hideSeen: false`. No amount of toggling makes it stick; the setting reverts on every launch, forever. There is a second, smaller tell on each cold start: `session` arrives asynchronously (src/state/films.tsx:95 `getSession().then`), so the first frames render with `session === null`, `hideSeenEff` falls through to the stored `false`, and the seen films are briefly visible — then vanish a moment later when the session lands and the `session ? true` branch takes over. The user sees their setting flash correct and then get overridden in front of them.

**Tonight (deck) — Sort picker → "Top 100 / Top 500 / Top 1000" + infinite scroll**
`app/(tabs)/index.tsx:433`

With a Top-N sort selected, the auto-pagination effect becomes an unbounded request loop that can never terminate early. `visible` is `rows.slice(0, rankCap).filter(...)` (line 419) — a FIXED window. Once every film inside that window has been judged (dismissed rows are hidden forever by the ledger), `visible.length === 0`, so the effect calls `loadMore()`; `loadMore` has no `rankCap` guard (only `fetched >= total`, line 289), so it appends rows 100→140→180… which `visible` immediately slices away. `fetched` changes on every round trip, re-firing the effect, so the app walks the ENTIRE catalogue one page at a time while showing "Deck cleared" throughout. The author clearly knew the cap belongs here — `canLoadMore` at line 723 does carry `fetched < rankCap`, but that value only gates the footer spinner, not the fetch. Given the WAF self-DoS history in this project, a client that silently paginates thousands of rows on the BFF is worth fixing.

*사용자가 보는 것:* Signed in, Tonight tab, sort set to "Top 100". Once every film in the top 100 of the current filtered ranking has already been judged — reachable by judging through the deck in one session and reopening the app the next day, or immediately after a Letterboxd/Trakt import since hide-seen defaults ON when signed in — the deck shows "Deck cleared" and looks completely idle: no footer spinner, because the rankCap guard at :723 suppresses exactly that spinner. Underneath, the app fires /api/v1/app/tonight?...&offset=N back-to-back, 40 rows per request, walking all the way to `total` (hundreds to thousands of rows). Not one new film ever appears, because every row past index 100 is sliced off by rankCap before render — including unjudged, watchable films the app has already downloaded and is holding in memory. What the user experiences: a permanently empty deck that never recovers, plus unexplained data and battery drain. What the backend experiences: a serial burst of dozens to ~170 BFF calls from a single client that appears to be sitting still — the same self-inflicted load shape that previously tripped this project's own WAF.

**List (a curated collection) — "Add all to watchlist" primary button**
`app/list/[slug].tsx:116`

When the write fails the screen says nothing at all. `addAll` handles the RPC error by `setErr(true)`, but the only consumer of `err` is the render branch `err && !rows` (line 195) — and by the time the button is tappable `rows` is non-null (the button is `disabled` until `rows?.length`). So the failure path is structurally unreachable: `adding` flips back to false, the label reverts from "Adding…" to "Add all", `added` stays null, no ticks appear, and the user is told nothing. The likely reading is "I mis-tapped", so they tap again — and each retry is another silent no-op. `lineage_add_watchlist` is a SECURITY DEFINER write, so an auth/RLS hiccup lands exactly here.

*사용자가 보는 것:* On the List screen with a signed-in account, the user taps "Add all to watchlist" while offline (or with a stale session). The button label changes to "Adding…" for the duration of the round trip, then reverts to "Add all". Nothing else on the screen changes: no error message, no toast, no alert, no bookmark ticks on any row, and no "N added to your watchlist" confirmation. The screen is indistinguishable from a mis-tap, so the user taps again — and every retry produces the same silent no-op. The films are never added.


## §3 패턴 — 왜 이렇게 몰려 나왔나

확정 16건 중 **8건이 하드웨어/제스처 백**이다. iOS에는 존재하지 않는 입력이라 그 경로 전체가 한 번도 검증된 적이 없었다. 원장 `systemBack` 항목이 정확히 이것을 경고해 두었다 — "내부 단계를 가진 표면은 백에 답해야 하며, 답하지 않으면 사용자가 하던 일이 파괴된다." `useAndroidBack` 호출부는 저장소 전체에 **단 2곳**(`onboarding.tsx:150`, `read.tsx:92`)뿐이고, 지도·드라이브·커넥트·시트류는 전부 비어 있다.

두 번째 패턴은 **원장이 예고한 것이 그대로 실물로 확인**됐다는 점이다. `mapFeatureDelta`(부채)가 예고한 두 증상 — 월드뷰 타이틀 알약이 남아 있고 "이 영화만" 액션이 없는 것 — 이 화면에서 그대로 보였고, `pushDelivery`(부채)가 예고한 알림 토글 되돌아감도 코드로 확인됐다. 원장은 작동하고 있다.


## §4 아직 못 본 영역 (로그인 필요)

에이전트는 오너 계정으로 로그인할 수 없다(자격증명 취급 금지). 따라서 아래는 **코드로만** 확인했고 화면으로는 못 봤다:

- 임포트 실물 — 파일 선택기(Letterboxd/IMDb CSV), 임포트 극장, 완료 화면
- You 탭의 원장 4탭 포스터 그리드
- 별점 시트(RateSheet)의 저장 지속성
- 알림 토글이 실기기에서 권한 승인 후에도 되돌아가는지 (에뮬레이터는 `Device.isDevice=false`라 항상 실패)

오너가 에뮬레이터 창에서 직접 로그인하면 전부 열린다.

---

## §5 수정 후 실기 재검증 (2026-08-04 저녁, standalone APK + 로그인 상태)

오너가 에뮬레이터에서 직접 로그인(이메일 8자리 코드)한 뒤, 17건 전부를 다시 눌렀다.
**커밋 `490fcb28`(16건) + `de907093`(17번째).** 아래는 화면으로 확인한 것과 아닌 것의 구분이다.

### 눌러서 확인함

| # | 확인한 동작 |
|---|---|
| 1 | 설정의 알림 행이 토글 대신 "Not available on Android yet"으로 설명한다 |
| 2 | Credits 행이 리더를 연다 — 그리고 그 과정에서 **리더가 통째로 죽어 있었음이 드러났다**(아래) |
| 3·16 | 로그인 시트가 **백 한 번**에 닫히고 원래 자리로 돌아온다. 첫 실행 소개로 새지 않는다 |
| 4 | 임포트 완료 화면에 `Done`이 있고, **백이 허브로 복귀**한다(라우트 밖 이탈 없음). 실제 CSV 임포트가 극장→완료까지 통과 |
| 5 | 비행기 모드에서 `Connect Trakt` → **"Didn't work — try again"**. 정상 네트워크에선 trakt.tv OAuth가 열린다 |
| 6 | 월드뷰 타이틀 알약이 **없다**(상단 밴드에 Back·Near me만) |
| 7 | 핀 카드에 **`Show only this film's locations`가 있다** |
| 8 | 백이 핀 카드+말풍선을 함께 닫고 **지도에 머문다** |
| 9 | 거부 **1회** 뒤 Near me를 다시 누르면 권한 다이얼로그가 **다시 뜬다**. 2회 거부 뒤 Settings로 가는 것은 안드로이드 규칙상 정답 |
| 10 | Taste ON 상태로 로그아웃 → 덱이 **백지가 아니다**. 완전 종료 후 재실행해도 정상(구버그는 여기서 영구 백지) |
| 11 | `Hide seen`을 끄면 **앱 완전 종료 후에도 꺼진 채 유지**된다 |
| 14 | 드라이브 포스터 카드가 **백 한 번에 닫히고 드라이브는 유지**된다 |
| 15 | 온보딩 4단계 → Connect → **백 한 번**에 닫힌다(수정 전 네 번) |

부수 확인: 안드로이드 문서 선택기 정상 개방 · You 탭 원장 4탭(Watched 1058 / Watchlist 18 / Rated 778 / Passed 13)+Lists 탭 · 포스터 그리드 → 상세 → 감독 페이지 · 드라이브 오버월드 맵 전체.

### 화면으로 확인하지 못함

- **#12 Top-N 무한 요청** — 폭주 조건이 "캡 안의 100편을 전부 판단한 상태"라 재현하려면 100편을 다 판단해야 한다. Top 100 적용 후 덱은 안정적이고 30초간 추가 요청 없음까지만 확인. 나머지는 코드 검증.
- **#13의 새 타임아웃**(`de907093`)은 그 커밋 이후 APK를 굽지 않아 미검증.

### 이 라운드에서 새로 나온 것 둘

**리더 전면 크래시(수정 전부터 존재).** Credits 행을 고쳐 처음 눌러보니 레드박스 —
`java.lang.String cannot be cast to java.lang.Double`. `react-native-webview`가
`decelerationRate`를 `Double`로 선언하는데 `app/read.tsx`가 문자열 `"normal"`을 넘겨,
Fabric 델리게이트가 뷰 생성 중 캐스팅하다 터진다. **수정 이전 코드로 구운 APK로도 동일 재현** —
우리가 만든 게 아니라 원래 있던 것이고, Credits가 죽은 버튼이라 아무도 그 길을 못 가봤을 뿐이다.
`0.998`(RN이 "normal"에 매기는 값)로 교체. ⚠️ 이 클래스는 tsc·린트·`expo export`가 전부 통과시킨다.

**#13의 에러 문구가 도달 불가였다(17번째).** 네트워크를 끊고 `Add all to watchlist`를 누르니
`Adding…`에서 **80초 넘게** 멈췄다 — 네트워크 복구 후에도. `supabase.rpc`에 시간 제한이 없어
죽은 소켓이 거부하지 않고 그냥 멈춘다. 즉 실패했을 때 말하게 만든 문구가, 정작 사용자가 겪는
실패에서는 절대 나오지 않는다. `abortSignal` 25초 상한으로 해결(`de907093`).
`#5`와 같은 부류였고 앱에 남아 있던 마지막 무제한 호출이었다.
