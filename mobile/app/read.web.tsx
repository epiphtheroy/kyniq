// Web-preview reader. react-native-webview has no browser implementation, and
// the SSO mint is a POST the public API's CORS deliberately blocks cross-origin
// — so on web the reader is a plain iframe of the (logged-out) site.
// metatake.net sets no frame restrictions (verified 2026-07-16). Native builds
// use read.tsx (real WebView + SSO handoff + link interception).
// Chrome mirrors the native sheet: grab handle + circle-disc buttons.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Hairline, Screen, Tactile, Ui } from "../src/components/ui";
import { readerUrl } from "../src/lib/webUrl";
import { usePrefs } from "../src/state/prefs";
import { brand, fs, radius, sp, usePalette } from "../src/theme";

// react-native-web passes host elements through; typed wrapper keeps tsc strict.
const IFrame = "iframe" as unknown as React.ComponentType<
  React.IframeHTMLAttributes<HTMLIFrameElement> & { style?: React.CSSProperties }
>;

/** 32px circle-disc chrome button (sheet header grammar). */
function HeaderDisc({
  icon,
  onPress,
  iconSize = 17,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  iconSize?: number;
}) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress} hitSlop={8}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.pill,
          backgroundColor: pal.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={iconSize} color={pal.ink} />
      </View>
    </Tactile>
  );
}

export default function ReadScreenWeb() {
  const params = useLocalSearchParams<{ path?: string; title?: string }>();
  const router = useRouter();
  const pal = usePalette();

  const rawPath = typeof params.path === "string" && params.path ? params.path : "/";
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const title = typeof params.title === "string" && params.title ? params.title : "Metatake";
  const { locale } = usePrefs();
  const webUrl = useMemo(() => readerUrl(path, locale), [path, locale]);

  const [loading, setLoading] = useState(true);

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: pal.bg }}>
        <View style={{ alignItems: "center", paddingTop: sp.s2 }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: pal.hairline2,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: sp.s3,
            paddingVertical: sp.s2,
            gap: sp.s3,
          }}
        >
          <HeaderDisc
            icon="close"
            iconSize={18}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          />
          <Ui size={fs.sm} weight="600" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
            {title}
          </Ui>
          <HeaderDisc icon="open-outline" onPress={() => window.open(webUrl, "_blank", "noopener")} />
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
