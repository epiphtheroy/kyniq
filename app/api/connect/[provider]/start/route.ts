import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectConfigured, encryptToken } from "@/lib/connect/crypto";
import { getProvider } from "@/lib/connect/providers";

/**
 * Connect OAuth — START (HANDOFF-커넥트-기록이관.md §2.4, §4, §6).
 * The app POSTs its deep-link redirect_uri; we begin the provider's auth flow
 * and hand back {url, pending}. `url` is opened in the system browser
 * (ASWebAuthSession — §6-2, WebView forbidden); `pending` is an encrypted,
 * server-signed blob the app echoes to /callback so we can complete the flow
 * without a new table (§4). Tokens never touch the client (§6-3).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Authed POST from the mobile app — allow Bearer + POST, mirror API noindex.
const CONNECT_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "x-robots-tag": "noindex",
};

/** Cookie session first (web), else Bearer access token (app) — marquee idiom. */
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

/** Web flow (§2.4 web leg): accept exactly `<own origin>/connect-callback` —
 * the request's own origin (covers previews + local dev) or the canonical
 * site. Exact path, no query/hash, https only (http for localhost).
 * Fail-closed on anything unparsable. */
function isOwnWebCallback(redirectUri: string, request: Request): boolean {
  try {
    const u = new URL(redirectUri);
    if (u.pathname !== "/connect-callback" || u.search || u.hash) return false;
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return false;
    if (u.host === "metatake.net" || u.host === "www.metatake.net") return true;
    return u.origin === new URL(request.url).origin;
  } catch {
    return false;
  }
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
  // Env-gate, like the Google OAuth surface: no key or unconfigured provider → 503.
  if (!connectConfigured() || !provider?.configured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503, headers: CONNECT_CORS });
  }

  const user = await authUser(request);
  if (!user) {
    return NextResponse.json({ error: "auth" }, { status: 401, headers: CONNECT_CORS });
  }

  let body: { redirect_uri?: unknown } = {};
  try {
    body = (await request.json()) as { redirect_uri?: unknown };
  } catch {
    /* empty body → validation below */
  }
  const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri.trim() : "";
  if (!redirectUri) {
    return NextResponse.json({ error: "redirect_uri_required" }, { status: 400, headers: CONNECT_CORS });
  }
  // Allowlist the redirect target — the app's own deep-link scheme
  // (metatake://…), an Expo dev URL (exp://…/--/connect-callback), or the
  // site's own /connect-callback web page. Prevents a caller from starting an
  // OAuth flow that redirects the approved token to an attacker-controlled URL.
  const REDIRECT_OK =
    /^metatake:\/\//i.test(redirectUri) ||
    /^exp:\/\/.*connect-callback/i.test(redirectUri) ||
    isOwnWebCallback(redirectUri, request);
  if (!REDIRECT_OK) {
    return NextResponse.json({ error: "redirect_uri_not_allowed" }, { status: 400, headers: CONNECT_CORS });
  }

  const state = randomUUID();
  try {
    const { url, carry } = await provider.beginAuth(redirectUri, state);
    // Sign the pending flow into an encrypted blob (server key protects it; the
    // embedded ts is checked on callback for 10-min validity). No new table (§4).
    const pending = encryptToken(
      JSON.stringify({ state, carry, redirect_uri: redirectUri, uid: user.id, ts: Date.now() }),
    );
    if (!pending) {
      // encryptToken only returns null without a key — but guard already proved
      // one exists, so this is defensive.
      return NextResponse.json({ error: "not_configured" }, { status: 503, headers: CONNECT_CORS });
    }
    return NextResponse.json({ url, pending }, { headers: CONNECT_CORS });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "begin_auth_failed" },
      { status: 502, headers: CONNECT_CORS },
    );
  }
}
