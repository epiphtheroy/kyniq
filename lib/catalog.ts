// Single source of truth for the Catalog layer: section + node-kind metadata, display
// labels (spelled out — "Object Archetype", never bare "Object"), URL segments, and helpers.
// Data comes from taxonomy_nodes (kind-discriminated) + figure_taxonomy (axis == node kind).

export type SectionKey = "objects" | "characters" | "locations" | "themes" | "theory";

export type Section = {
  key: SectionKey;
  seg: string;        // url under /catalog (browse page): /catalog/{seg}
  label: string;      // display, plural section noun
  blurb: string;
  icon: string;       // tabler icon name (used by our CSS/icon font)
  kinds: string[];    // node kinds aggregated into this section's counts
  primaryKind: string; // the "named archetype" kind used for featured cards
};

export const SECTIONS: Section[] = [
  { key: "objects", seg: "objects", label: "Objects", icon: "cube",
    blurb: "Props and things — what each object is, by type, function, and named archetype.",
    kinds: ["object", "object_type", "function"], primaryKind: "object" },
  { key: "characters", seg: "characters", label: "Characters", icon: "user",
    blurb: "People on screen — their identities, internal complexes, and named character archetypes.",
    kinds: ["char_identity", "char_complex", "char_archetype", "char_function"], primaryKind: "char_archetype" },
  { key: "locations", seg: "locations", label: "Locations", icon: "map-pin",
    blurb: "Places and settings — by realm, place type, and named place archetype.",
    kinds: ["location", "location_category", "location_group"], primaryKind: "location" },
  { key: "themes", seg: "themes", label: "Themes", icon: "affiliate",
    blurb: "What a work is about — the abstract subjects that recur across figures and films.",
    kinds: ["theme", "theme_cluster"], primaryKind: "theme" },
  { key: "theory", seg: "theory", label: "Theory", icon: "book",
    blurb: "The critical concepts and theorists the readings draw on (from the canon).",
    kinds: ["theory"], primaryKind: "theory" },
];

// node kind → { url segment, spelled-out display label, parent section, is-it-a-coarse-tier }
export type KindMeta = { kind: string; seg: string; label: string; section: SectionKey; tier: boolean };

export const KINDS: KindMeta[] = [
  { kind: "object",            seg: "object",         label: "Object Archetype",    section: "objects",    tier: false },
  { kind: "object_type",       seg: "object-type",    label: "Object Type",         section: "objects",    tier: true  },
  { kind: "function",          seg: "function",       label: "Primary Function",    section: "objects",    tier: true  },
  { kind: "location",          seg: "place",          label: "Place Archetype",     section: "locations",  tier: false },
  { kind: "location_category", seg: "place-category", label: "Place Category",      section: "locations",  tier: true  },
  { kind: "location_group",    seg: "place-type",     label: "Place Type",          section: "locations",  tier: true  },
  { kind: "char_identity",     seg: "identity",       label: "Identity",            section: "characters", tier: true  },
  { kind: "char_complex",      seg: "complex",        label: "Complex",             section: "characters", tier: true  },
  { kind: "char_archetype",    seg: "character",      label: "Character Archetype", section: "characters", tier: false },
  { kind: "char_function",     seg: "narrative-role", label: "Narrative Function",  section: "characters", tier: true  },
  { kind: "theme",             seg: "theme",          label: "Theme",               section: "themes",     tier: false },
  { kind: "theme_cluster",     seg: "theme-family",   label: "Theme Family",        section: "themes",     tier: true  },
  { kind: "theory",            seg: "theory",         label: "Concept",             section: "theory",     tier: false },
];

const BY_KIND = new Map(KINDS.map((k) => [k.kind, k]));
const BY_SEG = new Map(KINDS.map((k) => [k.seg, k]));
const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));
const SECTION_BY_SEG = new Map(SECTIONS.map((s) => [s.seg, s]));

export function kindMeta(kind: string | null | undefined): KindMeta | null {
  return (kind && BY_KIND.get(kind)) || null;
}
export function kindBySeg(seg: string | null | undefined): KindMeta | null {
  return (seg && BY_SEG.get(seg)) || null;
}
// Spelled-out display label for a node kind / figure_taxonomy axis. Falls back gracefully.
export function axisLabel(kind: string | null | undefined): string {
  return (kind && BY_KIND.get(kind)?.label) || (kind ? kind.replace(/_/g, " ") : "");
}
export function sectionByKey(key: string | null | undefined): Section | null {
  return (key && SECTION_BY_KEY.get(key as SectionKey)) || null;
}
export function sectionBySeg(seg: string | null | undefined): Section | null {
  return (seg && SECTION_BY_SEG.get(seg)) || null;
}
export function sectionForKind(kind: string | null | undefined): Section | null {
  const m = kindMeta(kind);
  return m ? sectionByKey(m.section) : null;
}

// Routes
export function catalogHref(): string { return "/catalog"; }
export function sectionHref(key: SectionKey): string { return `/catalog/${key}`; }
export function nodeHref(kind: string, slug: string): string {
  const m = kindMeta(kind);
  return m ? `/catalog/${m.seg}/${slug}` : `/catalog/${slug}`;
}

// Aggregate catalog_kind_counts() rows into per-section { nodes, figures }.
// nodes = sum of node_count over the section's archetype/tier kinds (named-archetype kind only,
// to avoid double counting tiers in the headline); figures = distinct via union is not available
// here, so we report the max axis figure_count in the section as a lower-bound headline.
export type KindCount = { kind: string; node_count: number; figure_count: number };
export function sectionCounts(rows: KindCount[]): Record<SectionKey, { nodes: number; figures: number }> {
  const by = new Map(rows.map((r) => [r.kind, r]));
  const out = {} as Record<SectionKey, { nodes: number; figures: number }>;
  for (const s of SECTIONS) {
    const primary = by.get(s.primaryKind);
    const nodes = primary?.node_count ?? 0;
    // headline figure coverage: the broadest axis in the section (tiers cover the most figures)
    const figures = Math.max(0, ...s.kinds.map((k) => by.get(k)?.figure_count ?? 0));
    out[s.key] = { nodes, figures };
  }
  return out;
}

export const SECTION_KEYS = SECTIONS.map((s) => s.key);
