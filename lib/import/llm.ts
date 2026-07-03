/* LLM fallback: structure freeform pasted text into NormalizedRow[]
 * using the existing Gemini adapter (cheap flash model, JSON mode). */

import { geminiAdapter } from "@/lib/providers/gemini";
import type { NormalizedRow, ParseResult } from "./types";
import { inferScale, normalizeRating, parseDate, parseYear } from "./normalize";

const MODEL = "gemini-2.5-flash";
const CHUNK = 9000;   // chars per call
const MAX_TEXT = 120000;

const SYSTEM = `You extract movie viewing records from arbitrary user text (Korean or English), e.g. text copied from Watcha Pedia, KinoLights, Naver, blogs, or personal notes.
Return ONLY a JSON array. Each element: {"title": string, "year": number|null, "rating": number|null, "rating_scale": 5|10|100|null, "watched_date": "YYYY-MM-DD"|null, "note": string|null}.
Rules: title is required — skip fragments that are clearly not film titles (UI labels, counts, navigation). rating is the raw number as written; report its scale. note = any personal comment/review attached to that film. Do not invent data. Do not wrap in markdown.`;

type LlmRec = { title?: unknown; year?: unknown; rating?: unknown; rating_scale?: unknown; watched_date?: unknown; note?: unknown };

export async function parseWithLlm(text: string): Promise<ParseResult> {
  const trimmed = text.slice(0, MAX_TEXT);
  const chunks: string[] = [];
  for (let p = 0; p < trimmed.length; p += CHUNK) chunks.push(trimmed.slice(p, p + CHUNK));

  const rows: NormalizedRow[] = [];
  const warnings: string[] = [];
  if (text.length > MAX_TEXT) warnings.push("텍스트가 너무 길어 앞부분 12만 자만 처리했습니다.");

  for (const chunk of chunks) {
    try {
      const res = await geminiAdapter.call(MODEL, chunk, {
        systemPrompt: SYSTEM, temperature: 0, maxTokens: 8192, jsonMode: true,
      });
      const body = res.text.trim().replace(/^```(?:json)?/, "").replace(/```$/, "");
      const arr = JSON.parse(body) as LlmRec[];
      if (!Array.isArray(arr)) continue;
      const scales = arr.map((r) => Number(r.rating_scale)).filter((v) => v === 5 || v === 10 || v === 100);
      const fallbackScale = inferScale(arr.map((r) => Number(r.rating)).filter(Number.isFinite));
      for (const r of arr) {
        const title = String(r.title ?? "").trim();
        if (!title) continue;
        const scale = (Number(r.rating_scale) as 5 | 10 | 100) || scales[0] || fallbackScale;
        rows.push({
          i: rows.length,
          title,
          year: parseYear(r.year),
          rating: normalizeRating(r.rating, scale),
          watched_at: parseDate(r.watched_date),
          note: String(r.note ?? "").trim() || undefined,
          raw: r as Record<string, unknown>,
        });
      }
    } catch {
      warnings.push("일부 텍스트 구간의 LLM 해석에 실패했습니다.");
    }
  }
  return { source: "freeform_llm", rows, warnings };
}
