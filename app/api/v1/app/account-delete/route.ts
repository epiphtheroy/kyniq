import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";

/**
 * In-app account deletion — Apple App Review 5.1.1(v) requires that accounts
 * created in the app can be deleted in the app. Deletes the user's ledgers,
 * prefs and push registrations, then the auth user itself.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

export async function POST(req: Request) {
  const db = createAdminClient();
  if (await guardAndLog(db, req, "app_account_delete", null)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!bearer) {
    return NextResponse.json({ error: "auth" }, { status: 401, headers: API_CORS });
  }
  const { data: userData, error: userErr } = await db.auth.getUser(bearer);
  const user = userData?.user;
  if (userErr || !user) {
    return NextResponse.json({ error: "auth" }, { status: 401, headers: API_CORS });
  }

  try {
    // Best-effort row cleanup first (FKs may not cascade on legacy tables).
    for (const table of ["push_sent", "push_tokens", "user_prefs", "user_movies", "wtw_saved_views"]) {
      try {
        await db.from(table).delete().eq("user_id", user.id);
      } catch {
        /* table-level best effort */
      }
    }
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return NextResponse.json(
      { ok: true },
      { headers: { ...API_CORS, "cache-control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "delete_failed" },
      { status: 500, headers: API_CORS },
    );
  }
}
