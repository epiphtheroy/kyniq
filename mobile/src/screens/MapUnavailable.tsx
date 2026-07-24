// Shown wherever the native map can't run: the browser preview (no web renderer)
// and Expo Go (MapLibre is a custom native module, absent from the Expo Go
// binary). Both are review surfaces, so this explains rather than red-screens.
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { View } from "react-native";
import { Screen, Serif, Ui } from "../components/ui";
import { t, type DictKey } from "../i18n";
import { fs, sp, usePalette } from "../theme";

export function MapUnavailable({ reason }: { reason?: DictKey }) {
  const pal = usePalette();
  return (
    <Screen style={{ alignItems: "center", justifyContent: "center", padding: sp.s6, gap: sp.s3 }}>
      <Ionicons name="map-outline" size={40} color={pal.subtle} />
      <Serif size={fs.xl} bold>
        {t("map.title")}
      </Serif>
      <View style={{ maxWidth: 320 }}>
        <Ui size={fs.sm} color={pal.muted} style={{ textAlign: "center" }}>
          {t(reason ?? "map.webUnavailable")}
        </Ui>
      </View>
    </Screen>
  );
}
