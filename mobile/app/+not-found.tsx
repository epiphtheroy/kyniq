// Deep-link fallback. Any metatake.net path without a native route (e.g.
// /film/x/reception shared from the web) opens in the reader instead of a
// dead screen — the whole site stays reachable from the app.
import { Redirect, Stack, usePathname, useRouter } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { GradientBtn, Screen, Ui } from "../src/components/ui";
import { t } from "../src/i18n";
import { fs, sp, usePalette } from "../src/theme";

export default function NotFoundScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const pal = usePalette();

  // In a web dev build this fallback is a trap: mistype a route and the app
  // silently shows you metatake.net inside a WebView, which looks like the
  // native screen rendered wrong. Say what happened, and offer the index.
  if (__DEV__ && Platform.OS === "web") {
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center", gap: sp.s3, padding: sp.s5 }}>
        <Stack.Screen options={{ title: "" }} />
        <Ui size={fs.lg} weight="600">
          {pathname}
        </Ui>
        <Ui color={pal.muted} style={{ textAlign: "center" }}>
          네이티브 라우트가 아닙니다. 출시 빌드에서는 이 경로가 리더(WebView)로 열립니다.
        </Ui>
        <GradientBtn label="화면 목록" onPress={() => router.replace("/preview")} style={{ alignSelf: "stretch" }} />
        <GradientBtn label="리더로 열기" onPress={() => router.replace({ pathname: "/read", params: { path: pathname } })} style={{ alignSelf: "stretch" }} />
      </Screen>
    );
  }

  if (pathname && pathname !== "/") {
    return <Redirect href={{ pathname: "/read", params: { path: pathname } }} />;
  }

  return (
    <Screen
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: sp.s4,
        paddingHorizontal: sp.s5,
      }}
    >
      <Stack.Screen options={{ title: "" }} />
      <Ui size={fs.x2} weight="600" style={{ textAlign: "center" }}>
        {t("notfound.title")}
      </Ui>
      <Ui color={pal.muted} style={{ textAlign: "center" }}>
        {t("notfound.body")}
      </Ui>
      <GradientBtn
        label={t("notfound.back")}
        onPress={() => router.replace("/(tabs)")}
        style={{ marginTop: sp.s2, alignSelf: "stretch" }}
      />
    </Screen>
  );
}
