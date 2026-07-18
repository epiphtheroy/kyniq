/* Format detection + parsing: ZIP (Letterboxd export), XLSX, CSV, pasted text.
 * Everything funnels into NormalizedRow[] (see types.ts). */

import JSZip from "jszip";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ImportSource, NormalizedRow, ParseResult } from "./types";
import { mapSheetRows } from "./sheet";
import { normalizeRating, parseDate, parseYear } from "./normalize";

function parseCsv(text: string): Record<string, unknown>[] {
  const res = Papa.parse<Record<string, unknown>>(text.replace(/^﻿/, ""), {
    header: true, skipEmptyLines: true, transformHeader: (h) => h.trim(),
  });
  return res.data;
}

function csvSource(headers: string[]): ImportSource {
  const h = headers.map((x) => x.toLowerCase().trim());
  if (h.includes("const") && h.some((x) => x === "your rating")) return "imdb_csv";
  if (h.includes("letterboxd uri")) return "letterboxd_csv";
  // Netflix viewing-history: exactly the two columns Title,Date
  if (h.length === 2 && h.includes("title") && h.includes("date")) return "netflix_csv";
  return "sheet";
}

/* ---------- Netflix viewing-history CSV (HANDOFF-커넥트-기록이관.md §1/§3) ---------- */

// Episode rows carry colon-separated season/episode segments; films are bare titles.
const NFX_SEASON_RE = /:\s*(Season|Part|Series|시즌|파트)\s*\d+/i;
const NFX_CHAPTER_RE = /:\s*(Chapter|Episode|에피소드)/i;
const NFX_SEASONISH_RE = /\b(Season|Part|Series|Volume|Chapter|Episode)\b|시즌|파트|에피소드/i;

function isNetflixEpisode(title: string): boolean {
  if (NFX_SEASON_RE.test(title) || NFX_CHAPTER_RE.test(title)) return true;
  // ≥2 ": " segments with a Season-like middle (e.g. "Show: Limited Series: Pilot").
  // Conservative: when unsure keep the row — unmatched titles surface honestly downstream.
  const segs = title.split(": ");
  return segs.length >= 3 && segs.slice(1, -1).some((s) => NFX_SEASONISH_RE.test(s));
}

function parseNetflixCsv(records: Record<string, unknown>[]): ParseResult {
  const keys = Object.keys(records[0] ?? {});
  const titleKey = keys.find((k) => k.trim().toLowerCase() === "title") ?? "Title";
  const dateKey = keys.find((k) => k.trim().toLowerCase() === "date") ?? "Date";

  // M/D/YY vs D/M/YY is a per-FILE property: any first component >12 ⇒ D/M/YY.
  const DATE_RE = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})$/;
  let dayFirst = false;
  for (const r of records) {
    const m = String(r[dateKey] ?? "").trim().match(DATE_RE);
    if (m && Number(m[1]) > 12) { dayFirst = true; break; }
  }
  const toIso = (v: unknown): string | undefined => {
    const m = String(v ?? "").trim().match(DATE_RE);
    if (!m) return parseDate(v); // odd shapes (e.g. YYYY-MM-DD) — best effort
    const [month, day] = dayFirst ? [Number(m[2]), Number(m[1])] : [Number(m[1]), Number(m[2])];
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); // two-digit years → 20xx
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  let skippedEpisodes = 0;
  const rows: NormalizedRow[] = [];
  for (const r of records) {
    const title = String(r[titleKey] ?? "").trim();
    if (!title) continue;
    if (isNetflixEpisode(title)) { skippedEpisodes++; continue; }
    // No year, no rating (Netflix exports neither); raw keeps the original line's fields.
    rows.push({ i: rows.length, title, watched_at: toIso(r[dateKey]), raw: { ...r } });
  }
  const warnings: string[] = [];
  if (skippedEpisodes) warnings.push(`${skippedEpisodes} series episodes skipped`);
  return { source: "netflix_csv", rows, warnings };
}

/* ---------- Letterboxd export ZIP ---------- */

type LbEntry = Record<string, unknown>;
const lbKey = (r: LbEntry) => `${String(r["Name"] ?? "").toLowerCase()}|${r["Year"] ?? ""}`;

async function parseLetterboxdZip(buf: Buffer): Promise<ParseResult> {
  const zip = await JSZip.loadAsync(buf);
  const read = async (name: string): Promise<LbEntry[]> => {
    const f = zip.file(new RegExp(`(^|/)${name}$`))[0];
    return f ? parseCsv(await f.async("string")) : [];
  };
  const [watched, ratings, diary, reviews, watchlist] = await Promise.all([
    read("watched.csv"), read("ratings.csv"), read("diary.csv"), read("reviews.csv"), read("watchlist.csv"),
  ]);
  const warnings: string[] = [];
  if (!watched.length && !diary.length && !ratings.length && !watchlist.length)
    return { source: "letterboxd_zip", rows: [], warnings: ["ZIP에서 Letterboxd CSV를 찾지 못했습니다."] };

  const ratingByFilm = new Map(ratings.map((r) => [lbKey(r), normalizeRating(r["Rating"], 5)]));
  const reviewByEntry = new Map(reviews.map((r) => [`${lbKey(r)}|${parseDate(r["Watched Date"]) ?? ""}`, r]));

  const rows: NormalizedRow[] = [];
  const push = (p: Omit<NormalizedRow, "i">) => rows.push({ ...p, i: rows.length });
  const diaryFilms = new Set<string>();

  for (const d of diary) {
    const key = lbKey(d);
    diaryFilms.add(key);
    const wdate = parseDate(d["Watched Date"]);
    const review = reviewByEntry.get(`${key}|${wdate ?? ""}`);
    const tags = String(d["Tags"] ?? "").trim();
    push({
      title: String(d["Name"] ?? "").trim(),
      year: parseYear(d["Year"]),
      rating: normalizeRating(d["Rating"], 5) ?? ratingByFilm.get(key),
      watched_at: wdate,
      note: review ? String(review["Review"] ?? "").trim() || undefined : undefined,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      rewatch: String(d["Rewatch"] ?? "").toLowerCase() === "yes" || undefined,
      raw: review ? { ...d, _review: review } : { ...d },
    });
  }
  // watched films that never appear in the diary (no dated entries)
  for (const w of watched) {
    const key = lbKey(w);
    if (diaryFilms.has(key)) continue;
    push({
      title: String(w["Name"] ?? "").trim(),
      year: parseYear(w["Year"]),
      rating: ratingByFilm.get(key),
      watched_at: parseDate(w["Date"]), // date marked watched — best available proxy
      raw: { ...w },
    });
  }
  for (const w of watchlist) {
    push({
      title: String(w["Name"] ?? "").trim(),
      year: parseYear(w["Year"]),
      to_watchlist: true,
      raw: { ...w },
    });
  }
  if (watchlist.length) warnings.push(`왓치리스트 ${watchlist.length}편 포함(관람 기록과 별도 표시).`);
  return { source: "letterboxd_zip", rows: rows.filter((r) => r.title), warnings };
}

/* ---------- Watcha-style pasted text (rule-based) ---------- */

const STAR_RE = /(?:★|⭐|별점|평가함)\s*:?\s*([0-5](?:\.\d)?)/;
const INLINE_RE = /^(.{1,80}?)\s*[(（]((?:18|19|20)\d{2})[)）]\s*(?:[·,-]\s*)?(?:★|⭐)?\s*([0-5](?:\.\d)?)?\s*$/;

export function parseWatchaText(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const rows: NormalizedRow[] = [];
  const skipRe = /^(평가함|보고싶어요|보는중|영화|시리즈|책|웹툰|더보기|평균|개)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || skipRe.test(line)) continue;

    // one-line form: "Title (2019) ★4.5" / "Title (2019) · 4.0"
    const m = line.match(INLINE_RE);
    if (m) {
      rows.push({
        i: rows.length, title: m[1].trim(), year: Number(m[2]),
        rating: m[3] ? normalizeRating(m[3], 5) : undefined, raw: { line },
      });
      continue;
    }
    // multi-line form: title line, then metadata line(s) with year and/or ★rating
    const isTitle = !STAR_RE.test(line) && !/^(19|20)\d{2}([^0-9]|$)/.test(line) && line.length <= 80;
    if (!isTitle) continue;
    let year: number | undefined; let rating: number | undefined; let consumed = 0;
    for (let j = 1; j <= 2 && i + j < lines.length; j++) {
      const nxt = lines[i + j];
      if (!nxt) break;
      const y = !year ? parseYear(nxt) : undefined;
      const s = nxt.match(STAR_RE);
      if (y || s) {
        if (y) year = y;
        if (s) rating = normalizeRating(s[1], 5);
        consumed = j;
      } else break;
    }
    if (consumed > 0) {
      rows.push({ i: rows.length, title: line, year, rating, raw: { lines: lines.slice(i, i + consumed + 1) } });
      i += consumed;
    }
  }
  return { source: "watcha_text", rows, warnings: [] };
}

/* ---------- entry points ---------- */

export async function parseFile(filename: string, buf: Buffer): Promise<ParseResult> {
  const lower = filename.toLowerCase();
  const isZip = lower.endsWith(".zip") || (buf[0] === 0x50 && buf[1] === 0x4b);
  if (isZip) return parseLetterboxdZip(buf);

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const { rows, warnings } = mapSheetRows(records);
    return { source: "sheet", rows, warnings };
  }

  // CSV / TSV / plain text files
  let text = buf.toString("utf-8");
  // IMDb exports have shipped as windows-1252: when utf-8 decoding mangles
  // high bytes (U+FFFD) on an IMDb-shaped header, re-decode as latin1.
  if (text.includes("\uFFFD")) {
    const latin = buf.toString("latin1");
    const header = (latin.split(/\r?\n/, 1)[0] ?? "").toLowerCase();
    if (header.includes("const") && header.includes("your rating")) text = latin;
  }
  return parseText(text, lower.endsWith(".csv") || lower.endsWith(".tsv"));
}

/** Pasted text or CSV body. Returns rows; caller decides on LLM fallback. */
export async function parseText(text: string, preferCsv = false): Promise<ParseResult> {
  const firstLine = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const looksCsv = preferCsv
    || (firstLine.split(",").length >= 3 && !STAR_RE.test(firstLine))
    || /^"?title"?\s*,\s*"?date"?\s*$/i.test(firstLine.trim()); // pasted Netflix history
  if (looksCsv) {
    const records = parseCsv(text);
    if (records.length) {
      const headers = Object.keys(records[0]);
      const source = csvSource(headers);
      if (source === "netflix_csv") return parseNetflixCsv(records);
      const { rows, warnings, matchedFields } = mapSheetRows(records, source === "imdb_csv" ? { forceScale: 10 } : undefined);
      // header mapping worked → it's a real table
      if (rows.length && matchedFields.includes("title")) return { source, rows, warnings };
    }
  }
  return parseWatchaText(text);
}
