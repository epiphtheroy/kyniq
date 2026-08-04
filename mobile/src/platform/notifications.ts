// Platform setup that must happen before a push token can be requested.
//
// @divergence pushDelivery — Expo's push service abstracts APNs and FCM, but the
// two platforms need different preparation:
//   - Android REQUIRES a notification channel to exist before any notification
//     can be shown, and additionally needs an FCM V1 credential (google-services.json
//     + a service account on EAS) before a token can be minted at all. Without it,
//     getExpoPushTokenAsync throws.
//   - iOS needs neither.
//
// The channel call was previously inline in src/lib/push.ts, which put a
// Platform branch in the data layer. The knowledge is the same; only its address
// changed.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/** The one channel the app sends to. Must match the server's `channelId`. */
export const DEFAULT_CHANNEL_ID = "default";

/**
 * Prepare the OS to display notifications. Safe to call repeatedly; no-op off
 * Android. Must run before getExpoPushTokenAsync.
 */
export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: "Metatake",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Whether push can work at all on this build.
 *
 * Android currently has no FCM credential, so registration fails and the
 * settings toggle silently reverts — the user sees a switch that will not stay
 * on. Callers can use this to explain rather than to fail. Flip to true in the
 * same commit that adds google-services.json.
 */
export const PUSH_CREDENTIALS_CONFIGURED = Platform.OS !== "android";
