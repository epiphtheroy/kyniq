// Tab chrome — Liquid Glass grammar: translucent blurred bar, springy icons.
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React, { useEffect } from "react";
import { Platform, StyleSheet, useColorScheme } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { t } from "../../src/i18n";
import { usePrefs } from "../../src/state/prefs";
import { brand, font, usePalette } from "../../src/theme";

function TabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color: React.ComponentProps<typeof Ionicons>["color"];
  size: number;
  focused: boolean;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.18, { damping: 9, stiffness: 280 });
      const id = setTimeout(() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }, 140);
      return () => clearTimeout(id);
    }
    scale.value = withSpring(1, { damping: 14, stiffness: 220 });
  }, [focused, scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={anim}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const pal = usePalette();
  const scheme = useColorScheme();
  usePrefs(); // re-render tab titles when the UI locale changes

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.accent,
        tabBarInactiveTintColor: pal.muted,
        tabBarLabelStyle: { fontFamily: font.uiMed, fontSize: 10.5 },
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: pal.hairline,
          backgroundColor: Platform.OS === "android" ? pal.chrome : "transparent",
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "android" ? null : (
            <BlurView
              intensity={40}
              tint={scheme === "dark" ? "dark" : "light"}
              style={[StyleSheet.absoluteFill, { backgroundColor: pal.chrome }]}
            />
          ),
        sceneStyle: { backgroundColor: pal.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab.tonight"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "film" : "film-outline"} size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("tab.explore"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? "compass" : "compass-outline"}
              size={size}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t("tab.map"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "map" : "map-outline"} size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: t("tab.shelf"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? "library" : "library-outline"}
              size={size}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
