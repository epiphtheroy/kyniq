# Release notes — 1.0.2 (the rating door)

Paste sheet. iOS: App Store Connect → 1.0.2 → "What's New in This Version".
Android: Play Console → release → release notes box (both locales, one field).

## Why 1.0.2 and not build 21 on 1.0.1

1.0.1 (build 20, the new mark) was approved by Apple on its own and sat in
Pending Developer Release. An approved version cannot take a different build,
and Apple will not attach a build whose marketing version is 1.0.1 to a store
version called 1.0.2 — so build 21 (1.0.1, carrying the rating prompt) can only
live in TestFlight, and the prompt ships as 1.0.2 / build 22. `runtimeVersion`
follows `appVersion`: OTA after this targets 1.0.2, and Android is rebuilt at
the same version so the two platforms share one update channel.

## en-US

Rate Metatake from the My tab — one tap to the store. The app will also ask
on its own, but only once it has earned it: a few days of use, a handful of
judgments, and a film you rated highly. Nothing else changed.

## ko-KR

My 탭에서 Metatake를 평가할 수 있습니다 — 한 번의 탭으로 스토어로 갑니다. 앱이
스스로 묻기도 하지만, 그럴 자격이 생긴 뒤에만 묻습니다. 며칠의 사용, 몇 번의 판단,
그리고 높게 매긴 영화 한 편. 그 밖에 바뀐 것은 없습니다.

## Play Console single-box format

```
<en-US>
Rate Metatake from the My tab — one tap to the store. The app will also ask on its own, but only once it has earned it: a few days of use, a handful of judgments, and a film you rated highly. Nothing else changed.
</en-US>
<ko-KR>
My 탭에서 Metatake를 평가할 수 있습니다 — 한 번의 탭으로 스토어로 갑니다. 앱이 스스로 묻기도 하지만, 그럴 자격이 생긴 뒤에만 묻습니다. 며칠의 사용, 몇 번의 판단, 그리고 높게 매긴 영화 한 편. 그 밖에 바뀐 것은 없습니다.
</ko-KR>
```
