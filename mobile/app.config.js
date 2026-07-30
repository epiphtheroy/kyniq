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
// Android would need its OWN key — one key cannot hold both an iOS and an
// Android restriction — plus the Play app-signing SHA-1, not just the upload
// key's. Not needed while Android renders maps through the WebView path.
const MAPS_KEY = process.env.GOOGLE_MAPS_IOS_KEY || "";

module.exports = ({ config }) => {
  if (!MAPS_KEY) return config;
  return {
    ...config,
    ios: {
      ...config.ios,
      config: { ...(config.ios?.config ?? {}), googleMapsApiKey: MAPS_KEY },
    },
    android: {
      ...config.android,
      config: {
        ...(config.android?.config ?? {}),
        googleMaps: { ...(config.android?.config?.googleMaps ?? {}), apiKey: MAPS_KEY },
      },
    },
  };
};
