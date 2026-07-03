import { unstable_cache } from "next/cache";
import { CRAFTS, type CraftKey } from "@/app/credits/credits-logic";

/**
 * Key-craft crew for one film, from TMDB — the crawlable data behind the film
 * page's Credits block and the director page's repertory-company block.
 * Cached 24h under ["film-crew", tmdbId] (shared by every consumer).
 */
export const CREW_KEYS: CraftKey[] = ["writer", "dp", "editor", "composer", "pd"];
export type FilmCrew = { craft: CraftKey; people: { id: number; name: string }[] }[];

export function filmKeyCrew(tmdbId: number): Promise<FilmCrew> {
  return unstable_cache(
    async () => {
      const token = process.env.TMDB_READ_TOKEN;
      if (!token) return [];
      const v4 = token.length > 40;
      const r = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}/credits${v4 ? "" : `?api_key=${token}`}`,
        { headers: v4 ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" } },
      ).catch(() => null);
      if (!r || !r.ok) return [];
      const d = (await r.json()) as { crew?: { id: number; name: string; job?: string; department?: string }[] };
      const out: FilmCrew = [];
      for (const key of CREW_KEYS) {
        const cf = CRAFTS[key];
        const seen = new Map<number, { id: number; name: string }>();
        for (const c of d.crew ?? []) {
          if (c.job && cf.jobs.has(c.job) && c.department && cf.depts.includes(c.department)) seen.set(c.id, { id: c.id, name: c.name });
        }
        if (seen.size) out.push({ craft: key, people: [...seen.values()].slice(0, 4) });
      }
      return out;
    },
    ["film-crew", String(tmdbId)],
    { revalidate: 86400 },
  )();
}

/**
 * A director's repertory company — key-craft people who recur (≥2 films)
 * across the given films, tallied from the per-film cached crew.
 */
export async function directorRepertory(tmdbIds: number[]): Promise<{ id: number; name: string; craft: CraftKey; n: number }[]> {
  const crews = await Promise.all(tmdbIds.slice(0, 40).map((id) => filmKeyCrew(id).catch(() => [] as FilmCrew)));
  const tally = new Map<string, { id: number; name: string; craft: CraftKey; n: number }>();
  for (const crew of crews) {
    for (const grp of crew) {
      for (const p of grp.people) {
        const k = `${p.id}:${grp.craft}`;
        const cur = tally.get(k) ?? { id: p.id, name: p.name, craft: grp.craft, n: 0 };
        cur.n += 1;
        tally.set(k, cur);
      }
    }
  }
  // One row per person (their most-repeated craft), recurring only.
  const byPerson = new Map<number, { id: number; name: string; craft: CraftKey; n: number }>();
  for (const row of tally.values()) {
    const cur = byPerson.get(row.id);
    if (!cur || row.n > cur.n) byPerson.set(row.id, row);
  }
  return [...byPerson.values()].filter((r) => r.n >= 2).sort((a, b) => b.n - a.n);
}
