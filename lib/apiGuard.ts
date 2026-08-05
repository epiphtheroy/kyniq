/**
 * apiGuard — shared harvest-guard + CORS helpers for the public read APIs
 * (/api/pack, /api/mcp, /api/v1). Keeps the 0091 velocity guard and the trusted
 * AI-platform egress exemption in one place so every public surface behaves the
 * same. See HANDOFF-MCP-서버.md §4.
 *
 * ⚠️ The guard fails OPEN by design — a DB hiccup must never break a free public
 * read path — but it must never fail SILENTLY. It did, for 24 days (2026-08-05
 * audit): pack_note_hit's PERSIST branch raised a format() error on every call
 * that reached it, and the call site below destructured only `data`. A Supabase
 * RPC reports SQL errors in `error`, it does not throw — so the try/catch never
 * ran, `data` came back undefined, `blocked` evaluated false, and the slow-drip
 * detector was off with nothing anywhere to show for it. Both halves are fixed:
 * migration 0134 repairs the SQL, and reportGuardFailure() below makes any future
 * break visible in Sentry within hours instead of never.
 */
import * as Sentry from "@sentry/nextjs";
import type { createAdminClient } from "@/lib/supabase/admin";
import { ipToPrefix } from "@/lib/ip-prefix";

// AI-platform egress exempt from BLOCKING (still ledgered by callers that ledger).
// Anthropic: 160.79.104.0/21 (observed live 160.79.106.0/24, UA Claude-User).
// Add other platforms only once observed in a ledger — never speculatively.
// This is the code-level layer, which also saves the DB round trip; the
// owner-editable layer is the pack_allowlist table (0134), read inside the RPC.
export const TRUSTED_EGRESS = /^160\.79\.(10[4-9]|11[01])\./;

export function callerPrefix(req: Request): { rawIp: string; prefix: string | null; trusted: boolean } {
  const rawIp = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "").split(",")[0].trim();
  return { rawIp, prefix: ipToPrefix(rawIp || null), trusted: TRUSTED_EGRESS.test(rawIp) };
}

// One report per minute per isolate: a broken guard is hit on every request, and
// an unthrottled capture would burn the Sentry quota to say one thing repeatedly.
let lastGuardReport = 0;

/** Surface a guard malfunction. Never throws — reporting must not break the route. */
function reportGuardFailure(detail: string, prefix: string | null) {
  try {
    const now = Date.now();
    if (now - lastGuardReport < 60_000) return;
    lastGuardReport = now;
    Sentry.captureException(new Error(`pack_note_hit guard failed: ${detail}`), {
      level: "error",
      tags: { subsystem: "harvest-guard" },
      extra: { prefix, hint: "guard is failing open — harvest protection is OFF until fixed" },
    });
  } catch { /* reporting is best-effort by definition */ }
}

/**
 * Note this hit against the per-/24 velocity counter (0134) and report whether
 * the prefix is now over the harvest threshold. Fail-open + trusted-egress-exempt:
 * a guard error or a trusted caller never blocks a legitimate request — but an
 * error is now reported rather than swallowed.
 */
export async function harvestBlocked(
  db: ReturnType<typeof createAdminClient>,
  prefix: string | null,
  trusted: boolean
): Promise<boolean> {
  if (!prefix || trusted) return false;
  try {
    const { data, error } = await db.rpc("pack_note_hit", { p_prefix: prefix });
    // A SQL fault arrives here, not as a throw. This is the branch that hid the
    // 0091 format() bug — it must never be dropped again.
    if (error) {
      reportGuardFailure(error.message, prefix);
      return false; // fail-open
    }
    if (!data || typeof data !== "object") {
      reportGuardFailure(`unexpected RPC payload: ${JSON.stringify(data)?.slice(0, 200)}`, prefix);
      return false;
    }
    return !!(data as { blocked?: boolean }).blocked;
  } catch (e) {
    reportGuardFailure(e instanceof Error ? e.message : "unknown throw", prefix);
    return false; // fail-open
  }
}

/**
 * Run the harvest guard AND ledger the call to api_calls (0100), returning
 * whether the caller is blocked. The single chokepoint for /api/v1 data routes:
 * one call replaces callerPrefix + harvestBlocked and adds the usage ledger.
 */
export async function guardAndLog(
  db: ReturnType<typeof createAdminClient>,
  req: Request,
  endpoint: string,
  arg: string | null,
): Promise<boolean> {
  const { prefix, trusted } = callerPrefix(req);
  const blocked = await harvestBlocked(db, prefix, trusted);
  // Ledger the call — ALWAYS, incl. trusted (Anthropic) callers, so Claude
  // traffic is not invisible. OUTSIDE the trusted short-circuit by design.
  // Fail-open: a logging error must never break the API response.
  try {
    await db.from("api_calls").insert({
      endpoint,
      arg: arg ? arg.slice(0, 200) : null,
      prefix,
      ua: (req.headers.get("user-agent") ?? "").slice(0, 300),
      ok: !blocked,
    });
  } catch { /* fail-open */ }
  return blocked;
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
