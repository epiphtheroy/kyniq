import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectConfigured, encryptToken, decryptToken } from "@/lib/connect/crypto";
import { getProvider } from "@/lib/connect/providers";

/**
 * Connect OAuth — CALLBACK (HANDOFF-커넥트-기록이관.md §2.4, §4, §6).
 * The OAuth provider redirects to the APP's deep link (not this endpoint); the
 * app extracts ?code= (Trakt/Simkl) or ?request_token= (TMDB) and POSTs it here
 * with the `pending` blob from /start. We verify the blob (uid + 10-min ts),
 * complete the token exchange server-side, and store the tokens ENCRYPTED
 * (§6-3, never exposed to the client). redirect_uri is persisted inside `scope`
 * as JSON ({s,r}) so /sync can supply it to Trakt's refresh grant (no new
 * column — §4 "additive only").
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNECT_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "x-robots-tag": "noindex",
};

const PENDING_TTL_MS = 10 * 60 * 1000;

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

type Pending = {
  state?: string;
  carry?: string | null;
  redirect_uri?: string;
  uid?: string;
  ts?: number;
};

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

  let body: { code?: unknown; request_token?: unknown; pending?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* validated below */
  }
  const pendingBlob = typeof body.pending === "string" ? body.pending : "";
  const code = typeof body.code === "string" ? body.code : undefined;
  const requestToken = typeof body.request_token === "string" ? body.request_token : undefined;
  if (!pendingBlob) {
    return NextResponse.json({ error: "pending_required" }, { status: 400, headers: CONNECT_CORS });
  }

  // Decrypt + validate the signed pending blob.
  let parsed: Pending | null = null;
  const raw = decryptToken(pendingBlob);
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Pending;
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed.uid !== "string") {
    return NextResponse.json({ error: "bad_pending" }, { status: 400, headers: CONNECT_CORS });
  }
  if (parsed.uid !== user.id) {
    return NextResponse.json({ error: "uid_mismatch" }, { status: 403, headers: CONNECT_CORS });
  }
  if (typeof parsed.ts !== "number" || Date.now() - parsed.ts > PENDING_TTL_MS) {
    return NextResponse.json({ error: "expired" }, { status: 400, headers: CONNECT_CORS });
  }

  try {
    // TMDB completes from `carry` (the approved request_token); Trakt/Simkl from
    // `code`. request_token may also be echoed on the deep link → accept either.
    const tokens = await provider.completeAuth({
      code: code ?? requestToken,
      carry: parsed.carry ?? null,
      redirectUri: parsed.redirect_uri ?? "",
    });
    if (!tokens?.accessToken) {
      return NextResponse.json({ error: "no_access_token" }, { status: 502, headers: CONNECT_CORS });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin.from("user_connections").upsert(
      {
        user_id: user.id,
        provider: providerId,
        access_token: encryptToken(tokens.accessToken),
        refresh_token: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
        token_expires_at: tokens.expiresAt ?? null,
        account_ref: tokens.accountRef ?? null,
        // stash redirect_uri for refresh (§4 no-new-column decision): {s:scope, r:redirect_uri}
        scope: JSON.stringify({ s: tokens.scope ?? null, r: parsed.redirect_uri ?? null }),
        status: "connected",
        error: null,
        updated_at: now,
      },
      { onConflict: "user_id,provider" },
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: CONNECT_CORS });
    }
    return NextResponse.json({ ok: true }, { headers: CONNECT_CORS });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "complete_auth_failed" },
      { status: 502, headers: CONNECT_CORS },
    );
  }
}
