/* Shared types for the watch-history import pipeline. */

export type ImportSource =
  | "letterboxd_zip"
  | "letterboxd_csv"
  | "imdb_csv"
  | "sheet"          // generic CSV/XLSX (incl. Watcha backups)
  | "watcha_text"    // rule-parsed pasted text
  | "freeform_llm";  // LLM-structured pasted text

export type NormalizedRow = {
  /** stable client-side index for round-tripping through match/commit */
  i: number;
  title: string;
  year?: number;
  director?: string;
  /** normalized to 0.5–5 in 0.5 steps */
  rating?: number;
  /** YYYY-MM-DD */
  watched_at?: string;
  note?: string;
  tags?: string[];
  rewatch?: boolean;
  tmdb_id?: number;
  imdb_id?: string;
  to_watchlist?: boolean;
  /** original source row, kept losslessly through to user_watch_log.raw */
  raw: Record<string, unknown>;
};

export type ParseResult = {
  source: ImportSource;
  rows: NormalizedRow[];
  warnings: string[];
};

export type MatchCandidate = {
  tmdb_id: number;
  title: string;
  year: string;
  poster_path: string | null;
};

export type MatchResult = {
  i: number;
  status: "matched" | "ambiguous" | "none";
  match?: MatchCandidate;
  candidates?: MatchCandidate[];
};
