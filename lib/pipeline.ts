/* Server-only: AI content pipeline — single-call featured Q&A generator */

import { createAdminClient } from "@/lib/supabase/admin";
import { logContentEvent } from "@/lib/admin";

// ── Constants ─────────────────────────────────────────────────────

/** FilmCurio Editorial system profile (seeded in 0001_init / seed.sql) */
const EDITORIAL_PROFILE_ID = "00000000-0000-0000-0000-000000000001";

const MODEL_TAG = "gemini-3.5-flash";

// ── Gemini helper ─────────────────────────────────────────────────

function geminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_TAG}:generateContent?key=${geminiKey()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood." }] },
        { role: "user", parts: [{ text: userPrompt }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── Film context from TMDB cache ──────────────────────────────────

interface FilmContext {
  id: string;
  title: string;
  original_title: string | null;
  year: number | null;
  director: string | null;
  overview: string | null;
  genres: string[];
  keywords: string[];
}

async function getFilmContext(filmId: string): Promise<FilmContext> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("films")
    .select("id, title, original_title, year, director, overview, genres, keywords")
    .eq("id", filmId)
    .single();

  if (error || !data) throw new Error(`Film not found: ${filmId}`);
  return data as FilmContext;
}

// ── Types ─────────────────────────────────────────────────────────

interface FeaturedItem {
  question: string;
  question_body: string;
  asker_lens: string;
  answer: string;
  answerer_lens: string;
  aha: string;
  self_confidence: number;
  claims_sourced: boolean;
}

interface GenerateResult {
  questionId: string;
  answerId: string;
}

// ── GENERATE (single call per film) ───────────────────────────────

const SYSTEM_PROMPT = `You are FilmCurio Editorial, the in-house critical voice of FilmCurio. For one film, produce the questions viewers are most genuinely curious about after watching it, and answer each at the highest level of accuracy and insight you are capable of. There is no human editor after you. Return a JSON object with film_id, film_title, and items array. Each item has: question, question_body (optional, "" if none), asker_lens, answer (180-340 words), answerer_lens, aha, self_confidence (0-1), claims_sourced (boolean). Output JSON only, no prose.`;

export async function generateContent(
  filmId: string,
): Promise<GenerateResult[]> {
  const film = await getFilmContext(filmId);
  const supabase = createAdminClient();

  const userPrompt = `film_id: ${film.id}
Title: ${film.title} (${film.year ?? "unknown"})
Director: ${film.director ?? "unknown"}
Overview: ${film.overview ?? "No overview available."}

Produce the featured Q&A JSON for this film now.`;

  const raw = await callGemini(SYSTEM_PROMPT, userPrompt);

  let parsed: { items: FeaturedItem[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse Gemini response: ${raw.slice(0, 200)}`);
  }

  if (!parsed.items || parsed.items.length === 0) {
    throw new Error("No items in response");
  }

  const results: GenerateResult[] = [];

  for (const item of parsed.items) {
    // Skip low-confidence items
    if (item.self_confidence < 0.75 || !item.claims_sourced) continue;

    const slug = item.question
      .toLowerCase()
      .replace(/['']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) + "-" + Date.now().toString(36);

    // Insert question (approved — ready for publisher)
    const { data: question, error: qErr } = await supabase
      .from("questions")
      .insert({
        film_id: filmId,
        author_id: EDITORIAL_PROFILE_ID,
        title: item.question,
        body: item.question_body || null,
        slug,
        status: "approved",
        source: "ai",
        generated_by: MODEL_TAG,
        asker_lens: item.asker_lens,
        self_confidence: item.self_confidence,
        claims_sourced: item.claims_sourced,
      })
      .select("id")
      .single();

    if (qErr) throw new Error(`Question insert failed: ${qErr.message}`);

    // Insert canonical answer (approved)
    const { data: answer, error: aErr } = await supabase
      .from("canonical_answers")
      .insert({
        question_id: question.id,
        body: item.answer,
        updated_by: EDITORIAL_PROFILE_ID,
        status: "approved",
        source: "ai",
        generated_by: MODEL_TAG,
        answerer_lens: item.answerer_lens,
        aha: item.aha,
        self_confidence: item.self_confidence,
        claims_sourced: item.claims_sourced,
      })
      .select("id")
      .single();

    if (aErr) throw new Error(`Answer insert failed: ${aErr.message}`);

    // Log content_events
    await logContentEvent({
      entityType: "question",
      entityId: question.id,
      event: "generated",
      actorId: null,
      actorKind: "ai",
      meta: {
        model: MODEL_TAG,
        film_id: filmId,
        asker_lens: item.asker_lens,
        self_confidence: item.self_confidence,
      },
    });

    await logContentEvent({
      entityType: "canonical_answer",
      entityId: answer.id,
      event: "generated",
      actorId: null,
      actorKind: "ai",
      meta: {
        model: MODEL_TAG,
        question_id: question.id,
        answerer_lens: item.answerer_lens,
        aha: item.aha,
        self_confidence: item.self_confidence,
      },
    });

    results.push({ questionId: question.id, answerId: answer.id });
  }

  return results;
}

// ── FULL PIPELINE (simplified: generate only, no separate verify/gate) ──

export interface PipelineResult {
  results: GenerateResult[];
  count: number;
}

export async function runPipeline(
  filmId: string,
): Promise<PipelineResult> {
  const results = await generateContent(filmId);

  return {
    results,
    count: results.length,
  };
}
