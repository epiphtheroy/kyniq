/**
 * ASK v2 · W2 — Query Understanding
 *
 * `analyzeQuery(q)` classifies a question and normalizes it for retrieval.
 * It is ADDITIVE: nothing here touches the live v1 route. The output drives
 * downstream policy in v2 — the FTS (keyword) axis language, the rerank floor,
 * and the diversity caps (broad vs. specific).
 *
 * Design:
 *  - One cheap `gpt-4o-mini` JSON-mode call (reuses `openaiAdapter`).
 *  - A fast, deterministic heuristic fallback if the model call fails or the
 *    OPENAI key is absent — so the route never hard-fails on analysis.
 *
 * The vector axis always uses the ORIGINAL query (embeddings are multilingual).
 * Only the keyword/FTS axis benefits from an English-normalized `ftsQuery`,
 * because the corpus FTS config is fixed to `'english'` (see ask_retrieve).
 */

import { openaiAdapter } from "@/lib/providers/openai";

export type AskIntent =
  | "broad-concept" // "how does cinema portray surveillance?" — breadth wanted
  | "specific-film" // "what does the ending of X mean?" — depth on one work
  | "multilingual" // non-English phrasing of either of the above
  | "out-of-scope"; // not about film / not answerable from the corpus

export interface QueryAnalysis {
  /** Coarse intent driving diversity + floor policy downstream. */
  intent: AskIntent;
  /** ISO-639-1-ish language code detected ("en", "ko", "ja", "fr", …). */
  lang: string;
  /**
   * English-normalized query for the keyword/FTS axis. For English input this
   * equals the (trimmed) original. For non-English it is a faithful English
   * rendering so the `'english'` FTS config can match.
   */
  ftsQuery: string;
  /** Optional query expansions (synonyms / sibling concepts) to widen recall. */
  expansions: string[];
}

const ANALYZER_MODEL = "gpt-4o-mini";

const ANALYZER_SYS = `You are a query-understanding component for a film close-reading search engine.
Given a user's question, return ONLY a JSON object with these exact keys:
- "intent": one of "broad-concept", "specific-film", "multilingual", "out-of-scope".
    * "broad-concept": asks about a theme, technique, motif, or idea across cinema (e.g. "how does film portray surveillance").
    * "specific-film": centers on one named film, scene, character, or director (e.g. "what does the ending of Stalker mean").
    * "out-of-scope": not about cinema/film interpretation, or unanswerable from film readings.
    * "multilingual": ONLY when the question is written in a language other than English. Use this even if it is conceptually broad or specific.
- "lang": ISO 639-1 code of the question's language ("en", "ko", "ja", "fr", "es", "de", "zh", "ru", "it", "pt", or "other").
- "ftsQuery": the question normalized to concise English keywords for keyword search. If already English, lightly clean it. Keep proper nouns (film/director names) intact.
- "expansions": an array of 0-4 short English synonym or sibling-concept phrases that would help recall (e.g. for "surveillance": ["being watched","panopticon","the gaze"]). Empty array if none help.
No prose, no markdown — just the JSON object.`;

/** Heuristic language guess from the script/character ranges present. */
function guessLang(q: string): string {
  if (/[가-힣]/.test(q)) return "ko"; // Hangul
  if (/[぀-ヿ]/.test(q)) return "ja"; // Hiragana/Katakana
  if (/[一-鿿]/.test(q)) return "zh"; // CJK Unified (after JP kana check)
  if (/[Ѐ-ӿ]/.test(q)) return "ru"; // Cyrillic
  if (/[À-ſ]/.test(q)) return "other"; // Latin w/ diacritics — uncertain
  return "en";
}

/** Cheap signals that a question targets one specific work rather than a theme. */
const SPECIFIC_HINTS =
  /\b(ending|final scene|last shot|opening|director|directed|character|protagonist|plot|sequel|the film|this movie)\b/i;
const BROAD_HINTS =
  /\b(how does (cinema|film|movies)|what does .* (mean|symbolize|represent)|tend to|in general|across films|motif|theme|portray|depict)\b/i;
const FILM_TOPIC =
  /\b(film|cinema|movie|scene|shot|frame|director|screen|camera|montage|mise|cinematograph)\b/i;

/**
 * Deterministic fallback — never throws. Good-enough classification so the
 * pipeline degrades gracefully when the LLM call is unavailable.
 */
export function heuristicAnalyze(q: string): QueryAnalysis {
  const query = q.trim();
  const lang = guessLang(query);
  const nonEnglish = lang !== "en";

  let intent: AskIntent;
  if (nonEnglish) {
    intent = "multilingual";
  } else if (!FILM_TOPIC.test(query) && !BROAD_HINTS.test(query)) {
    // No film vocabulary and no obvious "how does cinema…" framing.
    intent = "out-of-scope";
  } else if (SPECIFIC_HINTS.test(query)) {
    intent = "specific-film";
  } else {
    intent = "broad-concept";
  }

  return {
    intent,
    lang,
    // We cannot translate without the model; the vector axis still carries the
    // original, so passing the original through keeps FTS at least partially useful.
    ftsQuery: query,
    expansions: [],
  };
}

function coerceIntent(v: unknown): AskIntent | null {
  return v === "broad-concept" ||
    v === "specific-film" ||
    v === "multilingual" ||
    v === "out-of-scope"
    ? v
    : null;
}

/**
 * Analyze a question for the v2 pipeline. Always resolves — on any error it
 * returns the heuristic result so callers don't need a try/catch.
 */
export async function analyzeQuery(q: string): Promise<QueryAnalysis> {
  const query = (q ?? "").toString().trim();
  const fallback = heuristicAnalyze(query);

  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const resp = await openaiAdapter.call(ANALYZER_MODEL, `Question: ${query}`, {
      systemPrompt: ANALYZER_SYS,
      temperature: 0,
      maxTokens: 220,
      jsonMode: true,
    });

    const parsed = JSON.parse(resp.text || "{}") as Record<string, unknown>;

    const intent = coerceIntent(parsed.intent) ?? fallback.intent;
    const lang =
      typeof parsed.lang === "string" && parsed.lang.trim()
        ? parsed.lang.trim().toLowerCase()
        : fallback.lang;
    const ftsQuery =
      typeof parsed.ftsQuery === "string" && parsed.ftsQuery.trim()
        ? parsed.ftsQuery.trim()
        : fallback.ftsQuery;
    const expansions = Array.isArray(parsed.expansions)
      ? parsed.expansions
          .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
          .map((e) => e.trim())
          .slice(0, 4)
      : [];

    return { intent, lang, ftsQuery, expansions };
  } catch {
    return fallback;
  }
}
