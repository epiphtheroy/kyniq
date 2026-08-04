/* Connect credential reader.
 *
 * An environment variable that exists but holds only whitespace passes a `!!`
 * check and then fails at the provider. Observed 2026-08-03: TRAKT_CLIENT_ID
 * was blank this way, so `configured()` answered yes, the start route built an
 * authorize URL carrying an empty client_id, and Trakt replied
 * `invalid_client / client_id is required`. The member hit a dead end on
 * trakt.tv and nothing on our side recorded a problem — the env-gate had
 * already decided the provider was ready.
 *
 * Every Connect credential is read through cred() so blank and absent mean the
 * same thing: the tile env-gates off ("Coming soon") instead of sending someone
 * to a broken authorize page. The one-shot warn is how the owner finds a
 * half-filled variable — a silent downgrade would hide the very mistake this
 * exists to catch.
 */

const warned = new Set<string>();

/** Trimmed credential, or undefined when unset OR blank. */
export function cred(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (!value) {
    if (!warned.has(name)) {
      warned.add(name);
      console.warn(`[connect] ${name} is set but blank — treating as unconfigured`);
    }
    return undefined;
  }
  return value;
}
