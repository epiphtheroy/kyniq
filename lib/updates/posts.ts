// lib/updates/posts.ts
// Metatake Updates — the public company-news thread at /updates.
// Append-only: prepend new posts at the TOP (newest first).
// Body grammar: plain sentences + [text](href) links ONLY (no other markdown,
// no HTML, no double quotes inside — use straight apostrophes).
//
// FIRST PRINCIPLE (owner call 2026-07-15): we announce features, data, policy,
// and index status — never the VOLUME of prose written (reading/appraisal/essay
// counts). Data counts (locations, honors, film/director totals, GSC numbers,
// DOIs) are fine — they are verifiable trust signals. See HANDOFF-업데이트피드.md §6.

export type UpdateCategory =
  | "feature" | "films" | "data" | "api" | "policy" | "index" | "milestone";

export const CATEGORY_LABEL: Record<UpdateCategory, string> = {
  feature: "Feature",
  films: "Films",
  data: "Data",
  api: "API · MCP",
  policy: "Policy",
  index: "Search index",
  milestone: "Milestone",
};

export type UpdatePost = {
  /** permanent anchor: "YYYY-MM-DD-short-slug". NEVER change after publish. */
  id: string;
  /** ship date, KST, YYYY-MM-DD */
  date: string;
  cat: UpdateCategory;
  /** short factual headline, sentence case */
  title: string;
  /** 1–4 sentences, one paragraph. [text](href) links only. */
  body: string;
};

export const UPDATES: UpdatePost[] = [
  {
    id: "2026-07-18-credit-intent",
    date: "2026-07-18",
    cat: "policy",
    title: "Written by AI, to a framework a person answers for",
    body: "We have now carried one idea through every credit line on Metatake: the criticism here is written by Metatake AI, working to a framework — the rubric, the reading lenses, the reliability rules — that editor [Wonwoo Yoon](/editor) designed, directs, and answers for. Rather than hide that, each surface names what actually made it — an AI-drafted reading says so, a page a rule assembled with no language model says that instead, and a filming-location record says it was researched and checked against independent sources before it shipped. The whole layer-by-layer map is at [How we use AI](/methodology/ai-disclosure); it is meant as a credit roll, not a disclaimer, so you can see how the model answered inside a method a named person built, and judge the answer for yourself.",
  },
  {
    id: "2026-07-17-ai-credits",
    date: "2026-07-17",
    cat: "policy",
    title: "Every page now credits how it was written",
    body: "Pages now carry an explicit credit for how they were made. Readings say they are written by Metatake AI, to a method designed and directed by editor Wonwoo Yoon, who answers for what publishes. Pages assembled by rule rather than by a language model say that instead, because stamping them as AI-written would be its own inaccuracy — the layer-by-layer map is at [How we use AI](/methodology/ai-disclosure). Correcting the record on four things we had described wrongly, the first of them serious. Several pages said a human editor read and signed off on every reading before it published. That was not true and it is now gone from the site: a reading is written by Metatake AI and publishes as written. What is true, and what those pages should have said, is that the gates on this site sit on the facts rather than on the prose — a filming-location pin ships only when independent sources agree, a desk essay clears a fact-and-attribution check, reception is assembled from dated sources with no model writing a line — while an interpretation is offered as an argument you can reject, with corrections public and any reading retractable at any time. Also corrected: [Poetics](/poetics) essays are drafted by Metatake AI from the editor's own viewing log and signed off by him, not written by hand; the director [where-to-start and who-is-next](/methodology/where-to-start) reasons are drafted by a model, not curated by hand as that page claimed; and our API and MCP listings described the criticism as human-curated, which it is not.",
  },
  {
    id: "2026-07-15-updates-launch",
    date: "2026-07-15",
    cat: "milestone",
    title: "This page launches: Metatake now keeps its news in public",
    body: "Updates is the running record of what changes on Metatake — features, data releases, API and MCP work, policy decisions, search-index status, films added — one dated entry at a time, newest first. Follow along by [RSS](/updates/feed.xml).",
  },
  {
    id: "2026-07-15-tier2-index-promotion",
    date: "2026-07-15",
    cat: "index",
    title: "1,167 catalog films promoted into the search index",
    body: "A measured-signal gate — enough recorded reception, honors, or canon presence — promoted 1,167 catalog-tier [film pages](/film) to indexable, and the promoted pages grew fuller mains: honors digests, complete release histories, and scholarship notes where they exist. [Director hubs](/director) gained scored filmographies and press digests, with 678 director pages now standing in the index; the sitemaps run on the identical gate, released in weekly cohorts.",
  },
  {
    id: "2026-07-15-filmcurio-retired",
    date: "2026-07-15",
    cat: "index",
    title: "Legacy domain filmcurio.com fully retired",
    body: "Every host of the site's earlier domain now permanently redirects (HTTP 308) to metatake.net, and residual filmcurio.com listings are being removed from Bing. One site, one address.",
  },
  {
    id: "2026-07-14-video-flags",
    date: "2026-07-14",
    cat: "index",
    title: "Video moved to where it belongs",
    body: "Autoplaying trailer heroes on reading pages were replaced with still-image heroes; embedded video now plays only on [Metatake TV](/tv) watch pages. This clears the cause of 3,388 'video is not on a watch page' notices in Google Search Console and made every text page lighter.",
  },
  {
    id: "2026-07-13-open-platform",
    date: "2026-07-13",
    cat: "api",
    title: "Metatake opens up: a free API, an MCP server, and embeds",
    body: "Anyone can now query Metatake programmatically — films, per-film TakeScore, and filming locations at /api/v1, no key required, with an OpenAPI schema ([API & embeds](/api)). AI assistants get the same access through an open MCP server, registered on the official MCP Registry as net.metatake/mcp ([MCP for AI](/mcp)). And a one-line script embeds a live TakeScore badge on any site ([/embed](/embed)). Every response carries a source link; the writing is CC BY-NC 4.0.",
  },
  {
    id: "2026-07-13-locations-dataset",
    date: "2026-07-13",
    cat: "data",
    title: "Open data: 17,341 geocoded filming locations",
    body: "Metatake's filming-locations corpus — 17,341 geocoded locations across 1,917 films in 130 countries, distinguishing where a film was shot from where it is set — is published on [Hugging Face](https://huggingface.co/datasets/wonwooyoon/metatake-filming-locations) and archived with a citable DOI on [Zenodo](https://doi.org/10.5281/zenodo.21336967). CC BY 4.0: reuse freely, including commercially, with attribution. Overview at [Open data](/data).",
  },
  {
    id: "2026-07-13-what-to-watch",
    date: "2026-07-13",
    cat: "feature",
    title: "What to Watch: pick your services, get an answer",
    body: "[What to Watch](/what-to-watch) starts from your country and streaming subscriptions and ranks what is available to you right now by TakeScore, with genre and year filters, five sort axes, and rent/buy badges — a nightly decision surface, not another list.",
  },
  {
    id: "2026-07-13-twenty-films",
    date: "2026-07-13",
    cat: "films",
    title: "Twenty demanding films join the close-read shelf",
    body: "Twenty canonical titles long missing from the close-read tier — films by Béla Tarr, Pedro Costa, Lav Diaz, and Wang Bing among them — arrived with full readings, misreadings, TakeScores, and connections. Browse the shelf at [Films](/film).",
  },
  {
    id: "2026-07-12-method-docs",
    date: "2026-07-12",
    cat: "policy",
    title: "The Method Docs: how Metatake is made, in public",
    body: "The [methodology page](/methodology) grew into a documentation site — dozens of documents covering how films are selected, how figures and readings are made, how TakeScore is computed, how kinship and counterpoint are measured, and where every data source comes from. If you disagree with a number, you can now find the rule that produced it.",
  },
  {
    id: "2026-07-12-poetics",
    date: "2026-07-12",
    cat: "feature",
    title: "Poetics: signed essays by the editor",
    body: "A signed essay corner by editor Wonwoo Yoon opened at [Poetics](/poetics) — essays on the craft of reading films, with every film example drawn from the editor's own viewing log.",
  },
  {
    id: "2026-07-12-copy-for-ai",
    date: "2026-07-12",
    cat: "feature",
    title: "Copy for AI, on every close-read film page",
    body: "Close-read film pages now carry Copy-for-AI buttons that render the page's criticism as a clean Markdown pack for pasting into an AI assistant — free, no login, attribution built in (CC BY-NC 4.0). More ways to take the data with you at [Open data](/data).",
  },
  {
    id: "2026-07-12-metatakebot",
    date: "2026-07-12",
    cat: "policy",
    title: "Our crawler introduces itself — and pays visits back",
    body: "All Metatake crawlers now identify as MetatakeBot/1.0 with a public policy page at [/bot](/bot). Crawlers that declare their own URL when visiting us receive one robots-respecting return visit — a small handshake for an open web.",
  },
  {
    id: "2026-07-11-metatake-tv",
    date: "2026-07-11",
    cat: "feature",
    title: "Metatake TV opens",
    body: "Films as broadcasts: compiled, chaptered TV-style programs playable from their film pages, a program guide organized by the site's own axes — directors, tropes, countries, decades — and an endless On Air channel. Tune in at [Metatake TV](/tv).",
  },
  {
    id: "2026-07-11-screener",
    date: "2026-07-11",
    cat: "feature",
    title: "The Screener: TakeScore becomes an instrument",
    body: "The [TakeScore hub](/takescore) was rebuilt around instant search over all 6,701 scored films — a score-distribution brush, genre and year filters, watch-country and subscription filters, and a comparison tray.",
  },
  {
    id: "2026-07-11-gsc-first-report",
    date: "2026-07-11",
    cat: "index",
    title: "First index report: Google has discovered 40,162 URLs",
    body: "Within a month of opening to search engines, Google Search Console shows 40,162 Metatake URLs discovered plus 7,353 video URLs, with zero manual actions and zero security issues. Indexing is the slow part; the state of the index will be reported here as it moves.",
  },
  {
    id: "2026-07-11-full-inventory",
    date: "2026-07-11",
    cat: "films",
    title: "The full shelf, browsable: 6,975 films, 865 directors",
    body: "The A-Z indexes now list the complete inventory — [6,975 films](/film) and [865 directors](/director) — including the catalog tier beyond the close-read core.",
  },
  {
    id: "2026-07-11-bot-sentinel",
    date: "2026-07-11",
    cat: "policy",
    title: "Automated defense against abusive scrapers",
    body: "An autonomous loop now detects and blocks bulk scrapers at the edge, while search engines and citing AI assistants remain explicitly welcome. The crawler policy is public at [/bot](/bot).",
  },
  {
    id: "2026-07-10-first-party-analytics",
    date: "2026-07-10",
    cat: "policy",
    title: "Measurement without cookies",
    body: "Metatake built an in-house, cookieless measurement pipeline — no cookies, no cross-site trackers, and no ad-tech scripts run on the site. See [Privacy](/privacy).",
  },
  {
    id: "2026-07-10-search-surface",
    date: "2026-07-10",
    cat: "feature",
    title: "Search became a results page",
    body: "[Search](/search) was rebuilt as a full results surface — entity cards, image strips, keyword-in-context snippets — served warm in about 0.4 seconds, on one engine that fuses exact and semantic search so a phrase, a theme, or a feeling can find a film. Korean queries resolve too, via 6,033 Korean name aliases.",
  },
  {
    id: "2026-07-09-now-playing",
    date: "2026-07-09",
    cat: "feature",
    title: "Now Playing: an hourly news desk",
    body: "A desk at [Now](/now) watches film news around the clock and publishes editor's-letter pieces connecting the day's stories to the site's readings, with a daily digest and a public wire.",
  },
  {
    id: "2026-07-09-director-pages",
    date: "2026-07-09",
    cat: "feature",
    title: "Director pages go deeper",
    body: "Every director hub now runs deeper — where to start, what to watch next, the life, honors, reception, and the theory their films attract — with a browsable [directors index](/curious/directors).",
  },
  {
    id: "2026-07-08-reception-chronicles",
    date: "2026-07-08",
    cat: "feature",
    title: "Afterlife: how films are received and remembered",
    body: "Film pages gained a year-by-year chronicle of each film's afterlife — reviews, academic study, re-releases, honors — built from 9,215 curated reception records plus public data sources. Example: [Mulholland Drive's afterlife](/film/mulholland-drive-2001/reception).",
  },
  {
    id: "2026-07-06-my-films-lens",
    date: "2026-07-06",
    cat: "feature",
    title: "See the whole site through your own films",
    body: "A personal lens now overlays every list, index, and graph: highlight what you have seen, dim it, or show only your films. It runs off your imported watch history and works across [the entire site](/my-films).",
  },
  {
    id: "2026-07-05-connections-rebuilt",
    date: "2026-07-05",
    cat: "feature",
    title: "The connection engine, rebuilt",
    body: "Film-to-film kinship was recomputed from shared tropes and taste signals — 46,000 affinity pairs and 11,000 counterpoint links (same trope, opposing readings) — all visible in the [Network](/network) galaxy of 1,941 films and 873 directors.",
  },
  {
    id: "2026-07-05-lineage-honors",
    date: "2026-07-05",
    cat: "data",
    title: "Honors as facts: 10,551 sourced list memberships",
    body: "The lineage corpus — 398 canon, award, and festival lists, every membership fully sourced — got its public read layer at [Lineage](/lineage), including per-film honors records for 895 films.",
  },
  {
    id: "2026-07-04-locations-layer",
    date: "2026-07-04",
    cat: "feature",
    title: "Where was it filmed? The Locations layer opens",
    body: "A geographic read layer opened over a geocoded corpus of more than 17,000 filming locations: per-film location pages, 73 country hubs, and 511 city and region hubs — where films were shot, and where they are set, with coordinates and sources. Start at [Locations](/locations).",
  },
  {
    id: "2026-07-04-sitemaps-indexnow",
    date: "2026-07-04",
    cat: "index",
    title: "Search engines, formally greeted",
    body: "The sitemap became a per-section index of about 13,000 URLs, IndexNow (live since July 2) now pushes new and changed pages to search engines immediately, and the site connected to Google Search Console. Index status will be reported here from now on.",
  },
  {
    id: "2026-07-03-watch-history-import",
    date: "2026-07-03",
    cat: "feature",
    title: "Bring your history: watch-log import",
    body: "[Import](/me/import) accepts Letterboxd, IMDb, Watcha, spreadsheet, and plain-text exports, auto-detects the format, and builds your personal layer over the site — coverage, blind spots, and what to watch next in [My Room](/room).",
  },
  {
    id: "2026-07-01-takescore-live",
    date: "2026-07-01",
    cat: "milestone",
    title: "TakeScore goes live",
    body: "Metatake's thirteen-dimension critical index — Value, Cost, Risk — went live across the site at [TakeScore](/takescore). It is computed from the criticism itself and never blended with audience ratings or box office; the divergence is the information.",
  },
  {
    id: "2026-06-27-map-explorer",
    date: "2026-06-27",
    cat: "feature",
    title: "The map of meaning becomes explorable",
    body: "A full-screen graph explorer over films and directors opened — click any node to recenter and follow shared meanings outward, ring by ring. It lives on today as [Network](/network).",
  },
  {
    id: "2026-06-26-theory-axis",
    date: "2026-06-26",
    cat: "feature",
    title: "Film theory becomes a browse axis",
    body: "Theorists, concepts, and traditions each received hubs and pages — [Theorists](/theorist), [Concepts](/concept), [Traditions](/tradition) — every one linked from the readings that cite it, so the theory behind a reading is always one click deep.",
  },
  {
    id: "2026-06-23-strong-misreadings",
    date: "2026-06-23",
    cat: "milestone",
    title: "Strong Misreadings: the house framework arrives",
    body: "The site's readings were rebuilt around the Strong Misreading — a reading pushed to full strength, after Harold Bloom's claim that reading is always misreading. The name is the disclaimer; what a reading keeps is what it lets you see. The credo is on [About](/about#strong-misreadings).",
  },
  {
    id: "2026-06-18-the-daily",
    date: "2026-06-18",
    cat: "feature",
    title: "The Daily begins",
    body: "A daily editorial connecting the world's news to films began publishing at [The Daily](/blog), with a newsletter to follow along.",
  },
  {
    id: "2026-06-17-opens-to-search",
    date: "2026-06-17",
    cat: "milestone",
    title: "Metatake opens to search engines",
    body: "Indexing was switched on and the first sitemap published. Public from here on.",
  },
  {
    id: "2026-06-17-tropes",
    date: "2026-06-17",
    cat: "feature",
    title: "Tropes: recurring figures become a browse axis",
    body: "When the same reading recurs across films it becomes a trope — and [Tropes](/tropes) opened as a first-class way to browse the site, from per-trope hubs to trope rows on every figure page.",
  },
  {
    id: "2026-06-16-robots-stance",
    date: "2026-06-16",
    cat: "policy",
    title: "First policy: welcome answer engines, decline training crawlers",
    body: "From before launch, robots.txt has welcomed search and answer engines while declining AI-training crawlers, with [llms.txt](/llms.txt) describing the site to machines. Metatake wants to be cited, not absorbed.",
  },
  {
    id: "2026-06-14-metatake-pivot",
    date: "2026-06-14",
    cat: "milestone",
    title: "Metatake gets its name and its spine",
    body: "The project took its final name and its critical architecture: the figure (what a film keeps returning to), the take (a reading of it), and the meta take (the pattern across films). Everything since is built on that spine — see [About](/about).",
  },
];

export const LATEST_UPDATE_DATE: string | undefined = UPDATES[0]?.date;
