import crewIndex from "@/lib/crew_index.json";

/**
 * Who actually has a /credits/[person] page.
 *
 * The roster is lib/crew_index.json — built 2026-07-12 by scanning 1,958 films
 * with min_films: 3, i.e. everyone credited on three or more films in OUR
 * catalogue as writer, DP, editor, composer or production designer. 1,072 people.
 * It is the same list creditsEntries() advertises in the sitemap, so "has a page"
 * and "is advertised" are now one predicate instead of two that drifted.
 *
 * Why this gate exists (measured 2026-08-03): /credits/[person] parsed the TMDB id
 * off the end of the slug and called the TMDB API for ANY id, with no local table
 * behind it. Every crew member of every film was therefore a live, unbounded URL —
 * 27,895 requests/day, 25.7% of all function volume, swept by a rotating
 * residential proxy network that no rate limit or blocklist can reach.
 *
 * Nothing is lost by closing it. A sample of off-roster pages inspected through the
 * Search Console API came back "URL is unknown to Google", lastCrawlTime never:
 * they are not in any sitemap, have never been crawled, and have never earned an
 * impression. This is a load fix, not an SEO one — Google does not reallocate crawl
 * budget to the survivors, and expecting it to would be a misreading.
 *
 * Server-only: this pulls a 62 KB JSON, so never import it from a "use client"
 * module. The interactive explorer (app/credits/CreditsExplorer.tsx) searches TMDB
 * directly and is deliberately left alone — its links are client-rendered, so no
 * crawler ever sees them and they cost nothing.
 */
const CREW_IDS: ReadonlySet<number> = new Set(
  (crewIndex as unknown as { people: { id: number }[] }).people.map((p) => p.id),
);

export function hasCrewPage(id: number | null | undefined): boolean {
  return typeof id === "number" && CREW_IDS.has(id);
}

export const CREW_ROSTER_SIZE = CREW_IDS.size;
