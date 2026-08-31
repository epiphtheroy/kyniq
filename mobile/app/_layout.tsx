import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  PTSerif_400Regular,
  PTSerif_400Regular_Italic,
  PTSerif_700Bold,
} from "@expo-google-fonts/pt-serif";
import { useFonts } from "expo-font";
// Navigation themes come from @react-navigation/native — expo-router only
// re-exports them on some majors, and the direct import is stable either way.
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, usePathname, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { useColorScheme } from "react-native";
import "react-native-reanimated";

import { startBeacon, trackScreen } from "../src/lib/beacon";
import { RateProvider } from "../src/components/RateSheet";
import { FilmsProvider } from "../src/state/films";
import { PrefsProvider } from "../src/state/prefs";
import { brand, dark, font, light } from "../src/theme";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PTSerif_400Regular,
    PTSerif_400Regular_Italic,
    PTSerif_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return <RootLayoutNav />;
}

/**
 * Screen views for the app beacon. The pattern (useSegments) is what the
 * dashboard groups by — "/film/[slug]" rather than 6,978 one-off paths — and
 * the concrete path rides along as the arg.
 */
function useScreenBeacon() {
  const pathname = usePathname();
  const segments = useSegments();
  const pattern = "/" + (segments as string[]).join("/");
  useEffect(() => startBeacon(), []);
  useEffect(() => {
    trackScreen(pattern === "/" ? "/" : pattern, pathname);
  }, [pattern, pathname]);
}

function RootLayoutNav() {
  useScreenBeacon();
  const scheme = useColorScheme();
  const pal = scheme === "dark" ? dark : light;
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: brand.accent,
      background: pal.bg,
      card: pal.bg,
      text: pal.ink,
      border: pal.hairline,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <PrefsProvider>
        <FilmsProvider>
          {/* The rating sheet lives above every screen — one rating interaction
              for the whole app (see components/RateSheet.tsx). */}
          <RateProvider>
            <Stack
              screenOptions={{
                headerShadowVisible: false,
                headerTintColor: pal.ink,
                headerTitleStyle: { fontFamily: font.uiSemi, fontSize: 15 },
                headerStyle: { backgroundColor: pal.bg },
                contentStyle: { backgroundColor: pal.bg },
                // Motion: push from the right at iOS's own pace, and let the
                // swipe-back gesture work everywhere (it reads as "cheap to look").
                animation: "slide_from_right",
                animationDuration: 280,
                gestureEnabled: true,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "fade" }} />
              {/* OAuth returns. Chromeless and animation-free: on Android these
                  are a real navigation the user did not ask for, and they last
                  as long as a code exchange. */}
              <Stack.Screen name="auth-callback" options={{ headerShown: false, animation: "none" }} />
              <Stack.Screen name="connect-callback" options={{ headerShown: false, animation: "none" }} />
              <Stack.Screen name="navigator/drive" options={{ headerShown: false }} />
              <Stack.Screen name="film/[slug]" options={{ title: "" }} />
              <Stack.Screen name="director/[slug]" options={{ title: "" }} />
              <Stack.Screen
                name="read"
                options={{ presentation: "modal", headerShown: false, animation: "slide_from_bottom" }}
              />
              <Stack.Screen
                name="onboarding"
                options={{
                  presentation: "fullScreenModal",
                  headerShown: false,
                  animation: "slide_from_bottom",
                  // Editing one step from a chip should feel like a sheet, not a push.
                  gestureEnabled: false,
                }}
              />
            </Stack>
          </RateProvider>
          <StatusBar style="auto" />
        </FilmsProvider>
      </PrefsProvider>
    </ThemeProvider>
  );
}
