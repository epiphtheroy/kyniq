import type { User } from "@supabase/supabase-js";

/**
 * `supabase.auth.getUser()` that resolves instead of rejecting.
 *
 * For a signed-out visitor auth-js takes an ordinary path: it *constructs* an
 * AuthSessionMissingError and hands it back as `{ error }`. Some browsers
 * harden the JS intrinsics — extension-injected SES `lockdown()` and friends —
 * which leaves Error instances non-extensible, so `this.__isAuthError = true`
 * in the AuthError constructor throws a TypeError instead. auth-js only
 * swallows AuthErrors (`isAuthError(error)` is false for a TypeError), so that
 * TypeError escapes `getUser()`; awaited bare inside an effect it lands as an
 * unhandled rejection. Seen in production on Safari 17.6 (2026-08-16), which
 * reached Sentry as a high-priority `Cannot add property __isAuthError`.
 *
 * Every path that reaches the catch is one where auth-js was already reporting
 * failure rather than a user, so degrading to "signed out" is what the library
 * itself would have returned had it managed to build its error object.
 */
type AuthCapable = {
  auth: { getUser: () => Promise<{ data: { user: User | null } }> };
};

export async function getUserSafe(client: AuthCapable): Promise<User | null> {
  try {
    const { data } = await client.auth.getUser();
    return data?.user ?? null;
  } catch {
    return null;
  }
}
