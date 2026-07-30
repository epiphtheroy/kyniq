// Tab chrome — Liquid Glass grammar: translucent blurred bar, springy icons.
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React, { useEffect } from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { haptic } from "../../src/components/motion";
import { t } from "../../src/i18n";
import { usePrefs } from "../../src/state/prefs";
import { brand, font, motion, radius, usePalette } from "../../src/theme";

/**
 * Tab icon — a Lava-tinted capsule grows in behind the focused icon (the Liquid
 * Glass "selected" affordance) while the glyph springs once and settles.
 */
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
  const on = useSharedValue(focused ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    on.value = withTiming(focused ? 1 : 0, { duration: motion.fast });
    scale.value = focused
      ? withSequence(withSpring(1.18, motion.bouncy), withSpring(1, motion.snappy))
      : withSpring(1, motion.snappy);
  }, [focused, on, scale]);

  const glyph = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const capsule = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scale: interpolate(on.value, [0, 1], [0.66, 1]) }],
  }));

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: size + 24,
            height: size + 10,
            borderRadius: radius.pill,
            backgroundColor: `${brand.accent}1F`,
          },
          capsule,
        ]}
      />
      <Animated.View style={glyph}>
        <Ionicons name={name} size={size} color={color} />
      </Animated.View>
    </View>
  );
}

/** Every tab press answers with a small click. */
const tabFeedback = { tabPress: () => haptic.select() };

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
              intensity={56}
              tint={scheme === "dark" ? "dark" : "light"}
              style={[StyleSheet.absoluteFill, { backgroundColor: pal.chrome }]}
            />
          ),
        sceneStyle: { backgroundColor: pal.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={tabFeedback}
        options={{
          title: t("tab.tonight"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "film" : "film-outline"} size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        listeners={tabFeedback}
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
        name="navigator"
        listeners={tabFeedback}
        options={{
          title: t("tab.navigator"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "navigate" : "navigate-outline"} size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="my"
        listeners={tabFeedback}
        options={{
          title: t("tab.you"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? "person" : "person-outline"}
              size={size}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      {/* Map retired as a tab (owner 2026-07-29) — the route stays (href:null hides the
          tab) so the film detail's Locations mini-map "open in map" deep-link still works. */}
      <Tabs.Screen name="map" options={{ href: null }} />
    </Tabs>
  );
}
