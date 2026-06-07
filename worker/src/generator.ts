/**
 * Single-Call Featured Q&A Generator
 *
 * One API call per film → up to 10 featured Q&A.
 * Replaces the old multi-stage Dossier→Planner→Drafter→Verifier→Scorer pipeline.
 *
 * Quality is enforced:
 *   (a) inside the call — the model self-checks and drops/rewrites weak items
 *   (b) by a deterministic validator (pure code, no LLM)
 *
 * See: prompt-featured-qa.md, mission-pipeline-worker-kickoff.md
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────

interface FilmContext {
  id: string;
  tmdb_id: number;
  title: string;
  original_title: string | null;
  year: number | null;
  director: string | null;
  overview: string | null;
  genres: string[];
  keywords: string[];
}

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

interface GeneratorOutput {
  film_id: string;
  film_title: string;
  items: FeaturedItem[];
}

interface ModelResponse {
  text: string;
  tokensUsed: { prompt: number; completion: number; total: number };
  cost: number;
  model: string;
  provider: string;
}

interface ModelConfig {
  provider: string;
  model: string;
}

export interface ProcessFilmResult {
  questions_generated: number;
  questions_approved: number;
  questions_rejected: number;
  total_cost_usd: number;
  model: string;
  mean_self_confidence: number;
}

// ── Constants ─────────────────────────────────────────────────────

const EDITORIAL_PROFILE_ID = "00000000-0000-0000-0000-000000000001";

const MODEL_PRICING: Record<string, [number, number]> = {
  "gemini-3.5-flash": [0.15, 0.60],
  "gemini-3.1-pro-preview": [1.25, 10.00],
  "gemini-2.5-flash": [0.15, 0.60],
  "gemini-2.5-pro": [1.25, 10.00],
};

// Deterministic validator thresholds
const MIN_ITEMS = 8;
const MIN_SELF_CONFIDENCE = 0.75;
const MAX_QUESTION_LENGTH = 200;
const MIN_ANSWER_WORDS = 120;
const MAX_ANSWER_WORDS = 500;

const BANNED_TERMS_RE = /\b(kyniq|filmcurio\.com|http[s]?:\/\/|www\.)\b/i;

const VALID_ASKER_LENSES = [
  "The First-Timer", "The Feeler", "The Logic-Checker", "The Symbol-Spotter",
  "The Bingewatcher", "The Student", "The Rewatcher", "The Skeptic",
  "The Genre Fan", "The Budding Cinephile",
];

const VALID_ANSWERER_LENSES = [
  "The Warm Explainer", "The Wit", "The Formalist", "The Theorist",
  "The Historian", "The Close-Reader", "The Auteurist", "The Structuralist",
  "The Contrarian", "The Comparatist",
];

// ── SYSTEM prompt (identical for every film — context-cacheable) ──

const SYSTEM_PROMPT = `You are **FilmCurio Editorial**, the in-house critical voice of FilmCurio, a film-interpretation
site. For one film, produce the questions viewers are *most genuinely curious about after watching
it*, and answer each at the highest level of accuracy and insight you are capable of.

This is the site's seed layer. It must be good enough to (a) earn Google's **highest E-E-A-T**
rating and (b) be the answer an AI engine chooses to cite. **There is no human editor after you.**
If an answer is not accurate and genuinely illuminating, it does not ship — so hold the bar
yourself.

### Non-negotiables — trust (this is the E-E-A-T floor)
- **Accuracy over fluency.** Every factual claim about the film (plot, character, a line, a craft
  choice, production, release) must be true and checkable against the film itself or the
  well-established record. If you are not sure a detail is right, do not assert it.
- **Never fabricate quotes.** Do not invent verbatim dialogue. Refer to scenes and moments
  precisely; quote a line only if you are certain of it, and keep it short.
- **Separate fact from reading.** State what the film *shows* as fact; mark interpretation as
  interpretation. Where the film is deliberately ambiguous, **say so** — give the strongest reading
  *and* name the open question. Honest ambiguity is a trust signal, not a weakness; fake certainty
  is the fastest way to fail E-E-A-T.
- Spoilers are expected here (these are interpretation pages). Answer **fully**, endings included.
- English. No markdown inside field values. No emojis.

### What makes a FilmCurio answer — the bar (apply to every answer)
1. **Mirror the question's crux, and answer it first.** The opening sentence is a committed,
   direct answer to *exactly* what was asked, echoing the question's own key terms — a counterpart
   to the question, not a preamble. No "great question", no general intro to the film. If the item
   carries a body (the asker's elaboration), still lead on the title's crux; you may then briefly
   meet the specific angle the body raises, but never let the body pull the answer off course.
2. **Earn it with specific evidence from the film** — name the scene, the image, the cut, the line,
   the behaviour, the structural choice. Specificity is the *Experience + Expertise* signal; vague
   praise is the opposite.
3. **Deliver exactly one clear "아하 / aha".** A precise, non-obvious insight that reframes the
   question or resolves it in a way the viewer had not put together — a real turn of understanding,
   so the reader ends on "oh, *that's* what was going on." Not a platitude ("it's about the human
   condition"), not a plot summary.
4. **Stay on the crux.** Every sentence serves the answer to *that* question. No drift into general
   appreciation or unrelated trivia.
5. **Precise and economical: ~180–340 words.** Authoritative, not padded. Reasoned, situated in the
   director's work or film history only when it sharpens the answer (*Authoritativeness*).

Opening, illustrated (film-agnostic):
- ✗ Weak: "The ending of this film is one of the most debated in modern cinema, and viewers have
  argued about it for years…"
- ✓ Strong: "Yes — the [X] is real *to her*, and the film says so in the [specific scene]: [precise
  observation]. Which means the question isn't *whether* it happened but *why she needs it to* —
  and that's the turn…"

### The 10 ASKER lenses — vary how the QUESTION is phrased (general audience → cinephile)
1. **The First-Timer** — just watched, casual words: "what actually happened at the end?"
2. **The Feeler** — emotion/character: "why did she leave without a word?"
3. **The Logic-Checker** — does it add up? timeline, cause-and-effect, apparent holes.
4. **The Symbol-Spotter** — fixed on one image/object/colour: "what's the recurring [thing]?"
5. **The Bingewatcher** — time-pressed, practical: "is the slow stretch important? what did I miss?"
6. **The Student** — themes/context for an essay: "what are the central themes?"
7. **The Rewatcher** — caught a detail on a second viewing: "X recurs — is that intentional?"
8. **The Skeptic** — suspicious of hype/ambiguity: "is the vagueness just hiding that it means nothing?"
9. **The Genre Fan** — tropes/comparisons: "how does it play with / subvert the [genre] formula?"
10. **The Budding Cinephile** — some film vocabulary: "why hold the camera so long here?"
The question must sound like that person actually asking, in their register.

### The question body — optional elaboration (the asker's "변")
Real posts are a title plus, often, a short body. Each item may carry an optional question_body:
- **Short** — one or two sentences, ≤ ~40 words. Never an essay.
- **In the asker lens's voice** — this is where the persona comes alive.
- **Adds something** — a concrete angle, the detail that prompted the question, or why they're asking.
- **Optional and varied** — include it only when it adds flavour or needed context. Across the 10,
  **mix it** — some questions carry a body, some stand bare.

### The 10 ANSWERER lenses — vary the TONE only; the substance is always critic-grade
1. **The Warm Explainer** — lucid, generous, demystifying.
2. **The Wit** — urbane, literary, lightly ironic, quotable.
3. **The Formalist** — reads craft precisely (frame, cut, sound, blocking, colour), still plain.
4. **The Theorist** — one framework worn lightly, no jargon-dump.
5. **The Historian** — situates the film in its moment, the director's arc, its influences.
6. **The Close-Reader** — no theory, disciplined attention to what's on screen and in the script.
7. **The Auteurist** — connects to the director's whole body of work and recurring obsessions.
8. **The Structuralist** — narrative architecture / screenwriting logic; why this order.
9. **The Contrarian** — argues the unfashionable reading rigorously, never trolling.
10. **The Comparatist** — world-cinema / cross-cultural lens, reads against other traditions.
Whatever the lens, the analysis stays cinephile/critic-level in rigour and accuracy.

### Selecting the questions
- They must be the questions **real viewers of THIS specific film most want answered**.
- **No two questions share an answer.** Span distinct territory.
- Phrase each question in an assigned asker lens; assign an answerer lens whose tone suits it.
  **Do not use the same answerer lens for more than ~2 of the items.**

### Self-gate (this replaces human review)
For every item set:
- **self_confidence** (0.00–1.00): your honest probability that the answer is factually accurate
  **and** genuinely answers the question with a real insight.
- **claims_sourced** (boolean): true only if every factual claim is grounded in the film itself or
  the well-established record (no guessing).
If you cannot answer a candidate question to this bar, **drop it and pick a different top question
you can answer well — never pad to hit a count.** Aim for **10** items; every shipped item must be
**self_confidence ≥ 0.75**. If you genuinely cannot reach 10 strong ones, return fewer (**minimum
8**) rather than weak ones.

### Output — a single JSON object, exactly this shape, and nothing else
{
  "film_id": "<echo the input film_id>",
  "film_title": "<title>",
  "items": [
    {
      "question": "<the question title, in the asker lens's voice>",
      "question_body": "<optional 1–2 sentence elaboration in the asker's voice, or \\"\\" if none>",
      "asker_lens": "<one of the 10 asker labels>",
      "answer": "<180–340 words meeting every rule above>",
      "answerer_lens": "<one of the 10 answerer labels>",
      "aha": "<one sentence naming the single aha insight this answer lands>",
      "self_confidence": 0.00,
      "claims_sourced": true
    }
  ]
}
Output the JSON object only. No prose before or after, no markdown code fences, no <think> block.`;

// ── Provider helpers ──────────────────────────────────────────────

function estimateCost(model: string, p: number, c: number): number {
  const pr = MODEL_PRICING[model] ?? [0.50, 1.50];
  return (p * pr[0] + c * pr[1]) / 1_000_000;
}

async function callGemini(
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<ModelResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Understood." }] },
    { role: "user", parts: [{ text: userPrompt }] },
  ];

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 16384,
              responseMimeType: "application/json",
            },
          }),
        },
      );
    } catch (networkErr) {
      if (attempt < maxRetries) {
        const wait = Math.min(60, Math.pow(2, attempt + 1) * 10);
        console.log(`[generator] Network error — retrying in ${wait}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      throw new Error(`Gemini network error after ${maxRetries} retries: ${(networkErr as Error).message}`);
    }

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const u = data.usageMetadata ?? {};
      const pt = u.promptTokenCount ?? 0;
      const ct = u.candidatesTokenCount ?? 0;
      return {
        text,
        tokensUsed: { prompt: pt, completion: ct, total: pt + ct },
        cost: estimateCost(model, pt, ct),
        model,
        provider: "gemini",
      };
    }

    if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
      const wait = Math.min(60, Math.pow(2, attempt + 1) * 15);
      console.log(`[generator] ${res.status} — retrying in ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }

    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }

  throw new Error("Gemini: max retries exceeded");
}

// ── Deterministic Validator (no LLM) ──────────────────────────────

interface ValidationResult {
  valid: boolean;
  items: FeaturedItem[];
  errors: string[];
}

function validateOutput(raw: string, filmId: string): ValidationResult {
  const errors: string[] = [];

  // 1. Parse JSON
  let parsed: GeneratorOutput;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, items: [], errors: [`JSON parse error: ${raw.slice(0, 200)}`] };
  }

  // 2. Schema check
  if (!parsed.items || !Array.isArray(parsed.items)) {
    return { valid: false, items: [], errors: ["Missing or invalid 'items' array"] };
  }

  if (parsed.film_id && parsed.film_id !== filmId) {
    errors.push(`film_id mismatch: expected ${filmId}, got ${parsed.film_id}`);
  }

  // 3. Per-item validation
  const validItems: FeaturedItem[] = [];
  const seenQuestions = new Set<string>();

  for (let i = 0; i < parsed.items.length; i++) {
    const item = parsed.items[i];
    const itemErrors: string[] = [];

    // Required fields
    if (!item.question || typeof item.question !== "string") {
      itemErrors.push(`item[${i}]: missing question`);
    }
    if (!item.answer || typeof item.answer !== "string") {
      itemErrors.push(`item[${i}]: missing answer`);
    }
    if (!item.asker_lens || typeof item.asker_lens !== "string") {
      itemErrors.push(`item[${i}]: missing asker_lens`);
    }
    if (!item.answerer_lens || typeof item.answerer_lens !== "string") {
      itemErrors.push(`item[${i}]: missing answerer_lens`);
    }
    if (!item.aha || typeof item.aha !== "string") {
      itemErrors.push(`item[${i}]: missing aha`);
    }
    if (typeof item.self_confidence !== "number") {
      itemErrors.push(`item[${i}]: missing self_confidence`);
    }
    if (typeof item.claims_sourced !== "boolean") {
      itemErrors.push(`item[${i}]: missing claims_sourced`);
    }

    if (itemErrors.length > 0) {
      errors.push(...itemErrors);
      continue;
    }

    // Self-confidence gate
    if (item.self_confidence < MIN_SELF_CONFIDENCE) {
      errors.push(`item[${i}]: self_confidence ${item.self_confidence} < ${MIN_SELF_CONFIDENCE}`);
      continue;
    }

    // Claims sourced gate
    if (!item.claims_sourced) {
      errors.push(`item[${i}]: claims_sourced is false`);
      continue;
    }

    // Length sanity
    if (item.question.length > MAX_QUESTION_LENGTH) {
      errors.push(`item[${i}]: question too long (${item.question.length} chars)`);
      continue;
    }

    const wordCount = item.answer.split(/\s+/).length;
    if (wordCount < MIN_ANSWER_WORDS) {
      errors.push(`item[${i}]: answer too short (${wordCount} words)`);
      continue;
    }
    if (wordCount > MAX_ANSWER_WORDS) {
      errors.push(`item[${i}]: answer too long (${wordCount} words)`);
      continue;
    }

    // Banned terms
    if (BANNED_TERMS_RE.test(item.question) || BANNED_TERMS_RE.test(item.answer)) {
      errors.push(`item[${i}]: contains banned term`);
      continue;
    }

    // Intra-film dedup (by normalized question text)
    const norm = item.question.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seenQuestions.has(norm)) {
      errors.push(`item[${i}]: duplicate question`);
      continue;
    }
    seenQuestions.add(norm);

    // Lens validation (warn but don't reject — model may use slight variants)
    if (!VALID_ASKER_LENSES.includes(item.asker_lens)) {
      errors.push(`item[${i}]: unknown asker_lens "${item.asker_lens}" (accepted anyway)`);
    }
    if (!VALID_ANSWERER_LENSES.includes(item.answerer_lens)) {
      errors.push(`item[${i}]: unknown answerer_lens "${item.answerer_lens}" (accepted anyway)`);
    }

    // Ensure question_body is a string (may be missing)
    item.question_body = item.question_body ?? "";

    validItems.push(item);
  }

  // 4. Minimum item count
  if (validItems.length < MIN_ITEMS) {
    return {
      valid: false,
      items: validItems,
      errors: [...errors, `Only ${validItems.length} valid items (minimum ${MIN_ITEMS})`],
    };
  }

  return { valid: true, items: validItems, errors };
}

// ── Slug generator ────────────────────────────────────────────────

function makeSlug(question: string, filmTitle: string): string {
  const base = question
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}

// ── Schedule helper (jittered publish times) ──────────────────────

function schedulePublishTimes(count: number): Date[] {
  const now = Date.now();
  const times: Date[] = [];
  let cursor = now + 30 * 60_000; // Start 30min from now

  for (let i = 0; i < count; i++) {
    // Random gap between 20–90 minutes per item
    const gap = (20 + Math.random() * 70) * 60_000;
    cursor += gap;
    times.push(new Date(cursor));
  }

  return times;
}

// ── Main: process one film ────────────────────────────────────────

export async function processFilm(
  filmId: string,
  supabase: SupabaseClient,
  workerId: string,
  modelOverride?: ModelConfig,
): Promise<ProcessFilmResult> {
  // 1. Load film context
  const { data: film, error: filmErr } = await supabase
    .from("films")
    .select("id, tmdb_id, title, original_title, year, director, overview, genres, keywords")
    .eq("id", filmId)
    .single();

  if (filmErr || !film) throw new Error(`Film not found: ${filmId}`);

  // 2. Load model config
  const { data: configRow } = await supabase
    .from("pipeline_config")
    .select("value")
    .eq("key", "model_config")
    .single();

  const config: ModelConfig = modelOverride ?? {
    provider: (configRow?.value as Record<string, string>)?.generator_provider ?? "gemini",
    model: (configRow?.value as Record<string, string>)?.generator_model ?? "gemini-3.5-flash",
  };

  // 3. Build the USER prompt (per film)
  const userPrompt = `film_id: ${film.id}
Title: ${film.title} (${film.year ?? "unknown"})
Director: ${film.director ?? "unknown"}
Overview: ${film.overview ?? "No overview available."}
Extra context (optional, may be empty):

Produce the featured Q&A JSON for this film now.`;

  // 4. Call the model (one call per film)
  console.log(`[generator] Calling ${config.model} for "${film.title}" (${film.year})`);
  let response: ModelResponse;
  try {
    response = await callGemini(config.model, SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    throw new Error(`Model call failed for ${film.title}: ${(err as Error).message}`);
  }

  console.log(`[generator] Got response: ${response.tokensUsed.total} tokens, $${response.cost.toFixed(4)}`);

  // 5. Validate (deterministic, no LLM)
  let validation = validateOutput(response.text, film.id);

  // One retry on hard failure
  if (!validation.valid) {
    console.log(`[generator] Validation failed (${validation.errors.length} errors), retrying once...`);

    try {
      response = await callGemini(config.model, SYSTEM_PROMPT, userPrompt);
      validation = validateOutput(response.text, film.id);
    } catch (retryErr) {
      console.error(`[generator] Retry call also failed: ${(retryErr as Error).message}`);
    }

    if (!validation.valid) {
      // Log failure and skip
      await supabase.from("content_events").insert({
        entity_type: "film",
        entity_id: filmId,
        event: "generation_failed",
        actor_kind: "ai",
        meta: {
          model: config.model,
          errors: validation.errors.slice(0, 10),
          valid_items: validation.items.length,
          cost: response.cost,
        },
      });

      return {
        questions_generated: 0,
        questions_approved: 0,
        questions_rejected: 1,
        total_cost_usd: response.cost,
        model: config.model,
        mean_self_confidence: 0,
      };
    }
  }

  // 6. Write draft rows
  const items = validation.items;
  const publishTimes = schedulePublishTimes(items.length * 2); // question + answer each
  let ptIdx = 0;
  let totalConfidence = 0;

  for (const item of items) {
    totalConfidence += item.self_confidence;

    const slug = makeSlug(item.question, film.title);

    // Insert question (draft → approved)
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
        generated_by: config.model,
        asker_lens: item.asker_lens,
        self_confidence: item.self_confidence,
        claims_sourced: item.claims_sourced,
        scheduled_for: publishTimes[ptIdx++]?.toISOString(),
      })
      .select("id")
      .single();

    if (qErr) {
      console.error(`[generator] Question insert failed: ${qErr.message}`);
      continue;
    }

    // Insert canonical answer (draft → approved)
    const { data: answer, error: aErr } = await supabase
      .from("canonical_answers")
      .insert({
        question_id: question.id,
        body: item.answer,
        updated_by: EDITORIAL_PROFILE_ID,
        status: "approved",
        source: "ai",
        generated_by: config.model,
        answerer_lens: item.answerer_lens,
        aha: item.aha,
        self_confidence: item.self_confidence,
        claims_sourced: item.claims_sourced,
        scheduled_for: publishTimes[ptIdx++]?.toISOString(),
      })
      .select("id")
      .single();

    if (aErr) {
      console.error(`[generator] Answer insert failed: ${aErr.message}`);
      continue;
    }

    // Log content_events
    await supabase.from("content_events").insert([
      {
        entity_type: "question",
        entity_id: question.id,
        event: "generated",
        actor_kind: "ai",
        meta: {
          model: config.model,
          film_id: filmId,
          asker_lens: item.asker_lens,
          self_confidence: item.self_confidence,
        },
      },
      {
        entity_type: "canonical_answer",
        entity_id: answer.id,
        event: "generated",
        actor_kind: "ai",
        meta: {
          model: config.model,
          question_id: question.id,
          answerer_lens: item.answerer_lens,
          aha: item.aha,
          self_confidence: item.self_confidence,
        },
      },
    ]);
  }

  // 7. Log film-level event
  await supabase.from("content_events").insert({
    entity_type: "film",
    entity_id: filmId,
    event: "featured_qa_generated",
    actor_kind: "ai",
    meta: {
      model: config.model,
      items_generated: items.length,
      cost: response.cost,
      mean_self_confidence: totalConfidence / items.length,
      validation_errors: validation.errors.length,
    },
  });

  return {
    questions_generated: items.length,
    questions_approved: items.length,
    questions_rejected: 0,
    total_cost_usd: response.cost,
    model: config.model,
    mean_self_confidence: totalConfidence / items.length,
  };
}

// ── Heartbeat helper (re-exported for index.ts) ───────────────────

export async function writeHeartbeat(
  supabase: SupabaseClient,
  workerId: string,
  state: string,
  message: string,
  currentJobId?: string,
  todayPublished?: number,
  todayCost?: number,
): Promise<void> {
  await supabase.from("agent_activity").upsert(
    {
      worker_id: workerId,
      state,
      message,
      current_job_id: currentJobId ?? null,
      today_published: todayPublished ?? 0,
      today_cost_usd: todayCost ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "worker_id" },
  );
}
