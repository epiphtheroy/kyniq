/** My Room v3 — shared formatting + canonical vocabularies.
 *  Single source for num(), TMDB image bases, tierOf(), REASON_MAP, FACET_LABEL
 *  and the Find/Aligned/Letdown verdict math (spec §3 common rules; removes the
 *  4–8 per-workspace copies that existed in v2). Client-safe: no server imports. */

/* ── numbers ─────────────────────────────────────────────────────────── */

/** PostgREST numerics can arrive as strings — always coerce through num(). */
export const num = (x: unknown): number | null =>
  x == null ? null : typeof x === "number" ? x : Number.isNaN(Number(x)) ? null : Number(x);

/* ── TMDB poster bases ───────────────────────────────────────────────── */

export const TMDB = "https://image.tmdb.org/t/p/";
/** Row-height poster (44–46px wide slots). */
export const IMG = `${TMDB}w92`;
/** Card / strip poster. */
export const IMG185 = `${TMDB}w185`;
/** Hero poster. */
export const IMG342 = `${TMDB}w342`;

/* ── NAV tiers ───────────────────────────────────────────────────────── */

/** Tier ladder steps (mono labels are product vocabulary — never translate). */
export const TIER_STEPS = [
  { tier: "FORMING", at: 0 },
  { tier: "BUILDING", at: 45 },
  { tier: "ESTABLISHED", at: 70 },
  { tier: "APEX", at: 90 },
] as const;

/** null NAV renders the human word "Forming" (not the mono tier). */
export function tierOf(nav: number | null): string {
  if (nav == null) return "Forming";
  if (nav >= 90) return "APEX";
  if (nav >= 70) return "ESTABLISHED";
  if (nav >= 45) return "BUILDING";
  return "FORMING";
}

/* ── reason chips (canonical 6 codes) ────────────────────────────────── */

export type ReasonDef = {
  /** CSS class on .rsn (color token). */
  cls: string;
  /** Chip label. */
  label: string;
  /** Sentence fragment for the "A film that …" line in RecInsp. */
  fragment: string;
  /** Deep link — the taxonomy teaching itself (spec §3 common rules). null = no link. */
  href: string | null;
};

/** Render ONLY codes the server sent — an unknown code renders nothing (no fake reasons). */
export const REASON_MAP: Record<string, ReasonDef> = {
  safe: { cls: "safe", label: "Safe asset", fragment: "low letdown risk", href: null },
  reading: { cls: "reading", label: "Your lens", fragment: "close to how you read", href: "/room/signature" },
  canon: { cls: "canon", label: "Canon standing", fragment: "high standing in film history", href: "/room/performance" },
  gap: { cls: "gap", label: "Fills a gap", fragment: "opens a lineage you haven't entered", href: "/room/coverage" },
  frontier: { cls: "frontier", label: "Safe frontier", fragment: "unfamiliar but with a floor under it", href: "/room/screener?reason=frontier" },
  conquer: { cls: "conquer", label: "Conquest", fragment: "advances a lineage campaign", href: "/room/coverage" },
};

/** Server codes → chip defs, dropping unknown codes. */
export const chipsOf = (reasons: string[] | null | undefined): ReasonDef[] =>
  (reasons ?? []).map((c) => REASON_MAP[c]).filter(Boolean);

/** Natural-language "why" line. Empty array → "" (caller renders the honest empty copy). */
export function whySentence(reasons: string[] | null | undefined): string {
  const fr = chipsOf(reasons).map((c) => c.fragment);
  if (fr.length === 0) return "";
  const list = fr.length === 1 ? fr[0] : fr.length === 2 ? `${fr[0]} and ${fr[1]}` : `${fr.slice(0, -1).join(", ")}, and ${fr[fr.length - 1]}`;
  return `A film that ${list}.`;
}

/* ── coverage facets ─────────────────────────────────────────────────── */

export const FACET_LABEL: Record<string, string> = {
  canon: "Canon",
  award: "Award",
  festival: "Festival",
  national: "National",
  auteur: "Auteur",
  section: "Section",
};

/* ── verdict (my ★ vs Standing — the only sanctioned comparison) ─────── */

export const VERDICT_FIND = 12; // rating×20 − prestige ≥ +12 → Find
export const VERDICT_LETDOWN = -9; // ≤ −9 → Letdown

export type Verdict = { code: "find" | "aligned" | "letdown"; label: "Find" | "Aligned" | "Letdown"; gap: number };

/** gap = rating×20 − prestige. Returns null when either side is missing (no fake numbers). */
export function verdictOf(rating: unknown, prestige: unknown): Verdict | null {
  const rt = num(rating), p = num(prestige);
  if (rt == null || p == null) return null;
  const gap = Math.round(rt * 20 - p);
  if (gap >= VERDICT_FIND) return { code: "find", label: "Find", gap };
  if (gap <= VERDICT_LETDOWN) return { code: "letdown", label: "Letdown", gap };
  return { code: "aligned", label: "Aligned", gap };
}

/* ── shared RPC row types (client-safe; loaders live in lib/room/loadCollection.ts) ── */

/** me_collection row (20-column position row — Holdings is its full surface). */
export type CollRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  rating: number | string | null; v: number | string | null; c: number | string | null; r: number | string | null; u: number | string | null;
  prestige: number | string | null; discovery: number | string | null; conf: number | string | null; tier: string | null;
  imdb: number | string | null; rt: number | string | null; meta: number | string | null; votes: number | string | null;
  added_at: string | null;
  facets: string[] | null;
};

/** me_recommend_wwi row (all 5 sub-scores are real payload — render, don't drop). */
export type WwiRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | string | null; r: number | string | null; ts: number | string | null;
  prestige: number | string | null; conf: number | string | null; tier: string | null;
  sim: number | string | null; u_util: number | string | null; t_taste: number | string | null;
  s_standing: number | string | null; wwi: number | string | null; disc: number | string | null;
  reasons: string[] | null; avail: { state: string; provider?: string } | null;
  delta: number | string | null; in_watchlist: boolean | null;
};

/** me_nav_history row. */
export type NavHistRow = { day: string; nav: number | string | null; n_watched: number | string | null };
