/**
 * Single source of truth for public entity URL paths.
 *
 * New code must build entity URLs through these helpers (never inline
 * template strings) so that renaming a route is ONE edit here plus
 * slug_aliases inserts for the redirects — not a repo-wide grep hunt.
 * Each helper is a pure function returning the RELATIVE path; callers
 * prepend the site origin where an absolute URL is required.
 */

export const filmUrl = (slug: string) => `/film/${slug}`;
export const figureUrl = (filmSlug: string, figureSlug: string) => `/film/${filmSlug}/figure/${figureSlug}`;
export const questionUrl = (filmSlug: string, qSlug: string) => `/film/${filmSlug}/q/${qSlug}`;
export const takeUrl = (slug: string) => `/take/${slug}`;
export const tropeUrl = (slug: string) => `/trope/${slug}`;
export const directorUrl = (slug: string) => `/director/${slug}`;
export const directorLifeUrl = (slug: string) => `/director/${slug}/life`;
export const creditsPersonUrl = (personSlug: string) => `/credits/${personSlug}`;
export const moviesLikeUrl = (slug: string) => `/movies-like/${slug}`;
export const whereToUrl = (slug: string) => `/whereto/${slug}`;
export const conceptUrl = (slug: string) => `/concept/${slug}`;
export const theoristUrl = (slug: string) => `/theorist/${slug}`;
export const genreUrl = (slug: string) => `/genre/${slug}`;
export const lineageUrl = (slug: string) => `/lineage/${slug}`;

// Per-film sub-surfaces (the long-tail read layers that funnel back to the
// film's main page). Some live under /film/[slug]/*, others in their own route
// trees — this is the single place that spelling is fixed.
export const receptionUrl = (filmSlug: string) => `/film/${filmSlug}/reception`;
export const misreadingsFilmUrl = (filmSlug: string) => `/film/meaning/${filmSlug}`;
export const filmLocationsUrl = (filmSlug: string) => `/film/locations/${filmSlug}`;
export const filmLineageUrl = (filmSlug: string) => `/film/lineage/${filmSlug}`;
export const takescoreFilmUrl = (filmSlug: string) => `/takescore/film/${filmSlug}`;
export const filmCreditsUrl = (filmSlug: string) => `/film/${filmSlug}/credits`;
export const filmGalleryUrl = (filmSlug: string) => `/film/${filmSlug}/gallery`;
export const tvUrl = (slug: string) => `/tv/${slug}`;
