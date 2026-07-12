// wtw_library.ts — the two US public-/university-library streaming services that
// What to Watch ("The Marquee") can fold into results via the "US library card"
// toggle. Both are kind=free in film_provider_index; a participating library card
// unlocks them at no cost. IDs verified against film_provider_index (US) 2026-07-13:
//   Kanopy  provider_id 191 (1,392 US films)
//   Hoopla  provider_id 212 (833 US films)
// These are TMDB/JustWatch provider ids and are stable. Kept here (not inlined) so
// the SQL union (0094) and the client badge classifier agree on one source.

export const KANOPY_ID = 191;
export const HOOPLA_ID = 212;
export const US_LIBRARY_IDS: number[] = [KANOPY_ID, HOOPLA_ID];

/** True when a provider_id is one of the US library services (Kanopy/Hoopla). */
export function isLibraryProvider(providerId: number): boolean {
  return US_LIBRARY_IDS.includes(providerId);
}
