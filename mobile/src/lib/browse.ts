// Browse vocabulary for the Explore tab (HANDOFF §5.3).
// GENRES mirrors the web's lib/wtw_genres.ts exactly (TMDB canonical strings,
// ordered by catalogue frequency) — sent verbatim to the tonight BFF's genres
// param. Keep the two lists in sync; these are data tokens, not UI copy.
export const GENRES: string[] = [
  "Drama",
  "Comedy",
  "Romance",
  "Thriller",
  "Crime",
  "History",
  "Action",
  "War",
  "Documentary",
  "Adventure",
  "Mystery",
  "Fantasy",
  "Horror",
  "Science Fiction",
  "Music",
  "Animation",
  "Family",
  "Western",
];

export type Decade = { label: string; yearMin: number; yearMax: number };

export const DECADES: Decade[] = [
  { label: "1950s", yearMin: 1950, yearMax: 1959 },
  { label: "1960s", yearMin: 1960, yearMax: 1969 },
  { label: "1970s", yearMin: 1970, yearMax: 1979 },
  { label: "1980s", yearMin: 1980, yearMax: 1989 },
  { label: "1990s", yearMin: 1990, yearMax: 1999 },
  { label: "2000s", yearMin: 2000, yearMax: 2009 },
  { label: "2010s", yearMin: 2010, yearMax: 2019 },
  { label: "2020s", yearMin: 2020, yearMax: 2029 },
];
