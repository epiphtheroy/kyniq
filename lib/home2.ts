// Metatake new home (v7) — SHARED DATA CONTRACT.
// Both the data layer (home_v2_bundle RPC) and the frontend components target THESE shapes.
// Do not rename fields without updating both sides. Image fields are TMDB paths
// (poster_path / backdrop_path, e.g. "/abc.jpg") → build URL with IMG().

export const IMG_POSTER = "https://image.tmdb.org/t/p/w500";
export const IMG_BACKDROP = "https://image.tmdb.org/t/p/w780";
export const IMG_PROFILE = "https://image.tmdb.org/t/p/w342";

export type Film = {
  title: string;
  year: number | null;
  director: string | null;
  slug: string;            // → /film/{slug}
  poster: string | null;   // TMDB poster_path
  backdrop: string | null; // TMDB backdrop_path
  imdb: number | null;     // film_ratings.imdb_rating
  figures?: number | null;
  readings?: number | null;
  tropes?: number | null;
  topReading?: string | null;   // representative reading title or "via {figure}"
  figureLabel?: string | null;  // the figure it reads through
  figureSlug?: string | null;   // → /film/{slug}/figure/{figureSlug}
  ts?: number | null;           // public TakeScore U (= value − risk); null if unscored
  tsv?: number | null;          // value axis (for the verdict quadrant tooltip)
  tsr?: number | null;          // risk axis
};

export type Pick = Film & { shared: number };           // shared readings count
export type Top3 = Film & { rank: number; meta: string; metascore: number | null; rt: number | null; syn: string };
export type Top10Item = { rank: number; title: string; slug: string; imdb: number | null; poster?: string | null };
export type Wide = Film & { trope: string; framework: string }; // "Newly mapped" wide card
export type TropeRow = { rank: number; title: string; pair: string; slug: string; n: number }; // → /trope/{slug}
export type ConceptTile = { name: string; slug: string; n: number; backdrop?: string | null };    // → /idea/{slug}
export type LensFilm = Film & { shared?: number };                                              // via figure
export type DirectorSpot = {
  name: string; slug: string; place: string;        // slug → /director/{slug}
  image?: string | null;                            // directors.profile_path
  films: number; readings: number; tropes: number;
  sig: { title: string; count: string; via: string }[];
  filmo: { title: string; year: string }[];
};
export type DirectorCard = { name: string; slug: string; country: string; films: number; signature: string; image?: string | null };
export type Auteur = { name: string; slug: string; films: number; image?: string | null };
export type CanonFilm = Film & { lists: number };     // on N canon lists
export type GuideStep = { label: string; title: string; year: number | null; reason: string; slug?: string | null };
export type BlogLead = { title: string; dek: string; meta: string; slug: string };  // → /blog/{slug}
export type BlogItem = { title: string; meta: string; slug: string };
export type GraphNode = { label: string; kind: "film" | "trope"; slug: string };
// Structured pair for the original constellation graph (HomeConstellation/EntityGraph).
export type CPair = { mt: string; slug: string; a: { f: string; fs: string }; b: { f: string; fs: string } };

// "Today at Metatake" — one daily sample from each content layer (home_daily_exhibits).
export type Exhibits = {
  film?: { slug: string; title: string; year: number | null; director?: string | null; poster: string | null; backdrop?: string | null; ts?: number | null; tsv?: number | null; tsr?: number | null } | null;
  reversal?: { slug: string; title: string; year: number | null; poster: string | null; y1: number; v1: string; y2: number; v2: string } | null;
  question?: { title: string; fslug: string; qslug: string; film: string; year: number | null; poster: string | null } | null;
  place?: { place: string; fslug: string; film: string; year: number | null; poster: string | null } | null;
  misreading?: { slug: string; title: string; year: number | null; poster: string | null; trope: string | null } | null;
  counterpoint?: { slug: string; trope: string; a: { f: string; fs: string }; b: { f: string; fs: string } } | null;
} | null;

export type HomeV2 = {
  stats: { films: number; directors: number; tropes: number; concepts: number; readings: number; figures: number; lists: number; theorists?: number; traditions?: number };
  hero: Film[];                                   // rotating featured (counts + figureLabel populated)
  picks: Pick[];                                  // Recommended by the map (≥30)
  top3: Top3[];                                   // essential 10, detailed #1–3
  top10: Top10Item[];                             // essential 10, #4–10
  newly: Wide[];                                  // Newly mapped (≥30)
  tropes: TropeRow[];                             // The widest readings (8–16)
  concepts: ConceptTile[];                        // Popular concepts (≥30)
  lens: { frameworks: string[]; byFramework: Record<string, LensFilm[]> }; // Explore by lens (≥30/tab)
  directorSpots: DirectorSpot[];                  // Directors spotlight (rotating)
  directors: DirectorCard[];                      // Auteurs on the map (≥30)
  auteurs: Auteur[];                              // Auteurs to explore (circles)
  rhyme: { seed: string; films: Pick[] };         // Films that rhyme (≥30)
  canon: CanonFilm[];                             // Recommended by (canon) (≥30)
  guide: { director: string; slug: string; steps: GuideStep[] }; // a way into [director]
  blog: { lead: BlogLead; more: BlogItem[] };     // Between Film and the World
  graph: GraphNode[];                             // live node graph pool (≥16, film/trope alternating)
  pairs?: CPair[];                                // structured pairs for the original constellation graph
};

// ── Minimal placeholder so the frontend renders before the RPC is wired. ──
// Real data comes from the home_v2_bundle RPC (same shape). Tones (no images yet) are
// handled in the component; here poster/backdrop are null.
const f = (title: string, year: number, director: string, slug: string, imdb: number, vi: string, figures = 10, readings = 20, tropes = 12): Film =>
  ({ title, year, director, slug, poster: null, backdrop: null, imdb, figures, readings, tropes, figureLabel: vi, topReading: `via ${vi}` });

const POOL: Film[] = [
  f("The Zone of Interest", 2023, "Glazer", "the-zone-of-interest-2023", 7.4, "the garden wall", 14, 14, 12),
  f("The Favourite", 2018, "Lanthimos", "the-favourite-2018", 7.5, "the court's favour", 14, 42, 16),
  f("Black Swan", 2010, "Aronofsky", "black-swan-2010", 8.0, "Nina's mutations", 9, 31, 13),
  f("Aftersun", 2022, "Wells", "aftersun-2022", 7.7, "the camcorder", 10, 22, 11),
  f("2001: A Space Odyssey", 1968, "Kubrick", "2001-a-space-odyssey-1968", 8.3, "the monolith", 12, 24, 18),
  f("The Shining", 1980, "Kubrick", "the-shining-1980", 8.4, "Room 237", 13, 29, 14),
  f("Amour", 2012, "Haneke", "amour-2012", 7.9, "the held hand", 8, 27, 10),
  f("Parasite", 2019, "Bong Joon Ho", "parasite-2019", 8.5, "the half-basement", 13, 38, 20),
  f("Vertigo", 1958, "Hitchcock", "vertigo-1958", 8.3, "Madeleine's spiral", 11, 26, 12),
  f("Mulholland Drive", 2001, "Lynch", "mulholland-drive-2001", 8.0, "the blue box", 12, 28, 14),
  f("Au Hasard Balthazar", 1966, "Bresson", "au-hasard-balthazar-1966", 7.8, "Balthazar the donkey", 9, 19, 12),
  f("Memories of Murder", 2003, "Bong Joon Ho", "memories-of-murder-2003", 8.1, "the rice paddy", 10, 21, 13),
];

export const PLACEHOLDER: HomeV2 = {
  stats: { films: 1935, directors: 870, tropes: 4710, concepts: 1078, readings: 26975, figures: 18168, lists: 399, theorists: 898, traditions: 342 },
  hero: POOL.slice(0, 5),
  picks: POOL.map((x) => ({ ...x, shared: x.readings ?? 10 })),
  top3: [
    { ...f("Nomadland", 2020, "Chloé Zhao", "nomadland-2020", 7.3, "the road", 9, 24, 12), rank: 1, meta: "2020 · Drama · 108m · R · dir. Chloé Zhao", metascore: 87, rt: 93, syn: "The Road As The Only Honest Plot: refusing arc and resolution, the drift itself becomes the argument about a life." },
    { ...f("American Beauty", 1999, "Sam Mendes", "american-beauty-1999", 8.3, "the plastic bag", 8, 22, 11), rank: 2, meta: "1999 · Drama · 122m · R · dir. Sam Mendes", metascore: 84, rt: 87, syn: "The Plastic Bag As Accidental Sublime: beauty relocated to the overlooked, where the suburban gaze least expects it." },
    { ...f("Slumdog Millionaire", 2008, "Danny Boyle", "slumdog-millionaire-2008", 8.0, "the quiz", 8, 20, 10), rank: 3, meta: "2008 · Drama · 120m · R · dir. Danny Boyle", metascore: 84, rt: 91, syn: "The Quiz As Fate's Ledger: each question a wound recalled, chance reframed as the bookkeeping of a life." },
  ],
  top10: [
    ["The King's Speech", "the-kings-speech-2010", 8.0], ["12 Years a Slave", "12-years-a-slave-2013", 8.1],
    ["Parasite", "parasite-2019", 8.5], ["Anora", "anora-2024", 7.4], ["Chariots of Fire", "chariots-of-fire-1981", 7.1],
    ["The Pianist", "the-pianist-2002", 8.5], ["Rain Man", "rain-man-1988", 8.0],
  ].map(([title, slug, imdb], i) => ({ rank: i + 4, title: title as string, slug: slug as string, imdb: imdb as number })),
  newly: POOL.slice().reverse().map((x, i) => ({ ...x, trope: `One of ${x.tropes} tropes — via ${x.figureLabel}`, framework: ["ETHICS", "RECEPTION", "LOCATION", "SUBTEXT", "POLITICS", "ONTOLOGY", "PSYCHOANALYSIS"][i % 7] })),
  tropes: [
    ["The Face As Infinite Ethical Summons", "Au Hasard Balthazar ⟷ Chronicle of a Summer", 61],
    ["Duty As Categorical Imperative Against Consequence", "The Grand Budapest Hotel ⟷ Hero", 57],
    ["The Compulsion To Repeat An Unmastered Wound", "The Favourite ⟷ Night Is Short, Walk On Girl", 52],
    ["The Object That Will Not Be Mourned", "Minority Report ⟷ The Favourite", 43],
    ["The Banality Of Evil, Administered", "The Fog of War ⟷ Fantastic Planet", 37],
    ["The Held Shot As Ethical Witness", "Still the Water ⟷ Amour", 37],
    ["The Critic's Verdict As Unwitting Confession", "Closer ⟷ If I Had Legs I'd Kick You", 35],
    ["The Award As Society's Absolution Ritual", "Investigation of a Citizen ⟷ Traffic", 33],
  ].map(([title, pair, n], i) => ({ rank: i + 1, title: title as string, pair: pair as string, slug: "", n: n as number })),
  concepts: [
    ["repetition compulsion", 129], ["death drive", 113], ["the society of the spectacle", 87], ["bad faith", 83],
    ["the banality of evil", 80], ["the Real (le réel)", 64], ["return of the repressed", 63], ["commodity fetishism", 58],
    ["Orientalism", 58], ["the uncanny", 44], ["objet petit a", 38], ["being-toward-death", 35], ["non-place (non-lieu)", 35],
    ["the abject", 31], ["eternal recurrence", 30], ["durée", 29], ["necropolitics", 29], ["the alienation effect", 29],
    ["ethics of care", 28], ["mourning and melancholia", 26], ["bare life (homo sacer)", 24], ["the culture industry", 24],
    ["the face of the Other", 24], ["simulacrum / hyperreality", 19], ["the categorical imperative", 19], ["panopticism", 17],
    ["involuntary memory", 16], ["the male gaze", 14], ["hauntology", 11], ["jouissance", 22],
  ].map(([name, n]) => ({ name: name as string, slug: "", n: n as number })),
  lens: {
    frameworks: ["Psychoanalysis", "Ethics", "Politics", "Ontology", "Semiotics", "Reception"],
    byFramework: Object.fromEntries(
      ["Psychoanalysis", "Ethics", "Politics", "Ontology", "Semiotics", "Reception"].map((k, off) => [k, POOL.map((_, i) => POOL[(i + off * 3) % POOL.length]) as LensFilm[]])
    ),
  },
  directorSpots: [
    { name: "Stanley Kubrick", slug: "stanley-kubrick", place: "New York City, USA · b.1928", films: 10, readings: 143, tropes: 87,
      sig: [{ title: "The Lens That Becomes a Gaze", count: "×4", via: "via the wide-angle stare" }, { title: "The Machine Undone by Its Own Imperative", count: "×2", via: "via HAL 9000" }],
      filmo: [["Paths of Glory", "'57"], ["Dr. Strangelove", "'64"], ["2001", "'68"], ["A Clockwork Orange", "'71"], ["The Shining", "'80"]].map(([title, year]) => ({ title, year })) },
    { name: "Bong Joon Ho", slug: "bong-joon-ho", place: "Daegu, South Korea · b.1969", films: 6, readings: 74, tropes: 52,
      sig: [{ title: "The Staircase As Class Diagram", count: "×3", via: "via the half-basement" }, { title: "The Banality Of Evil, Administered", count: "×2", via: "via the system" }],
      filmo: [["Memories of Murder", "'03"], ["Mother", "'09"], ["Snowpiercer", "'13"], ["Parasite", "'19"]].map(([title, year]) => ({ title, year })) },
  ],
  directors: [
    ["Akira Kurosawa", "akira-kurosawa", "Japan", 15, "The Rain That Washes Nothing Clean"],
    ["Alfred Hitchcock", "alfred-hitchcock", "United Kingdom", 22, "The Look That Implicates the Watcher"],
    ["Steven Spielberg", "steven-spielberg", "United States", 25, "The Object That Will Not Be Mourned"],
    ["Abbas Kiarostami", "abbas-kiarostami", "Iran", 7, "The Road As The Only Honest Plot"],
    ["Bong Joon Ho", "bong-joon-ho", "South Korea", 6, "The Staircase As Class Diagram"],
    ["David Lynch", "david-lynch", "United States", 10, "The Dream Logic Of The Real"],
    ["Martin Scorsese", "martin-scorsese", "United States", 25, "Grace Sought In Violence"],
    ["Robert Bresson", "robert-bresson", "France", 13, "The Model Over The Actor"],
  ].map(([name, slug, country, films, signature]) => ({ name: name as string, slug: slug as string, country: country as string, films: films as number, signature: signature as string })),
  auteurs: [
    ["Steven Spielberg", "steven-spielberg", 25], ["Alfred Hitchcock", "alfred-hitchcock", 22], ["Martin Scorsese", "martin-scorsese", 20],
    ["Akira Kurosawa", "akira-kurosawa", 15], ["Joel Coen", "joel-coen", 14], ["Richard Linklater", "richard-linklater", 13],
    ["Abbas Kiarostami", "abbas-kiarostami", 7], ["Bong Joon Ho", "bong-joon-ho", 6],
  ].map(([name, slug, films]) => ({ name: name as string, slug: slug as string, films: films as number })),
  rhyme: { seed: "The Zone of Interest", films: POOL.map((x, i) => ({ ...x, shared: Math.max(2, 9 - (i % 8)) })) },
  canon: [
    ["Parasite", "parasite-2019", 2019, "Bong Joon Ho", 8.5, 20], ["Schindler's List", "schindlers-list-1993", 1993, "Spielberg", 9.0, 19],
    ["The Hurt Locker", "the-hurt-locker-2008", 2008, "Bigelow", 7.5, 19], ["No Country for Old Men", "no-country-for-old-men-2007", 2007, "Coen", 8.2, 18],
    ["Moonlight", "moonlight-2016", 2016, "Jenkins", 7.4, 16], ["The Social Network", "the-social-network-2010", 2010, "Fincher", 7.8, 16],
    ["12 Years a Slave", "12-years-a-slave-2013", 2013, "McQueen", 8.1, 14], ["The Pianist", "the-pianist-2002", 2002, "Polanski", 8.5, 13],
  ].map(([title, slug, year, director, imdb, lists]) => ({ ...f(title as string, year as number, director as string, slug as string, imdb as number, ""), lists: lists as number })),
  guide: { director: "Abbas Kiarostami", slug: "abbas-kiarostami", steps: [
    { label: "Start here", title: "Where Is the Friend's House?", year: 1987, reason: "A boy tries to return a classmate's notebook — a small errand, vast moral weight." },
    { label: "If you loved that", title: "Certified Copy", year: 2010, reason: "In Tuscany with Binoche, a couple's talk slips between real and performed." },
    { label: "The peak", title: "Taste of Cherry", year: 1997, reason: "A man drives Tehran's hills seeking someone to bury him — or talk him out of it." },
    { label: "The deep cut", title: "The Wind Will Carry Us", year: 1999, reason: "A city engineer waits in a Kurdish village for a death that won't arrive." },
  ] },
  blog: {
    lead: { title: "Between Film and the World — the day's events, and the films that already knew", dek: "Five things happened today. For each, the map surfaces a film that already mapped its logic.", meta: "Jun 25 · metatake · daily edition · 7 min read", slug: "" },
    more: [
      { title: "Between Film and the World — five things, and the films that knew", meta: "Jun 24 · daily edition · 6 min", slug: "" },
      { title: "Between Film and the World — four things that happened", meta: "Jun 23 · daily edition · 5 min", slug: "" },
      { title: "Oakland As Decaying Promised Land — a new trope enters the map", meta: "Jun 22 · trope", slug: "" },
      { title: "The Cut That Obeys The Beat — editing surrenders to rhythm", meta: "Jun 19 · trope", slug: "" },
    ],
  },
  graph: [
    ["The Zone of Interest", "film"], ["Evil As Administration", "trope"], ["Aftersun", "film"], ["The Compulsion To Repeat", "trope"],
    ["Black Swan", "film"], ["The Flesh That Changes Shape", "trope"], ["Amour", "film"], ["The Held Shot As Witness", "trope"],
    ["Parasite", "film"], ["The Staircase As Class Diagram", "trope"], ["Vertigo", "film"], ["The Object Not Mourned", "trope"],
    ["Mulholland Drive", "film"], ["The Dream Logic Of The Real", "trope"], ["Hero", "film"], ["Duty Against Consequence", "trope"],
  ].map(([label, kind]) => ({ label: label as string, kind: kind as "film" | "trope", slug: "" })),
};
