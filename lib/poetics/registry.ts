/**
 * Poetics — the critical-essay corner. IA source of truth (mirrors lib/docs/registry.ts).
 * Signed essays by Wonwoo Yoon on the open questions of building a critical map of
 * cinema. Hub = app/poetics/page.tsx; each essay = /poetics/[slug].
 * Canonical plan: HANDOFF-포에틱스-비평에세이.md.
 */

export type PoeCategory = { key: string; label: string; blurb: string };
export type PoeEssay = { slug: string; nav: string; title: string; desc: string; category: string };

export const POE_CATEGORIES: PoeCategory[] = [
  { key: "value", label: "On value", blurb: "What a masterpiece is, whether value can be scored, and the philosophy behind each sub-metric." },
  { key: "canon", label: "On the canon", blurb: "What to watch, who earns the word 'essential', and how a list earns its place." },
  { key: "reading", label: "On reading", blurb: "Why the figure is the unit, how a trope forms, fan theories, and the fourteen frameworks." },
  { key: "theory", label: "On theory", blurb: "Filing a century of film theory, concepts as doors, and criticism as a database." },
  { key: "worldmap", label: "On the world map", blurb: "Where cinema actually lives, the auteur in 2026, and the politics of the national canon." },
  { key: "industry", label: "On industry & attention", blurb: "How reputations are remade, what a film's circumstances do to a reading, and the critic vs. the aggregator." },
  { key: "machines", label: "On machines & criticism", blurb: "Can a machine venture a reading, the slop question, and criticism as infrastructure." },
];

export const POE_ESSAYS: PoeEssay[] = [
  // On value
  { slug: "what-is-a-masterpiece", category: "value", nav: "What is a masterpiece?", title: "What is a masterpiece, operationally?", desc: "The highest value I have ever measured belongs to a film I rated three and a half stars. Why we refused to define the word." },
  { slug: "can-value-be-scored", category: "value", nav: "Can value be scored?", title: "Can the value of a film be scored at all?", desc: "A defence of measurement scepticism, and the dashboard we built instead of a single blended number." },
  { slug: "the-anatomy-of-disappointment", category: "value", nav: "Anatomy of disappointment", title: "An anatomy of disappointment", desc: "We split the ways a film fails into four — and kept 'divisive' carefully apart from 'bankrupt.'" },
  { slug: "difficulty-is-a-price", category: "value", nav: "Difficulty is a price", title: "Difficulty is a price, not a virtue", desc: "Why a hard film earns nothing for being hard, and how we priced difficulty as a cost rather than a merit." },
  { slug: "the-arithmetic-of-a-lifetime", category: "value", nav: "A lifetime of evenings", title: "The arithmetic of a lifetime", desc: "You will see fewer films than this index holds. What mortality does to the word 'essential'." },
  { slug: "ambition-is-not-achievement", category: "value", nav: "Ambition ≠ achievement", title: "Ambition is not achievement", desc: "Scale and spectacle earn nothing on their own. What happens to a scale that rewards trying." },
  { slug: "what-a-36-means", category: "value", nav: "What a 36 means", title: "What a 36 means", desc: "Reading a distribution where the middle four-fifths sit between 8 and 57 — and why a generous scale measures nothing." },
  { slug: "the-rewatch-test", category: "value", nav: "The rewatch test", title: "The rewatch test", desc: "The thrill in the theatre and what survives five years later are different assets. Why durability got its own axis." },

  // On the canon
  { slug: "what-should-you-watch", category: "canon", nav: "What should you watch?", title: "What should you watch? An honest decomposition", desc: "Decomposing the oldest question into two signals — the lists' authority and measured value — and why value now leads." },
  { slug: "the-word-essential", category: "canon", nav: "The word 'essential'", title: "Who deserves the word 'essential'?", desc: "Fewer than a thousand films out of nearly seven thousand. Why an award alone can't earn the word." },
  { slug: "when-the-canon-scores-low", category: "canon", nav: "When the canon scores low", title: "When the canon scores low", desc: "A canonical film with a low score is described, not renamed. Letting two numbers disagree on one page." },
  { slug: "whole-lists-or-nothing", category: "canon", nav: "Whole lists or nothing", title: "Whole lists or nothing", desc: "Complete enumeration as a principle — every Palme d'Or or none — and the honesty of 'N of M matched.'" },
  { slug: "writing-for-one-reader", category: "canon", nav: "Writing for one reader", title: "Writing for one reader", desc: "We addressed every catalogue note to a real person. What a single reader forces you to stop pretending." },
  { slug: "the-gravity-of-cannes", category: "canon", nav: "The gravity of Cannes", title: "The gravity of Cannes", desc: "Prestige tilts toward Cannes and Hollywood. The discovery axis is the deliberate counterweight." },
  { slug: "the-shape-of-a-blind-spot", category: "canon", nav: "The shape of a blind spot", title: "The shape of a blind spot", desc: "My own viewing log, read as evidence: every personal canon is a record of what its owner already likes." },

  // On reading
  { slug: "why-the-feather-not-the-plot", category: "reading", nav: "The feather, not the plot", title: "Why the feather, not the plot", desc: "The unit of analysis is the figure, not the summary. Six to eight per film, and the dead end of plot-recap criticism." },
  { slug: "the-cruel-stepmother-problem", category: "reading", nav: "The cruel stepmother", title: "The cruel stepmother problem", desc: "Not frequency but strikingness. Rain isn't a figure; rain that won't stop might be. The agony of the line." },
  { slug: "reading-is-always-misreading", category: "reading", nav: "Reading is misreading", title: "Reading is always misreading", desc: "Why we wrote Bloom into the name — and made 'Strong Misreadings' a permanent waiver of the claim to be right." },
  { slug: "in-defense-of-fan-theories", category: "reading", nav: "In defence of fan theories", title: "In defence of fan theories", desc: "Fan theories as folk hermeneutics — neither dismissed nor worshipped, but sourced, weighed and ruled on." },
  { slug: "when-a-reading-repeats", category: "reading", nav: "When a reading repeats", title: "When a reading repeats, it stops being yours", desc: "The moment a bold reading recurs across films it loses its singularity and becomes a pattern. The line between discovery and code." },
  { slug: "the-lifecycle-of-a-cliche", category: "reading", nav: "The life of a cliché", title: "Every cliché was once a discovery", desc: "A maturity arc from Noble to Cliché, why we built it, and how not to sneer at a worn idea." },
  { slug: "three-readings-per-object", category: "reading", nav: "Three per object", title: "Three readings per object, never one", desc: "Every figure read under three different frameworks. The productivity of disagreement, and the tyranny of a single reading." },
  { slug: "why-fourteen", category: "reading", nav: "Why fourteen?", title: "Why fourteen frameworks (and not twelve, and not truth)", desc: "Owning the arbitrariness of a taxonomy — fourteen is a pragmatic cut, not a discovery, and here's what it misses." },

  // On theory
  { slug: "filing-a-century-of-theory", category: "theory", nav: "Filing theory", title: "Filing a century of film theory", desc: "Collapsing thousands of concepts to a canonical core — the violence and the use of merging." },
  { slug: "concepts-are-doors", category: "theory", nav: "Concepts are doors", title: "A concept is a door, not a cage", desc: "Making the ideas inside a reading into links rather than citations — a passage, not a footnote." },
  { slug: "the-theorist-as-interlocutor", category: "theory", nav: "Theorist as interlocutor", title: "The theorist as interlocutor", desc: "Treating a theorist as a sparring partner, not decorative citation — and the discipline of anchored readings." },
  { slug: "distance-as-meaning", category: "theory", nav: "Distance as meaning", title: "Distance as meaning", desc: "Arguing that an embedding is a critical instrument — distance, not tags — and what geometry gives criticism and takes from it." },
  { slug: "database-criticism", category: "theory", nav: "Database criticism", title: "Criticism as a database (and what that does to it)", desc: "After the age of the standalone review: when relation is the content, a new genre becomes possible — and so does its cheapening." },

  // On the world map
  { slug: "where-cinema-lives", category: "worldmap", nav: "Where cinema lives", title: "Where cinema lives, measured", desc: "The measured distribution across seventy countries — and the honest admission that the distribution is our own collecting bias." },
  { slug: "the-auteur-in-2026", category: "worldmap", nav: "The auteur in 2026", title: "Is the auteur still a useful idea?", desc: "Keeping auteur lines for practical reasons while distrusting the theory — and damping a master so he lifts a floor without eclipsing a film." },
  { slug: "a-nations-hundred-films", category: "worldmap", nav: "A nation's hundred", title: "A nation's hundred films", desc: "The politics of the national canon — who speaks for a country — and the cost of relabelling a list honestly." },
  { slug: "how-to-read-a-filmography", category: "worldmap", nav: "Reading a filmography", title: "How to read a filmography", desc: "A career is a shape, not a ranked list — debuts, pivots, constants, and what a narrow band of ratings means." },
  { slug: "the-frontier-festival", category: "worldmap", nav: "The frontier festival", title: "The frontier festival problem", desc: "A film found at a fiercely selective frontier festival shouldn't be penalised for carrying no Western hardware. Rewarding rarity of recognition." },
  { slug: "the-location-cannot-lie", category: "worldmap", nav: "The location cannot lie", title: "The location cannot lie", desc: "Plots are invented; places leak the truth anyway. On shooting locations as the documentary layer inside fiction." },

  // On industry & attention
  { slug: "how-reputations-are-remade", category: "industry", nav: "Reputations remade", title: "Reputations are remade, not made", desc: "What a reception archive shows about how a film's standing gets rewritten — the afterlife as a lens." },
  { slug: "attention-is-not-importance", category: "industry", nav: "Attention ≠ importance", title: "Attention is not importance", desc: "Separating a search spike from significance — why the live desk states a verdict, not a rank." },
  { slug: "the-film-outside-the-frame", category: "industry", nav: "Outside the frame", title: "The film outside the frame", desc: "Prison sentences, scandals, exile: when a film's circumstances force their way into the reading." },
  { slug: "availability-is-destiny", category: "industry", nav: "Availability is destiny", title: "Availability is destiny", desc: "When streaming availability governs access to the canon — is a canon you cannot watch still a canon?" },
  { slug: "the-critic-and-the-aggregator", category: "industry", nav: "Critic vs. aggregator", title: "The critic and the aggregator", desc: "Where criticism stands in the age of the aggregate score — the industrial meaning of a number that refuses to converge." },

  // On machines & criticism
  { slug: "can-a-machine-venture-a-reading", category: "machines", nav: "Can a machine read?", title: "Can a machine venture a reading?", desc: "Not summary but a venturing interpretation — what is observable when a model reaches into imagination and feeling." },
  { slug: "the-slop-question", category: "machines", nav: "The slop question", title: "The slop question", desc: "An exact anatomy of the contamination worry — the problem is indiscriminate mass-production, not the tool — and what a kill-gate means critically." },
  { slug: "what-machines-cannot-decide", category: "machines", nav: "What machines can't decide", title: "What machines cannot decide", desc: "The place that stays human — what stands on the site is not the machine's call. Where responsibility sits." },
  { slug: "criticism-as-infrastructure", category: "machines", nav: "Criticism as infrastructure", title: "Criticism as infrastructure", desc: "Building criticism as accumulating infrastructure rather than one-off text — what that makes possible, and the single glint it kills." },
];

export function poeHref(slug: string): string {
  return `/poetics/${slug}`;
}
export function poeBySlug(slug: string): PoeEssay | undefined {
  return POE_ESSAYS.find((e) => e.slug === slug);
}
export function poeCategoryBySlug(slug: string): PoeCategory | undefined {
  const e = poeBySlug(slug);
  return e ? POE_CATEGORIES.find((c) => c.key === e.category) : undefined;
}
export function poeEssaysInCategory(key: string): PoeEssay[] {
  return POE_ESSAYS.filter((e) => e.category === key);
}
export function poeCategoryEntryHref(key: string): string {
  const first = POE_ESSAYS.find((e) => e.category === key);
  return first ? poeHref(first.slug) : "/poetics";
}
export function poeNeighbors(slug: string): { prev?: PoeEssay; next?: PoeEssay } {
  const i = POE_ESSAYS.findIndex((e) => e.slug === slug);
  if (i === -1) return {};
  return { prev: i > 0 ? POE_ESSAYS[i - 1] : undefined, next: i < POE_ESSAYS.length - 1 ? POE_ESSAYS[i + 1] : undefined };
}
