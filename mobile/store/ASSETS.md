# Store assets — inventory & production guide

What exists in the repo, what each store requires, and exactly how to produce
the screenshots. Screen names follow the current app (deck / brief / map /
shelf / onboarding).

---

## 1. What EXISTS in-repo (verified, `mobile/assets/images/`)

| File | Size (px) | Role |
|---|---|---|
| `icon.png` | 1024×1024 | iOS app icon (TakeScore gauge ring + serif M on the Lava plate) — App Store Connect also wants this exact size, so it doubles as the store icon |
| `android-icon-foreground.png` | 1024×1024 | Android adaptive icon, foreground |
| `android-icon-background.png` | 1024×1024 | Android adaptive icon, background |
| `android-icon-monochrome.png` | 1024×1024 | Android 13+ themed icon |
| `splash-icon.png` | 512×512 | Expo splash (light `#FFFFFF` / dark `#111111` per app.json) |
| `favicon.png` | 64×64 | Web preview favicon |

Missing (must be produced — see below): screenshots, Play feature graphic,
Play 512×512 icon export.

## 2. What the stores REQUIRE

### App Store (recommend: iPhone-only)

`app.json` sets `supportsTablet: false` — so **no iPad screenshots are needed
and none should be uploaded**. Keep it that way; a tablet layout pass is a
whole project.

| Asset | Spec | Count |
|---|---|---|
| iPhone 6.9" screenshots (required) | 1320×2868 px portrait (or 2868×1320 landscape) | 3–10; ship 5 |
| iPhone 6.5"/6.7" screenshots (optional) | 1290×2796 or 1284×2778 | Apple scales the 6.9" set down if omitted — omit |
| App icon | comes from the build (`icon.png` 1024×1024) | — |
| App preview video | optional — skip for v1 | 0 |

### Google Play

| Asset | Spec | Count |
|---|---|---|
| Phone screenshots | 9:16, min 1080 px wide recommended (max 3840 px long side) — reuse the 1320×2868 set | 2–8; ship the same 5 |
| Feature graphic (required) | **1024×500** PNG/JPG, no transparency | 1 — render `feature-graphic.html` (this folder) |
| App icon | **512×512** 32-bit PNG | downscale `icon.png`: `sips -z 512 512 icon.png --out play-icon-512.png` |
| 7" / 10" tablet screenshots | optional (skip — phone-first) | 0 |

## 3. HOW to produce the screenshots

Two working paths; A is fully reproducible on the Mac alone.

### Path A — browser preview at exact store size (no device, no accounts)

The web bundle renders every screen including the map (`mobile/README.md` §1).

1. `cd mobile && ./start-local.sh` (starts the data server + Metro + opens the
   preview; or `npm run dev` at repo root + `npx expo start --web`).
2. Open Chrome DevTools → device toolbar (⌥⌘I → ⌘⇧M) → **custom device
   440×956 with DPR 3** (440×3 = 1320, 956×3 = 2868).
   For a quick look 390×844 works, but capture at 440×956@3x so the PNG is
   store-size with no resampling.
3. Navigate to each of the 5 screens below, then DevTools ⋮ → "Capture
   screenshot" → verify the PNG is 1320×2868.
4. Caveats (README §1): the reader is an iframe and account deletion delegates
   to the site in the browser — neither appears in the 5 chosen screens, so
   the captures are honest.

### Path B — Expo Go on a real phone

`cd mobile && ./start-local.sh`, scan the QR (same Wi-Fi). iPhone screenshots
come out at the device's native resolution — Apple accepts 1320×2868 only, so
either use a 6.9" device (15/16 Pro Max class) or capture on any iPhone and
re-frame the capture into a 1320×2868 canvas. Android screenshots from any
modern phone pass Play's size rules as-is.

**Rule for both paths:** screenshots must show real app UI. Adding a caption
band above/below the UI is allowed by both stores; do not mock UI that does
not exist.

## 4. The 5 screenshots + captions (EN / KO)

Order matters — the first two are the argument, the map is the differentiator
ASO screenshot (§1 of the handoff: "내 주변 촬영지는 스크린샷 한 장으로 설명되는 기능").

| # | Screen | What to show | EN caption | KO caption |
|---|---|---|---|---|
| 1 | **deck** (Tonight feed) | Feed filtered to 2–3 services, cards with TS badges | Tonight, on your services — already judged | 오늘 밤, 내 구독에서 — 판단은 끝난 채로 |
| 2 | **brief** (film screen) | Hero + TakeScore donut + Invitation lead + judgment bar visible | The judgment brief: a score, a spoiler-free lead, one call | 점수, 스포일러 없는 리드, 판단 하나 — 한 화면 |
| 3 | **map** (Locations) | Clustered world pins or a city zoom with Near me on | 17,000 filming locations. Some are near you | 촬영지 17,000곳 — 내 주변에도 있다 |
| 4 | **shelf** (queue) | Watchlist with availability dots + Fresh/Aging/Stale marks | A queue that ages honestly | 정직하게 나이 드는 왓치리스트 |
| 5 | **onboarding** (country + services) | Country step or provider grid | Pick your country and services. That's the setup | 국가와 서비스만 고르면 준비 끝 |

Caption band style, if used: warm neutral background (`#F7F7F7` light), Inter
or system sans for captions, and the Lava gradient (#FF385C→#E61E4D→#D70466)
only as a thin accent — mirror the app, don't invent a second brand. PT Serif
(or system serif) only if a film title appears in the band.

## 5. Production checklist

- [ ] 5 phone screenshots at 1320×2868 (Path A), EN captions
- [ ] Same 5 re-captured or re-captioned in KO for the Korean storefront
      (App Store localized screenshots; Play Korean listing)
- [ ] Feature graphic 1024×500 from `feature-graphic.html` (screenshot the
      stage at 100% zoom; verify pixel size)
- [ ] `play-icon-512.png` via sips downscale of `icon.png`
- [ ] Owner-side (cannot be done in-repo): upload order, storefront
      localization toggles, and the App Store preview poster frame
