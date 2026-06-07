/* Server-only: AI content pipeline — generate → verify → publish */

import { createAdminClient } from "@/lib/supabase/admin";
import { logContentEvent } from "@/lib/admin";

// ── Constants ─────────────────────────────────────────────────────

/** FilmCurio Editorial system profile (seeded in 0001_init / seed.sql) */
const EDITORIAL_PROFILE_ID = "00000000-0000-0000-0000-000000000001";

const MODEL_TAG = "gemini-2.5-flash";

const QUESTION_TYPES = [
  "interpretation",
  "symbolism",
  "character",
  "technique",
  "theme",
  "ending",
  "comparison",
  "context",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

// ── Gemini helper ─────────────────────────────────────────────────

function geminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

async function callGemini(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_TAG}:generateContent?key=${geminiKey()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
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

// ── 1. GENERATE ───────────────────────────────────────────────────

interface GenerateResult {
  questionId: string;
  answerId: string;
  contributionIds: string[];
}

export async function generateContent(
  filmId: string,
  questionType: QuestionType
): Promise<GenerateResult> {
  const film = await getFilmContext(filmId);
  const supabase = createAdminClient();

  const prompt = `You are a film critic writing for FilmCurio, a sophisticated film analysis platform. Generate a question and answer about the film "${film.title}" (${film.year}, directed by ${film.director}).

Film overview: ${film.overview}
Genres: ${(film.genres ?? []).join(", ")}
Keywords: ${(film.keywords ?? []).join(", ")}

Question type: ${questionType}

Generate exactly one insightful question and a comprehensive canonical answer about this film. The question should be the kind that a thoughtful film viewer would search for. The answer should follow this shape: start with an answer-first TL;DR (2-3 sentences), then provide a detailed analysis (3-5 paragraphs).

Also generate 1-2 shorter alternative perspectives (contributions) that offer different readings or additional insights.

Return JSON in this exact format:
{
  "question_title": "The question as a clear, searchable title",
  "question_body": "Optional elaboration on the question (1-2 sentences, or empty string)",
  "answer_body": "The full canonical answer with TL;DR first, then detailed analysis",
  "contributions": [
    { "body": "An alternative perspective or additional insight (2-3 paragraphs)" }
  ]
}`;

  const raw = await callGemini(prompt);

  let parsed: {
    question_title: string;
    question_body: string;
    answer_body: string;
    contributions: { body: string }[];
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse Gemini response: ${raw.slice(0, 200)}`);
  }

  // Create question slug
  const slug = `${film.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${questionType}-${Date.now().toString(36)}`;

  // Insert question (draft)
  const { data: question, error: qErr } = await supabase
    .from("questions")
    .insert({
      film_id: filmId,
      author_id: EDITORIAL_PROFILE_ID,
      title: parsed.question_title,
      body: parsed.question_body || null,
      slug,
      question_type: questionType,
      status: "draft",
      source: "ai",
      generated_by: MODEL_TAG,
    })
    .select("id")
    .single();

  if (qErr) throw new Error(`Question insert failed: ${qErr.message}`);

  // Insert canonical answer (draft)
  const { data: answer, error: aErr } = await supabase
    .from("canonical_answers")
    .insert({
      question_id: question.id,
      body: parsed.answer_body,
      updated_by: EDITORIAL_PROFILE_ID,
      status: "draft",
      source: "ai",
      generated_by: MODEL_TAG,
    })
    .select("id")
    .single();

  if (aErr) throw new Error(`Answer insert failed: ${aErr.message}`);

  // Insert contributions (draft)
  const contributionIds: string[] = [];
  for (const contrib of parsed.contributions ?? []) {
    const { data: c, error: cErr } = await supabase
      .from("contributions")
      .insert({
        question_id: question.id,
        author_id: EDITORIAL_PROFILE_ID,
        body: contrib.body,
        status: "draft",
        source: "ai",
        generated_by: MODEL_TAG,
      })
      .select("id")
      .single();

    if (cErr) {
      console.error("Contribution insert failed:", cErr.message);
      continue;
    }
    contributionIds.push(c.id);
  }

  // Log content_events
  await logContentEvent({
    entityType: "question",
    entityId: question.id,
    event: "generated",
    actorId: null,
    actorKind: "ai",
    meta: { model: MODEL_TAG, film_id: filmId, question_type: questionType },
  });

  await logContentEvent({
    entityType: "canonical_answer",
    entityId: answer.id,
    event: "generated",
    actorId: null,
    actorKind: "ai",
    meta: { model: MODEL_TAG, question_id: question.id },
  });

  return {
    questionId: question.id,
    answerId: answer.id,
    contributionIds,
  };
}

// ── 2. VERIFY ─────────────────────────────────────────────────────

interface VerifyResult {
  confidence: number;
  checks: { claim: string; result: "pass" | "fail" | "unverifiable" }[];
  notes: string;
}

export async function verifyContent(
  questionId: string
): Promise<VerifyResult> {
  const supabase = createAdminClient();

  // Get the question + answer + film context
  const { data: question } = await supabase
    .from("questions")
    .select("id, title, body, film_id")
    .eq("id", questionId)
    .single();

  if (!question) throw new Error(`Question not found: ${questionId}`);

  const { data: answer } = await supabase
    .from("canonical_answers")
    .select("id, body")
    .eq("question_id", questionId)
    .single();

  if (!answer) throw new Error(`Answer not found for question: ${questionId}`);

  const film = await getFilmContext(question.film_id);

  const prompt = `You are a fact-checker for FilmCurio, a film analysis platform. Your job is to verify the factual accuracy of AI-generated content about the film "${film.title}" (${film.year}, directed by ${film.director}).

REFERENCE DATA (from TMDB — treat as ground truth for factual claims):
- Title: ${film.title}
- Original title: ${film.original_title}
- Year: ${film.year}
- Director: ${film.director}
- Overview: ${film.overview}
- Genres: ${(film.genres ?? []).join(", ")}

CONTENT TO VERIFY:
Question: ${question.title}
${question.body || ""}

Answer: ${answer.body}

INSTRUCTIONS:
1. Check all FACTUAL claims (title, year, director, cast, plot facts, awards) against the reference data.
2. Interpretive/analytical claims are NOT factual errors — mark them as "unverifiable" not "fail".
3. Score confidence 0.0 to 1.0 based on factual accuracy only.
4. Be conservative: if any factual claim contradicts the reference data, set confidence below 0.8.

Return JSON:
{
  "confidence": 0.0-1.0,
  "checks": [
    { "claim": "description of claim checked", "result": "pass" | "fail" | "unverifiable" }
  ],
  "notes": "Summary of verification findings"
}`;

  const raw = await callGemini(prompt);

  let result: VerifyResult;
  try {
    result = JSON.parse(raw);
  } catch {
    // If parsing fails, treat as low confidence
    result = {
      confidence: 0.5,
      checks: [],
      notes: `Verification parse error: ${raw.slice(0, 200)}`,
    };
  }

  // Clamp confidence
  result.confidence = Math.max(0, Math.min(1, result.confidence));

  // Log verification event
  await logContentEvent({
    entityType: "question",
    entityId: questionId,
    event: "verified",
    actorId: null,
    actorKind: "ai",
    meta: {
      model: MODEL_TAG,
      confidence: result.confidence,
      checks: result.checks,
      notes: result.notes,
    },
  });

  await logContentEvent({
    entityType: "canonical_answer",
    entityId: answer.id,
    event: "verified",
    actorId: null,
    actorKind: "ai",
    meta: {
      model: MODEL_TAG,
      confidence: result.confidence,
    },
  });

  return result;
}

// ── 3. GATE & PUBLISH ─────────────────────────────────────────────

interface GateResult {
  published: boolean;
  confidence: number;
  status: "published" | "in_review";
}

export async function gateAndPublish(
  questionId: string,
  verification: VerifyResult,
  threshold: number = 0.85
): Promise<GateResult> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const shouldPublish =
    verification.confidence >= threshold &&
    !verification.checks.some((c) => c.result === "fail");

  const newStatus = shouldPublish ? "published" : "in_review";

  // Update question
  await supabase
    .from("questions")
    .update({
      status: newStatus,
      ...(shouldPublish && {
        published_at: now,
        reviewed_by: EDITORIAL_PROFILE_ID,
      }),
    })
    .eq("id", questionId);

  // Update canonical answer
  await supabase
    .from("canonical_answers")
    .update({
      status: newStatus,
      ...(shouldPublish && {
        published_at: now,
        reviewed_by: EDITORIAL_PROFILE_ID,
      }),
    })
    .eq("question_id", questionId);

  // Update contributions
  await supabase
    .from("contributions")
    .update({
      status: newStatus,
      ...(shouldPublish && { published_at: now }),
    })
    .eq("question_id", questionId)
    .eq("source", "ai")
    .eq("status", "draft");

  if (shouldPublish) {
    await logContentEvent({
      entityType: "question",
      entityId: questionId,
      event: "published",
      actorId: null,
      actorKind: "system",
      meta: {
        confidence: verification.confidence,
        threshold,
        auto_published: true,
      },
    });
  }

  return {
    published: shouldPublish,
    confidence: verification.confidence,
    status: newStatus,
  };
}

// ── 4. FULL PIPELINE ──────────────────────────────────────────────

export interface PipelineResult {
  questionId: string;
  answerId: string;
  contributionIds: string[];
  verification: VerifyResult;
  gate: GateResult;
}

export async function runPipeline(
  filmId: string,
  questionType: QuestionType,
  options: { threshold?: number } = {}
): Promise<PipelineResult> {
  const threshold = options.threshold ?? 0.85;

  // Step 1: Generate
  const generated = await generateContent(filmId, questionType);

  // Step 2: Verify
  const verification = await verifyContent(generated.questionId);

  // Step 3: Gate & Publish
  const gate = await gateAndPublish(generated.questionId, verification, threshold);

  return {
    questionId: generated.questionId,
    answerId: generated.answerId,
    contributionIds: generated.contributionIds,
    verification,
    gate,
  };
}
