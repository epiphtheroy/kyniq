/**
 * Re-Audit — Post-publish automated re-verification (Loop 4)
 *
 * Periodically samples published questions and re-runs the verifier.
 * If confidence drops below threshold or new issues found → set to 'held'.
 * Safety net for the no-human-review pipeline (§6 gate, §3.2 safety net).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface ModelConfig {
  provider: string;
  model: string;
}

interface ModelResponse {
  text: string;
  tokensUsed: { prompt: number; completion: number; total: number };
  cost: number;
  model: string;
  provider: string;
}

const MODEL_PRICING: Record<string, [number, number]> = {
  "gemini-2.5-flash": [0.15, 0.60],
  "gpt-4o-mini": [0.15, 0.60],
};

function estimateCost(model: string, p: number, c: number): number {
  const pr = MODEL_PRICING[model] ?? [0.50, 1.50];
  return (p * pr[0] + c * pr[1]) / 1_000_000;
}

async function callGeminiForAudit(model: string, prompt: string, systemPrompt?: string): Promise<ModelResponse> {
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
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const u = data.usageMetadata ?? {};
  const pt = u.promptTokenCount ?? 0, ct = u.candidatesTokenCount ?? 0;
  return { text, tokensUsed: { prompt: pt, completion: ct, total: pt + ct }, cost: estimateCost(model, pt, ct), model, provider: "gemini" };
}

function extractJSON(text: string): unknown | null {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch { /* continue */ } }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch { /* continue */ } }
  return null;
}

export async function runReAudit(
  supabase: SupabaseClient,
  config?: { samplePercent?: number; model?: string; threshold?: number }
): Promise<{ audited: number; held: number; errors: number }> {
  const samplePercent = config?.samplePercent ?? 5;
  const model = config?.model ?? "gemini-2.5-flash";
  const threshold = config?.threshold ?? 0.7; // lower bar for re-audit (already passed once)

  let audited = 0;
  let held = 0;
  let errors = 0;

  // Count published questions
  const { count: totalPublished } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  if (!totalPublished || totalPublished === 0) {
    console.log("[re-audit] No published questions to audit");
    return { audited, held, errors };
  }

  const sampleSize = Math.max(1, Math.ceil((totalPublished * samplePercent) / 100));
  console.log(`[re-audit] Sampling ${sampleSize} of ${totalPublished} published questions (${samplePercent}%)`);

  // Random sample — fetch all IDs and pick randomly (simple approach for small datasets)
  const { data: allIds } = await supabase
    .from("questions")
    .select("id")
    .eq("status", "published");

  if (!allIds || allIds.length === 0) return { audited, held, errors };

  // Shuffle and take sample
  const shuffled = allIds.sort(() => Math.random() - 0.5).slice(0, sampleSize);

  for (const { id } of shuffled) {
    try {
      // Load question + answer
      const { data: q } = await supabase
        .from("questions")
        .select("id, title, body, film:films!inner(title, year, director, overview)")
        .eq("id", id)
        .single();

      if (!q) continue;

      const { data: answer } = await supabase
        .from("canonical_answers")
        .select("body")
        .eq("question_id", id)
        .eq("status", "published")
        .single();

      if (!answer?.body) continue;

      const film = q.film as unknown as { title: string; year: number; director: string; overview: string };

      const auditPrompt = `Re-audit this PUBLISHED answer. Check factual accuracy, real-person claims, and spoiler content. Be strict — this is live on the web.

FILM: "${film.title}" (${film.year}), dir. ${film.director}
OVERVIEW: ${film.overview?.slice(0, 500)}
QUESTION: ${q.title}
ANSWER: ${answer.body.slice(0, 2000)}

Return ONLY JSON:
{"confidence": 0.0, "issues": ["any problems found"], "real_person_risk": ["any risky claims"], "recommendation": "keep|hold"}`;

      const resp = await callGeminiForAudit(model, auditPrompt);
      audited++;

      const parsed = extractJSON(resp.text) as {
        confidence: number;
        issues: string[];
        real_person_risk: string[];
        recommendation: string;
      } | null;

      if (!parsed) continue;

      const shouldHold = parsed.recommendation === "hold" ||
        parsed.confidence < threshold ||
        (parsed.real_person_risk ?? []).length > 0;

      if (shouldHold) {
        held++;
        console.log(`[re-audit] ⛔ Holding: "${q.title}" — conf:${parsed.confidence}, issues:${parsed.issues?.length}`);

        // Set to held
        await supabase.from("questions").update({ status: "held" }).eq("id", id);
        await supabase.from("canonical_answers").update({ status: "held" }).eq("question_id", id);

        // Log event
        await supabase.from("content_events").insert({
          entity_type: "question",
          entity_id: id,
          event: "re_audited_held",
          actor_kind: "ai",
          meta: {
            confidence: parsed.confidence,
            issues: parsed.issues,
            real_person_risk: parsed.real_person_risk,
            model,
          },
        });
      } else {
        // Log clean audit
        await supabase.from("content_events").insert({
          entity_type: "question",
          entity_id: id,
          event: "re_audited_pass",
          actor_kind: "ai",
          meta: { confidence: parsed.confidence, model },
        });
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      errors++;
      console.error("[re-audit] Error:", err instanceof Error ? err.message : err);
    }
  }

  console.log(`[re-audit] Done: ${audited} audited, ${held} held, ${errors} errors`);
  return { audited, held, errors };
}
