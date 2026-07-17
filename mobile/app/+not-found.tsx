// Deep-link fallback. Any metatake.net path without a native route (e.g.
// /film/x/reception shared from the web) opens in the reader instead of a
// dead screen — the whole site stays reachable from the app.
import { Redirect, Stack, usePathname, useRouter } from "expo-router";
import React from "react";
import { GradientBtn, Screen, Ui } from "../src/components/ui";
import { t } from "../src/i18n";
import { fs, sp, usePalette } from "../src/theme";

export default function NotFoundScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const pal = usePalette();

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
