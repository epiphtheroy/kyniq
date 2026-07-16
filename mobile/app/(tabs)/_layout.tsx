import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import React from "react";
import { t } from "../../src/i18n";
import { usePrefs } from "../../src/state/prefs";
import { brand, font, usePalette } from "../../src/theme";

export default function TabLayout() {
  const pal = usePalette();
  usePrefs(); // re-render tab titles when the UI locale changes

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.accent,
        tabBarInactiveTintColor: pal.muted,
        tabBarStyle: { backgroundColor: pal.bg, borderTopColor: pal.hairline },
        tabBarLabelStyle: { fontFamily: font.uiMed, fontSize: 10.5 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab.tonight"),
          tabBarIcon: ({ color, size }) => <Ionicons name="film-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("tab.search"),
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t("tab.map"),
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: t("tab.my"),
          tabBarIcon: ({ color, size }) => <Ionicons name="bookmark-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
