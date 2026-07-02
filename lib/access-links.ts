/**
 * access-links — pure URL builders for the Where-to-Watch enrichment layer (L2 disc / L3 subtitles).
 * DOC_0 §2.2: subtitles = SEARCH-RESULT page links only (never deep links to files);
 * disc = plain text search links, no affiliate tags, no prices (no PA-API).
 * Country codes are ISO 3166-1 alpha-2 / TMDB standard (the UK is GB internally).
 */

/** JustWatch URL paths use lowercase ISO codes EXCEPT the UK, where the path segment is "uk". */
export const JW_PATH_EXCEPTIONS: Record<string, string> = { GB: "uk" };

export function jwLocale(cc: string): string | null {
  if (!cc || cc.length !== 2) return null;
  return JW_PATH_EXCEPTIONS[cc] || cc.toLowerCase();
}

export function justwatchUrl(cc?: string | null, slug?: string | null): string {
  const loc = cc ? jwLocale(cc) : null;
  if (slug && loc) return `https://www.justwatch.com/${loc}/movie/${slug}`;
  return "https://www.justwatch.com/";
}

/** Amazon storefront per country — plain search links only (no affiliate tag, no prices). */
export const AMAZON_DOMAINS: Record<string, string> = {
  US: "amazon.com", GB: "amazon.co.uk", CA: "amazon.ca", AU: "amazon.com.au",
  FR: "amazon.fr", DE: "amazon.de", JP: "amazon.co.jp", IN: "amazon.in", BR: "amazon.com.br",
};

export function amazonDiscSearchUrl(cc: string, title: string, year: number | null, format: "blu-ray" | "dvd" | "4k"): string | null {
  const dom = AMAZON_DOMAINS[cc];
  if (!dom) return null;
  const q = [title, year ? String(year) : "", format === "4k" ? "4k uhd" : format].filter(Boolean).join(" ");
  return `https://www.${dom}/s?k=${encodeURIComponent(q)}`;
}

export function criterionSearchUrl(title: string): string {
  return `https://www.criterion.com/search?q=${encodeURIComponent(title)}`;
}

/** OpenSubtitles search-results page. Prefers imdb_id (exact), falls back to a title search. */
export function openSubtitlesSearchUrl(opts: { imdbId?: string | null; title: string; lang?: "eng" | "all" }): string {
  const lang = opts.lang === "all" ? "all" : "eng";
  const imdb = opts.imdbId ? opts.imdbId.replace(/^tt/, "") : null;
  if (imdb) return `https://www.opensubtitles.org/en/search/sublanguageid-${lang}/imdbid-${imdb}`;
  return `https://www.opensubtitles.org/en/search2/sublanguageid-${lang}/moviename-${encodeURIComponent(opts.title)}`;
}

export function subdlSearchUrl(title: string): string {
  return `https://subdl.com/search/${encodeURIComponent(title)}`;
}

export function podnapisiSearchUrl(title: string, year?: number | null): string {
  return `https://www.podnapisi.net/subtitles/search/?keywords=${encodeURIComponent(title)}${year ? `&year=${year}` : ""}`;
}
