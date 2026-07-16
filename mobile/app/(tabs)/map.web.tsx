// Web preview stub for the Locations tab. MapLibre GL Native has no web
// renderer, and the browser build exists only so the app can be reviewed on a
// desktop — the real map ships in the iOS/Android build. Metro picks this file
// over map.tsx on web automatically (platform extension resolution).
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { View } from "react-native";
import { Screen, Serif, Ui } from "../../src/components/ui";
import { t } from "../../src/i18n";
import { fs, sp, usePalette } from "../../src/theme";

export default function MapWebStub() {
  const pal = usePalette();
  return (
    <Screen style={{ alignItems: "center", justifyContent: "center", padding: sp.s6, gap: sp.s3 }}>
      <Ionicons name="map-outline" size={40} color={pal.subtle} />
      <Serif size={fs.xl} bold>
        {t("map.title")}
      </Serif>
      <View style={{ maxWidth: 320 }}>
        <Ui size={fs.sm} color={pal.muted} style={{ textAlign: "center" }}>
          {t("map.webUnavailable")}
        </Ui>
      </View>
    </Screen>
  );
}
