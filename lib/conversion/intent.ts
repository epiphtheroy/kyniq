/**
 * Conversion intent model — the small, serializable description of "what the user
 * was trying to do" when we asked them to sign in, plus the contextual copy that
 * frames the AuthSheet. See HANDOFF-회원가입-전환-설계.md §3.3/§6.
 *
 * Two forms travel together:
 *  - `AuthContext` picks the headline/subcopy (what we're selling in this moment).
 *  - `SaveIntentDecl` is the declarative action to REPLAY after sign-in. It must be
 *    JSON-serialisable because it rides through an OAuth/magic-link round-trip in a
 *    `mt_intent` URL param (or sessionStorage for One-Tap), then executes on the
 *    landing page once the new session is live.
 */

export type IntentVerb = "seen" | "watchlist" | "rate" | "save" | "follow";

export interface SaveIntentDecl {
  v: IntentVerb;
  slug?: string; // film slug (seen/watchlist/rate); entity slug (save/follow)
  rating?: number; // for rate (0.5..5)
  kind?: string; // entity kind for save/follow (film|director|figure|trope|…)
}

export type AuthContext =
  | { kind: "save"; verb: IntentVerb }
  | { kind: "claim"; surface: "board" | "lens" | "pool" | "coverage" | "services" | "room" }
  | { kind: "newsletter" }
  | { kind: "generic" };

export interface AuthIntent {
  ctx: AuthContext;
  /** declarative form — replayed across a redirect/reload */
  decl?: SaveIntentDecl;
  /** same-page closure (rarely used now that replay is reload-based) */
  replay?: () => void;
}

/** Stable key for copy lookup + analytics event naming. */
export function intentKey(ctx: AuthContext): string {
  switch (ctx.kind) {
    case "save": return `save:${ctx.verb}`;
    case "claim": return `claim:${ctx.surface}`;
    case "newsletter": return "newsletter";
    default: return "generic";
  }
}

export const encodeIntent = (d: SaveIntentDecl): string => {
  try { return encodeURIComponent(JSON.stringify(d)); } catch { return ""; }
};
export const decodeIntent = (s: string | null | undefined): SaveIntentDecl | null => {
  if (!s) return null;
  try {
    const o = JSON.parse(decodeURIComponent(s)) as SaveIntentDecl;
    return o && typeof o.v === "string" ? o : null;
  } catch { return null; }
};

/** Contextual copy for the AuthSheet. Voice: calm, second-person, concrete —
 *  says what becomes YOURS, never "sign up for our service". */
export const AUTH_COPY: Record<string, { h: string; sub: string }> = {
  "save:seen": { h: "Keep it on your shelf", sub: "One tap logs it — and your map starts filling in." },
  "save:watchlist": { h: "Save it for later", sub: "Your watchlist follows you everywhere on Metatake." },
  "save:rate": { h: "Remember what you thought", sub: "Rate it once; it tunes every recommendation after." },
  "save:follow": { h: "Follow along", sub: "New readings come to you as they're written." },
  "save:save": { h: "Keep this reading", sub: "Your shelf holds any film, figure, or misreading you pin." },
  "claim:board": { h: "See your canon light up", sub: "Sign in and this board marks every film you've seen." },
  "claim:lens": { h: "Turn the whole site into your cinema", sub: "Log one film and every page re-centers on what you've watched." },
  "claim:pool": { h: "Build a pool that's actually yours", sub: "Films scored for your taste, minus what you've already seen." },
  "claim:coverage": { h: "Chart what you've covered", sub: "Your canons, blind spots, and directors — as one map." },
  "claim:services": { h: "Only see what you can play tonight", sub: "Tell us your subscriptions once — we'll remember them everywhere." },
  "claim:room": { h: "Open your cinema portfolio", sub: "Coverage, blind spots, taste — your watching life as one map." },
  "newsletter": { h: "The Metatake Read", sub: "One film read closely, in your inbox — free, unsubscribe anytime." },
  "generic": { h: "Make Metatake yours", sub: "Save films, follow directors, and track what you've seen." },
};

export function copyFor(ctx: AuthContext) {
  return AUTH_COPY[intentKey(ctx)] ?? AUTH_COPY.generic;
}

/** Success-toast line after a replay completes (verb → line). */
export const REPLAY_TOAST: Record<IntentVerb, string> = {
  seen: "Logged — your map just started.",
  watchlist: "Saved to your watchlist.",
  rate: "Rated — that tunes your recommendations.",
  save: "Kept on your shelf.",
  follow: "Following — new readings will come to you.",
};
