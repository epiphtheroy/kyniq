/**
 * TakeScore Screener presets — one-click editorial screens. Each is nothing but
 * a set of the same URL filters a user could dial by hand (LLM-0, no content).
 * Rendered as chips under the hero search (HANDOFF-테이크스코어-스크리너.md §4-H).
 */
export type PresetQuery = {
  sort?: string;
  lam?: string;
  since?: string;
  to?: string;
  ts?: string;          // "lo-hi" TakeScore band
  dims?: string;        // "key:lo-hi,key2:lo-hi"
  maxVotes?: string;    // p_max_votes — the under-seen cut
};

export type Preset = { key: string; label: string; blurb: string; q: PresetQuery };

export const TAKESCORE_PRESETS: Preset[] = [
  { key: "peak", label: "Peak only", blurb: "The highest TakeScores in the catalog", q: { sort: "u", ts: "58-100" } },
  { key: "safe", label: "Safe bets", blurb: "Low risk, nothing hollow", q: { sort: "u", dims: "bank:0-22,coward:0-30" } },
  { key: "gems", label: "Hidden gems", blurb: "Great films almost no one has rated", q: { sort: "u", ts: "45-100", maxVotes: "40000" } },
  { key: "highwire", label: "High wire", blurb: "Formally radical, high value", q: { sort: "v", dims: "fr:65-100" } },
  { key: "century", label: "Fresh century", blurb: "Since 2000, best first", q: { since: "2000", sort: "u" } },
  { key: "durable", label: "Rewards rewatching", blurb: "Deepen every time you return", q: { sort: "u", dims: "dur:70-100" } },
];

/** Build a /takescore query string from a preset (drops empty keys). */
export function presetHref(p: Preset): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p.q)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `/takescore?${s}` : "/takescore";
}
