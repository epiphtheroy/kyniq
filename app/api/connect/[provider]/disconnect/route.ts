import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectConfigured } from "@/lib/connect/crypto";
import { getProvider } from "@/lib/connect/providers";

/**
 * Connect OAuth — DISCONNECT (HANDOFF-커넥트-기록이관.md §2.6, §6-3).
 * Deletes the connection row for (user, provider) under the service role, which
 * removes the encrypted tokens immediately (§6-3 "disconnect = immediate
 * deletion"). The imported ledger (user_movies / user_watch_log) is the user's
 * own data and stays (§2.6).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const { error } = await admin
    .from("user_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", providerId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CONNECT_CORS });
  }
  return NextResponse.json({ ok: true }, { headers: CONNECT_CORS });
}
