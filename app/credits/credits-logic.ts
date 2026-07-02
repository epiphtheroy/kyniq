/* Credits explorer — pure client logic.
 * Ported from the validated single-file prototype (credit DB/크래프트발견_v2.html).
 * Rules that must never regress:
 *  - job matching is EXACT (Set membership) and department-gated — never substrings
 *  - ranking is Bayesian weighted consensus — popularity is never used
 *  - collaboration counts are exact within the analysed corpus, labelled "N of M"
 *  - reunion = the artist made ≥2 films without them in between (corpus index), and ≥5 years passed
 */

export type CraftKey = "dir" | "writer" | "dp" | "editor" | "composer" | "pd";
export type GrpKey = "director" | "dp" | "editor" | "composer" | "pd" | "writer" | "producer" | "actor";

export interface TFilm {
  id: number; title: string; year: number;
  R: number; v: number; WR: number | null;
  poster: string | null; backdrop: string | null; genres: number[];
}
export interface TPerson {
  id: number; name: string; imdb_id?: string | null; profile_path: string | null;
  known_for_department?: string | null; birthday?: string | null; deathday?: string | null;
  place_of_birth?: string | null;
}
export interface CrewEntry { id: number; name: string; job: string; department: string; profile_path: string | null; }
export interface CastEntry { id: number; name: string; order?: number; profile_path: string | null; }
export interface CreditsPayload { crew?: CrewEntry[]; cast?: CastEntry[]; }
export interface MovieCreditEntry {
  id: number; title?: string; original_title?: string; release_date?: string;
  vote_average?: number; vote_count?: number; poster_path?: string | null;
  backdrop_path?: string | null; genre_ids?: number[]; job?: string; department?: string;
}
export interface Reunion { afterTitle: string; afterYear: number; backTitle: string; backYear: number; gapFilms: number; gapYears: number; }
export interface Collab {
  id: number; name: string; img: string | null;
  primary: string; grp: GrpKey; count: number;
  filmsArr: TFilm[]; filmIds: Set<number>;
  reunion: Reunion | null; y0: number; y1: number;
}
export interface GenreSlice { name: string; pct: number; color: string; }
export interface ArtistData {
  person: TPerson; craftKey: CraftKey;
  films: TFilm[]; byWR: TFilm[];
  essentials: TFilm[]; deep: TFilm[]; further: TFilm[];
  startHere: TFilm; notStart: TFilm | null;
  partners: Collab[]; partnerIds: Set<number>;
  troupe: Collab[]; topCollab: Collab | null;
  totalWorks: number; corpus: TFilm[]; failed: number;
  gTop: GenreSlice[]; C: number; m: number; isDir: boolean;
}
export type Api = (path: string, params?: Record<string, string>) => Promise<unknown>;

export const IMG = "https://image.tmdb.org/t/p/";
export const img = (p: string | null | undefined, s: string) => (p ? IMG + s + p : null);
export const fmtV = (v: number) =>
  v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1000 ? (v / 1000 >= 100 ? String(Math.round(v / 1000)) : (v / 1000).toFixed(1)) + "k" : String(v);
export const yrsFmt = (a: number, b: number) => (b && b !== a ? `${a}–${b}` : `${a}`);

export function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) * p)];
}
export const median = (a: number[]) => percentile(a, 0.5);

/* ---------- craft vocabulary (exact matching) ---------- */
export const CRAFTS: Record<CraftKey, { label: string; kr: string; role: string; depts: string[]; jobs: Set<string> }> = {
  dir: { label: "Director", kr: "감독", role: "Director", depts: ["Directing"], jobs: new Set(["Director"]) },
  writer: { label: "Screenplay", kr: "각본", role: "Writer", depts: ["Writing"], jobs: new Set(["Screenplay", "Writer", "Story", "Author", "Adaptation", "Original Story", "Original Film Writer", "Co-Writer", "Story by", "Written by", "Scenario Writer"]) },
  dp: { label: "Cinematography", kr: "촬영", role: "Cinematographer", depts: ["Camera"], jobs: new Set(["Director of Photography", "Cinematographer", "Cinematography"]) },
  editor: { label: "Editing", kr: "편집", role: "Editor", depts: ["Editing"], jobs: new Set(["Editor", "Film Editor", "Edited by"]) },
  composer: { label: "Score", kr: "음악", role: "Composer", depts: ["Sound"], jobs: new Set(["Original Music Composer", "Composer", "Music"]) },
  pd: { label: "Production Design", kr: "미술", role: "Production Designer", depts: ["Art", "Production"], jobs: new Set(["Production Design", "Production Designer"]) },
};
export const CRAFT_ORDER: CraftKey[] = ["dir", "writer", "dp", "editor", "composer", "pd"];

export function jobMatches(cf: (typeof CRAFTS)[CraftKey], c: { job?: string; department?: string }): boolean {
  if (!c || !c.job) return false;
  return cf.jobs.has(c.job) && !!c.department && cf.depts.includes(c.department);
}
export function jobMatchesLoose(cf: (typeof CRAFTS)[CraftKey], c: { job?: string }): boolean {
  if (!c || !c.job) return false;
  return cf.jobs.has(c.job);
}

/* ---------- role groups for the repertory company ---------- */
export const FAM: Record<GrpKey, { label: string; kr: string; order: number; color: string; min: number }> = {
  director: { label: "Director", kr: "감독", order: 0, color: "#3E5F8A", min: 2 },
  dp: { label: "Cinematographer", kr: "촬영", order: 1, color: "#2F6F8F", min: 2 },
  editor: { label: "Editor", kr: "편집", order: 2, color: "#2E7D4F", min: 2 },
  composer: { label: "Composer", kr: "음악", order: 3, color: "#8A6A2E", min: 2 },
  pd: { label: "Production Designer", kr: "미술", order: 4, color: "#6E4F8E", min: 2 },
  writer: { label: "Writer", kr: "각본", order: 5, color: "#9E4F63", min: 2 },
  producer: { label: "Producer", kr: "제작", order: 6, color: "#6B6B6B", min: 3 },
  actor: { label: "Recurring Cast", kr: "페르소나", order: 7, color: "#B08A2E", min: 3 },
};
export function famGroup(job: string): GrpKey | null {
  if (job === "Director") return "director";
  if (["Director of Photography", "Cinematographer", "Cinematography"].includes(job)) return "dp";
  if (["Editor", "Film Editor", "Edited by"].includes(job)) return "editor";
  if (["Original Music Composer", "Composer", "Music"].includes(job)) return "composer";
  if (["Production Design", "Production Designer"].includes(job)) return "pd";
  if (["Writer", "Screenplay", "Story", "Author", "Adaptation", "Original Story"].includes(job)) return "writer";
  if (job === "Producer") return "producer"; // Executive/Line/Associate/Co- excluded by design
  if (job === "Actor") return "actor";
  return null;
}
export const GRP2CRAFT: Partial<Record<GrpKey, CraftKey>> = {
  director: "dir", dp: "dp", editor: "editor", composer: "composer", pd: "pd", writer: "writer",
};

export const GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary",
  18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
};
const GCOLORS = ["#3E5F8A", "#2E7D4F", "#6E4F8E", "#9E4F63", "#8A6A2E"];

/* ---------- curated style lines ---------- */
const STYLE: Record<string, string> = {
  "roger deakins": "Motivated, unshowy naturalism — precise, architectural light that serves story over spectacle.",
  "christopher doyle": "Saturated, restless handheld intoxication; smeared neon and emotional colour (the Wong Kar-wai look).",
  "mark lee ping-bing": "Patient, humid lyricism — light that seems to remember rather than record.",
  "emmanuel lubezki": "Unbroken natural-light long takes that float — the camera as a living, weightless presence.",
  "vittorio storaro": "Painterly, symbolic colour theory; bold expressive lighting as psychological language.",
  "darius khondji": "Rich, shadow-drenched texture — dread and beauty in the same frame.",
  "hoyte van hoytema": "Large-format tactility and hard natural contrast; scale you feel in your chest.",
  "greig fraser": "Monolithic silhouettes and available-light minimalism — scale rendered intimate.",
  "chung chung-hoon": "Immaculate, symmetrical control and lush menace — the Park Chan-wook palette.",
  "hong kyung-pyo": "Cool, meticulous naturalism that turns social space into unease (Bong Joon-ho, Lee Chang-dong).",
  "kim ji-yong": "Burnished, classical control — genre polished into elegance.",
  "thelma schoonmaker": "Muscular, rhythmic cutting that gives Scorsese his pulse — violence and reverie in the same beat.",
  "hans zimmer": "Architectural, low-end propulsion; texture and dread over melody.",
  "jonny greenwood": "Dissonant, string-driven unease that scores the mind, not the scene.",
  "ennio morricone": "Operatic, whistling grandeur and aching melody — myth made audible.",
  "ryuichi sakamoto": "Elegiac minimalism — melody as memory, silence as grief.",
  "jo yeong-wook": "Baroque string figures and cold elegance — the Park Chan-wook sound.",
  "jack fisk": "Landscapes as psychology; lived-in, elemental worlds (Malick, PTA).",
  "ken adam": "Bold modernist spectacle — the war room, the Bond lair, architecture as power.",
  "bong joon-ho": "Genre-warping social vision — tonal whiplash between comedy, horror and heartbreak.",
  "park chan-wook": "Operatic, symmetrical cruelty and beauty; revenge as baroque design.",
  "wes anderson": "Symmetrical dollhouse worlds, deadpan melancholy, a devoted repertory troupe.",
  "wong kar-wai": "Time, longing and missed connections — stories told through texture and repetition.",
};
export function styleFor(name: string, role: string, topCollab: Collab | null, count: number, yr0: number, yr1: number): string {
  const k = (name || "").toLowerCase();
  if (STYLE[k]) return STYLE[k];
  if (topCollab) return `${count} films as ${role.toLowerCase()} — a recurring partnership with ${topCollab.name} (${topCollab.count} films) runs through the work.`;
  return `${count} films as ${role.toLowerCase()}, ${yrsFmt(yr0, yr1)}.`;
}

/* ---------- shared caches (module scope — survive client navigations) ---------- */
const creditsCache = new Map<number, CreditsPayload>();
const artistCache = new Map<string, ArtistData>();

export async function filmCredits(api: Api, id: number): Promise<CreditsPayload> {
  const hit = creditsCache.get(id);
  if (hit) return hit;
  const cr = (await api(`/movie/${id}/credits`)) as CreditsPayload;
  creditsCache.set(id, cr);
  return cr;
}
export function primeCredits(id: number, cr: CreditsPayload) { creditsCache.set(id, cr); }

export function buildTabs(crew: CrewEntry[]): { craft: CraftKey; people: CrewEntry[] }[] {
  const tabs: { craft: CraftKey; people: CrewEntry[] }[] = [];
  for (const kk of CRAFT_ORDER) {
    const cf = CRAFTS[kk];
    let people = crew.filter((c) => jobMatches(cf, c));
    if (!people.length) people = crew.filter((c) => jobMatchesLoose(cf, c));
    const seen = new Set<number>();
    people = people.filter((p) => !seen.has(p.id) && !!seen.add(p.id));
    if (people.length) tabs.push({ craft: kk, people });
  }
  return tabs;
}

async function pool<T>(items: T[], size: number, worker: (item: T, idx: number) => Promise<void>): Promise<void> {
  let i = 0;
  const run = async () => { while (i < items.length) { const idx = i++; await worker(items[idx], idx); } };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
}

function pickCorpus(films: TFilm[]): TFilm[] {
  if (films.length <= 44) return films.slice();
  const set = new Set([...films].sort((a, b) => b.v - a.v).slice(0, 24).map((f) => f.id));
  const rest = films.filter((f) => !set.has(f.id));
  const need = 44 - set.size, step = rest.length / need;
  for (let i = 0; i < need; i++) { const f = rest[Math.floor(i * step)]; if (f) set.add(f.id); }
  return films.filter((f) => set.has(f.id));
}

export function artistCacheGet(pid: number, craft: CraftKey): ArtistData | undefined {
  return artistCache.get(`${pid}|${craft}`);
}

export async function computeArtist(
  api: Api, personId: number, craftKey: CraftKey,
  onProgress?: (msg: string) => void
): Promise<ArtistData | { empty: string; person: TPerson }> {
  const cached = artistCache.get(`${personId}|${craftKey}`);
  if (cached) return cached;
  const cf = CRAFTS[craftKey];
  onProgress?.("Reading the filmography…");
  const [person, mc] = await Promise.all([
    api(`/person/${personId}`) as Promise<TPerson>,
    api(`/person/${personId}/movie_credits`) as Promise<{ cast?: MovieCreditEntry[]; crew?: MovieCreditEntry[] }>,
  ]);

  const workIds = new Set<number>();
  [...(mc.cast || []), ...(mc.crew || [])].forEach((c) => workIds.add(c.id));

  const collect = (pred: (c: MovieCreditEntry) => boolean): TFilm[] => {
    const seen: Record<number, 1> = {}; const out: TFilm[] = [];
    (mc.crew || []).forEach((c) => {
      if (!pred(c) || seen[c.id]) return; seen[c.id] = 1;
      out.push({
        id: c.id, title: c.title || c.original_title || `#${c.id}`,
        year: +((c.release_date || "").slice(0, 4)) || 0,
        R: c.vote_average || 0, v: c.vote_count || 0, WR: null,
        poster: c.poster_path ?? null, backdrop: c.backdrop_path ?? null, genres: c.genre_ids || [],
      });
    });
    return out;
  };
  let films = collect((c) => jobMatches(cf, c));
  if (!films.length) films = collect((c) => jobMatchesLoose(cf, c)); // mirror tab fallback — exact job, misfiled dept
  const upcoming = films.filter((f) => f.year === 0).length;
  films = films.filter((f) => f.year > 0).sort((a, b) => a.year - b.year);
  if (!films.length) {
    return {
      empty: upcoming
        ? `Every ${cf.role.toLowerCase()} credit here is still unreleased — come back when the credits roll.`
        : `No ${cf.role.toLowerCase()} credits with data on TMDB for this person.`,
      person,
    };
  }

  /* Bayesian weighted consensus — tuned for low-vote cinema */
  const rated = films.filter((f) => f.v > 0);
  const C = rated.length ? rated.reduce((a, f) => a + f.R, 0) / rated.length : 6.8; // unweighted prior
  let m = percentile(rated.map((f) => f.v), 0.25);
  m = Math.round(Math.max(10, Math.min(500, m || 10)));
  films.forEach((f) => { f.WR = f.v > 0 ? (f.v * f.R + m * C) / (f.v + m) : null; });
  const votes = rated.map((f) => f.v), medV = median(votes);

  /* company corpus */
  const corpus = pickCorpus(films);
  const corpusIdx = new Map(corpus.map((f, i) => [f.id, i]));
  interface Acc { id: number; name: string; img: string | null; jobs: Record<string, number>; films: Map<number, TFilm>; }
  const collab = new Map<number, Acc>();
  let failed = 0, done = 0;
  onProgress?.(`Assembling the company… 0/${corpus.length}`);
  await pool(corpus, 8, async (f) => {
    try {
      const cr = await filmCredits(api, f.id);
      const add = (c: { id: number; name: string; profile_path: string | null }, job: string) => {
        if (c.id === personId) return;
        let o = collab.get(c.id);
        if (!o) { o = { id: c.id, name: c.name, img: c.profile_path, jobs: {}, films: new Map() }; collab.set(c.id, o); }
        o.jobs[job] = (o.jobs[job] || 0) + 1; o.films.set(f.id, f);
        if (!o.img && c.profile_path) o.img = c.profile_path;
      };
      (cr.crew || []).forEach((c) => { if (famGroup(c.job)) add(c, c.job); });
      (cr.cast || []).filter((c) => (c.order != null ? c.order : 99) < 15).forEach((c) => add(c, "Actor"));
    } catch { failed++; }
    done++;
    if (done % 4 === 0 || done === corpus.length) onProgress?.(`Assembling the company… ${done}/${corpus.length}`);
  });

  const troupe: Collab[] = [...collab.values()].map((o) => {
    const filmsArr = [...o.films.values()].sort((a, b) => a.year - b.year || (corpusIdx.get(a.id)! - corpusIdx.get(b.id)!));
    const primary = Object.entries(o.jobs).sort((a, b) => b[1] - a[1])[0][0];
    const grp = famGroup(primary);
    if (!grp) return null;
    let reunion: Reunion | null = null;
    for (let i = 1; i < filmsArr.length; i++) {
      const gapFilms = corpusIdx.get(filmsArr[i].id)! - corpusIdx.get(filmsArr[i - 1].id)!;
      const gapYears = filmsArr[i].year - filmsArr[i - 1].year;
      if (gapFilms >= 3 && gapYears >= 5) reunion = {
        afterTitle: filmsArr[i - 1].title, afterYear: filmsArr[i - 1].year,
        backTitle: filmsArr[i].title, backYear: filmsArr[i].year,
        gapFilms: gapFilms - 1, gapYears,
      };
    }
    return {
      id: o.id, name: o.name, img: o.img, primary, grp,
      count: filmsArr.length, filmsArr, filmIds: new Set(filmsArr.map((f) => f.id)),
      reunion, y0: filmsArr[0].year, y1: filmsArr[filmsArr.length - 1].year,
    } as Collab;
  }).filter((o): o is Collab => !!o && o.count >= FAM[o.grp].min);

  const isDir = craftKey === "dir";
  const partners = (isDir
    ? troupe.filter((o) => (["dp", "editor", "composer", "pd", "writer"] as GrpKey[]).includes(o.grp) && o.count >= 3)
    : troupe.filter((o) => o.grp === "director"))
    .sort((a, b) => b.count - a.count || a.y0 - b.y0).slice(0, 6);
  const partnerIds = new Set(partners.map((p) => p.id));
  const topCollab = troupe.filter((o) => o.grp !== "producer" && o.count >= 3).sort((a, b) => b.count - a.count)[0] || null;

  /* buckets */
  const byWR = [...films].sort((a, b) => (b.WR ?? -1) - (a.WR ?? -1));
  const essCut = Math.max(medV, 25);
  const essentials = byWR.filter((f) => f.v >= essCut).slice(0, 6);
  const essIds = new Set(essentials.map((f) => f.id));
  const deep = byWR.filter((f) => !essIds.has(f.id) && f.v >= 10 && f.v < essCut).slice(0, 6);
  const further = byWR.filter((f) => !essIds.has(f.id) && f.v >= essCut).slice(0, 10);
  const startHere = essentials[0] || byWR[0];
  let notStart: TFilm | null = null;
  if (films.length >= 6) {
    const cands = rated.filter((f) => f.v >= essCut && f.WR != null && f.WR <= C - 0.6 && f.id !== startHere.id && !essIds.has(f.id));
    if (cands.length) notStart = cands.sort((a, b) => (a.WR ?? 0) - (b.WR ?? 0))[0];
  }

  /* genre fingerprint */
  const gCount: Record<number, number> = {};
  films.forEach((f) => f.genres.forEach((g) => { if (GENRES[g]) gCount[g] = (gCount[g] || 0) + 1; }));
  const gTotal = Object.values(gCount).reduce((a, b) => a + b, 0);
  const gTop: GenreSlice[] = Object.entries(gCount).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([g, n], i) => ({ name: GENRES[+g], pct: Math.round((n / gTotal) * 100), color: GCOLORS[i % GCOLORS.length] }));

  const S: ArtistData = {
    person, craftKey, films, byWR, essentials, deep, further, startHere, notStart,
    partners, partnerIds, troupe, topCollab, totalWorks: workIds.size, corpus, failed, gTop, C, m, isDir,
  };
  artistCache.set(`${personId}|${craftKey}`, S);
  if (artistCache.size > 24) artistCache.delete(artistCache.keys().next().value as string);
  return S;
}

/* ---------- Wikidata awards (CC0) ---------- */
export interface Award { award: string; year: number; forw: string; }
const awardsCache = new Map<string, Award[]>();
export async function wdAwards(imdbId: string): Promise<Award[]> {
  const hit = awardsCache.get(imdbId);
  if (hit) return hit;
  if (!/^(nm|tt|co)\d+$/.test(imdbId)) return [];
  const q = `SELECT ?awardLabel ?year ?forLabel WHERE {
    ?p wdt:P345 "${imdbId}". ?p p:P166 ?s. ?s ps:P166 ?award.
    OPTIONAL{ ?s pq:P585 ?d. BIND(YEAR(?d) AS ?year) }
    OPTIONAL{ ?s pq:P1686 ?for. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ko". }
  } ORDER BY DESC(?year) LIMIT 200`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch("https://query.wikidata.org/sparql", {
      method: "POST", signal: ctrl.signal,
      headers: { Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
      body: "query=" + encodeURIComponent(q),
    });
    if (!r.ok) throw new Error(`wd ${r.status}`);
    const j = (await r.json()) as { results: { bindings: Array<Record<string, { value: string } | undefined>> } };
    const rows = j.results.bindings
      .map((x) => ({ award: x.awardLabel?.value || "", year: x.year ? +x.year.value : 0, forw: x.forLabel?.value || "" }))
      .filter((a) => a.award && !/^Q\d+$/.test(a.award));
    const seen = new Set<string>(); const items: Award[] = [];
    rows.forEach((a) => { const k = `${a.award}|${a.year}|${a.forw}`; if (seen.has(k)) return; seen.add(k); items.push(a); });
    awardsCache.set(imdbId, items);
    return items;
  } finally { clearTimeout(to); }
}
