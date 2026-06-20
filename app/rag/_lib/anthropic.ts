/**
 * Anthropic (Claude) generation adapter for the RAG route.
 *
 * Mirrors the shape of `@/lib/providers/openai` (openaiAdapter) so the route can
 * swap between OpenAI and Anthropic by model name with no other changes. Uses the
 * Anthropic Messages API. Cost is computed here with current Claude prices (the
 * shared MODEL_PRICING table doesn't carry the latest model names).
 *
 * Key handling: reads ANTHROPIC_API_KEY from the environment only — never
 * hard-coded. On a public repo, the key must live in the deployment env
 * (Vercel) / local .env.local, both of which are git-ignored.
 */
import type { ProviderAdapter, ModelResponse } from "@/lib/providers/types";

/** $ per 1M tokens [input, output] — 2026-06. */
const CLAUDE_PRICING: Record<string, [number, number]> = {
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-4-6": [3, 15],
  "claude-haiku-4-5-20251001": [1, 5],
};

function priceFor(model: string): [number, number] {
  if (CLAUDE_PRICING[model]) return CLAUDE_PRICING[model];
  const m = model.toLowerCase();
  if (m.includes("opus")) return [5, 25];
  if (m.includes("haiku")) return [1, 5];
  return [3, 15]; // sensible default = Sonnet tier
}

export const anthropicAdapter: ProviderAdapter = {
  async call(model, prompt, options = {}) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
        ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const text: string = Array.isArray(data?.content)
      ? data.content
          .filter((b: { type?: string }) => b?.type === "text")
          .map((b: { text?: string }) => b.text ?? "")
          .join("")
      : "";

    const promptTokens: number = data?.usage?.input_tokens ?? 0;
    const completionTokens: number = data?.usage?.output_tokens ?? 0;
    const [pin, pout] = priceFor(model);
    const cost = (promptTokens * pin + completionTokens * pout) / 1_000_000;

    return {
      text,
      tokensUsed: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
      },
      cost,
      model,
      provider: "anthropic",
    } satisfies ModelResponse;
  },
};
