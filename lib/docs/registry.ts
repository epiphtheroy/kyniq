/**
 * The Method Docs — information architecture (single source of truth).
 *
 * Drives the sidebar tree, the top category strip, the /methodology/[slug]
 * renderer's metadata, the prev/next pager, and the methodology child sitemap.
 * Document BODIES live separately in lib/docs/content/*.ts (markdown strings);
 * this file holds only the metadata + ordering.
 *
 * `overview` is the hub itself — it renders from app/methodology/page.tsx (which
 * keeps the six deep-link anchors #connections/#rankings/#locations/#index/#now/
 * #corrections that 40+ pages depend on) and its href is "/methodology", NOT
 * "/methodology/overview". Every other doc is a /methodology/[slug] page.
 *
 * ⚠️ `desc` is not just a standfirst: /llms.txt renders every DOCS row verbatim
 * (app/llms.txt/route.ts), so a desc that overstates a layer's provenance ships
 * as a machine-readable false claim. Keep each desc true to the layer's credit
 * label (A/B/C) as mapped in lib/docs/content/ai-disclosure.ts.
 *
 * Canonical plan: HANDOFF-방법론-독스.md (root). Disclosure tiers: §8 there.
 * Credit scheme: HANDOFF-AI집필크레딧-표기개편.md (root).
 */

export type DocCategory = {
  key: string;
  label: string;
  blurb: string;
};

export type DocMeta = {
  slug: string;
  nav: string; // short label for the sidebar
  title: string; // H1 + <title> lead
  desc: string; // standfirst + meta description
  category: string; // DocCategory.key
};

export const DOC_CATEGORIES: DocCategory[] = [
  { key: "start-here", label: "Start here", blurb: "What Metatake is, how a page is made, and where the line between AI and editor sits." },
  { key: "films", label: "The Films", blurb: "How films enter the corpus, why some get close readings, and why each one is in the index." },
  { key: "readings", label: "The Readings", blurb: "Figures, the fourteen frameworks, strong misreadings, tropes and the essay desks." },
  { key: "scores", label: "The Scores", blurb: "TakeScore's three axes and thirteen dimensions, and the lineage record's weights." },
  { key: "connections", label: "The Connections", blurb: "The embedding map, kinship, counterpoints, ranked numbers, the graph, search and sentences." },
  { key: "record", label: "The Record", blurb: "Locations, reception, credits, where to watch, where to start, the sources we monitor, and the TMDb spine." },
  { key: "your-cinema", label: "Your Cinema", blurb: "The personal layer — your films, your room, and how the whole site can re-centre on what you have seen." },
  { key: "live", label: "The Live Desk", blurb: "The hourly Now Playing letters, the morning Daily, and the ambient TV channel." },
  { key: "trust", label: "Trust", blurb: "Editorial responsibility, corrections, independence and AI disclosure." },
  { key: "open", label: "Open & Machine-Readable", blurb: "The open filming-locations dataset, the free API, the MCP server, and the licence that lets you reuse it all." },
];

export const DOCS: DocMeta[] = [
  // Start here
  { slug: "overview", category: "start-here", nav: "Overview", title: "Methodology", desc: "How a reading on Metatake actually gets made — the pipeline, what the AI does and doesn't do, and how to flag it when we get something wrong." },
  { slug: "how-a-page-is-made", category: "start-here", nav: "How a page is made", title: "How a page is made", desc: "The six stages every reading passes through — from breakdown to a human editor's sign-off — and the checks that kill a draft that fails." },
  { slug: "what-ai-does", category: "start-here", nav: "What AI does", title: "What AI does, and doesn't do", desc: "AI drafts and computes; a named editor directs the method and answers for the page. Where the line sits, and the credit every page carries because of it." },

  // The Films
  { slug: "film-selection", category: "films", nav: "How films are chosen", title: "How films are chosen", desc: "Not fame but three tests — reach, critical density, and how a film connects to the rest — decide what enters the corpus." },
  { slug: "tiers", category: "films", nav: "Close readings & catalog", title: "Close readings and catalog records", desc: "Why some films get a full close reading and others a catalog record, and how a film moves from one to the other on its own." },
  { slug: "why-a-film-is-in-the-index", category: "films", nav: "Why a film is indexed", title: "Why a film is in the index", desc: "Every film carries a short letter saying plainly why it earned its place — its verdict computed from TakeScore, its sentences assembled from plain filings by fixed rule, with no language model." },
  { slug: "corpus-growth", category: "films", nav: "How the corpus grows", title: "How the corpus grows", desc: "Complete enumeration of the record, new films from title to live pages, and the monthly additions — how the catalog expands without rewriting itself." },

  // The Readings
  { slug: "figures", category: "readings", nav: "Figures", title: "What we read: figures", desc: "The object, gesture, colour or silence a film keeps returning to — the unit of analysis, and the filter that decides which ones are worth reading." },
  { slug: "frameworks", category: "readings", nav: "The fourteen frameworks", title: "The fourteen frameworks", desc: "Every reading is drafted under one of fourteen interpretive frameworks. Here they all are, grouped by family." },
  { slug: "strong-misreadings", category: "readings", nav: "Strong misreadings", title: "What a strong misreading is", desc: "Not the one correct decoding but the boldest reading a film can sustain — where the idea comes from and why readings stay open." },
  { slug: "tropes", category: "readings", nav: "Tropes & maturity", title: "Tropes and the maturity arc", desc: "When a reading recurs across films it becomes a coded pattern — a trope — and every pattern sits somewhere on an arc from Noble to Cliché." },
  { slug: "essays", category: "readings", nav: "The desks", title: "The essay desks", desc: "Eight editorial desks commission long-form essays — but only where a film can sustain one, and only after an independent verifier tries to break the draft." },
  { slug: "theory-explorer", category: "readings", nav: "Concepts & theorists", title: "Concepts, theorists and traditions", desc: "The concepts, theorists and traditions the readings lean on — one searchable shelf of the scholarship behind the site." },

  // The Scores
  { slug: "takescore", category: "scores", nav: "TakeScore", title: "TakeScore: the three axes", desc: "A film's lasting value to a cinephile, weighed against its cost and its risk — not its popularity." },
  { slug: "takescore-dimensions", category: "scores", nav: "The thirteen dimensions", title: "The thirteen dimensions", desc: "The thirteen sub-scores behind Value, Cost and Risk, and the behavioural bands they're rated on." },
  { slug: "what-takescore-ignores", category: "scores", nav: "What it ignores", title: "What TakeScore ignores", desc: "Why IMDb, Rotten Tomatoes and the canon sit beside the score but never inside it — and why divergence is the point." },
  { slug: "reliability", category: "scores", nav: "Reliability", title: "Reliability and confidence", desc: "We don't claim determinism from a language model — we measure reliability, publish it, and flag the readings that need a second look." },
  { slug: "lineage", category: "scores", nav: "The lineage record", title: "The lineage record", desc: "A second, plainer kind of knowledge about each film: where it sits in cinema's public record of awards, canons and national honours." },
  { slug: "lineage-selection", category: "scores", nav: "How a list earns its place", title: "How a list earns its place", desc: "Not fame but authority you can check — the three tests a list must pass to count, and what we deliberately keep out." },
  { slug: "lineage-standing", category: "scores", nav: "Weights & decay", title: "Weights and decay", desc: "How a film's standing is computed from what it actually holds — weighted by authority, result and rank, and shown with its parts." },

  // The Connections
  { slug: "embedding-map", category: "connections", nav: "The embedding map", title: "The embedding map", desc: "The lines between films aren't hand-tagged categories — they're distances in a space built from what readings actually say." },
  { slug: "kinship", category: "connections", nav: "Kinship", title: "Kinship — how connections are computed", desc: "Every “films most connected” list is computed, not curated. Two signals, fused, with the evidence always shown." },
  { slug: "counterpoints", category: "connections", nav: "Counterpoints", title: "Counterpoints", desc: "The connection only a reading-level database can make: two films that stage the same trope and read it in opposite directions." },
  { slug: "rankings", category: "connections", nav: "The numbers on ranked lists", title: "The numbers on ranked lists", desc: "Every percentage and ranked position on the site, computed the same way from embeddings and never typed in by hand." },
  { slug: "network-graph", category: "connections", nav: "The Network graph", title: "Reading the Network graph", desc: "How to read the connection graph — its four views, what the edges mean, and how the galaxy is laid out." },
  { slug: "search", category: "connections", nav: "How search works", title: "How search works", desc: "One engine fuses text and meaning across twelve kinds of thing — and finds English readings from a Korean query." },
  { slug: "sentences", category: "connections", nav: "The sentence layer", title: "The sentence layer", desc: "Hundreds of thousands of factual sentences, composed by the Metatake method from real data — no language model, no randomness." },

  // The Record
  { slug: "locations", category: "record", nav: "Locations", title: "Locations: setting and filmed", desc: "Where a film was shot and where its story is set, kept apart — compiled, geolocated and labelled by precision, never scraped." },
  { slug: "reception", category: "record", nav: "Reception", title: "Reception and the afterlife", desc: "How a film's reputation was made and remade — built only from what publishers themselves make public, one citation per outlet." },
  { slug: "credits", category: "record", nav: "Credits", title: "Credits and collaborations", desc: "How the credit record is built and ranked — by a weighted rating that resists popularity, and verbalized by rule." },
  { slug: "where-to-watch", category: "record", nav: "Where to watch", title: "Where to watch: sources and freshness", desc: "How the availability matrix is built from TMDB and JustWatch, checked against free and physical sources, and dated." },
  { slug: "where-to-start", category: "record", nav: "Where to start", title: "Where to start, who's next", desc: "The director entry points and next-director picks are drafted by Metatake AI from the director's own filmography — every pick carries the exact reason it was chosen, not a score." },
  { slug: "sources-and-identity", category: "record", nav: "Sources & identity", title: "Sources and identity", desc: "TMDb identity is the spine that holds every layer to the same film — and the line between what's ours and what's borrowed." },
  { slug: "sources-we-monitor", category: "record", nav: "Sources we monitor", title: "The sources we monitor", desc: "The award bodies, canons, national lists, critics' outlets, watch-data sources and directors we actually track — named, with links." },

  // Your Cinema
  { slug: "my-room", category: "your-cinema", nav: "My Room", title: "My Room — your cinema operating system", desc: "Your private terminal: every film you have seen treated as a position, each screen a single-purpose instrument, and one rule — never blend the numbers." },
  { slug: "my-films", category: "your-cinema", nav: "The My Films lens", title: "The My Films lens", desc: "Turn on the lens and the whole site re-centres on the films you have actually seen — highlighted, or with everything else ghosted away." },
  { slug: "import", category: "your-cinema", nav: "Import your films", title: "Importing your films", desc: "Bring your viewing history in from Letterboxd, IMDb or a spreadsheet — the one step that lights up everything personal." },
  { slug: "save-and-share", category: "your-cinema", nav: "Save & share", title: "Saving and sharing", desc: "How saving to your shelf and sharing a page work — and why an account earns its keep before you rate a single film." },

  // The Live Desk
  { slug: "now-playing", category: "live", nav: "The live desk", title: "The live desk", desc: "When a film spikes in the world's attention, a letter written by Metatake AI within the hour and published unattended after a machine gate — anchored to the corpus, retrieved not remembered, reviewed by the editor after the fact." },
  { slug: "the-daily", category: "live", nav: "The Daily", title: "The Daily — Between Film and the World", desc: "Most mornings, five things that happened in the world and the films that already knew them — each reduced to a figure, anchored to a film, verified live before it ships." },
  { slug: "metatake-tv", category: "live", nav: "Metatake TV", title: "Metatake TV", desc: "A continuous, rule-made video channel you can steer or simply leave on — an ambient, screensaver way to keep cinema in the room." },

  // Trust
  { slug: "editorial-responsibility", category: "trust", nav: "Editorial responsibility", title: "Editorial responsibility", desc: "Who reads the drafts, signs them off, and answers for the page — and how that responsibility is recorded in the credit each page carries." },
  { slug: "corrections", category: "trust", nav: "Corrections", title: "Corrections", desc: "Facts get corrected; readings stay open. How to flag an error, and what we will and won't change." },
  { slug: "independence", category: "trust", nav: "Independence", title: "Independence", desc: "No reading is sponsored, and no one can pay to place, remove or change one. What that means in practice." },
  { slug: "ai-disclosure", category: "trust", nav: "AI disclosure", title: "AI disclosure", desc: "A layer-by-layer map of what Metatake AI drafts, what it computes, and what fixed rules assemble with no language model — and the credit each layer carries." },
  { slug: "collaborate", category: "trust", nav: "Working with us", title: "Working with Metatake", desc: "Who we would like to work with, what we are actually asking, and why it might be worth your while — an open door, not a pitch." },
  { slug: "bots-and-crawlers", category: "trust", nav: "Bots & crawlers", title: "Bots and crawlers", desc: "How our one identified crawler behaves, and how we treat the crawlers that visit us — citation welcome, wholesale scraping declined." },

  // Open & Machine-Readable
  { slug: "open-data", category: "open", nav: "Open data & licence", title: "Open data and reuse", desc: "The filming-locations dataset we published openly on Hugging Face and Zenodo, and the licence — CC BY for the facts, CC BY-NC for the writing — told plainly." },
  { slug: "api", category: "open", nav: "The API", title: "The API", desc: "A free, read-only, no-key web API so the criticism can be used inside a script, an agent or a Custom GPT — built for citation, not scraping." },
  { slug: "mcp", category: "open", nav: "Metatake in your AI", title: "Metatake in your AI", desc: "The MCP server that lets an AI assistant read Metatake live, mid-conversation, and answer with a link back — the open standard, set up in three steps." },
];

/** The hub renders from app/methodology/page.tsx; sub-docs from [slug]. */
export function docHref(slug: string): string {
  return slug === "overview" ? "/methodology" : `/methodology/${slug}`;
}

export function docBySlug(slug: string): DocMeta | undefined {
  return DOCS.find((d) => d.slug === slug);
}

export function categoryBySlug(slug: string): DocCategory | undefined {
  const d = docBySlug(slug);
  return d ? DOC_CATEGORIES.find((c) => c.key === d.category) : undefined;
}

export function docsInCategory(key: string): DocMeta[] {
  return DOCS.filter((d) => d.category === key);
}

/** First doc of a category — the target for its top-strip tab. */
export function categoryEntryHref(key: string): string {
  const first = DOCS.find((d) => d.category === key);
  return first ? docHref(first.slug) : "/methodology";
}

/** Prev/next within the flat DOCS order (skips the hub as a "prev" target sink). */
export function docNeighbors(slug: string): { prev?: DocMeta; next?: DocMeta } {
  const i = DOCS.findIndex((d) => d.slug === slug);
  if (i === -1) return {};
  return { prev: i > 0 ? DOCS[i - 1] : undefined, next: i < DOCS.length - 1 ? DOCS[i + 1] : undefined };
}
