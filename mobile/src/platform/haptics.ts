// Haptics — one vocabulary, safe everywhere.
//
// Moved out of components/motion.tsx on 2026-08-03: the vocabulary is shared, but
// WHEN a buzz is allowed to fire is a platform question, and that question does
// not belong in a presentation module.
//
// @divergence hapticVocabulary — iOS's Taptic engine renders ten discrete ticks
// across a 300ms drag as ten clean steps. An Android LRA motor cannot start and
// stop that fast: the same call sequence becomes one continuous rattle, which
// reads as a malfunction rather than as feedback. So on Android a continuous
// gesture's ticks are throttled to the rate the hardware can actually articulate.
//
// Haptics are advisory everywhere: web has no API, permissions can be off, and a
// failed buzz must never throw into a gesture handler.
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const SUPPORTED = Platform.OS === "ios" || Platform.OS === "android";

/** Minimum gap between ticks inside a continuous drag. iOS: none. */
const STEP_INTERVAL_MS = Platform.OS === "android" ? 55 : 0;

let lastStepAt = 0;

function buzz(run: () => Promise<unknown>) {
  if (!SUPPORTED) return;
  void run().catch(() => {});
}

export const haptic = {
  /** A tap landed on something that changed state. */
  tap: () => buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A heavier commitment — judging a film, starting a route. */
  press: () => buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Moving through a set of options (chips, steps). Discrete, not during a drag. */
  select: () => buzz(() => Haptics.selectionAsync()),
  /**
   * One step of a CONTINUOUS gesture — the rating drag crossing a half-star, a
   * scrubber passing a notch. Throttled on Android; identical to `select` on iOS.
   * Use this, not `select`, inside anything driven by a moving finger.
   */
  step: () => {
    if (STEP_INTERVAL_MS) {
      const now = Date.now();
      if (now - lastStepAt < STEP_INTERVAL_MS) return;
      lastStepAt = now;
    }
    buzz(() => Haptics.selectionAsync());
  },
  /** It worked. */
  success: () => buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** It didn't. */
  warn: () => buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
