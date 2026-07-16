// Web-preview reader. react-native-webview has no browser implementation, and
// the SSO mint is a POST the public API's CORS deliberately blocks cross-origin
// — so on web the reader is a plain iframe of the (logged-out) site.
// metatake.net sets no frame restrictions (verified 2026-07-16). Native builds
// use read.tsx (real WebView + SSO handoff + link interception).
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Hairline, Screen, Ui } from "../src/components/ui";
import { METATAKE_BASE } from "../src/config";
import { brand, fs, sp, usePalette } from "../src/theme";

// react-native-web passes host elements through; typed wrapper keeps tsc strict.
const IFrame = "iframe" as unknown as React.ComponentType<
  React.IframeHTMLAttributes<HTMLIFrameElement> & { style?: React.CSSProperties }
>;

export default function ReadScreenWeb() {
  const params = useLocalSearchParams<{ path?: string; title?: string }>();
  const router = useRouter();
  const pal = usePalette();

  const rawPath = typeof params.path === "string" && params.path ? params.path : "/";
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const title = typeof params.title === "string" && params.title ? params.title : "Metatake";
  const webUrl = useMemo(() => `${METATAKE_BASE}${path}`, [path]);

  const [loading, setLoading] = useState(true);

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: pal.bg }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: sp.s3,
            paddingVertical: sp.s2,
            gap: sp.s3,
          }}
        >
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} hitSlop={10}>
            <Ionicons name="close" size={22} color={pal.ink} />
          </Pressable>
          <Ui size={fs.sm} weight="600" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
            {title}
          </Ui>
          <Pressable onPress={() => window.open(webUrl, "_blank", "noopener")} hitSlop={10}>
            <Ionicons name="open-outline" size={20} color={pal.ink} />
          </Pressable>
        </View>
        <Hairline />
      </SafeAreaView>
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={brand.accent} />
          </View>
        ) : null}
        <IFrame
          src={webUrl}
          title={title}
          onLoad={() => setLoading(false)}
          style={{ border: "0", width: "100%", height: "100%", backgroundColor: "transparent" }}
        />
      </View>
    </Screen>
  );
}
