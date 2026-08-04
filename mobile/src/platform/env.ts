// Which target is running.
//
// The app has THREE targets, not two: iOS, Android, and the react-native-web
// preview used for browser QA (app/read.web.tsx, app/(tabs)/map.web.tsx,
// src/components/FilmMiniMap.web.tsx). Most "is this web?" checks are not
// platform divergence in the iOS-vs-Android sense — they are "this target has no
// native API at all" checks — but they still read Platform, so they live here to
// keep the containment rule a single-directory grep.
import { Platform } from "react-native";

export const isWeb = Platform.OS === "web";
export const isIOS = Platform.OS === "ios";
export const isAndroid = Platform.OS === "android";

/** What the server should record this client as. */
export const clientPlatform = Platform.OS;
