/**
 * lib/crm/settings.ts — load/merge the crm_settings singleton (§5-9). Server-only
 * (takes a service-role client). Falls back to DEFAULT_SETTINGS for missing keys.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, type CrmSettings } from "./types";

export async function loadSettings(supabase: SupabaseClient): Promise<CrmSettings> {
  const { data } = await supabase.from("crm_settings").select("data").eq("id", 1).maybeSingle();
  const stored = (data?.data ?? {}) as Partial<CrmSettings>;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(supabase: SupabaseClient, patch: Partial<CrmSettings>): Promise<void> {
  const current = await loadSettings(supabase);
  const next = { ...current, ...patch };
  await supabase.from("crm_settings").upsert({ id: 1, data: next, updated_at: new Date().toISOString() });
}
