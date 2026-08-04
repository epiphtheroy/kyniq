// Which sign-in providers this platform can offer.
//
// @divergence appleSignIn — Apple's API exists only on Apple platforms. Google
// OAuth and the email code cover Android completely, so the only thing Android
// loses is the button. The panel must not leave a gap where it used to be.
//
// Two things the app already does right and that must not regress:
//   - expo-apple-authentication is import-safe on Android (it resolves; its
//     isAvailableAsync just answers false), so the gate is about what to DRAW,
//     not about whether the module loads.
//   - Google OAuth's metatake:// redirect is registered on Android automatically
//     from app.json `scheme`, so no second OAuth client is needed.
import { Platform } from "react-native";

export type AuthProvider = "email" | "google" | "apple";

/** Providers to render, in the order the sign-in panel should show them. */
export const authProviders: readonly AuthProvider[] =
  Platform.OS === "ios" ? (["email", "google", "apple"] as const) : (["email", "google"] as const);

export function hasAuthProvider(p: AuthProvider): boolean {
  return authProviders.includes(p);
}

/**
 * An account created with Apple's "Hide My Email" relay has no password and no
 * reachable inbox from Android's side, so such a user cannot sign in on Android
 * at all. Nothing in the client can fix that — it needs an account-linking flow
 * on the server. Tracked so the case is not rediscovered as a mystery bug.
 */
export const APPLE_RELAY_ACCOUNTS_STRANDED_ON_ANDROID = true;
