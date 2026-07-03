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
  return "sheet";
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
  const text = buf.toString("utf-8");
  return parseText(text, lower.endsWith(".csv") || lower.endsWith(".tsv"));
}

/** Pasted text or CSV body. Returns rows; caller decides on LLM fallback. */
export async function parseText(text: string, preferCsv = false): Promise<ParseResult> {
  const firstLine = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const looksCsv = preferCsv || (firstLine.split(",").length >= 3 && !STAR_RE.test(firstLine));
  if (looksCsv) {
    const records = parseCsv(text);
    if (records.length) {
      const headers = Object.keys(records[0]);
      const source = csvSource(headers);
      const { rows, warnings, matchedFields } = mapSheetRows(records, source === "imdb_csv" ? { forceScale: 10 } : undefined);
      // header mapping worked → it's a real table
      if (rows.length && matchedFields.includes("title")) return { source, rows, warnings };
    }
  }
  return parseWatchaText(text);
}
