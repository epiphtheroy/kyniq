// Store review — the only rating prompt we are allowed to show.
//
// App Store Review Guideline 1.1.7 forbids an app from building its own rating
// dialog: the system sheet is the only legal prompt. It is also the scarcest
// interaction the app has. The OS rate-limits it (iOS: at most three sheets per
// app per user per 365 days), it is silent — the API never reports whether the
// sheet appeared or what was tapped — and on iOS it is deliberately unavailable
// in TestFlight, so a build handed to a tester can never demonstrate it.
//
// Given that, this module offers two verbs and refuses to grow a third:
//
//   ask()          fire the system sheet and forget. Never from a button: a
//                  button we label ourselves IS a prompt we authored, which is
//                  the thing 1.1.7 prohibits.
//   openListing()  send the reader to the listing's write-a-review form. That
//                  is a link, not a prompt — no quota, legal from a settings
//                  row, and the only path a reader can choose on purpose.
//
// WHEN to ask is a product question, and it lives in src/lib/review.ts.
//
// @divergence storeReviewPrompt
import { Linking } from "react-native";
import { isIOS } from "./env";

// expo-store-review is a NATIVE module, and its entry point is
// `requireNativeModule("ExpoStoreReview")` — a call that THROWS when the running
// binary was built without it. A static import would therefore run at bundle
// startup, before any of our code, and an OTA update carrying it to today's
// build would not degrade: it would crash the app on launch for every reader who
// has it installed, with no way back except a store release.
//
// So the module is required lazily, once, behind a catch. The two consequences
// are both the ones we want: this file ships over the air today (the listing link
// is pure Linking and needs nothing native), and the system prompt simply reports
// itself unavailable until the next native build lands, at which point it starts
// working with no second deploy.
type StoreReviewModule = typeof import("expo-store-review");

let native: StoreReviewModule | null | undefined; // undefined = not tried yet

function storeReview(): StoreReviewModule | null {
  if (native === undefined) {
    try {
      native = require("expo-store-review") as StoreReviewModule;
    } catch {
      native = null; // this binary predates the module — not an error, just old
    }
  }
  return native;
}

const APP_STORE_ID = "6792487455";
const ANDROID_PACKAGE = "net.metatake.app";

/**
 * Can the OS show its rating sheet right now? False on web, in TestFlight, on
 * Android below 5.0, and on any binary built before the module existed. Every
 * false here means "skip quietly" — a reader who cannot be asked is not an
 * error condition.
 */
export async function canAsk(): Promise<boolean> {
  const m = storeReview();
  if (!m) return false;
  try {
    return (await m.isAvailableAsync()) && (await m.hasAction());
  } catch {
    return false;
  }
}

/**
 * Show the system rating sheet. Resolves identically whether the sheet appeared,
 * was suppressed by the OS quota, or failed — the caller has already spent its
 * one ask by the time this runs, and nothing here can tell it otherwise.
 */
export async function ask(): Promise<void> {
  const m = storeReview();
  if (!m) return;
  try {
    await m.requestReview();
  } catch {
    // A prompt that throws into a UI callback would be worse than no prompt.
  }
}

/** The store listing, opened onto its write-a-review form. */
export async function openListing(): Promise<void> {
  const web = isIOS
    ? `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`
    : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  // market:// hands Android straight to the installed Play app and skips the
  // browser bounce, but it has nothing to open on a device without Play (an
  // emulator, a sideloaded build) — so it is tried first and the https URL is
  // the fallback, not the other way round.
  const native = isIOS ? web : `market://details?id=${ANDROID_PACKAGE}`;
  try {
    await Linking.openURL(native);
  } catch {
    await Linking.openURL(web).catch(() => {});
  }
}
