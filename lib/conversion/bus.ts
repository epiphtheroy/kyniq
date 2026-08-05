/**
 * A tiny window-event bus so a PARENT of ConversionProvider (e.g. UserFilmsProvider,
 * which owns the anon save→redirect guard) can raise the AuthSheet without a React
 * context dependency on its own descendant. Descendant components should prefer the
 * `useConversion()` context hook instead. See HANDOFF-회원가입-전환-설계.md §4.1.
 */
import type { AuthContext, SaveIntentDecl } from "./intent";

export type AuthRequest = { ctx: AuthContext; decl?: SaveIntentDecl };
const EVT = "mt:auth-required";

export function requireAuthEvent(req: AuthRequest): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthRequest>(EVT, { detail: req }));
}

export function onAuthRequired(handler: (req: AuthRequest) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const fn = (e: Event) => handler((e as CustomEvent<AuthRequest>).detail);
  window.addEventListener(EVT, fn as EventListener);
  return () => window.removeEventListener(EVT, fn as EventListener);
}
