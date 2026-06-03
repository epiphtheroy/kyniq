/* Provider response types shared across all adapters */

export interface ModelResponse {
  text: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Estimated cost in USD (model-specific pricing) */
  cost: number;
  model: string;
  provider: string;
}

export interface ModelConfig {
  provider: string;
  model: string;
}

export interface ProviderAdapter {
  call(
    model: string,
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
      systemPrompt?: string;
    }
  ): Promise<ModelResponse>;
}

/** Pricing per 1M tokens [input, output] in USD */
export const MODEL_PRICING: Record<string, [number, number]> = {
  // Gemini
  "gemini-2.5-flash": [0.15, 0.60],
  "gemini-2.0-flash": [0.10, 0.40],
  "gemini-1.5-pro": [3.50, 10.50],
  // OpenAI
  "gpt-4o-mini": [0.15, 0.60],
  "gpt-4o": [2.50, 10.00],
  "gpt-4.1-mini": [0.40, 1.60],
  // Anthropic
  "claude-sonnet-4-20250514": [3.00, 15.00],
  "claude-3-5-haiku-20241022": [0.80, 4.00],
};

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? [0.50, 1.50]; // fallback
  return (promptTokens * pricing[0] + completionTokens * pricing[1]) / 1_000_000;
}
