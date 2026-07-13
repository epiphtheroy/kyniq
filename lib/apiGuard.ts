/**
 * apiGuard — shared harvest-guard + CORS helpers for the public read APIs
 * (/api/pack, /api/mcp, /api/v1). Keeps the 0091 velocity guard and the trusted
 * AI-platform egress exemption in one place so every public surface behaves the
 * same. See HANDOFF-MCP-서버.md §4.
 */
import type { createAdminClient } from "@/lib/supabase/admin";
import { ipToPrefix } from "@/lib/ip-prefix";

// AI-platform egress exempt from BLOCKING (still ledgered by callers that ledger).
// Anthropic: 160.79.104.0/21 (observed live 160.79.106.0/24, UA Claude-User).
// Add other platforms only once observed in a ledger — never speculatively.
export const TRUSTED_EGRESS = /^160\.79\.(10[4-9]|11[01])\./;

export function callerPrefix(req: Request): { rawIp: string; prefix: string | null; trusted: boolean } {
  const rawIp = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "").split(",")[0].trim();
  return { rawIp, prefix: ipToPrefix(rawIp || null), trusted: TRUSTED_EGRESS.test(rawIp) };
}

/**
 * Note this hit against the per-/24 velocity counter (0091) and report whether
 * the prefix is now over the harvest threshold. Fail-open + trusted-egress-exempt:
 * a guard error or a trusted caller never blocks a legitimate request.
 */
export async function harvestBlocked(
  db: ReturnType<typeof createAdminClient>,
  prefix: string | null,
  trusted: boolean
): Promise<boolean> {
  if (!prefix || trusted) return false;
  try {
    const { data } = await db.rpc("pack_note_hit", { p_prefix: prefix });
    return !!(data && typeof data === "object" && (data as { blocked?: boolean }).blocked);
  } catch {
    return false; // fail-open
  }
}

// Public read APIs are CORS-open (browser extension + embed widget consume them
// cross-origin; the data is public first-party content).
export const API_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "x-robots-tag": "noindex",
};

export const TOO_MANY = { error: "Automated bulk access detected. This is public content — please slow down or see https://metatake.net/data for bulk/commercial access." };
