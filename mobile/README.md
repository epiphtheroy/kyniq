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
- **Map tab** shows an explainer: MapLibre GL Native has no web renderer.
- **Reader** (Read more → metatake.net) and **account deletion** are native-only;
  the public API's CORS is GET + `content-type` by design, so the browser cannot
  POST to the authed routes. Both work on device, where CORS does not apply.

## 2. iPhone via Expo Go (no Apple Developer account)

1. Install **Expo Go** from the App Store (free).
2. Put the Mac and the iPhone on the **same Wi-Fi**.
3. Point the app at the Mac's LAN address — `ipconfig getifaddr en0` gives it:
   ```bash
   echo "EXPO_PUBLIC_METATAKE_BASE=http://192.168.x.x:3000" > mobile/.env.local
   ```
4. `npm run dev` in the repo root, then `cd mobile && npx expo start`.
5. Scan the QR with the iPhone **Camera** app.

Everything works except the **Map tab**, which explains itself instead of
crashing: MapLibre is a custom native module and Expo Go ships a fixed binary
without it. Sign in with Apple also needs a real build (the email 6-digit code
works in Expo Go).

## 3. Full native build (Map, push, Apple sign-in)

Needs an Apple Developer account ($99/yr) — see HANDOFF §15.4.

```bash
npx eas init              # once: creates the EAS project (also gives push a projectId)
npx eas build --profile development --platform ios
# or, with Xcode installed:
npx expo run:ios
```

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
  theme.ts           DESIGN-SYSTEM.md v4 tokens ported to RN
  lib/               api (BFF client) · supabase · push
  state/             prefs (edition) · films (user_movies ledger)
  screens/           MapNative (required lazily), MapUnavailable
```

## Checks before committing

```bash
cd mobile
npx tsc --noEmit                       # strict, must be clean
npx expo export --platform ios         # must bundle
npx expo export --platform web         # must bundle (the review surface)
```
