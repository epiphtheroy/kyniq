/* Generic tabular mapper: CSV/XLSX rows → NormalizedRow via header synonyms.
 * Covers the Letterboxd import format, Watcha bookmarklet backups, and
 * arbitrary user spreadsheets (Korean/English headers). */

import type { NormalizedRow } from "./types";
import { inferScale, normalizeRating, parseDate, parseYear } from "./normalize";

type Field =
  | "title" | "title_alt" | "year" | "rating" | "rating10" | "watched" | "logged"
  | "note" | "director" | "imdb" | "tmdb" | "tags" | "rewatch" | "title_type" | "uri";

const SYNONYMS: Record<Field, string[]> = {
  title: ["title", "name", "movie", "film", "제목", "영화", "영화명", "영화제목", "한국어제목", "한국어 제목", "한글제목", "한글 제목"],
  title_alt: ["original title", "english title", "영어제목", "영어 제목", "원제"],
  year: ["year", "년도", "연도", "개봉년도", "개봉연도", "제작년도", "제작연도", "개봉"],
  rating: ["rating", "your rating", "stars", "score", "별점", "평점", "점수", "평가", "내 별점", "나의 별점"],
  rating10: ["rating10"],
  watched: ["watcheddate", "watched date", "관람일", "본날짜", "본 날짜", "시청일", "감상일", "관람일자", "본 일자"],
  logged: ["date", "date rated", "날짜"],
  note: ["review", "note", "notes", "comment", "memo", "리뷰", "메모", "코멘트", "감상", "한줄평", "코멘트 내용"],
  director: ["director", "directors", "감독"],
  imdb: ["const", "tconst", "imdbid", "imdb id", "imdb"],
  tmdb: ["tmdbid", "tmdb id", "tmdb"],
  tags: ["tags", "태그"],
  rewatch: ["rewatch", "재관람"],
  title_type: ["title type"],
  uri: ["letterboxd uri", "uri", "url"],
};

function headerMap(headers: string[]): Partial<Record<Field, string>> {
  const map: Partial<Record<Field, string>> = {};
  const norm = (h: string) => h.toLowerCase().replace(/[_\s]+/g, " ").trim();
  for (const h of headers) {
    const n = norm(h);
    for (const [field, syns] of Object.entries(SYNONYMS) as [Field, string[]][]) {
      if (!map[field] && syns.includes(n)) { map[field] = h; break; }
    }
  }
  return map;
}

const KEEP_TITLE_TYPES = new Set(["movie", "tvmovie", "video", "short", "tvshort", "tvspecial", ""]);

export type SheetMapResult = { rows: NormalizedRow[]; warnings: string[]; matchedFields: string[] };

/** rows: array of objects keyed by original header. */
export function mapSheetRows(records: Record<string, unknown>[], opts?: { forceScale?: 5 | 10 | 100 }): SheetMapResult {
  const warnings: string[] = [];
  if (!records.length) return { rows: [], warnings: ["빈 파일입니다."], matchedFields: [] };
  const map = headerMap(Object.keys(records[0]));
  if (!map.title && !map.title_alt && !map.imdb && !map.tmdb)
    return { rows: [], warnings: ["제목 컬럼을 찾지 못했습니다."], matchedFields: Object.keys(map) };

  const get = (r: Record<string, unknown>, f: Field) => (map[f] != null ? r[map[f]!] : undefined);

  // rating scale: explicit Rating10 column wins; otherwise infer from data
  const ratingVals = records
    .map((r) => parseFloat(String(get(r, "rating") ?? "").replace(/[★☆\s]/g, "")))
    .filter((v) => Number.isFinite(v));
  const scale = opts?.forceScale ?? inferScale(ratingVals);
  if (scale !== 5 && !opts?.forceScale) warnings.push(`별점을 ${scale}점 척도로 감지해 5점 척도로 변환했습니다.`);

  let skippedType = 0;
  const rows: NormalizedRow[] = [];
  for (const r of records) {
    const tt = String(get(r, "title_type") ?? "").toLowerCase().replace(/\s/g, "");
    if (map.title_type && !KEEP_TITLE_TYPES.has(tt)) { skippedType++; continue; }

    const title = String(get(r, "title") ?? get(r, "title_alt") ?? "").trim();
    if (!title) continue;

    const rating10 = get(r, "rating10");
    const rating = rating10 != null && String(rating10).trim() !== ""
      ? normalizeRating(rating10, 10)
      : normalizeRating(get(r, "rating"), scale);

    const imdbRaw = String(get(r, "imdb") ?? "").trim();
    const tmdbRaw = Number(get(r, "tmdb"));
    const tagsRaw = String(get(r, "tags") ?? "").trim();
    const rewatchRaw = String(get(r, "rewatch") ?? "").toLowerCase();
    const altTitle = String(get(r, "title_alt") ?? "").trim();

    rows.push({
      i: rows.length,
      title,
      year: parseYear(get(r, "year")),
      director: String(get(r, "director") ?? "").trim() || undefined,
      rating,
      watched_at: parseDate(get(r, "watched")) ?? parseDate(get(r, "logged")),
      note: String(get(r, "note") ?? "").trim() || undefined,
      tags: tagsRaw ? tagsRaw.split(/[,;]/).map((t) => t.trim()).filter(Boolean) : undefined,
      rewatch: rewatchRaw === "true" || rewatchRaw === "yes" || rewatchRaw === "1" || undefined,
      imdb_id: /^tt\d+$/.test(imdbRaw) ? imdbRaw : undefined,
      tmdb_id: Number.isFinite(tmdbRaw) && tmdbRaw > 0 ? tmdbRaw : undefined,
      raw: { ...r, ...(altTitle && altTitle !== title ? { _alt_title: altTitle } : {}) },
    });
  }
  if (skippedType) warnings.push(`영화가 아닌 항목(시리즈/에피소드 등) ${skippedType}건을 건너뛰었습니다.`);
  return { rows, warnings, matchedFields: Object.keys(map) };
}
