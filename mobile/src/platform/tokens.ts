// Platform-aware design values.
//
// The rule this file exists to enforce: a VALUE difference between the two
// platforms is a token; an IMPLEMENTATION difference is a module. Make a value
// difference into a module and you have over-built; leave an implementation
// difference as a value and it leaks back into screens as an inline ternary.
//
// Nothing here imports ../theme — theme re-exports these, so the dependency runs
// one way only (platform -> theme -> ui -> screens) and there is no cycle.
//
// Screens never read this file directly. They read ../theme.
import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Elevation.
//
// @divergence chromeSurface (shadow half) — iOS honours the full shadow geometry;
// Android honours `elevation` alone and drops shadowRadius/Offset/Opacity, so the
// soft ambient spec collapses to a Material preset. Rather than let every call
// site spread a shadow object that half-works, both platforms get their best
// approximation of the SAME intent from one place.
type ElevationLevel = "card" | "float";

const IOS_ELEVATION = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  float: {
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
} as const;

// Android's elevation is a single dp number driving a Material shadow. These are
// tuned to read at the same weight as the iOS values above, not to match them
// numerically — the two renderers cannot produce the same shadow.
const ANDROID_ELEVATION = { card: { elevation: 3 }, float: { elevation: 8 } } as const;

/**
 * One elevation intent, rendered the best each platform can.
 *
 * Android note: `elevation` draws behind the view's whole outline, so the caller
 * must have an opaque fill. Every current caller does; keep it that way.
 */
export function elevation(level: ElevationLevel) {
  return Platform.OS === "android" ? ANDROID_ELEVATION[level] : IOS_ELEVATION[level];
}

// ---------------------------------------------------------------------------
// Chrome.
//
// @divergence chromeSurface — expo-blur is experimental on Android in SDK 54 and
// fails inside RN Modals, so Android takes an opaque bar. The failure mode being
// avoided is not "no blur"; it is the translucent-with-nothing-behind-it bar the
// app shipped before, where posters visibly crawl through the tab bar.
export const chromeMode: "blur" | "solid" = Platform.OS === "android" ? "solid" : "blur";

/** Blur intensity for the platforms that blur. Ignored where chromeMode is solid. */
export const chromeBlurIntensity = 56;

// ---------------------------------------------------------------------------
// Touch feedback.
//
// @divergence pressFeedback — a bounded ripple is the Android touch contract.
// The scale spring is shared; Android adds the ripple and drops the system click.
export const pressFeedback = {
  scale: true,
  ripple: Platform.OS === "android",
  /** Android plays a click on every Pressable by default; the app has its own vocabulary. */
  suppressSystemSound: Platform.OS === "android",
} as const;

// ---------------------------------------------------------------------------
// Navigation glyphs.
//
// Ionicons renders these identically on both platforms — nothing BREAKS. But a
// bare left chevron is an iOS control idiom, and it is the loudest "this is an
// iOS app" signal on an Android screen. The system back button, the app bar and
// every other Android app use an arrow.
export const glyphs = {
  back: Platform.OS === "android" ? ("arrow-back" as const) : ("chevron-back" as const),
  forward: Platform.OS === "android" ? ("arrow-forward" as const) : ("chevron-forward" as const),
  share: Platform.OS === "android" ? ("share-social-outline" as const) : ("share-outline" as const),
  more: Platform.OS === "android" ? ("ellipsis-vertical" as const) : ("ellipsis-horizontal" as const),
} as const;

// ---------------------------------------------------------------------------
// Stack presentation.
//
// @divergence swipeBackGesture — gestureEnabled is an iOS-only affordance;
// declaring it globally reads as though Android has it too. Naming it here keeps
// the intent honest and gives one place to revisit if predictive back is ever on.
export const stackPresentation = {
  animation: "slide_from_right" as const,
  gestureEnabled: Platform.OS === "ios",
  /** iOS-only: Android ignores an explicit duration on native-stack. */
  animationDuration: Platform.OS === "ios" ? 260 : undefined,
};
