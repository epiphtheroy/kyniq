import type { Session, User } from "@supabase/supabase-js";

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
 * Reproduced against auth-js 2.106.2 by taming Error in a fresh realm: with
 * extensible Errors `getUser()` returns `{ error: AuthSessionMissingError }`,
 * with non-extensible ones it rejects with exactly the production message.
 * 2.112.3, the current release, carries the identical constructor — there is no
 * version to upgrade to, so the call has to be arranged around it.
 *
 * So ask the question that has no error object in it first. `getSession()`
 * reports "no session" by returning null, never by constructing an AuthError,
 * and stays clean in the tamed realm — a signed-out visitor therefore never
 * reaches the throwing constructor at all, rather than being rescued from it
 * after the fact. That is also most of our traffic skipping a lock acquisition
 * and a discarded error object on every page.
 *
 * `getUser()` still decides who the visitor IS: getSession only gates on
 * whether a stored session exists, and the server validates the token as
 * before. (A client configured with a custom Authorization header and no
 * session would now resolve to null; nothing here builds one.)
 *
 * The catch stays as the backstop: a stored-but-expired session makes
 * getSession refresh, and a refresh failure builds an error object too.
 */
type AuthCapable = {
  auth: {
    getSession: () => Promise<{ data: { session: Session | null } }>;
    getUser: () => Promise<{ data: { user: User | null } }>;
  };
};

export async function getUserSafe(client: AuthCapable): Promise<User | null> {
  try {
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) return null;
    const { data } = await client.auth.getUser();
    return data?.user ?? null;
  } catch {
    return null;
  }
}
