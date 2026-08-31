# Play Store phone screenshots — dark (Android)

Captured 2026-08-31, replacing `../shots-android/` (light). Owner wanted the
listing dark. 1080×1920 (9:16), the ratio Play asks for on phone screenshots.

Pipeline = the ASC one from 687588e5, re-run dark: the app's own web export
(`mobile/dist`, the same bundle OTA update 49bc8bd2 shipped) rendered by
react-native-web in headless Chrome at 360×640 @3x, driven over CDP with
`prefers-color-scheme: dark` emulated and `mt.prefs.v1` seeded as an onboarded
US phone with four services — so the offers, scores and shelves are live data,
not mockups. Driver script: scratchpad `cdp-shots.mjs` (session 2026-08-31);
rebuild it from this README if needed — plain Node, no deps.

| File | Screen |
|---|---|
| `01-tonight-deck.png` | Tonight — judgment deck (Tokyo Story 86 TS), sort/year/services chips |
| `02-judgment-brief.png` | Film brief — In the Mood for Love, TS 73 ring, rank #63, An Invitation |
| `03-director-card.png` | Director — Bong Joon Ho portrait, Where to Start |
| `04-explore.png` | Explore — search, genres, decades, 114 collections |

Why no map shot this time: the store build's map is native/satellite; the web
pipeline renders the pastel fallback map instead, and a screenshot that does not
match the shipped app is a rejection risk. The director card replaced it (the
ASC set made the same trade).
