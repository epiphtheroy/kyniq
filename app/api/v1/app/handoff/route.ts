import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";

/**
 * Mobile SSO handoff mint (HANDOFF-모바일앱-프리워치.md §7.3, invariant §13-12).
 * The app's session and the in-app webview's cookies are separate worlds; this
 * endpoint turns the app's Bearer token into a one-time web login URL so the
 * reader never shows a logged-out site. Implementation rides the EXISTING
 * /auth/confirm route (verifyOtp token_hash) — generateLink(magiclink) returns a
 * single-use hashed token without sending any email.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const SITE = "https://metatake.net";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

export async function POST(req: Request) {
  const db = createAdminClient();
  if (await guardAndLog(db, req, "app_handoff", null)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!bearer) {
    return NextResponse.json({ error: "auth" }, { status: 401, headers: API_CORS });
  }
  const { data: userData, error: userErr } = await db.auth.getUser(bearer);
  const user = userData?.user;
  if (userErr || !user?.email) {
    return NextResponse.json({ error: "auth" }, { status: 401, headers: API_CORS });
  }

  // Destination must be a same-site relative path (no protocol-relative "//").
  let next = "/";
  try {
    const body = (await req.json()) as { next?: string };
    if (typeof body.next === "string") next = body.next.trim();
  } catch {
    /* empty body → "/" */
  }
  if (!next.startsWith("/") || next.startsWith("//")) next = "/";

  try {
    const { data, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });
    if (error) throw error;
    const tokenHash = data.properties?.hashed_token;
    if (!tokenHash) throw new Error("no_token");
    const url = `${SITE}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&next=${encodeURIComponent(next)}`;
    return NextResponse.json(
      { url },
      { headers: { ...API_CORS, "cache-control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "handoff_failed" },
      { status: 500, headers: API_CORS },
    );
  }
}
