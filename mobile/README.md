# Metatake — Pre-Watch Companion (mobile)

Expo (React Native) client for the pre-watch decision loop. Plan of record:
`../HANDOFF-모바일앱-프리워치.md` (§15 AS-BUILT lists what is built and what is
still owner-side). Read that before changing anything — the two-layer rule
(native decision layer / webview reading layer) and the 12 invariants live there.

## Where the data comes from

The app is a client; every screen reads the existing production backend.

| Base URL | Set via | Use |
|---|---|---|
| `https://metatake.net` (default) | — | Once PR #7 is merged, the BFF (`/api/v1/app/*`) is live and the app needs no local server. |
| `http://localhost:3000` | `mobile/.env.local` | Before the merge, or when changing the BFF: run the web repo locally. |
| `http://<your-lan-ip>:3000` | same | Required for a phone — an iPhone cannot reach your Mac's `localhost`. |

`mobile/.env.local` (gitignored):

```
EXPO_PUBLIC_METATAKE_BASE=http://localhost:3000
```

## 1. Browser preview (Mac, no Xcode, no Apple account)

The fastest way to review screens and flow. Two terminals:

```bash
# terminal 1 — the backend (this repo's Next app; needs .env.local at the root)
npm run dev                       # http://localhost:3000

# terminal 2 — the app
cd mobile && npx expo start --web # http://localhost:8081
```

Then narrow the browser window to a phone width (or use Chrome's device toolbar,
⌥⌘I → ⌘⇧M → iPhone 15).

Caveats — the browser is a review surface, not the product:
- **Reader** (Read more → metatake.net) renders in an iframe rather than a WebView,
  and **account deletion** delegates to the site settings page;
  the public API's CORS is GET + `content-type` by design, so the browser cannot
  POST to the authed routes. Both work on device, where CORS does not apply.

## 2. Phone via Expo Go (no developer account, iOS **and** Android)

1. Install **Expo Go** — App Store (iOS) or Play Store (Android). Free.
2. Put the Mac and the phone on the **same Wi-Fi**.
3. Point the app at the Mac's LAN address — `ipconfig getifaddr en0` gives it:
   ```bash
   echo "EXPO_PUBLIC_METATAKE_BASE=http://192.168.x.x:3000" > mobile/.env.local
   ```
4. `npm run dev` in the repo root, then `cd mobile && npx expo start`.
5. Scan the QR: iOS with the **Camera** app, Android with **Expo Go's** scanner.

Works on both platforms, maps included — the tab picks a renderer that the
running binary actually has (see "Maps" below). Only push and Sign in with Apple
need a real build; the email 6-digit code works in Expo Go.

**Android note:** the same QR, the same command. Install *Expo Go* from Play,
scan with a QR scanner (Android's camera may not offer the deep link — the Expo
Go app has a built-in scanner).

## 3. Full native build (push, Apple sign-in, MapLibre native)

`eas.json` carries both platforms. iOS needs an Apple Developer account ($99/yr);
Android needs a Play account ($25 one-off) only to *publish* — internal APKs
build and install without one. See HANDOFF §15.4.

```bash
npx eas init                                        # once — also gives push its projectId
npx eas build --profile development --platform all  # ios + android dev clients
npx eas build --profile preview  --platform android # shareable APK
npx eas build --profile production --platform all   # store binaries (aab + ipa)
# locally instead, with the toolchains installed:
npx expo run:ios     # needs Xcode
npx expo run:android # needs Android Studio + a JDK
```

## Maps — one data contract, four renderers

`src/lib/pins.ts` is the only place pins are loaded (global seed-country set +
`film_geo` focus). The route picks the renderer the running binary can actually
draw, so no surface ever dead-ends:

| Surface | Renderer | Key needed |
|---|---|---|
| Browser preview | MapLibre GL JS (`app/(tabs)/map.web.tsx`) | none |
| Expo Go · iOS | react-native-maps → Apple Maps (`src/screens/MapExpoGo.tsx`) | none |
| Expo Go · Android | MapLibre GL JS in a WebView (`src/screens/MapWebView.tsx`) | none |
| Dev / store builds | MapLibre GL Native (`src/screens/MapNative.tsx`) | none |

Why Android differs in Expo Go: react-native-maps on Android *is* Google Maps,
which draws nothing without a Google Cloud API key. The WebView runs the same
MapLibre page the web preview uses — real tiles, real clustering, zero keys, and
one less credential for the owner to hold. If a Google key is ever added, the
Android branch in `app/(tabs)/map.tsx` is a single line to flip.

## Layout

```
app/                 routes (expo-router, typedRoutes on)
  (tabs)/            Tonight · Search · Map · My
  film/[slug].tsx    the Film card — the app's heart (HANDOFF §5.1)
  director/[slug].tsx  Director card (availability-dot filmography)
  read.tsx           in-app reader (SSO handoff + link interception)
  onboarding.tsx     country → services → account
src/
  editions.ts        the ONLY country list (HANDOFF §6.2)
  i18n/              UI strings, en/ko/es/ja — no hardcoded strings in screens
  theme.ts           design system v2 "Lava" — palette, gradient, radii, shadows, motion
  lib/               api (BFF client) · supabase · push · pins (map data contract)
  state/             prefs (edition) · films (user_movies ledger)
  screens/           MapNative · MapExpoGo · MapWebView · MapUnavailable (all required lazily)
```

## Checks before committing

```bash
cd mobile
npx tsc --noEmit                       # strict, must be clean
npx expo export --platform ios         # must bundle
npx expo export --platform android     # must bundle
npx expo export --platform web         # must bundle (the review surface)
```
