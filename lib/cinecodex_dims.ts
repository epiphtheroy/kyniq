/**
 * CineCodex 13 sub-dimensions — the single public registry.
 * Keys mirror cinecodex.scores columns; slugs are the /takescore/[dim] routes;
 * labels match the CodexExplorer UI. `question` is the search-shaped framing
 * each dimension page answers; `scale` is the 0→100 band summary from the
 * frozen production prompt (cinecodex-prod-v2).
 */
export type CodexDimGroup = "value" | "cost" | "risk";

export type CodexDim = {
  key: string; // cinecodex.scores column
  slug: string; // /takescore/[slug]
  label: string;
  group: CodexDimGroup;
  question: string;
  scale: string;
};

export const CODEX_DIMS: CodexDim[] = [
  { key: "cog", slug: "cognitive", label: "Cognitive", group: "value",
    question: "Which films actually change how you think?",
    scale: "0 nothing → 50 real ideas, conventionally delivered → 100 a lasting conceptual or perceptual shift" },
  { key: "aff", slug: "affective", label: "Affective", group: "value",
    question: "Which films leave a durable emotional imprint — not a momentary thrill?",
    scale: "0 forgettable → 50 a few lingering moments → 100 an indelible imprint" },
  { key: "form", slug: "formal", label: "Formal", group: "value",
    question: "Which films are formally achieved — disciplined authorial form, not spectacle?",
    scale: "0 invisible or incompetent → 50 distinct craft → 100 formally innovative, enlarges the medium" },
  { key: "moral", slug: "moral", label: "Moral", group: "value",
    question: "Which films stage a real moral or existential reckoning?",
    scale: "0 none → 50 sincere but safe → 100 profound ethical reckoning" },
  { key: "dur", slug: "durability", label: "Durability", group: "value",
    question: "Which films deepen on rewatch — and which evaporate?",
    scale: "0 evaporates → 50 holds up → 100 an inexhaustible lifetime object" },
  { key: "itx", slug: "intertextual", label: "Intertextual", group: "cost",
    question: "How much film history do you need before this film opens?",
    scale: "0 none → 100 encyclopedic, meta-cinematic" },
  { key: "fr", slug: "formal-radicalism", label: "Formal radicalism", group: "cost",
    question: "How far from mainstream film grammar does this film ask you to travel?",
    scale: "0 classical, accessible → 100 avant-garde, endurance-testing" },
  { key: "etx", slug: "extratextual", label: "Extratextual", group: "cost",
    question: "How much outside knowledge — history, politics, philosophy — does this film assume?",
    scale: "0 universal → 100 specialized field knowledge mandatory" },
  { key: "ctx", slug: "auteur-oeuvre", label: "Auteur oeuvre", group: "cost",
    question: "How much of the director's filmography must you know first?",
    scale: "0 standalone → 100 sequential mastery of the filmography required" },
  { key: "bank", slug: "hollowness", label: "Hollowness", group: "risk",
    question: "Which films are intellectually bankrupt — banal, or pretentious and empty?",
    scale: "0 sound and substantive → 100 insultingly hollow or incoherent" },
  { key: "insincere", slug: "insincerity", label: "Insincerity", group: "risk",
    question: "Where does style detach from substance — pastiche, loss of control?",
    scale: "0 fully intentional and integrated → 100 vulgar, derivative, incoherent" },
  { key: "coward", slug: "cowardice", label: "Cowardice", group: "risk",
    question: "Which films pander — commercial compromise, emotional exploitation?",
    scale: "0 bold and uncompromised → 100 cynical, manipulative, soulless" },
  { key: "polar", slug: "polarization", label: "Polarization", group: "risk",
    question: "Which films most sharply divide informed, engaged viewers?",
    scale: "0 near-consensus → 100 violently divisive" },
];

/**
 * Display-only TakeScore normalizer. U (Value − Risk) can be negative in the
 * raw data; for public display and schema we clamp at 0 and round. NEVER use
 * this in sorting, ranking, percentiles, histograms, brush filters, or any
 * /api data payload — those must operate on the raw signed value.
 */
export const displayTs = (u: number): number => Math.max(0, Math.round(u));

export const dimBySlug = new Map(CODEX_DIMS.map((d) => [d.slug, d]));
export const dimByKey = new Map(CODEX_DIMS.map((d) => [d.key, d]));
export const takescoreDimUrl = (slug: string) => `/takescore/${slug}`;
