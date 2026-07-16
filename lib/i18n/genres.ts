/** TMDB genre names, per locale.
 *  (정본: HANDOFF-KO프로젝션-한국어사이트.md §2.4)
 *
 *  Genres are a closed set of 19 that TMDB itself translates, so they are code,
 *  not a DB column: the map below was fetched from
 *  GET /genre/movie/list?language={loc} and is TMDB's official naming, not our
 *  translation. Verified 2026-07-16 against prod: the 19 English keys are
 *  exactly the 19 distinct values in films.genres, so every stored genre hits.
 *
 *  Adding a language = one more entry here from the same endpoint (§-2.2 step 3).
 */

import { DEFAULT_LOCALE, type Locale } from "./locales";

const KO_GENRES: Record<string, string> = {
  Action: "액션", // 28
  Adventure: "모험", // 12
  Animation: "애니메이션", // 16
  Comedy: "코미디", // 35
  Crime: "범죄", // 80
  Documentary: "다큐멘터리", // 99
  Drama: "드라마", // 18
  Family: "가족", // 10751
  Fantasy: "판타지", // 14
  History: "역사", // 36
  Horror: "공포", // 27
  Music: "음악", // 10402
  Mystery: "미스터리", // 9648
  Romance: "로맨스", // 10749
  "Science Fiction": "SF", // 878
  "TV Movie": "TV 영화", // 10770
  Thriller: "스릴러", // 53
  War: "전쟁", // 10752
  Western: "서부", // 37
};

const GENRES: Partial<Record<Locale, Record<string, string>>> = { ko: KO_GENRES };

/** genreName — a TMDB genre in `locale`, falling back to the English name (P2).
 *  Unknown genres (should TMDB add one) pass through untouched rather than
 *  vanishing from the page. */
export function genreName(en: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return en;
  return GENRES[locale]?.[en] ?? en;
}

/** Coverage for scripts/i18n-audit.mjs — which genres a locale still lacks. */
export function genreGaps(locale: Locale): string[] {
  if (locale === DEFAULT_LOCALE) return [];
  const map = GENRES[locale];
  if (!map) return Object.keys(KO_GENRES);
  return Object.keys(KO_GENRES).filter((k) => !map[k]);
}
