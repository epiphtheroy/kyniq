// A way back to /preview from any screen. DEV + web only.
//
// The screen index is only useful if you can reach it after you have navigated
// four levels into a drive. On a phone you would press back; on a laptop you
// would retype the URL, which is exactly the friction the index was made to
// remove.
//
// Compiled out of any release build: `__DEV__` is false there, and this renders
// null on native regardless — so it can never appear in front of a reader, and
// never in a store screenshot.
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, Text, View } from "react-native";

export default function PreviewBadge() {
  const router = useRouter();
  if (!__DEV__ || Platform.OS !== "web") return null;
  return (
    <View
      // Bottom-LEFT: the tab bar owns the bottom centre, and the right side is
      // where sheets put their primary action.
      style={{ position: "absolute", left: 10, bottom: 96, zIndex: 9999 }}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => router.push("/preview" as never)}
        style={{
          paddingVertical: 6,
          paddingHorizontal: 11,
          borderRadius: 999,
          backgroundColor: "rgba(0,0,0,0.72)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.28)",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>화면 목록</Text>
      </Pressable>
    </View>
  );
}
