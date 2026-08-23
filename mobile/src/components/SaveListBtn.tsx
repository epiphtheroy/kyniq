// ★ Save this list — the one control that puts a curated list in You › Lists.
//
// Owner 08-03: every film list needs a way to keep the LIST. Saving must not
// touch the film ledger (that is "Add all to watchlist", a separate, explicit
// button on the list itself) — someone who taps a list only to look at it must
// never find 78 films in their watchlist afterwards.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { t } from "../i18n";
import { trackTap } from "../lib/beacon";
import { toggleSave, useSaves } from "../state/saves";
import { brand, fs, radius, sp, usePalette } from "../theme";
import { Tactile, Ui } from "./ui";

export default function SaveListBtn({
  slug,
  variant = "icon",
}: {
  slug: string;
  /** `icon` = the star alone (list cards); `label` = star + wording (list screen). */
  variant?: "icon" | "label";
}) {
  const pal = usePalette();
  const router = useRouter();
  const { has, signedIn, ready } = useSaves();
  const [busy, setBusy] = useState(false);
  const on = has("lineage", slug);

  const press = async () => {
    if (busy) return;
    if (ready && !signedIn) {
      router.push({ pathname: "/onboarding", params: { step: "account" } });
      return;
    }
    setBusy(true);
    trackTap(on ? "list:unsave" : "list:save", slug);
    await toggleSave("lineage", slug);
    setBusy(false);
  };

  if (variant === "icon") {
    return (
      <Tactile onPress={() => void press()} feedback="select" hitSlop={10}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: on ? `${brand.accent}1F` : pal.surface,
          }}
        >
          <Ionicons
            name={on ? "star" : "star-outline"}
            size={15}
            color={on ? brand.accent : pal.muted}
          />
        </View>
      </Tactile>
    );
  }

  return (
    <Tactile onPress={() => void press()} feedback="select">
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          borderRadius: radius.xs,
          paddingVertical: 12,
          paddingHorizontal: sp.s4,
          borderWidth: on ? 0 : StyleSheet.hairlineWidth,
          borderColor: pal.hairline2,
          backgroundColor: on ? `${brand.accent}1F` : "transparent",
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Ionicons
          name={on ? "star" : "star-outline"}
          size={15}
          color={on ? brand.accent : pal.ink}
        />
        <Ui size={fs.sm} weight="600" color={on ? brand.accent : pal.ink}>
          {t(on ? "list.saved" : "list.save")}
        </Ui>
      </View>
    </Tactile>
  );
}
