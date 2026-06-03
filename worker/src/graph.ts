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
import { curateMedia } from "./kyniqbot.js";

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
  mode: string;
  why_it_matters: string;
  leads_to_insight: string;
  pitch: string;
  evidence_refs: string[];
  voice_id?: string;     // assigned by us after planning
}

interface DraftOutput {
  tldr: string;
  body: string;
  facts_used: string[];
  specifics_used: string[];
  comparisons_used: string[];
  reading_basis: string[];
  voice: string;
}

interface VerifyOutput {
  fact_checks: Array<{ claim: string; verdict: string; source: string }>;
  ungrounded_specifics: Array<{ detail: string; issue: string }>;
  comparison_checks: Array<{ comparison: string; verdict: string }>;
  real_person_risk: Array<{ claim: string; issue: string }>;
  spoiler_risk: boolean;
  fixes: Array<{ target: string; correction: string }>;
  confidence: number;
}

interface RubricOutput {
  scores: Record<string, number>;
  verdict: "publish" | "revise" | "hold";
  revise_notes: string;
}

interface Dossier {
  facts: Array<{ claim: string; source: string }>;
  context: Array<{ item: string; source: string }>;
  specifics: Array<{ detail: string; source_or_basis: string }>;
  comparisons: Array<{ other_film: string; shared_attribute: string; source: string }>;
  observations: Array<{ reading: string; anchored_to: string }>;
  uncertainties: string[];
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

// ── Editorial Constitution (§0 — prepended to EVERY stage call) ──

const EDITORIAL_CONSTITUTION = `You write for Kyniq, which aims to be the most insightful film-interpretation resource on the web. Your standard is depth, not summary.

THE GOAL (understand the whole point)
Kyniq wants to be the film resource AI engines and serious viewers trust most. Every answer should read as if written by someone who *actually watched this film* and perceived it with the discernment of an authority — and should be unmistakably about THIS film and THIS question, not a template. Hold all the rules below in service of that.

METHOD
- Observe before you theorize. Anchor every interpretive claim in something concrete and verifiable — a specific shot, cut, line, gesture, repetition, structural choice, or a sourced production fact. No floating abstractions.
- Build an arc: rich, verified facts and context (production background, telling trivia, extra-textual connections people enjoy) are the ON-RAMP; they must climb toward an insightful interpretive CONCLUSION. Never stop at trivia. Facts serve the insight.
- Prefer productive uncertainty to forced verdicts. It is good to hold two readings in tension — but never hedge the opening answer into mush.
- Voice: conversational and warm, like a sharp friend who watched closely and thought hard. Deep underneath, plain on top. Show the idea; don't name-drop jargon.

DEMONSTRATE GENUINE, EXPERT VIEWING (the experience/authority signal)
- Write so it's clear you truly saw the film and perceived it finely: name precise, grounded details (a specific image, a line, a cut, a recurring motif, a structural turn); place it against the director's other work or comparable films where it illuminates; let an experiential register show (what the moment does to a watching viewer) — the texture of real attention.
- CRITICAL GUARD: that authority must come ONLY from details grounded in the dossier (verified facts + the dossier's flagged observations). **Never invent a specific — a scene, a line, a shot — to sound authoritative.** A fabricated detail is worse than a general one. If the grounded specifics are thin, reach for fewer but real ones, and lean on structure/idea.
- Comparisons to other films must be to REAL films with attributes that are actually true of them; if you're not sure the comparison holds, don't make it.

STAY DISTINCT — no repetition bias (this method runs across ~10,000 items)
- Drive each answer from THIS film's internal elements and THIS question's specific essence, with the cinematic evidence OPTIMIZED to that question. Do not apply a portable template, a stock opening, a habitual structure, or a go-to theory move across films. If a sentence could sit unchanged under a different film/question, cut or rewrite it.
- Let the film and the question choose the shape and the evidence — not your house formula.

EVIDENCE & TRUTH (critical — nothing here is human-reviewed)
- Separate FACTS (verifiable, sourced) from READINGS (your interpretation). State facts plainly; frame readings as readings ("one way to read this…", "the film seems to…").
- NEVER assert an unsourced specific as fact. If you are not sure a detail is true, treat it as a reading or omit it.
- About real people (directors, actors, crew): only sourced, non-defamatory facts. No rumor, no speculation about private lives, no unverified gossip. When in doubt, leave it out.
- Citation-ready: open with a direct, self-contained answer; keep claims specific.
- Never fabricate sources, users, or engagement.`;

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
    const res = await fetch(
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
  try { return JSON.parse(text); } catch { /* continue */ }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* continue */ }
  }

  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* continue */ }
  }
  const arrMatch = text.match(/\[[\s\S]*\]/);
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
    console.log(`[dossier] Cache hit for "${film.title}"`);
    return cached.dossier as Dossier;
  }

  console.log(`[dossier] Building dossier for "${film.title}"...`);

  const dossierPrompt = `Build an evidence dossier for the film below. Gather BOTH (a) rich verifiable facts/context that make good connective tissue, and (b) the deep interpretive threads worth pursuing. ALSO collect **grounded specific details** the writers can use to show genuine viewing (precise images, lines, cuts, motifs, structural turns — only ones you can ground), and **real comparison points** (other films / the director's other work, with the attribute that makes the comparison true). Mark every item as fact (with a source) or reading (interpretation). Real-person claims need a source.

FILM: ${film.title} (${film.year}), dir. ${film.director}. TMDB overview: ${film.overview}. Genres: ${(film.genres ?? []).join(", ")}. Keywords: ${(film.keywords ?? []).join(", ")}.

Return ONLY JSON:
{
  "facts":        [{"claim": "...", "source": "TMDB|Wikidata|<url>"}],
  "context":      [{"item": "production/trivia/extra-textual fact", "source": "..."}],
  "specifics":    [{"detail": "precise grounded image/line/cut/motif/structure", "source_or_basis": "..."}],
  "comparisons":  [{"other_film": "real title", "shared_attribute": "what's actually true of it", "source": "..."}],
  "observations": [{"reading": "interpretive thread", "anchored_to": "concrete basis in the film"}],
  "uncertainties":["open questions / contested readings"]
}
No prose. Do not invent sources, specifics, or comparisons. Omit anything you cannot ground.`;

  const resp = await callModel(dossierConfig, dossierPrompt, EDITORIAL_CONSTITUTION, true);
  result.total_cost_usd += resp.cost;
  result.total_tokens += resp.tokensUsed.total;

  const parsed = extractJSON(resp.text);
  if (!parsed || typeof parsed !== "object" || !("facts" in (parsed as Record<string, unknown>))) {
    console.log("[dossier] Failed to parse dossier, using minimal fallback");
    const fallback: Dossier = {
      facts: [{ claim: `${film.title} (${film.year}), directed by ${film.director}`, source: "TMDB" }],
      context: [], specifics: [], comparisons: [], observations: [], uncertainties: [],
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

  console.log(`[dossier] Built: ${dossier.facts.length} facts, ${dossier.specifics.length} specifics, ${dossier.comparisons.length} comparisons`);

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
    const verifyPrompt = `Fact-check the draft against the dossier/sources. You are the last line before publish; no human will review this. Check every factual claim and every statement about a real person. Also confirm that **every specific detail and every film-comparison in the draft is grounded in the dossier** (\`specifics\`/\`comparisons\`) and that comparisons are actually true of the films named — flag any detail or comparison that appears invented or inaccurate (fabricated authority is a failure). Where a claim is wrong/unsupported, emit a TARGETED FIX (don't rewrite the whole thing). Flag spoilers.

DRAFT: ${body.slice(0, 3000)}
DOSSIER: ${dossierJson.slice(0, 3000)}
FILM: "${film.title}" (${film.year}), dir. ${film.director}
QUESTION: ${question}

Return ONLY JSON:
{"fact_checks":[{"claim":"...", "verdict":"supported|wrong|unsupported", "source":"..."}],
 "ungrounded_specifics":[{"detail":"...", "issue":"not in dossier|inaccurate"}],
 "comparison_checks":[{"comparison":"...", "verdict":"accurate|inaccurate|ungrounded"}],
 "real_person_risk":[{"claim":"...", "issue":"unsourced|speculative|defamatory"}],
 "spoiler_risk": false,
 "fixes":[{"target":"exact text to change", "correction":"replacement or 'remove'"}],
 "confidence": 0.0}`;

    const resp = await callModel(verifierConfig, verifyPrompt, EDITORIAL_CONSTITUTION, true);
    result.total_cost_usd += resp.cost;
    result.total_tokens += resp.tokensUsed.total;

    const parsed = extractJSON(resp.text) as VerifyOutput | null;
    const verify: VerifyOutput = parsed && "confidence" in parsed
      ? parsed
      : { fact_checks: [], ungrounded_specifics: [], comparison_checks: [], real_person_risk: [], spoiler_risk: false, fixes: [], confidence: 0.5 };

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
  return { finalBody: body, verify: { fact_checks: [], ungrounded_specifics: [], comparison_checks: [], real_person_risk: [], spoiler_risk: false, fixes: [], confidence: 0.5 }, retries: MAX_VERIFY_RETRIES };
}

// ── Rubric Scorer + Revise Loop (§5) ─────────────────────────────

function codePreChecks(draft: DraftOutput, voice: VoiceConfig): string[] {
  const failures: string[] = [];
  if (!draft.tldr || draft.tldr.length < 10) failures.push("Missing or too short TL;DR");
  if (!draft.facts_used || draft.facts_used.length === 0) failures.push("No facts_used");
  if (!draft.reading_basis || draft.reading_basis.length === 0) failures.push("No reading_basis");

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
  const scorePrompt = `Score the draft 1–5 on each dimension. Kyniq's bar is DEPTH; reward insight and the facts→insight arc; reward writing that reads as genuine, expert viewing (grounded specifics, apt real comparison); penalize fragmentary/summary-only/shallow answers AND anything that reads as a reusable template rather than a piece about THIS film and THIS question.

DRAFT TL;DR: ${draft.tldr}
DRAFT BODY (first 2000 chars): ${draft.body.slice(0, 2000)}
VOICE: ${draft.voice}
FACTS USED: ${draft.facts_used.length}, SPECIFICS USED: ${draft.specifics_used.length}, COMPARISONS USED: ${draft.comparisons_used.length}

Return ONLY JSON:
{"scores":{
   "insight_depth":1, "fact_to_insight_arc":1, "evidence_grounding":1,
   "demonstrated_viewing":1, "distinctiveness":1,
   "productive_uncertainty":1, "voice_fit":1, "accessibility":1,
   "citation_readiness":1, "non_fragmentary":1 },
 "verdict":"publish|revise|hold",
 "revise_notes":"what to deepen / where it reads generic if revise"}`;

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
  const gateConfig = (configMap.get("gate_threshold") ?? { default: 0.85 }) as { default: number };
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

  const planPrompt = `From the dossier, propose ~12 candidate questions a real viewer would actually ask, then select the ${j.target_count} strongest. PRIORITIZE questions whose answer REQUIRES insight (meaning, ambiguity, structure, the director's signature, the emotional core) over trivia-only questions. Vary the type. Phrase each the way a person would ask it (conversational), not as an essay prompt.

For each selected question, write a PITCH: 1–2 sentences, vivid and a little dramatic — make me want to read it — but honest, never clickbait.

DOSSIER: ${dossierJson.slice(0, 4000)}
FILM: "${f.title}" (${f.year}), dir. ${f.director}
GENRES: ${(f.genres ?? []).join(", ")}

Existing questions to AVOID duplicating:
${existingTitles.slice(0, 20).join("\n")}

Return ONLY JSON array:
[{"question":"...", "mode":"meaning|symbol|character|ambiguity|form|structure|theme|signature|emotional",
  "why_it_matters":"...", "leads_to_insight":"how the answer climbs to insight",
  "pitch":"...", "evidence_refs":["dossier items it will draw on"]}]`;

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

      const draftPrompt = `Write the answer to the question, in the assigned voice. Follow the arc: open with a self-contained, citable answer (TL;DR ≤40 words) → lay in the rich verified facts/context that connect to it (the part readers love) → CLIMB to an insightful interpretive conclusion (the payoff). Use ONLY the dossier's verified facts; frame interpretation as reading. Length per the voice's band. Real-person claims: sourced facts only.

SHOW GENUINE VIEWING: weave in 1–3 precise grounded specifics from the dossier and, where it illuminates, one apt real comparison — so it reads as written by someone who truly saw and finely perceived the film. **Never invent a detail or a comparison to sound authoritative**; if grounded specifics are thin, use fewer real ones and lean on idea/structure.

STAY DISTINCT: build from THIS question's specific essence and the evidence OPTIMIZED to it — not a portable template. No stock opening, no habitual structure, no go-to theory move. If a sentence could sit unchanged under another film or question, rewrite it.

QUESTION: ${item.question}
PITCH: ${item.pitch ?? ""}
WHY IT MATTERS: ${item.why_it_matters ?? ""}
VOICE: ${voice.codename} — ${voice.register}, ${voice.length_band} words. ${voice.description}
DOSSIER: ${dossierJson.slice(0, 4000)}

Return ONLY JSON:
{"tldr":"...", "body":"...", "facts_used":["dossier fact ids"], "specifics_used":["dossier specific ids"],
 "comparisons_used":["dossier comparison ids"], "reading_basis":["concrete anchors for each interpretive claim"],
 "voice":"${voice.id}"}`;

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
      const hasUngroundedSpecifics = (verify.ungrounded_specifics ?? []).filter(
        (s) => s.issue === "not in dossier"
      ).length > 2; // Allow 1-2 minor gaps

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
      const allFactsSupported = (verify.fact_checks ?? []).every(
        (c) => c.verdict === "supported"
      );
      const passerVerifier = allFactsSupported && !hasRealPersonRisk && !verify.spoiler_risk &&
        verify.confidence >= threshold && !hasUngroundedSpecifics;
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
        specifics_used: draft.specifics_used ?? [],
        comparisons_used: draft.comparisons_used ?? [],
        reading_basis: draft.reading_basis ?? [],
        verify: {
          confidence: verify.confidence,
          fact_checks_count: (verify.fact_checks ?? []).length,
          ungrounded_count: (verify.ungrounded_specifics ?? []).length,
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
            facts_used: draft.facts_used?.length, specifics_used: draft.specifics_used?.length,
            comparisons_used: draft.comparisons_used?.length,
          },
        },
        {
          entity_type: "question", entity_id: qRow.id, event: "verified",
          actor_kind: "ai",
          meta: {
            confidence: verify.confidence, fact_checks: verify.fact_checks?.length,
            ungrounded: verify.ungrounded_specifics?.length,
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
            confidence: verify.confidence, gate: "auto", threshold,
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
            confidence: verify.confidence, rubric_verdict: rubric.verdict,
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
            item.question
          );
          result.media_attached += media.images + media.videos;

          if (media.images + media.videos > 0) {
            await supabase.from("content_events").insert({
              entity_type: "question", entity_id: qRow.id, event: "media_curated",
              actor_kind: "ai",
              meta: { images: media.images, videos: media.videos, source: "kyniqbot_inline" },
            });
          }
        } catch {
          result.errors.push(`Media curation failed for ${qRow.id}`);
        }
      }

      // Gate log
      if (status === "approved") {
        result.questions_published++;
        console.log(`[graph] ✅ Approved: "${item.question}" [${voice.codename}] (conf:${verify.confidence.toFixed(2)}, rubric:${rubric.verdict}) → ${questionScheduled?.slice(11, 16)}`);
      } else if (status === "held") {
        result.questions_held++;
        console.log(`[graph] ⛔ Held: "${item.question}" [${voice.codename}] — ${hasRealPersonRisk ? "real_person_risk" : rubric.verdict}`);
      } else {
        result.questions_in_review++;
        console.log(`[graph] 🔍 Review: "${item.question}" [${voice.codename}] (conf:${verify.confidence.toFixed(2)}, rubric:${rubric.verdict})`);
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
