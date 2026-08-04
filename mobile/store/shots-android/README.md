# Play Store phone screenshots (Android)

Captured 2026-08-03 from the app running on an Android 15 emulator (Pixel, arm64),
**1080×1920 = 9:16**, which is the ratio Google Play asks for on phone screenshots.

## Why these and not `../shots/`

`../shots/` and `../shots-69/` are **iPhone** captures (1290×2796 / 1284×2778). Two
problems for Play: the ratio is ~2.17:1 rather than 9:16, and — the bigger one —
they show iOS chrome. An iOS status bar and iOS back chevrons on a Play listing
read as a port that nobody looked at. These are the real Android UI.

The emulator was resized with `adb shell wm size 1080x1920` before capture, so the
app laid itself out for that shape rather than being cropped to it.

| File | Screen |
|---|---|
| `01-tonight-deck.png` | Tonight — the judgment deck (TakeScore, invitation lead, ♥/✕/✓) |
| `02-judgment-brief.png` | Film brief — hero, TakeScore ring, rank, An Invitation |
| `03-locations-map.png` | Locations — Esri satellite, clustered pins, films in view |
| `04-explore.png` | Explore — search, genres, decades, collections |

Play accepts 2–8 phone screenshots; four is a complete set and each one shows a
different reason to install. Listing copy to paste alongside them is in
`../listing-en.md` (and `../listing-ko.md` for the Korean translation).

## Retaking them

The status bar shows the emulator's default 3G/battery glyphs. That is normal for
store screenshots and Google does not object, but if a cleaner bar is wanted:

```bash
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command enter
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0930
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4
# … capture …
adb shell am broadcast -a com.android.systemui.demo -e command exit
```

⚠️ Do not capture while Expo Go is showing its yellow/red dev warnings (the
`expo-notifications` toast in particular) — dismiss them first, or capture from a
development build where they do not exist at all.
