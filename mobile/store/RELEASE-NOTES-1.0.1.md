# Release notes — 1.0.1 (the new mark)

Paste sheet. iOS: App Store Connect → 1.0.1 → "What's New in This Version".
Android: Play Console → release → release notes box (replace the whole default
template; the box takes both locales in one field).

## Why 1.0.1 and not 1.0.0 build 19

1.0.0 (build 18) was approved and released on 2026-08-18. Apple refuses a
second App Store submission carrying the same CFBundleShortVersionString
(ITMS-90062: the version must be higher than the previously approved one);
build 19 (1.0.0) can only live in TestFlight. So the marketing version moves
to 1.0.1 and both platforms are rebuilt. `runtimeVersion` follows
`appVersion`, so OTA updates after this ship must target runtime 1.0.1.

## en-US

A new mark. Metatake's icon and wordmark are new: the boxed M, the t hanging
from its corner, and a single red dot at the seam of meta and take. On iOS 18
and later the icon has dark and tinted forms; on Android it follows your
theme. Nothing else changed in this release.

## ko-KR

새 마크. Metatake의 아이콘과 워드마크가 바뀌었습니다. 상자 안의 M, 모서리에 매달린
t, 그리고 meta와 take의 이음새에 놓인 빨간 점 하나. iOS 18 이상에서는 다크·틴티드
아이콘을, 안드로이드에서는 기기 테마를 따릅니다. 이번 릴리즈에서 그 밖에 바뀐 것은
없습니다.

## Play Console single-box format

```
<en-US>
A new mark. Metatake's icon and wordmark are new: the boxed M, the t hanging from its corner, and a single red dot at the seam of meta and take. On Android the icon follows your theme. Nothing else changed in this release.
</en-US>
<ko-KR>
새 마크. Metatake의 아이콘과 워드마크가 바뀌었습니다. 상자 안의 M, 모서리에 매달린 t, 그리고 meta와 take의 이음새에 놓인 빨간 점 하나. 안드로이드에서는 아이콘이 기기 테마를 따릅니다. 이번 릴리즈에서 그 밖에 바뀐 것은 없습니다.
</ko-KR>
```
