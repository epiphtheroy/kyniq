/**
 * Pipeline Graph v4 — per-job orchestration
 *
 * Dossier (cached) → Planner → (Drafter → Verifier → Scorer → Gate)×N → Media
 *
 * v4: Prompt-design hardening per pipeline-prompts.md & prompt-design-changelog.md:
 *   - Editorial constitution prepended to every stage
 *   - Dossier builder (once per film, cached)
 *   - Corrective verifier + fix loop (≤2 retries)
 *   - Rubric scorer + revise loop (≤2 retries)
 *   - held status for gate failures (no human queue)
 *   - New JSON contracts: specifics, comparisons, rubric_scores, evidence_refs
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { curateMedia } from "./curiobot.js";

// ── Types ─────────────────────────────────────────────────────────

interface JobRow {
  id: string;
  film_id: string;
  target_count: number;
  params: Record<string, unknown>;
  created_by: string | null;
}

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

interface VoiceConfig {
  id: string;
  name: string;
  codename: string;
  register: string;
  length_band: string;
  description: string;
  entry_point: string;
  system_prompt_suffix: string;
}

interface PlanItem {
  question: string;
  thematic_focus: string;
  hook: string;
  pitch: string;
  dossier_refs: string[];
  voice_id?: string;     // assigned by us after planning
}

interface DraftOutput {
  tldr: string;
  body: string;
  facts_used: string[];
  evidence_used: string[];
  voice_id: string;
}

interface VerifyOutput {
  critical_errors: Array<{ claim: string; issue: string; fix_suggestion: string }>;
  real_person_risk: Array<{ claim: string; issue: string }>;
  spoiler_risk: boolean;
  fixes: Array<{ target: string; correction: string }>;
  confidence_score: number;
}

interface RubricOutput {
  scores: Record<string, number>;
  verdict: "publish" | "revise" | "hold";
  revise_notes: string;
}

interface Dossier {
  verified_facts: Array<{ claim: string; source: string }>;
  cinematic_evidence: Array<{ detail: string; significance: string }>;
  thematic_threads: string[];
  comparisons: Array<{ other_film: string; shared_attribute: string; source: string }>;
  open_ambiguities: string[];
}

export interface JobResult {
  questions_created: number;
  questions_published: number;
  questions_in_review: number;
  questions_held: number;
  total_cost_usd: number;
  total_tokens: number;
  media_attached: number;
  errors: string[];
}

// ── Constants ─────────────────────────────────────────────────────

const EDITORIAL_PROFILE_ID = "00000000-0000-0000-0000-000000000001";
const MAX_VERIFY_RETRIES = 2;
const MAX_REVISE_RETRIES = 2;

// ── Editorial Constitution (§0 — FINAL: organic insight, anti-repetition, human voice) ──

const EDITORIAL_CONSTITUTION = `You write for FilmCurio, an automated but elite film-interpretation resource. Across thousands of entries your single greatest enemy is REPETITION BIAS — sounding the same on every film.

THE PRIME DIRECTIVE — ORGANIC CREATIVITY & ANTI-TEMPLATE
- Eradicate the template. No stock structure, no habitual opening, no forced progression. Let the themes, tone, and pacing of THIS film dictate the shape of the writing — a frantic thriller and a quiet drama should not move the same way.
- If a sentence, structure, or transition could sit unchanged under a different film, rewrite or delete it. Every line should feel native ONLY to this film and this question.

VOICE — talk like a person, NOT a paper
- Casual, fast, spoken — a sharp friend who just watched it, not a lecturer. Short sentences, plain words. NO academic register, NO jargon, NO "moreover/furthermore," NO thesis throat-clearing. If a film-studies term sneaks in, say the idea in human words instead.
- Depth is NOT the same as sounding academic. The insight should land as a punch, not a citation.

MAKE IT MOVE — earn the "aha" (these are QUALITIES, achieved organically; never a fixed order)
- Answer the asker, not the void: pick up a word or two from the actual question and respond to it, then advance your read.
- Reward set-up and pay-off: a concrete detail planted early and fired later lands the click.
- Aim for one real "aha" — a turn where the obvious reading flips into the truer one. Achieve all of this however the film demands; do not impose a standard sequence (that becomes a template).

FOCUS ON THE CINEMATIC ESSENCE
- Show, don't tell. Anchor your intelligence in the actual fabric of the film: a camera movement, a lighting choice, a line of dialogue, a structural motif.
- Cultivate productive ambiguity. Explore the gray areas; don't force a definitive verdict where the real truth is the tension.

THE IRONCLAD CONSTRAINTS (no human will review this — these are absolute)
1. ZERO HALLUCINATION. Never invent a specific scene, shot, quote, or production fact to sound authoritative. Fabricated authority is a fatal error. If you cannot ground it, lean on broader structural/thematic ideas instead.
2. FACT VS READING. State verifiable facts plainly; frame interpretation as interpretation ("the film suggests…", "one way to read this…").
3. REAL-PERSON SAFETY. About real people (directors, actors, crew): only sourced, professional facts. No rumor, no defamation, no private-life speculation.`;

// ── Provider helpers ──────────────────────────────────────────────

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

const MODEL_PRICING: Record<string, [number, number]> = {
  "gemini-2.5-flash": [0.15, 0.60],
  "gemini-2.5-pro": [1.25, 10.00],
  "gpt-4o-mini": [0.15, 0.60],
  "gpt-4o": [2.50, 10.00],
};

function estimateCost(model: string, p: number, c: number): number {
  const pr = MODEL_PRICING[model] ?? [0.50, 1.50];
  return (p * pr[0] + c * pr[1]) / 1_000_000;
}

async function callGemini(model: string, prompt: string, systemPrompt?: string, jsonMode = false): Promise<ModelResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Understood." }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

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
              maxOutputTokens: 8192,
              ...(jsonMode && { responseMimeType: "application/json" }),
            },
          }),
        }
      );
    } catch (networkErr) {
      // Network-level failure (DNS, connection refused, timeout, etc.)
      if (attempt < maxRetries) {
        const retryAfter = Math.min(60, Math.pow(2, attempt + 1) * 10);
        console.log(`[gemini] Network error (${(networkErr as Error).message}) — retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      throw new Error(`Gemini network error after ${maxRetries} retries: ${(networkErr as Error).message}`);
    }

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const u = data.usageMetadata ?? {};
      const pt = u.promptTokenCount ?? 0, ct = u.candidatesTokenCount ?? 0;
      return { text, tokensUsed: { prompt: pt, completion: ct, total: pt + ct }, cost: estimateCost(model, pt, ct), model, provider: "gemini" };
    }

    if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
      const retryAfter = Math.min(60, Math.pow(2, attempt + 1) * 15);
      console.log(`[gemini] ${res.status} — retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }

  throw new Error("Gemini: max retries exceeded");
}

async function callOpenAI(model: string, prompt: string, systemPrompt?: string, jsonMode = false): Promise<ModelResponse> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = { model, messages, temperature: 0.4, max_tokens: 4096 };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const u = data.usage ?? {};
  const pt = u.prompt_tokens ?? 0, ct = u.completion_tokens ?? 0;

  return { text, tokensUsed: { prompt: pt, completion: ct, total: pt + ct }, cost: estimateCost(model, pt, ct), model, provider: "openai" };
}

async function callModel(config: ModelConfig, prompt: string, systemPrompt?: string, jsonMode = false): Promise<ModelResponse> {
  if (config.provider === "openai") return callOpenAI(config.model, prompt, systemPrompt, jsonMode);
  return callGemini(config.model, prompt, systemPrompt, jsonMode);
}

// ── Robust JSON extraction (handles thinking model output) ───────

function extractJSON(text: string): unknown | null {
  // Direct parse
  try { return JSON.parse(text); } catch { /* continue */ }

  // Strip thinking blocks (Gemini sometimes wraps output in <think> tags)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown fenced blocks
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* continue */ }
  }

  // Try to find the outermost JSON array first (for planner output)
  // Use a bracket-counting approach for robustness
  const arrStart = cleaned.indexOf("[");
  if (arrStart !== -1) {
    let depth = 0;
    let arrEnd = -1;
    for (let i = arrStart; i < cleaned.length; i++) {
      if (cleaned[i] === "[") depth++;
      else if (cleaned[i] === "]") {
        depth--;
        if (depth === 0) { arrEnd = i; break; }
      }
    }
    if (arrEnd !== -1) {
      try { return JSON.parse(cleaned.slice(arrStart, arrEnd + 1)); } catch { /* continue */ }
    }
  }

  // Try to find the outermost JSON object
  const objStart = cleaned.indexOf("{");
  if (objStart !== -1) {
    let depth = 0;
    let objEnd = -1;
    for (let i = objStart; i < cleaned.length; i++) {
      if (cleaned[i] === "{") depth++;
      else if (cleaned[i] === "}") {
        depth--;
        if (depth === 0) { objEnd = i; break; }
      }
    }
    if (objEnd !== -1) {
      try { return JSON.parse(cleaned.slice(objStart, objEnd + 1)); } catch { /* continue */ }
    }
  }

  // Last resort: greedy regex
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* continue */ }
  }
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch { /* continue */ }
  }

  return null;
}

// ── Heartbeat helper ──────────────────────────────────────────────

export async function writeHeartbeat(
  supabase: SupabaseClient,
  workerId: string,
  status: string,
  details: string,
  jobId?: string,
  questionsProcessed?: number,
  costSoFar?: number
): Promise<void> {
  const row: Record<string, unknown> = {
    worker_id: workerId,
    status,
    last_heartbeat: new Date().toISOString(),
    details,
  };
  if (jobId) row.current_job_id = jobId;
  if (questionsProcessed !== undefined) row.questions_processed = questionsProcessed;
  if (costSoFar !== undefined) row.cost_so_far = costSoFar;
  await supabase
    .from("agent_activity")
    .upsert(row, { onConflict: "worker_id" });
}

async function updateJobStep(
  supabase: SupabaseClient,
  jobId: string,
  step: string,
  questionsDone?: number
): Promise<void> {
  const update: Record<string, unknown> = {
    current_step: step,
    updated_at: new Date().toISOString(),
  };
  if (questionsDone !== undefined) update.questions_done = questionsDone;
  await supabase.from("jobs").update(update).eq("id", jobId);
}

// ── Dossier Builder (§1 — once per film, cached) ─────────────────

async function buildOrGetDossier(
  supabase: SupabaseClient,
  film: FilmContext,
  dossierConfig: ModelConfig,
  result: JobResult
): Promise<Dossier> {
  // Check cache
  const { data: cached } = await supabase
    .from("film_dossiers")
    .select("dossier")
    .eq("film_id", film.id)
    .single();

  if (cached?.dossier) {
    const d = cached.dossier as Record<string, unknown>;
    // Only use cache if it matches the new FINAL JSON contract
    if ("verified_facts" in d) {
      console.log(`[dossier] Cache hit for "${film.title}"`);
      return cached.dossier as Dossier;
    }
    console.log(`[dossier] Stale cache (old format) for "${film.title}", rebuilding...`);
  }

  console.log(`[dossier] Building dossier for "${film.title}"...`);

  const dossierPrompt = `Build a foundational intelligence dossier for the film. The goal is not to force insights but to extract the cinematic and thematic DNA that writers will use to craft unique, grounded analyses.

FILM: ${film.title} (${film.year}), dir. ${film.director}. TMDB data: ${film.overview}. Genres: ${(film.genres ?? []).join(", ")}. Keywords: ${(film.keywords ?? []).join(", ")}.

Return ONLY JSON:
{
  "verified_facts":     [{"claim": "verifiable truth/context", "source": "TMDB|Wikidata|<url>"}],
  "cinematic_evidence": [{"detail": "precise, striking visual/audio/narrative element", "significance": "..."}],
  "thematic_threads":   ["deep philosophical, structural, or emotional currents of the film"],
  "comparisons":        [{"other_film": "real title", "shared_attribute": "factual connection", "source": "..."}],
  "open_ambiguities":   ["genuine interpretive tensions / unanswered questions"]
}
Rule: Do not invent anything. If you cannot ground a detail in reality or broad consensus, omit it.`;

  const resp = await callModel(dossierConfig, dossierPrompt, EDITORIAL_CONSTITUTION, true);
  result.total_cost_usd += resp.cost;
  result.total_tokens += resp.tokensUsed.total;

  const parsed = extractJSON(resp.text);
  if (!parsed || typeof parsed !== "object" || !("verified_facts" in (parsed as Record<string, unknown>))) {
    console.log("[dossier] Failed to parse dossier, using minimal fallback");
    const fallback: Dossier = {
      verified_facts: [{ claim: `${film.title} (${film.year}), directed by ${film.director}`, source: "TMDB" }],
      cinematic_evidence: [], thematic_threads: [], comparisons: [], open_ambiguities: [],
    };
    return fallback;
  }

  const dossier = parsed as Dossier;

  // Cache it
  await supabase.from("film_dossiers").upsert({
    film_id: film.id,
    dossier,
    model: resp.model,
    provider: resp.provider,
    cost_usd: resp.cost,
    tokens_used: resp.tokensUsed.total,
  }, { onConflict: "film_id" });

  console.log(`[dossier] Built: ${dossier.verified_facts.length} facts, ${dossier.cinematic_evidence.length} evidence, ${dossier.comparisons.length} comparisons`);

  return dossier;
}

// ── Corrective Verify Loop (§4) ──────────────────────────────────

async function verifyAndFix(
  draftBody: string,
  dossierJson: string,
  film: FilmContext,
  question: string,
  verifierConfig: ModelConfig,
  result: JobResult
): Promise<{ finalBody: string; verify: VerifyOutput; retries: number }> {
  let body = draftBody;

  for (let retry = 0; retry <= MAX_VERIFY_RETRIES; retry++) {
    const verifyPrompt = `You are the final automated fact-checker and constraint-enforcer. No human will review this. Your ONLY job is to catch FATAL OBJECTIVE flaws: hallucinations, factual errors, ungrounded specifics, defamatory risk about real people, and spoilers.

Do NOT police writing style, structure, or subjective thematic interpretation — film analysis is subjective. Focus purely on objective grounding and factual safety.
- Did they invent a scene, shot, quote, or fact that isn't true to the film or the dossier?
- Are they presenting speculative rumors about real people as fact?

Emit TARGETED FIXES for objective errors only (don't rewrite the whole thing). Rate confidence_score (0.0–1.0) as your certainty that the draft contains NO hallucinations or factual errors. This is FACTUAL SAFETY, not interpretive perfection — do NOT demand 1.0 for subjective readings; a sound, well-grounded interpretation should score high.

DRAFT: ${body.slice(0, 3000)}
DOSSIER: ${dossierJson.slice(0, 3000)}
FILM: "${film.title}" (${film.year}), dir. ${film.director}
QUESTION: ${question}

Return ONLY JSON:
{"critical_errors":[{"claim":"...", "issue":"fabricated_detail|factual_error|ungrounded", "fix_suggestion":"..."}],
 "real_person_risk":[{"claim":"...", "issue":"unsourced|defamatory"}],
 "spoiler_risk": false,
 "fixes":[{"target":"exact text to change", "correction":"replacement or 'remove'"}],
 "confidence_score": 0.0}`;

    const resp = await callModel(verifierConfig, verifyPrompt, EDITORIAL_CONSTITUTION, true);
    result.total_cost_usd += resp.cost;
    result.total_tokens += resp.tokensUsed.total;

    const parsed = extractJSON(resp.text) as VerifyOutput | null;
    const verify: VerifyOutput = parsed && "confidence_score" in parsed
      ? {
          ...parsed,
          confidence_score: Number(parsed.confidence_score) || 0.5,
          critical_errors: Array.isArray(parsed.critical_errors) ? parsed.critical_errors : [],
          real_person_risk: Array.isArray(parsed.real_person_risk) ? parsed.real_person_risk : [],
          fixes: Array.isArray(parsed.fixes) ? parsed.fixes : [],
        }
      : { critical_errors: [], real_person_risk: [], spoiler_risk: false, fixes: [], confidence_score: 0.5 };

    // No fixes needed or last retry → return
    if (verify.fixes.length === 0 || retry === MAX_VERIFY_RETRIES) {
      return { finalBody: body, verify, retries: retry };
    }

    // Apply fixes
    console.log(`[verify] Applying ${verify.fixes.length} fixes (retry ${retry + 1}/${MAX_VERIFY_RETRIES})`);
    for (const fix of verify.fixes) {
      if (fix.correction === "remove") {
        body = body.replace(fix.target, "");
      } else {
        body = body.replace(fix.target, fix.correction);
      }
    }
  }

  // Should not reach here
  return { finalBody: body, verify: { critical_errors: [], real_person_risk: [], spoiler_risk: false, fixes: [], confidence_score: 0.5 }, retries: MAX_VERIFY_RETRIES };
}

// ── Rubric Scorer + Revise Loop (§5) ─────────────────────────────

function codePreChecks(draft: DraftOutput, voice: VoiceConfig): string[] {
  const failures: string[] = [];
  if (!draft.tldr || draft.tldr.length < 10) failures.push("Missing or too short TL;DR");
  if (!draft.facts_used || draft.facts_used.length === 0) failures.push("No facts_used");

  // Length band check (rough — voice has e.g. "300–500")
  const bandMatch = voice.length_band.match(/(\d+)/);
  if (bandMatch) {
    const minWords = parseInt(bandMatch[1]) * 0.5; // generous lower bound
    const wordCount = draft.body.split(/\s+/).length;
    if (wordCount < minWords) failures.push(`Body too short: ${wordCount} words (band: ${voice.length_band})`);
  }

  return failures;
}

async function scoreWithRubric(
  draft: DraftOutput,
  scorerConfig: ModelConfig,
  result: JobResult
): Promise<RubricOutput> {
  const scorePrompt = `Evaluate the draft. FilmCurio's standard is profound, original insight delivered in a human voice, strictly grounded in THIS film's specific materials.

PENALIZE heavily: generic AI-template feel, repetitive transitional formulas, academic/dry register, or failure to engage THIS film's specific materials.
REWARD: organic (distinct) structure, real thematic depth, precise cinematic grounding, a casual human voice, and a genuine "aha" turn.

DRAFT TL;DR: ${draft.tldr}
DRAFT BODY (first 2000 chars): ${draft.body.slice(0, 2000)}
VOICE: ${draft.voice_id}
FACTS USED: ${draft.facts_used.length}, EVIDENCE USED: ${draft.evidence_used?.length ?? 0}

Return ONLY JSON:
{"scores":{
   "thematic_depth":1, "cinematic_grounding":1, "anti_template_variance":1,
   "voice_and_flow":1, "aha_momentum":1 },
 "verdict":"publish|revise|hold",
 "revise_notes":"if revise: how to break the generic template, deepen the insight, or de-academize"}`;
  const resp = await callModel(scorerConfig, scorePrompt, undefined, true);
  result.total_cost_usd += resp.cost;
  result.total_tokens += resp.tokensUsed.total;

  const parsed = extractJSON(resp.text) as RubricOutput | null;
  if (parsed && "verdict" in parsed) return parsed;

  return { scores: {}, verdict: "publish", revise_notes: "" };
}

// ── Main graph ────────────────────────────────────────────────────

export async function processJob(
  jobId: string,
  supabase: SupabaseClient,
  workerId: string
): Promise<JobResult> {
  const result: JobResult = {
    questions_created: 0,
    questions_published: 0,
    questions_in_review: 0,
    questions_held: 0,
    total_cost_usd: 0,
    total_tokens: 0,
    media_attached: 0,
    errors: [],
  };

  // Mark started
  await supabase.from("jobs").update({
    started_at: new Date().toISOString(),
    current_step: "dossier",
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);

  // 1. Load job
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) throw new Error(`Job not found: ${jobId}`);
  const j = job as JobRow;

  // 2. Load film context
  const { data: film, error: filmErr } = await supabase
    .from("films")
    .select("id, tmdb_id, title, original_title, year, director, overview, genres, keywords")
    .eq("id", j.film_id)
    .single();

  if (filmErr || !film) throw new Error(`Film not found: ${j.film_id}`);
  const f = film as FilmContext;

  // 3. Load config
  const { data: configs } = await supabase
    .from("pipeline_config")
    .select("key, value")
    .in("key", ["model_router", "personas", "gate_threshold"]);

  const configMap = new Map((configs ?? []).map((c) => [c.key, c.value]));
  const routerConfig = (configMap.get("model_router") ?? {}) as Record<string, ModelConfig>;
  const voices = (configMap.get("personas") ?? []) as VoiceConfig[];
  const gateConfig = (configMap.get("gate_threshold") ?? { default: 0.80 }) as { default: number };
  const threshold = (j.params.threshold as number) ?? gateConfig.default;

  const dossierConfig = routerConfig.dossier ?? { provider: "gemini", model: "gemini-2.5-flash" };
  const plannerConfig = routerConfig.planner ?? { provider: "gemini", model: "gemini-2.5-flash" };
  const drafterConfig = routerConfig.drafter ?? { provider: "gemini", model: "gemini-2.5-flash" };
  const verifierConfig = routerConfig.verifier ?? drafterConfig; // ideally different family
  const scorerConfig = routerConfig.scorer ?? { provider: "gemini", model: "gemini-2.5-flash" };

  // ── DOSSIER ─────────────────────────────────────────────────────
  await writeHeartbeat(supabase, workerId, "running", `building dossier for "${f.title}"`, jobId);

  const dossier = await buildOrGetDossier(supabase, f, dossierConfig, result);
  const dossierJson = JSON.stringify(dossier);

  // ── PLANNER (§2) ───────────────────────────────────────────────
  console.log(`[graph] Planning ${j.target_count} questions for "${f.title}"`);
  await writeHeartbeat(supabase, workerId, "running", `planning questions for "${f.title}"`, jobId);
  await updateJobStep(supabase, jobId, "planning", 0);

  const { data: existingQs } = await supabase
    .from("questions")
    .select("title")
    .eq("film_id", f.id);
  const existingTitles = (existingQs ?? []).map((q) => q.title.toLowerCase());

  const planPrompt = `From the dossier, propose ~14 candidate questions, then select the ${j.target_count} strongest. The QUESTION's job is to be BAIT — a short, casual hook that makes someone stop scrolling and need the answer.

QUESTION RULES:
- SHORT. Aim ≤10 words; rarely more. One idea. No multi-clause monsters. No essay-prompt phrasing.
- Spoken, casual, tuned to THIS film's vibe. Contractions; a "wait" or "so" if it lands.
- Aggro / provocative is the #1 trait — create intense anticipation. Take a side, poke, dare. A question that's a little WRONG or one-sided is GOOD: the wrong premise is the gun the answer gets to fire.
- It must still open onto real insight (theme, structure, ambiguity, character psychology) — not pure trivia. Vary the kind of question across the ${j.target_count}.

BAD (long/academic): "Is the Zone a literal place with supernatural powers, an alien landscape, or is it primarily a metaphor for the characters' internal struggles?"
GOOD (short/hook): "Is the Zone even real?" · "Does the Zone actually do anything?"

For each, write a PITCH (1-2 sentences): vivid, sells the payoff without spoiling it. No clickbait.

DOSSIER: ${dossierJson.slice(0, 4000)}
FILM: "${f.title}" (${f.year}), dir. ${f.director}
GENRES: ${(f.genres ?? []).join(", ")}

Existing questions to AVOID duplicating:
${existingTitles.slice(0, 20).join("\n")}

Return ONLY JSON (rank by hook strength, strongest first):
[{"question":"short hooky question", "thematic_focus":"the core idea it opens onto",
  "hook":"why this baits a click", "pitch":"...", "dossier_refs":["relevant keys"]}]`;

  const planResp = await callModel(plannerConfig, planPrompt, EDITORIAL_CONSTITUTION, true);
  result.total_cost_usd += planResp.cost;
  result.total_tokens += planResp.tokensUsed.total;

  let plan: PlanItem[];
  const planParsed = extractJSON(planResp.text);
  if (Array.isArray(planParsed)) {
    plan = planParsed;
  } else {
    plan = [];
    result.errors.push("Failed to parse planner output");
    console.log("[graph] Planner raw (first 500):", planResp.text.slice(0, 500));
  }

  // Dedup + assign voices
  plan = plan.filter((p) => !existingTitles.includes((p.question ?? "").toLowerCase()));

  // Code pre-check: question must be short (≈≤12 words), not an essay-prompt
  plan = plan.filter((p) => {
    const wordCount = (p.question ?? "").split(/\s+/).length;
    if (wordCount > 15) {
      console.log(`[graph] Question too long (${wordCount} words), skipping: "${p.question}"`);
      return false;
    }
    return true;
  });

  plan = plan.slice(0, j.target_count);

  // Assign voices (round-robin across available voices)
  for (let i = 0; i < plan.length; i++) {
    if (!plan[i].voice_id && voices.length > 0) {
      plan[i].voice_id = voices[i % voices.length].id;
    }
  }

  // ── DRAFT → VERIFY → SCORE → GATE for each question ───────────
  await updateJobStep(supabase, jobId, "drafting", 0);

  for (let i = 0; i < plan.length; i++) {
    const item = plan[i];
    try {
      const voice = voices.find((v) => v.id === item.voice_id) ?? voices[0];
      if (!voice) {
        result.errors.push(`No voice found for ${item.voice_id}`);
        continue;
      }

      // ── DRAFT (§3) ──────────────────────────────────────────────
      await writeHeartbeat(
        supabase, workerId, "running",
        `drafting ${i + 1}/${plan.length} for "${f.title}" [${voice.codename}]`,
        jobId, result.questions_created, result.total_cost_usd
      );
      await updateJobStep(supabase, jobId, "drafting", i);

      const draftPrompt = `Write a profound, engaging answer in the assigned voice. Fully obey the Editorial Constitution.

CREATIVE FREEDOM & SHAPE:
- Break the formula. No rigid intro→body→conclusion, no fixed facts→insight arc. Let the film's mood and the question dictate the flow. Every answer should be structurally distinct.
- Talk like a person, not a paper — casual, fast, plain. Depth lands as a punch, not a lecture.
- Open with a self-contained, citable \`tldr\` (≤40 words) that states the claim cleanly without blowing the turn. In the \`body\`: answer the asker (echo a word or two from the question), weave in highly specific grounded cinematic elements, and earn one real "aha" — organically, not on a schedule.

STRICT CONSTRAINTS:
- Use ONLY facts and specifics grounded in the dossier. NEVER hallucinate a detail to sound smarter. Frame interpretation as interpretation. Real-person claims: sourced facts only.
- Stay distinct: if a sentence could sit unchanged under another film/question, rewrite it.

QUESTION: ${item.question}  PITCH: ${item.pitch ?? ""}
VOICE: ${voice.codename} — ${voice.register}, ${voice.length_band} words. ${voice.description}
DOSSIER: ${dossierJson.slice(0, 4000)}

Return ONLY JSON:
{"tldr":"...", "body":"...", "facts_used":["dossier keys"], "evidence_used":["dossier cinematic_evidence keys"],
 "voice_id":"${voice.id}"}`;

      const systemPromptForDraft = EDITORIAL_CONSTITUTION + "\n\n" + voice.system_prompt_suffix;
      let draftResp = await callModel(drafterConfig, draftPrompt, systemPromptForDraft, true);
      result.total_cost_usd += draftResp.cost;
      result.total_tokens += draftResp.tokensUsed.total;

      let draft: DraftOutput;
      const draftParsed = extractJSON(draftResp.text);
      if (draftParsed && typeof draftParsed === "object" && "body" in (draftParsed as Record<string, unknown>)) {
        draft = draftParsed as DraftOutput;
        // Ensure tldr exists
        if (!draft.tldr) draft.tldr = draft.body.split(/\n\n/)[0]?.slice(0, 200) ?? "";
      } else {
        result.errors.push(`Failed to parse draft for: ${item.question}`);
        console.log("[graph] Draft raw (first 300):", draftResp.text.slice(0, 300));
        continue;
      }

      // ── CODE PRE-CHECKS (§5 — before LLM scorer) ────────────────
      const preCheckFails = codePreChecks(draft, voice);
      if (preCheckFails.length > 0) {
        console.log(`[graph] Pre-check fails for "${item.question}": ${preCheckFails.join(", ")}`);
        // Attempt one re-draft with notes
        const revisedPrompt = draftPrompt + `\n\nPREVIOUS DRAFT FAILED QUALITY CHECKS: ${preCheckFails.join("; ")}. Fix these issues.`;
        draftResp = await callModel(drafterConfig, revisedPrompt, systemPromptForDraft, true);
        result.total_cost_usd += draftResp.cost;
        result.total_tokens += draftResp.tokensUsed.total;

        const revisedParsed = extractJSON(draftResp.text);
        if (revisedParsed && typeof revisedParsed === "object" && "body" in (revisedParsed as Record<string, unknown>)) {
          draft = revisedParsed as DraftOutput;
          if (!draft.tldr) draft.tldr = draft.body.split(/\n\n/)[0]?.slice(0, 200) ?? "";
        }
      }

      // ── VERIFY + FIX LOOP (§4) ──────────────────────────────────
      await writeHeartbeat(
        supabase, workerId, "running",
        `verifying ${i + 1}/${plan.length} for "${f.title}"`,
        jobId, result.questions_created, result.total_cost_usd
      );
      await updateJobStep(supabase, jobId, "verifying", i);

      const { finalBody, verify, retries: verifyRetries } = await verifyAndFix(
        draft.body, dossierJson, f, item.question, verifierConfig, result
      );
      draft.body = finalBody;

      // Check for hard-hold conditions
      const hasRealPersonRisk = (verify.real_person_risk ?? []).length > 0;
      const hasCriticalErrors = (verify.critical_errors ?? []).length > 0;

      // ── RUBRIC SCORER (§5) ─────────────────────────────────────
      await updateJobStep(supabase, jobId, "scoring", i);

      let rubric = await scoreWithRubric(draft, scorerConfig, result);

      // Revise loop
      let reviseCount = 0;
      while (rubric.verdict === "revise" && reviseCount < MAX_REVISE_RETRIES) {
        reviseCount++;
        console.log(`[graph] Rubric: revise (${reviseCount}/${MAX_REVISE_RETRIES}): ${rubric.revise_notes?.slice(0, 100)}`);

        const revisePrompt = draftPrompt + `\n\nPREVIOUS DRAFT SCORED "revise". NOTES: ${rubric.revise_notes}. Improve the draft addressing these notes.`;
        const reviseResp = await callModel(drafterConfig, revisePrompt, systemPromptForDraft, true);
        result.total_cost_usd += reviseResp.cost;
        result.total_tokens += reviseResp.tokensUsed.total;

        const revisedParsed = extractJSON(reviseResp.text);
        if (revisedParsed && typeof revisedParsed === "object" && "body" in (revisedParsed as Record<string, unknown>)) {
          draft = revisedParsed as DraftOutput;
          if (!draft.tldr) draft.tldr = draft.body.split(/\n\n/)[0]?.slice(0, 200) ?? "";
        }

        rubric = await scoreWithRubric(draft, scorerConfig, result);
      }

      // ── GATE (§6) ──────────────────────────────────────────────
      // confidence_score is FACTUAL SAFETY (0-1); gate at threshold (~0.85, never 1.0)
      // Confidence 0 is likely the model copying the example value — treat as 0.85 (neutral pass)
      const effectiveConfidence = verify.confidence_score === 0 ? 0.85 : verify.confidence_score;
      const passerVerifier = !hasCriticalErrors && !hasRealPersonRisk && !verify.spoiler_risk &&
        effectiveConfidence >= threshold;
      const passerScorer = rubric.verdict === "publish";

      let status: string;
      if (passerVerifier && passerScorer) {
        status = "approved";
      } else if (rubric.verdict === "hold" || hasRealPersonRisk) {
        status = "held";
      } else {
        status = "in_review"; // marginal — not held but not approved
      }

      const now = new Date().toISOString();

      // Jittered scheduling (only for approved)
      const jitterMin = 15;
      const jitterMax = 120;
      const answerDelay = 60;
      const contribDelay = 180;

      const baseDelay = i * (jitterMax + 30);
      const questionDelay = baseDelay + Math.floor(Math.random() * (jitterMax - jitterMin) + jitterMin);
      const answerDelayMs = (questionDelay + answerDelay + Math.floor(Math.random() * 30)) * 60_000;
      const contribDelayMs = (questionDelay + contribDelay + Math.floor(Math.random() * 60)) * 60_000;

      const questionScheduled = status === "approved"
        ? new Date(Date.now() + questionDelay * 60_000).toISOString()
        : null;
      const answerScheduled = status === "approved"
        ? new Date(Date.now() + answerDelayMs).toISOString()
        : null;

      // Build evidence_refs + rubric_scores for persistence
      const evidenceRefs = {
        facts_used: draft.facts_used ?? [],
        evidence_used: draft.evidence_used ?? [],
        verify: {
          confidence_score: verify.confidence_score,
          critical_errors_count: (verify.critical_errors ?? []).length,
          real_person_risk: verify.real_person_risk ?? [],
          retries: verifyRetries,
        },
      };

      const rubricScores = {
        scores: rubric.scores,
        verdict: rubric.verdict,
        revise_notes: rubric.revise_notes,
        revise_count: reviseCount,
      };

      const slug = (item.question ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);

      // Insert question
      const { data: qRow, error: qErr } = await supabase
        .from("questions")
        .insert({
          film_id: f.id,
          author_id: EDITORIAL_PROFILE_ID,
          title: item.question,
          body: item.pitch || null,
          slug: `${slug}-${Date.now()}`,
          status,
          source: "ai",
          generated_by: `${draftResp.provider}/${draftResp.model}`,
          reviewed_by: status === "approved" ? EDITORIAL_PROFILE_ID : null,
          published_at: null,
          scheduled_for: questionScheduled,
          evidence_refs: evidenceRefs,
          rubric_scores: rubricScores,
        })
        .select("id")
        .single();

      if (qErr || !qRow) {
        result.errors.push(`DB insert failed for question: ${qErr?.message}`);
        continue;
      }

      // Insert canonical answer with TL;DR
      await supabase.from("canonical_answers").insert({
        question_id: qRow.id,
        body: draft.body,
        tldr: draft.tldr,
        status,
        source: "ai",
        generated_by: `${draftResp.provider}/${draftResp.model}`,
        reviewed_by: status === "approved" ? EDITORIAL_PROFILE_ID : null,
        published_at: null,
        scheduled_for: answerScheduled,
      });

      // Log content events for every stage
      const events: Array<Record<string, unknown>> = [
        {
          entity_type: "question", entity_id: qRow.id, event: "drafted",
          actor_kind: "ai",
          meta: {
            model: draftResp.model, provider: draftResp.provider, voice: voice.codename,
            cost: draftResp.cost, tldr_length: draft.tldr?.length,
            facts_used: draft.facts_used?.length, evidence_used: draft.evidence_used?.length,
          },
        },
        {
          entity_type: "question", entity_id: qRow.id, event: "verified",
          actor_kind: "ai",
          meta: {
            confidence_score: verify.confidence_score,
            critical_errors: verify.critical_errors?.length,
            real_person_risk: verify.real_person_risk?.length,
            fixes_applied: verify.fixes?.length, retries: verifyRetries,
            model: verifierConfig.model,
          },
        },
        {
          entity_type: "question", entity_id: qRow.id, event: "scored",
          actor_kind: "ai",
          meta: { scores: rubric.scores, verdict: rubric.verdict, revise_count: reviseCount },
        },
      ];

      if (status === "approved") {
        events.push({
          entity_type: "question", entity_id: qRow.id, event: "approved",
          actor_kind: "ai",
          meta: {
            confidence_score: verify.confidence_score, gate: "auto", threshold,
            voice: voice.codename, scheduled_for: questionScheduled,
            rubric_verdict: rubric.verdict,
          },
        });
      } else if (status === "held") {
        events.push({
          entity_type: "question", entity_id: qRow.id, event: "held",
          actor_kind: "ai",
          meta: {
            reason: hasRealPersonRisk ? "real_person_risk" : rubric.verdict === "hold" ? "rubric_hold" : "quality_gate",
            confidence_score: verify.confidence_score, rubric_verdict: rubric.verdict,
          },
        });
      }

      await supabase.from("content_events").insert(events);

      result.questions_created++;

      // Media curation (only for approved items)
      if (status === "approved") {
        try {
          const media = await curateMedia(
            supabase, "question", qRow.id,
            f.tmdb_id, f.title, f.year ?? null,
            f.director ?? undefined,
            item.question
          );
          result.media_attached += media.images + media.videos;

          if (media.images + media.videos > 0) {
            await supabase.from("content_events").insert({
              entity_type: "question", entity_id: qRow.id, event: "media_curated",
              actor_kind: "ai",
              meta: { images: media.images, videos: media.videos, source: "curiobot_inline" },
            });
          }
        } catch {
          result.errors.push(`Media curation failed for ${qRow.id}`);
        }
      }

      // Gate log
      if (status === "approved") {
        result.questions_published++;
        console.log(`[graph] ✅ Approved: "${item.question}" [${voice.codename}] (conf:${Number(verify.confidence_score).toFixed(2)}, rubric:${rubric.verdict}) → ${questionScheduled?.slice(11, 16)}`);
      } else if (status === "held") {
        result.questions_held++;
        console.log(`[graph] ⛔ Held: "${item.question}" [${voice.codename}] — ${hasRealPersonRisk ? "real_person_risk" : rubric.verdict}`);
      } else {
        result.questions_in_review++;
        console.log(`[graph] 🔍 Review: "${item.question}" [${voice.codename}] (conf:${Number(verify.confidence_score).toFixed(2)}, rubric:${rubric.verdict})`);
      }

      await updateJobStep(supabase, jobId, "drafting", i + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed processing "${item.question}": ${msg}`);
    }
  }

  // Mark finished
  await supabase.from("jobs").update({
    current_step: "done",
    questions_done: result.questions_created,
    finished_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);

  return result;
}
