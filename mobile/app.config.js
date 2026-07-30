// Dynamic Expo config — everything static still lives in app.json; this file
// only injects what must NOT be committed.
//
// The Google Maps native SDKs read their key from the built binary's Info.plist /
// AndroidManifest, so it has to be in the config at BUILD time. This repo is
// PUBLIC, so the key cannot sit in app.json: it comes from the environment
// (EAS secret GOOGLE_MAPS_KEY for cloud builds, .env.local for local ones).
//
// No key configured → the key is simply absent from the build, and
// FilmMiniMap falls back to Apple Maps on iOS instead of rendering a blank
// Google view. That is the difference between a missing key and a broken map.
//
// ⚠️ The key ships inside the app binary and can be extracted. Restrict it in
// Google Cloud Console to the iOS bundle id (net.metatake.app) and the Android
// package + signing certificate, and enable only "Maps SDK for iOS/Android".
const MAPS_KEY = process.env.GOOGLE_MAPS_KEY || "";

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
