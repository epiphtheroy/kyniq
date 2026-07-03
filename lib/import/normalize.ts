/* Normalization helpers: rating scales, dates, titles. */

/** Lowercase, strip punctuation/whitespace — for title equality checks. */
export function normTitle(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’“”'"’‘“”:;,.!?·\-–—_()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasKorean(s: string): boolean {
  return /[가-힣]/.test(s);
}

/** Round to nearest 0.5 and clamp to the user_movies CHECK (0.5–5). */
export function toHalfStep(v: number): number | undefined {
  if (!Number.isFinite(v) || v <= 0) return undefined;
  const r = Math.round(v * 2) / 2;
  return Math.min(5, Math.max(0.5, r));
}

/** Convert a raw rating to 0.5–5 given a source scale (5 | 10 | 100). */
export function normalizeRating(v: unknown, scale: 5 | 10 | 100 = 5): number | undefined {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[★☆\s]/g, ""));
  if (!Number.isFinite(n)) return undefined;
  return toHalfStep((n * 5) / scale);
}

/** Infer the rating scale from all raw values in a batch. */
export function inferScale(values: number[]): 5 | 10 | 100 {
  const max = Math.max(0, ...values.filter((v) => Number.isFinite(v)));
  if (max > 10) return 100;
  if (max > 5) return 10;
  return 5;
}

/** Parse many date shapes into YYYY-MM-DD (returns undefined when hopeless). */
export function parseDate(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  // 2023-01-02 / 2023.01.02 / 2023/1/2
  let m = s.match(/^(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // 02/01/2023 or 1.2.2023 → assume D/M/Y is rare in our sources; treat as M/D/Y
  m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return undefined;
}

export function parseYear(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return v.getFullYear();
  const m = String(v).match(/(18|19|20)\d{2}/);
  if (!m) return undefined;
  const y = Number(m[0]);
  return y >= 1880 && y <= new Date().getFullYear() + 2 ? y : undefined;
}
