// Metro config.
//
// Why this file exists: expo-router builds its route table with require.context
// over app/, and that context pulls EVERY route module into EVERY platform
// bundle — including `app/(tabs)/map.tsx`, whose native map stack imports
// react-native-maps. On web that package reaches into react-native internals
// ("Importing native-only module ... on web") and the bundle fails, even though
// `map.web.tsx` is what actually renders there and the native module never runs.
//
// So: on web only, resolve react-native-maps to an empty module. Nothing on web
// touches it — map.web.tsx draws MapLibre GL JS directly — and iOS/Android
// resolution is untouched. (SDK 57's react-native-maps 1.27 shipped a web build
// and did not need this; SDK 54 pins 1.20, which does not.)
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return { type: "empty" };
  }
  return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
