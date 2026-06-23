// Single source of truth for the 14 Strong-Misreading frameworks (+ INVITATION lead).
// Replaces the old per-file `register` colour maps. Keys match takes.framework exactly.

export type FamilyKey = "interpretation" | "form" | "mind" | "parallel" | "title";

export type Framework = {
  key: string;     // exact value stored in takes.framework
  slug: string;    // URL slug for /strong-misreadings/[slug]
  label: string;   // display label
  short: string;   // one-line gloss
  family: FamilyKey;
  color: string;
};

export const FAMILIES: { key: FamilyKey; label: string }[] = [
  { key: "interpretation", label: "Reading from within" },
  { key: "form", label: "Form, making & context" },
  { key: "mind", label: "Mind, ethics & politics" },
  { key: "parallel", label: "Existential parallels" },
  { key: "title", label: "Title & invitation" },
];

export const FRAMEWORKS: Framework[] = [
  { key: "PHENOMENON→NOUMENON", slug: "phenomenon-noumenon", label: "Phenomenon → Noumenon", short: "From a surface detail to the thing-in-itself it betrays.", family: "interpretation", color: "#3E6DB5" },
  { key: "NOUMENON", slug: "noumenon", label: "Noumenon", short: "The film's hidden ontology — what it secretly takes to be real.", family: "interpretation", color: "#5B4DAF" },
  { key: "SIGNIFIER→SIGNIFIED", slug: "signifier-signified", label: "Signifier → Signified", short: "A sign read for the meaning it carries.", family: "interpretation", color: "#2E86C1" },
  { key: "ENIGMA", slug: "enigma", label: "Enigma", short: "The detail that refuses to resolve, read as a clue.", family: "interpretation", color: "#5C6BC0" },
  { key: "PROCESS", slug: "process", label: "Process", short: "How it was made, read as meaning.", family: "form", color: "#2E8B7A" },
  { key: "LOCATION", slug: "location", label: "Location", short: "A real place, and what shooting there does.", family: "form", color: "#2E7D5B" },
  { key: "CONTEXT", slug: "context", label: "Context", short: "The production environment that shaped it.", family: "form", color: "#4E8C3F" },
  { key: "METACRITIC", slug: "metacritic", label: "Metacritic", short: "Its reception, and the argument it became.", family: "form", color: "#159A8A" },
  { key: "PSYCHOANALYTIC", slug: "psychoanalytic", label: "Psychoanalytic", short: "Desire, repression and the film's unconscious.", family: "mind", color: "#A8434F" },
  { key: "ETHICAL-PHILOSOPHICAL", slug: "ethical-philosophical", label: "Ethical–Philosophical", short: "The moral or philosophical wager it stakes.", family: "mind", color: "#7E57C2" },
  { key: "ETHICO-POLITICAL", slug: "ethico-political", label: "Ethico-Political", short: "The political stake it exposes.", family: "mind", color: "#C0392B" },
  { key: "PERSONA-PARALLEL", slug: "persona-parallel", label: "Persona Parallel", short: "A character set beside one real person.", family: "parallel", color: "#A9743B" },
  { key: "JUXTAPOSITION", slug: "juxtaposition", label: "Juxtaposition", short: "The film set beside real lives it never names.", family: "parallel", color: "#B8860B" },
  { key: "TITLE", slug: "title", label: "Title", short: "The title read for the nuance it hides.", family: "title", color: "#8A6D3B" },
  { key: "INVITATION", slug: "invitation", label: "Invitation", short: "A spoiler-free way in.", family: "title", color: "#444444" },
];

const BY_KEY = new Map(FRAMEWORKS.map((f) => [f.key, f]));
const BY_SLUG = new Map(FRAMEWORKS.map((f) => [f.slug, f]));
const FALLBACK: Framework = { key: "", slug: "", label: "Reading", short: "", family: "interpretation", color: "#8F8F8F" };

export function fw(key: string | null | undefined): Framework {
  return (key && BY_KEY.get(key)) || FALLBACK;
}
export function fwColor(key: string | null | undefined): string { return fw(key).color; }
export function fwLabel(key: string | null | undefined): string { return fw(key).label; }
export function fwBySlug(slug: string | null | undefined): Framework | null {
  return (slug && BY_SLUG.get(slug)) || null;
}
// The 14 browsable Strong-Misreading frameworks (INVITATION is the spoiler-free lead, not a reading).
export const BROWSABLE: Framework[] = FRAMEWORKS.filter((f) => f.key !== "INVITATION");

// Order index for sorting a film's misreadings by family then framework.
const ORDER = new Map(FRAMEWORKS.map((f, i) => [f.key, i]));
export function fwOrder(key: string | null | undefined): number {
  return (key && ORDER.get(key)) ?? 999;
}
