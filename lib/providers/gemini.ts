/* Gemini provider adapter */

import { type ProviderAdapter, type ModelResponse, estimateCost } from "./types";

export const geminiAdapter: ProviderAdapter = {
  async call(model, prompt, options = {}) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY not configured");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (options.systemPrompt) {
      contents.push({ role: "user", parts: [{ text: options.systemPrompt }] });
      contents.push({
        role: "model",
        parts: [{ text: "Understood. I will follow these instructions." }],
      });
    }
    contents.push({ role: "user", parts: [{ text: prompt }] });

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 4096,
        ...(options.jsonMode && { responseMimeType: "application/json" }),
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const usage = data.usageMetadata ?? {};
    const promptTokens = usage.promptTokenCount ?? 0;
    const completionTokens = usage.candidatesTokenCount ?? 0;

    return {
      text,
      tokensUsed: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
      },
      cost: estimateCost(model, promptTokens, completionTokens),
      model,
      provider: "gemini",
    } satisfies ModelResponse;
  },
};
