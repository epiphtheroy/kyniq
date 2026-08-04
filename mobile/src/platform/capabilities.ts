// The divergence ledger.
//
// Every place iOS and Android differ has an entry here. No entry = no
// divergence: an unlisted platform branch is a bug, and scripts/check-platform.mjs
// fails the build on one.
//
// This file exists to answer the only question that matters when two platforms
// are managed together forever: "what is different, and was it on purpose?"
// Plan of record: HANDOFF-안드로이드-패리티-아키텍처.md §3.
//
// Three things are derived from this file and nothing else:
//   1. the QA matrix (qaMatrix() below) — what a human must look at on Android,
//      which is the whole test plan on a project with no Android device yet;
//   2. the debt count — `parity: "debt"` entries are differences that should not
//      exist, and CI counts them so they cannot quietly accumulate;
//   3. the review question for any PR that adds a branch: "is it in the ledger?"

export type Parity =
  /** Permanently different, and that is correct. Needs no exit plan. */
  | "acceptable"
  /** Different for now. `exit` says what would end it. */
  | "temporary"
  /** Should not differ. This is debt, and CI counts it. */
  | "debt";

export type Divergence = {
  /** What iOS does, in one phrase a human can check on a screen. */
  ios: string;
  /** What Android does. */
  android: string;
  /** Why this is the right call — the argument, not the mechanism. */
  why: string;
  parity: Parity;
  /** Required when parity is "temporary": the condition that collapses it. */
  exit?: string;
  /** Files allowed to implement this divergence. check-platform.mjs asserts
   *  that every platform branch in the tree is covered by some entry's files. */
  files: readonly string[];
  /** The observable check, phrased so someone holding an Android phone can do it. */
  qa: string;
};

export const DIVERGENCE = {
  mapEngine: {
    ios: "react-native-maps (Apple Maps) — in the binary, needs no key, draws instantly",
    android: "MapLibre GL JS in a WebView — needs no key, renders the canonical satellite look",
    why:
      "Two engines on purpose, not as a stopgap. Neither platform can run the other's cheaply: " +
      "Apple Maps cannot render Esri raster at all, and Google Maps on Android would require a " +
      "second Cloud key plus both SHA-1 fingerprints for a map that is currently free of key " +
      "management entirely. The owner measured the WebView's cold start on iOS on 2026-08-03 and " +
      "moved iOS off it; that decision stands and this entry does not re-open it.",
    parity: "acceptable",
    files: ["src/platform/map/index.tsx", "src/screens/MapExpoGo.tsx", "src/screens/MapWebView.tsx"],
    qa: "Both platforms: a pin tap opens the film card, 'Near me' asks for location exactly once.",
  },

  mapFeatureDelta: {
    ios: "Plain basemap, no clustering (markers capped at 300 per viewport), plain pins",
    android: "Esri satellite, clustered pins, poster thumbnails",
    why:
      "This one is NOT acceptable — it is the cost of two engines showing up as a product " +
      "difference, and it is debt rather than design. It is also the proof that this ledger is " +
      "needed: on 2026-08-03 the owner asked for two specific map changes (an 'Only this film' " +
      "action, and dropping the world-view title pill). Both landed in MapExpoGo.tsx (iOS) and " +
      "neither reached MapWebView.tsx (Android). Nothing failed — no type error, no test, no " +
      "warning. That is a whole platform silently missing an owner instruction inside one day.",
    parity: "debt",
    exit:
      "Either bring clustering + the 08-03 chrome to the iOS surface, or collapse to one renderer. " +
      "Both surfaces must satisfy one contract so a chrome change cannot land on only one of them.",
    files: ["src/screens/MapExpoGo.tsx", "src/screens/MapWebView.tsx"],
    qa: "Both platforms: the world view has no title pill; tapping a pin from the world view offers 'Only this film'.",
  },

  appleSignIn: {
    ios: "Native Apple sign-in button",
    android: "Absent",
    why:
      "Apple's API exists only on Apple platforms. Google OAuth and the email code cover Android " +
      "completely, so nothing is lost except the button itself.",
    parity: "acceptable",
    files: ["src/platform/auth-providers.ts", "src/components/SignInPanel.tsx"],
    qa: "Android sign-in panel shows Google + email only — no gap, no dead button where Apple used to be.",
  },

  chromeSurface: {
    ios: "BlurView behind the tab bar (Liquid Glass)",
    android: "Opaque fill",
    why:
      "expo-blur is experimental on Android in SDK 54 and is known to fail inside RN Modals. The " +
      "honest fallback is an opaque bar. A 72%-translucent bar with no blur behind it — what the " +
      "app shipped before — is the one option that is actually wrong, because posters crawl through it.",
    parity: "temporary",
    exit: "Expo SDK 55 makes Android blur stable. Gated by invariant 13: project SDK <= the SDK Expo Go ships.",
    files: ["src/platform/tokens.ts", "app/(tabs)/_layout.tsx"],
    qa: "Android: scroll a poster list under the tab bar — nothing shows through it.",
  },

  pressFeedback: {
    ios: "Scale spring only",
    android: "Scale spring + bounded ripple, system click sound suppressed",
    why:
      "A ripple is the Android touch contract. Without it a full-width row's 0.96 scale is too " +
      "subtle to read as a press, and dense lists feel unresponsive.",
    parity: "acceptable",
    files: ["src/platform/tokens.ts", "src/components/ui.tsx"],
    qa: "Android: tapping a film row shows a ripple bounded to the row, with no click sound.",
  },

  hapticVocabulary: {
    ios: "Every step of a drag gets its own tick (Taptic engine)",
    android: "Ticks are throttled during a continuous drag",
    why:
      "Dragging the rating track crosses up to ten half-star steps in under 300ms. iOS renders ten " +
      "crisp ticks; an Android LRA motor cannot start and stop that fast and turns the same call " +
      "sequence into one continuous rattle, which reads as a malfunction.",
    parity: "acceptable",
    files: ["src/platform/haptics.ts"],
    qa: "Android: drag across the whole star track — you feel distinct steps, not a buzz.",
  },

  systemBack: {
    ios: "No hardware back; edge swipe pops the stack",
    android: "Hardware/gesture back, intercepted by any surface that owns a step",
    why:
      "Android's back button is a first-class navigation input with no iOS equivalent. Surfaces " +
      "with internal steps (onboarding, the in-app reader, overlays) must answer it or back " +
      "destroys work the user is in the middle of.",
    parity: "acceptable",
    files: ["src/platform/back.ts"],
    qa: "Android: back on onboarding step 3 goes to step 2, not out of onboarding. Back in the reader goes back a page.",
  },

  swipeBackGesture: {
    ios: "Interactive swipe-from-edge to go back",
    android: "Absent — the system back button and the header arrow carry it",
    why:
      "react-native-screens has no interactive swipe-back on Android, and predictive back is off " +
      "(app.json). This is not worth emulating: Android users reach for the system control.",
    parity: "acceptable",
    files: ["app/_layout.tsx"],
    qa: "Android: every screen with a back arrow can also be left with the system back gesture.",
  },

  pushDelivery: {
    ios: "APNs via Expo push, credentials on EAS",
    android: "FCM via Expo push — requires google-services.json, not yet configured",
    why:
      "Expo's push service abstracts both, but Android additionally needs an FCM V1 credential. " +
      "Until it exists, registration fails and the app degrades quietly rather than breaking.",
    parity: "debt",
    files: ["src/platform/notifications.ts", "src/lib/push.ts"],
    qa:
      "Android, DEVELOPMENT BUILD ONLY: the push toggle in settings stays ON after a relaunch " +
      "(today it silently reverts). Not testable in Expo Go — remote push was removed from Expo Go " +
      "in SDK 53, so Expo Go always logs a warning here regardless of our configuration.",
  },
} as const satisfies Record<string, Divergence>;

export type DivergenceKey = keyof typeof DIVERGENCE;

/** Entries that should not exist. CI keeps this at or below its agreed number. */
export function debts(): DivergenceKey[] {
  return (Object.keys(DIVERGENCE) as DivergenceKey[]).filter(
    (k) => DIVERGENCE[k].parity === "debt",
  );
}

/**
 * The Android test plan, derived rather than written.
 *
 * There is no Android device on this project yet (owner, 2026-08-03), so this
 * list IS the QA plan for the day one arrives — and it cannot drift from the
 * code, because adding a divergence without a `qa` line does not compile.
 */
export function qaMatrix(): { key: DivergenceKey; parity: Parity; check: string }[] {
  return (Object.keys(DIVERGENCE) as DivergenceKey[]).map((key) => ({
    key,
    parity: DIVERGENCE[key].parity,
    check: DIVERGENCE[key].qa,
  }));
}
