// Dynamic Expo config — everything static still lives in app.json; this file
// only injects what must NOT be committed.
//
// The Google Maps native SDKs read their key from the built binary's Info.plist /
// AndroidManifest, so it has to be in the config at BUILD time. This repo is
// PUBLIC, so the key cannot sit in app.json: it comes from the environment
// (EAS secret GOOGLE_MAPS_IOS_KEY).
//
// Deliberately NOT the same name as GOOGLE_MAPS_KEY: that one is the server's
// key, used by worker/geo-code.py for Geocoding, and it carries no application
// restriction because a server has no bundle id. The app's key is restricted to
// the iOS bundle and to Maps SDK for iOS alone — so if the two ever got mixed
// up, either the geocoding worker or the in-app map would break. Separate names
// make that impossible.
//
// No key configured → the key is simply absent from the build, and
// FilmMiniMap falls back to Apple Maps on iOS instead of rendering a blank
// Google view. That is the difference between a missing key and a broken map.
//
// ⚠️ The key ships inside the app binary and can be extracted, so it is
// restricted in Cloud Console to bundle id net.metatake.app + Maps SDK for iOS
// (verified: the same key is refused for Geocoding from a server IP).
//
// One key CANNOT hold both an iOS and an Android restriction, so the iOS key
// must never reach the Android manifest — an iOS-restricted key there yields a
// grey "authorization failure" map, which is strictly worse than no key at all
// (no key = react-native-maps is simply never selected on Android).
//
// Until 2026-08-03 this file spread MAPS_KEY into android.config.googleMaps too,
// contradicting the paragraph above: `eas.json` sets `environment: production`
// so the secret is present at Android build time as well, and the AAB's
// AndroidManifest got com.google.android.geo.API_KEY = a key Google refuses for
// that package. Android renders maps through the WebView (MapLibre GL JS, no key
// required, and it is the RICHER map: Esri satellite + clustering + poster pins,
// versus Apple Maps' plain basemap with no clustering). So Android needs no key,
// and adding one would trade those features away. See
// HANDOFF-안드로이드-패리티-아키텍처.md §4.
//
// Rule: this file emits a platform's config block ONLY from that platform's own
// env var. A second key, if Android ever needs one, gets its own name.
const IOS_MAPS_KEY = process.env.GOOGLE_MAPS_IOS_KEY || "";

module.exports = ({ config }) => {
  if (!IOS_MAPS_KEY) return config;
  return {
    ...config,
    ios: {
      ...config.ios,
      config: { ...(config.ios?.config ?? {}), googleMapsApiKey: IOS_MAPS_KEY },
    },
  };
};
