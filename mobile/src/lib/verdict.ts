// Post-watch verdict — the /room vocabulary, same formula (lib/room/format.ts):
//   gap = rating×20 − prestige (canon Standing, NOT TakeScore — §5.0)
//   Find ≥ +12 · Letdown ≤ −9 · else Aligned
// Colors follow the /room contract: Letdown uses the risk token, never brand red.
import { brand } from "../theme";
import type { DictKey } from "../i18n";

export type Verdict = "find" | "aligned" | "letdown";

export function verdictOf(rating: number | null | undefined, prestige: number | null | undefined): Verdict | null {
  if (rating == null || prestige == null) return null;
  const gap = rating * 20 - prestige;
  if (gap >= 12) return "find";
  if (gap <= -9) return "letdown";
  return "aligned";
}

export function verdictColor(v: Verdict): string {
  if (v === "find") return brand.teal;
  if (v === "letdown") return brand.tsRisk;
  return "#8A8F98";
}

export function verdictKey(v: Verdict): DictKey {
  return v === "find" ? "verdict.find" : v === "letdown" ? "verdict.letdown" : "verdict.aligned";
}

// Watchlist commitment decay — the Slate model (Fresh <30d / Aging 30–90d / Stale >90d).
export type Age = "fresh" | "aging" | "stale";

export function ageOf(addedAt: string | null | undefined): Age | null {
  if (!addedAt) return null;
  const days = (Date.now() - new Date(addedAt).getTime()) / 86400000;
  if (!Number.isFinite(days) || days < 0) return null;
  if (days < 30) return "fresh";
  if (days <= 90) return "aging";
  return "stale";
}

export function ageColor(a: Age): string {
  if (a === "stale") return brand.tsRisk; // --risk lineage, never the brand red
  if (a === "aging") return "#8A8F98";
  return brand.teal;
}

export function ageKey(a: Age): DictKey {
  return a === "stale" ? "age.stale" : a === "aging" ? "age.aging" : "age.fresh";
}
