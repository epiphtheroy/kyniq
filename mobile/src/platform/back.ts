// Android system back.
//
// @divergence systemBack — iOS has no hardware back, so a screen that owns
// internal steps can ignore the question entirely. On Android the same screen
// must answer it or back destroys whatever the user was in the middle of.
//
// The app had ZERO BackHandler usage before 2026-08-03 while running a four-step
// onboarding inside a single route: pressing back on step 3 popped the whole
// route and dropped a first-run user into the tabs mid-setup.
//
// RN Modals are already covered — all four pass onRequestClose, which Android
// back triggers. This hook is for the surfaces that are NOT modals: multi-step
// flows, in-place overlays, and WebViews with their own history.
import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";

/**
 * Intercept Android's back press while `enabled`.
 *
 * `handler` returns true when it consumed the press. Returning false lets the
 * press fall through to the next handler and ultimately to navigation, which is
 * what you want for the first step of a flow.
 *
 * No-op on iOS and web, so call sites never branch.
 */
export function useAndroidBack(handler: () => boolean, enabled = true): void {
  useEffect(() => {
    if (Platform.OS !== "android" || !enabled) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => sub.remove();
  }, [handler, enabled]);
}
