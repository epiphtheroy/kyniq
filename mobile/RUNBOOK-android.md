# Running and verifying the app on Android

How to actually see this app on Android, on this machine, from a cold start.
Written 2026-08-04 after doing it — every trap below was hit for real.

Plan of record: `../HANDOFF-안드로이드-패리티-아키텍처.md`.

---

## 0. What exists on this machine

Installed 2026-08-03. Nothing here needs redoing unless the machine changes.

| Thing | Where |
|---|---|
| JDK 17 | `$(brew --prefix openjdk@17)` — formula, not cask, so no sudo was needed |
| Android command-line tools | `/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest/bin` |
| SDK (platform-tools, emulator, API 35, arm64 system image) | `~/Library/Android/sdk` |
| AVD | `Metatake_Pixel` — Android 15, arm64, boots headless in ~35s |

There is **no Android Studio** and none is needed.

⚠️ **The trap that cost the most time:** `avdmanager` does not respect `ANDROID_HOME`.
It resolves the SDK root from its own jar location, which under Homebrew is
`/opt/homebrew/share/android-commandlinetools` — not where the packages were
installed. `avdmanager create` fails with the memorable and useless

```
Error: Package path is not valid. Valid system image paths are:
null
```

even though `sdkmanager --list_installed` shows the image right there. The fix in
place is symlinks from the cmdline-tools prefix into the real SDK:

```bash
BREW_CLT=/opt/homebrew/share/android-commandlinetools
for d in system-images platforms emulator platform-tools licenses; do
  ln -s "$HOME/Library/Android/sdk/$d" "$BREW_CLT/$d"
done
```

Symlinking the other direction (cmdline-tools into the SDK) does **not** work —
the launcher resolves its own symlink first and lands back in the Homebrew prefix.

---

## 1. Every session: environment

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
export PATH="$HOME/.local/node/bin:$PATH"   # node is NOT on the default PATH here
```

## 2. Boot the emulator (headless)

```bash
emulator -avd Metatake_Pixel -no-window -no-audio -no-snapshot-save \
         -gpu swiftshader_indirect > /tmp/mt-emu.log 2>&1 &
adb start-server
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 5; done
```

`-no-window` is deliberate: there is no need to see the emulator's own window, and
`adb exec-out screencap -p` captures the screen perfectly without it.

`-gpu swiftshader_indirect` is software rendering. It is enough for this app,
including the WebGL map. It is **not** representative of real-device performance —
never judge the deck swipe or the map's smoothness from the emulator.

## 3. Start Metro

```bash
cd mobile && npx expo start --port 8081 > /tmp/mt-metro.log 2>&1 &
until curl -s http://localhost:8081/status | grep -q running; do sleep 2; done
```

⚠️ **Do not use `npx expo start --android`.** When it fails to launch the app (for
instance because Expo Go is not installed yet) the CLI exits — and it takes Metro
with it, so the app then fails to load for a completely different reason than the
one on screen. Start Metro plain, launch by intent (step 5).

## 4. Install Expo Go (once per emulator wipe)

Expo Go is not in the image, and `expo start --android` does not reliably install it.

```bash
URL=$(curl -s https://api.expo.dev/v2/versions/latest \
      | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['sdkVersions']['54.0.0']['androidClientUrl'])")
curl -sL -o /tmp/expo-go.apk "$URL"
adb install -r /tmp/expo-go.apk        # ~186 MB
```

Pin to **SDK 54** — invariant 13: the project SDK may never exceed what Expo Go ships.

## 5. Open the app

```bash
adb shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081"
```

`10.0.2.2` is the emulator's alias for the host's `localhost`.

Deep-linking to a specific route uses `/--/` and **omits expo-router groups**:

```bash
adb shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081/--/map"
#                                                                        ^ not /--/(tabs)/map
```

On first launch Expo Go shows its dev-menu sheet over the app. Close it by tapping
the **✕** (top-right of the sheet, around `1012 790` at 1080×2400). Do **not** press
BACK to dismiss it — back closes Expo Go itself and you end up on the launcher
wondering why the app "crashed".

## 6. Look at it

```bash
adb exec-out screencap -p > /tmp/shot.png
```

Then read the PNG. Taps and gestures:

```bash
adb shell input tap <x> <y>
adb shell input swipe <x1> <y1> <x2> <y2> <ms>
adb shell input keyevent KEYCODE_BACK
```

Coordinates are in **device pixels** (1080×2400 by default), which is not what a
screenshot viewer scaled to fit shows you — scale accordingly.

## 7. Store screenshots

Play wants 9:16 for phone shots; the Pixel profile is 2.22:1. Resize the display
so the app **lays out** for that shape rather than being cropped to it:

```bash
adb shell wm size 1080x1920 && adb shell wm density 420
# … capture …
adb shell wm size reset && adb shell wm density reset
```

Output goes in `store/shots-android/` — see the README there. Dismiss Expo Go's
warning toasts before capturing, or capture from a development build.

## 8. Shut down

```bash
pkill -f "expo start"; adb emu kill; adb kill-server
```

⚠️ **Closing the emulator window is not shutting it down, and a half-dead one
blocks the next boot.** Twice on 2026-08-04 the VM stopped answering adb while
its `qemu-system-aarch64` kept running and kept the AVD lock, so the next
`emulator -avd` died with the misleading

```
FATAL | Running multiple emulators with the same AVD is an experimental feature.
        Please use -read-only flag to enable this feature.
```

There is no second emulator. Kill the process and clear the stale locks:

```bash
pkill -f "qemu-system-aarch64 -avd Metatake_Pixel"
rm -f ~/.android/avd/Metatake_Pixel.avd/hardware-qemu.ini.lock \
      ~/.android/avd/Metatake_Pixel.avd/multiinstance.lock
adb kill-server
```

⚠️ **`timeout` does not exist on this machine.** Wrapping the boot-wait poll in
`timeout 10 adb shell getprop …` makes every iteration fail with
`command not found`, so the loop reads empty forever and a perfectly healthy
emulator looks like it never booted. Call `adb` directly.

---

## What the emulator can and cannot tell you

| Trust it for | Do not trust it for |
|---|---|
| Layout, insets, edge-to-edge | Haptics (no motor) |
| Hardware/gesture back | Frame rate, gesture smoothness, jank |
| Keyboard behaviour | GPS accuracy |
| Ripples, glyphs, dark mode | Push notifications (see below) |
| Deep links, navigation | Real device fragmentation |
| That the JS actually runs | |

**Push cannot be tested in Expo Go at all.** Remote notifications were removed from
Expo Go in SDK 53, so it logs a warning no matter how the app is configured. That
warning is not a bug in this app. Push needs a development build.

---

## Verifying without running anything

These are the checks CI runs, and the strongest ones available with no device:

```bash
cd mobile
npx tsc --noEmit                  # hard zero
node scripts/check-platform.mjs   # seam containment + ledger + ratchets
npx expo export --platform android --output-dir /tmp/x   # the module graph really resolves
```

The export is the important one: it makes Metro resolve every module for
`platform=android`, so an import that only exists on iOS fails there instead of on
a phone.

⚠️ **It does not catch bugs inside generated code.** The Android map was completely
dead for an unknown period because of a syntax error inside the HTML string that
builds the WebView page — `tsc` cannot see into a template literal, `expo export`
happily bundles it, and the app showed a black rectangle with no error. That class
of bug is only found by running the app, which is why the map now has a runtime
error channel (`HANDOFF-안드로이드-패리티-아키텍처.md` §6).

---

## 노트북에서 앱 화면 미리 보기 (2026-08-06)

```
cd mobile && npx expo start --web
```
→ http://localhost:8081/**preview**

화면 목록 페이지다. 탭 4개 + 영화·감독·목록·주행·온보딩·연결·리더로 바로 간다. 슬러그는 프로덕션에
실재하는 것으로 고정했고(《동경 이야기》=한국어 제목 없는 폴백 확인용, 알모도바르=중복 픽 확인용),
맨 위에 **앱 언어 전환**이 있다. 어느 화면에서든 왼쪽 아래 **"화면 목록"** 배지로 돌아온다.

⚠️**첫 탭 전환이 몇 초 멎어 있는 건 고장이 아니다.** 개발 서버는 10MB 번들을 `lazy=true`로 주므로
그 라우트를 처음 누를 때 청크를 받아 변환한다. `/preview`가 열려 있는 동안 전 라우트를 미리 받아 두므로,
**목록을 한 번 거치면 이후 이동은 즉시**다.

⚠️앱은 **프로덕션 API(metatake.net)** 를 본다. 서버가 번역하는 산문(초대문·감독 초상/생애·Tonight 리드)은
웹 배포가 `main`에 닿은 뒤에 한국어로 바뀐다. 그 전까지 그 자리는 영어가 정상이다.

🔒 `__DEV__` + `Platform.OS === "web"` 이중 게이트라 출시 빌드에는 존재하지 않는다.
