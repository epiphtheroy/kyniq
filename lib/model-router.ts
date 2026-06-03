/**
 * Model Router — config-driven multi-provider abstraction.
 *
 * Reads `pipeline_config.model_router` from Supabase to determine which
 * provider/model handles each role (planner, drafter, verifier, tone_reviewer).
 * Changing the model for a role = changing a DB row, no code change.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { geminiAdapter } from "./providers/gemini";
import { openaiAdapter } from "./providers/openai";
import type { ModelConfig, ModelResponse, ProviderAdapter } from "./providers/types";

// ── Provider registry ─────────────────────────────────────────────

const providers: Record<string, ProviderAdapter> = {
  gemini: geminiAdapter,
  openai: openaiAdapter,
};

// ── Config cache (short TTL) ──────────────────────────────────────

let configCache: Record<string, ModelConfig> | null = null;
let configCacheTime = 0;
const CONFIG_TTL_MS = 60_000; // 1 minute

async function getRouterConfig(): Promise<Record<string, ModelConfig>> {
  const now = Date.now();
  if (configCache && now - configCacheTime < CONFIG_TTL_MS) {
    return configCache;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pipeline_config")
    .select("value")
    .eq("key", "model_router")
    .single();

  if (error || !data) {
    // Fallback defaults
    return {
      planner: { provider: "gemini", model: "gemini-2.5-flash" },
      drafter: { provider: "gemini", model: "gemini-2.5-flash" },
      verifier: { provider: "openai", model: "gpt-4o-mini" },
      tone_reviewer: { provider: "gemini", model: "gemini-2.5-flash" },
    };
  }

  configCache = data.value as Record<string, ModelConfig>;
  configCacheTime = now;
  return configCache;
}

// ── Public API ────────────────────────────────────────────────────

export type PipelineRole =
  | "planner"
  | "drafter"
  | "verifier"
  | "tone_reviewer";

/**
 * Call the model assigned to a pipeline role.
 * The role→provider/model mapping is read from `pipeline_config`.
 */
export async function callModel(
  role: PipelineRole,
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    systemPrompt?: string;
  }
): Promise<ModelResponse> {
  const config = await getRouterConfig();
  const roleConfig = config[role];

  if (!roleConfig) {
    throw new Error(`No model configured for role: ${role}`);
  }

  const adapter = providers[roleConfig.provider];
  if (!adapter) {
    throw new Error(`Unknown provider: ${roleConfig.provider}`);
  }

  return adapter.call(roleConfig.model, prompt, options);
}

/**
 * Invalidate the config cache (e.g. after admin updates config).
 */
export function invalidateRouterCache(): void {
  configCache = null;
  configCacheTime = 0;
}

/**
 * Get the current config for inspection (admin UI).
 */
export async function getRouterConfigPublic(): Promise<
  Record<string, ModelConfig>
> {
  return getRouterConfig();
}
