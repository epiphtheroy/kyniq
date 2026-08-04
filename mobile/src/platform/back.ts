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
import { useIsFocused } from "@react-navigation/native";

/**
 * Intercept Android's back press while `enabled`.
 *
 * `handler` returns true when it consumed the press. Returning false lets the
 * press fall through to the next handler and ultimately to navigation, which is
 * what you want for the first step of a flow.
 *
 * No-op on iOS and web, so call sites never branch.
 *
 * The subscription is gated on focus, and that is not a refinement — it is the
 * difference between working and appearing broken. A screen that pushes another
 * route on top of itself stays MOUNTED (react-freeze is off in this app), so
 * without the gate its handler is still subscribed while the user is looking at
 * the screen above. RN dispatches hardwareBackPress newest-first, so the hidden
 * screen wins every press: on Android, opening Connect from onboarding step 4
 * ate three back presses in a row while the funnel silently rewound underneath,
 * and only the fourth reached navigation. Anything registered later — a map
 * overlay, a drive card — would have taken the press from the visible screen the
 * same way. Focus, not mount, is what makes a handler the right one to ask.
 */
export function useAndroidBack(handler: () => boolean, enabled = true): void {
  const focused = useIsFocused();
  useEffect(() => {
    if (Platform.OS !== "android" || !enabled || !focused) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => sub.remove();
  }, [handler, enabled, focused]);
}
