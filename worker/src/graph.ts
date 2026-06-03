/**
 * Pipeline Graph — per-job orchestration
 *
 * Planner → Drafter×N → Verifier×N → Media → Gate
 *
 * v2: Voice-aware (editorial-voices.md), heartbeat writes,
 *     no question_type taxonomy, step tracking on jobs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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
  question_title: string;
  question_body: string;
  voice_id: string;
}

interface VerifyResult {
  confidence: number;
  checks: string[];
  issues: string[];
  model: string;
}

export interface JobResult {
  questions_created: number;
  questions_published: number;
  questions_in_review: number;
  total_cost_usd: number;
  total_tokens: number;
  media_attached: number;
  errors: string[];
}

// ── Editorial profile ─────────────────────────────────────────────

const EDITORIAL_PROFILE_ID = "00000000-0000-0000-0000-000000000001";

// ── Provider helpers (inline for worker — no Next.js path aliases) ──

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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          ...(jsonMode && { responseMimeType: "application/json" }),
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const u = data.usageMetadata ?? {};
  const pt = u.promptTokenCount ?? 0, ct = u.candidatesTokenCount ?? 0;

  return { text, tokensUsed: { prompt: pt, completion: ct, total: pt + ct }, cost: estimateCost(model, pt, ct), model, provider: "gemini" };
}

async function callOpenAI(model: string, prompt: string, systemPrompt?: string, jsonMode = false): Promise<ModelResponse> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = { model, messages, temperature: 0.4, max_tokens: 2048 };
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

// ── TMDB Image Curation (inline — no Next.js imports) ──

async function curateTMDBImages(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  filmTmdbId: number,
  maxImages = 3
): Promise<number> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return 0;

  const res = await fetch(`https://api.themoviedb.org/3/movie/${filmTmdbId}/images`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) return 0;

  const data = await res.json();
  const backdrops = (data.backdrops ?? []).sort((a: { vote_average: number }, b: { vote_average: number }) => b.vote_average - a.vote_average).slice(0, maxImages);

  if (backdrops.length === 0) return 0;

  const rows = backdrops.map((img: { file_path: string; vote_average: number }, i: number) => ({
    entity_type: entityType,
    entity_id: entityId,
    kind: "image",
    source: "tmdb",
    external_id: img.file_path,
    url: `https://image.tmdb.org/t/p/w1280${img.file_path}`,
    thumbnail_url: `https://image.tmdb.org/t/p/w780${img.file_path}`,
    attribution: "Image © TMDB",
    position: i,
    added_by: "ai",
    confidence: Math.min(img.vote_average / 10, 1),
    status: "published",
  }));

  const { error } = await supabase.from("media").insert(rows);
  return error ? 0 : rows.length;
}

// ── Heartbeat helper ──────────────────────────────────────────────

export async function writeHeartbeat(
  supabase: SupabaseClient,
  workerId: string,
  state: "idle" | "running" | "paused",
  message: string,
  currentJobId: string | null = null,
  todayPublished?: number,
  todayCost?: number
): Promise<void> {
  const row: Record<string, unknown> = {
    worker_id: workerId,
    state,
    message,
    current_job_id: currentJobId,
    last_heartbeat_at: new Date().toISOString(),
  };
  if (todayPublished !== undefined) row.today_published = todayPublished;
  if (todayCost !== undefined) row.today_cost = todayCost;

  await supabase
    .from("agent_activity")
    .upsert(row, { onConflict: "worker_id" });
}

// ── Job step tracking ─────────────────────────────────────────────

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
    total_cost_usd: 0,
    total_tokens: 0,
    media_attached: 0,
    errors: [],
  };

  // Mark started
  await supabase.from("jobs").update({
    started_at: new Date().toISOString(),
    current_step: "planning",
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
  const gateConfig = (configMap.get("gate_threshold") ?? { default: 0.85 }) as { default: number; auto_publish_min?: number };
  const threshold = (j.params.threshold as number) ?? gateConfig.default;

  const drafterConfig = routerConfig.drafter ?? { provider: "gemini", model: "gemini-2.5-flash" };
  const verifierConfig = routerConfig.verifier ?? { provider: "openai", model: "gpt-4o-mini" };
  const plannerConfig = routerConfig.planner ?? drafterConfig;

  // ── PLANNER ─────────────────────────────────────────────────────
  console.log(`[graph] Planning ${j.target_count} questions for "${f.title}"`);

  await writeHeartbeat(supabase, workerId, "running", `planning questions for "${f.title}"`, jobId);

  const { data: existingQs } = await supabase
    .from("questions")
    .select("title")
    .eq("film_id", f.id);
  const existingTitles = (existingQs ?? []).map((q) => q.title.toLowerCase());

  // Build voice listing for the planner
  const voiceSummary = voices.map((v) => `${v.id} (${v.codename}, ${v.register}, ${v.length_band} words): ${v.description}`).join("\n");

  const planPrompt = `You are planning ${j.target_count} genuinely important questions about the film "${f.title}" (${f.year}, directed by ${f.director}).

Film overview: ${f.overview}
Genres: ${(f.genres ?? []).join(", ")}
Keywords: ${(f.keywords ?? []).join(", ")}

IMPORTANT: Questions should emerge from the film itself — what a real viewer would actually wonder about. Do NOT use a fixed category taxonomy. Several questions may cluster around one theme; that's fine.

Available editorial voices (assign one per question, varying across the set):
${voiceSummary}

VOICE ASSIGNMENT GUIDE:
- "frame" for questions about cinematography, shots, editing, sound design
- "pulse" for questions about characters, relationships, emotional moments
- "drift" for big thematic/philosophical questions, central tensions
- "spark" for quirky details, witty observations, specific small moments
- "reel" for common "what does this mean" questions, entry-level queries
- Mix voices so the ${j.target_count} answers vary in length and temperament

Existing questions to AVOID duplicating:
${existingTitles.slice(0, 20).join("\n")}

Generate ${j.target_count} unique, searchable questions. Each should be phrased the way someone would actually ask (e.g. "Why does she open the window at the end?" not "Analyze the symbolism of window imagery").

Return JSON array:
[{ "question_title": "...", "question_body": "optional brief context", "voice_id": "spark|frame|pulse|drift|reel" }]`;

  const planResp = await callModel(plannerConfig, planPrompt, undefined, true);
  result.total_cost_usd += planResp.cost;
  result.total_tokens += planResp.tokensUsed.total;

  let plan: PlanItem[];
  try {
    const parsed = JSON.parse(planResp.text);
    plan = Array.isArray(parsed) ? parsed : [];
  } catch {
    plan = [];
    result.errors.push("Failed to parse planner output");
  }

  // Dedup
  plan = plan.filter((p) => !existingTitles.includes(p.question_title.toLowerCase()));
  plan = plan.slice(0, j.target_count);

  // ── DRAFTER + VERIFIER + GATE for each question ─────────────────
  await updateJobStep(supabase, jobId, "drafting", 0);

  for (let i = 0; i < plan.length; i++) {
    const item = plan[i];
    try {
      const voice = voices.find((v) => v.id === item.voice_id) ?? voices[0];
      if (!voice) {
        result.errors.push(`No voice found for ${item.voice_id}`);
        continue;
      }

      // Heartbeat: drafting N/total
      await writeHeartbeat(
        supabase, workerId, "running",
        `drafting ${i + 1}/${plan.length} for "${f.title}" [${voice.codename}]`,
        jobId, result.questions_published, result.total_cost_usd
      );
      await updateJobStep(supabase, jobId, "drafting", i);

      // 5a. Draft — voice-aware
      const draftPrompt = `Write an answer to this question about the film "${f.title}" (${f.year}, directed by ${f.director}).

Question: ${item.question_title}
${item.question_body ? `Context: ${item.question_body}` : ""}

Film overview: ${f.overview}
Genres: ${(f.genres ?? []).join(", ")}

CRITICAL FORMAT RULES:
1. Start with a standalone 1–2 sentence direct answer (≤ ~40 words) that can be quoted verbatim
2. Then elaborate in your voice's style and length band (${voice.length_band} words total)
3. Anchor in something on screen first, then reach for meaning
4. Modular paragraphs, each self-contained — no long unbroken walls
5. Do NOT invent facts about cast, scenes, or plot; stick to what's in the film

Return JSON:
{
  "answer_body": "Full answer — claim-first opening sentence, then elaboration in voice",
  "contributions": [{ "body": "One alternative reading (2-3 sentences, different angle)" }]
}`;

      const draftResp = await callModel(drafterConfig, draftPrompt, voice.system_prompt_suffix, true);
      result.total_cost_usd += draftResp.cost;
      result.total_tokens += draftResp.tokensUsed.total;

      let draft: { answer_body: string; contributions: Array<{ body: string }> };
      try {
        draft = JSON.parse(draftResp.text);
      } catch {
        result.errors.push(`Failed to parse draft for: ${item.question_title}`);
        continue;
      }

      // 5b. Verify (DIFFERENT PROVIDER)
      await writeHeartbeat(
        supabase, workerId, "running",
        `verifying ${i + 1}/${plan.length} for "${f.title}"`,
        jobId, result.questions_published, result.total_cost_usd
      );
      await updateJobStep(supabase, jobId, "verifying", i);

      const verifyPrompt = `Fact-check this film analysis. The film is "${f.title}" (${f.year}, directed by ${f.director}).
TMDB overview: ${f.overview}
Genres: ${(f.genres ?? []).join(", ")}

Question: ${item.question_title}
Answer: ${draft.answer_body.slice(0, 2000)}

Check ONLY factual claims (title, year, director, cast, plot facts, scenes mentioned). Interpretation is NOT fact-checked — only verifiable facts + coherence.

Return JSON:
{
  "confidence": 0.0 to 1.0,
  "checks": ["what you verified"],
  "issues": ["any factual errors found"]
}`;

      const verifyResp = await callModel(verifierConfig, verifyPrompt, undefined, true);
      result.total_cost_usd += verifyResp.cost;
      result.total_tokens += verifyResp.tokensUsed.total;

      let verify: VerifyResult;
      try {
        const parsed = JSON.parse(verifyResp.text);
        verify = { ...parsed, model: verifyResp.model };
      } catch {
        verify = { confidence: 0.5, checks: [], issues: ["Failed to parse verification"], model: verifyResp.model };
      }

      // 5c. Write to DB
      const slug = item.question_title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);

      const shouldPublish = verify.confidence >= threshold && verify.issues.length === 0;
      const status = shouldPublish ? "published" : "in_review";
      const now = new Date().toISOString();

      // Insert question (no question_type — questions emerge from the film)
      const { data: qRow, error: qErr } = await supabase
        .from("questions")
        .insert({
          film_id: f.id,
          author_id: EDITORIAL_PROFILE_ID,
          title: item.question_title,
          body: item.question_body || null,
          slug: `${slug}-${Date.now()}`,
          status,
          source: "ai",
          generated_by: `${draftResp.provider}/${draftResp.model}`,
          reviewed_by: shouldPublish ? EDITORIAL_PROFILE_ID : null,
          published_at: shouldPublish ? now : null,
        })
        .select("id")
        .single();

      if (qErr || !qRow) {
        result.errors.push(`DB insert failed for question: ${qErr?.message}`);
        continue;
      }

      // Insert canonical answer
      await supabase.from("canonical_answers").insert({
        question_id: qRow.id,
        body: draft.answer_body,
        status,
        source: "ai",
        generated_by: `${draftResp.provider}/${draftResp.model}`,
        reviewed_by: shouldPublish ? EDITORIAL_PROFILE_ID : null,
        published_at: shouldPublish ? now : null,
      });

      // Insert contributions
      for (const contrib of draft.contributions ?? []) {
        await supabase.from("contributions").insert({
          question_id: qRow.id,
          author_id: EDITORIAL_PROFILE_ID,
          body: contrib.body,
          status,
          source: "ai",
          generated_by: `${draftResp.provider}/${draftResp.model}`,
          published_at: shouldPublish ? now : null,
        });
      }

      // Log content events
      await supabase.from("content_events").insert([
        {
          entity_type: "question",
          entity_id: qRow.id,
          event: "generated",
          actor_kind: "ai",
          meta: { model: draftResp.model, provider: draftResp.provider, voice: voice.codename, cost: draftResp.cost },
        },
        {
          entity_type: "question",
          entity_id: qRow.id,
          event: "verified",
          actor_kind: "ai",
          meta: { confidence: verify.confidence, checks: verify.checks, issues: verify.issues, model: verify.model, provider: verifyResp.provider },
        },
      ]);

      result.questions_created++;

      // 5d. Media curation
      try {
        const mediaCount = await curateTMDBImages(supabase, "question", qRow.id, f.tmdb_id, 2);
        result.media_attached += mediaCount;

        if (mediaCount > 0) {
          await supabase.from("content_events").insert({
            entity_type: "question",
            entity_id: qRow.id,
            event: "media_curated",
            actor_kind: "ai",
            meta: { images: mediaCount, source: "tmdb" },
          });
        }
      } catch {
        result.errors.push(`Media curation failed for ${qRow.id}`);
      }

      // 5e. Gate
      if (shouldPublish) {
        result.questions_published++;

        await supabase.from("content_events").insert({
          entity_type: "question",
          entity_id: qRow.id,
          event: "published",
          actor_kind: "ai",
          meta: { confidence: verify.confidence, gate: "auto", threshold, voice: voice.codename },
        });

        console.log(`[graph] ✅ Published: "${item.question_title}" [${voice.codename}] (${verify.confidence.toFixed(2)})`);
      } else {
        result.questions_in_review++;
        console.log(`[graph] 🔍 In review: "${item.question_title}" [${voice.codename}] (${verify.confidence.toFixed(2)})`);
      }

      await updateJobStep(supabase, jobId, "drafting", i + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed processing "${item.question_title}": ${msg}`);
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
