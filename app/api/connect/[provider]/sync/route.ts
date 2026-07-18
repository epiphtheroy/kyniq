import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectConfigured, encryptToken, decryptToken } from "@/lib/connect/crypto";
import { getProvider, type ProviderTokens } from "@/lib/connect/providers";
import { commitNormalizedRows } from "@/lib/import/commit-core";

/**
 * Connect OAuth — SYNC (HANDOFF-커넥트-기록이관.md §3, §4, §6).
 * Loads the stored (encrypted) tokens under the service role, refreshes them if
 * expired (Trakt ~24h — §1), pulls the member's library via the provider
 * adapter, and writes it through the ONE ledger (commitNormalizedRows →
 * user_watch_log + user_movies — §6-4, no shadow store). Simkl's activities +
 * date_from covenant is enforced inside the adapter (§6-6) — we just pass the
 * stored sync_cursor. Tokens stay server-side throughout (§6-3).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CONNECT_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "x-robots-tag": "noindex",
};

async function authUser(request: Request) {
  const ssr = await createServerClient();
  const { data: auth } = await ssr.auth.getUser();
  if (auth?.user) return auth.user;
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (bearer) {
    const { data: tok } = await createAdminClient().auth.getUser(bearer);
    if (tok?.user) return tok.user;
  }
  return null;
}

/** scope column carries {s:scope, r:redirect_uri} JSON (see /callback). */
function readScope(scope: string | null): { s: string | null; r: string | null } {
  if (!scope) return { s: null, r: null };
  try {
    const j = JSON.parse(scope) as { s?: string | null; r?: string | null };
    if (j && typeof j === "object" && ("s" in j || "r" in j)) {
      return { s: j.s ?? null, r: j.r ?? null };
    }
  } catch {
    /* legacy/plain scope string */
  }
  return { s: scope, r: null };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CONNECT_CORS });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!connectConfigured() || !provider?.configured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503, headers: CONNECT_CORS });
  }

  const user = await authUser(request);
  if (!user) {
    return NextResponse.json({ error: "auth" }, { status: 401, headers: CONNECT_CORS });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("user_connections")
    .select(
      "access_token, refresh_token, token_expires_at, account_ref, scope, sync_cursor, synced_films",
    )
    .eq("user_id", user.id)
    .eq("provider", providerId)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "not_connected" }, { status: 404, headers: CONNECT_CORS });
  }

  const now = new Date().toISOString();
  const setError = async (message: string) => {
    try {
      await admin
        .from("user_connections")
        .update({ status: "error", error: message.slice(0, 500), updated_at: now })
        .eq("user_id", user.id)
        .eq("provider", providerId);
    } catch {
      /* never mask the original failure */
    }
  };

  const accessToken = decryptToken(row.access_token as string | null);
  if (!accessToken) {
    // token unreadable (key rotated / never stored) → force reconnect
    await setError("token_unreadable");
    return NextResponse.json({ error: "token_unreadable" }, { status: 502, headers: CONNECT_CORS });
  }
  const { s: scopeStr, r: redirectUri } = readScope(row.scope as string | null);
  let tokens: ProviderTokens = {
    accessToken,
    refreshToken: decryptToken(row.refresh_token as string | null),
    expiresAt: (row.token_expires_at as string | null) ?? null,
    accountRef: (row.account_ref as string | null) ?? null,
    scope: scopeStr,
  };

  try {
    // Refresh if expired (60s skew). Only Trakt has a real refresh; others no-op.
    const expMs = tokens.expiresAt ? Date.parse(tokens.expiresAt) : NaN;
    let refreshed: ProviderTokens | null = null;
    if (Number.isFinite(expMs) && expMs <= Date.now() + 60_000) {
      refreshed = await provider.refresh(tokens, redirectUri ?? "");
      if (refreshed?.accessToken) {
        tokens = { ...tokens, ...refreshed };
      }
    }

    const { rows, cursor } = await provider.fetchLibrary(tokens, row.sync_cursor as string | null);
    const { stats } = await commitNormalizedRows(admin, user.id, rows, providerId, {});
    const films = new Set(rows.map((r) => r.tmdb_id)).size;

    // Persist sync state; roll new encrypted tokens in only if a refresh happened.
    const update: Record<string, unknown> = {
      last_sync_at: now,
      sync_cursor: cursor ?? (row.sync_cursor as string | null),
      synced_films: ((row.synced_films as number | null) ?? 0) + stats.added,
      status: "connected",
      error: null,
      updated_at: now,
    };
    if (refreshed?.accessToken) {
      update.access_token = encryptToken(refreshed.accessToken);
      update.refresh_token = refreshed.refreshToken
        ? encryptToken(refreshed.refreshToken)
        : (row.refresh_token as string | null);
      update.token_expires_at = refreshed.expiresAt ?? null;
    }
    await admin
      .from("user_connections")
      .update(update)
      .eq("user_id", user.id)
      .eq("provider", providerId);

    return NextResponse.json(
      { ok: true, added: stats.added, updated: stats.updated, films },
      { headers: CONNECT_CORS },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "sync_failed";
    await setError(message);
    return NextResponse.json({ error: message }, { status: 502, headers: CONNECT_CORS });
  }
}
