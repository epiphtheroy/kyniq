/**
 * lineageBodies — map a lineage list slug to its awarding body / institution, with a small emblem.
 * Lineage list slugs encode the body as a prefix (e.g. "oscar-best-picture", "lafca-best-picture"),
 * but the stored label is often just the sub-award ("Best Picture"), so on its own you can't tell
 * it's the Academy. This derives a body name + emblem from the slug and strips redundant prefixes
 * from the label. Emojis (not official logos) — safe to ship, swap for real marks later.
 */

export type Body = { name: string; emblem: string; strip?: string[] };

// Awarding bodies (festivals, academies, guilds, critics' groups). Longest/most-specific first.
const BODIES: Array<[string, Body]> = [
  ["oscar-", { name: "Academy Award", emblem: "🏆" }],
  ["academy-", { name: "Academy Award", emblem: "🏆" }],
  ["golden-globe", { name: "Golden Globe", emblem: "🌐", strip: ["Golden Globe "] }],
  ["bafta", { name: "BAFTA", emblem: "🎭", strip: ["BAFTA "] }],
  ["cannes", { name: "Cannes", emblem: "🌴", strip: ["Cannes "] }],
  ["venice", { name: "Venice", emblem: "🦁", strip: ["Venice "] }],
  ["berlinale", { name: "Berlinale", emblem: "🐻", strip: ["Berlinale ", "Berlin "] }],
  ["berlin-", { name: "Berlinale", emblem: "🐻", strip: ["Berlin "] }],
  ["cesar", { name: "César", emblem: "🏆", strip: ["César "] }],
  ["goya", { name: "Goya", emblem: "🏆", strip: ["Goya "] }],
  ["dga-", { name: "DGA", emblem: "🎬", strip: ["Directors Guild "] }],
  ["wga-", { name: "WGA", emblem: "✍️", strip: ["WGA: ", "WGA "] }],
  ["sag-", { name: "SAG", emblem: "🎬", strip: ["SAG ", "Screen Actors Guild "] }],
  ["pga-", { name: "PGA", emblem: "🎬", strip: ["Producers Guild "] }],
  ["lafca", { name: "LA Film Critics", emblem: "🎬", strip: ["Los Angeles Film Critics Association "] }],
  ["nyfcc", { name: "NY Film Critics", emblem: "🎬", strip: ["New York Film Critics Circle ", "New York Film Critics "] }],
  ["nsfc", { name: "Nat'l Society of Film Critics", emblem: "🎬", strip: ["National Society of Film Critics "] }],
  ["nbr", { name: "Nat'l Board of Review", emblem: "🎬", strip: ["National Board of Review "] }],
  ["spirit", { name: "Indie Spirit", emblem: "🎬", strip: ["Independent Spirit ", "Spirit "] }],
];

// Canons / lists (magazines, institutions). Substring match.
const CANON_EMBLEM: Array<[string, string]> = [
  ["sight-and-sound", "📖"],
  ["tspdt", "📊"],
  ["afi", "🎞️"],
  ["time", "📰"],
  ["national-film-registry", "🏛️"],
  ["criterion", "◆"],
  ["bfi", "📖"],
  ["imdb", "⭐"],
  ["wga", "✍️"],
  ["edgar", "🔎"],
];

export function awardBody(slug: string): Body | null {
  const s = slug.toLowerCase();
  for (const [pre, b] of BODIES) if (s.startsWith(pre) || s.includes(pre)) return b;
  return null;
}

export function awardLabel(label: string, slug: string): string {
  const b = awardBody(slug);
  if (b?.strip) for (const p of b.strip) if (label.startsWith(p)) return label.slice(p.length);
  return label;
}

export function canonEmblem(slug: string): string {
  const s = slug.toLowerCase();
  for (const [key, e] of CANON_EMBLEM) if (s.includes(key)) return e;
  return "📋";
}

/** ISO 3166-1 alpha-2 (or "eu") → flag emoji. "" if unknown. */
export function codeToFlag(cc: string | null | undefined): string {
  if (!cc || cc.length !== 2) return "";
  const c = cc.toLowerCase();
  const A = 0x1f1e6;
  return String.fromCodePoint(A + (c.charCodeAt(0) - 97), A + (c.charCodeAt(1) - 97));
}
