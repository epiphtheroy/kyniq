/**
 * Account-level streaming services (HANDOFF-회원가입-전환-설계.md §8 / P4). Persists a
 * member's subscriptions to their account so they survive across devices and reach
 * the room/navigator — previously localStorage-only. FAULT-SOFT: both calls swallow
 * errors, so until migration 0114 (me_services / me_set_services) is applied, the app
 * simply falls back to the existing localStorage behavior with no visible breakage.
 */
import { createBrowserClient } from "@supabase/ssr";

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function loadAccountServices(): Promise<{ country: string; providers: number[] } | null> {
  try {
    const { data, error } = await sb().rpc("me_services");
    if (error || !Array.isArray(data) || !data.length) return null;
    const row = data[0] as { country: string; providers: string[] | null };
    if (!row?.country) return null;
    const providers = (row.providers ?? []).map((x) => Number(x)).filter((n) => Number.isFinite(n));
    return { country: row.country, providers };
  } catch { return null; }
}

export async function saveAccountServices(country: string, providers: number[]): Promise<void> {
  try {
    await sb().rpc("me_set_services", { p_country: country || "US", p_providers: providers.map((n) => String(n)) });
  } catch { /* fault-soft: migration not applied yet → localStorage remains the source */ }
}
