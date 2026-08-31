// Deep-link fallback. Any metatake.net path without a native route (e.g.
// /film/x/reception shared from the web) opens in the reader instead of a
// dead screen — the whole site stays reachable from the app.
import { Redirect, Stack, usePathname, useRouter } from "expo-router";
import React from "react";
import { GradientBtn, Screen, Ui } from "../src/components/ui";
import { t } from "../src/i18n";
import { fs, sp, usePalette } from "../src/theme";

// Paths the OS may deep-link into the app that are ours, not the website's.
const CALLBACK_PATHS = new Set(["auth-callback", "connect-callback"]);

export default function NotFoundScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const pal = usePalette();

  // Belt and braces after the 2026-08-31 sign-in bug: the reader fallback is for
  // metatake.net paths, and an OAuth redirect is not one. Android delivers those
  // as deep links, so a missing route sent metatake://auth-callback?code=… into
  // the WebView — the site answered 404 and the auth code rode a page load to get
  // there. Both callbacks have real routes now; this keeps the next one that does
  // not out of the browser.
  if (pathname && CALLBACK_PATHS.has(pathname.replace(/^\//, "").split("?")[0])) {
    return <Redirect href="/(tabs)" />;
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
