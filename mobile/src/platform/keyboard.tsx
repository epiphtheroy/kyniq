// Lifting content clear of the software keyboard.
//
// The two platforms solve this in different LAYERS, which is why a single
// KeyboardAvoidingView cannot serve both:
//   - iOS: the window does not resize, so React must add padding. behavior
//     "padding" is the only value that works with a scroll view underneath.
//   - Android: app.json sets softwareKeyboardLayoutMode "pan", so the SYSTEM
//     pans the window and React must do nothing. KeyboardAvoidingView with an
//     undefined behavior renders a bare View (RN's KeyboardAvoidingView.js falls
//     through to `default:`), which is correct — but only by accident, and it
//     reads as an unfinished branch.
//
// Wrapping it makes the intent explicit and gives one place to change if the
// app ever moves Android to adjustResize.
import React from "react";
import { KeyboardAvoidingView, Platform, type ViewStyle } from "react-native";

export function KeyboardLift({
  children,
  offset = 0,
  style,
}: {
  children: React.ReactNode;
  /** iOS only — how far below the screen top the lifted area begins. */
  offset?: number;
  style?: ViewStyle;
}) {
  return (
    <KeyboardAvoidingView
      // Android's window is panned by the system (app.json softwareKeyboardLayoutMode).
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={offset}
      style={style ?? { flex: 1 }}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

/**
 * Scroll-view props for a form.
 *
 * `keyboardDismissMode: "interactive"` is iOS-only (RN annotates it so in
 * ScrollView.js). Android gets "on-drag", which is the closest real behaviour
 * rather than a prop that silently does nothing.
 */
export const formScrollProps = {
  keyboardShouldPersistTaps: "handled" as const,
  keyboardDismissMode: Platform.OS === "ios" ? ("interactive" as const) : ("on-drag" as const),
};
