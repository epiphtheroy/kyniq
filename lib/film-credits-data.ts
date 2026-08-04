import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { CRAFTS, type CraftKey } from "@/app/credits/credits-logic";

/**
 * Film credits data — the relationship engine behind /film/[slug]/credits AND
 * the film page's Credits tab (extracted 2026-07-08 so both surfaces share
 * ONE daily cache entry). For each key crew member (and the top of the bill),
 * counts their films with the director on TMDB's file: which meeting this
 * film was, and how many more followed. Deterministic; no generation.
 */

export const KEY_CRAFTS: CraftKey[] = ["writer", "dp", "editor", "composer", "pd"];
export const ROLE_NOUN: Record<string, string> = {
  writer: "writer", dp: "cinematographer", editor: "editor", composer: "composer", pd: "production designer",
};
export const CRAFT_VERBED: Record<string, string> = {
  writer: "written", dp: "shot", editor: "cut", composer: "scored", pd: "designed",
};

export const ordinal = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  const u = n % 10;
  return `${n}${u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"}`;
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// null means TMDB genuinely has no such record (404). EVERYTHING else throws.
// The caller turns null into notFound(), and this page caches for 24h, so
// collapsing a rate-limit or a missing env var into "no such film" removes a live
// URL from Google for a day on someone else's bad afternoon.
async function tm<T>(path: string): Promise<T | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new Error("TMDB_READ_TOKEN is not set");
  const v4 = token.length > 40;
  const url = `https://api.themoviedb.org/3${path}${v4 ? "" : `${path.includes("?") ? "&" : "?"}api_key=${token}`}`;
  const r = await fetch(url, {
    headers: v4 ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" },
    next: { revalidate: 86400 },
  }).catch(() => null);
  if (!r) throw new Error(`TMDB ${path}: network failure`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`TMDB ${path}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

type TmMovie = {
  id: number; title: string;
  production_companies?: { id: number; name: string; origin_country?: string }[];
  credits?: {
    crew?: { id: number; name: string; job?: string; department?: string; profile_path?: string | null }[];
    cast?: { id: number; name: string; character?: string; order?: number; profile_path?: string | null }[];
  };
};
type TmPersonCredits = {
  crew?: { id: number; title?: string; release_date?: string; job?: string }[];
  cast?: { id: number; title?: string; release_date?: string }[];
};

export type SharedFilm = { id: number; title: string; year: number };
export type Relation = {
  personId: number; name: string; roleKey: CraftKey | "actor"; role: string;
  shared: SharedFilm[]; idx: number; // index of THIS film in shared (-1 if absent)
  careerCount: number; careerFirst: number; // their whole run in this craft (TMDB)
  profile: string | null;
};

const yearOf = (d?: string) => Number((d || "").slice(0, 4)) || 0;

async function relationWithDirector(
  person: { id: number; name: string; profile_path?: string | null }, roleKey: CraftKey | "actor",
  directedIds: Map<number, { title: string; year: number }>, thisId: number,
): Promise<Relation | null> {
  const pc = await tm<TmPersonCredits>(`/person/${person.id}/movie_credits`);
  if (!pc) return null;
  const mine = new Map<number, { title: string; year: number }>();
  if (roleKey === "actor") {
    for (const c of pc.cast ?? []) mine.set(c.id, { title: c.title ?? `#${c.id}`, year: yearOf(c.release_date) });
  } else {
    const cf = CRAFTS[roleKey];
    for (const c of pc.crew ?? []) {
      if (c.job && cf.jobs.has(c.job)) mine.set(c.id, { title: c.title ?? `#${c.id}`, year: yearOf(c.release_date) });
    }
  }
  const shared: SharedFilm[] = [];
  for (const [fid, meta] of mine) {
    if (directedIds.has(fid)) shared.push({ id: fid, title: meta.title, year: meta.year });
  }
  shared.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
  const idx = shared.findIndex((f) => f.id === thisId);
  const careerYears = [...mine.values()].map((m) => m.year).filter((y) => y > 1880);
  return {
    personId: person.id, name: person.name, roleKey,
    role: roleKey === "actor" ? "actor" : ROLE_NOUN[roleKey], shared, idx,
    careerCount: mine.size, careerFirst: careerYears.length ? Math.min(...careerYears) : 0,
    profile: person.profile_path ?? null,
  };
}

async function loadUncached(slug: string) {
  const supabase = db();
  const { data: film, error } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, tmdb_id, poster_path, backdrop_path, visible")
    .eq("slug", slug)
    .maybeSingle<{ id: string; title: string; slug: string; year: number | null; director: string | null; director_slug: string | null; tmdb_id: number | null; poster_path: string | null; backdrop_path: string | null; visible: boolean | null }>();
  if (error) throw new Error(`films(${slug}): ${error.message}`);
  if (!film || !film.tmdb_id) return null;

  const [movie, { data: vidRows }] = await Promise.all([
    tm<TmMovie>(`/movie/${film.tmdb_id}?append_to_response=credits`),
    supabase.from("media").select("external_id, title").eq("entity_type", "film").eq("entity_id", film.id)
      .eq("status", "published").eq("kind", "video").order("position"),
  ]);
  if (!movie) return null;

  const crewAll = movie.credits?.crew ?? [];
  const directorEntry = crewAll.find((c) => c.job === "Director") ?? null;

  // Key crew, one group per craft (up to 2 names each — the signing crafts).
  const crew: { craft: CraftKey; people: { id: number; name: string; profile_path: string | null }[] }[] = [];
  for (const key of KEY_CRAFTS) {
    const cf = CRAFTS[key];
    const seen = new Map<number, { id: number; name: string; profile_path: string | null }>();
    for (const c of crewAll) {
      if (c.job && cf.jobs.has(c.job) && c.department && cf.depts.includes(c.department)) seen.set(c.id, { id: c.id, name: c.name, profile_path: c.profile_path ?? null });
    }
    if (seen.size) crew.push({ craft: key, people: [...seen.values()].slice(0, 2) });
  }
  const topCast = [...(movie.credits?.cast ?? [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).slice(0, 5)
    .map((c) => ({ id: c.id, name: c.name, character: c.character ?? null, profile_path: c.profile_path ?? null }));

  // Relationship engine — director's directed set, then each person's overlap.
  let directorFilmog: SharedFilm[] = [];
  const relations: Relation[] = [];
  if (directorEntry) {
    const dc = await tm<TmPersonCredits>(`/person/${directorEntry.id}/movie_credits`);
    const directed = new Map<number, { title: string; year: number }>();
    for (const c of dc?.crew ?? []) {
      if (c.job === "Director") directed.set(c.id, { title: c.title ?? `#${c.id}`, year: yearOf(c.release_date) });
    }
    directorFilmog = [...directed.entries()].map(([id, m]) => ({ id, ...m })).filter((f) => f.year > 1880)
      .sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
    const subjects: { p: { id: number; name: string; profile_path?: string | null }; roleKey: CraftKey | "actor" }[] = [];
    for (const g of crew) for (const p of g.people.slice(0, 1)) if (p.id !== directorEntry.id) subjects.push({ p, roleKey: g.craft });
    for (const c of topCast.slice(0, 3)) if (c.id !== directorEntry.id) subjects.push({ p: c, roleKey: "actor" });
    const settled = await Promise.all(subjects.map((s) => relationWithDirector(s.p, s.roleKey, directed, film.tmdb_id!).catch(() => null)));
    for (const r of settled) if (r) relations.push(r);
  }

  // Catalog links for every film mentioned in a sentence.
  const mentioned = new Set<number>([film.tmdb_id]);
  for (const r of relations) for (const f of r.shared) mentioned.add(f.id);
  for (const f of directorFilmog.slice(0, 1)) mentioned.add(f.id);
  for (const f of directorFilmog.slice(-1)) mentioned.add(f.id);
  const slugByTmdb = new Map<number, string>();
  const ids = [...mentioned];
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from("films").select("tmdb_id, slug").in("tmdb_id", ids.slice(i, i + 150));
    for (const row of (data ?? []) as { tmdb_id: number; slug: string }[]) slugByTmdb.set(row.tmdb_id, row.slug);
  }

  const vids = ((vidRows ?? []) as { external_id: string | null; title: string | null }[]).filter((v) => v.external_id);
  const isTrailerTitle = (t: string | null) => !!t && /trailer|teaser/i.test(t);
  const videos = [...vids.filter((v) => !isTrailerTitle(v.title)), ...vids.filter((v) => isTrailerTitle(v.title))]
    .map((v) => ({ id: v.external_id as string, title: v.title ?? "" }));

  return {
    film: { title: film.title, slug: film.slug, year: film.year, director: film.director, director_slug: film.director_slug, tmdb_id: film.tmdb_id, backdrop_path: film.backdrop_path, visible: film.visible },
    director: directorEntry ? { id: directorEntry.id, name: directorEntry.name, profile: directorEntry.profile_path ?? null } : null,
    directorFilmog,
    crew,
    topCast,
    companies: (movie.production_companies ?? []).slice(0, 8),
    relations,
    videos,
    slugByTmdb: [...slugByTmdb.entries()] as [number, string][],
  };
}

export type FilmCreditsPayload = NonNullable<Awaited<ReturnType<typeof loadUncached>>>;

// Key history: page-2 = photos + career stats + 0-shared relations kept.
// Shared by /film/[slug]/credits and the film page's Credits tab.
export function filmCreditsData(slug: string): Promise<FilmCreditsPayload | null> {
  return unstable_cache(() => loadUncached(slug), ["film-credits-page-2", slug], {
    revalidate: 86400,
    tags: [`film:${slug}`],
  })();
}
